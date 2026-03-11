## ADDED Requirements

### Requirement: Open Code 命令执行

系统 MUST 通过 `opencode` CLI 执行各类 AI 编程任务，包括代码生成、代码审查、文件操作等。

#### Scenario: 执行代码生成命令

- **WHEN** 意图识别结果为 "generate-code"
- **THEN** 系统执行 `opencode generate "代码描述" [--language=语言]` 命令
- **AND** 等待命令完成（默认超时 60 秒）
- **AND** 捕获标准输出作为生成的代码内容
- **AND** 返回 Markdown 格式的代码块

#### Scenario: 执行代码审查命令

- **WHEN** 意图识别结果为 "review-code"
- **THEN** 系统执行 `opencode review "代码内容或文件路径" [--focus=审查重点]` 命令
- **AND** 捕获标准输出作为审查结果
- **AND** 将结果转换为结构化的审查报告格式

#### Scenario: 执行文件操作命令

- **WHEN** 意图识别结果为 "file-operation"
- **THEN** 根据操作类型执行相应命令：
  - 文件创建：`opencode create "文件路径" --content="内容"`
  - 文件读取：`opencode read "文件路径"`
  - 文件修改：`opencode edit "文件路径" --spec="修改描述"`
- **AND** 返回操作结果和状态

#### Scenario: 执行代码运行命令

- **WHEN** 意图识别结果为 "execute-code"
- **THEN** 系统执行 `opencode run "代码内容" [--timeout=超时时间]` 命令
- **AND** 捕获标准输出和错误输出
- **AND** 返回执行结果和任何控制台输出

#### Scenario: 执行多轮对话命令

- **WHEN** 意图识别结果为 "continue-code"
- **THEN** 系统执行 `opencode continue "继续指令" --context="对话历史"` 命令
- **AND** 保持代码修改的上下文一致性
- **AND** 返回修改后的完整代码或变更说明

---

### Requirement: Open Code 命令白名单

系统 MUST 实现 Open Code CLI 命令的白名单管理，限制可执行的 Open Code 操作。

#### Scenario: 验证 Open Code 命令

- **WHEN** 接收到 Open Code 类型的命令执行请求
- **THEN** 系统验证完整命令是否在 Open Code 白名单中
- **AND** 白名单必须包含以下核心命令模式：
  - `opencode generate`
  - `opencode review`
  - `opencode create`
  - `opencode read`
  - `opencode edit`
  - `opencode run`
  - `opencode continue`
- **AND** 不在白名单中的命令变体被拒绝

#### Scenario: Open Code 白名单配置

- **WHITELIST** Open Code 命令配置项：
  | 命令模式 | 描述 | 允许的参数 |
  |----------|------|------------|
  | `opencode generate` | 代码生成 | `--language`, `--length` |
  | `opencode review` | 代码审查 | `--focus`, `--severity` |
  | `opencode create` | 文件创建 | `--content`, `--force` |
  | `opencode read` | 文件读取 | 无危险参数 |
  | `opencode edit` | 文件编辑 | `--spec`, `--dry-run` |
  | `opencode run` | 代码执行 | `--timeout`, `--input` |
  | `opencode continue` | 继续对话 | `--context` |

---

### Requirement: Open Code 结果处理

系统 MUST 标准化处理 Open Code CLI 的输出结果，确保结果的可靠性和一致性。

#### Scenario: 格式化代码生成输出

- **WHEN** Open Code 生成代码成功
- **THEN** 系统提取代码块内容（移除 markdown 代码标记如果存在）
- **AND** 检测编程语言类型
- **AND** 生成带语言标识的 Markdown 代码块返回

#### Scenario: 处理空结果

- **WHEN** Open Code 命令返回空输出
- **THEN** 系统检查命令执行状态（exit code）
- **AND** 空输出且 exit code 0：返回成功但无内容的提示
- **AND** 空输出且 exit code 非 0：返回错误信息

#### Scenario: 长输出处理

- **WHEN** Open Code 输出内容过长（超过消息限制）
- **THEN** 系统对输出进行分块处理
- **AND** 创建多个消息依次发送
- **AND** 标注 "（接下一页）" 等提示

#### Scenario: 错误输出处理

- **WHEN** Open Code 命令返回错误输出到 stderr
- **THEN** 系统捕获错误信息
- **AND** 区分可修复错误和系统错误
- **AND** 向用户提供可操作的错误提示

---

### Requirement: Open Code 执行安全控制

系统 MUST 实现针对 Open Code CLI 的安全控制机制，防止潜在风险。

#### Scenario: 代码执行参数验证

- **WHEN** 执行包含代码内容的 Open Code 命令
- **THEN** 系统对代码内容进行安全扫描
- **AND** 检测并拒绝危险代码模式（无限循环、资源占用等）
- **AND** 限制代码执行时间和资源使用

#### Scenario: 文件操作安全

- **WHEN** 执行文件操作类型的 Open Code 命令
- **THEN** 系统验证目标文件路径
- **AND** 限制操作范围在工作目录内
- **AND** 防止路径遍历攻击

#### Scenario: 执行超时管理

- **WHEN** Open Code 命令开始执行
- **THEN** 系统设置合理的超时时间（代码生成 60 秒，代码执行 30 秒）
- **AND** 超时后强制终止命令进程
- **AND** 向用户返回超时提示

#### Scenario: 敏感信息过滤

- **WHEN** 处理 Open Code 输出结果
- **THEN** 系统扫描并过滤潜在的敏感信息
- **AND** 过滤 API 密钥、密码、令牌等敏感字符串
- **AND** 在暴露前进行脱敏处理