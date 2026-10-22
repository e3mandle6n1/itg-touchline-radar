import ConvGoalStats from "./ConvGoalStats.jsx";

const HOME = "#00003c";
const AWAY = "#ff0000";

export function MatchAnnounce({ title }) {
  return (
    <div className="match-end-announce" role="status">
      <img className="match-end-announce-icon" src="/icons/whistle.svg" alt="" />
      <strong className="match-end-announce-title">{title}</strong>
    </div>
  );
}

function CardFooter() {
  return (
    <div className="card-footer" aria-hidden="true">
      <span className="brand">Touchline Radar</span>
    </div>
  );
}

function CardTitle({ children }) {
  return (
    <>
      <div className="card-title">{children}</div>
      <div className="card-divider" />
    </>
  );
}

function stat(match, label) {
  return match.stats.flat().find((row) => row.label === label);
}

function num(value) {
  const n = Number(String(value).replace("%", ""));
  return Number.isFinite(n) ? n : 0;
}

function formPct(results) {
  const last = results.slice(0, 5);
  const wins = last.filter((r) => r === "W").length;
  return Math.round((wins / Math.max(last.length, 1)) * 100);
}

function MatchEndedSlide({ match, score }) {
  const ht = String(match.score.ht || "0 : 0").replace(/\s*/g, " ").trim();
  const [htHome, htAway] = ht.split(/\s*:\s*/);

  return (
    <div className="pitch-card ended-card">
      <div className="card-title">Match Ended</div>
      <div className="card-score">
        <span className="score-box">{score.home}</span>
        <span className="score-sep">:</span>
        <span className="score-box">{score.away}</span>
      </div>
      <div className="card-ht">
        HT {htHome ?? "0"}:{htAway ?? "0"}
      </div>
      <div className="card-divider" />
      <div className="card-referee">
        <strong>{match.info.referee}</strong>
        <span>
          <img src="/icons/whistle.svg" alt="" />
          Referee
        </span>
      </div>
      <div className="card-managers">
        <div className="card-manager">
          <strong>{match.lineups.home.manager}</strong>
          <span>
            <img src="/icons/jersey-home.svg" alt="" />
            Manager
          </span>
        </div>
        <div className="card-manager away">
          <strong>{match.lineups.away.manager}</strong>
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
    <div className="pitch-card venue-card">
      <CardTitle>Venue</CardTitle>
      <div className="venue-top">
        <div className="venue-col">
          <img className="ico" src="/icons/venue-weather.svg" alt="" />
          <strong>{info.weather || "Good"}</strong>
          <span>Weather</span>
        </div>
        <div className="venue-col">
          <img className="ico" src="/icons/venue-stadium.svg" alt="" />
          <strong>{info.venue}</strong>
          <span>{info.city}</span>
        </div>
        <div className="venue-col">
          <img className="ico" src="/icons/venue-pitch.svg" alt="" />
          <strong>{info.pitch || "Good"}</strong>
          <span>Pitch Condition</span>
        </div>
      </div>
      <div className="venue-meta">
        <div>
          <strong>{String(info.capacity).replace(/,/g, "")}</strong>
          <span>Capacity</span>
        </div>
        <div>
          <strong>{info.distance || "249 km"}</strong>
          <span>Distance Between Venues</span>
        </div>
      </div>
      <CardFooter />
    </div>
  );
}

