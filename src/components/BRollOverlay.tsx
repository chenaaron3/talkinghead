import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";

import { containSize } from "../lib/visual/broll-layout";
import {
  VIDEO_BROLL_VOLUME_DEFAULT,
  isVideoSrc,
} from "../lib/episode/media";
import type { BRollClip } from "../lib/types";
import { SfxInsert } from "./SfxOverlay";

const FADE_SEC = 0.12;
const KEN_BURNS_EASING = Easing.inOut(Easing.ease);

function scaleAtFrame(
  frame: number,
  duration: number,
  startScale: number,
  kenBurns: number | undefined,
): number {
  if (kenBurns == null) return startScale;
  const endScale = startScale * kenBurns;
  if (duration <= 1) return endScale;
  return interpolate(frame, [0, duration - 1], [startScale, endScale], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: KEN_BURNS_EASING,
  });
}

const Clip: React.FC<{ clip: BRollClip }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const duration = Math.max(1, clip.endFrame - clip.startFrame);
  const fade = Math.max(1, Math.round(FADE_SEC * fps));
  const opacity =
    duration <= fade * 2
      ? 1
      : interpolate(
          frame,
          [0, fade, duration - fade, duration],
          [1, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

  const startScale = clip.scale ?? 1;
  const scale = scaleAtFrame(frame, duration, startScale, clip.kenBurns);
  const offsetX = clip.offsetX ?? 0;
  const offsetY = clip.offsetY ?? 0;
  const rotation = clip.rotation ?? 0;
  const isVideo = isVideoSrc(clip.src);
  const volume = clip.volume ?? VIDEO_BROLL_VOLUME_DEFAULT;
  const trimBefore = Math.round((clip.mediaOffsetSec ?? 0) * fps);
  const fileSrc = staticFile(clip.src);
  const fitted = containSize(clip.width, clip.height, width, height);
  const mediaStyle: React.CSSProperties = {
    display: "block",
    width: fitted.w,
    height: fitted.h,
    objectFit: "fill",
  };

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <SfxInsert sfx={clip.sfx} />
      <div
        style={{
          position: "relative",
          width: fitted.w,
          height: fitted.h,
          transform: `translate(${offsetX * width}px, ${offsetY * height}px) rotate(${rotation}deg) scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {isVideo ? (
          <Video
            src={fileSrc}
            trimBefore={trimBefore}
            volume={volume}
            muted={volume <= 0}
            objectFit="fill"
            style={mediaStyle}
          />
        ) : (
          <Img src={fileSrc} style={mediaStyle} />
        )}
      </div>
    </AbsoluteFill>
  );
};

export const BRollOverlay: React.FC<{ bRolls?: BRollClip[] | null }> = ({
  bRolls,
}) => {
  if (!bRolls?.length) return null;

  return (
    <>
      {bRolls.map((clip) => {
        const durationInFrames = Math.max(1, clip.endFrame - clip.startFrame);
        return (
          <Sequence
            key={clip.id}
            from={clip.startFrame}
            durationInFrames={durationInFrames}
          >
            <Clip clip={clip} />
          </Sequence>
        );
      })}
    </>
  );
};
