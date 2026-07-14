import { describe, expect, it } from "vitest";
import validSample from "../../data/samples/valid-base-match.json";
import type { MatchLog } from "../log";
import {
  calculateMatchMetrics,
  type AvailableMetric,
  type MatchMetrics,
  type MetricUnavailableReasonCode,
  type MetricUnit,
  type NumericMetric,
} from "../metrics";
import {
  DEFAULT_RULE_ENGINE_CONFIG,
  validateRuleEngineConfig,
} from "./config";
import { evaluateBreakpointRules } from "./evaluateBreakpointRules";
import type { RuleEngineConfig } from "./types";

function baseMetrics(): MatchMetrics {
  const log = structuredClone(validSample) as unknown as MatchLog;
  return calculateMatchMetrics(log, { highProgressThreshold: 0.7 });
}

function available(
  value: number,
  unit: MetricUnit,
  sampleSize: number,
  eventId: string,
  confidence = 1,
): AvailableMetric {
  return {
    status: "available",
    value,
    unit,
    explanation: "规则引擎测试指标。",
    evidenceEventIds: [eventId],
    sampleSize,
    confidence,
  };
}

function unavailable(
  reasonCode: MetricUnavailableReasonCode,
  eventId: string,
): NumericMetric {
  return {
    status: "unavailable",
    value: null,
    unit: "milliseconds",
    explanation: "规则引擎测试不可用指标。",
    evidenceEventIds: [eventId],
    sampleSize: 0,
    reason: {
      code: reasonCode,
      message: "测试指标不可用。",
    },
  };
}

function cloneConfig(): RuleEngineConfig {
  return structuredClone(DEFAULT_RULE_ENGINE_CONFIG);
}

describe("规则配置", () => {
  it("默认 rules.json 通过运行时配置校验", () => {
    const result = validateRuleEngineConfig(DEFAULT_RULE_ENGINE_CONFIG);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data?.maxDisplayedMetrics).toBe(3);
    expect(result.data?.prototypeThresholdNotice).toContain("原型待验证");
  });

  it("拒绝越界阈值和不完整优先级", () => {
    const config = cloneConfig();
    config.rules.FIRST_CHASE_TOO_LONG.thresholdMs = -1;
    config.priorityByExperience.novice = ["FIRST_CHASE_TOO_LONG"];

    const result = validateRuleEngineConfig(config);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("thresholdMs"),
        expect.stringContaining("priorityByExperience.novice"),
      ]),
    );
  });
});

