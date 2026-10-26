import { PHASE_LABELS, MATCH_STATE_LABELS } from "../../match";

function AttackWedge() {
  return (
    <svg className="situation-wedge-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="sitWedgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1c2228" stopOpacity="0.52" />
          <stop offset="55%" stopColor="#1c2228" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#1c2228" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        className="situation-wedge-path"
        d="M 50,0 H 0 v 100 h 50 l 7.2,-47.2 c 0.3,-1.8 0.3,-4 0,-5.8 z"
        fill="url(#sitWedgeGrad)"
      />
      <path
        className="situation-wedge-edge"
        d="M 50,0 l 7.2,47.2 c 0.3,1.8 0.3,4 0,5.8 L 50,100"
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="1.2"
        vectorEffect="non-scaling-stroke"
        opacity="0.7"
      />
    </svg>
  );
}

export default function SituationBanner({ match, event, phase }) {
  if (!phase || !event?.team) return null;

  const team = event.team === "away" ? match.away : match.home;
  const side = event.team === "away" ? "away" : "home";
  const label = PHASE_LABELS[phase] || phase;
  const state = event.state && event.importance !== "low"
    ? (MATCH_STATE_LABELS[event.state] || event.state)
    : "";

  return (
    <div
      className={`situation situation-${side} situation-${phase}${event.state ? ` situation-state-${event.state}` : ""}`}
      data-phase={phase}
      data-side={side}
      data-state={event.state || ""}
    >
      <div className="situation-wedge" aria-hidden="true">
        <AttackWedge />
      </div>
      <div className="situation-copy">
        <strong className="situation-team">{team.name}</strong>
        <span className="situation-label">{label}</span>
        {state ? <span className="situation-state">{state}</span> : null}
      </div>
    </div>
  );
}
