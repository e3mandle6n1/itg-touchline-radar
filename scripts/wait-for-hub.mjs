export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForHub(client) {
  let last;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      await client.getEventHubProperties();
      return;
    } catch (err) {
      last = err;
      console.error(`hub not ready (${attempt}): ${err.message}`);
      await sleep(2000);
    }
  }
  throw last;
}
