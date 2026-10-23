import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { EventHubProducerClient } from "@azure/event-hubs";
import { feedMessages } from "../src/feed.js";
import { hubSettings } from "./hub.mjs";
import { sleep, waitForHub } from "./wait-for-hub.mjs";

const INTERVAL_MS = 240;

function parseArgs(argv) {
  const out = { file: "", interval: INTERVAL_MS };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--interval") {
      out.interval = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (!arg.startsWith("-")) out.file = arg;
  }
  return out;
}

const { file, interval } = parseArgs(process.argv.slice(2));
if (!file) {
  console.error("usage: node scripts/publish-feed.mjs <match.json> [--interval ms]");
  process.exit(1);
}
if (!Number.isFinite(interval) || interval < 0) {
  console.error("--interval must be a number of milliseconds");
  process.exit(1);
}

const matchId = basename(file).replace(/\.json$/, "");
const match = JSON.parse(readFileSync(file, "utf8"));
const messages = feedMessages(match, matchId);
const { connectionString, eventHubName } = hubSettings();
const producer = new EventHubProducerClient(connectionString, eventHubName);
await waitForHub(producer);

for (const message of messages) {
  const batch = await producer.createBatch({ partitionKey: matchId });
  const added = batch.tryAdd({ body: JSON.stringify(message), contentType: "application/json" });
  if (!added) throw new Error(`message ${message.seq} did not fit in a batch`);
  await producer.sendBatch(batch);
  const label = message.kind === "fixture"
    ? `fixture ${message.situationCount} situations`
    : message.situation.clock || message.situation.incident || "sample";
  console.log(`${message.seq}/${messages.length - 1} ${label}`);
  if (message.kind === "situation" && interval > 0) await sleep(interval);
}

await producer.close();
console.log(`published ${matchId} to ${eventHubName}`);
