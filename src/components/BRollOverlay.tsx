import React, { useRef, useState } from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { containSize } from "../lib/broll-layout";
import type { BRollClip } from "../lib/types";

const FADE_SEC = 0.12;

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

  const scale = clip.scale ?? 1;
  const offsetX = clip.offsetX ?? 0;
  const offsetY = clip.offsetY ?? 0;
  const rotation = clip.rotation ?? 0;

  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [handle] = useState(() => delayRender(`broll-size-${clip.id}`));
  const doneRef = useRef(false);

  const finishSize = (w: number, h: number) => {
    if (doneRef.current) return;
    doneRef.current = true;
    setNat({ w, h });
    continueRender(handle);
  };

  const fitted = nat ? containSize(nat.w, nat.h, width, height) : null;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.55)" }} />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: fitted?.w ?? undefined,
          height: fitted?.h ?? undefined,
          transform: `translate(${offsetX * width}px, ${offsetY * height}px) rotate(${rotation}deg) scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        <Img
          src={staticFile(clip.src)}
          onLoad={(e) => {
            const img = e.currentTarget;
            finishSize(img.naturalWidth, img.naturalHeight);
          }}
          onError={() => {
            // Fall back to full-frame contain so render never hangs.
            finishSize(width, height);
          }}
          style={{
            display: "block",
            width: fitted ? fitted.w : "100%",
            height: fitted ? fitted.h : "auto",
            objectFit: "fill",
          }}
        />
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
