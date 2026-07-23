import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { FADE_DURATION_SEC } from "../lib/episode/constants";
import type { AudioAsset } from "../lib/types";
import type { CaptionStyle } from "../lib/captions/style";
import { DEFAULT_TEXT_STYLE } from "../lib/text/templates";
import { CaptionGroupView } from "./captions/CaptionGroupView";
import { buildTextCaptionGroup } from "./captions/text-caption-group";
import { SfxInsert } from "./SfxOverlay";

function fadeOpacity(
  localFrame: number,
  durationFrames: number,
  fadeFrames: number,
): number {
  const duration = Math.max(1, durationFrames);
  if (duration <= 2) {
    return 1;
  }

  const fade = Math.min(fadeFrames, Math.floor((duration - 1) / 2));
  if (fade <= 0) {
    return 1;
  }

  return interpolate(
    localFrame,
    [0, fade, duration - fade, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
}

export const TikTokText: React.FC<{
  text: string;
  durationSec: number;
  style?: CaptionStyle;
  /** Omit / null = silent. */
  sfx?: AudioAsset | null;
}> = ({ text, durationSec, style: styleProp, sfx: sfxProp }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = styleProp ?? DEFAULT_TEXT_STYLE;

  const durationFrames = Math.round(durationSec * fps);
  const fadeFrames = Math.max(1, Math.round(FADE_DURATION_SEC * fps));
  const group = useMemo(
    () => buildTextCaptionGroup(text, style, fps, durationFrames),
    [text, style, fps, durationFrames],
  );

  const sfx = <SfxInsert sfx={sfxProp} />;

  if (frame >= durationFrames) {
    return sfx;
  }

  const opacity = fadeOpacity(frame, durationFrames, fadeFrames);
  const enterFrames = Math.max(1, Math.round(0.2 * fps));
  const stampScale =
    style.animation === "pop"
      ? interpolate(frame, [0, enterFrames], [1.08, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  return (
    <>
      {sfx}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          opacity,
          transform: `scale(${stampScale})`,
        }}
      >
        <CaptionGroupView
          group={group}
          frame={frame}
          fps={fps}
          fadeFrames={fadeFrames}
        />
      </AbsoluteFill>
    </>
  );
};
