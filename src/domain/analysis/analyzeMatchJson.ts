import { parseMatchLogJson } from "../log";
import { calculateMatchMetrics, type MetricConfig } from "../metrics";
import {
  evaluateBreakpointRules,
  type PlayerExperience,
  type RuleEngineConfig,
} from "../rules";
import { buildEventTimeline } from "../timeline";
import { buildAnalysisPresentation } from "./buildAnalysisPresentation";
import type { AnalysisResult } from "./types";

export interface AnalyzeMatchOptions {
  metricConfig: Readonly<MetricConfig>;
  ruleConfig: Readonly<RuleEngineConfig>;
  playerExperience: PlayerExperience;
}

export function analyzeMatchJson(
  source: string,
  options: AnalyzeMatchOptions,
): AnalysisResult {
  const validation = parseMatchLogJson(source);

  if (!validation.ok || validation.data === null) {
    return {
      status: "invalid",
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  const metrics = calculateMatchMetrics(validation.data, options.metricConfig);
  const rules = evaluateBreakpointRules(
    metrics,
    { playerExperience: options.playerExperience },
    options.ruleConfig,
  );
  const presentation = buildAnalysisPresentation(
    metrics,
    rules,
    options.metricConfig,
    options.ruleConfig,
  );

  return {
    status: "ready",
    log: validation.data,
    errors: [],
    warnings: validation.warnings,
    metrics,
    rules,
    presentation,
    timeline: buildEventTimeline(
      validation.data,
      presentation.feedback.evidenceEventIds,
    ),
  };
}
