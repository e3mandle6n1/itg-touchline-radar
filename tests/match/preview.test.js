import { describe, expect, it } from "vitest";
import { countdownParts, goalsByPeriod, kickoffDate, kickoffLabel, winChance } from "../../src/match/preview.js";

describe("kickoffDate", () => {
  it("is 18:45 today while that is still ahead", () => {
    const now = new Date(2026, 9, 21, 15, 13, 16);
    const kick = kickoffDate(now);
    expect(kick.getDate()).toBe(21);
    expect(kick.getHours()).toBe(18);
    expect(kick.getMinutes()).toBe(45);
    expect(kickoffLabel(now)).toBe("21 Oct · 18:45");
  });

  it("rolls to the next day after 18:45", () => {
    const now = new Date(2026, 9, 21, 19, 0, 0);
    const kick = kickoffDate(now);
    expect(kick.getDate()).toBe(22);
    expect(kick.getHours()).toBe(18);
  });
});

describe("countdownParts", () => {
  it("splits the gap into days, hours, minutes, seconds", () => {
    const now = new Date(2026, 9, 21, 15, 13, 16).getTime();
    const kick = new Date(2026, 9, 21, 18, 45, 0).getTime();
    expect(countdownParts(kick, now)).toEqual({ days: 0, hrs: 3, mins: 31, secs: 44 });
  });

  it("stays at zero once kickoff has passed", () => {
    expect(countdownParts(1000, 5000)).toEqual({ days: 0, hrs: 0, mins: 0, secs: 0 });
  });
});

describe("winChance", () => {
  it("sums to 100 and favours the higher side", () => {
    const win = winChance(80, 40, 3, 32);
    expect(win.home + win.draw + win.away).toBe(100);
    expect(win.home).toBeGreaterThan(win.away);
    expect(win.draw).toBeGreaterThan(0);
  });
});

describe("goalsByPeriod", () => {
  it("returns a bar for each period mark", () => {
    const rows = goalsByPeriod(2.4, 0);
    expect(rows.map((row) => row.minute)).toEqual([15, 30, 45, 60, 75, 90]);
    const sum = rows.reduce((total, row) => total + row.value, 0);
    expect(sum).toBeGreaterThan(2);
    expect(sum).toBeLessThan(2.8);
  });
});
