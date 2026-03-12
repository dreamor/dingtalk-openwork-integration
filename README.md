# 钉钉 + OpenCode 集成系统

通过钉钉群聊消息调用本地 OpenCode CLI，实现 AI 助手的远程交互。

## 功能特性

- **钉钉消息通道**：支持 Stream 模式（推荐）或轮询模式，无需内网穿透
- **OpenCode 集成**：所有消息由 OpenCode CLI 处理，支持编程、对话、调用 skill/MCP
- **多轮对话**：自动管理会话上下文，支持连续对话
- **生产级特性**：消息去重、流量控制、并发限制、优雅关闭

## 系统架构

```
钉钉消息 → Stream/Polling → Gateway → OpenCode CLI → 钉钉回复
                              ↓
                       会话管理 + 消息队列
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 安装 OpenCode CLI

```bash
# 检查是否安装
opencode --version
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置必要参数：

```bash
# 钉钉配置（必填）
DINGTALK_APP_KEY=your_app_key
DINGTALK_APP_SECRET=your_app_secret
```

### 4. 启动服务

```bash
# 生产模式
npm run build && npm start

# 开发模式
npm run dev
```

## 配置说明

### 钉钉配置

| 参数 | 说明 | 必填 |
|-----|------|-----|
| `DINGTALK_APP_KEY` | 钉钉应用 Key | 是 |
| `DINGTALK_APP_SECRET` | 钉钉应用 Secret | 是 |

### Gateway 配置

| 参数 | 说明 | 默认值 |
|-----|------|-------|
| `GATEWAY_PORT` | 服务端口 | 3000 |
| `GATEWAY_HOST` | 监听地址 | 0.0.0.0 |
| `GATEWAY_API_TOKEN` | API 访问令牌（保护敏感接口） | 无 |

### OpenCode 配置

| 参数 | 说明 | 默认值 |
|-----|------|-------|
| `OPENCODE_COMMAND` | OpenCode 命令路径 | opencode |
| `OPENCODE_TIMEOUT` | 执行超时时间(ms) | 120000 |
| `OPENCODE_MODEL` | 模型名称（格式：provider/model） | 使用 CLI 默认配置 |

### 消息模式配置

**Stream 模式（推荐）**：

| 参数 | 说明 | 默认值 |
|-----|------|-------|
| `STREAM_ENABLED` | 启用 Stream 模式 | true |
| `STREAM_MAX_RECONNECT` | 最大重连次数 | 5 |

**轮询模式（备用）**：

| 参数 | 说明 | 默认值 |
|-----|------|-------|
| `POLLING_ENABLED` | 启用轮询模式 | true |
| `POLLING_INTERVAL` | 轮询间隔(ms) | 3000 |

### 流量控制配置

| 参数 | 说明 | 默认值 |
|-----|------|-------|
| `MQ_MAX_CONCURRENT_PER_USER` | 每用户最大并发 | 3 |
| `MQ_MAX_CONCURRENT_GLOBAL` | 全局最大并发 | 10 |
| `MQ_RATE_LIMIT_TOKENS` | 令牌桶容量 | 10 |
| `SESSION_TTL` | 会话生存时间(ms) | 1800000 |

## API 接口

| 接口 | 方法 | 描述 |
|-----|------|-----|
| `/health` | GET | 健康检查 |
| `/api/test` | POST | 测试消息处理 |
| `/api/status` | GET | OpenCode 状态 |
| `/api/sessions` | GET | 会话统计 |

### 测试示例

```bash
curl -X POST http://localhost:3000/api/test \
  -H "Content-Type: application/json" \
  -d '{"msg": "你好"}'
```

## 项目结构

```
src/
├── index.ts              # 应用入口
├── config.ts             # 配置管理
├── dingtalk/
│   ├── dingtalk.ts       # 钉钉服务核心
│   ├── stream.ts         # Stream 模式
│   └── streamSdk.ts      # Stream SDK 封装
├── gateway/
│   └── index.ts          # HTTP 网关服务
├── opencode/
│   └── executor.ts       # OpenCode 执行器
├── session-manager/      # 会话管理
├── message-queue/        # 消息队列、流量控制
├── polling/              # 轮询服务
├── types/                # 类型定义
└── utils/                # 工具函数
```

## 使用示例

在钉钉群聊中发送消息：

- `你好` - 与 AI 助手对话
- `帮我写一个 Python 脚本` - 编程任务
- `修改 index.ts 文件` - 代码修改

## 开发命令

```bash
npm run build      # 编译
npm run dev        # 开发模式
npm test           # 运行测试
npm run lint       # 代码检查
```

## 常见问题

**Q: OpenCode CLI 未找到？**
A: 确保 opencode 命令在系统 PATH 中，或设置 `OPENCODE_COMMAND` 指定完整路径。

**Q: 消息接收不到？**
A: 检查钉钉应用配置，确认 Stream 模式已在钉钉开放平台启用。

**Q: 执行超时？**
A: 增加 `OPENCODE_TIMEOUT` 配置值，默认 2 分钟。

## License

MIT