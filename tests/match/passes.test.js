import { describe, expect, it } from "vitest";
import { buildPasses, passFrom } from "../../src/match/passes.js";

function spot(x, y, extra = {}) {
  return {
    minute: 1,
    team: "home",
    phase: "safe",
    type: "match_action",
    x,
    y,
    ...extra,
  };
}

describe("buildPasses", () => {
  it("empty track", () => {
    expect(buildPasses([])).toEqual([]);
    expect(buildPasses(null)).toEqual([]);
  });

  it("collapses a straight run into one pass", () => {
    const track = [10, 16, 22, 30, 40].map((x) => spot(x, 50));
    const passes = buildPasses(track);
    expect(passes).toHaveLength(1);
    expect(passes[0].start).toBe(0);
    expect(passes[0].end).toBe(4);
    expect(passes[0].from).toEqual({ x: 10, y: 50 });
    expect(passes[0].to).toEqual({ x: 40, y: 50 });
    expect(passes[0].team).toBe("home");
  });

  it("splits when the ball changes direction", () => {
    const track = [
      spot(10, 50),
      spot(20, 50),
      spot(30, 50),
      spot(30, 62),
      spot(30, 74),
      spot(30, 86),
    ];
    const passes = buildPasses(track);
    expect(passes.length).toBeGreaterThan(1);
    expect(passes[0].to.y).toBe(50);
    expect(passes.at(-1).to).toEqual({ x: 30, y: 86 });
  });

  it("splits on team and on a hard incident", () => {
    const track = [
      spot(10, 40),
      spot(24, 40),
      spot(36, 48),
      spot(50, 50, { team: "away", phase: "attack" }),
      spot(62, 50, { team: "away", phase: "attack" }),
      spot(70, 20, { incident: "throwin", team: "away" }),
      spot(78, 30, { team: "away", phase: "safe" }),
      spot(90, 36, { team: "away", phase: "safe" }),
    ];
    const passes = buildPasses(track);
    expect(passes.some((pass) => pass.team === "home")).toBe(true);
    expect(passes.some((pass) => pass.team === "away")).toBe(true);
    expect(passes.every((pass) => pass.end < 5 || pass.start > 5)).toBe(true);
  });

  it("keeps pass/possession/pressure in one open-play run", () => {
    const track = [
      spot(20, 50),
      spot(28, 52, { incident: "pass", type: "pass" }),
      spot(36, 48, { incident: "possession", type: "possession" }),
      spot(44, 50, { incident: "pressure", type: "pressure" }),
      spot(55, 50),
    ];
    const passes = buildPasses(track);
    expect(passes.length).toBeGreaterThanOrEqual(1);
    expect(passes.some((pass) => pass.start === 0 && pass.end === 4)).toBe(true);
  });

  it("passFrom is the pass still in flight", () => {
    const track = [10, 20, 30, 40].map((x) => spot(x, 50));
    const passes = buildPasses(track);
    expect(passFrom(passes, 0)?.end).toBe(3);
    expect(passFrom(passes, 2)?.end).toBe(3);
    expect(passFrom(passes, 3)).toBeNull();
    expect(passFrom([], 0)).toBeNull();
  });
});
