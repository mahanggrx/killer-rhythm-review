# 《黎明杀机》杀手节奏复盘反馈原型：基础机制调查

- 研究范围：标准 1v4 模式，只覆盖找人、追击、发电机控制、挂钩收益所需机制
- 检索截止：2026-07-14
- 当前正式服版本：10.0.2（2026-07-06）
- 术语：统一使用“杀手”“逃生者”“牵制”“守尸”
- 结论用途：定义人工模拟日志的事件、合法顺序与计算边界，不用于还原完整游戏客户端

## 第一部分：研究结论摘要

截至 2026-07-14，最新可确认正式服版本为 10.0.2。标准 1v4 对局生成 7 台发电机，完成 5 台后两处出口大门通电；单人无修正修理需 90 秒。发电机受损后先承受一次即时进度损失并进入回退，逃生者修理时回退暂停，累计修回发电机总量的 5% 才会彻底停止回退；封锁会冻结进度，并暂停而非清除既有回退。挂钩通常经过两个各 70 秒的可救援阶段，再进入献祭；倒地状态累计 240 秒会流血死亡。正式追击有可观察的开始、结束条件，也允许短暂同时追击多人。

“发现逃生者”“主动放弃追击”“有效控机”“正常减员”“首挂转二挂”都不是与原型口径完全一致的官方原子事件，必须自行定义。看到目标、获得气场、尖叫、足迹、血迹、声音、杀手本能与正式追击彼此不同，只能分别记录。掉线后的逃生者角色通常由 BOT 原状态接管，掉线是控制者变化，不是减员。另有两项版本边界：9.2.0 测试服的提前减员修理加速没有进入正式版，不应实现；“肩负重担”可转移挂钩阶段，因此若模拟该技能，挂钩阶段不能强制单调。原型最需要自行固定的是“发现”的判据、追击结束原因、回退区间闭合、挂钩转化分母和异常对局排除规则。

## 第二部分：机制事实表

