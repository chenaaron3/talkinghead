import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

import { CAPTION_FADE_DURATION_SEC, SAFE_AREA } from "../../lib/episode/constants";
import type { CaptionGroup } from "../../lib/types";

import { CaptionGroupView } from "./CaptionGroupView";

export const TikTokCaptions: React.FC<{
  groups: CaptionGroup[];
}> = ({ groups }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeFrames = Math.max(1, Math.round(CAPTION_FADE_DURATION_SEC * fps));

  const active = groups.find(
    (group) => frame >= group.startFrame && frame < group.endFrame,
  );

  if (!active) {
    return null;
  }

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        top: SAFE_AREA.top,
        bottom: SAFE_AREA.bottom,
        left: SAFE_AREA.left,
        right: SAFE_AREA.right,
        width: "auto",
        height: "auto",
      }}
    >
      <CaptionGroupView
        group={active}
        frame={frame}
        fps={fps}
        fadeFrames={fadeFrames}
      />
    </AbsoluteFill>
  );
};
