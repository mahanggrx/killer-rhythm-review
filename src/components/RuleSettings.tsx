import type { MetricConfig } from "../domain/metrics";
import type { RuleEngineConfig, RuleId } from "../domain/rules";
import { Icon } from "./Icon";

export type RuleNumericSetting =
  | "firstChaseSeconds"
  | "averageChaseGapSeconds"
  | "maximumGeneratorsRemaining"
  | "highProgressPercent";

interface RuleSettingsProps {
  metricConfig: Readonly<MetricConfig>;
  ruleConfig: Readonly<RuleEngineConfig>;
  onRuleToggle: (ruleId: RuleId, enabled: boolean) => void;
  onNumericChange: (setting: RuleNumericSetting, value: number) => void;
  onReset: () => void;
}

interface RuleRowProps {
  id: RuleId;
  label: string;
  enabled: boolean;
  children: React.ReactNode;
  onToggle: (enabled: boolean) => void;
}

function RuleRow({ id, label, enabled, children, onToggle }: RuleRowProps) {
  return (
    <div className={`rule-row${enabled ? "" : " rule-row--disabled"}`}>
      <label className="switch-control">
        <input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)} aria-label={`启用${label}`} />
        <span aria-hidden="true" />
      </label>
      <div className="rule-row__copy"><strong>{label}</strong><code>{id}</code></div>
      <div className="rule-row__inputs">{children}</div>
    </div>
  );
}

export function RuleSettings({ metricConfig, ruleConfig, onRuleToggle, onNumericChange, onReset }: RuleSettingsProps) {
  const rules = ruleConfig.rules;
  const numericChange = (setting: RuleNumericSetting) => (event: React.ChangeEvent<HTMLInputElement>) => {
    onNumericChange(setting, event.target.valueAsNumber);
  };

  return (
    <aside className="settings-panel" aria-labelledby="settings-title">
      <div className="settings-panel__heading">
        <div><p className="section-kicker">规则实验台</p><h2 id="settings-title">调整判定口径</h2></div>
        <button className="icon-button" type="button" onClick={onReset}><Icon name="reset" /><span>恢复默认值</span></button>
      </div>
      <p className="settings-intro">修改后立即用同一份日志重新计算。以下数值仅用于作品集原型。</p>
      <label className="field-control field-control--inline">
        <span>高进度发电机阈值</span>
        <span className="number-field"><input aria-label="高进度发电机阈值" type="number" min="0" max="100" step="1" value={metricConfig.highProgressThreshold * 100} onChange={numericChange("highProgressPercent")} /><em>%</em></span>
      </label>
      <div className="rule-list">
        <RuleRow id="FIRST_CHASE_TOO_LONG" label="首次追逐持续较长" enabled={rules.FIRST_CHASE_TOO_LONG.enabled} onToggle={(enabled) => onRuleToggle("FIRST_CHASE_TOO_LONG", enabled)}>
          <label><span>超过</span><span className="number-field"><input aria-label="首次追逐时长阈值" type="number" min="1" value={rules.FIRST_CHASE_TOO_LONG.thresholdMs / 1000} onChange={numericChange("firstChaseSeconds")} /><em>秒</em></span></label>
        </RuleRow>
        <RuleRow id="LATE_FIRST_ELIMINATION" label="首次永久减员形成较晚" enabled={rules.LATE_FIRST_ELIMINATION.enabled} onToggle={(enabled) => onRuleToggle("LATE_FIRST_ELIMINATION", enabled)}>
          <label><span>剩余目标 ≤</span><span className="number-field"><input aria-label="首次减员剩余发电机阈值" type="number" min="0" max="5" step="1" value={rules.LATE_FIRST_ELIMINATION.maximumGeneratorsRemaining} onChange={numericChange("maximumGeneratorsRemaining")} /><em>台</em></span></label>
        </RuleRow>
        <RuleRow id="ENGAGEMENT_GAP_TOO_LONG" label="有效接敌空窗较长" enabled={rules.ENGAGEMENT_GAP_TOO_LONG.enabled} onToggle={(enabled) => onRuleToggle("ENGAGEMENT_GAP_TOO_LONG", enabled)}>
          <label><span>平均超过</span><span className="number-field"><input aria-label="平均追逐空窗阈值" type="number" min="1" value={rules.ENGAGEMENT_GAP_TOO_LONG.thresholdMs / 1000} onChange={numericChange("averageChaseGapSeconds")} /><em>秒</em></span></label>
        </RuleRow>
      </div>
      <p className="prototype-callout"><Icon name="warning" />所有默认阈值均为“原型待验证数值”，不代表官方标准或平衡结论。</p>
    </aside>
  );
}