| ID | 类别 | 研究问题 | 当前机制结论 | 精确数值或条件 | 游戏版本/补丁 | 来源类型 | 来源标题 | 直接链接 | 访问日期 | 置信度 | 备注 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| V-01 | 版本 | 当前正式服基线 | 本调查以 10.0.2 为现行版本；该补丁未改变本原型依赖的基础对局、发电机、追击或挂钩状态机 | 10.0.2；发布于 2026-07-06 | 10.0.2 | 官方 | 10.0.2 Bugfix Patch | https://forums.bhvr.com/dead-by-daylight/kb/articles/552-10-0-2-bugfix-patch | 2026-07-14 | 高 | Switch 曾延后，但机制基线相同 |
| A-01 | 对局 | 标准人数 | 标准模式为 1 名杀手对 4 名逃生者 | 1v4 | 10.0.2 现行 | 官方 | Dead by Daylight Game Overview | https://deadbydaylight.com/game/ | 2026-07-14 | 高 | 不含 2v8、活动模式和人数不足的自定义房 |
| A-02 | 对局 | 发电机生成与目标 | 标准 1v4 生成 7 台，逃生者需完成 5 台 | 7 生成；5 完成 | 10.0.2 现行 | 英文Wiki | Generators | https://deadbydaylight.wiki.gg/wiki/Generators | 2026-07-14 | 中 | 小黑盒同值；人数不足自定义房会调整，原型忽略 |
| A-03 | 对局 | 出口通电 | 完成目标数量后两处出口大门开关通电，可分别开启 | 2 处出口；完成 5 台后通电 | 10.0.2 现行 | 英文Wiki | Exit Gates | https://deadbydaylight.wiki.gg/wiki/Exit_Gates | 2026-07-14 | 中 | 大门通电不等于终局倒计时已经开始 |
| A-04 | 对局 | 终局开始 | 终局崩塌由至少一处出口大门打开，或杀手关闭地道触发 | 大门打开或地道关闭 | 10.0.2 现行 | 英文Wiki | Endgame Collapse | https://deadbydaylight.wiki.gg/wiki/Endgame_Collapse | 2026-07-14 | 中 | “第五台发电机完成”只进入大门通电阶段 |
| A-05 | 对局 | 终局持续与强制结束 | 终局基础计时 2 分钟；有逃生者倒地、上钩或入笼时降为半速，最长 4 分钟；耗尽后仍在场者被恶灵献祭 | 2 分钟；最长 4 分钟 | 10.0.2 现行 | 英文Wiki | Endgame Collapse | https://deadbydaylight.wiki.gg/wiki/Endgame_Collapse?action=raw | 2026-07-14 | 中 | 原型若不分析终局，可仅记录触发和结束原因 |
| A-06 | 对局 | 地道例外 | 只剩 1 名逃生者时地道开启；杀手关闭地道会直接使大门通电并触发终局，无需补完剩余发电机 | Last Survivor Standing | 10.0.2 现行 | 英文Wiki | Hatch；Exit Gates | https://deadbydaylight.wiki.gg/wiki/Hatch | 2026-07-14 | 中 | 第 N 台发电机指标应标注是否进入地道分支 |
| A-07 | 版本差异 | 提前减员修理加速 | 9.2.0 测试服曾提出提前死亡后修理速度加成，但 9.2.0 正式补丁未包含该基础机制 | 测试服方案不进入正式规则 | 9.2.0 PTB vs 9.2.0 正式 | 官方 | 9.2.0 PTB Patch Notes；9.2.0 Sinister Grace | https://forums.bhvr.com/dead-by-daylight/kb/articles/522-9-2-0-ptb-patch-notes | 2026-07-14 | 高 | 原型不得实现测试服的 25% 等数值；正式页：https://forums.bhvr.com/dead-by-daylight/kb/articles/523-9-2-0-sinister-grace |
| A-08 | 对局 | 正常结束 | 对局持续到最后一名仍在场的逃生者通过死亡或逃脱离开，终局计时耗尽，或一方投降/异常终止 | active survivor 集合为空，或终局/投降条件触发 | 10.0.2 现行 | 英文Wiki | Trials | https://deadbydaylight.wiki.gg/wiki/Trials | 2026-07-14 | 中 | 原型用 `normalEnd` 区分正常结算与掉线、投降等异常结束 |
| B-01 | 发电机 | 单人基础修理 | 发电机需要 90 充能，单人默认速率 1 充能/秒 | 90 秒 | 10.0.2 现行 | 英文Wiki | Generators | https://deadbydaylight.wiki.gg/wiki/Generators | 2026-07-14 | 中 | 不含技能、工具箱、检定奖励和其他修正 |
| B-02 | 发电机 | 多人协修 | 两人及以上协修时，每名参与者承受可叠加的个人效率惩罚 | 2 人：各 85%，约 52.94 秒；3 人：各 70%，约 42.86 秒；4 人：各 55%，约 40.91 秒 | 10.0.2 现行 | 英文Wiki | Generators | https://deadbydaylight.wiki.gg/wiki/Generators#Efficiency_Penalty | 2026-07-14 | 中 | 每增加一名协修者，个人效率再减 15% |
| B-03 | 发电机 | 基础状态 | 发电机可闲置、获得进度、受损并回退、被封锁或完成；“受损”“封锁”更适合作为叠加标志，而非互斥单状态 | 状态与标志组合 | 10.0.2 现行 | 英文Wiki | Generators | https://deadbydaylight.wiki.gg/wiki/Generators | 2026-07-14 | 中 | 设计上建议拆成 activity_state、damaged、blocked、completed |
| B-04 | 发电机 | 杀手基础破坏 | 杀手完成破坏发电机动作后造成即时损失并开始持续回退 | 动作 1.8 秒；即时损失为总进度 5% | 7.5.0 起，10.0.2 现行 | 官方 | 7.5.0 Alan Wake | https://forums.bhvr.com/dead-by-daylight/kb/articles/430-7-5-0-alan-wake | 2026-07-14 | 高 | 只可对有进度且可交互的未完成发电机生效 |
| B-05 | 发电机 | 持续回退 | 回退中的发电机以固定负速率损失进度，直至 0 或被有效修复停止 | -0.25 充能/秒；约为总进度 0.2778%/秒 | 10.0.2 现行 | 英文Wiki | Generators | https://deadbydaylight.wiki.gg/wiki/Generators#Regression_State | 2026-07-14 | 中 | 99.99% 回到 0 约需 360 秒 |
| B-06 | 发电机 | 回退停止 | 逃生者开始修理时回退暂停；累计修复发电机总量的 5% 后才彻底停止；未达到便离开，回退恢复 | 5% 总量，即基础 4.5 充能 | 7.5.0 起，10.0.2 现行 | 官方 | Developer Update January 2024 | https://forums.bhvr.com/dead-by-daylight/kb/articles/427-developer-update-january-2024 | 2026-07-14 | 高 | 日志必须区分 pause 与 stop |
| B-07 | 发电机 | 回退事件上限 | 单台发电机最多承受 8 次计入上限的回退事件 | 8 次 | 7.5.0 起，10.0.2 现行 | 官方 | 7.5.0 Alan Wake | https://forums.bhvr.com/dead-by-daylight/kb/articles/430-7-5-0-alan-wake | 2026-07-14 | 高 | 日志应记录 regression_event_index 与 effect_applied |
| B-08 | 发电机 | 封锁与回退并存 | 封锁冻结当前进度；若封锁前在回退，则封锁期间不掉进度，解除后继续回退；封锁时免疫即时回退惩罚 | 冻结而非清除回退 | 10.0.2 现行 | 英文Wiki | Generators | https://deadbydaylight.wiki.gg/wiki/Generators#Blocked_State | 2026-07-14 | 中 | 因此 blocked 与 damaged 可同时为真，active_regression 为假 |
| B-09 | 发电机 | 完成后回退 | 发电机完成后成为终态，不能再按普通规则回退或被破坏 | completed 为终态 | 10.0.2 现行 | 英文Wiki | Generators | https://deadbydaylight.wiki.gg/wiki/Generators | 2026-07-14 | 中 | 任何完成后的普通回退事件应判日志非法 |
| B-10 | 发电机 | 停修是否等于控机 | 逃生者自行停止修理只会保存进度；没有杀手破坏或其他回退效果时不会自行回退 | 无自动回退 | 10.0.2 现行 | 英文Wiki | Generators | https://deadbydaylight.wiki.gg/wiki/Generators | 2026-07-14 | 中 | 单独的 repair_stop 不计杀手有效干扰 |
| B-11 | 发电机 | 三类技能机制 | 即时进度损失是离散 delta；持续回退是有起止区间的负速率；封锁是冻结交互和进度的覆盖状态 | 三类必须分事件 | 10.0.2 现行 | 英文Wiki | Generators | https://deadbydaylight.wiki.gg/wiki/Generators | 2026-07-14 | 中 | 不需要枚举全部控机技能，但必须记录 source 与 applied_effects |
| C-01 | 追击 | 正式追击开始 | 同时满足：逃生者进入杀手 12 米视野、逃生者奔跑、杀手行走 | 三条件同时满足 | 10.0.2 现行页，页面修订 2026-05-19 | 英文Wiki | Chase | https://deadbydaylight.wiki.gg/wiki/Chase?action=raw | 2026-07-14 | 中 | 看到静止目标、气场目标或远处目标不必然开始追击 |
| C-02 | 追击 | 正式追击结束 | 可由距离超过 18 米、柜中隐藏 5 秒、失去视线超过 8 秒、目标离开杀手视野中心 ±35°等条件触发 | 18 米；5 秒；8 秒；±35° | 10.0.2 现行页，页面修订 2026-05-19 | 英文Wiki | Chase | https://deadbydaylight.wiki.gg/wiki/Chase?action=raw | 2026-07-14 | 中 | 游戏状态本身不解释杀手主观意图 |
| C-03 | 追击 | 多目标追击 | 同一杀手可短暂同时处于对多个逃生者的追击状态 | 多个并发 chase_id 合法 | 10.0.2 现行页 | 英文Wiki | Chase | https://deadbydaylight.wiki.gg/wiki/Chase?action=raw | 2026-07-14 | 中 | 不能用一个全局 currentTarget 覆盖所有追击 |
| C-04 | 追击 | 正式“发现”事件 | 未找到与“发现目标”完全等价的正式通用事件；追击开始只是最接近的稳定可观察事件之一 | 未确认存在正式发现状态 | 10.0.2 现行 | 官方与Wiki交叉检索 | Chase；Auras；Killer Instinct | https://deadbydaylight.wiki.gg/wiki/Auras | 2026-07-14 | 低 | 原型必须自定义 target_acquired，不能声称它是官方事件 |
| C-05 | 追击 | 信息线索 | 气场是穿透遮挡显示模型的视觉信息；杀手本能、尖叫、足迹、血迹、声音是其他定位线索，均不自动等于“看见”或正式追击 | 信息事件彼此分离 | 10.0.2 现行 | 英文Wiki | Auras；Killer Instinct | https://deadbydaylight.wiki.gg/wiki/Killer_Instinct | 2026-07-14 | 中 | 日志用 evidence_type 区分 direct_los、aura、scream 等 |
| C-06 | 追击 | 倒地是否必然结束 | 倒地与追击终止在实机上高度相关，但现行官方资料和 Chase 词条未给出“倒地即刻、必然结束”的独立规则 | 未确认精确终止帧 | 10.0.2 | 英文Wiki | Chase；Health States | https://deadbydaylight.wiki.gg/wiki/Health_States | 2026-07-14 | 低 | 原型可规定 down 关闭该目标追击，但要标记为分析口径 |
| C-07 | 追击 | 主动转火与丢失 | 正式追击结束条件可观察，但“主动放弃”“被迫丢失”“转火”是意图分类，游戏基础事件不能可靠区分 | 必须人工填写 end_reason | 10.0.2 | 机制推导 | Chase | https://deadbydaylight.wiki.gg/wiki/Chase?action=raw | 2026-07-14 | 低 | end_reason 允许 unknown，避免猜测 |
| D-01 | 逃生者 | 基础生命状态 | 基础生命状态为健康、受伤、倒地/濒死三类；健康可受一次普通伤害进入受伤，再受伤进入倒地，也存在直接从健康到倒地的伤害 | 3 个基础生命状态 | 10.0.2 现行 | 英文Wiki | Health States | https://deadbydaylight.wiki.gg/wiki/Health_States | 2026-07-14 | 中 | 抱起、上钩、离场应作为位置/控制状态，不与生命状态混成单枚举 |
| D-02 | 逃生者 | 倒地能力与流血 | 倒地只能缓慢爬行，无法使用道具；静止时自动恢复至 95%，默认不能自行完全起身；倒地累计 240 秒流血死亡 | 95%；30.4 秒恢复到上限；240 秒流血 | 9.2.0 起自动恢复，10.0.2 现行 | 英文Wiki | Dying State | https://deadbydaylight.wiki.gg/wiki/Dying_State | 2026-07-14 | 中 | 流血计时为累计值，抱起或上钩期间应按游戏状态暂停 |
| D-03 | 逃生者 | 抱起与上钩 | 常规流程为倒地后被杀手抱起，再完成挂钩交互进入上钩 | 挂钩动作 1.5 秒 | 10.0.2 现行 | 英文Wiki | Hooks | https://deadbydaylight.wiki.gg/wiki/Hooks | 2026-07-14 | 中 | 交互抓取可原子化地从健康/受伤进入抱起，但应记录 prior_health_state |
| D-04 | 逃生者 | 暂时失去行动能力 | 倒地严重限制行动；被抱起和被挂钩不能执行常规地图行动，但均可通过救援或挣脱回到场内 | 非终局状态 | 10.0.2 现行 | 英文Wiki | Dying State；Hooks；Wiggle | https://deadbydaylight.wiki.gg/wiki/Wiggle | 2026-07-14 | 中 | 不应把 down、carried、hooked 计为减员完成 |
| D-05 | 逃生者 | 永久离场 | 逃脱、献祭、被杀死、流血死亡均使该角色永久离开本局可行动集合 | terminal=true | 10.0.2 现行 | 英文Wiki | Survivors；Killing；Dying State | https://deadbydaylight.wiki.gg/wiki/Killing | 2026-07-14 | 中 | 必须保留不同 outcome_type，不能只写 dead=true |
| D-06 | 逃生者 | BOT 接管 | 排位对局开始后，逃生者玩家掉线会由 Disconnect Bot 自动接替；角色保持原状态并继续行动 | controller: human -> bot；角色状态不变 | 7.1.0 起，10.0.2 现行 | 官方 | 2023 Anniversary QoL；8.1.0 Tomb Raider | https://deadbydaylight.com/news/anniversary-quality-life-improvements/ | 2026-07-14 | 高 | 8.1.0 正式说明仍只在对局开始后生成；加载阶段掉线不按正常接管处理：https://forums.bhvr.com/dead-by-daylight/kb/articles/459-8-1-0-tomb-raider |
| E-01 | 挂钩 | 阶段数量与时长 | 常规献祭流程含第一阶段、第二阶段和最终献祭；前两个阶段基础各 70 秒 | 70 秒 + 70 秒 | 8.2.0 起，10.0.2 现行 | 官方 | 8.2.0 Castlevania | https://forums.bhvr.com/dead-by-daylight/kb/articles/468-8-2-0-castlevania | 2026-07-14 | 高 | 技能可暂停或加速，base_only 规则集忽略这些修正 |
| E-02 | 挂钩 | 阶段转换 | 首次上钩通常进入阶段 1；阶段条耗尽进入阶段 2；阶段 2 耗尽或死亡钩再次上钩进入献祭 | stage 0/1/2/3 | 10.0.2 现行 | 英文Wiki | Hooks | https://deadbydaylight.wiki.gg/wiki/Hooks | 2026-07-14 | 中 | 同一悬挂期间也可从阶段 1 进入阶段 2，不代表发生第二次挂钩 |
| E-03 | 挂钩 | 救援与自救 | 队友救援或成功自救会使上钩者回到受伤、在场状态；当前自救受 9.0.0“提前放弃”防护与守尸自救等条件影响 | 队友救援交互基础 1 秒 | 9.0.0 起有新限制，10.0.2 现行 | 官方/英文Wiki | 9.0.0 Five Nights at Freddy's；Hooks | https://forums.bhvr.com/dead-by-daylight/kb/articles/510-9-0-0-five-nights-at-freddys | 2026-07-14 | 中 | 交互时间来源：https://deadbydaylight.wiki.gg/wiki/Hooks；不模拟概率，只记录实际 unhook 结果 |
| E-04 | 挂钩 | 有效挂钩 | 杀手的挂钩动作完整结束，逃生者从 carried 转为 hooked，且对应 hook_stage 发生有效变化，可记为一次有效挂钩 | action_completed=true | 10.0.2 现行 | 英文Wiki | Hooks | https://deadbydaylight.wiki.gg/wiki/Hooks | 2026-07-14 | 中 | 笼子、处决、抱起失败、途中挣脱不计普通有效挂钩 |
| E-05 | 挂钩 | 阶段单调性 | base_only 下个人累计挂钩阶段通常只增不减；“肩负重担”可把 1 个挂钩阶段从被救者转给救人者，构成合法反例 | transfer 1 hook stage | 8.4.0 起，10.0.2 现行 | 英文Wiki | Shoulder the Burden | https://deadbydaylight.wiki.gg/wiki/Shoulder_the_Burden | 2026-07-14 | 中 | 若原型不模拟该技能，应在 ruleset 明确禁用，而不是把其日志判成游戏非法 |
| E-06 | 挂钩 | 跳阶段和直接死亡 | 最后一名逃生者被挂钩可直接献祭；处决、杀手力量、流血和终局也可绕过普通三挂流程 | 特殊终态转换 | 9.0.0 及 10.0.2 现行 | 官方/英文Wiki | 9.0.0 Five Nights at Freddy's；Killing | https://forums.bhvr.com/dead-by-daylight/kb/articles/510-9-0-0-five-nights-at-freddys | 2026-07-14 | 高 | 这些结果可算减员，但通常不能算普通挂钩转化 |
| F-01 | 结果 | 献祭 | 由钩上献祭、终局恶灵处决等造成永久死亡，事件原因应继续细分 | outcome=sacrificed | 10.0.2 现行 | 英文Wiki | Hooks；Endgame Collapse | https://deadbydaylight.wiki.gg/wiki/Hooks | 2026-07-14 | 中 | 只有 hook_sacrifice 可直接归因于普通挂钩收益 |
| F-02 | 结果 | 被杀死 | Mori 或杀手力量直接杀死逃生者，绕过或结束普通献祭流程 | outcome=killed | 8.3.0 起有基础终结处决，10.0.2 现行 | 英文Wiki | Killing | https://deadbydaylight.wiki.gg/wiki/Killing | 2026-07-14 | 中 | 可算杀手完成减员，但需单列 cause |
| F-03 | 结果 | 流血死亡 | 倒地累计计时耗尽后死亡 | outcome=bled_out；240 秒累计倒地 | 10.0.2 现行 | 英文Wiki | Dying State | https://deadbydaylight.wiki.gg/wiki/Dying_State | 2026-07-14 | 中 | 可算场上减员，不应计为挂钩收益 |
| F-04 | 结果 | 逃脱 | 逃生者通过已开出口或地道离开本局 | outcome=escaped；method=gate/hatch | 10.0.2 现行 | 英文Wiki | Survivors；Hatch；Exit Gates | https://deadbydaylight.wiki.gg/wiki/Survivors | 2026-07-14 | 中 | 不属于杀手减员 |
| F-05 | 结果 | 掉线 | 玩家掉线本身不再等于角色离场，通常触发 BOT 接管 | controller_change，不是 outcome | 7.1.0 起，10.0.2 现行 | 官方 | Anniversary Quality of Life Improvements | https://deadbydaylight.com/news/anniversary-quality-life-improvements/ | 2026-07-14 | 高 | 不计杀手正常减员，不计挂钩收益；最终采用 BOT 的实际结局 |

