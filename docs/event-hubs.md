# Event Hubs

Bridge mode reads a situation log. A publisher pushes one match onto an Event Hub. A small bridge reads that hub and streams it to the page. Replay reads `feeds/matches/`, which stays on this machine.

The Docker stack is the [Azure Event Hubs emulator](https://learn.microsoft.com/en-us/azure/event-hubs/test-locally-with-event-hub-emulator) plus Azurite. The Node client is `@azure/event-hubs`. On Azure, point `EVENT_HUB_CONNECTION` at a real namespace and remove `UseDevelopmentEmulator=true`. The hub name stays `matches`.

Starting the compose file accepts the emulator licence (`ACCEPT_EULA=Y`).

## Layout

```text
compose.yml                          emulator, Azurite, bridge, publisher, web
infra/web/Dockerfile                 the page
infra/eventhubs/Dockerfile           image the bridge and publisher run
infra/eventhubs/config.json          emulator hub and consumer group
scripts/bridge.mjs                   hub → GET /live/:matchId  (SSE)
scripts/publish-feed.mjs             file → hub
```

The match id on the hub is the file name without `.json`, so `01-northbridge.json` is the catalog id `01-northbridge`.

## Messages

Seq `0` is the fixture. Teams, form, standings, and lineups travel on it. `situations` and `events` do not. Each later message is one situation, the same object `buildPlayTrack` already reads.

```json
{ "matchId": "01-northbridge", "seq": 0, "kind": "fixture", "situationCount": 901, "fixture": {} }
{ "matchId": "01-northbridge", "seq": 1, "kind": "situation", "situation": { "minute": 0, "clock": "0'", "team": "home", "phase": "safe", "x": 50, "y": 50 } }
```

The bridge drops a repeated `seq`.

## Run

Docker Desktop has to be running. Compose starts the page, Azurite, the Event Hubs emulator, the bridge, and a publisher for Northbridge.

```bash
docker compose up -d --build
```

Stop it with `docker compose down`. That stops the page as well.

Open [http://localhost:4173](http://localhost:4173) and choose Bridge, or add `?live=1`.

The publisher waits 240ms between situations. The emulator forgets the log when its container is recreated. Publish again with:

```bash
docker compose up -d --force-recreate publisher
```

To publish a different file, or to change that gap:

```bash
docker compose run --rm publisher \
  node scripts/publish-feed.mjs /matches/02-pens-miss.json --interval 20
```

Hold feed pauses the page. The hub keeps going, and Resume applies what arrived in the meantime.

## Configuration

`compose.yml` sets the connection string, hub name, and consumer group on the bridge and the publisher. The page proxies `/live` to the bridge. The browser never sees the connection string.
