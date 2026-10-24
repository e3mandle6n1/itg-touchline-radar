import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const api = process.env.API_URL || "http://127.0.0.1:8080";

export default defineConfig({
  plugins: [react()],
  server: {
    host: process.env.HOST || "127.0.0.1",
    port: 4173,
    strictPort: true,
    proxy: {
      "/api": { target: api, changeOrigin: true },
      // Bridge SSE can run for many minutes — do not let the proxy idle-out the stream.
      "/live": {
        target: api,
        changeOrigin: true,
        timeout: 0,
        proxyTimeout: 0,
      },
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
  },
});
