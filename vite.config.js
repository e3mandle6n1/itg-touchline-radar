import { createReadStream, existsSync, statSync } from "node:fs";
import { join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const feedsRoot = process.env.FEEDS_ROOT || fileURLToPath(new URL("./feeds", import.meta.url));

function serveFeeds() {
  const send = (req, res, next) => {
    const path = req.url?.split("?")[0];
    if (path !== "/match.json" && !path?.startsWith("/matches/")) return next();
    const rel = path === "/match.json" ? "match.json" : path.slice(1);
    const file = normalize(join(feedsRoot, rel));
    if (!file.startsWith(`${feedsRoot}${sep}`)) return next();
    if (!existsSync(file) || !statSync(file).isFile()) return next();
    res.setHeader("content-type", "application/json");
    createReadStream(file).pipe(res);
  };
  return {
    name: "feeds",
    configureServer(server) {
      server.middlewares.use(send);
    },
    configurePreviewServer(server) {
      server.middlewares.use(send);
    },
  };
}

export default defineConfig({
  plugins: [react(), serveFeeds()],
  server: {
    host: process.env.HOST || "127.0.0.1",
    port: 4173,
    strictPort: true,
    proxy: {
      "/live": process.env.BRIDGE_URL || "http://127.0.0.1:8787",
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
  },
});