### 已记录的资料冲突

| 冲突 | 处理 |
|---|---|
| 小黑盒“钩子”词条仍描述默认 4% 自救与旧式失败惩罚；官方 9.0.0 已加入“提前放弃对局”防护 | 自救逻辑采用较新的官方 9.0.0；原型只接受实际发生的 `self_unhook`，不模拟概率 |
| 9.2.0 PTB 出现“提前减员后剩余逃生者修理加速”，9.2.0 正式补丁页没有该基础机制 | 判定为未进入正式服，不实现，不把 PTB 数值写进规则引擎 |
| 8.1.0 PTB 曾测试加载阶段掉线生成 BOT；8.1.0 正式说明仍只在对局开始后生成 Disconnect Bot | 只把对局开始后的掉线建模为正常 controller change；加载阶段掉线标异常或未确认 |
| 小黑盒个别词条仍保留历史说明，如献祭后钩子永久损坏 | 采用官方 8.1.0 之后规则：普通献祭钩 60 秒后恢复 |

## 第三部分：原型事件映射表

### 3.1 游戏机制到日志事件

| 游戏机制 | 建议的日志事件 | 必填字段 | 合法前置状态 | 合法后续状态 | 用于哪些指标 | 校验注意事项 |
|---|---|---|---|---|---|---|
| 对局开始 | `trial_start` | `eventId,timestamp,patch,ruleset` | 无 | trial=active | 1、3、10 | 只能出现一次；建议 timestamp=0 |
| 原型定义的目标确认 | `target_acquired` | `killerId,survivorId,evidenceType,confidence,observerNote` | 目标仍在场 | 信息层更新，不强制开启追击 | 1、2 | `direct_los/aura/scream/killer_instinct/scratch_marks/blood/sound/manual` 分开；不可自动等同 chase_start |
| 正式追击开始 | `chase_start` | `chaseId,killerId,survivorId,source=game_state` | 目标在场且该 chaseId 未开启 | chase=active | 4 | 同时允许多个 survivorId 处于 active；不能复用未关闭 chaseId |
| 正式追击结束 | `chase_end` | `chaseId,survivorId,endReason,censored` | 对应 chase=active | chase=closed | 2、4 | `lost_los/range_break/locker/target_downed/target_switch/trial_end/unknown`；主动意图只能人工标注 |
| 生命状态受伤 | `survivor_injured` | `survivorId,fromState,cause,sourceId` | healthy 或特殊保护状态 | injured | 辅助解释追击 | 不要把 injury 当作 chase_start/end |
| 逃生者倒地 | `survivor_downed` | `survivorId,fromState,cause,sourceId` | healthy/injured 等在场状态 | dying | 3、4、10 | 若本规则将 down 作为追击终点，应同时生成带同 timestamp/order 的 chase_end，并标 `policyGenerated=true` |
| 被杀手抱起 | `survivor_picked_up` | `survivorId,priorHealthState,pickupMethod` | dying；或交互抓取 | carried | 挂钩流程 | 交互抓取允许跨过可见的 dying 停留，但应保留 priorHealthState |
| 抱起结束但未上钩 | `survivor_released` | `survivorId,reason` | carried | dying 或 injured | 挂钩流程校验 | killer_drop 通常回 dying；wiggle/stun_save 回 injured |
| 有效挂钩完成 | `hook_completed` | `hookEventId,survivorId,hookId,stageBefore,stageAfter,hookNumber` | carried | hooked(stage 1/2/3) | 8、9、10、11 | 必须 action 完成；普通重复挂钩 stageAfter 不得小于 stageBefore |
| 挂钩阶段自然推进 | `hook_stage_advanced` | `survivorId,fromStage,toStage,cause` | hooked(stage 1/2) | hooked(stage 2) 或 sacrificed | 9、10 | 这不是一次新挂钩，不能计入相邻挂钩间隔 |
| 救援/自救 | `survivor_unhooked` | `survivorId,rescuerId,method,stageAtRelease` | hooked(stage 1/2) | injured, active | 9 | `rescuerId` 自救时为空；守尸自救和技能自救用 method 区分 |
| 挂钩阶段转移 | `hook_stage_transferred` | `fromSurvivorId,toSurvivorId,amount,source` | 使用允许转移的规则集 | 两人的 hookStage 同步变化 | 9 | 仅在启用“肩负重担”等例外时合法；base_only 可拒绝整个 fixture |
| 发电机开始/停止修理 | `generator_repair_started` / `generator_repair_stopped` | `generatorId,survivorId,progress,reason` | 未完成、未封锁 | repairing 或 idle/regressing | 5、6、7 | stop 本身不算杀手控机；多人参与者必须独立记录 |
| 发电机即时进度变化 | `generator_progress_delta` | `generatorId,delta,progressBefore,progressAfter,cause,sourceId` | 未完成；效果实际生效 | 原状态或回退 | 5、6 | 负 delta 分 killer_effect、skill_check_fail 等；封锁免疫时 `applied=false` |
| 发电机回退开始 | `generator_regression_started` | `regressionId,generatorId,progress,source,regressionEventIndex` | 未完成、有进度、未达事件上限 | damaged=true, regression=active | 5、7 | 不要把即时损失和区间开始合成一个不可拆对象 |
| 发电机回退暂停/恢复 | `generator_regression_paused` / `generator_regression_resumed` | `regressionId,generatorId,reason,progress` | regression=active / paused | paused / active | 7 | reason 为 repairing 或 blocked；暂停时长不算活跃回退 |
| 发电机回退停止 | `generator_regression_stopped` | `regressionId,generatorId,reason,progress` | active 或 paused | damaged=false 或 progress=0 | 7 | reason 为 repaired_5_percent、zero、completed、trial_end；trial_end 需 censored |
| 发电机封锁/解除 | `generator_blocked` / `generator_unblocked` | `generatorId,source,durationExpected,progress` | 未完成 | blocked overlay on/off | 5、6、7 | 保存封锁前 damaged/regression 状态；解除后按先前状态恢复 |
| 发电机完成 | `generator_completed` | `generatorId,completionIndex,progress=1,contributors` | 未完成 | completed terminal | 6、11 | 完成后禁止普通修理、回退、封锁生效事件 |
| 永久结局 | `survivor_outcome` | `survivorId,outcomeType,cause,attribution` | 非终态 | terminal | 10、11 | outcomeType：sacrificed/killed/bled_out/escaped；掉线不能写在此字段 |
| 玩家掉线与 BOT 接管 | `controller_changed` | `survivorId,from=human,to=bot,reason` | 角色任意非终态 | 角色状态不变 | 指标排除/分层 | 不产生 elimination；后续事件仍属于同一 survivorId |
| 对局结束 | `trial_end` | `reason,timestamp,normalEnd,remainingStates` | trial=active | trial=closed | 全部 | 强制关闭未闭合 chase/regression；这些合成闭合事件标 censored=true |

