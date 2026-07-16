import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { editorApiPlugin } from "./server/api-plugin";

const ROOT = path.resolve(__dirname, "..");
const defaultEpisodeId = process.env.EDITOR_EPISODE ?? null;

export default defineConfig({
  root: path.resolve(__dirname),
  publicDir: path.join(ROOT, "public"),
  plugins: [react(), tailwindcss(), editorApiPlugin(defaultEpisodeId)],
  resolve: {
    alias: {
      "@src": path.join(ROOT, "src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [ROOT],
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "remotion",
      "@remotion/player",
      "@remotion/media",
    ],
  },
});
