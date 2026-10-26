import { useEffect, useState } from "react";
import Transport from "./components/Transport.jsx";
import { UiProvider, useUi } from "./context/UiContext.jsx";
import { useHubFeed } from "./hooks/useHubFeed.js";
import { usePlayback } from "./hooks/usePlayback.js";
import LangPicker from "./components/LangPicker.jsx";
import ThemeSwitch from "./components/ThemeSwitch.jsx";
import LiveTracker from "./views/LiveTracker.jsx";
import StudioShell from "./views/StudioShell.jsx";

function readParam(name) {
  try {
    return new URLSearchParams(window.location.search).get(name) || "";
  } catch {
    return "";
  }
}

function Tracker({ match, feedDone, bridge, live }) {
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
    <StudioShell>
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
        bridge={bridge}
      />
    </StudioShell>
  );
}

function AppShell({ matchId, setMatchId }) {
  const { t } = useUi();
  const [catalog, setCatalog] = useState(null);
  const [bootMatch, setBootMatch] = useState(null);
  const [error, setError] = useState("");
  const [feedReady, setFeedReady] = useState(false);

  const bridge = useHubFeed(matchId, { enabled: feedReady && Boolean(matchId) });

  useEffect(() => {
    fetch("/api/catalog")
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
  }, [setMatchId]);

  useEffect(() => {
    if (!catalog || !matchId) return undefined;
    if (!catalog.matches.some((row) => row.id === matchId)) {
      setError(`Unknown match: ${matchId}`);
      return undefined;
    }

    setError("");
    setBootMatch(null);
    setFeedReady(false);
    let cancelled = false;

    fetch(`/api/matches/${matchId}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load ${matchId}`);
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setBootMatch(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    fetch(`/api/publish/${matchId}`, { method: "POST" })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not publish ${matchId}`);
        if (!cancelled) setFeedReady(true);
      })
      .catch(() => {
        if (!cancelled) setFeedReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [catalog, matchId]);

  const entry = catalog?.matches.find((row) => row.id === matchId);
  const live = Boolean(bridge.match && bridge.received > 0);
  const match = live ? bridge.match : bootMatch;
  let feedLabel = null;
  if (feedReady) {
    if (!bridge.total) feedLabel = t("bridgeWaiting");
    else {
      const count = `${bridge.received}/${bridge.total}`;
      if (bridge.done) feedLabel = `${t("bridgeDone")} ${count}`;
      else if (bridge.streaming) feedLabel = `Bridge · ${count}`;
      else feedLabel = `${t("bridgePaused")} ${count}`;
    }
  }

  return (
    <>
      <header className="app-bar">
        <div className="app-bar-row">
          <strong className="brand">Touchline Radar</strong>
          <div className="app-bar-controls">
            {catalog ? (
              <label className="match-picker">
                <span className="match-picker-label">{t("match")}</span>
                <select
                  value={matchId}
                  onChange={(event) => setMatchId(event.target.value)}
                  aria-label={t("match")}
                >
                  {catalog.matches.map((row) => (
                    <option key={row.id} value={row.id}>{row.title}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="app-bar-tools" role="group" aria-label="Display">
              <ThemeSwitch />
              <span className="app-bar-divider" aria-hidden="true" />
              <LangPicker />
            </div>
          </div>
        </div>
        {match ? (
          <p>
            {match.competition} · {match.home.name} v {match.away.name}
            {feedLabel ? ` · ${feedLabel}` : ""}
          </p>
        ) : entry ? (
          <p>{entry.title}{feedLabel ? ` · ${feedLabel}` : ""}</p>
        ) : null}
      </header>
      {error ? <p className="error">{error}</p> : null}
      {!error && !match ? <p className="loading">{t("loading")}</p> : null}
      {match ? (
        <Tracker
          key={`${matchId}-${live ? "live" : "boot"}`}
          match={match}
          live={live}
          feedDone={!live || bridge.done}
          bridge={feedReady ? bridge : null}
        />
      ) : null}
    </>
  );
}

export default function App() {
  const [matchId, setMatchId] = useState(() => readParam("match"));

  return (
    <UiProvider matchId={matchId}>
      <AppShell matchId={matchId} setMatchId={setMatchId} />
    </UiProvider>
  );
}