### 3.2 十一个指标的口径检查

| 指标 | 可依赖事件 | 主要误判风险 | 模拟日志需增加字段 | 建议口径 |
|---|---|---|---|---|
| 1. 对局开始到首次发现目标 | `trial_start -> target_acquired` | 游戏没有正式“发现”原子事件；气场、声音和直视混为一谈 | `evidenceType,confidence,observerNote` | 保留，但明确为人工标注的“首次可行动目标确认”，不要命名为官方发现事件 |
| 2. 上次追击结束或挂钩后到下次发现 | `chase_end/hook_completed -> target_acquired` | “或”导致锚点不唯一；挂钩前后可能已有别的目标信息 | `anchorType,anchorEventId,targetWasAlreadyKnown` | 拆成“追击结束后再搜寻时长”和“挂钩后再接敌时长”两项，分别计算 |
| 3. 对局开始到首次击倒 | `trial_start -> survivor_downed` | 自己进入倒地、特殊机制或异常日志被算成杀手效率 | `cause,attribution,sourceId` | 计算首次 `attribution=killer` 的倒地；其他倒地仅进时间线 |
| 4. 追击开始到追击结束 | `chase_start -> chase_end` | 倒地结束精确帧未被资料直接确认；并发追击；未闭合区间 | `chaseId,endReason,censored,policyGenerated` | 以正式 chase 状态为主；原型若规定 down 闭合，必须标成分析策略；censored 区间不进均值或单列 |
| 5. 高进度发电机受有效干扰次数 | `progress_delta/regression_started/blocked` | 同一技能同时造成即时损失和回退被重复计数；停修误算控机 | `interferenceId,effectTypes,progressBefore,applied,killerCaused` | 按一次因果触发的 `interferenceId` 去重；只有实际产生即时损失、活跃回退或有效封锁的杀手原因事件才计数 |
| 6. 高进度发电机未经有效干扰便完成次数 | `threshold_crossed -> generator_completed` 加干扰事件 | 发电机多次跨过高进度线；只看完成前最后状态会漏算 | `highProgressEpisodeId,progressSamples/interpolatedCrossing` | 以每次从阈值下方进入高进度区间为一个 episode；完成前无有效干扰才计一次，阈值后定 |
| 7. 发电机活跃回退累计时长 | regression start/pause/resume/stop | 把 damaged、repair pause、blocked pause 都算作回退 | `regressionId,stateBeforeBlock,pauseReason,censored` | 只累加 `regression=active` 区间；暂停不计；到 trial_end 可计至结束但标 censored |
| 8. 相邻两次有效挂钩间隔 | 连续 `hook_completed` | 阶段自然推进被误当第二挂；笼子/处决混入 | `hookEventId,hookNumber,stageBefore,stageAfter,isStandardHook` | 对全局有效普通挂钩按时间排序取差；另保留 sameSurvivor 版本，二者不要混用 |
| 9. 一挂到二挂转化率 | `hook_completed -> unhooked -> later hook_completed` | “进入第二阶段”可在同一次上钩自然发生，不等于二次挂钩；阶段转移改变计数 | `firstHookEventId,unhookEventId,rehookEventId,hookStageTransfers` | 改名“首挂获救后的再次上钩转化率”；分母为首挂后成功离钩且仍在场的逃生者，分子为其后再次有效上钩者 |
| 10. 对局开始到首次正常减员 | `trial_start -> survivor_outcome` | DC 被当击杀；逃脱被当离场减员；流血和处决污染挂钩收益 | `outcomeType,cause,attribution,controllerHistory` | 节奏指标可把 sacrificed/killed/bled_out 计为永久减员，排除 escaped/DC；另算“首次挂钩链减员”只纳入 hook_sacrifice |
| 11. 第 N 台发电机完成时是否已减员 | `generator_completed` 与此前 `survivor_outcome` | 同时间戳顺序、地道分支、BOT/DC、非杀手原因 | `eventOrder,completionIndex,eliminationCountBefore,phase` | 使用严格事件顺序，不只比较秒数；只看完成前的永久杀手减员，DC 不算；地道关闭通电单列 phase |

