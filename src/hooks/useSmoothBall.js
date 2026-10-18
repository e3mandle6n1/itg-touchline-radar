import { useEffect, useRef } from "react";
import { BALL_SPEED } from "../match";

export function useSmoothBall(ref, target, playing, onPos, speed = BALL_SPEED) {
  const targetRef = useRef(target);
  const posRef = useRef({ x: target.x, y: target.y });
  const onPosRef = useRef(onPos);
  const speedRef = useRef(speed);
  const lastRef = useRef(0);

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
      const dx = goal.x - pos.x;
      const dy = goal.y - pos.y;
      const gap = Math.hypot(dx, dy);

      if (gap < 0.08 || !playing) {
        pos.x = goal.x;
        pos.y = goal.y;
      } else {
        const step = Math.min(gap, speedRef.current * dt);
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
