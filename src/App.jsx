import { useEffect, useState } from "react";
import Transport from "./components/Transport.jsx";
import { useHubFeed } from "./hooks/useHubFeed.js";
import { usePlayback } from "./hooks/usePlayback.js";
import LiveTracker from "./views/LiveTracker.jsx";

function readParam(name) {
  try {
    return new URLSearchParams(window.location.search).get(name) || "";
  } catch {
    return "";
  }
}

function writeParams({ match, live }) {
  const url = new URL(window.location.href);
  if (match) url.searchParams.set("match", match);
  else url.searchParams.delete("match");
  if (live) url.searchParams.set("live", "1");
  else url.searchParams.delete("live");
  window.history.replaceState({}, "", url);
}

function Tracker({ match, live, feedDone, bridge }) {
  const playback = usePlayback(match, { live, feedDone });
  const clock = playback.ended || playback.event?.type === "match_ended"
    ? "FT"
    : playback.event?.clock || playback.event?.minute != null
      ? `${playback.event.minute}'`
      : "";

  useEffect(() => {
    const onKey = (event) => {
      if (event.code !== "Space" && event.key !== " ") return;
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || event.target?.isContentEditable) {
        return;
      }
      event.preventDefault();
      playback.toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playback.toggle]);

  return (
    <>
      <main>
        <LiveTracker match={match} playback={playback} />
      </main>
      <Transport
        clock={clock}
        index={playback.index}
        max={Math.max(0, playback.playTrack.length - 1)}
        playing={playback.playing}
        onToggle={playback.toggle}
        onSeek={playback.seek}
        live={live}
        bridge={bridge}
      />
    </>
  );
}

export default function App() {
  const [catalog, setCatalog] = useState(null);
  const [matchId, setMatchId] = useState(() => readParam("match"));
  const [live, setLive] = useState(() => readParam("live") === "1");
  const [sourceMatch, setSourceMatch] = useState(null);
  const [error, setError] = useState("");

  const bridge = useHubFeed(matchId, { enabled: live });

  useEffect(() => {
    fetch("/matches/index.json")
      .then((response) => {
        if (!response.ok) throw new Error("Could not load match catalog");
        return response.json();
      })
      .then((data) => {
        setCatalog(data);
        setMatchId((current) => {
          if (current && data.matches.some((row) => row.id === current)) return current;
          return data.defaultId || data.matches[0]?.id || "";
        });
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!catalog || !matchId || live) return undefined;
    const entry = catalog.matches.find((row) => row.id === matchId);
    if (!entry) {
      setError(`Unknown match: ${matchId}`);
      return undefined;
    }
    writeParams({ match: matchId, live });
    setSourceMatch(null);
    setError("");
    let cancelled = false;
    fetch(`/matches/${entry.file}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load ${entry.file}`);
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setSourceMatch(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [catalog, matchId, live]);

  useEffect(() => {
    if (!matchId) return;
    writeParams({ match: matchId, live });
  }, [matchId, live]);

  const entry = catalog?.matches.find((row) => row.id === matchId);
  const match = live ? bridge.match : sourceMatch;
  const feedError = live ? bridge.error : "";
  let feedLabel = null;
  if (live && !bridge.total) feedLabel = "Bridge · waiting";
  if (live && bridge.total) {
    const count = `${bridge.received}/${bridge.total}`;
    if (bridge.done) feedLabel = `Bridge · done ${count}`;
    else if (bridge.streaming) feedLabel = `Bridge · ${count}`;
    else feedLabel = `Bridge · paused ${count}`;
  }

  return (
    <>
      <header className="app-bar">
        <div className="app-bar-row">
          <strong className="brand">Touchline Radar</strong>
          <div className="app-bar-controls">
            {catalog ? (
              <label className="match-picker">
                <span className="match-picker-label">Match</span>
                <select
                  value={matchId}
                  onChange={(event) => setMatchId(event.target.value)}
                  aria-label="Select match"
                >
                  {catalog.matches.map((row) => (
                    <option key={row.id} value={row.id}>{row.title}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="mode-picker">
              <span className="match-picker-label">Mode</span>
              <select
                value={live ? "bridge" : "replay"}
                onChange={(event) => setLive(event.target.value === "bridge")}
                aria-label="Playback mode"
              >
                <option value="replay">Replay</option>
                <option value="bridge">Bridge</option>
              </select>
            </label>
          </div>
        </div>
        {match ? (
          <p>
            {match.competition} · {match.home.name} v {match.away.name}
            {feedLabel ? ` · ${feedLabel}` : ""}
          </p>
        ) : entry ? (
          <p>{entry.title}{live ? " · Bridge" : ""}</p>
        ) : null}
      </header>
      {error || feedError ? <p className="error">{error || feedError}</p> : null}
      {!error && !feedError && !match ? <p className="loading">Loading match...</p> : null}
      {match ? (
        <Tracker
          key={`${matchId}-${live ? "bridge" : "replay"}`}
          match={match}
          live={live}
          feedDone={!live || bridge.done}
          bridge={live ? bridge : null}
        />
      ) : null}
    </>
  );
}
