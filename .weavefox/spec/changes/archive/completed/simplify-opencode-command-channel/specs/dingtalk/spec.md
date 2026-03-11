## ADDED Requirements

### Requirement: 简化的命令通道路由

系统 应该 提供简化的消息路由，将 Open Code 相关消息直接传递给命令执行器。

#### Scenario: 接收到 opencode 命令消息

- **WHEN** 网关服务 接收到用户消息且消息以 `opencode` 开头时
- **THEN** 将完整消息内容传递给 CommandExecutor
- **THEN** 将执行结果作为回复消息返回给同一会话
- **THEN** 回复消息使用与接收消息相同的消息格式

## MODIFIED Requirements

### Requirement: 消息处理流程

原有的 LLM 意图识别消息处理流程已简化为直接命令传递。

**原行为**: 消息 → LLM 意图识别 → 命令生成 → 执行 → 格式化结果 → 返回

**新行为**: 消息 → 命令执行器匹配 → CLI 执行 → 原样返回输出

原有的编程意图识别（代码生成、审查等）功能已移除，用户需要以 `opencode <指令>` 格式明确发送命令。