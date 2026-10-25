import { iconFor, PHASE_LABELS, situationPhase, explainMoment, insightHeadline, MATCH_STATE_LABELS } from "../match";

export default function Caption({ event, match, fromBall, playTrack = [], playIndex = 0 }) {
  if (!event) return null;

  const teamName = event.team === "away"
    ? match?.away?.name
    : event.team === "home"
      ? match?.home?.name
      : "";
  const phase = situationPhase(event, event, fromBall);
  const phaseLabel = phase ? PHASE_LABELS[phase] : "";
  const insight = explainMoment(playTrack, playIndex, match);
  const headline = insight
    ? insightHeadline(insight)
    : event.text
      || (phaseLabel && teamName ? `${teamName} · ${phaseLabel}` : phaseLabel)
      || event.type;
  const showWhy = insight?.why && (insight.importance === "high" || insight.importance === "medium");
  const stateLabel = insight?.state ? MATCH_STATE_LABELS[insight.state] || insight.state : "";

  return (
    <div className={`caption${insight?.importance === "high" ? " caption-hot" : ""}`}>
      <img src={`/icons/${iconFor(event)}.svg`} alt="" />
      <div className="caption-body">
        <p className="caption-line">{headline}</p>
        {showWhy ? <p className="caption-why">{insight.why}</p> : null}
        <div className="caption-meta">
          {stateLabel && insight?.importance !== "low" ? (
            <span className={`caption-chip caption-state caption-state-${insight.state}`}>{stateLabel}</span>
          ) : null}
          {insight?.metric ? (
            <span className="caption-chip caption-metric" title={insight.metric.detail}>
              {insight.metric.label}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
