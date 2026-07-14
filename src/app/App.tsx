import { useMemo, useRef, useState } from "react";
import { DetailsPanel } from "../components/DetailsPanel";
import { EventTimeline } from "../components/EventTimeline";
import { Icon } from "../components/Icon";
import { MetricCards } from "../components/MetricCards";
import { PrimaryFeedbackPanel } from "../components/PrimaryFeedbackPanel";
import { RuleSettings, type RuleNumericSetting } from "../components/RuleSettings";
import { DEFAULT_METRIC_CONFIG } from "../config/metricThresholds";
import { DEFAULT_PRESET_ID, PRESET_MATCHES } from "../data/presets";
import { analyzeMatchJson } from "../domain/analysis";
import type { MetricConfig } from "../domain/metrics";
import {
  DEFAULT_RULE_ENGINE_CONFIG,
  type PlayerExperience,
  type RuleEngineConfig,
  type RuleId,
} from "../domain/rules";

function cloneDefaultRuleConfig(): RuleEngineConfig {
  return structuredClone(DEFAULT_RULE_ENGINE_CONFIG);
}

function cloneDefaultMetricConfig(): MetricConfig {
  return { ...DEFAULT_METRIC_CONFIG };
}

export function App() {
  const defaultPreset = PRESET_MATCHES.find((preset) => preset.id === DEFAULT_PRESET_ID) ?? PRESET_MATCHES[0];
  const [selectedPresetId, setSelectedPresetId] = useState(defaultPreset.id);
  const [sourceName, setSourceName] = useState(defaultPreset.label);
  const [source, setSource] = useState(defaultPreset.source);
  const [experience, setExperience] = useState<PlayerExperience>("novice");
  const [metricConfig, setMetricConfig] = useState<MetricConfig>(cloneDefaultMetricConfig);
  const [ruleConfig, setRuleConfig] = useState<RuleEngineConfig>(cloneDefaultRuleConfig);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analysis = useMemo(
    () => analyzeMatchJson(source, { metricConfig, ruleConfig, playerExperience: experience }),
    [experience, metricConfig, ruleConfig, source],
  );

  const handlePresetChange = (presetId: string) => {
    const preset = PRESET_MATCHES.find((item) => item.id === presetId);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setSourceName(preset.label);
    setSource(preset.source);
    setSelectedEventId(null);
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    const uploadedSource = await file.text();
    setSelectedPresetId("uploaded");
    setSourceName(file.name);
    setSource(uploadedSource);
    setSelectedEventId(null);
  };

  const handleRuleToggle = (ruleId: RuleId, enabled: boolean) => {
    setRuleConfig((current) => ({
      ...current,
      rules: {
        ...current.rules,
        [ruleId]: { ...current.rules[ruleId], enabled },
      },
    }));
  };

  const handleNumericChange = (setting: RuleNumericSetting, value: number) => {
    if (!Number.isFinite(value)) return;

    if (setting === "highProgressPercent") {
      if (value < 0 || value > 100) return;
      setMetricConfig((current) => ({ ...current, highProgressThreshold: value / 100 }));
      return;
    }

    const integerSettings: RuleNumericSetting[] = [
      "generatorLosses",
      "minimumTotalHooks",
      "maximumSecondHookConversions",
    ];
    if (value <= 0 || (integerSettings.includes(setting) && !Number.isInteger(value))) return;

    setRuleConfig((current) => {
      switch (setting) {
        case "firstChaseSeconds":
          return { ...current, rules: { ...current.rules, FIRST_CHASE_TOO_LONG: { ...current.rules.FIRST_CHASE_TOO_LONG, thresholdMs: value * 1000 } } };
        case "searchGapSeconds":
          return { ...current, rules: { ...current.rules, SEARCH_GAP_TOO_LONG: { ...current.rules.SEARCH_GAP_TOO_LONG, thresholdMs: value * 1000 } } };
        case "generatorLosses":
          return { ...current, rules: { ...current.rules, GENERATOR_CONTROL_WEAK: { ...current.rules.GENERATOR_CONTROL_WEAK, minimumLosses: value } } };
        case "minimumTotalHooks":
          return { ...current, rules: { ...current.rules, HOOK_PRESSURE_DIFFUSE: { ...current.rules.HOOK_PRESSURE_DIFFUSE, minimumTotalHooks: value } } };
        case "maximumSecondHookConversions":
          return { ...current, rules: { ...current.rules, HOOK_PRESSURE_DIFFUSE: { ...current.rules.HOOK_PRESSURE_DIFFUSE, maximumSecondHookConversionsExclusive: value } } };
        case "lateEliminationSeconds":
          return { ...current, rules: { ...current.rules, HOOK_PRESSURE_DIFFUSE: { ...current.rules.HOOK_PRESSURE_DIFFUSE, lateEliminationThresholdMs: value * 1000 } } };
      }
    });
  };

  const resetSettings = () => {
    setExperience("novice");
    setMetricConfig(cloneDefaultMetricConfig());
    setRuleConfig(cloneDefaultRuleConfig());
  };

  const viewEvidence = () => {
    if (analysis.status !== "ready") return;
    const firstEvidence = analysis.timeline.find((item) => item.isEvidence);
    if (firstEvidence) setSelectedEventId(firstEvidence.eventId);
    document.getElementById("evidence-timeline")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#main-content" aria-label="返回分析结果顶部">
          <span className="brand__mark"><Icon name="target" /></span>
          <span><strong>杀手节奏复盘</strong><small>KILLER RHYTHM REVIEW</small></span>
        </a>
        <div className="topbar__meta">
          <span>规则集 <strong>base_only_1v4_10.0.2</strong></span>
          <span className="status-dot">纯前端原型</span>
        </div>
      </header>

      <main id="main-content">
        <section className="hero" aria-labelledby="page-title">
          <div className="hero__copy">
            <p className="eyebrow">赛后学习工具 · 系统策划原型</p>
            <h1 id="page-title">把一局的失速时刻，<span>变成下一局的练习目标。</span></h1>
            <p className="hero-description">导入人工制作的模拟对局日志，用可追溯的确定性规则定位一个主要节奏断点。不是评分，也不替玩家猜测主观意图。</p>
          </div>
          <div className="source-controls" aria-label="对局日志来源">
            <label className="field-control">
              <span>选择合成样例</span>
              <select value={selectedPresetId} onChange={(event) => handlePresetChange(event.target.value)}>
                {PRESET_MATCHES.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                {selectedPresetId === "uploaded" && <option value="uploaded">已上传 · {sourceName}</option>}
              </select>
            </label>
            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              accept="application/json,.json"
              aria-label="上传 JSON 文件"
              onChange={(event) => void handleUpload(event.target.files?.[0])}
            />
            <button className="button button--primary" type="button" onClick={() => fileInputRef.current?.click()}>
              <Icon name="upload" />上传 JSON
            </button>
            <p className="source-status"><span>当前日志</span><strong>{sourceName}</strong></p>
          </div>
        </section>

        <div className="workspace-layout">
          <div className="analysis-column">
            {analysis.status === "invalid" ? (
              <section className="error-panel" role="alert" aria-labelledby="error-title">
                <Icon name="warning" />
                <div>
                  <p className="section-kicker">日志校验未通过</p>
                  <h2 id="error-title">暂时无法分析这份日志</h2>
                  <p>请修正以下结构问题。输入错误已被安全拦截，页面和已设置的规则不会丢失。</p>
                  <ul>{analysis.errors.map((issue, index) => <li key={`${issue.code}-${index}`}><strong>{issue.path}</strong>{issue.message}</li>)}</ul>
                </div>
              </section>
            ) : (
              <>
                {(analysis.warnings.length > 0 || analysis.rules.diagnostics.some((item) => item.severity === "error")) && (
                  <section className="notice-bar" aria-label="分析警告">
                    <Icon name="warning" />
                    <span>{analysis.warnings.length > 0 ? `日志包含 ${analysis.warnings.length} 条语义警告，详情见分析明细。` : "当前阈值配置无效，规则引擎未执行判定。"}</span>
                  </section>
                )}
                <PrimaryFeedbackPanel feedback={analysis.presentation.feedback} onViewEvidence={viewEvidence} />
                <MetricCards metrics={analysis.presentation.keyMetrics} />
                <EventTimeline items={analysis.timeline} selectedEventId={selectedEventId} onSelect={setSelectedEventId} />
                <DetailsPanel groups={analysis.presentation.metricGroups} metrics={analysis.metrics} rules={analysis.rules} />
              </>
            )}
          </div>
          <RuleSettings
            experience={experience}
            metricConfig={metricConfig}
            ruleConfig={ruleConfig}
            onExperienceChange={setExperience}
            onRuleToggle={handleRuleToggle}
            onNumericChange={handleNumericChange}
            onReset={resetSettings}
          />
        </div>
      </main>

      <footer>
        <p>匿名合成数据 · 确定性规则 · 无客户端连接</p>
        <p>本原型不代表《黎明杀机》官方标准或真实平衡结论。</p>
      </footer>
    </div>
  );
}
