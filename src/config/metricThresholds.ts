import type { MetricConfig } from "../domain/metrics/types";

// 原型待验证数值，不代表官方标准或已经过真实对局数据验证的阈值。
export const DEFAULT_METRIC_CONFIG: Readonly<MetricConfig> = Object.freeze({
  highProgressThreshold: 0.7,
});
