# Stream SDK 实现总结

## 📋 实现概述

已成功实现基于钉钉官方 Stream SDK 的双向通信功能，支持通过 WebSocket 长连接与钉钉进行实时消息收发。

## ✅ 已完成的工作

### 1. 核心实现文件

#### `src/dingtalk/stream.ts` - Stream 服务主实现
- ✅ 基于官方 `dingtalk-stream` SDK (v2.1.4)
- ✅ WebSocket 长连接支持
- ✅ 订阅配置：`/v1.0/im/bot/messages/get`
- ✅ 消息接收和处理
- ✅ 连接状态管理
- ✅ 自动重连机制
- ✅ 详细的调试日志
- ✅ 发送文本消息 (`sendTextMessage`)
- ✅ 发送 Markdown 消息 (`sendMarkdownMessage`)
- ✅ 事件监听器注册
- ✅ 消息确认机制 (防止服务端重试)

**核心功能:**
```typescript
// 创建服务
const streamService = new DingtalkStreamService();

// 设置消息处理器
streamService.setMessageHandler(async (userId, userName, content, conversationId) => {
  // 处理消息逻辑
});

// 启动连接
await streamService.start();

// 发送消息
await streamService.sendTextMessage(conversationId, 'Hello World');
await streamService.sendMarkdownMessage(conversationId, '标题', '**Markdown** 内容');
```

#### `src/dingtalk/streamSdk.ts` - SDK 简化封装
- ✅ 更简洁的 API 设计
- ✅ 消息处理器多层支持
- ✅ 统一的错误处理
- ✅ 状态监控

**使用方式:**
```typescript
const sdk = new StreamSDKWrapper({
  clientId: 'your_app_key',
  clientSecret: 'your_app_secret',
  debug: true,
});

// 注册消息处理器
sdk.onMessage(async (msg) => {
  console.log('收到消息:', msg.content);
});

// 连接
await sdk.connect();
```

#### `examples/stream-full-example.ts` - 完整示例
- ✅ 基础连接示例
- ✅ 完整双向通信示例
- ✅ 高可用示例（带重连）
- ✅ 消息发送辅助函数

#### `src/test-stream-sdk.ts` - 测试脚本
- ✅ 交互式测试功能
- ✅ 自动回复测试
- ✅ Markdown 消息测试
- ✅ 状态查询功能
- ✅ 优雅退出处理

### 2. 文档

#### `STREAM_SDK_GUIDE.md` - 使用指南
- ✅ Stream 模式介绍
- ✅ 安装和配置说明
- ✅ 完整代码示例
- ✅ API 详细说明
- ✅ 最佳实践
- ✅ 调试技巧
- ✅ 常见问题解答

## 🔧 技术实现细节

### 连接管理

```typescript
// 1. 创建客户端
const client = new DWClient({
  clientId: appKey,
  clientSecret: appSecret,
  keepAlive: true,
  debug: true,
});

// 2. 配置订阅
const config = client.getConfig();
config.subscriptions = [
  { type: 'EVENT', topic: '/v1.0/im/bot/messages/get' },
];

// 3. 监听事件
client.on('ready', () => console.log('✅ 连接就绪'));
client.on('error', (error) => console.error('❌ 错误:', error));
client.on('heartbeat', (data) => console.log('💓 心跳:', data));

// 4. 注册消息监听器
client.registerAllEventListener((msg: DWClientDownStream): EventAckData => {
  // 处理消息
  handleMessage(msg);
  
  // 返回确认（重要！）
  return { status: EventAck.SUCCESS };
});

// 5. 启动连接
await client.connect();
```

### 消息发送

#### 文本消息
```typescript
async function sendTextMessage(
  client: DWClient,
  conversationId: string,
  content: string
): Promise<void> {
  const accessToken = await client.getAccessToken();
  const endpoint = await client.getEndpoint();
  
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
```

