# 钉钉 Stream SDK 使用指南

## 概述

钉钉 Stream 模式是一种基于 WebSocket 长连接的消息接收方式，相比 Webhook 模式具有以下优势：

- ✅ **无需公网回调 URL** - 适合内网环境开发
- ✅ **实时推送** - 消息延迟更低
- ✅ **自动重连** - SDK 内置连接管理
- ✅ **双向通信** - 既能接收消息，也能发送消息

## 快速开始

### 1. 安装 SDK

```bash
npm install dingtalk-stream
```

### 2. 基础配置

在钉钉开放平台创建企业自建应用：

1. 进入 [钉钉开发者后台](https://open.dingtalk.com/)
2. 创建企业内部应用
3. 获取 `AppKey` (即 `clientId`) 和 `AppSecret` (即 `clientSecret`)
4. 开通 Stream 模式的机器人功能

### 3. 基础示例代码

```typescript
import { DWClient, EventAck, DWClientDownStream } from 'dingtalk-stream';

// 创建客户端
const client = new DWClient({
  clientId: 'your_app_key',
  clientSecret: 'your_app_secret',
  keepAlive: true,
  debug: true,
});

// 配置订阅
const config = client.getConfig();
config.subscriptions = [
  { type: 'EVENT', topic: '/v1.0/im/bot/messages/get' },
];

// 监听连接事件
client.on('ready', () => {
  console.log('✅ 连接已建立');
});

client.on('error', (error: Error) => {
  console.error('❌ 错误:', error.message);
});

// 注册消息监听器
client.registerAllEventListener((msg: DWClientDownStream): { status: EventAck } => {
  console.log('📨 收到消息:', msg.headers.messageId);
  
  if (msg.type === 'EVENT') {
    const data = JSON.parse(msg.data);
    console.log('消息内容:', data.text?.content);
  }
  
  // 重要：返回确认，防止服务端重试
  return { status: EventAck.SUCCESS };
});

// 启动连接
await client.connect();
```

## 完整实现

### 消息接收

```typescript
import { DWClient, EventAck, DWClientDownStream } from 'dingtalk-stream';

class DingtalkStreamService {
  private client: DWClient;
  
  constructor(clientId: string, clientSecret: string) {
    this.client = new DWClient({
      clientId,
      clientSecret,
      keepAlive: true,
      debug: true,
    });
    
    // 配置订阅
    this.client.getConfig().subscriptions = [
      { type: 'EVENT', topic: '/v1.0/im/bot/messages/get' },
    ];
  }
  
  async start() {
    // 连接事件监听
    this.client.on('ready', () => console.log('✅ 连接就绪'));
    this.client.on('close', () => console.log('❌ 连接关闭'));
    this.client.on('error', (err) => console.error('❌ 错误:', err));
    this.client.on('heartbeat', (data) => console.log('💓 心跳:', data));
    
    // 消息监听
    this.client.registerAllEventListener((msg: DWClientDownStream) => {
      if (msg.type === 'EVENT' && msg.headers.topic === '/v1.0/im/bot/messages/get') {
        const data = JSON.parse(msg.data);
        this.handleMessage(data);
      }
      return { status: EventAck.SUCCESS };
    });
    
    await this.client.connect();
  }
  
  private handleMessage(data: any) {
    const { senderNick, text, conversationId } = data;
    console.log(`收到 ${senderNick} 的消息：${text?.content}`);
    
    // 在这里处理业务逻辑
  }
}
```

### 消息发送

Stream 模式下发送消息需要使用钉钉的 HTTP API：

```typescript
import axios from 'axios';

async function sendTextMessage(
  client: DWClient,
  conversationId: string,
  content: string
) {
  // 获取访问令牌和 API 端点
  const accessToken = await client.getAccessToken();
  const endpoint = await client.getEndpoint();
  
  const messageBody = {
    msgKey: 'sampleText',
    msgParam: JSON.stringify({
      content,
      at: {
        atUserIds: [],
        isAtAll: false,
      },
    }),
    conversationId,
  };
  
  const response = await axios.post(
    `${endpoint}/v1.0/robot/oapi/messages/send`,
    messageBody,
    {
      headers: {
        'x-acs-dingtalk-access-token': accessToken,
        'Content-Type': 'application/json',
      },
    }
  );
  
  return response.data;
}

async function sendMarkdownMessage(
  client: DWClient,
  conversationId: string,
  title: string,
  text: string
) {
  const accessToken = await client.getAccessToken();
  const endpoint = await client.getEndpoint();
  
  const messageBody = {
    msgKey: 'sampleMarkdown',
    msgParam: JSON.stringify({
      markdown: {
        title,
        text,
      },
    }),
    conversationId,
  };
  
  const response = await axios.post(
    `${endpoint}/v1.0/robot/oapi/messages/send`,
    messageBody,
    {
      headers: {
        'x-acs-dingtalk-access-token': accessToken,
        'Content-Type': 'application/json',
      },
    }
  );
  
  return response.data;
}
```

### 完整的双向通信示例

```typescript
import { DWClient, EventAck, DWClientDownStream } from 'dingtalk-stream';
import axios from 'axios';

class DingtalkBot {
  private client: DWClient;
  
  constructor(clientId: string, clientSecret: string) {
    this.client = new DWClient({
      clientId,
      clientSecret,
      keepAlive: true,
      debug: true,
    });
    
    this.client.getConfig().subscriptions = [
      { type: 'EVENT', topic: '/v1.0/im/bot/messages/get' },
    ];
  }
  
  async start() {
    this.setupEventListeners();
    this.setupMessageHandler();
    await this.client.connect();
  }
  
  private setupEventListeners() {
    this.client.on('ready', () => {
      console.log('✅ 机器人已就绪');
    });
    
    this.client.on('error', async (error) => {
      console.error('❌ 错误:', error.message);
      // 可以在这里实现自定义重连逻辑
    });
  }
  
  private setupMessageHandler() {
    this.client.registerAllEventListener(async (msg: DWClientDownStream) => {
      if (msg.type === 'EVENT' && msg.headers.topic === '/v1.0/im/bot/messages/get') {
        const data = JSON.parse(msg.data);
        const { senderId, senderNick, text, conversationId } = data;
        
        console.log(`收到消息：${senderNick} - ${text?.content}`);
        
        // 处理消息并回复
        try {
          const reply = await this.processMessage(text?.content);
          await this.sendTextMessage(conversationId, reply);
          console.log('✅ 回复已发送');
        } catch (error) {
          console.error('❌ 处理消息失败:', error);
        }
      }
      
      // 必须返回确认
      return { status: EventAck.SUCCESS };
    });
  }
  
  private async processMessage(content: string): Promise<string> {
    // 在这里实现你的业务逻辑
    if (content.includes('你好')) {
      return '你好！有什么可以帮助你的吗？';
    } else if (content.includes('帮助')) {
      return '我支持以下命令：\n- 你好：打招呼\n- 帮助：显示帮助信息\n- 天气：查询天气';
    }
    return '收到你的消息：' + content;
  }
  
  private async sendTextMessage(conversationId: string, content: string) {
    const accessToken = await this.client.getAccessToken();
    const endpoint = await this.client.getEndpoint();
    
    await axios.post(
      `${endpoint}/v1.0/robot/oapi/messages/send`,
      {
        msgKey: 'sampleText',
        msgParam: JSON.stringify({
          content,
          at: { atUserIds: [], isAtAll: false },
        }),
        conversationId,
      },
      {
        headers: {
          'x-acs-dingtalk-access-token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

// 使用示例
const bot = new DingtalkBot('your_app_key', 'your_app_secret');
bot.start().catch(console.error);
```

## 核心 API 说明

### DWClient 配置

```typescript
interface DWClientConfig {
  clientId: string;        // 必填：钉钉应用的 AppKey
  clientSecret: string;    // 必填：钉钉应用的 AppSecret
  keepAlive?: boolean;     // 可选：是否保持长连接，默认 true
  debug?: boolean;         // 可选：是否开启调试模式，默认 false
  ua?: string;             // 可选：自定义 User-Agent
  endpoint?: string;       // 可选：自定义 API 端点
  autoReconnect?: boolean; // 可选：是否自动重连，默认 true
  subscriptions?: Array<{  // 必填：订阅的主题列表
    type: string;
    topic: string;
  }>;
}
```

### 事件监听

```typescript
// 连接成功
client.on('ready', () => {
  console.log('连接已建立');
});

// 连接关闭
client.on('close', () => {
  console.log('连接已关闭');
});

// 连接错误
client.on('error', (error: Error) => {
  console.error('发生错误:', error);
});

// 心跳
client.on('heartbeat', (data: any) => {
  console.log('心跳:', data);
});

// 重连中
client.on('reconnecting', () => {
  console.log('正在重连...');
});
```

### 消息监听器

```typescript
// 监听所有事件
client.registerAllEventListener((msg: DWClientDownStream): EventAckData => {
  // 处理消息
  return { status: EventAck.SUCCESS };
});

// 监听特定回调（通过 eventId）
client.registerCallbackListener('eventId', (msg: DWClientDownStream) => {
  // 处理特定回调
});
```

### 重要方法

```typescript
// 连接
await client.connect();

// 断开
client.disconnect();

// 获取 AccessToken
const token = await client.getAccessToken();

// 获取 API 端点
const endpoint = await client.getEndpoint();

// 获取配置
const config = client.getConfig();

// 消息响应（避免服务端重试）
client.socketCallBackResponse(messageId, result);
```

## 常见消息类型

### 机器人消息

```json
{
  "type": "EVENT",
  "headers": {
    "topic": "/v1.0/im/bot/messages/get",
    "messageId": "xxxx",
    "time": "1234567890",
    "appId": "xxx"
  },
  "data": "{\"senderId\":\"xxx\",\"senderNick\":\"张三\",\"text\":{\"content\":\"你好\"},\"msgtype\":\"text\",\"conversationId\":\"xxx\"}"
}
```

### 卡片消息回调

```json
{
  "type": "EVENT",
  "headers": {
    "topic": "/v1.0/card/callback",
    "messageId": "xxxx",
    "eventType": "cardCallback"
  },
  "data": "{\"userId\":\"xxx\",\"cardActionData\":{\"action\":\"click\"},\"conversationId\":\"xxx\"}"
}
```

## 最佳实践

### 1. 消息去重

```typescript
const processedMessages = new Set<string>();

client.registerAllEventListener((msg: DWClientDownStream) => {
  const messageId = msg.headers.messageId;
  
  // 检查是否已处理
  if (processedMessages.has(messageId)) {
    console.log('⚠️ 重复消息，已跳过');
    return { status: EventAck.SUCCESS };
  }
  
  processedMessages.add(messageId);
  
  // 设置过期清理（60 秒后）
  setTimeout(() => {
    processedMessages.delete(messageId);
  }, 60000);
  
  // 处理消息...
  return { status: EventAck.SUCCESS };
});
```

### 2. 错误处理

```typescript
client.on('error', async (error) => {
  console.error('连接错误:', error);
  
  // 记录错误日志
  await logError(error);
  
  // 发送告警通知
  await sendAlert('Stream 连接异常:', error.message);
});
```

### 3. 优雅关闭

```typescript
let isShuttingDown = false;

process.on('SIGINT', async () => {
  if (isShuttingDown) {
    console.log('⚠️ 已在关闭中，强制退出');
    process.exit(1);
  }
  
  isShuttingDown = true;
  console.log('🛑 正在优雅关闭...');
  
  // 停止接收新消息
  client.disconnect();
  
  // 等待已处理的消息完成
  await waitForPendingTasks();
  
  console.log('✅ 已关闭');
  process.exit(0);
});
```

### 4. 日志记录

```typescript
client.registerAllEventListener((msg: DWClientDownStream) => {
  // 记录详细日志
  console.log('收到消息:', {
    messageId: msg.headers.messageId,
    topic: msg.headers.topic,
    time: new Date(parseInt(msg.headers.time)).toISOString(),
    specVersion: msg.specVersion,
    dataSize: msg.data.length,
  });
  
  return { status: EventAck.SUCCESS };
});
```

## 调试技巧

### 1. 开启调试模式

```typescript
const client = new DWClient({
  clientId: CONFIG.clientId,
  clientSecret: CONFIG.clientSecret,
  debug: true, // 开启调试日志
});
```

### 2. 使用示例代码测试

项目提供了完整的示例代码：

```bash
# 运行基础示例
npx ts-node examples/stream-full-example.ts
```

### 3. 检查网络

确保可以访问钉钉的 WebSocket 网关：

```bash
# 测试 WebSocket 连接
ping api.dingtalk.com
```

### 4. 验证配置

检查 `.env` 文件中的配置：

```bash
cat .env | grep DINGTALK
```

## 常见问题

### Q: 连接失败怎么办？

A: 检查以下几点：
1. 确认 `clientId` 和 `clientSecret` 配置正确
2. 检查网络连接是否正常
3. 确认已在钉钉后台正确配置 Stream 模式
4. 查看调试日志定位具体错误

### Q: 消息重复接收？

A: 可能是因为没有返回 `EventAck.SUCCESS`。确保在消息处理器中返回确认：

```typescript
return { status: EventAck.SUCCESS };
```

### Q: 发送消息失败？

A: 检查：
1. AccessToken 是否有效
2. API 端点是否正确
3. 请求格式是否符合钉钉 API 规范
4. 机器人是否有发送消息的权限

### Q: 如何调试？

A: 开启 debug 模式查看详细日志：
```typescript
const client = new DWClient({ debug: true });
```

## 参考资源

- [钉钉 Stream 模式文档](https://open.dingtalk.com/document/development/introduction-to-stream-mode)
- [SDK GitHub 仓库](https://github.com/open-dingtalk/dingtalk-stream-sdk-nodejs)
- [钉钉开放平台](https://open.dingtalk.com/)
- [本项目示例代码](examples/stream-full-example.ts)

## 总结

钉钉 Stream SDK 提供了简单而强大的 API，让你能够轻松实现与钉钉的双向通信。主要优势：

✅ 无需公网 IP 和回调 URL
✅ 实时消息推送
✅ 内置连接管理和自动重连
✅ 支持所有消息类型
✅ 完整的错误处理

只需按照本指南的步骤，即可快速实现你的钉钉机器人功能！