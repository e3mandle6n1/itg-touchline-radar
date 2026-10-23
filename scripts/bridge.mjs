import { createServer } from "node:http";
import { EventHubConsumerClient, earliestEventPosition } from "@azure/event-hubs";
import { applyMessage, emptyFeed } from "../src/feed.js";
import { hubSettings } from "./hub.mjs";
import { waitForHub } from "./wait-for-hub.mjs";

const { connectionString, eventHubName, consumerGroup } = hubSettings();
const port = Number(process.env.BRIDGE_PORT);
const host = process.env.BRIDGE_HOST;
if (!port || !host) throw new Error("Bridge address is missing. It lives in compose.yml.");
const feeds = new Map();
const clients = new Set();

function writeEvent(res, name, data) {
  res.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
}

function broadcast(message) {
  for (const client of clients) {
    if (client.matchId === message.matchId) writeEvent(client.res, message.kind, message);
  }
}

function readMessage(body) {
  if (typeof body === "string") return JSON.parse(body);
  if (Buffer.isBuffer(body)) return JSON.parse(body.toString());
  return body;
}

const consumer = new EventHubConsumerClient(consumerGroup, connectionString, eventHubName);
await waitForHub(consumer);
const subscription = consumer.subscribe({
  processEvents: async (events) => {
    for (const event of events) {
      const message = readMessage(event.body);
      if (!message?.matchId) continue;
      const current = feeds.get(message.matchId) || emptyFeed();
      const next = applyMessage(current, message);
      if (next === current) continue;
      feeds.set(message.matchId, next);
      broadcast(message);
    }
  },
  processError: async (err) => {
    console.error(err.message);
  },
}, { startPosition: earliestEventPosition });

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const match = url.pathname.match(/^\/live\/([^/]+)$/);
  if (req.method !== "GET" || !match) {
    res.writeHead(404);
    res.end();
    return;
  }

  const matchId = decodeURIComponent(match[1]);
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });

  const feed = feeds.get(matchId);
  if (feed?.fixture) {
    writeEvent(res, "fixture", {
      matchId,
      seq: 0,
      kind: "fixture",
      situationCount: feed.situationCount,
      fixture: feed.fixture,
    });
    for (const situation of feed.situations) {
      writeEvent(res, "situation", { kind: "situation", situation });
    }
  }

  const client = { matchId, res };
  clients.add(client);
  const beat = setInterval(() => res.write(": ping\n\n"), 15000);
  req.on("close", () => {
    clearInterval(beat);
    clients.delete(client);
  });
});

server.listen(port, host, () => {
  console.log(`bridge http://${host}:${port}  hub ${eventHubName}`);
});

async function shutdown() {
  server.close();
  await subscription.close();
  await consumer.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
