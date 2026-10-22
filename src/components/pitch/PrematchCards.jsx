import { useEffect, useMemo, useState } from "react";
import { countdownParts, formWinPct, goalsByPeriod, kickoffDate, winChance } from "../../match";

function CardFooter() {
  return (
    <div className="card-footer" aria-hidden="true">
      <span className="brand">Touchline Radar</span>
    </div>
  );
}

function standing(match, name) {
  return match.standings?.find((row) => row.team === name);
}

function KickoffSlide({ match }) {
  const kickoff = useMemo(() => kickoffDate(), []);
  const [parts, setParts] = useState(() => countdownParts(kickoff.getTime(), Date.now()));

  useEffect(() => {
    const tick = () => setParts(countdownParts(kickoff.getTime(), Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [kickoff]);

  const units = [
    [parts.days, "Days"],
    [parts.hrs, "Hrs"],
    [parts.mins, "Mins"],
    [parts.secs, "Secs"],
  ];
  const homeManager = match.lineups?.home?.manager;
  const awayManager = match.lineups?.away?.manager;

  return (
    <div className="pitch-card">
      <div className="card-title">Kickoff time</div>
      <div className="kick-clock">
        {units.map(([value, label]) => (
          <div className="kick-unit" key={label}>
            <span className="score-box">{String(value).padStart(2, "0")}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="card-divider" />
      <div className="card-referee">
        <strong>{match.info?.referee}</strong>
        <span>
          <img src="/icons/whistle.svg" alt="" />
          Referee
        </span>
      </div>
      <div className="card-managers">
        <div className="card-manager">
          <strong>{homeManager}</strong>
          <span>
            <img src="/icons/jersey-home.svg" alt="" />
            Manager
          </span>
        </div>
        <div className="card-manager away">
          <strong>{awayManager}</strong>
          <span>
            <img src="/icons/jersey-away.svg" alt="" />
            Manager
          </span>
        </div>
      </div>
      <CardFooter />
    </div>
  );
}

function VenueSlide({ match }) {
  const info = match.info;
  return (
    <div className="pitch-card">
      <div className="card-title">Venue</div>
      <div className="card-divider" />
      <div className="venue-col">
        <img className="ico" src="/icons/venue-stadium.svg" alt="" />
        <strong>{info.venue}</strong>
        <span>{info.city}</span>
      </div>
      <div className="venue-meta">
        <div>
          <strong>{String(info.capacity).replace(/,/g, "")}</strong>
          <span>Capacity</span>
        </div>
        <div>
          <strong>{info.distance}</strong>
          <span>Distance Between Venues</span>
        </div>
      </div>
      <CardFooter />
    </div>
  );
}

function FormRow({ results }) {
  const last = (results || []).slice(0, 5);
  return (
    <div className="wdl-row">
      {last.map((result, index) => (
        <span key={`${result}-${index}`} className={`wdl ${result.toLowerCase()}`}>
          {result}
        </span>
      ))}
      <img className="wdl-arrow" src="/icons/form-arrow.svg" alt="" />
    </div>
  );
}

function placeTop(pos, maxPos) {
  if (maxPos <= 1) return "0%";
  return `${((pos - 1) / (maxPos - 1)) * 100}%`;
}

function LeagueSlide({ match }) {
  const homeColor = match.home.color || "#e10000";
  const awayColor = match.away.color || "#1a2c7e";
  const homePos = standing(match, match.home.name)?.pos ?? 1;
  const awayPos = standing(match, match.away.name)?.pos ?? (match.standings?.length || 2);
  const maxPos = Math.max(homePos, awayPos, match.standings?.length || 1);
  const homePct = formWinPct(match.form?.home);
  const awayPct = formWinPct(match.form?.away);

  return (
    <div className="pitch-card">
      <div className="card-title">League Position</div>
      <div className="card-divider" />
      <div className="league-grid">
        <div className="league-form-col">
          <div className="vbar" style={{ "--fill": `${homePct}%`, "--tone": homeColor }}>
            <span className="vbar-fill" />
          </div>
          <div className="league-form-meta">
            <strong>{homePct}%</strong>
            <span>Form</span>
          </div>
        </div>
        <div className="league-scale">
          <div className="scale-rail">
            <span className="scale-badge home" style={{ top: placeTop(homePos, maxPos), background: homeColor }}>
              {homePos}
            </span>
          </div>
          <div className="scale-rail">
            <span className="scale-badge away" style={{ top: placeTop(awayPos, maxPos), background: awayColor }}>
              {awayPos}
            </span>
          </div>
        </div>
        <div className="league-form-col away">
          <div className="league-form-meta">
            <strong>{awayPct}%</strong>
            <span>Form</span>
          </div>
          <div className="vbar" style={{ "--fill": `${awayPct}%`, "--tone": awayColor }}>
            <span className="vbar-fill" />
          </div>
        </div>
      </div>
      <div className="wdl-block">
        <FormRow results={match.form?.home} />
        <FormRow results={match.form?.away} />
      </div>
      <CardFooter />
    </div>
  );
}

function GoalsSlide({ match }) {
  const homeColor = match.home.color || "#e10000";
  const awayColor = match.away.color || "#1a2c7e";
  const home = goalsByPeriod(match.averages?.goalsPerMatch?.home, 0);
  const away = goalsByPeriod(match.averages?.goalsPerMatch?.away, 1);
  const max = Math.max(...home.map((row) => row.value), ...away.map((row) => row.value), 0.2);

  return (
    <div className="pitch-card">
      <div className="card-title">Average Goals Per Period</div>
      <div className="period-chart">
        <div className="period-axis">
          <span>{Math.round(max * 10) / 10}</span>
          <span>{Math.round((max / 2) * 10) / 10}</span>
          <span>0</span>
        </div>
        {home.map((row, i) => (
          <div className="period-col" key={row.minute}>
            <div className="period-bars">
              <i style={{ height: `${(row.value / max) * 100}%`, background: homeColor }} />
              <i style={{ height: `${(away[i].value / max) * 100}%`, background: awayColor }} />
            </div>
            <em>{row.minute}'</em>
          </div>
        ))}
      </div>
      <CardFooter />
    </div>
  );
}

function WinSlide({ match }) {
  const homeColor = match.home.color || "#e10000";
  const awayColor = match.away.color || "#1a2c7e";
  const homePos = standing(match, match.home.name)?.pos ?? 1;
  const awayPos = standing(match, match.away.name)?.pos ?? 2;
  const win = winChance(
    formWinPct(match.form?.home),
    formWinPct(match.form?.away),
    homePos,
    awayPos,
  );

  return (
    <div className="pitch-card">
      <div className="card-title">Win Probability</div>
      <div className="card-divider" />
      <div className="win-nums">
        <div style={{ color: homeColor }}>
          <strong>{win.home}%</strong>
          <span>{match.home.short}</span>
        </div>
        <div>
          <strong>{win.draw}%</strong>
          <span>Draw</span>
        </div>
        <div style={{ color: awayColor }}>
          <strong>{win.away}%</strong>
          <span>{match.away.short}</span>
        </div>
      </div>
      <div className="win-bar" aria-hidden="true">
        <i style={{ flex: win.home, background: homeColor }} />
        <i style={{ flex: win.draw, background: "#c5cad3" }} />
        <i style={{ flex: win.away, background: awayColor }} />
      </div>
      <CardFooter />
    </div>
  );
}

export function prematchSlides(match) {
  return [
    ["kickoff", <KickoffSlide match={match} />],
    ["venue", <VenueSlide match={match} />],
    ["form", <LeagueSlide match={match} />],
    ["goals", <GoalsSlide match={match} />],
    ["win", <WinSlide match={match} />],
  ];
}
