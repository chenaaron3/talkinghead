import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

import { BRollOverlay } from "./BRollOverlay";

import type { LocationVfxClip, ShakeVfxClip, VfxClip } from "../lib/types";

/**
 * Deterministic “noise” in [-1, 1] from frame + salt (stable across renders).
 */
function shakeSample(frame: number, salt: number): number {
  const x = Math.sin(frame * 12.9898 + salt * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function activeShakeOffset(
  shakes: ShakeVfxClip[],
  frame: number,
  width: number,
  height: number,
): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const clip of shakes) {
    if (frame < clip.startFrame || frame >= clip.endFrame) continue;
    const t = frame - clip.startFrame;
    const ampX = clip.intensity * width;
    const ampY = clip.intensity * height;
    // Mix fast jitter with a slower sway so it reads as camera shake.
    x +=
      (shakeSample(t, 1) * 0.65 + Math.sin(t * 1.7) * 0.35) * ampX;
    y +=
      (shakeSample(t, 2) * 0.65 + Math.cos(t * 2.1) * 0.35) * ampY;
  }
  return { x, y };
}

/**
 * Applies active shake VFX to children (A-roll / overlays).
 * Captions stay outside this wrapper so chrome stays readable.
 */
export const ScreenShake: React.FC<{
  shakes: ShakeVfxClip[];
  children: React.ReactNode;
}> = ({ shakes, children }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { x, y } = activeShakeOffset(shakes, frame, width, height);

  if (shakes.length === 0) {
    return <>{children}</>;
  }

  return (
    <AbsoluteFill
      style={{
        transform: `translate(${x}px, ${y}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/**
 * Dispatches VFX by type: location → image overlay; shake handled via ScreenShake.
 */
export const VfxOverlay: React.FC<{ vfx?: VfxClip[] | null }> = ({ vfx }) => {
  const locationClips = useMemo(
    () =>
      (vfx ?? []).filter(
        (clip): clip is LocationVfxClip => clip.type === "location",
      ),
    [vfx],
  );
  if (!locationClips.length) return null;
  return <BRollOverlay bRolls={locationClips} />;
};

export function shakesFromVfx(vfx?: VfxClip[] | null): ShakeVfxClip[] {
  if (!vfx?.length) return [];
  return vfx.filter((clip): clip is ShakeVfxClip => clip.type === "shake");
}
