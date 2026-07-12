import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

import { TikTokListicle } from "../components/TikTokListicle";

import type { ListicleOverlay } from "../lib/types";

/** Title stays up this long even if a listicle starts earlier. */
const MIN_TITLE_SEC = 3;

export function useListicleOverlay(listicle: ListicleOverlay | null): {
  active: boolean;
  showTitle: boolean;
  node: React.ReactNode;
} {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const active =
    listicle != null &&
    frame >= listicle.startFrame &&
    frame < listicle.endFrame;

  const minTitleFrames = Math.round(MIN_TITLE_SEC * fps);

  return {
    active,
    showTitle: !active || frame < minTitleFrames,
    node: listicle ? <TikTokListicle listicle={listicle} /> : null,
  };
}
