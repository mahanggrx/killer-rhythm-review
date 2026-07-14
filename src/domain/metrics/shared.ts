import type { MatchEvent } from "../log";
import type {
  AvailableMetric,
  MetricDiagnostic,
  MetricUnit,
  MetricUnavailableReasonCode,
  NumericMetric,
  UnavailableMetric,
} from "./types";

export interface CanonicalEvents {
  events: MatchEvent[];
  diagnostics: MetricDiagnostic[];
}

export function canonicalizeEvents(
  inputEvents: readonly MatchEvent[],
): CanonicalEvents {
  const sorted = inputEvents
    .map((event, originalIndex) => ({ event, originalIndex }))
    .sort((left, right) => {
      const timestampDifference =
        left.event.timestampMs - right.event.timestampMs;

      if (timestampDifference !== 0) {
        return timestampDifference;
      }

      const orderDifference =
        left.event.eventOrder - right.event.eventOrder;

      if (orderDifference !== 0) {
        return orderDifference;
      }

      return left.originalIndex - right.originalIndex;
    });

  const seenEventIds = new Set<string>();
  const duplicateEventIds = new Set<string>();
  const events: MatchEvent[] = [];

  for (const { event } of sorted) {
    if (seenEventIds.has(event.eventId)) {
      duplicateEventIds.add(event.eventId);
      continue;
    }

    seenEventIds.add(event.eventId);
    events.push(event);
  }

  const diagnostics = [...duplicateEventIds]
    .sort()
    .map<MetricDiagnostic>((eventId) => ({
      severity: "warning",
      code: "duplicate_event_id_ignored",
      message: `事件 ID ${eventId} 重复；指标兜底计算只保留规范化排序后的第一条。正式分析仍应由输入校验阻止该日志。`,
      evidenceEventIds: [eventId],
    }));

  return { events, diagnostics };
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  const result = total / values.length;

  return Number.isFinite(result) ? result : null;
}

export function availableMetric(
  value: number,
  unit: MetricUnit,
  explanation: string,
  evidenceEventIds: string[],
  sampleSize: number,
  confidence = 1,
): NumericMetric {
  if (!Number.isFinite(value)) {
    return unavailableMetric(
      unit,
      "non_finite_result",
      "计算结果不是有限数值，指标已停止输出。",
      explanation,
      evidenceEventIds,
    );
  }

  if (
    value < 0 ||
    !Number.isInteger(sampleSize) ||
    sampleSize < 0 ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    return unavailableMetric(
      unit,
      "invalid_numeric_result",
      "计算结果、样本量或置信度超出允许范围，指标已停止输出。",
      explanation,
      evidenceEventIds,
    );
  }

  const metric: AvailableMetric = {
    status: "available",
    value,
    unit,
    explanation,
    evidenceEventIds: [...new Set(evidenceEventIds)],
    sampleSize,
    confidence,
  };

  return metric;
}

export function unavailableMetric(
  unit: MetricUnit,
  reasonCode: MetricUnavailableReasonCode,
  reasonMessage: string,
  explanation: string,
  evidenceEventIds: string[] = [],
): UnavailableMetric {
  return {
    status: "unavailable",
    value: null,
    unit,
    explanation,
    evidenceEventIds: [...new Set(evidenceEventIds)],
    sampleSize: 0,
    reason: {
      code: reasonCode,
      message: reasonMessage,
    },
  };
}
