import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dashboard lives at /app, both in dev and when served by the API in production.
export default defineConfig({
  base: "/app/",
  plugins: [react()],
  server: { port: 5173 },
});
