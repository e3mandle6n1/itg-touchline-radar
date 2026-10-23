export function feedMessages(match, matchId) {
  const situations = match.situations || [];
  const fixture = { ...match };
  delete fixture.situations;
  delete fixture.events;
  return [
    {
      matchId,
      seq: 0,
      kind: "fixture",
      situationCount: situations.length,
      fixture,
    },
    ...situations.map((situation, index) => ({
      matchId,
      seq: index + 1,
      kind: "situation",
      situation,
    })),
  ];
}

export function emptyFeed() {
  return { fixture: null, situationCount: 0, situations: [], seen: new Set() };
}

export function applyMessage(feed, message) {
  if (!message || (message.kind !== "fixture" && message.kind !== "situation")) return feed;
  if (message.kind === "fixture") {
    return { ...feed, fixture: message.fixture, situationCount: message.situationCount };
  }
  if (feed.seen.has(message.seq)) return feed;
  const seen = new Set(feed.seen);
  seen.add(message.seq);
  return { ...feed, seen, situations: feed.situations.concat(message.situation) };
}

export function feedMatch(feed) {
  if (!feed?.fixture) return null;
  return {
    ...feed.fixture,
    status: "Live",
    events: [],
    situations: feed.situations,
    momentum: [],
  };
}
