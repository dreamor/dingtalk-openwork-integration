# 变更：通过钉钉机器人集成 Open Code CLI

## Why

用户希望通过钉钉群聊发送自然语言消息，直接控制 Open Code CLI（AI 编程助手）执行各种编程任务，例如代码生成、代码审查、文件操作等，并将执行结果实时反馈到钉钉。这将实现：

1. **远程编程控制**：无需本地操作，通过钉钉消息即可触发 AI 编程助手
2. **自然语言交互**：使用自然语言描述需求，AI 自动理解并执行
3. **即时反馈**：执行结果、代码审查意见等实时返回到钉钉

## What Changes

本提案扩展现有钉钉集成系统，增加以下功能：

### 1. Open Code 命令解析
- 识别用户消息中的编程意图（代码生成、审查、文件操作等）
- 将自然语言请求转换为 Open Code CLI 命令参数
- 支持多轮对话式的编程任务

### 2. Open Code 命令执行
- 新增 `opencode` 命令白名单
- 支持 Open Code CLI 的各种命令模式：
  - 代码生成：`opencode generate [描述]`
  - 代码审查：`opencode review [文件路径]`
  - 文件操作：`opencode create|edit|read [文件路径]`
  - 执行代码：`opencode run [代码]`
- 命令结果格式化处理

### 3. 钉钉消息增强
- 识别编程相关关键字（"生成代码"、"审查代码"、"创建文件"等）
- 返回格式化结果（Markdown 代码块、富文本格式）
- 错误信息的友好展示

### 4. 交互式对话支持
- 支持多轮对话完成复杂编程任务
- 上下文保持和对话历史管理
- 半结构化结果返回（文本 + 代码块）

## Impact

- **新增规范**：`opencode-integration`、`opencode-command-executor`
- **修改规范**：`dingtalk-gateway`（新增 Open Code 意图识别）、`llm-integration`（新增编程意图解析）
- **安全考虑**：Open Code 命令执行权限控制、结果过滤
- **技术依赖**：Open Code CLI 工具安装和可用性

## 破坏性变更

无向后不兼容变更。