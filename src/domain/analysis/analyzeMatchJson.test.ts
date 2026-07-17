import { describe, expect, it } from "vitest";
import { DEFAULT_METRIC_CONFIG } from "../../config/metricThresholds";
import { PRESET_MATCHES } from "../../data/presets";
import { DEFAULT_RULE_ENGINE_CONFIG, type RuleEngineConfig } from "../rules";
import { analyzeMatchJson } from "./analyzeMatchJson";

function analyze(source: string, ruleConfig: RuleEngineConfig = structuredClone(DEFAULT_RULE_ENGINE_CONFIG)) {
  return analyzeMatchJson(source, {
    metricConfig: DEFAULT_METRIC_CONFIG,
    ruleConfig,
  });
}

describe("analyzeMatchJson", () => {
  it.each(PRESET_MATCHES)("样例 $label 产生人工预期的唯一主断点", (preset) => {
    const result = analyze(preset.source);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(result.rules.primaryFeedback.ruleId).toBe(preset.expectedPrimaryRuleId);
    expect(result.presentation.keyMetrics.length).toBeLessThanOrEqual(3);
    expect(result.timeline.every((item, index, items) => index === 0 || item.timestampMs >= items[index - 1].timestampMs)).toBe(true);
    const timelineEvidence = new Set(
      result.timeline.filter((item) => item.isEvidence).map((item) => item.eventId),
    );
    expect(result.rules.primaryFeedback.evidenceEventIds.every((eventId) => timelineEvidence.has(eventId))).toBe(true);
  });

  it("三份样例的核心指标与人工计算一致", () => {
    const firstChaseStart = analyze(PRESET_MATCHES[0].source);
    const averageChase = analyze(PRESET_MATCHES[1].source);
    const lateElimination = analyze(PRESET_MATCHES[2].source);

    expect(firstChaseStart.status).toBe("ready");
    expect(averageChase.status).toBe("ready");
    expect(lateElimination.status).toBe("ready");
    if (firstChaseStart.status !== "ready" || averageChase.status !== "ready" || lateElimination.status !== "ready") return;

    expect(firstChaseStart.metrics.engagement.firstChaseStartTime.value).toBe(50_000);
    expect(firstChaseStart.metrics.chase.averageChaseDuration.value).toBe(20_000);
    expect(firstChaseStart.metrics.elimination.firstEliminationGeneratorsRemaining.value).toBe(2);

    expect(averageChase.metrics.engagement.firstChaseStartTime.value).toBe(20_000);
    expect(averageChase.metrics.chase.averageChaseDuration.value).toBe(55_000);
    expect(averageChase.metrics.elimination.firstEliminationGeneratorsRemaining.value).toBe(2);

    expect(lateElimination.metrics.elimination.firstEliminationGeneratorsRemaining.value).toBe(1);
    expect(lateElimination.metrics.elimination.totalEliminations.value).toBe(1);
    expect(lateElimination.metrics.generatorControl.highProgressGeneratorLosses.value).toBe(4);
  });

  it("阈值变化后通过同一入口实时得到 no_clear_breakpoint", () => {
    const config = structuredClone(DEFAULT_RULE_ENGINE_CONFIG);
    config.rules.FIRST_CHASE_START_TOO_LATE.thresholdMs = 100_000;

    const result = analyze(PRESET_MATCHES[0].source, config);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.rules.primaryFeedback.ruleId).toBe("no_clear_breakpoint");
  });

  it("损坏 JSON 返回可展示错误而不抛出异常", () => {
    const result = analyze("{ invalid json");

    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") return;
    expect(result.errors[0].code).toBe("JSON_PARSE_ERROR");
  });

  it("为主断点证据标记可追溯时间线节点", () => {
    const result = analyze(PRESET_MATCHES[0].source);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.timeline.filter((item) => item.isEvidence).map((item) => item.eventId)).toEqual([
      "fs-001",
      "fs-004",
    ]);
  });
});
