import path from "node:path";
import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import type { EpisodeProps } from "./helpers/types";
import { ROOT } from "./helpers/types";

export type RenderProgress = {
  phase: "bundle" | "video" | "cover";
  /** 0–1 within the current phase. */
  progress: number;
  /** 0–1 across the whole export (video ~90%, cover ~10%). */
  overall: number;
};

type ProgressCb = (p: RenderProgress) => void;

async function getServeUrl(): Promise<string> {
  // Bundle fresh each export so newly-linked public/episodes assets are included.
  return bundle({
    entryPoint: path.join(ROOT, "src", "index.ts"),
    webpackOverride: (config) => config,
  });
}

function overallFor(phase: RenderProgress["phase"], progress: number): number {
  if (phase === "bundle") return progress * 0.05;
  if (phase === "video") return 0.05 + progress * 0.85;
  return 0.9 + progress * 0.1;
}

export async function renderEpisode(options: {
  episodeId: string;
  episodeDir: string;
  onProgress?: ProgressCb;
}): Promise<{ videoPath: string; coverPath: string }> {
  const propsPath = path.join(options.episodeDir, "generated", "props.json");
  const { readFileSync, mkdirSync, existsSync } = await import("node:fs");

  if (!existsSync(propsPath)) {
    throw new Error(
      `Missing ${propsPath} for episode ${options.episodeId}`,
    );
  }

  const props = JSON.parse(readFileSync(propsPath, "utf8")) as EpisodeProps;
  const outDir = path.join(ROOT, "out", options.episodeId);
  mkdirSync(outDir, { recursive: true });

  const videoPath = path.join(outDir, "video.mp4");
  const coverPath = path.join(outDir, "cover.jpg");
  const report = options.onProgress;

  console.log(`[render] episode=${options.episodeId} fps=${props.fps}`);

  report?.({ phase: "bundle", progress: 0, overall: 0 });
  const serveUrl = await getServeUrl();
  report?.({ phase: "bundle", progress: 1, overall: overallFor("bundle", 1) });

  const videoComposition = await selectComposition({
    serveUrl,
    id: "TalkingHead",
    inputProps: props,
  });

  await renderMedia({
    composition: videoComposition,
    serveUrl,
    codec: "h264",
    outputLocation: videoPath,
    inputProps: props,
    onProgress: ({ progress }) => {
      report?.({
        phase: "video",
        progress,
        overall: overallFor("video", progress),
      });
    },
  });
  console.log(`[done] ${videoPath}`);

  const coverComposition = await selectComposition({
    serveUrl,
    id: "Cover",
    inputProps: props,
  });

  report?.({
    phase: "cover",
    progress: 0,
    overall: overallFor("cover", 0),
  });
  await renderStill({
    composition: coverComposition,
    serveUrl,
    output: coverPath,
    inputProps: props,
    frame: 0,
    imageFormat: "jpeg",
  });
  console.log(`[done] ${coverPath}`);
  report?.({ phase: "cover", progress: 1, overall: 1 });

  return { videoPath, coverPath };
}
