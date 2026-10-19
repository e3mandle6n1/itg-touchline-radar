export default function Scoreboard({ match, score, event, minute, ended }) {
  const phase = ended || event?.type === "match_ended"
    ? "Ended"
    : event?.incident
      ? event.clock || ""
      : `${minute}'`;
  const showHt = minute >= 45;

  return (
    <header className="scoreboard">
      <div className="team">
        <img className="jersey" src="/icons/jersey-home.svg" alt="" />
        <span>{match.home.name}</span>
      </div>
      <div className="status">
        <span className="phase">{phase}</span>
        <strong>{score.home} : {score.away}</strong>
        <span className="ht">{showHt ? `HT ${match.score.ht}` : ""}</span>
      </div>
      <div className="team away">
        <span>{match.away.name}</span>
        <img className="jersey" src="/icons/jersey-away.svg" alt="" />
      </div>
    </header>
  );
}
