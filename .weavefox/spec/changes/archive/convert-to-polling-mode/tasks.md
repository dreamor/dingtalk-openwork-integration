## 1. 基础设施

- [x] 1.1 添加轮询配置到 `config.ts`
  - [x] 新增 `polling` 配置对象
  - [x] 支持环境变量覆盖
  - [x] 添加配置验证逻辑

- [x] 1.2 创建 `src/polling` 目录结构
  - [x] 创建 `pollingService.ts`
  - [x] 创建 `cursorManager.ts`
  - [x] 创建 `intervalManager.ts`
  - [x] 创建 `index.ts` 导出

- [x] 1.3 实现 `CursorManager` 消息游标管理
  - [x] 内存存储游标位置
  - [x] 支持序列化/反序列化
  - [x] 线程安全实现

## 2. 核心服务

- [x] 2.1 扩展 `DingtalkService` 添加消息拉取 API
  - [x] 新增 `fetchMessages(cursor?: string)` 方法
  - [x] 实现钉钉消息拉取 API 调用
  - [x] 处理签名和时间戳参数

- [x] 2.2 实现 `IntervalManager` 动态间隔管理
  - [x] 基础间隔：3000ms
  - [x] 根据消息频率动态调整
  - [x] 空闲超时后延长间隔

- [x] 2.3 实现 `PollingService` 轮询服务
  - [x] 定时任务启动和停止
  - [x] 消息拉取和批量处理
  - [x] 错误处理和重试逻辑
  - [x] 支持优雅关闭

## 3. 集成改造

- [x] 3.1 修改 `index.ts` 集成轮询服务
  - [x] 条件启动轮询或 Webhook
  - [x] 添加启动日志和状态输出

- [x] 3.2 可选保留 Webhook 端点
  - [x] 添加配置 `WEBHOOK_ENABLED`
  - [x] Webhook 端点标记为废弃
  - [x] 记录废弃警告日志

- [x] 3.3 添加轮询状态监控
  - [x] 新增 `/api/polling/status` 端点
  - [x] 返回轮询状态、间隔、消息计数

## 4. 测试

- [x] 4.1 编写轮询服务单元测试
  - [x] 间隔调整逻辑
  - [x] 游标管理逻辑
  - [x] 错误处理逻辑

- [x] 4.2 编写 DingtalkService 扩展测试
  - [x] 消息拉取 API 测试
  - [x] 参数签名测试

- [x] 4.3 编写集成测试
  - [x] 完整消息拉取流程
  - [x] 配置变更生效测试

- [x] 4.4 测试项目编译和运行
  - [x] 运行 `npm run build`
  - [x] 运行 `npm test`
  - [x] 验证服务启动正常

## 5. 文档更新

- [x] 5.1 更新 README.md
  - [x] 添加轮询模式说明
  - [x] 更新环境变量配置说明
  - [x] 说明迁移步骤

- [x] 5.2 更新 USAGE.md
  - [x] 添加轮询模式使用说明
  - [x] 更新配置示例

## 验收标准

- [x] 消息拉取功能正常运行
- [x] 无需内网穿透即可接收消息
- [x] 消息处理延迟在可接受范围（3-5秒）
- [x] 保留 Webhook 兼容性（可选）
- [x] 单元测试覆盖新增代码
- [x] 项目编译通过
- [x] 服务启动正常

## 新增文件

- `src/polling/index.ts` - 轮询服务模块导出
- `src/polling/types.ts` - 类型定义
- `src/polling/cursorManager.ts` - 消息游标管理
- `src/polling/intervalManager.ts` - 动态间隔管理
- `src/polling/pollingService.ts` - 轮询服务
- `src/polling/polling.test.ts` - 轮询服务单元测试

## 修改文件

- `src/config.ts` - 添加轮询配置
- `src/dingtalk/dingtalk.ts` - 添加消息拉取 API
- `src/dingtalk/export.ts` - 导出新类型
- `src/index.ts` - 集成轮询服务