# 杀手节奏复盘反馈系统

用于游戏系统策划作品集的纯前端网页原型。项目后续将读取人工制作的模拟对局日志，计算找人、追击、发电机控制和挂钩收益指标，并通过确定性规则给出一条赛后练习建议。

当前阶段已完成项目初始化、领域事件模型、JSON 运行时校验、事件规范化排序，以及找人、追击、发电机控制和挂钩收益四类纯函数指标。日志上传界面、规则引擎和完整结果界面尚未实现。

## 当前已实现

- 定义 `base_only_1v4_10.0.2` 基线下的 `MatchLog` 与 `MatchEvent` 判别联合类型。
- 使用 `eventId`、`timestampMs` 和 `eventOrder` 表达可追溯的严格事件顺序。
- 独立建模人工标注的 `target_acquired`、并发 `chaseId`、发电机回退/暂停/封锁以及玩家转 BOT 等机制。
- `parseMatchLogJson` 捕获损坏 JSON；`validateMatchLog` 返回结构错误和可见警告，不向页面抛出输入异常。
- `normalizeMatchLog` 按时间戳、事件顺序和原始位置稳定排序，且不修改原始输入。
- `calculateMatchMetrics` 通过统一入口输出四类指标；每项指标都有可用状态、解释、单位和证据事件 ID。
- 高进度阈值通过配置传入；重复事件有可追溯诊断，未闭合或删失追逐不会进入完整追逐均值。
- 详细指标口径见 `docs/metric-definitions.md`。
- 合成样例位于 `src/data/samples/`，仅用于原型和测试。

## 环境要求

- Node.js 20.19+、22.12+ 或更高兼容版本
- npm

## 安装依赖

```bash
npm install
```

## 本地开发

```bash
npm run dev
```

## 运行测试

```bash
npm run test
```

持续监听测试：

```bash
npm run test:watch
```

## 类型检查

```bash
npm run typecheck
```

## 生产构建

```bash
npm run build
```

构建产物位于 `dist/`，可以部署到静态网站托管服务。

## 项目边界

- 只使用人工制作的模拟日志。
- 不接入或修改真实游戏客户端。
- 不使用后端、数据库、登录系统或机器学习。
- 默认规则集为 `base_only_1v4_10.0.2`。
- 所有阈值均属于原型待验证数值，不代表官方标准或真实平衡结论。
