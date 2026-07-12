import type {
  EpisodeProps,
  ListicleOverlay,
  TranscriptWord,
} from "@src/lib/types";
import { rebuildCaptions } from "./captions";
import {
  outputDuration,
  remapFrameViaSource,
  remapRangeViaSource,
  type Section,
} from "./frames";

/**
 * A gap is source material that was cut between two kept sections.
 * "Deleting" a gap restores that material (merges the sections around it).
 */
export type GapInfo = {
  /** Stable index in the gaps list for this sections snapshot (0, 1, 2, …). */
  id: number;
  sourceStart: number;
  sourceEnd: number;
  frames: number;
  /** Frame on the output timeline where this cut sits. */
  outputFrame: number;
};

export function gapsBetweenSections(sections: Section[]): GapInfo[] {
  const gaps: GapInfo[] = [];
  let id = 0;
  let outputCursor = 0;
  const first = sections[0];
  if (first && first.trimBefore > 0) {
    gaps.push({
      id: id++,
      sourceStart: 0,
      sourceEnd: first.trimBefore,
      frames: first.trimBefore,
      outputFrame: 0,
    });
  }
  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[i]!;
    const b = sections[i + 1]!;
    outputCursor += a.durationInFrames;
    const frames = b.trimBefore - a.trimAfter;
    if (frames <= 0) continue;
    gaps.push({
      id: id++,
      sourceStart: a.trimAfter,
      sourceEnd: b.trimBefore,
      frames,
      outputFrame: outputCursor,
    });
  }
  return gaps;
}

/**
 * Apply new sections and remap everything that lives on the output timeline
 * (captions, b-rolls, punch-ins, listicle) through the source video.
 */
function applySectionChange(
  props: EpisodeProps,
  newSections: Section[],
  transcriptWords: TranscriptWord[] | null,
): EpisodeProps {
  const oldSections = props.sections;

  const remapRange = <T extends { startFrame: number; endFrame: number }>(
    item: T,
  ): T | null => {
    const range = remapRangeViaSource(
      item.startFrame,
      item.endFrame,
      oldSections,
      newSections,
    );
    return range ? { ...item, ...range } : null;
  };

  const notNull = <T>(x: T | null): x is T => x != null;

  let listicle: ListicleOverlay | null = null;
  if (props.listicle) {
    const range = remapRange(props.listicle);
    if (range) {
      listicle = {
        ...range,
        items: range.items
          .map((item) => {
            const reveal = remapFrameViaSource(
              item.revealFrame,
              oldSections,
              newSections,
            );
            return reveal == null ? null : { ...item, revealFrame: reveal };
          })
          .filter(notNull),
      };
    }
  }

  let next: EpisodeProps = {
    ...props,
    sections: newSections,
    durationInFrames: Math.max(1, outputDuration(newSections)),
    bRolls: (props.bRolls ?? []).map(remapRange).filter(notNull),
    punchIns: props.punchIns
      ? props.punchIns.map(remapRange).filter(notNull)
      : props.punchIns,
    listicle,
  };
  if (transcriptWords) {
    next = rebuildCaptions(next, transcriptWords, oldSections);
  }
  return next;
}

/** Expand/shrink section edge into adjacent gap. deltaFrames > 0 expands. */
export function adjustSectionEdge(
  props: EpisodeProps,
  sectionIndex: number,
  edge: "start" | "end",
  deltaFrames: number,
  transcriptWords: TranscriptWord[] | null,
): EpisodeProps {
  if (deltaFrames === 0) return props;
  const sections = props.sections.map((s) => ({ ...s }));
  const section = sections[sectionIndex];
  if (!section) return props;

  const maxShrink = section.durationInFrames - 1;
  let maxGrow: number;
  if (edge === "end") {
    const next = sections[sectionIndex + 1];
    maxGrow = next ? next.trimBefore - section.trimAfter : 0;
  } else {
    const prev = sections[sectionIndex - 1];
    maxGrow = prev ? section.trimBefore - prev.trimAfter : section.trimBefore;
  }

  const clamped =
    deltaFrames > 0
      ? Math.min(deltaFrames, maxGrow)
      : Math.max(deltaFrames, -maxShrink);
  if (clamped === 0) return props;

  if (edge === "end") {
    section.trimAfter += clamped;
  } else {
    section.trimBefore -= clamped;
  }
  section.durationInFrames += clamped;
  return applySectionChange(props, sections, transcriptWords);
}

/** Restore the cut material inside a gap (by GapInfo.id). */
export function deleteGap(
  props: EpisodeProps,
  gapId: number,
  transcriptWords: TranscriptWord[] | null,
): EpisodeProps {
  const gap = gapsBetweenSections(props.sections)[gapId];
  if (!gap) return props;

  const sections = props.sections.map((s) => ({ ...s }));
  const first = sections[0];

  if (
    first &&
    gap.sourceStart === 0 &&
    first.trimBefore === gap.sourceEnd
  ) {
    sections[0] = {
      trimBefore: 0,
      trimAfter: first.trimAfter,
      durationInFrames: first.durationInFrames + first.trimBefore,
    };
    return applySectionChange(props, sections, transcriptWords);
  }

  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[i]!;
    const b = sections[i + 1]!;
    if (a.trimAfter !== gap.sourceStart || b.trimBefore !== gap.sourceEnd) {
      continue;
    }
    const gapFrames = Math.max(0, b.trimBefore - a.trimAfter);
    const merged = {
      trimBefore: a.trimBefore,
      trimAfter: b.trimAfter,
      durationInFrames: a.durationInFrames + gapFrames + b.durationInFrames,
    };
    sections.splice(i, 2, merged);
    return applySectionChange(props, sections, transcriptWords);
  }

  return props;
}
