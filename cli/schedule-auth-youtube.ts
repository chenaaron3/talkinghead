import { authorizeYouTubeInteractive } from "./schedule/platforms/youtube";

authorizeYouTubeInteractive().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
