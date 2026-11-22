import type { MetricConfig } from "../domain/metrics";
import type { RuleEngineConfig, RuleId } from "../domain/rules";
import { Icon } from "./Icon";

export type RuleNumericSetting =
  | "firstChaseStartSeconds"
  | "averageChaseDurationSeconds"
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
        <input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)} aria-label={`Enable ${label}`} />
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
        <div><p className="section-kicker">Rule Lab</p><h2 id="settings-title">Adjust Thresholds</h2></div>
        <button className="icon-button" type="button" onClick={onReset}><Icon name="reset" /><span>Reset Defaults</span></button>
      </div>
      <p className="settings-intro">Settings update the same analysis instantly. Values are for demonstration only.</p>
      <label className="field-control field-control--inline">
        <span>High-progress Threshold</span>
        <span className="number-field"><input aria-label="High-progress Threshold" type="number" min="0" max="100" step="1" value={metricConfig.highProgressThreshold * 100} onChange={numericChange("highProgressPercent")} /><em>%</em></span>
      </label>
      <div className="rule-list">
        <RuleRow id="FIRST_CHASE_START_TOO_LATE" label="Late First Chase" enabled={rules.FIRST_CHASE_START_TOO_LATE.enabled} onToggle={(enabled) => onRuleToggle("FIRST_CHASE_START_TOO_LATE", enabled)}>
          <label><span>Over</span><span className="number-field"><input aria-label="First-chase threshold" type="number" min="1" value={rules.FIRST_CHASE_START_TOO_LATE.thresholdMs / 1000} onChange={numericChange("firstChaseStartSeconds")} /><em>sec</em></span></label>
        </RuleRow>
        <RuleRow id="AVERAGE_CHASE_TOO_LONG" label="Long Average Chase" enabled={rules.AVERAGE_CHASE_TOO_LONG.enabled} onToggle={(enabled) => onRuleToggle("AVERAGE_CHASE_TOO_LONG", enabled)}>
          <label><span>平均Over</span><span className="number-field"><input aria-label="Average-chase threshold" type="number" min="1" value={rules.AVERAGE_CHASE_TOO_LONG.thresholdMs / 1000} onChange={numericChange("averageChaseDurationSeconds")} /><em>sec</em></span></label>
        </RuleRow>
        <RuleRow id="LATE_FIRST_ELIMINATION" label="Late First Elimination" enabled={rules.LATE_FIRST_ELIMINATION.enabled} onToggle={(enabled) => onRuleToggle("LATE_FIRST_ELIMINATION", enabled)}>
          <label><span>Objectives left ≤</span><span className="number-field"><input aria-label="Remaining generators threshold" type="number" min="0" max="5" step="1" value={rules.LATE_FIRST_ELIMINATION.maximumGeneratorsRemaining} onChange={numericChange("maximumGeneratorsRemaining")} /><em>gen</em></span></label>
        </RuleRow>
      </div>
      <p className="prototype-callout"><Icon name="warning" />All default thresholds are unvalidated prototype values, not official standards or balance conclusions.</p>
    </aside>
  );
}
