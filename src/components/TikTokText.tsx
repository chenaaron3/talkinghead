import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

import type { CaptionGroupStyle } from "../lib/captions/style";
import { DEFAULT_TEXT_STYLE } from "../lib/text/templates";
import type { AudioAsset } from "../lib/types";

import { buildStaticGroup } from "./captions/static-group";
import { StaticGroupView } from "./captions/StaticGroupView";
import { SfxInsert } from "./SfxOverlay";

export const TikTokText: React.FC<{
  text: string;
  durationSec: number;
  style?: CaptionGroupStyle;
  /** Omit / null = silent. */
  sfx?: AudioAsset | null;
}> = ({ text, durationSec, style: styleProp, sfx: sfxProp }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = styleProp ?? DEFAULT_TEXT_STYLE;

  const durationFrames = Math.round(durationSec * fps);
  const group = useMemo(
    () => buildStaticGroup(text, style, fps, durationFrames),
    [text, style, fps, durationFrames],
  );

  const sfx = <SfxInsert sfx={sfxProp} />;

  if (frame >= durationFrames) {
    return sfx;
  }

  return (
    <>
      {sfx}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <StaticGroupView group={group} frame={frame} fps={fps} />
      </AbsoluteFill>
    </>
  );
};
