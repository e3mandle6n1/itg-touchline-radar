import { describe, expect, it } from "vitest";
import { explainMoment, insightHeadline } from "../../src/match/insight.js";

const match = {
  home: { name: "Northbridge" },
  away: { name: "Rivermark" },
};

describe("explainMoment", () => {
  it("explains a goal after a shot spell with why-it-matters", () => {
    const playTrack = [
      { type: "shotblocked", incident: "shotblocked", team: "home", minute: 63, x: 85, y: 40 },
      { type: "pressure", incident: "pressure", team: "home", minute: 63, x: 88, y: 45, player: "Santos, Paulo" },
      { type: "shotontarget", incident: "shotontarget", team: "home", minute: 63, x: 90, y: 50, player: "Navarro, Diego" },
      { type: "goal", incident: "goal", team: "home", minute: 64, x: 94, y: 68, player: "Dekker, Niels", score: { home: 1, away: 0 } },
    ];
    const insight = explainMoment(playTrack, 3, match);
    expect(insight).toBeTruthy();
    expect(insight.importance).toBe("high");
    expect(insight.why).toMatch(/pressure|payoff|scoreline|pivots/i);
    expect(insightHeadline(insight, "casual")).toMatch(/Dekker|Northbridge/i);
    expect(insightHeadline(insight, "analyst")).toBeTruthy();
  });

  it("flashes pass quality on hard progressive passes", () => {
    const playTrack = [
      {
        type: "pass",
        incident: "pass",
        team: "home",
        minute: 20,
        x: 55,
        y: 40,
        player: "Quinn, Miles",
        distance: 32,
        difficulty: "hard",
        speed: 70,
      },
    ];
    const insight = explainMoment(playTrack, 0, match);
    expect(insight.metric?.label).toMatch(/32m/i);
    expect(insight.why).toMatch(/chance|switch|line-break/i);
  });

  it("prefers server-authored why when present", () => {
    const playTrack = [
      {
        type: "goal",
        incident: "goal",
        team: "home",
        minute: 64,
        player: "Dekker, Niels",
        why: "Custom why from feed.",
        casual: "Custom casual.",
        analyst: "Custom analyst.",
        state: "siege",
        importance: "high",
      },
    ];
    const insight = explainMoment(playTrack, 0, match);
    expect(insight.why).toBe("Custom why from feed.");
    expect(insightHeadline(insight, "analyst")).toBe("Custom analyst.");
  });

  it("skips anonymous match_action ticks", () => {
    expect(explainMoment([{ type: "match_action", team: "home", x: 50, y: 50 }], 0, match)).toBeNull();
  });
});
