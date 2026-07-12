import { useMemo } from "react";
import type { Section } from "../../lib/frames";
import { gapsBetweenSections } from "../../lib/sections";
import { useEditor } from "../../store";

const NO_SECTIONS: Section[] = [];

export type SectionLayoutItem = {
  kind: "section";
  index: number;
  outputStart: number;
  outputEnd: number;
  x: number;
  width: number;
};

export type GapLayoutItem = {
  kind: "gap";
  id: number;
  frames: number;
  x: number;
  width: number;
};

export type LayoutItem = SectionLayoutItem | GapLayoutItem;

export function useTimelineLayout() {
  const sections = useEditor((s) => s.props?.sections ?? NO_SECTIONS);
  const pxPerFrame = useEditor((s) => s.pxPerFrame);

  return useMemo(() => {
    const gaps = gapsBetweenSections(sections);
    const items: LayoutItem[] = [];
    let x = 0;
    let outputCursor = 0;
    let gi = 0;

    const pushGap = () => {
      const gap = gaps[gi];
      if (!gap) return;
      const width = Math.max(8, gap.frames * pxPerFrame);
      items.push({
        kind: "gap",
        id: gap.id,
        frames: gap.frames,
        x,
        width,
      });
      x += width;
      gi += 1;
    };

    const first = sections[0];
    if (first && first.trimBefore > 0) pushGap();

    sections.forEach((section, index) => {
      const width = Math.max(8, section.durationInFrames * pxPerFrame);
      items.push({
        kind: "section",
        index,
        outputStart: outputCursor,
        outputEnd: outputCursor + section.durationInFrames,
        x,
        width,
      });
      x += width;
      outputCursor += section.durationInFrames;

      const next = sections[index + 1];
      if (next && next.trimBefore - section.trimAfter > 0) pushGap();
    });

    const outputX = (outputFrame: number) => {
      let ox = 0;
      let cursor = 0;
      for (const item of items) {
        if (item.kind === "section") {
          if (outputFrame <= item.outputEnd) {
            const local = Math.max(0, outputFrame - item.outputStart);
            return ox + local * pxPerFrame;
          }
          ox += item.width;
          cursor = item.outputEnd;
        } else {
          ox += item.width;
        }
      }
      return ox + Math.max(0, outputFrame - cursor) * pxPerFrame;
    };

    return { items, totalWidth: x + 40, outputX };
  }, [sections, pxPerFrame]);
}