## 第四部分：建议的状态转换

### 4.1 追击状态转换

信息层与追击层分开维护：

`unknown_target -> information_received -> target_acquired`

- `information_received` 可来自气场、尖叫、杀手本能、足迹、血迹、声音或直视。
- `target_acquired` 是原型定义的“杀手已获得足以立即采取追踪/追击行动的具体目标”，不是官方状态。
- 获得信息不必进入追击；追击开始也可能没有单独记录此前的信息事件。

每名逃生者独立维护正式追击状态：

`not_in_chase -> chase_active -> chase_closed`

- `not_in_chase -> chase_active`：记录正式 `chase_start`。
- `chase_active -> chase_closed`：记录正式 `chase_end`，原因可为距离、视线、柜子、目标倒地、转火、对局结束或未知。
- 多名逃生者的 `chase_active` 可短暂并存。
- 对局结束时，所有未闭合追击生成 `chase_end(endReason=trial_end,censored=true)`。

### 4.2 发电机状态转换

建议使用一个主状态和三个正交标志：

- `activity_state = idle | repairing | regression_active | regression_paused | completed`
- `damaged: boolean`
- `blocked: boolean`
- `completed: boolean`

基础流程：

`idle -> repairing -> idle`

`idle/repairing -> completed`（达到完成进度，终态）

