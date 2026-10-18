import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BALL_SPEED, PASS_SPEED } from "../../match";
import { useSmoothBall } from "../../hooks/useSmoothBall.js";

function curvePoints(from, to, steps = 10) {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const lift = (from.y < 50 ? 1 : -1) * Math.min(10, Math.hypot(to.x - from.x, to.y - from.y) * 0.12);
  const cx = mx;
  const cy = my + lift;
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const u = 1 - t;
    pts.push({
      x: u * u * from.x + 2 * u * t * cx + t * t * to.x,
      y: u * u * from.y + 2 * u * t * cy + t * t * to.y,
    });
  }
  return pts;
}

export default function BallSpot({
  ball,
  playing,
  team,
  muted,
  shotOrigin = null,
  goalFlight = false,
  shotFlight = false,
  cornerFlight = false,
}) {
  const posRef = useRef(null);
  const [trail, setTrail] = useState([]);
  const [passes, setPasses] = useState([]);
  const [pingKey, setPingKey] = useState(0);
  const settled = useRef(true);
  const flightKey = useRef("");
  const keptRef = useRef([]);
  const flightFrom = useRef(null);
  const lastTarget = useRef({ x: ball.x, y: ball.y });
  const teamRef = useRef(team);
  const liveLineRef = useRef(null);
  const dashFlight = goalFlight || shotFlight;
  const curved = dashFlight || cornerFlight;

  const flightCurve = useMemo(() => {
    if (!curved || !shotOrigin) return null;
    return curvePoints(shotOrigin, ball, cornerFlight ? 14 : 12);
  }, [curved, cornerFlight, shotOrigin, ball.x, ball.y]);

  useEffect(() => {
    if (!curved) {
      flightKey.current = "";
      setTrail([]);
      return;
    }
    if (!shotOrigin || !flightCurve) return;
    const tag = cornerFlight ? "c" : goalFlight ? "g" : "s";
    const key = `${tag}:${shotOrigin.x},${shotOrigin.y}->${ball.x},${ball.y}`;
    if (flightKey.current === key) return;
    flightKey.current = key;
    setTrail(flightCurve);
    settled.current = false;
  }, [curved, cornerFlight, goalFlight, shotOrigin, flightCurve, ball.x, ball.y]);

  useEffect(() => {
    if (!playing || curved) {
      flightFrom.current = null;
      lastTarget.current = { x: ball.x, y: ball.y };
      if (liveLineRef.current) liveLineRef.current.style.opacity = "0";
      return;
    }
    if (team !== teamRef.current) {
      teamRef.current = team;
      keptRef.current = [];
      setPasses([]);
    }
    const from = lastTarget.current;
    const gap = Math.hypot(ball.x - from.x, ball.y - from.y);
    flightFrom.current = gap > 4 && gap < 55 ? { x: from.x, y: from.y } : null;
    lastTarget.current = { x: ball.x, y: ball.y };
  }, [ball.x, ball.y, team, playing, curved]);

  const onPos = useCallback((pos) => {
    const from = flightFrom.current;
    const line = liveLineRef.current;
    if (from && line) {
      line.setAttribute("x1", from.x);
      line.setAttribute("y1", from.y);
      line.setAttribute("x2", pos.x);
      line.setAttribute("y2", pos.y);
      line.style.opacity = "0.8";
    } else if (line) {
      line.style.opacity = "0";
    }

    const gapToTarget = Math.hypot(ball.x - pos.x, ball.y - pos.y);
    if (from && gapToTarget < 0.4) {
      flightFrom.current = null;
      const next = [...keptRef.current, {
        x: from.x,
        y: from.y,
        tx: ball.x,
        ty: ball.y,
      }].slice(-5);
      keptRef.current = next;
      setPasses(next);
      if (line) line.style.opacity = "0";
    }

    if (gapToTarget > 1.2) {
      settled.current = false;
    } else if (!settled.current && gapToTarget < 0.35) {
      settled.current = true;
      setPingKey((key) => key + 1);
    }
  }, [ball.x, ball.y]);

  useSmoothBall(posRef, ball, playing || curved, onPos, curved ? BALL_SPEED : PASS_SPEED);

  useEffect(() => {
    settled.current = true;
  }, [team]);

  const points = trail.map((pt) => `${pt.x},${pt.y}`).join(" ");

  return (
    <div
      className={`bspot${muted ? " is-muted" : ""}${goalFlight ? " is-goal" : ""}${shotFlight ? " is-shot" : ""}${cornerFlight ? " is-corner" : ""}`}
    >
      <svg className="bspot-trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {!curved && passes.map((seg, index) => (
          <line
            key={`${index}:${seg.x},${seg.y}-${seg.tx},${seg.ty}`}
            className="bspot-pass-line"
            x1={seg.x}
            y1={seg.y}
            x2={seg.tx}
            y2={seg.ty}
            strokeOpacity={0.28 + ((index + 1) / passes.length) * 0.42}
          />
        ))}
        {!curved && <line ref={liveLineRef} className="bspot-pass-line bspot-pass-live" />}
        {curved && trail.length > 1 && (
          <polyline
            className={`bspot-trail-line${dashFlight ? " is-goal-flight" : ""}${cornerFlight ? " is-corner-flight" : ""}`}
            points={points}
            fill="none"
            stroke="#fff"
            strokeOpacity={cornerFlight ? "0.7" : "0.72"}
            strokeWidth={cornerFlight ? "0.7" : "0.65"}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={dashFlight ? "3.2 2" : undefined}
          />
        )}
      </svg>
      <div ref={posRef} className="bspot-pos">
        <span
          key={pingKey}
          className={`bspot-ping${cornerFlight ? " is-corner-ping" : ""}`}
          aria-hidden="true"
        />
        <img className="ball" src="/icons/pitch-ball.svg" alt="" />
      </div>
    </div>
  );
}
