import { useMemo, useState } from "react";
import { english } from "../i18n/english";
import { DetailsPanel } from "../components/DetailsPanel";
import { EventTimeline } from "../components/EventTimeline";
import { Icon } from "../components/Icon";
import { JsonDropzone } from "../components/JsonDropzone";
import { MetricCards } from "../components/MetricCards";
import { PrimaryFeedbackPanel } from "../components/PrimaryFeedbackPanel";
import { RuleSettings, type RuleNumericSetting } from "../components/RuleSettings";
import { SyntheticLogGenerator } from "../components/SyntheticLogGenerator";
import { DEFAULT_METRIC_CONFIG } from "../config/metricThresholds";
import { DEFAULT_PRESET_ID, PRESET_MATCHES } from "../data/presets";
import { analyzeMatchJson } from "../domain/analysis";
import type { MetricConfig } from "../domain/metrics";
import {
  DEFAULT_RULE_ENGINE_CONFIG,
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
  const [metricConfig, setMetricConfig] = useState<MetricConfig>(cloneDefaultMetricConfig);
  const [ruleConfig, setRuleConfig] = useState<RuleEngineConfig>(cloneDefaultRuleConfig);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);

  const analysis = useMemo(
    () => analyzeMatchJson(source, { metricConfig, ruleConfig }),
    [metricConfig, ruleConfig, source],
  );

  const handlePresetChange = (presetId: string) => {
    const preset = PRESET_MATCHES.find((item) => item.id === presetId);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setSourceName(preset.label);
    setSource(preset.source);
    setSelectedEventId(null);
    setUploadError(null);
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      setUploadError(`“${file.name}” is not a JSON file. Please select a .json file.`);
      return;
    }
    try {
      const uploadedSource = await file.text();
      setSelectedPresetId("uploaded");
      setSourceName(file.name);
      setSource(uploadedSource);
      setSelectedEventId(null);
      setUploadError(null);
    } catch {
      setUploadError(`Could not read “${file.name}”. Please select another JSON file.`);
    }
  };

  const handleGeneratedSource = (generatedSource: string) => {
    setSelectedPresetId("generated");
    setSourceName("Custom Synthetic Log");
    setSource(generatedSource);
    setSelectedEventId(null);
    setUploadError(null);
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

    if (setting === "maximumGeneratorsRemaining") {
      if (!Number.isInteger(value) || value < 0 || value > 5) return;
      setRuleConfig((current) => ({
        ...current,
        rules: {
          ...current.rules,
          LATE_FIRST_ELIMINATION: {
            ...current.rules.LATE_FIRST_ELIMINATION,
            maximumGeneratorsRemaining: value,
          },
        },
      }));
      return;
    }

    if (value <= 0) return;

    setRuleConfig((current) => {
      switch (setting) {
        case "firstChaseStartSeconds":
          return { ...current, rules: { ...current.rules, FIRST_CHASE_START_TOO_LATE: { ...current.rules.FIRST_CHASE_START_TOO_LATE, thresholdMs: value * 1000 } } };
        case "averageChaseDurationSeconds":
          return { ...current, rules: { ...current.rules, AVERAGE_CHASE_TOO_LONG: { ...current.rules.AVERAGE_CHASE_TOO_LONG, thresholdMs: value * 1000 } } };
      }
    });
  };

  const resetSettings = () => {
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
        <a className="brand" href="#main-content" aria-label="Back to results">
          <span className="brand__mark"><Icon name="target" /></span>
          <span><strong>Killer Match Review</strong></span>
        </a>
        <div className="topbar__meta">
          <span>Ruleset <strong>base_only_1v4_10.0.2</strong></span>
          <span className="status-dot">Browser-Only Prototype</span>
        </div>
      </header>

      <main id="main-content">
        <section className="hero" aria-labelledby="page-title">
          <div className="hero__copy">
            <h1 id="page-title">Killer Match Review</h1>
            <p className="hero__subtitle">Event-based post-match feedback for Dead by Daylight Killers.</p>
            <a className="hero__jump" href="#feedback-result">Explore the sample analysis <span aria-hidden="true">↓</span></a>
          </div>
          <div className="source-controls" aria-label="Match log source">
            <label className="field-control">
              <span>Select Sample Match</span>
              <select value={selectedPresetId} onChange={(event) => handlePresetChange(event.target.value)}>
                {PRESET_MATCHES.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                {selectedPresetId === "uploaded" && <option value="uploaded">Uploaded · {sourceName}</option>}
                {selectedPresetId === "generated" && <option value="generated">Generated · {sourceName}</option>}
              </select>
            </label>
            <JsonDropzone onFile={(file) => void handleUpload(file)} />
            <button
              className="button button--secondary"
              type="button"
              aria-expanded={isGeneratorOpen}
              aria-controls="synthetic-log-generator"
              onClick={() => setIsGeneratorOpen((current) => !current)}
            >
              <Icon name="pulse" />Build a Synthetic Log
            </button>
            <p className="source-status"><span>Current Log</span><strong>{sourceName}</strong></p>
          </div>
        </section>

        {isGeneratorOpen && (
          <div id="synthetic-log-generator">
            <SyntheticLogGenerator
              onGenerate={handleGeneratedSource}
              onClose={() => setIsGeneratorOpen(false)}
            />
          </div>
        )}

        <div className="workspace-layout">
          <div className="analysis-column">
            {uploadError ? (
              <section className="error-panel" role="alert" aria-labelledby="upload-error-title">
                <Icon name="warning" />
                <div>
                  <p className="section-kicker">Import Failed</p>
                  <h2 id="upload-error-title">Unable to Import This File</h2>
                  <p>{uploadError}</p>
                </div>
              </section>
            ) : analysis.status === "invalid" ? (
              <section className="error-panel" role="alert" aria-labelledby="error-title">
                <Icon name="warning" />
                <div>
                  <p className="section-kicker">Validation Failed</p>
                  <h2 id="error-title">Unable to Analyze This Log</h2>
                  <p>Please correct the issues below. Your settings are preserved.</p>
                  <ul>{analysis.errors.map((issue, index) => <li key={`${issue.code}-${index}`}><strong>{issue.path}</strong>{english(issue.message)}</li>)}</ul>
                  {analysis.warnings.length > 0 && (
                    <>
                      <p>Additional log warnings:</p>
                      <ul>{analysis.warnings.map((issue, index) => <li key={`warning-${issue.code}-${index}`}><strong>{issue.path}</strong>{english(issue.message)}</li>)}</ul>
                    </>
                  )}
                </div>
              </section>
            ) : (
              <>
                {(analysis.warnings.length > 0 || analysis.rules.diagnostics.some((item) => item.severity === "error")) && (
                  <section className="notice-bar" aria-label="Analysis Warnings">
                    <Icon name="warning" />
                    <span>{analysis.warnings.length > 0 ? `${analysis.warnings.length} log warning(s). See Analysis Details.` : "Invalid rule thresholds. No pacing judgment was made."}</span>
                  </section>
                )}
                <PrimaryFeedbackPanel feedback={analysis.presentation.feedback} onViewEvidence={viewEvidence} />
                <MetricCards metrics={analysis.presentation.keyMetrics} />
                <EventTimeline items={analysis.timeline} selectedEventId={selectedEventId} onSelect={setSelectedEventId} />
                <DetailsPanel groups={analysis.presentation.metricGroups} metrics={analysis.metrics} rules={analysis.rules} warnings={analysis.warnings} />
              </>
            )}
          </div>
          <RuleSettings
            metricConfig={metricConfig}
            ruleConfig={ruleConfig}
            onRuleToggle={handleRuleToggle}
            onNumericChange={handleNumericChange}
            onReset={resetSettings}
          />
        </div>
      </main>

      <footer>
        <p>Synthetic Data · Deterministic Rules · No Game-Client Connection</p>
        <p>Independent portfolio prototype. Not official DBD guidance or verified balance analysis.</p>
      </footer>
    </div>
  );
}
