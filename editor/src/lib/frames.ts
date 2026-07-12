import type { EpisodeProps } from "@src/lib/types";

/**
 * Frame math between the two timelines:
 * - "source" = the raw recorded video
 * - "output" = the edited result (sections played back to back)
 *
 * A source frame is the stable identity of a moment; everything that survives
 * an edit is remapped source → new output.
 */

export type Section = EpisodeProps["sections"][number];

/** Total length of the output timeline. */
export function outputDuration(sections: Section[]): number {
  return sections.reduce((sum, s) => sum + s.durationInFrames, 0);
}

/** Output timeline frame → source video frame. */
export function outputToSourceFrame(
  outputFrame: number,
  sections: Section[],
): number | null {
  let cursor = 0;
  for (const s of sections) {
    const end = cursor + s.durationInFrames;
    if (outputFrame >= cursor && outputFrame < end) {
      return s.trimBefore + (outputFrame - cursor);
    }
    cursor = end;
  }
  if (sections.length > 0 && outputFrame === cursor) {
    return sections[sections.length - 1]!.trimAfter;
  }
  return null;
}

/** Source video frame → output timeline frame, or null if that moment is cut. */
export function sourceToOutputFrame(
  sourceFrame: number,
  sections: Section[],
): number | null {
  let cursor = 0;
  for (const s of sections) {
    if (sourceFrame >= s.trimBefore && sourceFrame < s.trimAfter) {
      return cursor + (sourceFrame - s.trimBefore);
    }
    cursor += s.durationInFrames;
  }
  return null;
}

/** Re-locate an output frame after the sections changed, via its source frame. */
export function remapFrameViaSource(
  frame: number,
  oldSections: Section[],
  newSections: Section[],
): number | null {
  const src = outputToSourceFrame(frame, oldSections);
  if (src == null) return null;
  return sourceToOutputFrame(src, newSections);
}

/** Re-locate an output frame range; null if it no longer exists. */
export function remapRangeViaSource(
  startFrame: number,
  endFrame: number,
  oldSections: Section[],
  newSections: Section[],
): { startFrame: number; endFrame: number } | null {
  const start = remapFrameViaSource(startFrame, oldSections, newSections);
  const endRaw = remapFrameViaSource(
    Math.max(startFrame, endFrame - 1),
    oldSections,
    newSections,
  );
  if (start == null || endRaw == null) return null;
  const endFrameOut = endRaw + 1;
  if (endFrameOut <= start) return null;
  return { startFrame: start, endFrame: endFrameOut };
}
