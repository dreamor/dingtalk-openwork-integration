/**
 * 钉钉 Channel 实现
 * 负责钉钉机器人的配置管理、消息签名验证、加解密和消息收发
 */
import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

// 钉钉消息类型定义
export interface DingtalkMessage {
  msgUid?: string;
  conversationId?: string;
  senderId?: string;
  senderNick?: string;
  text?: {
    content: string;
  };
  msgType: string;
  createTime: number;
}

/**
 * 消息拉取参数
 */
export interface FetchMessagesParams {
  cursor?: string | null;
  timeCursor?: number;
  limit?: number;
  timeout?: number;
}

/**
 * 消息拉取结果
 */
export interface FetchMessagesResult {
  hasMore: boolean;
  nextCursor?: string;
  messages: DingtalkMessage[];
}

export interface DingtalkResponse {
  msgType: string;
  content: {
    text: string;
  } | {
    markdown: {
      title: string;
      text: string;
    };
  };
}

export class DingtalkService {
  private httpClient: AxiosInstance;
  private tokenCache: Map<string, { token: string; expireTime: number }>;

  constructor() {
    this.tokenCache = new Map();
    this.httpClient = axios.create({
      baseURL: 'https://oapi.dingtalk.com',
      timeout: 10000,
    });
  }

  /**
   * 验证配置完整性
   */
  validateConfig(): void {
    const required = ['appKey', 'appSecret', 'accessToken'];
    const missing = required.filter(key => !config.dingtalk[key as keyof typeof config.dingtalk]);

    if (missing.length > 0) {
      throw new Error(`缺少钉钉配置: ${missing.join(', ')}`);
    }
  }

