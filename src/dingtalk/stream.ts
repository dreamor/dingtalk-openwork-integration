/**
 * 钉钉 Stream 模式服务 - 基于官方 SDK
 * 使用 WebSocket 长连接接收消息，使用 sessionWebhook 回复消息
 * 文档：https://open.dingtalk.com/document/development/introduction-to-stream-mode
 * SDK: https://github.com/open-dingtalk/dingtalk-stream-sdk-nodejs
 */
import { DWClient, TOPIC_ROBOT, DWClientDownStream } from 'dingtalk-stream';
import { config } from '../config';
import axios from 'axios';
import { updateAdminSessionWebhook, getAdminConversationId } from '../utils/alert';

// 消息处理回调
export interface MessageHandler {
  (userId: string, userName: string, content: string, conversationId: string, sessionWebhook: string): Promise<void>;
}

// 订阅配置 - 使用 CALLBACK 类型
const DEFAULT_SUBSCRIPTIONS = [
  { type: 'CALLBACK', topic: TOPIC_ROBOT },
];

// 会话信息
interface SessionInfo {
  conversationId: string;
  sessionWebhook: string;
  timestamp: number; // 添加时间戳用于过期清理
}

export class DingtalkStreamService {
  private client: DWClient | null = null;
  private messageHandler: MessageHandler | null = null;
  private isConnected: boolean = false;
  private connectionStartTime: number = 0; // 连接开始时间
  private lastHeartbeatTime: number = 0; // 最后心跳时间
  private pendingMessages: Map<string, SessionInfo> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private heartbeatMonitorTimer: NodeJS.Timeout | null = null; // 心跳监控定时器
  private readonly messageTTL: number = 30 * 60 * 1000; // 30分钟过期时间
  private readonly heartbeatTimeout: number = 60 * 1000; // 60秒心跳超时

