// builder/vite.config.ts — configure the graphical builder and its unit tests.
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { pythonPlotRendererPlugin } from "./src/server/pythonPlotServer";

export default defineConfig({
  plugins: [react(), pythonPlotRendererPlugin()],
  define: {
    "process.env.IS_PREACT": JSON.stringify("false"),
  },
  server: {
    fs: {
      allow: [".."],
    },
  },
  test: {
    environment: "jsdom",
  },
});
