import { english } from "../i18n/english";
import type { MetricDisplayItem } from "../domain/analysis";

interface MetricCardsProps {
  metrics: readonly MetricDisplayItem[];
}

export function MetricCards({ metrics }: MetricCardsProps) {
  return (
    <section className="metric-section" aria-labelledby="metric-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Key Evidence</p>
          <h2 id="metric-title">Why This Was Flagged</h2>
        </div>
        <span className="prototype-notice">Unvalidated Prototype Thresholds</span>
      </div>
      <div className="metric-grid">
        {metrics.map((metric, index) => (
          <article className={`metric-card${metric.status === "unavailable" ? " metric-card--unavailable" : ""}`} key={metric.id}>
            <span className="metric-card__index">0{index + 1}</span>
            <p className="metric-card__label">{english(metric.label)}</p>
            <strong className="metric-card__value">{english(metric.valueText)}</strong>
            <p className="metric-card__reference">{english(metric.referenceText)}</p>
            {metric.unavailableReason && <p className="metric-card__reason">{english(metric.unavailableReason)}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