function FormRow({ results }) {
  const last = results.slice(0, 5);
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

function LeaguePositionSlide({ match }) {
  const home = match.standings.find((row) => row.team === match.home.name);
  const away = match.standings.find((row) => row.team === match.away.name);
  const homePos = home?.pos ?? 3;
  const awayPos = away?.pos ?? 32;
  const maxPos = Math.max(homePos, awayPos, 36);
  const homePct = formPct(match.form.home);
  const awayPct = formPct(match.form.away);

  return (
    <div className="pitch-card form-card">
      <CardTitle>League Position</CardTitle>
      <div className="league-grid">
        <div className="league-form-col">
          <div className="vbar" style={{ "--fill": `${homePct}%`, "--tone": HOME }}>
            <span className="vbar-fill" />
          </div>
          <div className="league-form-meta">
            <strong>{homePct}%</strong>
            <span>Form</span>
          </div>
        </div>

        <div className="league-scale">
          <div className="scale-rail">
            <span
              className="scale-badge home"
              style={{ top: `${((homePos - 1) / (maxPos - 1)) * 100}%`, background: HOME }}
            >
              {homePos}
            </span>
          </div>
          <div className="scale-rail">
            <span
              className="scale-badge away"
              style={{ top: `${((awayPos - 1) / (maxPos - 1)) * 100}%`, background: AWAY }}
            >
              {awayPos}
            </span>
          </div>
        </div>

        <div className="league-form-col away">
          <div className="league-form-meta">
            <strong>{awayPct}%</strong>
            <span>Form</span>
          </div>
          <div className="vbar" style={{ "--fill": `${awayPct}%`, "--tone": AWAY }}>
            <span className="vbar-fill" />
          </div>
        </div>
      </div>
      <div className="wdl-block">
        <FormRow results={match.form.home} />
        <FormRow results={match.form.away} />
      </div>
      <CardFooter />
    </div>
  );
}

function DualBar({ home, away, thick }) {
  const h = num(home);
  const a = num(away);
  const total = h + a || 1;
  return (
    <div className={`dual-bar${thick ? " thick" : ""}`}>
      <span style={{ width: `${(h / total) * 100}%`, background: HOME }} />
      <span style={{ width: `${(a / total) * 100}%`, background: AWAY }} />
    </div>
  );
}

function ThinDual({ home, away }) {
  return (
    <div className="thin-dual">
      <span style={{ width: `${num(home)}%`, background: HOME }} />
      <i />
      <span style={{ width: `${num(away)}%`, background: AWAY }} />
    </div>
  );
}

function MatchStatisticsSlide() {
  const rows = [
    { label: "Ball possession", home: 55, away: 45, thick: true },
    { label: "Dangerous Attack", home: 47, away: 9 },
    { label: "Attack", home: 23, away: 16 },
    { label: "Ball Safe", home: 30, away: 75 },
  ];
  return (
    <div className="pitch-card stats-card">
      <CardTitle>Match Statistics</CardTitle>
      <div className="stat-rows">
        {rows.map((row) => (
          <div className="stat-row" key={row.label}>
            <div className="stat-row-head">
              <strong>{row.home}%</strong>
              <em>{row.label}</em>
              <strong>{row.away}%</strong>
            </div>
            {row.thick ? <DualBar home={row.home} away={row.away} thick /> : <ThinDual home={row.home} away={row.away} />}
          </div>
        ))}
      </div>
      <CardFooter />
    </div>
  );
}

function VertPair({ home, away, max }) {
  const scale = Math.max(max, 1);
  return (
    <div className="vert-pair">
      <div className="vert-col">
        <strong style={{ color: "#fff" }}>{home}</strong>
        <span className="vert-bar" style={{ height: `${Math.max((home / scale) * 100, home ? 8 : 2)}%`, background: HOME }} />
      </div>
      <div className="vert-col">
        <strong style={{ color: "#fff" }}>{away}</strong>
        <span className="vert-bar" style={{ height: `${Math.max((away / scale) * 100, away ? 8 : 2)}%`, background: AWAY }} />
      </div>
    </div>
  );
}

function ConversionSlide({ match }) {
  const corner = stat(match, "Corner kicks");
  const on = stat(match, "Shots on target");
  const off = stat(match, "Shots off target");
  const blocked = stat(match, "Shots blocked");
  const saves = stat(match, "Saves");
  const homeAttempts = num(on?.home) + num(off?.home);
  const awayAttempts = num(on?.away) + num(off?.away);
  const homeConv = homeAttempts ? Math.round((num(match.score.home) / homeAttempts) * 100) : 0;
  const awayConv = awayAttempts ? Math.round((num(match.score.away) / awayAttempts) * 100) : 0;
  const maxBar = Math.max(num(corner?.home), num(on?.home), num(saves?.away), num(off?.home), homeAttempts, num(blocked?.home), 1);

  return (
    <div className="pitch-card conversion-card">
      <div className="conv-head">
        <strong>{homeConv}%</strong>
        <span className="card-title">Conversion Rate</span>
        <strong>{awayConv}%</strong>
      </div>
      <div className="conv-line">
        <span style={{ width: `${homeConv}%`, background: "#fff" }} />
        <span style={{ flex: 1, background: HOME }} />
      </div>
      <div className="conv-stage">
        <ConvGoalStats />
        <div className="conv-grid">
          <div className="conv-cell">
            <em>CORNER</em>
            <VertPair home={num(corner?.home)} away={num(corner?.away)} max={maxBar} />
          </div>
          <div className="conv-cell">
            <em>ON TARGET</em>
            <VertPair home={num(on?.home)} away={num(on?.away)} max={maxBar} />
          </div>
          <div className="conv-cell">
            <em>SAVES</em>
            <VertPair home={num(saves?.home)} away={num(saves?.away)} max={maxBar} />
          </div>
          <div className="conv-cell bottom">
            <VertPair home={num(off?.home)} away={num(off?.away)} max={maxBar} />
            <em>OFF TARGET</em>
          </div>
          <div className="conv-cell bottom">
            <VertPair home={homeAttempts} away={awayAttempts} max={maxBar} />
            <em>ATTEMPTS</em>
          </div>
          <div className="conv-cell bottom">
            <VertPair home={num(blocked?.home)} away={num(blocked?.away)} max={maxBar} />
            <em>BLOCKED</em>
          </div>
        </div>
      </div>
      <CardFooter />
    </div>
  );
}

function DualRing({ home, away, icon, label }) {
  const total = home + away || 1;
  const homeDeg = (home / total) * 360;
  return (
    <div className="dual-ring">
      <div className="dual-ring-vals">
        <span>{home}</span>
        <span>{away}</span>
      </div>
      <div
        className="dual-ring-chart"
        style={{
          background: `conic-gradient(${HOME} 0deg ${homeDeg}deg, ${AWAY} ${homeDeg}deg 360deg)`,
        }}
      >
        <div className="dual-ring-hole">
          <img src={icon} alt="" />
        </div>
      </div>
      <em>{label}</em>
    </div>
  );
}

function CardsSlide({ match }) {
  const cards = stat(match, "Cards");
  const fouls = stat(match, "Fouls");
  const free = stat(match, "Free kicks");
  const offs = stat(match, "Offsides");
  const homeCards = num(cards?.home);
  const awayCards = num(cards?.away);
  const total = homeCards + awayCards || 1;

  return (
    <div className="pitch-card cards-slide">
      <div className="card-title">Cards</div>
      <div className="cards-top">
        <strong>{homeCards}</strong>
        <strong>{awayCards}</strong>
      </div>
      <div className="cards-bar">
        <span style={{ width: `${(homeCards / total) * 100}%`, background: HOME }} />
        <span style={{ width: `${(awayCards / total) * 100}%`, background: AWAY }} />
      </div>
      <div className="cards-rings">
        <DualRing home={num(fouls?.home)} away={num(fouls?.away)} icon="/icons/card-fouls.svg" label="Fouls" />
        <DualRing home={num(free?.home)} away={num(free?.away)} icon="/icons/card-freekick.svg" label="Free Kicks" />
        <DualRing home={num(offs?.home)} away={num(offs?.away)} icon="/icons/card-offside.svg" label="Offsides" />
      </div>
      <CardFooter />
    </div>
  );
}

function PerfGauge({ side, offense, defense, jersey }) {
  const color = side === "home" ? HOME : AWAY;
  const o = Math.max(8, Math.min(100, offense));
  const d = Math.max(8, Math.min(100, defense));
  const sweep = side === "home" ? 0 : 1;
  const outer = `M50 12 A38 38 0 0 ${sweep} 50 88`;
  const inner = `M50 18 A32 32 0 0 ${sweep} 50 82`;
  return (
    <div className={`perf-gauge ${side}`}>
      <span className="perf-cap">Under</span>
      <div className="perf-arcs">
        <svg viewBox="0 0 100 100" className="perf-svg">
          <path d={outer} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" strokeDasharray="3 3" />
          <path d={inner} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" strokeDasharray="2 3" />
          <path
            d={outer}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray={`${o} ${100 - o}`}
          />
          <path
            d={inner}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="butt"
            pathLength="100"
            strokeDasharray={side === "away" ? "2 1.5" : `${d} ${100 - d}`}
            strokeDashoffset={side === "away" ? String(100 - d) : "0"}
          />
        </svg>
        <img className="perf-jersey" src={jersey} alt="" />
      </div>
      <span className="perf-cap">Over</span>
    </div>
  );
}

function PerformanceSlide() {
  return (
    <div className="pitch-card performance-card">
      <CardTitle>Performance</CardTitle>
      <div className="perf-body">
        <PerfGauge side="home" offense={72} defense={48} jersey="/icons/jersey-home.svg" />
        <div className="perf-labels">
          <span>Offense</span>
          <span>Defense</span>
        </div>
        <PerfGauge side="away" offense={78} defense={55} jersey="/icons/jersey-away.svg" />
      </div>
      <CardFooter />
    </div>
  );
}

export function endedSlides(match, score) {
  return [
    ["ended", <MatchEndedSlide match={match} score={score} />],
    ["venue", <VenueSlide match={match} />],
    ["form", <LeaguePositionSlide match={match} />],
    ["stats", <MatchStatisticsSlide />],
    ["conversion", <ConversionSlide match={match} />],
    ["cards", <CardsSlide match={match} />],
    ["performance", <PerformanceSlide />],
  ];
}