`idle -> damage_applied(-5% total) -> regression_active`

`regression_active -> regression_paused(reason=repairing) -> regression_stopped`（累计修回总量 5%）

`regression_paused(reason=repairing) -> regression_active`（未修满 5%便停止修理）

`regression_active -> regression_paused(reason=blocked) -> regression_active`（封锁解除后恢复）

`idle/repairing -> blocked -> previous_state`（无既有回退时只冻结）

`regression_active -> idle`（回退到 0）

`any_uncompleted -> completed` 后禁止再出现普通修理、回退和破坏生效。

即时损失、持续回退、封锁分别记录。一次技能触发可同时产生多种效果，但共享同一个 `interferenceId`，避免统计重复。

### 4.3 逃生者与挂钩状态转换

生命与位置建议分轴：

- `health_state = healthy | injured | dying`
- `custody_state = free | carried | hooked`
- `controller = human | bot`
- `outcome = null | sacrificed | killed | bled_out | escaped`
- `hook_stage = 0 | 1 | 2`，最终献祭由 outcome 表示；若沿用 3，必须明确 3 是终态而非可救阶段

常规合法转换：

`healthy -> injured -> dying`

`healthy -> dying`（双重伤害、暴露攻击或特殊能力）

`dying -> injured`（他人治疗或允许的自起）

