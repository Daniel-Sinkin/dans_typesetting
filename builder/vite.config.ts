// builder/vite.config.ts — configure the graphical builder and its unit tests.
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { pythonPlotRendererPlugin } from "./src/server/pythonPlotServer";
import { nvimEditorServerPlugin } from "./src/server/nvimServer";

export default defineConfig({
  plugins: [react(), pythonPlotRendererPlugin(), nvimEditorServerPlugin()],
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
