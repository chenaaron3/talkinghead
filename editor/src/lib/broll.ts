import type { BRollClip, EpisodeProps } from "@src/lib/types";

export function bRollsOverlap(
  clips: BRollClip[],
  candidate: { startFrame: number; endFrame: number; id?: string },
): boolean {
  return clips.some((clip) => {
    if (candidate.id && clip.id === candidate.id) return false;
    return (
      candidate.startFrame < clip.endFrame &&
      candidate.endFrame > clip.startFrame
    );
  });
}

export function upsertBRoll(
  props: EpisodeProps,
  clip: BRollClip,
): EpisodeProps | { error: string } {
  const others = (props.bRolls ?? []).filter((c) => c.id !== clip.id);
  if (clip.endFrame <= clip.startFrame) {
    return { error: "B-roll end must be after start" };
  }
  if (bRollsOverlap(others, clip)) {
    return { error: "B-roll overlaps another clip" };
  }
  return {
    ...props,
    bRolls: [...others, clip].sort((a, b) => a.startFrame - b.startFrame),
  };
}

export function removeBRoll(props: EpisodeProps, id: string): EpisodeProps {
  return {
    ...props,
    bRolls: (props.bRolls ?? []).filter((c) => c.id !== id),
  };
}