`dying/free -> dying/carried -> hooked(stage 1 or 2)`

`healthy/injured/free -> dying/carried`（交互抓取，可作为同一时间的原子复合事件）

`carried -> dying/free`（杀手放下）

`carried -> injured/free`（挣脱、致盲或眩晕救下）

`hooked(stage 1) -> hooked(stage 2)`（阶段条耗尽，不新增 hook_completed）

`hooked(stage 1 or 2) -> injured/free`（队友救援或成功自救）

`hooked(stage 2) -> sacrificed`（阶段耗尽或死亡钩结算）

`dying -> killed`（Mori/力量）

`dying -> bled_out`（累计倒地 240 秒）

`free -> escaped`（出口或地道）

`human -> bot` 只改变 controller，health/custody/hook_stage 不变。

特殊合法转换：

- 最后一名逃生者被挂钩可直接进入献祭。
- 终结处决或特定杀手力量可由倒地直接进入 killed。
- 终局计时耗尽可把仍在场逃生者转为 sacrificed，但 `cause=endgame_collapse`，不计普通挂钩收益。
- “肩负重担”可使一名逃生者 hook_stage 减 1、另一名加 1；必须以专用 transfer 事件表达。
- 笼子等杀手专属替代流程不在 base_only 范围；遇到时拒绝 fixture 或标记 unsupported，不伪装成普通钩子。

## 第五部分：歧义与待决定事项

1. **“发现逃生者”的定义**  
   游戏没有满足本指标的统一正式事件。建议定义为：“人工观察确认杀手获得某名仍在场逃生者的具体、可立即采取追踪行动的位置”，并强制填写 `evidenceType`。是否把短暂气场或尖叫直接算“发现”，必须由产品口径决定。

2. **发现、看到、信息与追击的先后关系**  
   四者不能合并。推荐允许 `information_received -> target_acquired -> chase_start`，也允许某些节点缺失；规则引擎不得反向推断“有气场就必然发现”或“追击开始时才第一次看到”。

3. **追击丢失与主动放弃如何区分**  
   官方追击状态能告诉我们区间结束，不能可靠说明杀手意图。人工日志应使用 `endReason=target_switch/lost_los/range_break/unknown`；看不清时必须写 unknown。

4. **首追截止到击倒还是挂钩**  
   建议拆开：追击效率止于 `chase_end` 或按原型策略止于 `survivor_downed`；“首轮转化耗时”另算 `chase_start -> hook_completed`。挂钩包含抱起和搬运，不应混入纯追击时长。

5. **倒地是否自动关闭追击**  
   资料未直接确认精确终止帧。若前端日志没有正式 chase_end，可在 down 时生成策略事件，但必须标 `policyGenerated=true`，便于以后替换口径。

6. **有效干扰的定义**  
   建议仅纳入杀手导致且实际生效的即时进度损失、活跃回退开始或有效封锁。逃生者看到杀手靠近后自行停修，没有明确生成上述效果时不计；如要评价“逼退”，应另设 `survivor_forced_off_generator` 人工事件。

7. **一次干扰还是多个效果**  
   某次技能可能同时即时掉进度并启动回退。统计“次数”时按 `interferenceId` 去重；统计效果量时分别累计 `instantLoss`、`activeRegressionDuration` 和 `blockedDuration`。

8. **高进度发电机的判定时点**  
   阈值之后设定。必须决定按干扰前进度、干扰后进度，还是进入高进度区间的 episode 判定。推荐使用 `progressBefore`，否则一次大额损失会把高进度事件错误降级。

9. **回退覆盖率的分母**  
   “累计回退时长”没有分母；若展示覆盖率，建议分母为“所有未完成且有正进度发电机的可回退总时长”，并排除完成、封锁、正在修理导致的回退暂停。也可使用更易解释的“活跃回退秒数/对局有效时长”，但名称必须不同。

10. **首挂到二挂的含义**  
    阶段 1 自然耗尽进入阶段 2，不等于第二次上钩。推荐指标改为“首挂获救后的再次上钩转化率”。如果真正想分析阶段压力，应另做“首挂进入第二阶段比例”。

11. **挂钩收益是否包含 Mori、流血和终局献祭**  
    杀手“完成减员”可包含 sacrificed/killed/bled_out；挂钩收益只纳入由普通 hook chain 导致的挂钩与 `hook_sacrifice`。Mori 即使要求死亡钩，也应保留独立 cause。

12. **掉线是否影响挂钩收益评价**  
    `controller_changed` 不计减员、不重置 hook_stage。BOT 后续被挂钩或死亡可正常进入事件链，但报告应可筛选 `hadBotTakeover=true`。若没有 BOT 或对局异常终止，整局标 `normalEnd=false` 并从效率汇总中排除。

13. **未闭合追击如何处理**  
    对局结束时补 `chase_end(censored=true)`。时间线可显示到 trial_end；均值、成功率等完成区间指标默认排除，或单独展示删失样本数。

14. **未闭合回退如何处理**  
    回退持续到 trial_end 时，可把实际活跃秒数累计到结束，同时补 `regression_stopped(reason=trial_end,censored=true)`。若结束前正因修理或封锁暂停，不能把暂停段算入。

