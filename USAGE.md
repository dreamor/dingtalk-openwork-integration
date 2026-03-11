# 钉钉 + OpenCode 集成系统 - 使用指南

## 概述

本系统实现通过钉钉机器人与 OpenCode CLI 进行交互，支持多轮对话、上下文保持、流量控制等生产级特性。

## 快速开始

### 1. 环境准备

- Node.js >= 18.0.0
- OpenCode CLI 已安装

```bash
# 安装依赖
npm install

# 编译项目
npm run build
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

**必填配置**：

```bash
# 钉钉配置
DINGTALK_APP_KEY=your_app_key
DINGTALK_APP_SECRET=your_app_secret
DINGTALK_ACCESS_TOKEN=your_access_token
```

**可选配置**：

```bash
# Stream 模式（推荐）
STREAM_ENABLED=true
STREAM_MAX_RECONNECT=5

# 轮询模式（备用）
POLLING_ENABLED=true
POLLING_INTERVAL=3000

# 流量控制
MQ_MAX_CONCURRENT_PER_USER=3
MQ_RATE_LIMIT_TOKENS=10

# 会话管理
SESSION_TTL=1800000
SESSION_MAX_HISTORY=50
```

### 3. 启动应用

```bash
# 生产模式
npm run build && npm start

# 开发模式
npm run dev
```

## 消息模式说明

### Stream 模式（推荐）

- 使用 WebSocket 长连接接收消息
- 无需内网穿透，钉钉主动推送消息
- 消息延迟低（实时）

### 轮询模式（备用）

- 主动定时拉取钉钉消息
- 无需 WebSocket 长连接
- 消息延迟约 3-5 秒

系统默认优先使用 Stream 模式，连接失败时自动切换到轮询模式。

## 核心模块

### 会话管理器 (SessionManager)

维护用户对话会话：

- 会话生命周期：创建、获取、结束、过期清理
- 上下文管理：保存历史消息，构建对话上下文
- 自动清理：定期清理过期会话（默认 30 分钟 TTL）

### 流量控制器 (RateLimiter)

令牌桶算法实现流量控制：

- 每用户独立桶，防止单个用户滥用
- 按固定速率补充令牌
- 可配置容量

### 并发控制器 (ConcurrencyController)

控制用户和全局并发请求数：

- 用户级限制：防止单用户占用过多资源
- 全局限制：保护系统不被压垮
- 公平队列：先到先得

### 消息去重器 (MessageDeduplicator)

LRU 缓存实现消息去重：

- 时间窗口内重复消息会被过滤
- 基于用户 ID + 消息内容去重

## API 端点

```bash
# 健康检查
curl http://localhost:3000/health

# OpenCode 状态
curl http://localhost:3000/api/status

# 会话统计
curl http://localhost:3000/api/sessions

# 测试消息处理
curl -X POST http://localhost:3000/api/test \
  -H "Content-Type: application/json" \
  -d '{"msg": "你好", "userId": "test-user"}'
```

## 使用示例

### 基本对话

在钉钉群聊中发送消息，系统自动维护对话上下文：

```
用户：帮我创建一个用户登录功能
AI：好的，我来帮你创建...

用户：加上验证码功能
AI：好的，在之前的登录功能基础上添加验证码...
```

### 多轮对话

系统自动管理会话上下文：

```
# 第一轮
用户：帮我写一个 Python 函数

# 第二轮（基于上下文）
用户：加上异常处理
```

## 调试技巧

### 启用详细日志

在 `.env` 中设置：

```bash
DEBUG=true
```

### 测试端点

```bash
curl -X POST http://localhost:3000/api/test \
  -H "Content-Type: application/json" \
  -d '{"msg": "测试消息", "userId": "test"}'
```

### 查看会话状态

```bash
curl http://localhost:3000/api/sessions
```

## 常见问题

**Q: 消息重复发送怎么办？**
A: 系统已实现消息去重，1 分钟内相同用户的相同消息会被自动过滤。

**Q: 如何调整并发限制？**
A: 修改 `.env` 中的 `MQ_MAX_CONCURRENT_PER_USER` 和 `MQ_MAX_CONCURRENT_GLOBAL`。

**Q: 会话多久过期？**
A: 默认 30 分钟无活动后过期，可通过 `SESSION_TTL` 调整。

**Q: OpenCode CLI 不响应怎么办？**
A: 检查 CLI 是否正确安装，确认 `OPENCODE_TIMEOUT` 设置合理。

## License

MIT