## ADDED Requirements

### Requirement: LLM 意图识别

系统 必须 调用大语言模型识别用户通过钉钉发送的消息意图，将自然语言转换为可执行的命令请求。

#### Scenario: 识别打开工作空间命令

- **WHEN** 用户发送类似于 "打开工作空间"、"打开 open work"、"start workspace" 的消息
- **THEN** LLM 识别意图为 "open-workspace"
- **AND** 提取相关参数（如工作空间名称，可选）

#### Scenario: 识别关闭工作空间命令

- **WHEN** 用户发送类似于 "关闭工作空间"、"停用 workspace" 的消息
- **THEN** LLM 识别意图为 "close-workspace"

#### Scenario: 识别状态查询命令

- **WHEN** 用户发送类似于 "工作空间状态"、"查看状态"、"status" 的消息
- **THEN** LLM 识别意图为 "get-status"
- **AND** 不需要额外参数

#### Scenario: 识别帮助请求

- **WHEN** 用户发送类似于 "帮助"、"help"、"有哪些命令" 的消息
- **THEN** LLM 识别意图为 "help"
- **AND** 生成可用命令的说明

#### Scenario: 无法识别意图

- **WHEN** 用户发送的内容无法映射到已知命令
- **THEN** LLM 应生成友好的无法识别提示
- **AND** 建议用户查看可用命令列表

---

### Requirement: 提示模板管理

系统 必须 提供可配置的 LLM 提示模板，用于生成适合意图识别的请求。

#### Scenario: 加载意图识别模板

- **WHEN** 需要调用 LLM 进行意图识别
- **THEN** 系统加载预定义的意图识别提示模板
- **AND** 将用户消息和可用命令列表注入模板

#### Scenario: 处理 LLM 响应

- **WHEN** LLM 返回响应
- **THEN** 系统解析 JSON 格式的响应内容
- **AND** 提取意图类型和参数
- **AND** 处理解析失败的情况

---

### Requirement: 结果自然语言生成

系统 必须 将命令执行结果转换为用户友好的自然语言回复。

#### Scenario: 命令执行成功

- **WHEN** 命令执行成功返回结果
- **THEN** LLM 生成总结性的成功消息
- **AND** 包含关键输出信息的摘要

#### Scenario: 命令执行失败

- **WHEN** 命令执行失败或出错
- **THEN** LLM 生成描述性的错误说明
- **AND** 建议可能的解决步骤