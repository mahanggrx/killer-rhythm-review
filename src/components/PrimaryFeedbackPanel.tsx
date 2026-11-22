import { english } from "../i18n/english";
import type { FeedbackDisplay } from "../domain/analysis";
import { Icon } from "./Icon";

interface PrimaryFeedbackPanelProps {
  feedback: FeedbackDisplay;
  onViewEvidence: () => void;
}

export function PrimaryFeedbackPanel({ feedback, onViewEvidence }: PrimaryFeedbackPanelProps) {
  return (
    <section
      id="feedback-result" className={`feedback-panel${feedback.isNoClearBreakpoint ? " feedback-panel--neutral" : ""}`}
      aria-labelledby="feedback-title"
      data-rule-id={feedback.ruleId}
    >
      <div className="feedback-panel__signal" aria-hidden="true"><Icon name={feedback.isNoClearBreakpoint ? "check" : "pulse"} /></div>
      <div className="feedback-panel__content">
        <div className="section-kicker-row">
          <p className="section-kicker">Main Pacing Insight</p>
          <span className="dimension-tag">{english(feedback.dimensionLabel)}</span>
        </div>
        <h2 id="feedback-title">{english(feedback.title)}</h2>
        <p className="feedback-message">{english(feedback.message)}</p>
        <div className="practice-goal">
          <span>Try Next Match</span>
          <strong>{english(feedback.practiceGoal)}</strong>
        </div>
      </div>
      <button
        className="button button--secondary feedback-panel__action"
        type="button"
        onClick={onViewEvidence}
        disabled={feedback.evidenceEventIds.length === 0}
      >
        <Icon name="evidence" />
        View Supporting Events
      </button>
    </section>
  );
}
