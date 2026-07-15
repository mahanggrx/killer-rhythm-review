import { describe, expect, it } from "vitest";
import type {
  MatchMetrics,
  MetricUnavailableReasonCode,
  NumericMetric,
} from "../metrics";
import { DEFAULT_RULE_ENGINE_CONFIG, validateRuleEngineConfig } from "./config";
import { evaluateBreakpointRules } from "./evaluateBreakpointRules";
import type { RuleEngineConfig } from "./types";

function available(
  value: number,
  unit: NumericMetric["unit"] = "milliseconds",
  sampleSize = 1,
  evidenceEventIds: string[] = ["evidence"],
): NumericMetric {
  return {
    status: "available",
    value,
    unit,
    explanation: "测试指标",
    evidenceEventIds,
    sampleSize,
    confidence: 1,
  };
}

function unavailable(
  code: MetricUnavailableReasonCode,
  unit: NumericMetric["unit"] = "milliseconds",
): NumericMetric {
  return {
    status: "unavailable",
    value: null,
    unit,
    explanation: "测试不可用指标",
    evidenceEventIds: [],
    sampleSize: 0,
    reason: { code, message: "测试不可用原因" },
  };
}

function baseMetrics(): MatchMetrics {
  return {
    engagement: {
      averageChaseGap: available(17_500, "milliseconds", 2),
    },
    chase: {
      firstChaseDuration: available(30_000),
      firstChaseToFirstDown: available(30_000),
      averageChaseDuration: available(30_000, "milliseconds", 2),
      abandonedChaseCount: available(0, "count", 2),
    },
    generatorControl: {
      highProgressGeneratorLosses: available(0, "count"),
      keyGeneratorInterruptions: available(1, "count"),
    },
    elimination: {
      firstEliminationGeneratorsRemaining: available(3, "count"),
      totalEliminations: available(1, "count"),
    },
    diagnostics: [],
  };
}

function evaluate(
  metrics: MatchMetrics,
  config: RuleEngineConfig = structuredClone(DEFAULT_RULE_ENGINE_CONFIG),
) {
  return evaluateBreakpointRules(metrics, config);
}

describe("validateRuleEngineConfig", () => {
  it("接受包含三条新口径规则的默认配置", () => {
    const result = validateRuleEngineConfig(DEFAULT_RULE_ENGINE_CONFIG);

    expect(result.ok).toBe(true);
    expect(result.data?.priority).toHaveLength(3);
  });

  it("拒绝非法阈值和缺失规则优先级", () => {
    const config = structuredClone(DEFAULT_RULE_ENGINE_CONFIG) as unknown as {
      rules: Record<string, Record<string, unknown>>;
      priority: string[];
    };
    config.rules.FIRST_CHASE_TOO_LONG.thresholdMs = -1;
    config.rules.LATE_FIRST_ELIMINATION.maximumGeneratorsRemaining = 6;
    config.priority = ["FIRST_CHASE_TOO_LONG"];

    const result = validateRuleEngineConfig(config);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("thresholdMs");
    expect(result.errors.join(" ")).toContain("maximumGeneratorsRemaining");
    expect(result.errors.join(" ")).toContain("全部三个规则");
  });
});

