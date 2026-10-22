import { goalNetTarget, shotFlightTarget, saveSpot, centreSpot } from "./ball.js";
import { setPieceSpot, throwInSpot } from "./setpiece.js";
import {
  isShootoutKick,
  isShootoutScored,
  shootoutMissTarget,
  shootoutNetTarget,
  shootoutSpot,
} from "./shootout.js";

export function displayBall(event, fallback) {
  if (isShootoutKick(event)) {
    if (isShootoutScored(event)) return shootoutNetTarget();
    return shootoutMissTarget(event);
  }
  return goalNetTarget(event)
    || shotFlightTarget(event)
    || saveSpot(event)
    || centreSpot(event)
    || setPieceSpot(event)
    || throwInSpot(event)
    || fallback;
}

export function shootoutDisplayOrigin(event) {
  if (!isShootoutKick(event)) return null;
  return shootoutSpot();
}
