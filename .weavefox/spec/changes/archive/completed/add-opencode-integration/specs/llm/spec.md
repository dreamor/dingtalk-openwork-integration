## ADDED Requirements

### Requirement: Open Code 意图识别

系统 MUST 调用大语言模型识别用户通过钉钉发送的 Open Code 相关请求，将自然语言转换为可执行的 Open Code CLI 命令。

#### Scenario: 识别代码生成请求

- **WHEN** 用户发送类似于 "生成一段排序算法代码"、"写一个 Python 函数实现快速排序"、"创建一个 React 组件显示用户信息" 的消息
- **THEN** LLM 识别意图为 "generate-code"
- **AND** 提取参数：编程语言、代码功能描述、代码长度/复杂度（可选）

#### Scenario: 识别代码审查请求

- **WHEN** 用户发送类似于 "审查这段代码"、"帮我看看这个函数有什么问题"、"检查代码安全性" 的消息，并提供代码或文件路径
- **THEN** LLM 识别意图为 "review-code"
- **AND** 提取参数：代码内容或文件路径、审查重点（可读性、安全性、性能等，可选）

#### Scenario: 识别文件操作请求

- **WHEN** 用户发送类似于 "创建新文件"、"读取配置文件"、"修改 index.ts 添加日志" 的消息
- **THEN** LLM 识别意图为 "file-operation"
- **AND** 提取参数：操作类型（create/read/edit/delete）、目标文件路径、操作详情

#### Scenario: 识别代码执行请求

- **WHEN** 用户发送类似于 "运行这段代码"、"执行 Python 脚本"、"测试这个函数" 的消息
- **THEN** LLM 识别意图为 "execute-code"
- **AND** 提取参数：代码内容、执行环境、执行参数（可选）

#### Scenario: 识别多轮对话请求

- **WHEN** 用户发送类似于 "继续完善这个函数"、"刚才那段代码加一下错误处理"、"修改那部分代码使用更高效的实现" 的消息
- **THEN** LLM 识别意图为 "continue-code"
- **AND** 从对话历史中提取上下文关联信息
- **AND** 识别需要修改的具体代码段

---

### Requirement: Open Code 提示词管理

系统 MUST 提供可配置的 LLM 提示模板，专门用于 Open Code 相关的意图识别和参数提取。

#### Scenario: Open Code 意图识别模板加载

- **WHEN** 需要进行 Open Code 意图识别
- **THEN** 系统加载预定义的 Open Code 识别提示模板
- **AND** 将用户消息、Open Code CLI 命令列表、示例用法注入模板

#### Scenario: Open Code 参数提取

- **WHEN** LLM 返回 Open Code 相关意图的识别结果
- **THEN** 系统解析 JSON 格式的响应内容
- **AND** 提取意图类型、命令参数、代码描述、目标文件等关键信息
- **AND** 对提取的参数进行安全性验证

#### Scenario: 对话上下文构建

- **WHEN** 处理多轮对话中的 Open Code 请求
- **THEN** 系统将对话历史和当前请求组合构建上下文
- **AND** 确保上下文不超过 LLM 的令牌限制
- **AND** 保持代码相关的引用关系清晰

---

### Requirement: Open Code 结果生成

系统 MUST 将 Open Code CLI 的执行结果转换为用户友好的自然语言回复。

#### Scenario: 代码生成结果

- **WHEN** Open Code 生成代码成功
- **THEN** LLM 生成包含代码块的 Markdown 格式回复
- **AND** 添加适当的代码高亮标记（使用 ``` 语言标识）
- **AND** 可选地添加代码功能说明和使用示例

#### Scenario: 代码审查结果

- **WHEN** Open Code 完成代码审查
- **THEN** LLM 生成结构化的审查报告
- **AND** 分点列出发现的问题（安全、性能、可读性等）
- **AND** 提供改进建议

#### Scenario: 文件操作结果

- **WHEN** Open Code 完成文件创建/修改/读取
- **THEN** LLM 生成确认消息
- **AND** 对于读取操作，返回文件内容的代码块
- **AND** 对于修改操作，说明具体的变更内容

#### Scenario: 执行错误处理

- **WHEN** Open Code 执行出错
- **THEN** LLM 生成包含错误信息的友好提示
- **AND** 建议可能的解决方案或替代方法
- **AND** 避免暴露敏感的系统信息