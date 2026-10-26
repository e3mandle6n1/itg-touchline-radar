import { useEffect, useRef } from "react";
import { BALL_SPEED } from "../match";

export function useSmoothBall(ref, target, playing, onPos, speed = BALL_SPEED) {
  const targetRef = useRef(target);
  const posRef = useRef({ x: target.x, y: target.y });
  const onPosRef = useRef(onPos);
  const speedRef = useRef(speed);
  const lastRef = useRef(0);
  const prevTargetRef = useRef({ x: target.x, y: target.y });
  const tripRef = useRef(0.01);

  targetRef.current = target;
  onPosRef.current = onPos;
  speedRef.current = speed;

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    let raf = 0;
    lastRef.current = performance.now();

    const tick = (now) => {
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;

      const goal = targetRef.current;
      const pos = posRef.current;
      const prev = prevTargetRef.current;
      if (goal.x !== prev.x || goal.y !== prev.y) {
        tripRef.current = Math.max(0.01, Math.hypot(goal.x - pos.x, goal.y - pos.y));
        prevTargetRef.current = { x: goal.x, y: goal.y };
      }

      const dx = goal.x - pos.x;
      const dy = goal.y - pos.y;
      const gap = Math.hypot(dx, dy);

      if (gap < 0.06 || !playing) {
        pos.x = goal.x;
        pos.y = goal.y;
      } else {
        const trip = tripRef.current;
        const progress = Math.min(1, Math.max(0, 1 - gap / trip));
        // Ease-out near the end so waypoints don't feel like hard stops.
        const ease = 0.7 + 0.55 * (1 - progress) * (1 - progress);
        const step = Math.min(gap, speedRef.current * dt * ease);
        pos.x += (dx / gap) * step;
        pos.y += (dy / gap) * step;
      }

      el.style.left = `${pos.x}%`;
      el.style.top = `${pos.y}%`;
      onPosRef.current?.({ x: pos.x, y: pos.y });
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ref, playing]);
}
