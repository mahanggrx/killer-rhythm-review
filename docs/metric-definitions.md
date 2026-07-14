# 指标口径（第一版）

适用规则集：`base_only_1v4_10.0.2`。

本文档描述当前纯函数指标引擎的原型口径。高进度阈值等配置均为“原型待验证数值”，不代表官方标准、平衡结论或真实对局统计结论。

## 统一结果约定

- 时间指标统一使用毫秒。
- 每项指标返回 `available` 或 `unavailable`，并保留解释和 `evidenceEventIds`。
- 没有事件可以构成真实的零计数；缺少计算证据、零分母或样本不足则返回不可用，不伪装为零。
- 事件按 `timestampMs`、`eventOrder` 和原始位置稳定排序。
- 重复 `eventId` 正式流程仍由输入校验阻止；指标层兜底只保留规范化后的第一条，并输出诊断。
- 指标函数不修改日志或配置对象。

## 找人

| 指标 | 当前口径 |
| --- | --- |
| `firstFindTime` | `trial_start` 到首次人工标注 `target_acquired`。后者不是游戏正式“发现”事件。 |
| `averageSearchGap` | 所有活动追逐都结束后，到下一次 `target_acquired` 的平均空窗。若仍有并发追逐，尚不开始计时；删失追逐不形成样本。 |
| `averagePostHookTargetAcquisition` | 有效普通挂钩完成后，到下一次 `target_acquired` 的平均时间。若在目标确认前已经开始新追逐或再次挂钩，则该样本不可用。 |

## 追击

| 指标 | 当前口径 |
| --- | --- |
| `firstChaseToFirstDown` | 首次 `chase_start` 到其后首次由杀手归因的 `survivor_downed`，不包含搬运。 |
| `firstChaseToFirstHook` | 首次 `chase_start` 到其后首次有效普通挂钩，包含抱起、搬运和挂钩。 |
| `averageChaseDuration` | 按独立 `chaseId` 配对的非删失完整追逐平均时长；未结束或 `censored` 区间不计入。 |
| `abandonedChaseCount` | 结束原因为 `lost_los`、`range_break`、`locker` 或 `target_switch` 的完整追逐数。名称沿用原型字段，但结果不声称知道玩家是否主观放弃。 |

## 发电机控制

高进度采用“观察进度达到配置阈值即进入”的包含边界口径。一次发电机从阈值下方进入高进度区间构成一个 episode；跌回阈值下方后再次达到阈值，会形成新 episode。

| 指标 | 当前口径 |
| --- | --- |
| `keyGeneratorInterruptions` | 干扰前处于高进度，且实际生效的杀手即时损失、回退开始或封锁。一次因果触发的多个效果按 `interferenceId` 去重；逃生者自行停修不计。 |
| `highProgressGeneratorLosses` | 进入高进度 episode 后，在下一次有效杀手干扰前完成的不同发电机数量。完成事件本身不能作为此前已进入高进度的唯一证据。 |

## 挂钩收益与减员

| 指标 | 当前口径 |
| --- | --- |
| `totalHooks` | 有效普通 `hook_completed` 总数；同一次悬挂自然进入下一阶段不增加计数。 |
| `uniqueSurvivorsHooked` | 至少发生过一次有效普通挂钩的不同逃生者数量。 |
| `secondHookConversions` | 首次有效普通挂钩后成功离钩，并在其后再次有效上钩的逃生者数量。 |
| `firstEliminationTime` | 从 `trial_start` 到首次永久减员；献祭、处决或流血死亡均可计入，BOT 接管和逃脱不计。 |
| `firstHookChainEliminationTime` | 从 `trial_start` 到首次有此前普通挂钩证据支持的献祭结果；与处决和流血死亡分开。 |
| `hookConcentration` | 最高单个逃生者的有效普通挂钩数除以总有效普通挂钩数；无挂钩时因零分母而不可用。 |

## 尚未覆盖

- 当前指标入口假定日志已先通过结构和语义校验；兜底诊断不能替代正式校验。
- 尚未实现对局结束时自动生成未闭合追逐和回退的 `censored` 关闭事件。
- 尚未计算发电机活跃回退累计时长或覆盖率。
- 指标尚未接入规则引擎或 React 页面。
