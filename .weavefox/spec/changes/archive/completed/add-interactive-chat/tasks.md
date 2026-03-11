## 1. 基础设施层

### 1.1 类型定义和接口

- [ ] 1.1.1 定义消息类型 (`src/types/message.ts`)
  - 消息接口：Message, ConversationMessage, UserMessage, AIMessage, SystemMessage
  - 消息元数据：messageId, timestamp, userId, conversationId, metadata
  - 流式响应类型：StreamChunk, StreamStatus, StreamEnd

- [ ] 1.1.2 定义会话类型 (`src/types/session.ts`)
  - 会话接口：Session, SessionState, SessionConfig
  - 会话上下文：ConversationContext, MessageHistory
  - 会话状态枚举：Active, Idle, Expired, Terminated

- [ ] 1.1.3 定义流式类型 (`src/types/stream.ts`)
  - 流式连接类型：StreamConnection, WebSocketConfig
  - 流式事件：StreamEvent, StreamData, StreamError
  - 响应渲染类型：RenderableContent, CodeBlock, MarkdownSection

### 1.2 工具函数

- [ ] 1.2.1 消息 ID 生成器 (`src/utils/messageId.ts`)
  - 雪花算法实现
  - 分布式 ID 生成

- [ ] 1.2.2 消息去重缓存 (`src/utils/dedupCache.ts`)
  - LRU 缓存实现
  - 滑动窗口去重

- [ ] 1.2.3 Markdown 渲染器 (`src/utils/markdown.ts`)
  - 代码块高亮
  - 表格渲染
  - 链接处理

## 2. Session Manager 实现

### 2.1 核心会话管理

- [ ] 2.1.1 创建会话存储接口 (`src/session-manager/storage.ts`)
  - 内存存储实现（开发环境）
  - 持久化存储接口（可扩展）

- [ ] 2.1.2 实现会话管理器类 (`src/session-manager/sessionManager.ts`)
  - 创建会话：createSession(userId, config)
  - 获取会话：getSession(conversationId)
  - 结束会话：endSession(conversationId)
  - 续期会话：refreshSession(conversationId)

- [ ] 2.1.3 实现消息历史管理 (`src/session-manager/historyManager.ts`)
  - 添加消息：addMessage(conversationId, message)
  - 获取历史：getHistory(conversationId, limit)
  - 搜索历史：searchHistory(conversationId, query)
  - 清理历史：clearHistory(conversationId)

### 2.2 上下文管理

- [ ] 2.2.1 实现上下文构建器 (`src/session-manager/contextBuilder.ts`)
  - 消息聚合：aggregateMessages(messages)
  - 上下文裁剪：trimContext(messages, maxTokens)
  - 摘要生成：summarizeHistory(messages)

- [ ] 2.2.2 实现过期清理服务 (`src/session-manager/cleanupService.ts`)
  - 定期扫描过期会话
  - 自动清理策略
  - 手动清理接口

## 3. Stream Client 实现

### 3.1 流式连接管理

- [ ] 3.1.1 创建连接管理器 (`src/stream-client/connectionManager.ts`)
  - 建立连接：connect(config)
  - 断开连接：disconnect()
  - 心跳检测：heartbeat()
  - 断线重连：reconnect()

- [ ] 3.1.2 实现流式读取器 (`src/stream-client/streamReader.ts`)
  - 读取数据流：read()
  - 解析响应：parseChunk(chunk)
  - 缓冲区管理：buffer管理

- [ ] 3.1.3 实现响应处理器 (`src/stream-client/responseHandler.ts`)
  - 流开始处理：handleStreamStart()
  - 数据块处理：handleChunk(data)
  - 流结束处理：handleStreamEnd()

### 3.2 流式响应集成

- [ ] 3.2.1 创建 Open Code CLI 适配器 (`src/stream-client/opencodeAdapter.ts`)
  - 命令构建：buildCommand(userInput, context)
  - 响应转换：convertResponse(streamData)
  - 错误处理：handleCLIError(error)

- [ ] 3.2.2 实现增量输出器 (`src/stream-client/incrementalOutput.ts`)
  - 增量更新：appendContent(content)
  - 重试支持：retryWithBackoff()
  - 进度追踪：reportProgress(percent)

## 4. Message Queue 实现

### 4.1 消息队列核心

- [ ] 4.1.1 创建消息队列 (`src/message-queue/messageQueue.ts`)
  - 入队：enqueue(message)
  - 出队：dequeue()
  - 批量处理：batchDequeue(count)

