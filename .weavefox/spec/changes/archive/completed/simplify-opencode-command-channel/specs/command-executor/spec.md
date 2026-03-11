## ADDED Requirements

### Requirement: Open Code 命令执行器

系统 应该 提供一个简单的命令执行器，接收用户消息并将其直接传递给 Open Code CLI 执行。

#### Scenario: 消息匹配 opencode 前缀

- **WHEN** 收到的消息以 `opencode` 开头时
- **THEN** 提取 `opencode` 后面的内容作为 CLI 指令
- **THEN** 执行命令 `opencode <提取的指令>`
- **THEN** 返回 CLI 的标准输出

#### Scenario: 消息不匹配命令白名单

- **WHEN** 收到的消息不以 `opencode` 开头时
- **THEN** 命令执行器 返回空结果或提示消息
- **THEN** 网关服务 继续处理其他类型的消息

#### Scenario: CLI 命令执行成功

- **WHEN** Open Code CLI 执行完成并返回输出时
- **THEN** 命令执行器 返回完整的输出内容
- **THEN** 输出不做任何格式化处理

#### Scenario: CLI 命令执行失败

- **WHEN** Open Code CLI 执行失败或超时时
- **THEN** 命令执行器 返回错误信息
- **THEN** 错误信息包含退出码和输出
- **THEN** 超时时间可配置（默认 60 秒）