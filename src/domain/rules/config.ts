import rawRuleConfig from "../../config/rules.json";
import {
  RULE_IDS,
  type RuleConfigValidationResult,
  type RuleEngineConfig,
  type RuleId,
} from "./types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function requirePositiveNumber(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (!isFiniteNumber(value) || value <= 0) {
    errors.push(`${path} 必须是大于 0 的有限数值。`);
  }
}

function requireNonNegativeNumber(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (!isFiniteNumber(value) || value < 0) {
    errors.push(`${path} 必须是非负有限数值。`);
  }
}

function requirePositiveInteger(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (!Number.isInteger(value) || !isFiniteNumber(value) || value < 1) {
    errors.push(`${path} 必须是正整数。`);
  }
}

function requireIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
  path: string,
  errors: string[],
): void {
  if (
    !Number.isInteger(value)
    || !isFiniteNumber(value)
    || value < minimum
    || value > maximum
  ) {
    errors.push(`${path} 必须是 ${minimum} 到 ${maximum} 之间的整数。`);
  }
}

function validateSeverityFields(
  rule: UnknownRecord,
  path: string,
  errors: string[],
): void {
  requireNonNegativeNumber(rule.baseSeverity, `${path}.baseSeverity`, errors);
  requireNonNegativeNumber(
    rule.deviationWeight,
    `${path}.deviationWeight`,
    errors,
  );

  if (
    !isFiniteNumber(rule.confidence) ||
    rule.confidence < 0 ||
    rule.confidence > 1
  ) {
    errors.push(`${path}.confidence 必须是 0 到 1 之间的有限数值。`);
  }
}

function validateRuleRecord(
  rules: UnknownRecord,
  ruleId: RuleId,
  errors: string[],
): UnknownRecord | null {
  const rule = rules[ruleId];
  const path = `rules.${ruleId}`;

  if (!isRecord(rule)) {
    errors.push(`${path} 必须是对象。`);
    return null;
  }

  if (typeof rule.enabled !== "boolean") {
    errors.push(`${path}.enabled 必须是布尔值。`);
  }

  validateSeverityFields(rule, path, errors);
  return rule;
}

function validatePriority(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (!Array.isArray(value)) {
    errors.push(`${path} 必须是规则 ID 数组。`);
    return;
  }

  const uniqueValues = new Set(value);
  const isExactRuleSet =
    value.length === RULE_IDS.length &&
    uniqueValues.size === RULE_IDS.length &&
    RULE_IDS.every((ruleId) => uniqueValues.has(ruleId));

  if (!isExactRuleSet) {
    errors.push(`${path} 必须且只能包含全部三个规则 ID 各一次。`);
  }
}

export function validateRuleEngineConfig(
  input: unknown,
): RuleConfigValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return {
      ok: false,
      data: null,
      errors: ["规则配置根节点必须是对象。"],
    };
  }

  if (typeof input.version !== "string" || input.version.length === 0) {
    errors.push("version 必须是非空字符串。");
  }

  if (input.ruleset !== "base_only_1v4_10.0.2") {
    errors.push("ruleset 必须是 base_only_1v4_10.0.2。");
  }

  if (
    typeof input.prototypeThresholdNotice !== "string" ||
    input.prototypeThresholdNotice.length === 0
  ) {
    errors.push("prototypeThresholdNotice 必须是非空字符串。");
  }

  if (
    !Number.isInteger(input.maxDisplayedMetrics) ||
    !isFiniteNumber(input.maxDisplayedMetrics) ||
    input.maxDisplayedMetrics < 1 ||
    input.maxDisplayedMetrics > 3
  ) {
    errors.push("maxDisplayedMetrics 必须是 1 到 3 之间的整数。");
  }

  if (!isRecord(input.severityBands)) {
    errors.push("severityBands 必须是对象。");
  } else {
    requireNonNegativeNumber(
      input.severityBands.highMinScore,
      "severityBands.highMinScore",
      errors,
    );
    requirePositiveNumber(
      input.severityBands.criticalMinScore,
      "severityBands.criticalMinScore",
      errors,
    );

    if (
      isFiniteNumber(input.severityBands.highMinScore) &&
      isFiniteNumber(input.severityBands.criticalMinScore) &&
      input.severityBands.criticalMinScore <=
        input.severityBands.highMinScore
    ) {
      errors.push("criticalMinScore 必须大于 highMinScore。");
    }
  }

  validatePriority(input.priority, "priority", errors);

  if (!isRecord(input.rules)) {
    errors.push("rules 必须是对象。");
  } else {
    const firstChaseStartRule = validateRuleRecord(
      input.rules,
      "FIRST_CHASE_START_TOO_LATE",
      errors,
    );
    const eliminationRule = validateRuleRecord(
      input.rules,
      "LATE_FIRST_ELIMINATION",
      errors,
    );
    const averageChaseRule = validateRuleRecord(
      input.rules,
      "AVERAGE_CHASE_TOO_LONG",
      errors,
    );

    if (firstChaseStartRule) {
      requirePositiveNumber(
        firstChaseStartRule.thresholdMs,
        "rules.FIRST_CHASE_START_TOO_LATE.thresholdMs",
        errors,
      );
      requirePositiveInteger(
        firstChaseStartRule.minimumSampleSize,
        "rules.FIRST_CHASE_START_TOO_LATE.minimumSampleSize",
        errors,
      );
    }

    if (averageChaseRule) {
      requirePositiveNumber(
        averageChaseRule.thresholdMs,
        "rules.AVERAGE_CHASE_TOO_LONG.thresholdMs",
        errors,
      );
      requirePositiveInteger(
        averageChaseRule.minimumSampleSize,
        "rules.AVERAGE_CHASE_TOO_LONG.minimumSampleSize",
        errors,
      );
    }

    if (eliminationRule) {
      requireIntegerInRange(
        eliminationRule.maximumGeneratorsRemaining,
        0,
        5,
        "rules.LATE_FIRST_ELIMINATION.maximumGeneratorsRemaining",
        errors,
      );
      requirePositiveInteger(
        eliminationRule.minimumSampleSize,
        "rules.LATE_FIRST_ELIMINATION.minimumSampleSize",
        errors,
      );
      requireNonNegativeNumber(
        eliminationRule.noEliminationRelativeDeviation,
        "rules.LATE_FIRST_ELIMINATION.noEliminationRelativeDeviation",
        errors,
      );
    }
  }

  return {
    ok: errors.length === 0,
    data: errors.length === 0 ? (input as unknown as RuleEngineConfig) : null,
    errors,
  };
}

const defaultConfigValidation = validateRuleEngineConfig(rawRuleConfig);

if (!defaultConfigValidation.ok || defaultConfigValidation.data === null) {
  throw new Error(
    `默认规则配置无效：${defaultConfigValidation.errors.join("；")}`,
  );
}

export const DEFAULT_RULE_ENGINE_CONFIG = defaultConfigValidation.data;
