# 任务清单：简化 Open Code 命令通道实现

## 1. 创建命令执行器

### 1.1 创建 CommandExecutor 类
- [ ] 1.1.1 创建 `src/command-executor/index.ts` 文件
- [ ] 1.1.2 实现 `execute(message: string): Promise<string>` 方法
- [ ] 1.1.3 添加消息前缀检测（`opencode` 开头）
- [ ] 1.1.4 实现 CLI 命令执行逻辑

### 1.2 配置命令白名单
- [ ] 1.2.1 在配置中添加 `ALLOWED_COMMANDS = ['opencode']`
- [ ] 1.2.2 验证白名单机制生效

## 2. 修改网关服务

### 2.1 简化消息处理流程
- [ ] 2.1.1 修改 `src/gateway/index.ts` 中的消息处理逻辑
- [ ] 2.1.2 移除 LLM 意图识别调用
- [ ] 2.1.3 添加消息路由到 CommandExecutor
- [ ] 2.1.4 保留错误处理和超时控制

## 3. 测试

### 3.1 单元测试
- [ ] 3.1.1 测试 CommandExecutor 消息匹配逻辑
- [ ] 3.1.2 测试 CLI 命令执行（Mock `child_process`）
- [ ] 3.1.3 测试白名单机制

### 3.2 集成测试
- [ ] 3.2.1 测试钉钉消息到 CLI 执行端到端流程
- [ ] 3.2.2 测试 Open Code CLI 实际执行
- [ ] 3.2.3 测试边界情况（超时、错误、空消息）

## 4. 文档

- [ ] 4.1 更新 README.md，添加简化使用说明
- [ ] 4.2 记录新的消息格式：`opencode <指令>`