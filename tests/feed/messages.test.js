import { describe, expect, it } from "vitest";
import { applyMessage, emptyFeed, feedMatch, feedMessages } from "../../src/feed.js";

const match = {
  id: 7,
  competition: "Continental Cup",
  home: { name: "Northbridge" },
  away: { name: "Rivermark" },
  score: { home: 1, away: 0, ht: "0 : 0" },
  events: [{ type: "goal" }],
  situations: [
    { minute: 1, clock: "1'", team: "home", phase: "safe", x: 10, y: 20 },
    { minute: 12, clock: "12'", team: "home", phase: "dangerous", x: 90, y: 50, incident: "goal", player: "Dekker, Niels" },
  ],
};

describe("feed messages", () => {
  it("sends the fixture first, then each situation", () => {
    const messages = feedMessages(match, "01-northbridge");
    expect(messages.map((row) => row.seq)).toEqual([0, 1, 2]);
    expect(messages[0].kind).toBe("fixture");
    expect(messages[0].situationCount).toBe(2);
    expect(messages[0].fixture.situations).toBeUndefined();
    expect(messages[0].fixture.events).toBeUndefined();
    expect(messages[0].fixture.home.name).toBe("Northbridge");
    expect(messages[2].situation.incident).toBe("goal");
  });

  it("folds a stream and ignores a repeated seq", () => {
    let feed = emptyFeed();
    for (const message of feedMessages(match, "01-northbridge")) {
      feed = applyMessage(feed, message);
    }
    feed = applyMessage(feed, feedMessages(match, "01-northbridge")[2]);
    expect(feed.situations).toHaveLength(2);
    expect(feedMatch(feed).status).toBe("Live");
    expect(feedMatch(feed).events).toEqual([]);
    expect(feedMatch(feed).situations[1].player).toBe("Dekker, Niels");
  });
});
