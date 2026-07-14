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
    errors.push(`${path} 必须且只能包含全部四个规则 ID 各一次。`);
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

  if (!isRecord(input.priorityByExperience)) {
    errors.push("priorityByExperience 必须是对象。");
  } else {
    validatePriority(
      input.priorityByExperience.novice,
      "priorityByExperience.novice",
      errors,
    );
    validatePriority(
      input.priorityByExperience.intermediate,
      "priorityByExperience.intermediate",
      errors,
    );
  }

  if (!isRecord(input.rules)) {
    errors.push("rules 必须是对象。");
  } else {
    const firstChaseRule = validateRuleRecord(
      input.rules,
      "FIRST_CHASE_TOO_LONG",
      errors,
    );
    const searchRule = validateRuleRecord(
      input.rules,
      "SEARCH_GAP_TOO_LONG",
      errors,
    );
    const generatorRule = validateRuleRecord(
      input.rules,
      "GENERATOR_CONTROL_WEAK",
      errors,
    );
    const hookRule = validateRuleRecord(
      input.rules,
      "HOOK_PRESSURE_DIFFUSE",
      errors,
    );

    if (firstChaseRule) {
      requirePositiveNumber(
        firstChaseRule.thresholdMs,
        "rules.FIRST_CHASE_TOO_LONG.thresholdMs",
        errors,
      );
      requirePositiveInteger(
        firstChaseRule.minimumSampleSize,
        "rules.FIRST_CHASE_TOO_LONG.minimumSampleSize",
        errors,
      );
    }

    if (searchRule) {
      requirePositiveNumber(
        searchRule.thresholdMs,
        "rules.SEARCH_GAP_TOO_LONG.thresholdMs",
        errors,
      );
      requirePositiveInteger(
        searchRule.minimumSampleSize,
        "rules.SEARCH_GAP_TOO_LONG.minimumSampleSize",
        errors,
      );
    }

    if (generatorRule) {
      requirePositiveInteger(
        generatorRule.minimumLosses,
        "rules.GENERATOR_CONTROL_WEAK.minimumLosses",
        errors,
      );
      requirePositiveInteger(
        generatorRule.minimumSampleSize,
        "rules.GENERATOR_CONTROL_WEAK.minimumSampleSize",
        errors,
      );
    }

    if (hookRule) {
      requirePositiveInteger(
        hookRule.minimumTotalHooks,
        "rules.HOOK_PRESSURE_DIFFUSE.minimumTotalHooks",
        errors,
      );
      requirePositiveInteger(
        hookRule.maximumSecondHookConversionsExclusive,
        "rules.HOOK_PRESSURE_DIFFUSE.maximumSecondHookConversionsExclusive",
        errors,
      );
      requirePositiveInteger(
        hookRule.minimumConversionOpportunities,
        "rules.HOOK_PRESSURE_DIFFUSE.minimumConversionOpportunities",
        errors,
      );
      requirePositiveNumber(
        hookRule.lateEliminationThresholdMs,
        "rules.HOOK_PRESSURE_DIFFUSE.lateEliminationThresholdMs",
        errors,
      );
      requireNonNegativeNumber(
        hookRule.noEliminationRelativeDeviation,
        "rules.HOOK_PRESSURE_DIFFUSE.noEliminationRelativeDeviation",
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