describe("evaluateBreakpointRules", () => {
  it("没有规则越过阈值时返回 no_clear_breakpoint", () => {
    const result = evaluate(baseMetrics());

    expect(result.primaryFeedback.ruleId).toBe("no_clear_breakpoint");
    expect(result.triggeredCandidates).toEqual([]);
  });

  it("使用首次 chase_start 到匹配 chase_end 的时长触发首追规则", () => {
    const metrics = baseMetrics();
    metrics.chase.firstChaseDuration = available(
      78_000,
      "milliseconds",
      1,
      ["chase-start", "chase-end"],
    );

    const result = evaluate(metrics);

    expect(result.primaryFeedback.ruleId).toBe("FIRST_CHASE_TOO_LONG");
    expect(result.primaryFeedback.triggeredMetricIds).toEqual([
      "chase.firstChaseDuration",
    ]);
    expect(result.primaryFeedback.evidenceEventIds).toEqual([
      "chase-start",
      "chase-end",
    ]);
  });

  it("首追恰好等于阈值时不触发", () => {
    const metrics = baseMetrics();
    metrics.chase.firstChaseDuration = available(75_000);

    expect(evaluate(metrics).primaryFeedback.ruleId).toBe(
      "no_clear_breakpoint",
    );
  });

  it("平均追逐空窗过长时触发接敌空窗规则", () => {
    const metrics = baseMetrics();
    metrics.engagement.averageChaseGap = available(50_000, "milliseconds", 3);

    const result = evaluate(metrics);

    expect(result.primaryFeedback.ruleId).toBe("ENGAGEMENT_GAP_TOO_LONG");
    expect(result.primaryFeedback.triggeredMetricIds).toEqual([
      "engagement.averageChaseGap",
    ]);
  });

  it("平均追逐空窗恰好等于阈值时不触发", () => {
    const metrics = baseMetrics();
    metrics.engagement.averageChaseGap = available(30_000, "milliseconds", 2);

    expect(evaluate(metrics).primaryFeedback.ruleId).toBe("no_clear_breakpoint");
  });

  it("首次减员时剩余修理目标不高于阈值时触发减员规则", () => {
    const metrics = baseMetrics();
    metrics.elimination.firstEliminationGeneratorsRemaining = available(
      1,
      "count",
      1,
      ["gen-1", "gen-2", "gen-3", "gen-4", "elimination"],
    );

    const result = evaluate(metrics);

    expect(result.primaryFeedback.ruleId).toBe("LATE_FIRST_ELIMINATION");
    expect(result.primaryFeedback.triggeredMetricIds).toEqual([
      "elimination.firstEliminationGeneratorsRemaining",
    ]);
    expect(result.primaryFeedback.practiceGoal).not.toMatch(/针对|守尸/);
  });

  it("首次减员时仍剩两台修理目标不触发默认规则", () => {
    const metrics = baseMetrics();
    metrics.elimination.firstEliminationGeneratorsRemaining = available(2, "count");

    expect(evaluate(metrics).primaryFeedback.ruleId).toBe(
      "no_clear_breakpoint",
    );
  });

  it("正常结束且没有永久减员时以最终结果触发减员规则", () => {
    const metrics = baseMetrics();
    metrics.elimination.firstEliminationGeneratorsRemaining = unavailable(
      "no_elimination_event",
      "count",
    );
    metrics.elimination.totalEliminations = available(
      0,
      "count",
      1,
      ["trial-end"],
    );

    const result = evaluate(metrics);

    expect(result.primaryFeedback.ruleId).toBe("LATE_FIRST_ELIMINATION");
    expect(result.primaryFeedback.triggeredMetricIds).toEqual([
      "elimination.totalEliminations",
    ]);
  });

  it("异常结束且没有减员证据时不强行归因", () => {
    const metrics = baseMetrics();
    metrics.elimination.firstEliminationGeneratorsRemaining = unavailable(
      "no_elimination_event",
      "count",
    );
    metrics.elimination.totalEliminations = unavailable(
      "abnormal_trial_end",
      "count",
    );

    const result = evaluate(metrics);

    expect(result.primaryFeedback.ruleId).toBe("no_clear_breakpoint");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "LATE_FIRST_ELIMINATION" }),
      ]),
    );
  });

  it("规则关闭后不参与候选", () => {
    const metrics = baseMetrics();
    metrics.chase.firstChaseDuration = available(100_000);
    const config = structuredClone(DEFAULT_RULE_ENGINE_CONFIG);
    config.rules.FIRST_CHASE_TOO_LONG.enabled = false;

    expect(evaluate(metrics, config).primaryFeedback.ruleId).toBe(
      "no_clear_breakpoint",
    );
  });

  it("指标不可用或样本不足时返回诊断而不触发", () => {
    const metrics = baseMetrics();
    metrics.chase.firstChaseDuration = unavailable("missing_first_chase_end");
    metrics.engagement.averageChaseGap = available(60_000, "milliseconds", 0);

    const result = evaluate(metrics);

    expect(result.primaryFeedback.ruleId).toBe("no_clear_breakpoint");
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(2);
  });

  it("同等证据和偏离下按单一固定优先级确定唯一结果", () => {
    const metrics = baseMetrics();
    metrics.chase.firstChaseDuration = available(150_000);
    metrics.engagement.averageChaseGap = available(60_000);
    metrics.elimination.firstEliminationGeneratorsRemaining = available(0, "count");

    expect(evaluate(metrics).primaryFeedback.ruleId).toBe("FIRST_CHASE_TOO_LONG");
  });

  it("相同输入重复计算得到完全相同的排序", () => {
    const metrics = baseMetrics();
    metrics.chase.firstChaseDuration = available(100_000);
    metrics.engagement.averageChaseGap = available(50_000);

    expect(evaluate(metrics)).toEqual(evaluate(metrics));
  });

  it("无效配置安全返回 no_clear_breakpoint", () => {
    const config = structuredClone(DEFAULT_RULE_ENGINE_CONFIG) as unknown as {
      rules: { FIRST_CHASE_TOO_LONG: { thresholdMs: number } };
    };
    config.rules.FIRST_CHASE_TOO_LONG.thresholdMs = Number.NaN;

    const result = evaluateBreakpointRules(
      baseMetrics(),
      config,
    );

    expect(result.primaryFeedback.ruleId).toBe("no_clear_breakpoint");
    expect(result.diagnostics[0].code).toBe("invalid_rule_config");
  });
});
