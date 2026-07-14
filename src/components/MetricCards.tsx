import type { MetricDisplayItem } from "../domain/analysis";

interface MetricCardsProps {
  metrics: readonly MetricDisplayItem[];
}

export function MetricCards({ metrics }: MetricCardsProps) {
  return (
    <section className="metric-section" aria-labelledby="metric-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">关键证据</p>
          <h2 id="metric-title">与本次判断直接相关</h2>
        </div>
        <span className="prototype-notice">原型待验证数值</span>
      </div>
      <div className="metric-grid">
        {metrics.map((metric, index) => (
          <article className={`metric-card${metric.status === "unavailable" ? " metric-card--unavailable" : ""}`} key={metric.id}>
            <span className="metric-card__index">0{index + 1}</span>
            <p className="metric-card__label">{metric.label}</p>
            <strong className="metric-card__value">{metric.valueText}</strong>
            <p className="metric-card__reference">{metric.referenceText}</p>
            {metric.unavailableReason && <p className="metric-card__reason">{metric.unavailableReason}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
