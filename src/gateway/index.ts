/**
 * Gateway 服务模块 - 简化版消息处理
 * 所有消息直接路由到 OpenCode CLI 处理
 */
import express, { Express, Request, Response, NextFunction } from 'express';
import { DingtalkService, type DingtalkMessage } from '../dingtalk/dingtalk';
import { SessionManager } from '../session-manager';
import { MessageQueue } from '../message-queue/messageQueue';
import { RateLimiter } from '../message-queue/rateLimiter';
import { ConcurrencyController } from '../message-queue/concurrencyController';
import { MessageDeduplicator } from '../utils/dedupCache';
import { OpenCodeExecutor, type MessageContext } from '../opencode';
import { config } from '../config';
import { UserMessage, AIMessage } from '../types/message';
import { generateMessageId } from '../utils/messageId';
import { renderMarkdown } from '../utils/markdown';

// Gateway 依赖接口
export interface GatewayDeps {
  sessionManager: SessionManager;
  messageQueue: MessageQueue;
  rateLimiter: RateLimiter;
  concurrencyController: ConcurrencyController;
  deduplicator: MessageDeduplicator;
  openCodeExecutor?: OpenCodeExecutor;
}

interface GatewayRequest {
  msg: string;
  userId?: string;
  userName?: string;
  conversationId?: string;
}

interface GatewayResponse {
  success: boolean;
  message: string;
  data?: {
    result?: string;
    conversationId?: string;
    executionTime?: number;
    messageId?: string;
  };
}

export class GatewayServer {
  private app: Express;
  private dingtalkService: DingtalkService;
  private openCodeExecutor: OpenCodeExecutor;
  private sessionManager: SessionManager;
  private messageQueue: MessageQueue;
  private rateLimiter: RateLimiter;
  private concurrencyController: ConcurrencyController;
  private deduplicator: MessageDeduplicator;
  private server: ReturnType<Express['listen']> | null = null;
  private consumerRunning: boolean = false; // 标记消费者是否运行
  private consumerTimer: NodeJS.Timeout | null = null; // 消费者定时器

  constructor(
    dingtalkService: DingtalkService,
    deps: GatewayDeps
  ) {
    this.app = express();
    this.dingtalkService = dingtalkService;
    this.openCodeExecutor = deps.openCodeExecutor || new OpenCodeExecutor();
    this.sessionManager = deps.sessionManager;
    this.messageQueue = deps.messageQueue;
    this.rateLimiter = deps.rateLimiter;
    this.concurrencyController = deps.concurrencyController;
    this.deduplicator = deps.deduplicator;
    
    console.log('✅ Gateway 已启用，所有消息将路由到 OpenCode');
    this.setupMiddleware();
    this.setupRoutes();
    
    // 启动消费者循环
    this.startConsumer();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());