  constructor() {
    console.log('📡 Stream 模式服务已初始化 (使用官方 SDK)');
    console.log('   - 订阅主题:', DEFAULT_SUBSCRIPTIONS.map(s => s.topic).join(', '));
    console.log('   - SDK 内置重连：启用 (keepAlive: true)');
    console.log('   - 心跳超时监控：60秒');
    
    // 启动清理定时器，每5分钟清理一次过期的会话信息
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredMessages();
    }, 5 * 60 * 1000);
    
    // 启动心跳监控
    this.startHeartbeatMonitor();
  }

  /**
   * 设置消息处理回调
   */
  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  /**
   * 启动 Stream 连接
   */
  async start(): Promise<void> {
    const { appKey, appSecret } = config.dingtalk;

    if (!appKey || !appSecret) {
      throw new Error('缺少钉钉 appKey 或 appSecret 配置');
    }

    console.log('🚀 正在初始化钉钉 Stream 客户端...');
    console.log(`   - clientId: ${appKey}`);
    console.log(`   - 长连接保持：${config.stream.enabled ? '启用' : '禁用'}`);

    // 创建客户端
    this.client = new DWClient({
      clientId: appKey,
      clientSecret: appSecret,
      keepAlive: true,
      debug: true,
    });

    // ⚠️ 关键：在 connect 之前设置订阅
    this.client.config.subscriptions = DEFAULT_SUBSCRIPTIONS;

    // 注册连接成功事件
    this.client.on('ready', () => {
      this.connectionStartTime = Date.now();
      this.isConnected = true;
      console.log('✅ Stream 连接已建立，可以接收消息');
      console.log(`   连接时间: ${new Date().toISOString()}`);
    });

    // 注册连接关闭事件
    this.client.on('close', () => {
      this.isConnected = false;
      const connectionDuration = this.connectionStartTime ? 
        Math.round((Date.now() - this.connectionStartTime) / 1000) : 0;
      console.log(`❌ Stream 连接已关闭 (持续 ${connectionDuration} 秒)`);
      console.log('   SDK 将自动重连...');
    });

    // 注册错误事件 - 仅记录日志，不手动重连（避免与 SDK keepAlive 冲突）
    this.client.on('error', (error: Error) => {
      this.isConnected = false;
      console.error('❌ Stream 连接错误:', error.message);
      console.error('   错误类型:', error.constructor.name);
      // SDK 的 keepAlive: true 会自动重连，无需手动处理
    });

    // 注册机器人消息回调监听器 - ⚠️ 必须在 connect 之前注册
    this.client.registerCallbackListener(TOPIC_ROBOT, async (msg: DWClientDownStream) => {
      console.log('========================================');
      console.log('[Stream] 📩 收到机器人消息回调');
      console.log('   - 消息 ID:', msg.headers.messageId);
      console.log('   - Topic:', msg.headers.topic);
      console.log('   - 时间:', new Date(parseInt(msg.headers.time) || Date.now()).toISOString());
      console.log('========================================');
      
      await this.handleMessage(msg).catch(error => {
        console.error('[Stream] ❌ 处理消息失败:', error);
      });
    });

    // 启动连接
    try {
      console.log('🚀 正在连接钉钉 Stream 服务...');
      await this.client.connect();
      console.log('✅ Stream 连接成功，等待消息...');
    } catch (error) {
      console.error('❌ 连接失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 启动心跳监控
   * 如果超过 60 秒没有收到心跳，认为连接可能断开
   */
  private startHeartbeatMonitor(): void {
    this.heartbeatMonitorTimer = setInterval(() => {
      if (this.isConnected && this.lastHeartbeatTime > 0) {
        const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeatTime;
        if (timeSinceLastHeartbeat > this.heartbeatTimeout) {
          console.warn(`⚠️ 心跳超时 (${Math.round(timeSinceLastHeartbeat / 1000)}秒)，连接可能断开`);
          console.warn('   等待 SDK 自动重连...');
        }
      }
    }, 30 * 1000); // 每 30 秒检查一次
  }

  /**
   * 更新心跳时间
   */
  updateHeartbeat(): void {
    this.lastHeartbeatTime = Date.now();
  }

  /**
   * 停止 Stream 连接
   */
  async stop(): Promise<void> {
    console.log('🛑 正在停止 Stream 连接...');
    
    // 清理定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    if (this.heartbeatMonitorTimer) {
      clearInterval(this.heartbeatMonitorTimer);
      this.heartbeatMonitorTimer = null;
    }
    
    if (this.client) {
      try {
        this.client.disconnect();
      } catch (error) {
        console.error('断开连接时出错:', error);
      }
      this.client = null;
    }
    
    this.isConnected = false;
    this.pendingMessages.clear();
    console.log('✅ Stream 服务已停止');
  }

  /**
   * 处理接收到的消息
   */
  private async handleMessage(msg: DWClientDownStream): Promise<void> {
    try {
      // 解析消息数据
      const data = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
      
      const {
        senderId,
        senderNick,
        text,
        msgtype,
        conversationId,
        sessionWebhook,
      } = data;

      // 只处理文本消息
      if (msgtype !== 'text' || !text?.content) {
        console.log(`[Stream] 跳过非文本消息：${msgtype}`);
        return;
      }

      const userId = senderId || 'unknown';
      const userName = senderNick || '未知用户';
      const content = text.content;

      // 保存会话信息（用于后续回复）
      if (conversationId && sessionWebhook) {
        this.pendingMessages.set(conversationId, { 
          conversationId, 
          sessionWebhook,
          timestamp: Date.now()
        });
        
        // 更新管理员的 sessionWebhook（用于告警通知）
        const adminUserId = getAdminConversationId();
        if (adminUserId && userId === adminUserId) {
          console.log(`[Stream] 检测到管理员消息，更新 sessionWebhook`);
          updateAdminSessionWebhook(conversationId, sessionWebhook);
        } else if (adminUserId) {
          console.log(`[Stream] 忽略非管理员消息: ${userId} vs ${adminUserId}`);
        }
      }

      console.log(`[Stream] 收到用户 ${userName}(${userId}) 的消息：${content}`);
      console.log(`[Stream] sessionWebhook: ${sessionWebhook ? '✅' : '❌'}`);

      // 调用消息处理器
      if (this.messageHandler) {
        if (sessionWebhook) {
          await this.messageHandler(userId, userName, content, conversationId, sessionWebhook);
        } else {
          console.warn('[Stream] 缺少 sessionWebhook，无法回复消息');
        }
      } else {
        console.warn('[Stream] 消息处理器未设置，消息将被忽略');
      }

      // 响应消息处理完成
      this.client?.socketCallBackResponse(msg.headers.messageId, { received: true });
    } catch (error) {
      console.error('[Stream] 消息解析失败:', error);
      this.client?.socketCallBackResponse(msg.headers.messageId, { 
        error: error instanceof Error ? error.message : '未知错误' 
      });
    }
  }

  /**
   * 发送文本消息（使用 sessionWebhook）
   */
  async sendTextMessage(
    conversationId: string,
    content: string,
    mentionList?: string[]
  ): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('Stream 客户端未连接');
      }

      // 查找 sessionWebhook
      const sessionInfo = this.pendingMessages.get(conversationId);
      
      if (!sessionInfo?.sessionWebhook) {
        throw new Error('未找到 sessionWebhook，无法发送消息');
      }

      console.log(`[Stream] 使用 sessionWebhook 发送消息：${content.substring(0, 50)}...`);

      // 构建消息体
      const messageBody = {
        msgtype: 'text',
        text: {
          content,
          at: {
            atUserIds: mentionList || [],
            isAtAll: mentionList?.includes('ALL') || false,
          },
        },
      };

      // 发送消息
      await axios.post(sessionInfo.sessionWebhook, messageBody);

      console.log('[Stream] ✅ 消息发送成功');
    } catch (error: any) {
      console.error('[Stream] ❌ 发送消息失败:', error.message);
      if (error.response?.data) {
        console.error('[Stream] 响应数据:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * 发送 Markdown 消息（使用 sessionWebhook）
   */
  async sendMarkdownMessage(
    conversationId: string,
    title: string,
    text: string
  ): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('Stream 客户端未连接');
      }

      // 查找 sessionWebhook
      const sessionInfo = this.pendingMessages.get(conversationId);
      
      if (!sessionInfo?.sessionWebhook) {
        throw new Error('未找到 sessionWebhook，无法发送消息');
      }

      console.log(`[Stream] 使用 sessionWebhook 发送 Markdown 消息：${title}`);

      // 构建 Markdown 消息体
      const messageBody = {
        msgtype: 'markdown',
        markdown: {
          title,
          text,
        },
      };

      // 发送消息
      await axios.post(sessionInfo.sessionWebhook, messageBody);

      console.log('[Stream] ✅ Markdown 消息发送成功');
    } catch (error: any) {
      console.error('[Stream] ❌ 发送 Markdown 消息失败:', error.message);
      if (error.response?.data) {
        console.error('[Stream] 响应数据:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * 清理过期的消息会话
   */
  private cleanupExpiredMessages(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    // 遍历所有会话，清理过期的条目
    for (const [conversationId, sessionInfo] of this.pendingMessages.entries()) {
      if (now - sessionInfo.timestamp > this.messageTTL) {
        this.pendingMessages.delete(conversationId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[Stream] 清理了 ${cleanedCount} 个过期的会话信息`);
    }
  }

  /**
   * 获取连接状态
   */
  getStatus() {
    const now = Date.now();
    const uptime = this.connectionStartTime ? 
      Math.round((now - this.connectionStartTime) / 1000) : 0;
    const timeSinceHeartbeat = this.lastHeartbeatTime ? 
      Math.round((now - this.lastHeartbeatTime) / 1000) : -1;
    
    return {
      connected: this.isConnected,
      uptimeSeconds: uptime,
      lastHeartbeatSecondsAgo: timeSinceHeartbeat,
      pendingMessages: this.pendingMessages.size,
      connectionStartTime: this.connectionStartTime ? 
        new Date(this.connectionStartTime).toISOString() : null,
    };
  }
}