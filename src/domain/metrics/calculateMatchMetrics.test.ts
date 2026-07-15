import { describe, expect, it } from "vitest";
import { DEFAULT_METRIC_CONFIG } from "../../config/metricThresholds";
import lateFirstElimination from "../../data/samples/late-first-elimination.json";
import validSample from "../../data/samples/valid-base-match.json";
import type { MatchEvent, MatchLog } from "../log";
import { calculateMatchMetrics } from "./calculateMatchMetrics";
import type { MatchMetrics, NumericMetric } from "./types";

function cloneLog(): MatchLog {
  return structuredClone(validSample) as unknown as MatchLog;
}

function calculate(
  log: MatchLog = cloneLog(),
  highProgressThreshold = DEFAULT_METRIC_CONFIG.highProgressThreshold,
): MatchMetrics {
  return calculateMatchMetrics(log, { highProgressThreshold });
}

function expectAvailable(metric: NumericMetric, value: number): void {
  expect(metric.status).toBe("available");
  expect(metric.value).toBe(value);
  expect(Number.isFinite(metric.value)).toBe(true);
}

function expectUnavailable(metric: NumericMetric, reasonCode: string): void {
  expect(metric.status).toBe("unavailable");
  if (metric.status === "unavailable") {
    expect(metric.reason.code).toBe(reasonCode);
    expect(metric.value).toBeNull();
  }
}

function minimalLog(events: MatchEvent[], durationMs: number): MatchLog {
  return {
    schemaVersion: "1.0",
    ruleset: "base_only_1v4_10.0.2",
    patch: "10.0.2",
    matchId: "metric-fixture",
    durationMs,
    survivors: ["survivor-1", "survivor-2", "survivor-3", "survivor-4"],
    generators: [
      "generator-1",
      "generator-2",
      "generator-3",
      "generator-4",
      "generator-5",
      "generator-6",
      "generator-7",
    ],
    unsupportedMechanics: [],
    events,
  };
}