15. **同时间戳事件顺序**  
    JSON 必须增加单调递增的 `eventOrder`。第五台发电机完成、逃生者死亡、终局触发等可能落在同一秒，仅靠秒级 timestamp 无法判断“第 N 台完成前是否已减员”。

16. **规则集范围**  
    建议每个 fixture 写 `ruleset: base_only_1v4_10.0.2`。技能、附加品、祭品、特殊杀手力量或活动规则若未模拟，写入 `unsupportedMechanics` 并在载入时警告，不要默默套用基础规则。

## 第六部分：资料来源清单

### 官方资料

1. [Dead by Daylight Game Overview](https://deadbydaylight.com/game/)
2. [10.0.2 Bugfix Patch](https://forums.bhvr.com/dead-by-daylight/kb/articles/552-10-0-2-bugfix-patch)
3. [10.0.0 Jason Patch Notes](https://forums.bhvr.com/dead-by-daylight/kb/articles/550-10-0-0-jason-patch-notes)
4. [9.6.0 Patch Notes](https://forums.bhvr.com/dead-by-daylight/kb/articles/544-9-6-0-patch-notes)
5. [9.3.0 Mid-Chapter](https://forums.bhvr.com/dead-by-daylight/kb/articles/529-9-3-0-mid-chapter)
6. [9.2.0 PTB Patch Notes](https://forums.bhvr.com/dead-by-daylight/kb/articles/522-9-2-0-ptb-patch-notes)
7. [9.2.0 Sinister Grace](https://forums.bhvr.com/dead-by-daylight/kb/articles/523-9-2-0-sinister-grace)
8. [9.0.0 Five Nights at Freddy's](https://forums.bhvr.com/dead-by-daylight/kb/articles/510-9-0-0-five-nights-at-freddys)
9. [8.2.0 Castlevania](https://forums.bhvr.com/dead-by-daylight/kb/articles/468-8-2-0-castlevania)
10. [8.1.0 Tomb Raider](https://forums.bhvr.com/dead-by-daylight/kb/articles/459-8-1-0-tomb-raider)
11. [7.5.0 Alan Wake](https://forums.bhvr.com/dead-by-daylight/kb/articles/430-7-5-0-alan-wake)
12. [Developer Update January 2024](https://forums.bhvr.com/dead-by-daylight/kb/articles/427-developer-update-january-2024)
13. [7.3.0 Mid-Chapter](https://forums.bhvr.com/dead-by-daylight/kb/articles/413-7-3-0-mid-chapter)
14. [Dead by Daylight 2023 Anniversary: Quality of Life Improvements](https://deadbydaylight.com/news/anniversary-quality-life-improvements/)

### 英文 Wiki

1. [Generators](https://deadbydaylight.wiki.gg/wiki/Generators)
2. [Chase](https://deadbydaylight.wiki.gg/wiki/Chase?action=raw)
3. [Hooks](https://deadbydaylight.wiki.gg/wiki/Hooks)
4. [Health States](https://deadbydaylight.wiki.gg/wiki/Health_States)
5. [Dying State](https://deadbydaylight.wiki.gg/wiki/Dying_State)
6. [Wiggle](https://deadbydaylight.wiki.gg/wiki/Wiggle)
7. [Auras](https://deadbydaylight.wiki.gg/wiki/Auras)
8. [Killer Instinct](https://deadbydaylight.wiki.gg/wiki/Killer_Instinct)
9. [Bots](https://deadbydaylight.wiki.gg/wiki/Bots)
10. [Exit Gates](https://deadbydaylight.wiki.gg/wiki/Exit_Gates)
11. [Hatch](https://deadbydaylight.wiki.gg/wiki/Hatch)
12. [Endgame Collapse](https://deadbydaylight.wiki.gg/wiki/Endgame_Collapse?action=raw)
13. [Killing](https://deadbydaylight.wiki.gg/wiki/Killing)
14. [Survivors](https://deadbydaylight.wiki.gg/wiki/Survivors)
15. [Shoulder the Burden](https://deadbydaylight.wiki.gg/wiki/Shoulder_the_Burden)
16. [Score Events](https://deadbydaylight.wiki.gg/wiki/Score_Events)
17. [Trials](https://deadbydaylight.wiki.gg/wiki/Trials)

### 中文 Wiki（术语核对）

1. [小黑盒 Wiki：发电机](https://api.xiaoheihe.cn/wiki/get_article_for_app/?article_id=48734&wiki_id=381210&is_share=1)
2. [小黑盒 Wiki：钩子](https://api.xiaoheihe.cn/wiki/get_article_for_app/?article_id=9702325&wiki_id=381210&is_share=1)
3. [小黑盒 Wiki：状态](https://api.xiaoheihe.cn/wiki/get_article_for_app/?article_id=74340&wiki_id=381210&is_share=1)
4. [小黑盒 Wiki：气场](https://api.xiaoheihe.cn/wiki/get_article_for_app/?article_id=74341&wiki_id=381210&is_share=1)
5. [小黑盒 Wiki：新手 Q&A](https://api.xiaoheihe.cn/wiki/get_article_for_app/?article_id=17780455&wiki_id=381210&is_share=1)

### 其他资料

无。社区帖子仅用于搜索线索，没有作为机制事实写入结论。

## 最终检查

- [x] 所有精确数值均附有直接来源
- [x] 结论以 10.0.2 正式服为基线，并标出关键历史补丁
- [x] 未使用社区意见替代机制事实
- [x] 未把气场、尖叫、足迹、声音或杀手本能等同于正式追击
- [x] 未提出 75 秒、10% 等原型诊断阈值
- [x] 未扩展到完整角色、技能、附加品、地图或商业系统
- [x] 掉线与 BOT 接管已和角色离场分离
- [x] 未闭合追击和回退区间有明确处理规则
