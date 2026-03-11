## 背景

当前系统使用钉钉机器人 Webhook 回调机制接收消息，需要内网穿透才能工作。改为轮询模式可以消除对公网暴露的依赖，提高系统稳定性和安全性。

### 技术约束

1. 钉钉开放平台提供消息拉取 API
2. 轮询需要在资源消耗和实时性之间取得平衡
3. 需要处理消息去重和顺序问题
4. 轮询间隔需要动态调整以适应实际负载

## 目标与非目标

### 目标

- 消除对内网穿透的依赖
- 提供可靠的消息接收机制
- 保持消息处理的实时性（在可接受范围内）
- 支持消息去重和顺序处理
- 提供配置化的轮询策略

### 非目标

- 不改变现有的消息处理流程
- 不修改 LLM 集成和命令执行逻辑
- 不引入新的外部消息源

## 决策

### 决定 1：使用钉钉消息拉取 API

**方案**：使用钉钉企业机器人的消息拉取接口

**考虑过的替代方案**：
- 自建消息队列 + 钉钉回调（复杂度高）
- 使用第三方消息中间件（增加依赖）

**选择理由**：
- 官方 API，稳定可靠
- 无需公网暴露
- 只需调用 API 即可获取消息

### 决定 2：使用本地游标管理消息位置

**方案**：在本地文件系统或内存中记录上次拉取的消息游标

**考虑过的替代方案**：
- 数据库存储游标（增加依赖）
- 钉钉会话 ID 记录（需要额外状态管理）

**选择理由**：
- 简单可靠，重启后可恢复
- 内存存储足够，改造成本低
- 后续可扩展为持久化存储

### 决定 3：动态调整轮询间隔

**方案**：根据消息频率动态调整轮询间隔

**考虑过的替代方案**：
- 固定短间隔（增加服务器负载）
- 固定长间隔（延迟增加）

**选择理由**：
- 空闲时降低资源消耗
- 有消息时提高响应速度
- 符合实际使用场景

## 架构设计

### 新增组件

```
┌─────────────────────────────────────────────────────┐
│                   PollingService                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│  │ Intervals   │ │ Cursor      │ │ Backoff     │    │
│  │ Manager     │ │ Manager     │ │ Controller  │    │
│  └─────────────┘ └─────────────┘ └─────────────┘    │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
            ┌─────────────────────────────┐
            │   DingtalkService           │
            │   - getMessages()           │
            │   - ackMessages()           │
            └─────────────────────────────┘
```

### 消息流变更

**原模式（Webhook）**：
```
钉钉服务器 → POST /webhook → Gateway → 消息处理
```

**新模式（轮询）**：
```
PollingService → getMessages API → 消息处理
                     ↑
                 定时任务 (可配置间隔)
```

### 类设计

```typescript
// src/polling/pollingService.ts
interface PollingConfig {
  interval: number;        // 基础间隔 (ms)
  minInterval: number;     // 最小间隔 (ms)
  maxInterval: number;     // 最大间隔 (ms)
  timeout: number;         // 单次超时 (ms)
  maxBatchSize: number;    // 每次最大消息数
}

interface MessageCursor {
  lastMessageId: string;
  lastTimestamp: number;
}

class PollingService {
  constructor(
    config: PollingConfig,
    dingtalkService: DingtalkService,
    cursorStore: MessageCursorStore
  ) {}

  async start(): Promise<void>;
  async stop(): Promise<void>;
  private async pollMessages(): Promise<void>;
  private adjustInterval(hasMessage: boolean): void;
}
```

### 配置设计

```typescript
interface PollingConfig {
  enabled: boolean;              // 是否启用轮询模式
  interval: number;              // 基础轮询间隔 (ms)
  minInterval: number;           // 最小间隔 (ms)
  maxInterval: number;           // 最大间隔 (ms)
  timeout: number;               // API 超时时间 (ms)
  maxBatchSize: number;          // 单次最大拉取消息数
  idleTimeout: number;           // 空闲超时，增加间隔
}

const defaultPollingConfig: PollingConfig = {
  enabled: true,
  interval: 3000,
  minInterval: 1000,
  maxInterval: 10000,
  timeout: 5000,
  maxBatchSize: 50,
  idleTimeout: 30000,
};
```

## 迁移计划

### 阶段 1：基础改造

1. 新增 `PollingService` 类
2. 新增 `MessageCursor` 游标管理
3. 修改 `DingtalkService` 添加消息拉取 API
4. 更新配置模块

### 阶段 2：集成

1. 修改 `index.ts` 启动轮询服务
2. 可选保留 Webhook 端点（标记废弃）
3. 添加健康检查端点
4. 添加轮询状态监控

### 阶段 3：优化

1. 实现动态间隔调整
2. 添加失败重试和退避
3. 添加轮询指标监控
4. 优化消息去重逻辑

## 风险与权衡

### 风险

1. **消息延迟增加**：轮询间隔导致实时性下降
   - 缓解措施：使用较短的基础间隔 (1-3s)

2. **API 频率限制**：钉钉可能限制消息拉取 API 调用频率
   - 缓解措施：实现退避算法，监控 API 配额

3. **消息丢失**：进程异常退出可能导致未处理消息丢失
   - 缓解措施：定期保存游标到持久化存储

### 权衡

- **实时性 vs 资源消耗**：选择 3s 基础间隔，平衡两者
- **简单性 vs 功能**：优先简单实现，后续优化
- **兼容性 vs 清理**：保留 Webhook 兼容但不推荐使用

## 开放问题

1. 是否需要支持多租户/多机器人？
2. 消息游标是否需要持久化？
3. 是否需要提供手动触发拉取的 API？

## 测试策略

1. 单元测试：PollingService 核心逻辑
2. 集成测试：消息拉取和处理的完整流程
3. 压力测试：验证轮询性能和资源消耗
4. 降级测试：模拟 API 失败和网络异常