import { describe, expect, it } from "vitest";
import validSample from "../../data/samples/valid-base-match.json";
import type { HookCompletedEvent, MatchLog } from "../log";
import { calculateMatchMetrics } from "./calculateMatchMetrics";
import type { NumericMetric } from "./types";

const CONFIG = { highProgressThreshold: 0.7 } as const;

function cloneValidLog(): MatchLog {
  return structuredClone(validSample) as unknown as MatchLog;
}

function expectAvailable(metric: NumericMetric, expectedValue: number): void {
  expect(metric.status).toBe("available");

  if (metric.status !== "available") {
    throw new Error(`指标不可用：${metric.reason.code}`);
  }

  expect(metric.value).toBe(expectedValue);
  expect(Number.isFinite(metric.value)).toBe(true);
  expect(metric.explanation.length).toBeGreaterThan(0);
  expect(Array.isArray(metric.evidenceEventIds)).toBe(true);
}

function expectUnavailable(
  metric: NumericMetric,
  expectedReason: string,
): void {
  expect(metric.status).toBe("unavailable");

  if (metric.status !== "unavailable") {
    throw new Error(`指标意外可用：${metric.value}`);
  }

  expect(metric.value).toBeNull();
  expect(metric.reason.code).toBe(expectedReason);
  expect(metric.explanation.length).toBeGreaterThan(0);
}

