import "dotenv/config";
import { createServer } from "vite";
import path from "node:path";
import { resolveEpisodeId } from "../editor/server/api-plugin";

async function main() {
  const episodeId = resolveEpisodeId(process.argv.slice(2));
  process.env.EDITOR_EPISODE = episodeId;

  const server = await createServer({
    configFile: path.resolve(__dirname, "../editor/vite.config.ts"),
  });

  await server.listen();
  const info = server.resolvedUrls;
  const url = info?.local[0] ?? "http://localhost:5173/";
  console.log(`[editor] episode=${episodeId}`);
  console.log(`[editor] ${url}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
