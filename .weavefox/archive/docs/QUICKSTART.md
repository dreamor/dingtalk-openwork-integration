# 🚀 钉钉 Stream SDK 快速开始指南

## 5 分钟快速上手

### 步骤 1: 配置钉钉应用

1. 访问 [钉钉开发者后台](https://open.dingtalk.com/)
2. 创建企业自建应用
3. 获取 **AppKey** 和 **AppSecret**
4. 开通机器人功能，选择 **Stream 模式**
5. 发布应用

### 步骤 2: 配置环境变量

复制 `.env.example` 为 `.env`:

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的配置:

```bash
# 钉钉应用配置
DINGTALK_APP_KEY=your_app_key_here
DINGTALK_APP_SECRET=your_app_secret_here
DINGTALK_ACCESS_TOKEN=your_access_token_here
DINGTALK_AES_KEY=your_aes_key_here
DINGTALK_SIGNING_SECRET=your_signing_secret_here

# Stream 模式配置
STREAM_ENABLED=true
```

### 步骤 3: 安装依赖

```bash
npm install
```

### 步骤 4: 运行测试

运行 Stream SDK 测试脚本:

```bash
npm run dev:stream
```

你会看到类似输出:

```
🧪 开始测试 Stream SDK 功能...

1️⃣ 创建 SDK 实例...
✅ SDK 实例已创建

2️⃣ 注册消息处理器...
✅ 消息处理器已注册

3️⃣ 连接 Stream 服务...
🚀 正在连接钉钉 Stream 服务...
✅ Stream 连接已建立
✅ Stream 服务连接成功

4️⃣ 当前状态:
   - 连接状态：✅
   - 重连次数：0

📖 使用说明:
   - 在钉钉中向机器人发送消息
   - 发送 "测试" 测试自动回复
   - 发送 "帮助" 获取帮助信息
   - 发送 "状态" 查看连接状态
   - 发送 "Markdown" 测试 Markdown 消息

🎧 监听消息中... (按 Ctrl+C 退出)
```

### 步骤 5: 在钉钉中测试

1. 打开钉钉
2. 找到你创建的机器人
3. 发送消息: **测试**
4. 机器人会自动回复你

## 基础代码示例

### 最简单的机器人

创建文件 `bot.ts`:

```typescript
import { StreamSDKWrapper } from './dingtalk/streamSdk';
import { config } from './config';

async function main() {
  const sdk = new StreamSDKWrapper({
    clientId: config.dingtalk.appKey,
    clientSecret: config.dingtalk.appSecret,
    debug: true,
  });

  // 注册消息处理器
  sdk.onMessage(async (msg) => {
    console.log(`收到消息：${msg.content}`);
    
    // 简单回复
    if (msg.content.includes('你好')) {
      await sdk.sendTextMessage(
        msg.conversationId,
        `@${msg.senderNick} 你好！`
      );
    }
  });

  // 启动
  await sdk.connect();
  console.log('✅ 机器人已启动');
}

main().catch(console.error);
```

运行:

```bash
npx ts-node bot.ts
```

### 支持 Markdown 消息

```typescript
sdk.onMessage(async (msg) => {
  if (msg.content === '帮助') {
    await sdk.sendMarkdownMessage(
      msg.conversationId,
      '帮助信息',
      `**可用命令:**
      
- 你好 - 打招呼
- 帮助 - 显示帮助
- 时间 - 当前时间
      `
    );
  }
});
```

### 完整功能示例

查看 `src/test-stream-sdk.ts` 文件，包含:
- ✅ 自动回复
- ✅ Markdown 消息
- ✅ 状态查询
- ✅ 错误处理
- ✅ 优雅退出

## 运行完整应用

启动完整的钉钉机器人应用 (包含 LLM、命令执行等功能):

```bash
# 开发模式
npm run dev

# 或生产模式
npm run build
npm start
```

## 常用命令

```bash
# 开发
npm run dev              # 启动完整应用
npm run dev:stream       # 仅测试 Stream SDK

# 构建
npm run build            # 编译 TypeScript

# 运行
npm start                # 运行编译后的应用
npm run stream           # 运行测试脚本

# 测试
npm test                 # 运行单元测试
```

## 故障排查

### 问题 1: 连接失败

**错误信息:** `连接失败: clientId or clientSecret is invalid`

**解决方法:**
1. 检查 `.env` 文件中的 `DINGTALK_APP_KEY` 和 `DINGTALK_APP_SECRET`
2. 确认已在钉钉后台正确配置应用
3. 确认应用已发布

### 问题 2: 收不到消息

**可能原因:**
1. Stream 模式未正确配置
2. 机器人未添加到群聊
3. 消息类型不支持

**解决方法:**
1. 在钉钉后台确认已选择 Stream 模式
2. 将机器人添加到群聊
3. 检查应用权限配置

### 问题 3: 发送消息失败

**错误信息:** `invalid access_token`

**解决方法:**
1. 检查 `DINGTALK_ACCESS_TOKEN` 配置
2. 确认 AccessToken 未过期
3. 重新获取 AccessToken

## 下一步

- 📖 阅读 [详细使用指南](STREAM_SDK_GUIDE.md)
- 💻 查看 [实现细节](STREAM_SDK_IMPLEMENTATION.md)
- 🔍 研究 [示例代码](examples/stream-full-example.ts)
- 📚 查看 [钉钉官方文档](https://open.dingtalk.com/document/development/introduction-to-stream-mode)

## 获取帮助

遇到问题？

1. 查看调试日志 (设置 `debug: true`)
2. 检查 [常见问题](STREAM_SDK_GUIDE.md#常见问题)
3. 参考 [钉钉开发者社区](https://developers.dingtalk.com/)

---

祝你在钉钉机器人开发中取得成功！🎉