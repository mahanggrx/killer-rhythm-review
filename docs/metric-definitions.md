# 指标口径（第一版）

适用规则集：`base_only_1v4_10.0.2`。

本文档描述当前纯函数指标引擎的原型口径。高进度阈值等配置均为“原型待验证数值”，不代表官方标准、平衡结论或真实对局统计结论。

## 统一结果约定

- 时间指标统一使用毫秒。
- 每项指标返回 `available` 或 `unavailable`，并保留解释和 `evidenceEventIds`。
- 缺少计算证据、零分母或样本不足时返回不可用，不伪装为零。
- 事件按 `timestampMs`、`eventOrder` 和原始位置稳定排序。
- 重复 `eventId` 正式流程由输入校验阻止；指标层兜底只保留规范化后的第一条，并输出诊断。
- 指标函数不修改日志或配置对象。

## 接敌节奏

第一版不使用人工 `target_acquired`。系统只使用游戏正式追逐状态作为“有效接敌”的代理，因此不能声称知道玩家何时主观发现了逃生者。

| 指标 | 当前口径 |
| --- | --- |
| `averageChaseGap` | `trial_start` 到首次游戏正式 `chase_start`，加上每次所有活动追逐结束后到下一次 `chase_start` 的完整空窗，再除以有效空窗数量。若仍有并发追逐则不开始新空窗；删失结束和对局结束后的尾段不形成样本。只有开局到首次追逐一个样本时也可以计算。 |

## 追击

| 指标 | 当前口径 |
| --- | --- |
| `firstChaseDuration` | 首个 `chase_start` 到同一 `chaseId` 的非删失 `chase_end`。不以倒地、抱起或挂钩代替结束；结束原因单独保留。 |
| `firstChaseToFirstDown` | 首次 `chase_start` 到同一 `chaseId`、同一逃生者在该追逐内首次由杀手归因的 `survivor_downed`，不包含搬运。 |
| `averageChaseDuration` | 按独立 `chaseId` 配对的非删失完整追逐平均时长；未结束或 `censored` 区间不计入。 |
| `abandonedChaseCount` | 结束原因为 `lost_los`、`range_break`、`locker` 或 `target_switch` 的完整追逐数。该指标不声称知道玩家是否主观放弃。 |

## 发电机控制

高进度采用“观察进度达到配置阈值即进入”的包含边界口径。一次发电机从阈值下方进入高进度区间构成一个 episode；跌回阈值下方后再次达到阈值，会形成新 episode。

| 指标 | 当前口径 |
| --- | --- |
| `keyGeneratorInterruptions` | 干扰前处于高进度，且实际生效的杀手即时损失、回退开始或封锁。一次因果触发的多个效果按 `interferenceId` 去重；逃生者自行停修不计。 |
| `highProgressGeneratorLosses` | 进入高进度 episode 后，在下一次有效杀手干扰前完成的不同发电机数量。完成事件本身不能作为此前已进入高进度的唯一阶段证据。 |

若日志只有 `generator_completed`，没有完成前的阶段进度或干扰记录，这两项指标返回不可用。这表示无法重建高进度 episode，不代表损失或干扰为零。

## 永久减员结果

| 指标 | 当前口径 |
| --- | --- |
| `firstEliminationGeneratorsRemaining` | 首次献祭、处决或流血死亡发生前，基础 1v4 所需的 5 个发电机修理目标中尚未完成的数量。同时间戳严格使用 `eventOrder` 判断先后。逃脱和 BOT 接管不计。 |
| `totalEliminations` | 正常结束的完整对局中，献祭、处决和流血死亡的总数。异常结束时不可用，避免把局部日志当作最终结果。 |

如果正常结束的对局没有永久减员，`firstEliminationGeneratorsRemaining` 返回 `no_elimination_event`，页面显示“本局没有形成永久减员”，而不是伪造一个发电机剩余数。

## 实现边界与尚未覆盖

- 当前指标入口假定日志已先通过结构和语义校验；兜底诊断不能替代正式校验。
- 倒地时缺失的追逐结束可按声明策略生成；对局结束时未闭合追逐和回退会生成可追溯的 `censored` 关闭事件。
- 当前合成日志模拟游戏侧可提供正式追逐事件；网页仍不读取真实客户端或玩家账号数据。
- 尚未计算发电机活跃回退累计时长或覆盖率。
- React 只消费统一分析结果，不直接计算指标。
