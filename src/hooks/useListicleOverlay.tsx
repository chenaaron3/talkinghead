import React from "react";
import { useCurrentFrame } from "remotion";

import { TikTokListicle } from "../components/TikTokListicle";

import type { ListicleOverlay } from "../lib/types";

export function useListicleOverlay(listicle: ListicleOverlay | null): {
  active: boolean;
  showTitle: boolean;
  node: React.ReactNode;
} {
  const frame = useCurrentFrame();
  const active =
    listicle != null &&
    frame >= listicle.startFrame &&
    frame < listicle.endFrame;

  return {
    active,
    showTitle: !active,
    node: listicle ? <TikTokListicle listicle={listicle} /> : null,
  };
}
