import { iconFor, PHASE_LABELS, situationPhase } from "../match";

export default function Caption({ event, match, fromBall }) {
  if (!event) return null;

  const teamName = event.team === "away"
    ? match?.away?.name
    : event.team === "home"
      ? match?.home?.name
      : "";
  const phase = situationPhase(event, event, fromBall);
  const phaseLabel = phase ? PHASE_LABELS[phase] : "";
  const text = event.text
    || (phaseLabel && teamName ? `${teamName} · ${phaseLabel}` : phaseLabel)
    || event.type;

  return (
    <p className="caption">
      <img src={`/icons/${iconFor(event)}.svg`} alt="" />
      <span>{text}</span>
    </p>
  );
}
