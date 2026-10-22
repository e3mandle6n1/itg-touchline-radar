import { kickoffLabel } from "../match";

export default function Scoreboard({ match, score, event, minute, ended, preview }) {
  const phase = preview
    ? kickoffLabel()
    : ended || event?.type === "match_ended"
      ? "Ended"
      : event?.incident
        ? event.clock || ""
        : `${minute}'`;
  const showHt = !preview && minute >= 45;
  const home = preview ? 0 : score.home;
  const away = preview ? 0 : score.away;

  return (
    <header className="scoreboard">
      <div className="team">
        <img className="jersey" src="/icons/jersey-home.svg" alt="" />
        <span>{match.home.name}</span>
      </div>
      <div className="status">
        <span className="phase">{phase}</span>
        <strong>{home} : {away}</strong>
        <span className="ht">{showHt ? `HT ${match.score.ht}` : ""}</span>
      </div>
      <div className="team away">
        <span>{match.away.name}</span>
        <img className="jersey" src="/icons/jersey-away.svg" alt="" />
      </div>
    </header>
  );
}
