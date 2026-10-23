# Touchline Radar

React live match tracker. Replay reads the local files under `feeds/matches/` (not committed). Bridge mode follows a situation log on Event Hubs. Default fixture: Northbridge 3-0 Rivermark.

## Structure

```text
src/
  App.jsx
  views/LiveTracker.jsx
  hooks/                  # playback + ball chase
  match/                  # play track, set-pieces, H2H demo data
  components/
    pitch/                # stage, live action, FT cards
    tips/                 # origin / centre / card / set-piece tips
    *.jsx                 # scoreboard, tabs, lineups, ...
  styles/app.css
tests/
  match/                  # Vitest unit tests for src/match
public/
  icons/
feeds/                    # local match files, not committed
scripts/
  enrich-situations.mjs   # rebuilds situations[] from events
  generate-scenarios.mjs  # rebuild scenario feeds
  publish-feed.mjs        # publish one match onto the hub
  bridge.mjs              # hub → SSE for Bridge mode
compose.yml               # emulator, bridge, publisher
infra/eventhubs/          # emulator config and image
docs/
  HACKATHON-PLAN.md       # Inside the Game plan + decision log
  INSIGHTS-TOOLS.md       # insights tool contracts + grounding
  event-hubs.md           # local hub, publisher, bridge
```

## Run

```bash
docker compose up -d --build
```

Open [http://localhost:4173](http://localhost:4173). `docker compose down` stops the page and the hub. Use the Match dropdown to switch feeds, or `?match=04-et-pens-sudden-death`.

**Bridge mode** follows the hub: Mode → Bridge (or `?live=1`). The page starts empty and appends each situation as the publisher sends it. Hold feed pauses the page. The hub keeps going. Setup: [docs/event-hubs.md](docs/event-hubs.md).

Edit a feed's `events`, then:

```bash
npm run enrich -- feeds/matches/02-pens-miss.json
# or all:
npm run enrich:all
```

Regenerate scenarios from scratch:

```bash
npm run scenarios && npm run enrich:all
```

## Test

```bash
npm test
npm run test:watch
```
