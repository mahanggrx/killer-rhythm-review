import type { FeedbackDisplay } from "../domain/analysis";
import { Icon } from "./Icon";

interface PrimaryFeedbackPanelProps {
  feedback: FeedbackDisplay;
  onViewEvidence: () => void;
}

export function PrimaryFeedbackPanel({ feedback, onViewEvidence }: PrimaryFeedbackPanelProps) {
  return (
    <section
      className={`feedback-panel${feedback.isNoClearBreakpoint ? " feedback-panel--neutral" : ""}`}
      aria-labelledby="feedback-title"
      data-rule-id={feedback.ruleId}
    >
      <div className="feedback-panel__signal" aria-hidden="true"><Icon name={feedback.isNoClearBreakpoint ? "check" : "pulse"} /></div>
      <div className="feedback-panel__content">
        <div className="section-kicker-row">
          <p className="section-kicker">本局主要节奏断点</p>
          <span className="dimension-tag">{feedback.dimensionLabel}</span>
        </div>
        <h2 id="feedback-title">{feedback.title}</h2>
        <p className="feedback-message">{feedback.message}</p>
        <div className="practice-goal">
          <span>下一局练习目标</span>
          <strong>{feedback.practiceGoal}</strong>
        </div>
      </div>
      <button
        className="button button--secondary feedback-panel__action"
        type="button"
        onClick={onViewEvidence}
        disabled={feedback.evidenceEventIds.length === 0}
      >
        <Icon name="evidence" />
        查看判定依据
      </button>
    </section>
  );
}