describe("calculateMatchMetrics", () => {
  it("计算正常日志的四类指标并保留解释与证据", () => {
    const result = calculateMatchMetrics(cloneValidLog(), CONFIG);

    expectAvailable(result.finding.firstFindTime, 10_000);
    expectAvailable(result.finding.averageSearchGap, 25_000);
    expectAvailable(
      result.finding.averagePostHookTargetAcquisition,
      15_000,
    );

    expectAvailable(result.chase.firstChaseToFirstDown, 48_000);
    expectAvailable(result.chase.firstChaseToFirstHook, 58_000);
    expectAvailable(result.chase.averageChaseDuration, 54_000);
    expectAvailable(result.chase.abandonedChaseCount, 1);
    expect(result.chase.abandonedChaseCount.sampleSize).toBe(2);

    expectAvailable(
      result.generatorControl.highProgressGeneratorLosses,
      1,
    );
    expectAvailable(result.generatorControl.keyGeneratorInterruptions, 1);
    expect(
      result.generatorControl.keyGeneratorInterruptions.evidenceEventIds,
    ).toEqual(["event-010", "event-011"]);

    expectAvailable(result.hookYield.totalHooks, 1);
    expectAvailable(result.hookYield.uniqueSurvivorsHooked, 1);
    expectAvailable(result.hookYield.secondHookConversions, 0);
    expect(result.hookYield.secondHookConversions.sampleSize).toBe(1);
    expect(result.hookYield.secondHookConversions.evidenceEventIds).toEqual([
      "event-009",
      "event-014",
    ]);
    expectAvailable(result.hookYield.hookConcentration, 1);
    expectUnavailable(
      result.hookYield.firstEliminationTime,
      "no_elimination_event",
    );
    expect(result.diagnostics).toEqual([]);
  });

  it("对乱序数组产生与规范顺序相同的确定性结果", () => {
    const ordered = calculateMatchMetrics(cloneValidLog(), CONFIG);
    const reversedLog = cloneValidLog();
    reversedLog.events.reverse();

    const reversed = calculateMatchMetrics(reversedLog, CONFIG);

    expect(reversed).toEqual(ordered);
  });

  it("保持输入日志不变，所有派生计算均为纯函数", () => {
    const log = cloneValidLog();
    const snapshot = structuredClone(log);

    calculateMatchMetrics(log, CONFIG);

    expect(log).toEqual(snapshot);
  });

  it("不把未结束追逐计入完整追逐均值", () => {
    const log = cloneValidLog();
    log.events = log.events.filter(
      (event) =>
        !(event.type === "chase_end" && event.chaseId === "chase-2"),
    );

    const result = calculateMatchMetrics(log, CONFIG);

    expectAvailable(result.chase.averageChaseDuration, 48_000);
    expect(result.chase.averageChaseDuration.sampleSize).toBe(1);
    expectAvailable(result.chase.abandonedChaseCount, 0);
  });

  it("在完全没有完整追逐时返回不可用而不是零或非有限数", () => {
    const log = cloneValidLog();
    log.events = log.events.filter((event) => event.type !== "chase_end");

    const result = calculateMatchMetrics(log, CONFIG);

    expectUnavailable(
      result.chase.averageChaseDuration,
      "no_complete_chases",
    );
    expectUnavailable(result.chase.abandonedChaseCount, "no_complete_chases");
  });

  it("排除 censored 追逐，不把策略关闭区间伪装成完整样本", () => {
    const log = cloneValidLog();
    log.events = log.events.map((event) =>
      event.type === "chase_end" && event.chaseId === "chase-2"
        ? { ...event, censored: true, endReason: "trial_end" }
        : event,
    );

    const result = calculateMatchMetrics(log, CONFIG);

    expectAvailable(result.chase.averageChaseDuration, 48_000);
    expect(result.chase.averageChaseDuration.sampleSize).toBe(1);
    expectAvailable(result.chase.abandonedChaseCount, 0);
  });

  it("并发追逐中只在最后一个活动追逐结束后开始计算再搜寻", () => {
    const log = cloneValidLog();
    log.events.push(
      {
        eventId: "event-concurrent-start",
        timestampMs: 50_000,
        eventOrder: 30,
        type: "chase_start",
        chaseId: "chase-concurrent",
        survivorId: "survivor-3",
        source: "manual",
      },
      {
        eventId: "event-concurrent-end",
        timestampMs: 80_000,
        eventOrder: 31,
        type: "chase_end",
        chaseId: "chase-concurrent",
        survivorId: "survivor-3",
        endReason: "target_switch",
        censored: false,
        policyGenerated: false,
      },
    );

    const result = calculateMatchMetrics(log, CONFIG);

    expectAvailable(result.finding.averageSearchGap, 5_000);
    expect(result.finding.averageSearchGap.evidenceEventIds).toEqual([
      "event-concurrent-end",
      "event-012",
    ]);
    expect(result.chase.averageChaseDuration.sampleSize).toBe(3);
  });

  it("无挂钩时保留真实零计数，并让零分母指标明确不可用", () => {
    const log = cloneValidLog();
    log.events = log.events.filter(
      (event) =>
        event.type !== "hook_completed" &&
        event.type !== "hook_stage_advanced" &&
        event.type !== "survivor_unhooked",
    );

    const result = calculateMatchMetrics(log, CONFIG);

    expectAvailable(result.hookYield.totalHooks, 0);
    expectAvailable(result.hookYield.uniqueSurvivorsHooked, 0);
    expectAvailable(result.hookYield.secondHookConversions, 0);
    expectUnavailable(
      result.hookYield.hookConcentration,
      "no_hooks_for_concentration",
    );
    expectUnavailable(result.chase.firstChaseToFirstHook, "missing_first_hook");
  });

  it("无发电机进度证据时返回带原因的不可用状态", () => {
    const log = cloneValidLog();
    log.events = log.events.filter(
      (event) => !event.type.startsWith("generator_"),
    );

    const result = calculateMatchMetrics(log, CONFIG);

    expectUnavailable(
      result.generatorControl.highProgressGeneratorLosses,
      "no_generator_progress_evidence",
    );
    expectUnavailable(
      result.generatorControl.keyGeneratorInterruptions,
      "no_generator_progress_evidence",
    );
  });

  it("重复 eventId 不会重复计数，并产生可追溯诊断", () => {
    const log = cloneValidLog();
    const hook = log.events.find(
      (event): event is HookCompletedEvent =>
        event.type === "hook_completed",
    );

    if (!hook) {
      throw new Error("测试样例缺少 hook_completed");
    }

    log.events.push(structuredClone(hook));
    const result = calculateMatchMetrics(log, CONFIG);

    expectAvailable(result.hookYield.totalHooks, 1);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "duplicate_event_id_ignored",
        evidenceEventIds: [hook.eventId],
      }),
    ]);
  });

  it("按 eventOrder 处理同时间戳事件，并按 interferenceId 去重", () => {
    const log = cloneValidLog();
    const sixtySecondEvents = log.events.filter(
      (event) => event.timestampMs === 60_000,
    );
    const seventyOneSecondEvents = log.events.filter(
      (event) => event.timestampMs === 71_000,
    );

    log.events = [
      ...log.events.filter(
        (event) =>
          event.timestampMs !== 60_000 && event.timestampMs !== 71_000,
      ),
      ...sixtySecondEvents.reverse(),
      ...seventyOneSecondEvents.reverse(),
    ];

    const result = calculateMatchMetrics(log, CONFIG);

    expectAvailable(result.chase.firstChaseToFirstDown, 48_000);
    expectAvailable(result.chase.averageChaseDuration, 54_000);
    expectAvailable(result.generatorControl.keyGeneratorInterruptions, 1);
  });

  it("用独立 chaseId 计算同一逃生者的多次追逐", () => {
    const log = cloneValidLog();
    log.events = log.events.map((event) => {
      if (
        (event.type === "target_acquired" && event.eventId === "event-012") ||
        (event.type === "chase_start" && event.chaseId === "chase-2") ||
        (event.type === "chase_end" && event.chaseId === "chase-2")
      ) {
        return { ...event, survivorId: "survivor-1" };
      }

      return event;
    });

    const result = calculateMatchMetrics(log, CONFIG);

    expectAvailable(result.chase.averageChaseDuration, 54_000);
    expect(result.chase.averageChaseDuration.sampleSize).toBe(2);
    expectAvailable(result.chase.abandonedChaseCount, 1);
  });

  it("首追转化不会串联到另一名逃生者的挂钩", () => {
    const log = cloneValidLog();
    log.events = log.events.map((event) =>
      event.type === "hook_completed" && event.eventId === "event-009"
        ? { ...event, survivorId: "survivor-2" }
        : event,
    );

    const result = calculateMatchMetrics(log, CONFIG);

    expectAvailable(result.chase.firstChaseToFirstDown, 48_000);
    expectUnavailable(result.chase.firstChaseToFirstHook, "missing_first_hook");
  });

  it("BOT 接管不会被计算为永久减员", () => {
    const log = cloneValidLog();
    log.events = log.events.filter((event) => event.type !== "survivor_outcome");

    const result = calculateMatchMetrics(log, CONFIG);

    expectUnavailable(result.hookYield.firstEliminationTime, "no_elimination_event");
    expect(log.events.some((event) => event.type === "controller_changed")).toBe(true);
  });

  it("目标确认置信度进入找人指标元数据", () => {
    const log = cloneValidLog();
    log.events = log.events.map((event) =>
      event.type === "target_acquired" && event.eventId === "event-012"
        ? { ...event, confidence: "uncertain" as const }
        : event,
    );

    const result = calculateMatchMetrics(log, CONFIG);

    expect(result.finding.averageSearchGap).toEqual(
      expect.objectContaining({ status: "available", confidence: 0.5 }),
    );
  });

  it("高进度发电机丢失的样本量表示高进度 episode 数", () => {
    const log = cloneValidLog();
    log.events = log.events.filter((event) => !event.type.startsWith("generator_"));
    log.events.push(
      {
        eventId: "episode-1",
        timestampMs: 40_000,
        eventOrder: 30,
        type: "generator_repair_stopped",
        generatorId: "generator-1",
        survivorId: "survivor-2",
        progress: 0.8,
        reason: "voluntary",
      },
      {
        eventId: "episode-1-interference",
        timestampMs: 50_000,
        eventOrder: 31,
        type: "generator_progress_delta",
        generatorId: "generator-1",
        delta: -0.2,
        progressBefore: 0.8,
        progressAfter: 0.6,
        cause: "killer_interference",
        applied: true,
        killerCaused: true,
        interferenceId: "interference-episode-1",
      },
      {
        eventId: "episode-2",
        timestampMs: 80_000,
        eventOrder: 32,
        type: "generator_repair_stopped",
        generatorId: "generator-1",
        survivorId: "survivor-3",
        progress: 0.8,
        reason: "voluntary",
      },
      {
        eventId: "episode-2-complete",
        timestampMs: 90_000,
        eventOrder: 33,
        type: "generator_completed",
        generatorId: "generator-1",
        completionIndex: 1,
        progress: 1,
        contributors: ["survivor-3"],
      },
    );

    const result = calculateMatchMetrics(log, CONFIG);

    expectAvailable(result.generatorControl.highProgressGeneratorLosses, 1);
    expect(result.generatorControl.highProgressGeneratorLosses.sampleSize).toBe(2);
  });

  it("只把首挂获救后的再次上钩计为转化，并区分挂钩链减员", () => {
    const log = cloneValidLog();
    log.events.push({
      eventId: "event-024",
      timestampMs: 160_000,
      eventOrder: 23,
      type: "hook_completed",
      survivorId: "survivor-1",
      hookId: "hook-2",
      stageBefore: 1,
      stageAfter: 2,
      hookNumber: 2,
      isDeathHook: false,
      isStandardHook: true,
    });
    log.events = log.events.map((event) =>
      event.type === "survivor_outcome" &&
      event.survivorId === "survivor-1"
        ? {
            ...event,
            timestampMs: 230_000,
            outcomeType: "sacrificed",
            cause: "standard_hook_chain",
            attribution: "killer",
          }
        : event,
    );

    const result = calculateMatchMetrics(log, CONFIG);

    expectAvailable(result.hookYield.totalHooks, 2);
    expectAvailable(result.hookYield.secondHookConversions, 1);
    expect(result.hookYield.secondHookConversions.sampleSize).toBe(1);
    expect(result.hookYield.secondHookConversions.evidenceEventIds).toEqual([
      "event-009",
      "event-014",
      "event-024",
    ]);
    expectAvailable(result.hookYield.firstEliminationTime, 230_000);
    expectAvailable(
      result.hookYield.firstHookChainEliminationTime,
      230_000,
    );
  });

  it("普通献祭必须有明确 standard_hook_chain 原因才计入挂钩链减员", () => {
    const log = cloneValidLog();
    log.events = log.events.map((event) =>
      event.type === "survivor_outcome"
        ? {
            ...event,
            outcomeType: "sacrificed" as const,
            cause: "unverified_sacrifice",
            attribution: "killer" as const,
          }
        : event,
    );

    const result = calculateMatchMetrics(log, CONFIG);

    expectAvailable(result.hookYield.firstEliminationTime, 220_000);
    expectUnavailable(
      result.hookYield.firstHookChainEliminationTime,
      "no_hook_chain_elimination",
    );
  });

  it("底层指标入口拒绝负数结果", () => {
    const log = cloneValidLog();
    log.events.push({
      eventId: "negative-elimination",
      timestampMs: -1,
      eventOrder: 99,
      type: "survivor_outcome",
      survivorId: "survivor-2",
      outcomeType: "killed",
      cause: "invalid_direct_input",
      attribution: "killer",
    });

    const result = calculateMatchMetrics(log, CONFIG);

    expectUnavailable(result.hookYield.firstEliminationTime, "invalid_numeric_result");
  });

  it("接受阈值边界并拒绝无效阈值，不产生 NaN 或 Infinity", () => {
    const boundaryResult = calculateMatchMetrics(cloneValidLog(), {
      highProgressThreshold: 0.75,
    });
    expectAvailable(
      boundaryResult.generatorControl.keyGeneratorInterruptions,
      1,
    );

    const invalidResult = calculateMatchMetrics(cloneValidLog(), {
      highProgressThreshold: Number.NaN,
    });
    expectUnavailable(
      invalidResult.generatorControl.highProgressGeneratorLosses,
      "invalid_high_progress_threshold",
    );
    expectUnavailable(
      invalidResult.generatorControl.keyGeneratorInterruptions,
      "invalid_high_progress_threshold",
    );
    expect(invalidResult.diagnostics).toEqual([
      expect.objectContaining({ code: "invalid_metric_config" }),
    ]);
  });
});
