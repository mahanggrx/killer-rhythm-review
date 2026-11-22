import { english } from "../i18n/english";
import type { MetricDisplayGroup } from "../domain/analysis";
import type { ValidationIssue } from "../domain/log";
import type { MatchMetrics } from "../domain/metrics";
import type { RuleEngineResult } from "../domain/rules";

interface DetailsPanelProps {
  groups: readonly MetricDisplayGroup[];
  metrics: MatchMetrics;
  rules: RuleEngineResult;
  warnings: readonly ValidationIssue[];
}

export function DetailsPanel({ groups, metrics, rules, warnings }: DetailsPanelProps) {
  return (
    <details className="details-panel">
      <summary>
        <span>
          <strong>Analysis Details</strong>
          <small>All metrics, source events, and rule triggers</small>
        </span>
        <span className="details-panel__hint">Collapsed by Default</span>
      </summary>
      <div className="details-panel__content">
        {warnings.length > 0 && (
          <section className="diagnostic-list" aria-labelledby="log-warning-title">
            <h3 id="log-warning-title">Log Warnings</h3>
            <ul>
              {warnings.map((item, index) => (
                <li key={`${item.code}-${index}`}>
                  <strong>{item.code}</strong> · {item.path} · {english(item.message)}
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="all-metrics">
          {groups.map((group) => (
            <section key={group.id}>
              <h3>{english(group.title)}</h3>
              <div className="metric-table-wrap">
                <table>
                  <thead><tr><th>Metric</th><th>Value</th><th>Reference</th><th>Evidence Events</th></tr></thead>
                  <tbody>
                    {group.items.map((metric) => (
                      <tr key={metric.id}>
                        <th scope="row">{english(metric.label)}</th>
                        <td>{english(metric.valueText)}{metric.unavailableReason ? <small>{english(metric.unavailableReason)}</small> : null}</td>
                        <td>{english(metric.referenceText)}</td>
                        <td>{metric.evidenceEventIds.length > 0 ? metric.evidenceEventIds.join(", ") : "None"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
        <section className="rule-detail" aria-labelledby="rule-detail-title">
          <p className="section-kicker">Deterministic Rules</p>
          <h3 id="rule-detail-title">{rules.primaryFeedback.ruleId}</h3>
          <p>{rules.triggeredCandidates.length} candidate rule(s) triggered. Ranked by evidence sufficiency, relative threshold deviation, confidence, configured priority, then stable rule ID.</p>
          {rules.triggeredCandidates.length > 0 && (
            <ol>{rules.triggeredCandidates.map((candidate) => <li key={candidate.ruleId}><strong>{candidate.ruleId}</strong><span>{english(candidate.title)}</span></li>)}</ol>
          )}
        </section>
        {(metrics.diagnostics.length > 0 || rules.diagnostics.length > 0) && (
          <section className="diagnostic-list">
            <h3>Calculation Diagnostics</h3>
            <ul>
              {metrics.diagnostics.map((item, index) => <li key={`metric-${item.code}-${index}`}>{english(item.message)}</li>)}
              {rules.diagnostics.map((item, index) => <li key={`rule-${item.code}-${index}`}>{english(item.message)}</li>)}
            </ul>
          </section>
        )}
      </div>
    </details>
  );
}
