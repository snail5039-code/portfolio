import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The app only ever calls same-origin relative "/api/..." paths. The dev server
// forwards them to the local FastAPI fixture backend, so no browser request is
// ever made to an external host and no CORS preflight is involved.
//
// VITE_API_PORT/VITE_PORT let the Playwright config (playwright.config.ts)
// point a test instance at its own backend/frontend ports instead of the ones
// a developer's manually-running `npm run dev` uses, so a test run never
// shares (and mutates) the same in-memory approval store as a dev session.
const LOCAL_FIXTURE_API = `http://127.0.0.1:${process.env.VITE_API_PORT ?? 8000}`;

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: Number(process.env.VITE_PORT ?? 5173),
    proxy: {
      "/api": {
        target: LOCAL_FIXTURE_API,
        changeOrigin: false
      }
    }
  }
});
