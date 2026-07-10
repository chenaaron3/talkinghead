import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { EpisodeProps } from "./types";
import { ROOT } from "./types";

function runRemotion(args: string[], label: string) {
  console.log(`[${label}] pnpm ${args.join(" ")}`);
  const result = spawnSync("pnpm", args, {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed`);
  }
}

export function renderEpisode(options: {
  episodeId: string;
  episodeDir: string;
}): { videoPath: string; coverPath: string } {
  const propsPath = path.join(options.episodeDir, "generated", "props.json");

  if (!fs.existsSync(propsPath)) {
    throw new Error(
      `Missing ${propsPath} for episode ${options.episodeId}`,
    );
  }

  const props = JSON.parse(fs.readFileSync(propsPath, "utf8")) as EpisodeProps;
  const outDir = path.join(ROOT, "out", options.episodeId);
  fs.mkdirSync(outDir, { recursive: true });

  const videoPath = path.join(outDir, "video.mp4");
  const coverPath = path.join(outDir, "cover.jpg");

  console.log(`[render] episode=${options.episodeId} fps=${props.fps}`);

  runRemotion(
    [
      "remotion",
      "render",
      "TalkingHead",
      videoPath,
      `--props=${propsPath}`,
    ],
    "render",
  );
  console.log(`[done] ${videoPath}`);

  runRemotion(
    [
      "remotion",
      "still",
      "Cover",
      coverPath,
      `--props=${propsPath}`,
      "--frame=0",
      "--image-format=jpeg",
    ],
    "cover",
  );
  console.log(`[done] ${coverPath}`);

  return { videoPath, coverPath };
}
