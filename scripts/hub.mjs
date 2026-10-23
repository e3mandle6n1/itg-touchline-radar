export function hubSettings() {
  const connectionString = process.env.EVENT_HUB_CONNECTION;
  const eventHubName = process.env.EVENT_HUB_NAME;
  const consumerGroup = process.env.EVENT_HUB_CONSUMER_GROUP;
  if (!connectionString || !eventHubName || !consumerGroup) {
    throw new Error("Hub settings are missing. They live in compose.yml.");
  }
  return { connectionString, eventHubName, consumerGroup };
}