#### Markdown 消息
```typescript
async function sendMarkdownMessage(
  client: DWClient,
  conversationId: string,
  title: string,
  text: string
): Promise<void> {
  const accessToken = await client.getAccessToken();
  const endpoint = await client.getEndpoint();
  
  await axios.post(
    `${endpoint}/v1.0/robot/oapi/messages/send`,
    {
      msgKey: 'sampleMarkdown',
      msgParam: JSON.stringify({
        markdown: { title, text },
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
```

### 消息处理流程

```
1. 收到 WebSocket 消息
   ↓
2. 解析消息数据 (JSON)
   ↓
3. 验证消息类型 (只处理文本消息)
   ↓
4. 调用消息处理器
   ↓
5. 业务逻辑处理 (LLM、命令执行等)
   ↓
6. 发送回复消息
   ↓
7. 返回 EventAck.SUCCESS (防止重试)
```

## 📦 依赖关系

```json
{
  "dingtalk-stream": "^2.1.4",  // 官方 Stream SDK
  "axios": "^1.6.2",            // HTTP 请求（用于发送消息）
  "events": "^3.3.0"            // Node.js 事件模块
}
```

## 🚀 使用方法

### 方式 1: 使用现有应用（推荐）

主应用 `src/index.ts` 已经集成了 Stream 服务：

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

应用启动流程：
1. 初始化基础模块
2. 启动 Gateway 服务 (Express)
3. 启动 Stream 服务 (WebSocket)
4. 设置消息处理器

### 方式 2: 运行测试脚本

```bash
# 开发模式（直接运行 TypeScript）
npm run dev:stream

# 生产模式（运行编译后的 JS）
npm run build
npm run stream
```

测试脚本功能：
- 发送"测试" → 自动回复
- 发送"帮助" → 显示帮助信息
- 发送"状态" → 显示连接状态
- 发送"Markdown" → 测试 Markdown 消息

### 方式 3: 作为库使用

```typescript
import { DingtalkStreamService } from './dingtalk/stream';

const streamService = new DingtalkStreamService();

streamService.setMessageHandler(async (userId, userName, content) => {
  // 你的业务逻辑
  console.log(`${userName}: ${content}`);
});

await streamService.start();
```

## 🔍 调试技巧

### 1. 开启调试模式

```typescript
const client = new DWClient({
  clientId: appKey,
  clientSecret: appSecret,
  debug: true,  // 开启详细日志
});
```

### 2. 查看详细日志

Stream 服务会输出：
- 连接状态变化
- 心跳信息
- 消息接收详情
- 发送消息结果

### 3. 监控端点

```bash
# 检查 Stream 状态（需要在应用中添加）
curl http://localhost:3000/api/stream/status
```

### 4. 测试连接

```bash
# 运行测试脚本
npm run dev:stream
```

## ⚠️ 注意事项

### 1. 必须返回 EventAck.SUCCESS

```typescript
client.registerAllEventListener((msg: DWClientDownStream): EventAckData => {
  // 处理消息
  handleMessage(msg);
  
  // ⚠️ 重要：必须返回确认，否则钉钉会重试
  return { status: EventAck.SUCCESS };
});
```

### 2. 异步消息处理

```typescript
// ✅ 好的做法：异步处理，同步返回
client.registerAllEventListener((msg: DWClientDownStream) => {
  handleMessageAsync(msg).catch(console.error);
  return { status: EventAck.SUCCESS };
});

// ❌ 不好的做法：等待处理完成，会阻塞
client.registerAllEventListener(async (msg: DWClientDownStream) => {
  await handleMessageAsync(msg);  // 可能超时
  return { status: EventAck.SUCCESS };
});
```

### 3. 消息去重

钉钉可能会推送重复消息，需要实现去重：