  /**
   * 获取 access_token (带缓存)
   */
  async getAccessToken(): Promise<string> {
    const cacheKey = 'access_token';
    const cached = this.tokenCache.get(cacheKey);

    if (cached && Date.now() < cached.expireTime) {
      return cached.token;
    }

    try {
      const response = await this.httpClient.get('/gettoken', {
        params: {
          appkey: config.dingtalk.appKey,
          appsecret: config.dingtalk.appSecret,
        },
      });

      if (response.data.errcode !== 0) {
        throw new Error(`获取 access_token 失败: ${response.data.errmsg}`);
      }

      const token = response.data.access_token;
      // 缓存 7200 秒，提前5分钟刷新
      this.tokenCache.set(cacheKey, {
        token,
        expireTime: Date.now() + (7200 - 300) * 1000,
      });

      return token;
    } catch (error) {
      throw new Error(`获取 access_token 异常: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * 验证签名
   */
  verifySignature(timestamp: string, sign: string): boolean {
    try {
      const { signingSecret } = config.dingtalk;
      
      if (!signingSecret) {
        console.warn('[Dingtalk] 未配置 signingSecret，跳过签名验证');
        return true;
      }
      
      // 构建待签名字符串: timestamp + "\n" + signingSecret
      const stringToSign = `${timestamp}\n${signingSecret}`;
      
      // 使用 HMAC-SHA256 算法签名
      const hmac = crypto.createHmac('sha256', signingSecret);
      hmac.update(stringToSign);
      const calculatedSign = hmac.digest('base64');
      
      // 使用 timingSafeEqual 进行安全比较
      return crypto.timingSafeEqual(
        Buffer.from(calculatedSign),
        Buffer.from(sign)
      );
    } catch (error) {
      console.error('[Dingtalk] 签名验证过程中发生错误:', error);
      return false;
    }
  }

  /**
   * 验证消息时间戳 (防止重放攻击)
   */
  verifyTimestamp(timestamp: string): boolean {
    const messageTime = parseInt(timestamp, 10);
    const currentTime = Date.now();
    const diff = Math.abs(currentTime - messageTime);

    // 5分钟内有效
    return diff < 5 * 60 * 1000;
  }

  /**
   * 解密消息
   */
  decryptMessage(encryptedMsg: string): string {
    const { aesKey } = config.dingtalk;

    if (!aesKey) {
      throw new Error('未配置 aesKey，无法解密消息');
    }

    // aesKey 需要先base64解码
    const key = Buffer.from(aesKey + '=', 'base64');

    // 从消息中提取随机向量、盐值和密文
    // 钉钉消息格式: 随机向量(16) + 盐值(32) + 密文 + 消息长度(4)
    const encryptedBuffer = Buffer.from(encryptedMsg, 'base64');

    if (encryptedBuffer.length < 20) {
      throw new Error('加密消息长度不合法');
    }

    const iv = encryptedBuffer.subarray(0, 16);
    const msgEncrypted = encryptedBuffer.subarray(20, encryptedBuffer.length - 4);
    const msgLengthBuffer = encryptedBuffer.subarray(encryptedBuffer.length - 4);
    const msgLength = msgLengthBuffer.readInt32BE(0);

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = decipher.update(msgEncrypted);
    decipher.final();

    // 只取实际消息长度部分
    const messageJson = decrypted.subarray(0, msgLength).toString('utf8');

    // 返回完整的消息JSON数据而不是仅content字段
    return messageJson;
  }

  /**
   * 加密消息
   */
  encryptMessage(content: string): string {
    const { aesKey } = config.dingtalk;
    
    if (!aesKey) {
      throw new Error('未配置 aesKey，无法加密消息');
    }
    
    const key = Buffer.from(aesKey + '=', 'base64');

    const randomIV = crypto.randomBytes(16);
    const randomKey = crypto.randomBytes(32);

    const contentBuffer = Buffer.from(JSON.stringify({ content }), 'utf8');
    const contentLength = contentBuffer.length;

    // 拼接消息: 随机向量 + 盐值 + 密文 + 消息长度
    const cipher = crypto.createCipheriv('aes-256-cbc', randomKey, randomIV);
    const encrypted = Buffer.concat([
      cipher.update(contentBuffer),
      cipher.final(),
    ]);

    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeInt32BE(contentLength, 0);

    const encryptedMessage = Buffer.concat([
      randomIV,
      randomKey,
      encrypted,
      lengthBuffer,
    ]);

    return encryptedMessage.toString('base64');
  }

  /**
   * 解析用户身份
   */
  parseUserIdentity(message: DingtalkMessage): { userId: string; userName: string } {
    return {
      userId: message.senderId || 'unknown',
      userName: message.senderNick || '未知用户',
    };
  }

  /**
   * 发送 Markdown 格式消息
   */
  async sendMarkdownMessage(accessToken: string, title: string, text: string): Promise<void> {
    await this.httpClient.post('/robot/send', {
      msgtype: 'markdown',
      markdown: {
        title,
        text,
      },
      access_token: accessToken,
    });
  }

  /**
   * 发送文本消息
   */
  async sendTextMessage(accessToken: string, content: string, mentionList?: string[]): Promise<void> {
    await this.httpClient.post('/robot/send', {
      msgtype: 'text',
      text: {
        content,
      },
      at: {
        atUserIds: mentionList || [],
        isAtAll: false,
      },
      access_token: accessToken,
    });
  }

  /**

   * 拉取消息列表 (用于轮询模式)

   * 使用钉钉 Long Polling API，无需配置回调 URL

   * API 文档：https://open.dingtalk.com/document/orgapp-server/server-api-overview

   */

  async fetchMessages(params: FetchMessagesParams): Promise<FetchMessagesResult> {

    const {

      cursor,

      timeCursor,

      limit = 20,

      timeout = 30000, // Long Polling 需要较长超时

    } = params;

  

    try {

      const accessToken = await this.getAccessToken();

  

      // 构建请求体

      const requestBody: Record<string, unknown> = {

        limit,

      };

  

      if (cursor) {

        requestBody['cursor'] = cursor;

      }

  

      // 使用钉钉 Long Polling API

      // 这是钉钉官方提供的免回调 URL 方案，适合轮询模式

      // 文档：https://open.dingtalk.com/document/orgapp-server/obtain-llm-pushes

      const response = await this.httpClient.post(

        '/v1.0/contact/messages/get',

        requestBody,

        {

          params: {

            access_token: accessToken,

          },

          timeout,

          headers: {

            'Content-Type': 'application/json',

          },

        }

      );

  

      if (response.data.code !== 'ok' && !response.data.success) {

        throw new Error(`拉取消息失败：${response.data.message || response.data.errmsg || '未知错误'}`);

      }

  

      const data = response.data || {};

      const messages: DingtalkMessage[] = (data.result?.items || []).map((msg: Record<string, unknown>) => ({

        msgUid: msg.msgUuid as string || String(msg.bizId || ''),

        conversationId: msg.conversationId as string,

        senderId: msg.senderId as string,

        senderNick: msg.senderNick as string || '未知',

        text: msg.text ? { content: String(msg.text) } : undefined,

        msgType: msg.msgType as string || 'text',

        createTime: Number(msg.createTime || msg.sendTime || Date.now()),

      }));

  

      return {

        hasMore: data.hasMore === true,

        nextCursor: data.nextCursor as string | undefined,

        messages,

      };

    } catch (error) {

      const message = error instanceof Error ? error.message : '未知错误';

      throw new Error(`拉取消息异常：${message}`);

    }

  }

  /**
   * 拉取群消息 (使用群机器人接口)
   */
  async fetchGroupMessages(sinceTimestamp?: number, limit: number = 20): Promise<DingtalkMessage[]> {
    try {
      const accessToken = await this.getAccessToken();

      // 群机器人不支持历史消息拉取，这里返回空数组
      // 在实际使用时，需要结合钉钉企业自建应用或其他方式
      console.log('[DingtalkService] 群机器人不支持历史消息拉取，返回空数组');

      // 如果有时间戳参数，尝试获取该时间点之后的消息
      if (sinceTimestamp) {
        // 这里需要企业自建应用权限
        // 使用企业自建应用的会话消息拉取接口
        const timestamp = sinceTimestamp;
        const response = await this.httpClient.get('/topapi/im/v1/messages', {
          params: {
            access_token: accessToken,
            start_time: timestamp,
            limit,
          },
          timeout: 5000,
        });

        if (response.data.errcode === 0) {
          const data = response.data.result || {};
          return (data.messages || []).map((msg: Record<string, unknown>) => ({
            msgUid: msg.msgUid as string,
            conversationId: msg.conversationId as string,
            senderId: msg.senderId as string,
            senderNick: msg.senderNick as string,
            text: msg.content ? { content: String(msg.content) } : undefined,
            msgType: msg.msgType as string,
            createTime: Number(msg.createTime) || Date.now(),
          }));
        }
      }

      return [];
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      console.error(`[DingtalkService] 拉取群消息失败: ${message}`);
      throw error;
    }
  }
}