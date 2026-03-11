# 变更：简化 Open Code 命令通道实现

## Why

用户希望通过钉钉发送自然语言消息，直接执行 Open Code CLI 命令并获取结果。之前的方案引入了 LLM 意图识别层，增加了复杂性和延迟。

## What Changes

本提案实现一个**简单的命令通道**，移除意图识别层：

1. **直接消息传递**
   - 用户消息 → Open Code CLI 执行（无中间处理）
   - 消息内容直接作为 CLI 输入参数

2. **原样结果返回**
   - CLI 输出直接返回给用户
   - 不做格式化转换或内容过滤

3. **命令白名单控制**
   - 只允许 `opencode` 一个命令
   - 消息以 `opencode` 开头时执行

## Impact

### 新增规范
- `command-executor`: Open Code 命令执行器

### 修改规范
- `dingtalk-gateway`: 简化消息路由逻辑，移除意图识别分支

### 技术依赖
- Open Code CLI 工具可用性
- CLI 命令执行超时控制

**简化后的架构**:
```
钉钉消息 → Gateway → CommandExecutor(匹配 opencode 前缀) → CLI 执行 → 结果返回
```

**原架构（不再使用）**:
```
钉钉消息 → Gateway → LLM 意图识别 → Tools → 格式化结果 → 返回
```

## 破坏性变更

**BREAKING**: 移除 LLM 意图识别模块，原有的编程意图解析功能不再可用。用户需要以 `opencode <指令>` 格式发送消息。