- [ ] 4.1.2 实现优先级队列 (`src/message-queue/priorityQueue.ts`)
  - 优先级管理：push(message, priority)
  - 优先级排序：sortByPriority()
  - 抢占处理：preemptHighPriority()

### 4.2 去重和并发控制

- [ ] 4.2.1 实现消息去重器 (`src/message-queue/deduplicator.ts`)
  - 相似度检测：isDuplicate(message)
  - 时间窗口去重：withinDeduplicationWindow(message)
  - 用户级别去重：deduplicateByUser(message)

- [ ] 4.2.2 实现流量控制器 (`src/message-queue/rateLimiter.ts`)
  - 令牌桶实现：consumeToken(userId)
  - 速率限制检查：checkRateLimit(userId)
  - 配额管理：getRemainingQuota(userId)

- [ ] 4.2.3 实现并发控制器 (`src/message-queue/concurrencyController.ts`)
  - 并发限制：acquireSlot(userId)
  - 释放资源：releaseSlot(userId, requestId)
  - 排队机制：enqueueWaiting(userId)

### 4.3 消息处理器

- [ ] 4.3.1 创建消息处理器 (`src/message-queue/messageProcessor.ts`)
  - 处理消息：process(message)
  - 错误恢复：recoverFromError(error)
  - 超时处理：handleTimeout(message)

## 5. DingTalk Gateway 修改

### 5.1 会话消息路由

- [ ] 5.1.1 修改消息接收处理 (`src/gateway/messageHandler.ts`)
  - 会话识别：identifySession(event)
  - 消息验证：validateMessage(message)
  - 消息转发：forwardToQueue(message)

- [ ] 5.1.2 实现会话状态机 (`src/gateway/sessionStateMachine.ts`)
  - 状态转换：transition(state, event)
  - 状态持久化：saveState(state)
  - 状态恢复：restoreState(conversationId)

### 5.2 流式响应推送

- [ ] 5.2.1 实现 SSE 推送 (`src/gateway/ssePush.ts`)
  - 创建 SSE 连接：createSSE(response)
  - 发送事件：sendEvent(event, data)
  - 关闭连接：closeSSE(conversationId)

- [ ] 5.2.2 实现增量更新推送 (`src/gateway/incrementalPush.ts`)
  - 计算差异：calculateDiff(oldContent, newContent)
  - 更新发送：sendUpdate(conversationId, update)
  - 确认机制：ackUpdate(conversationId, updateId)

### 5.3 富文本渲染

- [ ] 5.3.1 实现 Markdown 渲染 (`src/gateway/markdownRenderer.ts`)
  - 代码块处理：formatCodeBlock(code, language)
  - 表格处理：formatTable(data)
  - 列表处理：formatList(items)
  - 引用处理：formatQuote(text)

- [ ] 5.3.2 实现代码块语法高亮 (`src/gateway/codeHighlighter.ts`)
  - 语言检测：detectLanguage(code)
  - 语法高亮：highlight(code, language)
  - 行号添加：addLineNumbers(code)

## 6. 配置和入口

### 6.1 配置文件

- [ ] 6.1.1 更新环境配置 (`src/config.ts`)
  - 会话配置：SESSION_TTL, MAX_HISTORY_MESSAGES
  - 流式配置：STREAM_TIMEOUT, RECONNECT_INTERVAL
  - 限流配置：RATE_LIMIT_PER_MINUTE, MAX_CONCURRENT

### 6.2 主入口更新

- [ ] 6.2.1 更新应用入口 (`src/index.ts`)
  - 服务启动顺序：SessionManager → MessageQueue → StreamClient → Gateway
  - 优雅关闭：gracefulShutdown()

## 7. 测试

### 7.1 单元测试

- [ ] 7.1.1 Session Manager 测试 (`src/session-manager/*.test.ts`)
  - 会话创建测试
  - 消息历史测试
  - 过期清理测试

- [ ] 7.1.2 Message Queue 测试 (`src/message-queue/*.test.ts`)
  - 去重测试
  - 限流测试
  - 并发控制测试

- [ ] 7.1.3 Stream Client 测试 (`src/stream-client/*.test.ts`)
  - 连接管理测试
  - 流式读取测试
  - 增量输出测试

### 7.2 集成测试

- [ ] 7.2.1 完整对话流程测试 (`tests/integration/conversation.test.ts`)
  - 多轮对话测试
  - 流式响应测试
  - 并发请求测试

- [ ] 7.2.2 异常处理测试 (`tests/integration/errorHandling.test.ts`)
  - 断线重连测试
  - 消息丢失测试
  - 超时处理测试