```typescript
const messageCache = new Map<string, number>();

function isDuplicate(messageId: string): boolean {
  const timestamp = messageCache.get(messageId);
  const now = Date.now();
  
  if (timestamp && now - timestamp < 60000) {
    return true; // 60 秒内的重复消息
  }
  
  messageCache.set(messageId, now);
  setTimeout(() => messageCache.delete(messageId), 60000);
  return false;
}
```

### 4. 优雅关闭

```typescript
process.on('SIGINT', async () => {
  console.log('正在关闭...');
  await streamService.stop();
  console.log('已关闭');
  process.exit(0);
});
```

## 📊 对比：Stream vs Webhook vs Polling

| 特性 | Stream | Webhook | Polling |
|------|--------|---------|---------|
| 公网 URL | ❌ 不需要 | ✅ 需要 | ❌ 不需要 |
| 实时性 | ⚡ 实时 | ⚡ 实时 | 🕐 延迟 |
| 连接管理 | 🤖 自动 | 🌐 被动 | 🔄 手动 |
| 开发难度 | ⭐ 简单 | ⭐⭐ 中等 | ⭐⭐⭐ 复杂 |
| 适用场景 | 内网开发 | 生产环境 | 备选方案 |

## 🎯 配置清单

在钉钉开放平台配置：

1. ✅ 创建企业自建应用
2. ✅ 获取 AppKey 和 AppSecret
3. ✅ 开通机器人功能
4. ✅ 选择 Stream 模式
5. ✅ 发布应用

在 `.env` 文件配置：

```bash
DINGTALK_APP_KEY=your_app_key
DINGTALK_APP_SECRET=your_app_secret
STREAM_ENABLED=true
```

## 🔮 扩展功能

### 已实现 ✅
- 文本消息收发
- Markdown 消息收发
- 连接状态监控
- 自动重连
- 消息去重

### 可扩展 🚀
- 卡片消息支持
- 文件消息支持
- @用户功能
- 群组消息支持
- 消息持久化
- 多实例支持

## 📝 代码示例

### 完整示例：自动回复机器人

```typescript
import { DingtalkStreamService } from './dingtalk/stream';

async function main() {
  const streamService = new DingtalkStreamService();
  
  streamService.setMessageHandler(async (userId, userName, content, conversationId) => {
    console.log(`${userName}: ${content}`);
    
    // 关键词回复
    if (content.includes('你好')) {
      await streamService.sendTextMessage(
        conversationId,
        `@${userName} 你好！有什么可以帮助你的吗？`
      );
    } else if (content.includes('帮助')) {
      await streamService.sendMarkdownMessage(
        conversationId,
        '帮助信息',
        `**可用命令:**
        
- 你好：打招呼
- 帮助：显示帮助
- 状态：查看系统状态
- 时间：当前时间
        `
      );
    } else if (content.includes('时间')) {
      await streamService.sendTextMessage(
        conversationId,
        `当前时间：${new Date().toLocaleString()}`
      );
    }
  });
  
  await streamService.start();
  console.log('✅ 机器人已启动');
}

main().catch(console.error);
```

## 📖 参考资源

- [钉钉 Stream 模式官方文档](https://open.dingtalk.com/document/development/introduction-to-stream-mode)
- [SDK GitHub 仓库](https://github.com/open-dingtalk/dingtalk-stream-sdk-nodejs)
- [钉叮开发者后台](https://open.dingtalk.com/)
- [本项目详细指南](STREAM_SDK_GUIDE.md)

## 🎉 总结

通过采用钉钉官方 Stream SDK，我们实现了：

✅ **无需内网穿透** - 直接在本地开发环境即可测试
✅ **实时双向通信** - WebSocket 长连接，低延迟
✅ **自动重连** - SDK 自动管理连接状态
✅ **完善的错误处理** - 详细的日志和错误追踪
✅ **易于扩展** - 清晰的代码结构和文档
✅ **生产就绪** - 支持优雅关闭和并发控制

现在你可以像在真实生产环境一样，在本地开发和测试钉钉机器人功能了！🚀