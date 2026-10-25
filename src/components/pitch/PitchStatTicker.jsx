import { useEffect, useMemo, useRef, useState } from "react";
import { statsAt } from "../../match";

const HOLD_MS = 3400;
const ENTER_MS = 420;
const EXIT_MS = 380;
const AMBIENT_EVERY_MS = 16000;
const COOLDOWN_MS = 2200;

const TRIGGER = {
  goal: "Shots on target",
  shotontarget: "Shots on target",
  shotofftarget: "Shots off target",
  shotblocked: "Shots blocked",
  goalkeeper_saved: "Saves",
  corner: "Corner kicks",
  freekick: "Free kicks",
  card: "Cards",
};

const AMBIENT = [
  "Shots on target",
  "Corner kicks",
  "Saves",
  "Ball possession",
  "Time in dangerous attack",
  "Shots blocked",
];

function amount(value) {
  return parseFloat(String(value).replace("%", "")) || 0;
}

function isPercent(value) {
  return String(value).includes("%");
}

function flatStats(pages) {
  const map = new Map();
  for (const page of pages || []) {
    for (const row of page) {
      if (row?.label) map.set(row.label, row);
    }
  }
  return map;
}

function interesting(row) {
  if (!row) return false;
  return amount(row.home) + amount(row.away) > 0;
}

function nextDir(prev) {
  return prev === "left" ? "right" : "left";
}

/**
 * Fleeting pitch chip — slides in, holds, slides out. Mostly event-driven, not a permanent carousel.
 */
export default function PitchStatTicker({
  match,
  event,
  playTrack = [],
  playIndex = 0,
  playing = true,
}) {
  const live = useMemo(
    () => statsAt(playTrack, playIndex, match?.stats),
    [playTrack, playIndex, match?.stats],
  );
  const byLabel = useMemo(() => flatStats(live.pages), [live.pages]);

  const [flash, setFlash] = useState(null);
  // flash: { label, dir, phase: 'in' | 'hold' | 'out', token }
  const busyRef = useRef(false);
  const lastDirRef = useRef("right");
  const lastKeyRef = useRef("");
  const lastShownAt = useRef(0);
  const ambientIdx = useRef(0);
  const timers = useRef([]);

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };

  const runFlash = (label) => {
    const row = byLabel.get(label);
    if (!row || !interesting(row)) return false;
    if (busyRef.current) return false;

    busyRef.current = true;
    clearTimers();
    const dir = nextDir(lastDirRef.current);
    lastDirRef.current = dir;
    const token = `${label}-${performance.now()}`;
    lastShownAt.current = performance.now();
    setFlash({ label, dir, phase: "in", token });

    timers.current.push(window.setTimeout(() => {
      setFlash((cur) => (cur?.token === token ? { ...cur, phase: "hold" } : cur));
    }, ENTER_MS));

    timers.current.push(window.setTimeout(() => {
      setFlash((cur) => (cur?.token === token ? { ...cur, phase: "out" } : cur));
    }, ENTER_MS + HOLD_MS));

    timers.current.push(window.setTimeout(() => {
      setFlash((cur) => (cur?.token === token ? null : cur));
      busyRef.current = false;
    }, ENTER_MS + HOLD_MS + EXIT_MS));

    return true;
  };

  useEffect(() => () => clearTimers(), []);

  // Event-driven flashes (the LMT "fleet" moments).
  useEffect(() => {
    if (!playing) return;
    const kind = event?.incident || event?.type;
    if (!kind || kind === "match_action") return;
    const label = TRIGGER[kind];
    if (!label) return;
    const key = `${kind}:${event?.minute}:${event?.added}:${event?.team}:${label}`;
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    // Allow a new incident to cut in after a short cooldown once idle.
    if (busyRef.current) return;
    if (performance.now() - lastShownAt.current < COOLDOWN_MS) return;
    runFlash(label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, playing, byLabel]);

  // Rare ambient beat while play is quiet — not a carousel.
  useEffect(() => {
    if (!playing) return undefined;
    const id = window.setInterval(() => {
      if (busyRef.current) return;
      if (performance.now() - lastShownAt.current < AMBIENT_EVERY_MS) return;
      const candidates = AMBIENT.filter((label) => interesting(byLabel.get(label)));
      if (!candidates.length) return;
      const label = candidates[ambientIdx.current % candidates.length];
      ambientIdx.current += 1;
      runFlash(label);
    }, 4000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, byLabel]);

  if (!flash) return null;
  const row = byLabel.get(flash.label);
  if (!row) return null;

  const home = amount(row.home);
  const away = amount(row.away);
  const total = home + away || 1;
  const homePct = (home / total) * 100;
  const label = row.label;
  const homeColor = match?.home?.color || "#3a5bb8";
  const awayColor = match?.away?.color || "#c62828";

  return (
    <div
      className={`pitch-stat-ticker is-${flash.phase} from-${flash.dir}`}
      role="status"
      aria-live="polite"
    >
      <div className="pitch-stat-ticker-inner">
        <div className="pitch-stat-side home">
          <img className="pitch-stat-jersey" src={match.home.crest || "/icons/jersey-home.svg"} alt="" />
          <strong>{row.home}</strong>
        </div>
        <div className="pitch-stat-mid">
          <span className="pitch-stat-label">{label}</span>
          <div className={`pitch-stat-bar${isPercent(row.home) ? " is-pct" : ""}`} aria-hidden="true">
            <em className="home" style={{ width: `${homePct}%`, background: homeColor }} />
            <em className="away" style={{ width: `${100 - homePct}%`, background: awayColor }} />
          </div>
        </div>
        <div className="pitch-stat-side away">
          <strong>{row.away}</strong>
          <img className="pitch-stat-jersey" src={match.away.crest || "/icons/jersey-away.svg"} alt="" />
        </div>
      </div>
    </div>
  );
}