    // 认证中间件 - 保护敏感接口
    this.app.use('/api/test', this.authMiddleware.bind(this));
    this.app.use('/api/sessions', this.authMiddleware.bind(this));
    this.app.use('/api/queue', this.authMiddleware.bind(this));
    this.app.use('/api/status', this.authMiddleware.bind(this));

    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });

    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      console.error('请求处理错误:', err);
      res.status(500).json({
        success: false,
        message: '内部服务器错误',
      });
    });
  }

  /**
   * API 认证中间件
   */
  private authMiddleware(req: Request, res: Response, next: NextFunction): void {
    // 如果没有配置 API 令牌，则跳过认证（开发环境）
    if (!config.gateway.apiToken) {
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: '缺少认证信息',
      });
      return;
    }

    const token = authHeader.substring(7); // 移除 'Bearer ' 前缀
    if (token !== config.gateway.apiToken) {
      res.status(401).json({
        success: false,
        message: '认证失败',
      });
      return;
    }

    next();
  }

  private setupRoutes(): void {
    // 健康检查
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        mode: 'opencode',
      });
    });

    // 钉钉 Webhook 回调
    this.app.post('/api/dingtalk/webhook', async (req: Request, res: Response) => {
      try {
        await this.handleDingtalkMessage(req, res);
      } catch (error) {
        console.error('处理钉钉消息失败:', error);
        res.status(500).json({
          success: false,
          message: '消息处理失败',
        });
      }
    });

    // 测试接口
    this.app.post('/api/test', async (req: Request, res: Response) => {
      try {
        const result = await this.processMessage({
          msg: req.body.msg || '',
          userId: 'test-user',
          userName: '测试用户',
        });
        res.json(result);
      } catch (error) {
        res.status(500).json({
          success: false,
          message: error instanceof Error ? error.message : '未知错误',
        });
      }
    });

    // 获取会话状态
    this.app.get('/api/sessions', async (_req: Request, res: Response) => {
      const stats = await this.sessionManager.getStats();
      res.json({
        success: true,
        data: stats,
      });
    });

    // 获取队列状态
    this.app.get('/api/queue', (_req: Request, res: Response) => {
      res.json({
        success: true,
        data: this.messageQueue.getStatus(),
      });
    });

    // 检查 OpenCode 是否可用
    this.app.get('/api/status', async (_req: Request, res: Response) => {
      const opencodeAvailable = await this.openCodeExecutor.isAvailable();
      res.json({
        success: true,
        data: {
          opencodeAvailable,
          opencodeCommand: config.opencode.command,
          timeout: config.opencode.timeout,
        },
      });
    });
  }

  private async handleDingtalkMessage(req: Request, res: Response): Promise<void> {
    const timestamp = req.headers['x-dingtalk-timestamp'] as string;
    const sign = req.headers['x-dingtalk-signature'] as string;

    // 签名验证（仅在配置了 signingSecret 时启用）
    // 注意：Stream 模式不需要签名验证，此逻辑仅用于传统 Webhook 备用模式
    if (config.dingtalk.signingSecret) {
      // 检查签名信息是否存在
      if (!timestamp || !sign) {
        console.warn('[Gateway] 缺少签名信息');
        res.status(401).json({ success: false, message: '缺少签名信息' });
        return;
      }

      // 验证时间戳（防止重放攻击）
      if (!this.dingtalkService.verifyTimestamp(timestamp)) {
        console.warn(`[Gateway] 消息已过期，时间戳：${timestamp}`);
        res.status(401).json({ success: false, message: '消息已过期' });
        return;
      }

      // 验证签名内容
      try {
        if (!this.dingtalkService.verifySignature(timestamp, sign)) {
          console.warn(`[Gateway] 签名验证失败，时间戳：${timestamp}`);
          res.status(401).json({ success: false, message: '签名验证失败' });
          return;
        }
      } catch (error) {
        console.error('[Gateway] 签名验证过程中发生错误:', error);
        res.status(401).json({ success: false, message: '签名验证失败' });
        return;
      }
    }

    // 解析消息
    let message: DingtalkMessage;
    try {
      if (req.body.encrypt) {
        // 注意：解密功能需要配置 aesKey，Stream 模式下不需要
        if (!config.dingtalk.aesKey) {
          console.warn('[Gateway] 收到加密消息但未配置 aesKey');
          res.status(400).json({ success: false, message: '未配置消息解密' });
          return;
        }
        const decryptedContent = this.dingtalkService.decryptMessage(req.body.encrypt);
        message = JSON.parse(decryptedContent);
      } else {
        message = req.body;
      }
    } catch (error) {
      console.error('消息解密失败:', error);
      res.status(400).json({ success: false, message: '消息格式错误' });
      return;
    }

    // 只处理文本消息
    if (message.msgType !== 'text') {
      console.log(`不支持的消息类型：${message.msgType}`);
      res.json({ success: true, message: '消息已接收 (暂不支持此类型)' });
      return;
    }

    const { userId, userName } = this.dingtalkService.parseUserIdentity(message);
    const msgContent = message.text?.content || '';

    console.log(`收到用户 ${userName}(${userId}) 的消息：${msgContent}`);

    // 处理消息
    const result = await this.processMessage({
      msg: msgContent,
      userId,
      userName,
    });

    // 发送回复
    const accessToken = await this.dingtalkService.getAccessToken();
    
    if (result.success && result.data?.result) {
      const markdownText = renderMarkdown(result.data.result);
      await this.dingtalkService.sendMarkdownMessage(
        accessToken,
        'OpenCode 回复',
        markdownText
      );
    } else {
      await this.dingtalkService.sendTextMessage(
        accessToken,
        `❌ 处理失败：${result.message}`
      );
    }

    res.json({ success: true, message: '消息已处理' });
  }

  /**
   * 核心消息处理方法
   * 支持直接处理或队列处理模式
   */
  async processMessage(request: GatewayRequest, useQueue: boolean = false): Promise<GatewayResponse> {
    const { msg, userId = 'unknown', userName = '用户' } = request;

    if (useQueue) {
      console.log(`[Gateway] 接收到用户 ${userName}(${userId}) 的消息，加入队列：${msg.substring(0, 50)}...`);

      try {
        // 创建用户消息对象
        const userMessage: UserMessage = {
          id: generateMessageId(),
          type: 'user',
          conversationId: '', // 消费者处理时会获取或创建会话
          userId,
          username: userName,
          content: msg,
          metadata: {
            timestamp: Date.now(),
            source: 'dingtalk',
          },
        };

        // 将消息加入队列
        this.messageQueue.enqueue(userMessage, 'normal');
        
        // 立即返回成功响应
        return {
          success: true,
          message: '消息已接收，正在处理中',
          data: {
            messageId: userMessage.id,
          },
        };
      } catch (error) {
        console.error('[Gateway] 入队消息失败:', error);
        return {
          success: false,
          message: '消息接收失败',
        };
      }
    } else {
      // 直接处理模式（保持向后兼容）
      return this.processMessageInternal(request);
    }
  }

  /**
   * 构建传递给 OpenCode 的对话历史
   */
  private async buildHistoryForOpenCode(
    conversationId: string
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const messages = await this.sessionManager.getHistory(conversationId, 20);
    
    return messages
      .filter(msg => msg.type === 'user' || msg.type === 'ai')
      .map(msg => ({
        role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content,
      }));
  }

  async start(port: number, host: string = '0.0.0.0'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, host, () => {
        console.log(`🚀 Gateway 服务器已启动`);
        console.log(`   - 地址：http://${host}:${port}`);
        console.log(`   - 健康检查：http://${host}:${port}/health`);
        console.log(`   - 测试接口：http://${host}:${port}/api/test`);
        console.log(`   - 状态检查：http://${host}:${port}/api/status`);
        resolve();
      });

      this.server!.on('error', (error) => {
        reject(error);
      });
    });
  }

  async stop(): Promise<void> {
    // 停止消费者循环
    this.stopConsumer();
    
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          console.log('🛑 Gateway 服务器已停止');
          resolve();
        });
      });
    }
  }

  /**
   * 启动消费者循环
   */
  private startConsumer(): void {
    if (this.consumerRunning) {
      return;
    }
    
    this.consumerRunning = true;
    console.log('[Gateway] 消息消费者已启动');
    
    // 启动消费循环
    this.consumeLoop();
  }

  /**
   * 停止消费者循环
   */
  private stopConsumer(): void {
    this.consumerRunning = false;
    
    if (this.consumerTimer) {
      clearTimeout(this.consumerTimer);
      this.consumerTimer = null;
    }
    
    console.log('[Gateway] 消息消费者已停止');
  }

  /**
   * 消费循环
   */
  private consumeLoop(): void {
    if (!this.consumerRunning) {
      return;
    }

    // 处理队列中的消息
    this.processQueuedMessages()
      .catch(error => {
        console.error('[Gateway] 处理队列消息时发生错误:', error);
      })
      .finally(() => {
        // 安排下次循环
        if (this.consumerRunning) {
          this.consumerTimer = setTimeout(() => {
            this.consumeLoop();
          }, 100); // 每100毫秒检查一次队列
        }
      });
  }

  /**
   * 处理队列中的消息
   */
  private async processQueuedMessages(): Promise<void> {
    try {
      // 批量获取消息（最多处理5条）
      const queuedMessages = this.messageQueue.batchDequeue(5);
      
      if (queuedMessages.length === 0) {
        return;
      }
      
      console.log(`[Gateway] 从队列中获取到 ${queuedMessages.length} 条消息`);
      
      // 并行处理消息
      const processPromises = queuedMessages.map(async (queuedMsg) => {
        const { message, retryCount } = queuedMsg;
        
        try {
          console.log(`[Gateway] 处理队列消息：${message.content.substring(0, 50)}...`);
          
          // 处理消息（注意：这里需要构造正确的request对象）
          const result = await this.processMessageInternal({
            msg: message.content,
            userId: message.userId,
            userName: message.username || '用户'
          });
          
          // 标记消息处理完成
          this.messageQueue.complete(message.id);
          
          console.log(`[Gateway] 队列消息处理完成: ${message.id}`);
        } catch (error) {
          console.error(`[Gateway] 处理队列消息失败: ${message.id}`, error);
          
          // 标记消息处理失败，重新入队
          this.messageQueue.fail(message.id);
          
          // 如果重试次数过多，记录错误日志
          if (retryCount >= 3) {
            console.error(`[Gateway] 消息重试次数过多，将丢弃: ${message.id}`);
          }
        }
      });
      
      // 等待所有消息处理完成
      await Promise.all(processPromises);
    } catch (error) {
      console.error('[Gateway] 处理队列消息时发生错误:', error);
    }
  }

  /**
   * 内部消息处理方法（从processMessage提取出的核心逻辑）
   */
  private async processMessageInternal(request: GatewayRequest): Promise<GatewayResponse> {
    const { msg, userId = 'unknown', userName = '用户' } = request;
    const startTime = Date.now();

    console.log(`[Gateway] 处理来自用户 ${userName}(${userId}) 的消息：${msg}`);

    // 1. 基础验证
    if (!msg || msg.trim() === '') {
      return {
        success: false,
        message: '消息内容为空',
      };
    }

    // 2. 消息去重检查
    if (this.deduplicator.isDuplicate(msg, userId)) {
      console.log(`[Gateway] 检测到重复消息，已忽略：${msg.substring(0, 50)}`);
      return {
        success: false,
        message: '消息已处理，请勿重复发送',
      };
    }
    this.deduplicator.record(msg, userId);

    // 3. 流量控制检查
    const rateLimitResult = this.rateLimiter.checkRateLimit(userId);
    if (!rateLimitResult.allowed) {
      return {
        success: false,
        message: `请求过于频繁，请稍后再试（剩余配额：${rateLimitResult.remaining}）`,
      };
    }
    this.rateLimiter.consumeToken(userId);

    // 4. 获取或创建会话
    let session;
    try {
      session = await this.sessionManager.getOrCreateSession(userId);
      console.log(`[Gateway] 使用会话：${session.conversationId}`);
    } catch (error) {
      console.error('[Gateway] 创建会话失败:', error);
      return {
        success: false,
        message: '会话创建失败，请稍后重试',
      };
    }

    // 5. 并发控制
    const requestId = generateMessageId();
    try {
      // 设置30秒超时
      await this.concurrencyController.acquireSlot(userId, requestId, 30000);
    } catch (error) {
      console.error('[Gateway] 获取并发槽位失败:', error);
      return {
        success: false,
        message: error instanceof Error && error.message.includes('超时') 
          ? '系统繁忙，请稍后重试' 
          : '系统资源不足，请稍后重试',
      };
    }

    try {
      // 6. 创建用户消息对象
      const userMessage: UserMessage = {
        id: generateMessageId(),
        type: 'user',
        conversationId: session.conversationId,
        userId,
        username: userName,
        content: msg,
        metadata: {
          timestamp: Date.now(),
          source: 'dingtalk',
        },
      };

      // 7. 添加消息到会话历史
      await this.sessionManager.addMessage(session.conversationId, userMessage);

      // 8. 获取对话历史（传递给 OpenCode 作为上下文）
      const history = await this.buildHistoryForOpenCode(session.conversationId);

      // 9. 构建 OpenCode 上下文
      const opencodeContext: MessageContext = {
        userId,
        userName,
        conversationId: session.conversationId,
        history,
      };

      // 10. 调用 OpenCode CLI 处理消息
      console.log(`[Gateway] 调用 OpenCode 处理消息...`);
      const result = await this.openCodeExecutor.execute(msg, opencodeContext);

      console.log(`[Gateway] OpenCode 执行完成: success=${result.success}, time=${result.executionTime}ms`);

      // 11. 处理结果
      let responseContent: string;

      if (result.success && result.output) {
        responseContent = result.output;
      } else if (result.error) {
        // 如果是 CLI 未安装，给出友好提示
        if (result.error.includes('未安装') || result.error.includes('找不到命令')) {
          responseContent = `⚠️ OpenCode CLI 未安装\n\n` +
            `请先安装 OpenCode CLI:\n` +
            `\`\`\`bash\n` +
            `npm install -g opencode\n` +
            `\`\`\`\n\n` +
            `或配置环境变量 OPENCODE_COMMAND 指定 opencode 命令路径。`;
        } else {
          responseContent = `❌ 处理失败\n\n错误信息：${result.error}`;
        }
      } else {
        responseContent = '处理完成，但没有返回结果。';
      }

      // 12. 创建 AI 消息对象并保存到会话历史
      const aiMessage: AIMessage = {
        id: generateMessageId(),
        type: 'ai',
        conversationId: session.conversationId,
        userId,
        content: responseContent,
        metadata: {
          timestamp: Date.now(),
          source: 'ai',
        },
      };

      await this.sessionManager.addMessage(session.conversationId, aiMessage);

      // 13. 返回结果
      return {
        success: result.success,
        message: result.success ? '处理成功' : '处理失败',
        data: {
          result: responseContent,
          conversationId: session.conversationId,
          executionTime: Date.now() - startTime,
        },
      };
    } finally {
      // 14. 释放并发槽位
      this.concurrencyController.releaseSlot(userId, requestId);
    }
  }
}