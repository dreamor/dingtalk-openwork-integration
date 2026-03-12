# 钉钉机器人 + OpenCode 集成系统

通过钉钉机器人实现 AI 助手的远程交互，在钉钉群聊中调用本地 OpenCode CLI。

## 功能特性

- **钉钉机器人**：通过钉钉群聊机器人接收消息并回复，支持 Stream 模式无需内网穿透
- **OpenCode 集成**：所有消息由 OpenCode CLI 处理，支持编程、对话、调用 skill/MCP
- **多轮对话**：自动管理会话上下文，支持连续对话
- **生产级特性**：消息去重、流量控制、并发限制、优雅关闭

## 系统架构

```
用户 → 钉钉群聊 → 机器人接收 → Stream/Polling → OpenCode CLI → 机器人回复 → 钉钉群聊
                              ↓
                       会话管理 + 消息队列
```

## 钉钉机器人创建（AI 助理员工）

> 本节基于钉钉官方文档整理，详细说明如何创建钉钉机器人（AI 助理员工）。

### 前提条件

在开始创建机器人之前，请确保：

1. **拥有开发者权限**：选择您有开发者权限的组织，或先获取开发者权限
2. **已登录开发者后台**：访问 [https://open-dev.dingtalk.com](https://open-dev.dingtalk.com)

### 一键创建机器人

#### 1. 登录开发者后台

访问钉钉开发者后台：[https://open-dev.dingtalk.com](https://open-dev.dingtalk.com)

> 注意：需要使用钉钉账号登录，并确保拥有相应组织的开发者权限。

#### 2. 进入应用开发页面

在开发者后台首页，找到 **「应用开发」** 模块，点击 **「立即创建」** 按钮。

#### 3. 创建机器人

在创建界面，填写机器人基本信息：

| 字段 | 说明 | 是否必填 |
|------|------|----------|
| 机器人名称 | 您的机器人名称 | 是 |
| 机器人简介 | 简要描述机器人功能 | 是 |
| 机器人图标 | 上传机器人头像 | 否（可使用默认图标） |

**提示**：您也可以直接使用默认的机器人信息，点击 **「确定」** 即可快速创建。

#### 4. 保存 Client ID 和 Client Secret

创建成功后，系统会自动展示应用的 **Client ID** 和 **Client Secret**。

![凭证信息截图](docs/images/dingtalk-robot-creation.png)

> ⚠️ **重要提示**：
> - Client ID 和 Client Secret 是应用的关键信息，也是操作应用数据的核心参数
> - 请妥善保管，切勿轻易提供给他人使用
> - 建议立即保存这两项信息到安全位置

#### 5. 自动开通的权限

创建机器人后，系统会自动开通以下权限，无需手动申请：

| 权限代码 | 说明 |
|----------|------|
| `Card.Streaming.Write` | 卡片流式写入权限 |
| `Card.Instance.Write` | 卡片实例写入权限 |
| `qyapi_robot_sendmsg` | 机器人消息发送权限 |

#### 6. 查看凭证信息

创建成功后，您可以在应用的 **「凭证与基础信息」** 页面中，随时查看应用的 Client ID 和 Client Secret。

---

## 钉钉机器人配置

在开始使用本系统之前，需要先在钉钉开放平台创建应用并配置机器人。详细步骤如下：

### 步骤一：登录钉钉开放平台

1. 访问钉钉开放平台：https://open.dingtalk.com/
2. 使用钉钉账号扫码登录

### 步骤二：创建企业内部应用

1. 登录后，进入「应用开发」控制台
2. 点击「创建应用」
3. 选择「企业内部应用」，填写应用基本信息：
   - **应用名称**：填写自定义名称（如：OpenCode AI 助手）
   - **应用描述**：描述应用用途
   - **应用Logo**：上传应用图标
4. 点击「确定创建」

### 步骤三：启用机器人能力

1. 进入应用详情页，选择「功能与权限」模块
2. 点击「添加能力」或「添加功能」
3. 找到「机器人」能力，点击「添加」
4. 配置机器人基本信息：
   - **机器人名称**：在群聊中显示的名称
   - **机器人简介**：简短描述机器人的功能
   - **机器人头像**：上传机器人头像图片

### 步骤四：配置消息接收模式

1. 在应用详情页，找到「开发管理」或「开发信息」
2. 配置消息接收模式：
   - **Stream 模式（推荐）**：无需配置公网可访问的服务器地址，稳定性更高
   - 选择「Stream 模式」并开启

### 步骤五：获取应用凭证

1. 在「开发信息」或「基本信息」页面，找到以下关键信息：
   - **AppKey**：应用唯一标识
   - **AppSecret**：应用密钥
2. 将 AppKey 和 AppSecret 记录下来，用于后续配置环境变量

### 步骤六：配置权限

1. 进入「权限管理」页面
2. 搜索并开通以下权限：
   - `contact.user.read` - 通讯录用户信息读权限
   - `im.chat.read` - 群会话信息读权限
   - `im.message` - 消息发送权限

### 步骤七：发布应用

1. 完成配置后，点击「版本管理与发布」
2. 创建新版本并提交发布
3. 发布成功后，可在企业内部使用该机器人

### 步骤八：将机器人添加到群聊

1. 打开钉钉客户端，进入目标群聊
2. 点击群设置 → 「智能群助手」→「添加机器人」
3. 选择刚才创建的机器人，添加到群聊

---

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