describe("calculateMatchMetrics", () => {
  it("从正式追逐状态计算接敌、首追、控机和减员指标", () => {
    const result = calculate();

    expectAvailable(result.engagement.averageChaseGap, 21_000);
    expectAvailable(result.chase.firstChaseDuration, 48_000);
    expectAvailable(result.chase.firstChaseToFirstDown, 48_000);
    expectAvailable(result.chase.averageChaseDuration, 54_000);
    expectAvailable(result.chase.abandonedChaseCount, 1);
    expectAvailable(result.generatorControl.highProgressGeneratorLosses, 1);
    expectAvailable(result.generatorControl.keyGeneratorInterruptions, 1);
    expectUnavailable(
      result.elimination.firstEliminationGeneratorsRemaining,
      "no_elimination_event",
    );
    expectAvailable(result.elimination.totalEliminations, 0);
  });

  it("首追以 chase_end 结束，不依赖挂钩，并兼容流血减员", () => {
    const result = calculate(
      structuredClone(lateFirstElimination) as unknown as MatchLog,
    );

    expectAvailable(result.chase.firstChaseDuration, 10_000);
    expectAvailable(result.elimination.firstEliminationGeneratorsRemaining, 1);
    expectAvailable(result.elimination.totalEliminations, 1);
  });

  it("乱序输入仍按 timestampMs、eventOrder 和原始位置稳定计算", () => {
    const ordered = calculate();
    const reversed = cloneLog();
    reversed.events.reverse();
    const unordered = calculate(reversed);

    expect(unordered).toEqual(ordered);
  });

  it("未结束或删失的首追不伪装成完整时长", () => {
    const log = cloneLog();
    log.events = log.events.filter(
      (event) => !(event.type === "chase_end" && event.chaseId === "chase-1"),
    );

    const result = calculate(log);

    expectUnavailable(result.chase.firstChaseDuration, "missing_first_chase_end");
    expect(result.chase.averageChaseDuration.value).toBe(60_000);
  });

  it("并发追逐全部结束后才开始计算下一次接敌空窗", () => {
    const events: MatchEvent[] = [
      { eventId: "e-1", timestampMs: 0, eventOrder: 0, type: "trial_start" },
      { eventId: "e-2", timestampMs: 10_000, eventOrder: 1, type: "chase_start", chaseId: "chase-a", survivorId: "survivor-1", source: "game_state" },
      { eventId: "e-3", timestampMs: 15_000, eventOrder: 2, type: "chase_start", chaseId: "chase-b", survivorId: "survivor-2", source: "game_state" },
      { eventId: "e-4", timestampMs: 20_000, eventOrder: 3, type: "chase_end", chaseId: "chase-a", survivorId: "survivor-1", endReason: "target_switch", censored: false, policyGenerated: false },
      { eventId: "e-5", timestampMs: 25_000, eventOrder: 4, type: "chase_end", chaseId: "chase-b", survivorId: "survivor-2", endReason: "target_switch", censored: false, policyGenerated: false },
      { eventId: "e-6", timestampMs: 40_000, eventOrder: 5, type: "chase_start", chaseId: "chase-c", survivorId: "survivor-1", source: "game_state" },
      { eventId: "e-7", timestampMs: 50_000, eventOrder: 6, type: "chase_end", chaseId: "chase-c", survivorId: "survivor-1", endReason: "target_switch", censored: false, policyGenerated: false },
      { eventId: "e-8", timestampMs: 60_000, eventOrder: 7, type: "trial_end", reason: "fixture_complete", normalEnd: true },
    ];

    const result = calculate(minimalLog(events, 60_000));

    expectAvailable(result.engagement.averageChaseGap, 12_500);
    expect(result.engagement.averageChaseGap.evidenceEventIds).toEqual([
      "e-1",
      "e-2",
      "e-5",
      "e-6",
    ]);
  });

  it("同时间戳使用 eventOrder 判断发电机完成是否早于首次减员", () => {
    const baseEvents: MatchEvent[] = [
      { eventId: "same-1", timestampMs: 0, eventOrder: 0, type: "trial_start" },
      { eventId: "same-2", timestampMs: 100_000, eventOrder: 1, type: "generator_completed", generatorId: "generator-1", completionIndex: 1, progress: 1, contributors: ["survivor-2"] },
      { eventId: "same-3", timestampMs: 100_000, eventOrder: 2, type: "survivor_outcome", survivorId: "survivor-1", outcomeType: "bled_out", cause: "bleedout_timer", attribution: "killer" },
      { eventId: "same-4", timestampMs: 120_000, eventOrder: 3, type: "trial_end", reason: "fixture_complete", normalEnd: true },
    ];
    const completedFirst = calculate(minimalLog([...baseEvents].reverse(), 120_000));

    expectAvailable(
      completedFirst.elimination.firstEliminationGeneratorsRemaining,
      4,
    );

    const eliminationFirstEvents = structuredClone(baseEvents);
    eliminationFirstEvents[1].eventOrder = 2;
    eliminationFirstEvents[2].eventOrder = 1;
    const eliminationFirst = calculate(
      minimalLog(eliminationFirstEvents, 120_000),
    );

    expectAvailable(
      eliminationFirst.elimination.firstEliminationGeneratorsRemaining,
      5,
    );
  });

  it("BOT 接管不计为永久减员", () => {
    const log = cloneLog();
    log.events = log.events.filter((event) => event.type !== "survivor_outcome");

    const result = calculate(log);

    expectAvailable(result.elimination.totalEliminations, 0);
    expectUnavailable(
      result.elimination.firstEliminationGeneratorsRemaining,
      "no_elimination_event",
    );
  });

  it("异常结束时不把局部记录当成最终减员总数", () => {
    const log = cloneLog();
    const trialEnd = log.events.find((event) => event.type === "trial_end");
    if (!trialEnd || trialEnd.type !== "trial_end") throw new Error("缺少 trial_end");
    trialEnd.normalEnd = false;
    trialEnd.reason = "abnormal";

    const result = calculate(log);

    expectUnavailable(result.elimination.totalEliminations, "abnormal_trial_end");
  });

  it("缺少阶段进度证据时明确标记高进度指标不可用而不是 0", () => {
    const log = cloneLog();
    log.events = log.events.filter(
      (event) => !event.type.startsWith("generator_") || event.type === "generator_completed",
    );

    const result = calculate(log);

    expectUnavailable(
      result.generatorControl.highProgressGeneratorLosses,
      "no_generator_progress_evidence",
    );
    const losses = result.generatorControl.highProgressGeneratorLosses;
    if (losses.status === "unavailable") {
      expect(losses.reason.message).toContain("不代表损失为 0");
    }
  });

  it("重复事件兜底只使用第一条并返回诊断", () => {
    const log = cloneLog();
    log.events.push({ ...log.events[0] });

    const result = calculate(log);

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "duplicate_event_id_ignored" }),
      ]),
    );
    expectAvailable(result.engagement.averageChaseGap, 21_000);
  });

  it("非法高进度阈值不会产生 NaN 或 Infinity", () => {
    const result = calculate(cloneLog(), Number.POSITIVE_INFINITY);

    expectUnavailable(
      result.generatorControl.highProgressGeneratorLosses,
      "invalid_high_progress_threshold",
    );
    expectUnavailable(
      result.generatorControl.keyGeneratorInterruptions,
      "invalid_high_progress_threshold",
    );
  });

  it("所有可用结果均为非负有限数值", () => {
    const result = calculate(
      structuredClone(lateFirstElimination) as unknown as MatchLog,
    );
    const metrics = [
      ...Object.values(result.engagement),
      ...Object.values(result.chase),
      ...Object.values(result.generatorControl),
      ...Object.values(result.elimination),
    ];

    for (const metric of metrics) {
      if (metric.status === "available") {
        expect(Number.isFinite(metric.value)).toBe(true);
        expect(metric.value).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
