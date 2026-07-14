import type { MetricConfig } from "../domain/metrics";
import type { PlayerExperience, RuleEngineConfig, RuleId } from "../domain/rules";
import { Icon } from "./Icon";

export type RuleNumericSetting =
  | "firstChaseSeconds"
  | "searchGapSeconds"
  | "generatorLosses"
  | "minimumTotalHooks"
  | "maximumSecondHookConversions"
  | "lateEliminationSeconds"
  | "highProgressPercent";

interface RuleSettingsProps {
  experience: PlayerExperience;
  metricConfig: Readonly<MetricConfig>;
  ruleConfig: Readonly<RuleEngineConfig>;
  onExperienceChange: (experience: PlayerExperience) => void;
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

export function RuleSettings({ experience, metricConfig, ruleConfig, onExperienceChange, onRuleToggle, onNumericChange, onReset }: RuleSettingsProps) {
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
      <label className="field-control">
        <span>分析阶段</span>
        <select value={experience} onChange={(event) => onExperienceChange(event.target.value as PlayerExperience)}>
          <option value="novice">新手 · 同等证据下优先找人与追击</option>
          <option value="intermediate">进阶 · 同等证据下优先控机与挂钩收益</option>
        </select>
      </label>
      <label className="field-control field-control--inline">
        <span>高进度发电机阈值</span>
        <span className="number-field"><input aria-label="高进度发电机阈值" type="number" min="0" max="100" step="1" value={metricConfig.highProgressThreshold * 100} onChange={numericChange("highProgressPercent")} /><em>%</em></span>
      </label>
      <div className="rule-list">
        <RuleRow id="FIRST_CHASE_TOO_LONG" label="首次挂钩形成较晚" enabled={rules.FIRST_CHASE_TOO_LONG.enabled} onToggle={(enabled) => onRuleToggle("FIRST_CHASE_TOO_LONG", enabled)}>
          <label><span>超过</span><span className="number-field"><input aria-label="首次挂钩阈值" type="number" min="1" value={rules.FIRST_CHASE_TOO_LONG.thresholdMs / 1000} onChange={numericChange("firstChaseSeconds")} /><em>秒</em></span></label>
        </RuleRow>
        <RuleRow id="SEARCH_GAP_TOO_LONG" label="追逐间空窗较长" enabled={rules.SEARCH_GAP_TOO_LONG.enabled} onToggle={(enabled) => onRuleToggle("SEARCH_GAP_TOO_LONG", enabled)}>
          <label><span>超过</span><span className="number-field"><input aria-label="再搜寻空窗阈值" type="number" min="1" value={rules.SEARCH_GAP_TOO_LONG.thresholdMs / 1000} onChange={numericChange("searchGapSeconds")} /><em>秒</em></span></label>
        </RuleRow>
        <RuleRow id="GENERATOR_CONTROL_WEAK" label="高进度回防不足" enabled={rules.GENERATOR_CONTROL_WEAK.enabled} onToggle={(enabled) => onRuleToggle("GENERATOR_CONTROL_WEAK", enabled)}>
          <label><span>至少</span><span className="number-field"><input aria-label="发电机丢失阈值" type="number" min="1" step="1" value={rules.GENERATOR_CONTROL_WEAK.minimumLosses} onChange={numericChange("generatorLosses")} /><em>台</em></span></label>
        </RuleRow>
        <RuleRow id="HOOK_PRESSURE_DIFFUSE" label="挂钩压力较为分散" enabled={rules.HOOK_PRESSURE_DIFFUSE.enabled} onToggle={(enabled) => onRuleToggle("HOOK_PRESSURE_DIFFUSE", enabled)}>
          <label><span>总挂数 ≥</span><span className="number-field"><input aria-label="最低总挂数" type="number" min="1" step="1" value={rules.HOOK_PRESSURE_DIFFUSE.minimumTotalHooks} onChange={numericChange("minimumTotalHooks")} /></span></label>
          <label><span>再次上钩 &lt;</span><span className="number-field"><input aria-label="再次上钩阈值" type="number" min="1" step="1" value={rules.HOOK_PRESSURE_DIFFUSE.maximumSecondHookConversionsExclusive} onChange={numericChange("maximumSecondHookConversions")} /></span></label>
          <label><span>减员晚于</span><span className="number-field"><input aria-label="减员时间阈值" type="number" min="1" value={rules.HOOK_PRESSURE_DIFFUSE.lateEliminationThresholdMs / 1000} onChange={numericChange("lateEliminationSeconds")} /><em>秒</em></span></label>
        </RuleRow>
      </div>
      <p className="prototype-callout"><Icon name="warning" />所有默认阈值均为“原型待验证数值”，不代表官方标准或平衡结论。</p>
    </aside>
  );
}
