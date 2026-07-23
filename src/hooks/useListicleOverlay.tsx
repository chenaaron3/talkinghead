import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

import { TikTokListicle } from "../components/TikTokListicle";

import type { ListicleOverlay } from "../lib/types";

/** Intro text VFX stays up this long even if a listicle starts earlier. */
const MIN_TEXT_SEC = 3;

export function useListicleOverlay(listicle: ListicleOverlay | null): {
  active: boolean;
  showText: boolean;
  node: React.ReactNode;
} {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const active =
    listicle != null &&
    frame >= listicle.startFrame &&
    frame < listicle.endFrame;

  const minTextFrames = Math.round(MIN_TEXT_SEC * fps);

  return {
    active,
    showText: !active || frame < minTextFrames,
    node: listicle ? <TikTokListicle listicle={listicle} /> : null,
  };
}
