import type { MetricDisplayGroup } from "../domain/analysis";
import type { MatchMetrics } from "../domain/metrics";
import type { RuleEngineResult } from "../domain/rules";

interface DetailsPanelProps {
  groups: readonly MetricDisplayGroup[];
  metrics: MatchMetrics;
  rules: RuleEngineResult;
}

export function DetailsPanel({ groups, metrics, rules }: DetailsPanelProps) {
  return (
    <details className="details-panel">
      <summary>
        <span>
          <strong>完整分析明细</strong>
          <small>全部指标、证据事件与具体触发规则</small>
        </span>
        <span className="details-panel__hint">默认折叠</span>
      </summary>
      <div className="details-panel__content">
        <div className="all-metrics">
          {groups.map((group) => (
            <section key={group.id}>
              <h3>{group.title}</h3>
              <div className="metric-table-wrap">
                <table>
                  <thead><tr><th>指标</th><th>当前值</th><th>参考口径</th><th>证据事件</th></tr></thead>
                  <tbody>
                    {group.items.map((metric) => (
                      <tr key={metric.id}>
                        <th scope="row">{metric.label}</th>
                        <td>{metric.valueText}{metric.unavailableReason ? <small>{metric.unavailableReason}</small> : null}</td>
                        <td>{metric.referenceText}</td>
                        <td>{metric.evidenceEventIds.length > 0 ? metric.evidenceEventIds.join("、") : "无"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
        <section className="rule-detail" aria-labelledby="rule-detail-title">
          <p className="section-kicker">确定性规则</p>
          <h3 id="rule-detail-title">{rules.primaryFeedback.ruleId}</h3>
          <p>共触发 {rules.triggeredCandidates.length} 条候选规则，按证据充分性、相对阈值偏离、置信度、玩家阶段优先级与稳定 ID 排序。</p>
          {rules.triggeredCandidates.length > 0 && (
            <ol>{rules.triggeredCandidates.map((candidate) => <li key={candidate.ruleId}><strong>{candidate.ruleId}</strong><span>{candidate.title}</span></li>)}</ol>
          )}
        </section>
        {(metrics.diagnostics.length > 0 || rules.diagnostics.length > 0) && (
          <section className="diagnostic-list">
            <h3>计算诊断</h3>
            <ul>
              {metrics.diagnostics.map((item, index) => <li key={`metric-${item.code}-${index}`}>{item.message}</li>)}
              {rules.diagnostics.map((item, index) => <li key={`rule-${item.code}-${index}`}>{item.message}</li>)}
            </ul>
          </section>
        )}
      </div>
    </details>
  );
}
