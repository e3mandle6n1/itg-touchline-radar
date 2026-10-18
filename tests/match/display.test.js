import { describe, expect, it } from "vitest";
import { displayBall } from "../../src/match/display.js";

describe("displayBall", () => {
  const fallback = { x: 50, y: 50 };

  it("goal net first", () => {
    expect(displayBall({ incident: "goal", team: "home", y: 50 }, fallback)).toEqual({
      x: 97.2,
      y: 50,
    });
  });

  it("fallback chain", () => {
    expect(
      displayBall({ incident: "shotontarget", team: "away", x: 20, y: 50 }, fallback),
    ).toMatchObject({ x: 2.8 });
    expect(
      displayBall({ incident: "goalkeeper_saved", team: "home", y: 50 }, fallback),
    ).toMatchObject({ x: 3.5 });
    expect(displayBall({ incident: "kickoff" }, fallback)).toEqual({ x: 50, y: 50 });
    expect(
      displayBall({ incident: "corner", team: "away", y: 80 }, fallback),
    ).toEqual({ x: 1.5, y: 97.65625 });
    expect(displayBall({ incident: "throwin", x: 40, y: 10 }, fallback)).toEqual({
      x: 40,
      y: 2.34375,
    });
    expect(displayBall({ incident: "throwin", x: 55, y: 80 }, fallback)).toEqual({
      x: 55,
      y: 97.65625,
    });
  });
});