describe("evaluateBreakpointRules", () => {
  it("触发 FIRST_CHASE_TOO_LONG 并返回解释和证据", () => {
    const metrics = baseMetrics();
    metrics.chase.firstChaseToFirstHook = available(
      80_000,
      "milliseconds",
      1,
      "first-hook-evidence",
    );

    const result = evaluateBreakpointRules(metrics, {
      playerExperience: "novice",
    });

    expect(result.primaryFeedback.ruleId).toBe("FIRST_CHASE_TOO_LONG");
    expect(result.primaryFeedback.severity).toBe("moderate");
    expect(result.primaryFeedback.evidenceEventIds).toEqual([
      "first-hook-evidence",
    ]);
    expect(result.primaryFeedback.triggeredMetricIds).toEqual([
      "chase.firstChaseToFirstHook",
    ]);
    expect(result.primaryFeedback.practiceGoal).toContain("强资源区");
    expect(result.prototypeThresholdNotice).toContain("原型待验证");
  });

  it("严格遵守大于边界，等于 75 秒时不触发首追规则", () => {
    const metrics = baseMetrics();
    metrics.chase.firstChaseToFirstHook = available(
      75_000,
      "milliseconds",
      1,
      "boundary-event",
    );

    const result = evaluateBreakpointRules(metrics, {
      playerExperience: "novice",
    });

    expect(result.primaryFeedback.ruleId).toBe("no_clear_breakpoint");
    expect(result.triggeredCandidates).toEqual([]);
  });

  it("分别触发找人和控机规则，并遵守各自比较运算符", () => {
    const searchMetrics = baseMetrics();
    searchMetrics.finding.averageSearchGap = available(
      30_001,
      "milliseconds",
      2,
      "search-gap-evidence",
    );
    const searchResult = evaluateBreakpointRules(searchMetrics, {
      playerExperience: "novice",
    });

    expect(searchResult.primaryFeedback.ruleId).toBe("SEARCH_GAP_TOO_LONG");

    const generatorMetrics = baseMetrics();
    generatorMetrics.generatorControl.highProgressGeneratorLosses = available(
      2,
      "count",
      2,
      "generator-loss-evidence",
    );
    const generatorResult = evaluateBreakpointRules(generatorMetrics, {
      playerExperience: "intermediate",
    });

    expect(generatorResult.primaryFeedback.ruleId).toBe(
      "GENERATOR_CONTROL_WEAK",
    );
  });

  it("在挂钩数、转化机会和减员条件同时满足时触发挂钩压力规则", () => {
    const metrics = baseMetrics();
    metrics.hookYield.totalHooks = available(
      4,
      "count",
      4,
      "total-hooks-evidence",
    );
    metrics.hookYield.secondHookConversions = available(
      0,
      "count",
      2,
      "conversion-evidence",
    );

    const result = evaluateBreakpointRules(metrics, {
      playerExperience: "intermediate",
    });

    expect(result.primaryFeedback.ruleId).toBe("HOOK_PRESSURE_DIFFUSE");
    expect(result.primaryFeedback.severity).toBe("high");
    expect(result.primaryFeedback.triggeredMetricIds).toEqual([
      "hookYield.totalHooks",
      "hookYield.secondHookConversions",
      "hookYield.firstHookChainEliminationTime",
    ]);
    expect(result.primaryFeedback.evidence).toHaveLength(3);
    expect(result.primaryFeedback.evidence[2]).toEqual(
      expect.objectContaining({
        status: "unavailable",
        unavailableReasonCode: "no_hook_chain_elimination",
      }),
    );
  });

  it("有减员时仅在严格晚于配置阈值后触发挂钩压力规则", () => {
    const atBoundaryMetrics = baseMetrics();
    atBoundaryMetrics.hookYield.totalHooks = available(
      4,
      "count",
      4,
      "total-hooks-evidence",
    );
    atBoundaryMetrics.hookYield.secondHookConversions = available(
      0,
      "count",
      1,
      "conversion-evidence",
    );
    atBoundaryMetrics.hookYield.firstHookChainEliminationTime = available(
      300_000,
      "milliseconds",
      1,
      "elimination-evidence",
    );

    const atBoundary = evaluateBreakpointRules(atBoundaryMetrics, {
      playerExperience: "intermediate",
    });
    expect(atBoundary.primaryFeedback.ruleId).toBe("no_clear_breakpoint");

    const lateMetrics = structuredClone(atBoundaryMetrics);
    lateMetrics.hookYield.firstHookChainEliminationTime = available(
      300_001,
      "milliseconds",
      1,
      "late-elimination-evidence",
    );
    const late = evaluateBreakpointRules(lateMetrics, {
      playerExperience: "intermediate",
    });
    expect(late.primaryFeedback.ruleId).toBe("HOOK_PRESSURE_DIFFUSE");
  });

  it("缺少计时起点导致的减员指标不可用，不等同于本局没有减员", () => {
    const metrics = baseMetrics();
    metrics.hookYield.totalHooks = available(
      4,
      "count",
      4,
      "total-hooks-evidence",
    );
    metrics.hookYield.secondHookConversions = available(
      0,
      "count",
      1,
      "conversion-evidence",
    );
    metrics.hookYield.firstHookChainEliminationTime = unavailable(
      "missing_trial_start",
      "missing-trial-start",
    );

    const result = evaluateBreakpointRules(metrics, {
      playerExperience: "intermediate",
    });

    expect(result.primaryFeedback.ruleId).toBe("no_clear_breakpoint");
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        ruleId: "HOOK_PRESSURE_DIFFUSE",
        metricIds: ["hookYield.firstHookChainEliminationTime"],
      }),
    ]);
  });

  it("挂钩转化机会样本不足时不触发，避免用零值强行归因", () => {
    const metrics = baseMetrics();
    metrics.hookYield.totalHooks = available(
      4,
      "count",
      4,
      "total-hooks-evidence",
    );
    metrics.hookYield.secondHookConversions = available(
      0,
      "count",
      0,
      "no-opportunity-evidence",
    );

    const result = evaluateBreakpointRules(metrics, {
      playerExperience: "intermediate",
    });

    expect(result.primaryFeedback.ruleId).toBe("no_clear_breakpoint");
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "metric_unavailable",
        ruleId: "HOOK_PRESSURE_DIFFUSE",
        metricIds: ["hookYield.secondHookConversions"],
      }),
    ]);
  });

  it("指标不可用时不触发对应规则，并返回诊断", () => {
    const metrics = baseMetrics();
    metrics.chase.firstChaseToFirstHook = unavailable(
      "missing_first_hook",
      "missing-hook-evidence",
    );

    const result = evaluateBreakpointRules(metrics, {
      playerExperience: "novice",
    });

    expect(result.primaryFeedback.ruleId).toBe("no_clear_breakpoint");
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "metric_unavailable",
        ruleId: "FIRST_CHASE_TOO_LONG",
      }),
    ]);
  });

  it("没有规则触发时确定性返回 no_clear_breakpoint", () => {
    const metrics = baseMetrics();

    const first = evaluateBreakpointRules(metrics, {
      playerExperience: "novice",
    });
    const second = evaluateBreakpointRules(metrics, {
      playerExperience: "novice",
    });

    expect(first).toEqual(second);
    expect(first.primaryFeedback).toEqual(
      expect.objectContaining({
        ruleId: "no_clear_breakpoint",
        severity: "none",
        triggeredMetricIds: [],
      }),
    );
  });

  it("证据充分性相同时按相对阈值偏离选择主要断点", () => {
    const metrics = baseMetrics();
    metrics.chase.firstChaseToFirstHook = available(
      82_500,
      "milliseconds",
      1,
      "first-hook-evidence",
    );
    metrics.finding.averageSearchGap = available(
      60_000,
      "milliseconds",
      1,
      "search-gap-evidence",
    );

    const result = evaluateBreakpointRules(metrics, {
      playerExperience: "novice",
    });

    expect(result.primaryFeedback.ruleId).toBe("SEARCH_GAP_TOO_LONG");
    expect(result.triggeredCandidates.map((candidate) => candidate.ruleId)).toEqual(
      ["SEARCH_GAP_TOO_LONG", "FIRST_CHASE_TOO_LONG"],
    );
  });

  it("证据、偏离和置信度并列时按可配置经验优先级选择唯一主反馈", () => {
    const config = cloneConfig();
    config.rules.GENERATOR_CONTROL_WEAK.minimumLosses = 5;
    const metrics = baseMetrics();
    metrics.chase.firstChaseToFirstHook = available(
      90_000,
      "milliseconds",
      1,
      "first-hook-evidence",
    );
    metrics.generatorControl.highProgressGeneratorLosses = available(
      6,
      "count",
      1,
      "generator-loss-evidence",
    );

    const noviceResult = evaluateBreakpointRules(
      metrics,
      { playerExperience: "novice" },
      config,
    );
    const intermediateResult = evaluateBreakpointRules(
      metrics,
      { playerExperience: "intermediate" },
      config,
    );

    expect(noviceResult.primaryFeedback.ruleId).toBe("FIRST_CHASE_TOO_LONG");
    expect(intermediateResult.primaryFeedback.ruleId).toBe(
      "GENERATOR_CONTROL_WEAK",
    );
  });

  it("人工事件置信度优先于同等偏离下的玩家阶段顺序", () => {
    const config = cloneConfig();
    config.priorityByExperience.novice = [
      "SEARCH_GAP_TOO_LONG",
      "FIRST_CHASE_TOO_LONG",
      "GENERATOR_CONTROL_WEAK",
      "HOOK_PRESSURE_DIFFUSE",
    ];
    const metrics = baseMetrics();
    metrics.chase.firstChaseToFirstHook = available(
      90_000,
      "milliseconds",
      1,
      "first-hook-evidence",
      1,
    );
    metrics.finding.averageSearchGap = available(
      36_000,
      "milliseconds",
      1,
      "uncertain-search-evidence",
      0.5,
    );

    const result = evaluateBreakpointRules(
      metrics,
      { playerExperience: "novice" },
      config,
    );

    expect(result.primaryFeedback.ruleId).toBe("FIRST_CHASE_TOO_LONG");
  });

  it("处决或流血减员不会替代普通挂钩链减员条件", () => {
    const metrics = baseMetrics();
    metrics.hookYield.totalHooks = available(4, "count", 4, "hooks");
    metrics.hookYield.secondHookConversions = available(0, "count", 2, "conversions");
    metrics.hookYield.firstEliminationTime = available(120_000, "milliseconds", 1, "mori");
    metrics.hookYield.firstHookChainEliminationTime = unavailable(
      "no_hook_chain_elimination",
      "no-hook-chain",
    );

    const result = evaluateBreakpointRules(metrics, {
      playerExperience: "intermediate",
    });

    expect(result.primaryFeedback.ruleId).toBe("HOOK_PRESSURE_DIFFUSE");
    expect(result.primaryFeedback.triggeredMetricIds).toContain(
      "hookYield.firstHookChainEliminationTime",
    );
  });

  it("无效规则配置不会进入引擎或产生强制归因", () => {
    const config = cloneConfig();
    config.maxDisplayedMetrics = 4;

    const result = evaluateBreakpointRules(
      baseMetrics(),
      { playerExperience: "novice" },
      config,
    );

    expect(result.primaryFeedback.ruleId).toBe("no_clear_breakpoint");
    expect(result.triggeredCandidates).toEqual([]);
    expect(result.diagnostics[0]).toEqual(
      expect.objectContaining({ code: "invalid_rule_config" }),
    );
  });
});
