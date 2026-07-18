import { useMemo } from "react";
import { cutsToTimelineRegions } from "@src/lib/source-timeline";
import { EMPTY_CUTS } from "../../lib/empty";
import { useEditor } from "../../store";

export type SectionLayoutItem = {
  kind: "section";
  keepRegionIndex: number;
  start: number;
  end: number;
  x: number;
  width: number;
};

export type GapLayoutItem = {
  kind: "gap";
  id: number;
  start: number;
  end: number;
  x: number;
  width: number;
};

export type LayoutItem = SectionLayoutItem | GapLayoutItem;

export function useTimelineLayout() {
  const cuts = useEditor((s) => s.config?.cuts ?? EMPTY_CUTS);
  const duration = useEditor((s) => s.transcript?.duration ?? 0);
  const pxPerSec = useEditor((s) => s.pxPerSec);

  return useMemo(() => {
    const regions = cutsToTimelineRegions(cuts, duration);
    const items: LayoutItem[] = [];
    let x = 0;
    let keepRegionIndex = 0;
    let gapId = 0;

    for (const region of regions) {
      const width = Math.max(8, (region.end - region.start) * pxPerSec);
      if (region.keep) {
        items.push({
          kind: "section",
          keepRegionIndex: keepRegionIndex++,
          start: region.start,
          end: region.end,
          x,
          width,
        });
      } else {
        items.push({
          kind: "gap",
          id: gapId++,
          start: region.start,
          end: region.end,
          x,
          width,
        });
      }
      x += width;
    }

    const sourceX = (sourceSec: number) => sourceSec * pxPerSec;

    return {
      items,
      totalWidth: Math.max(x + 40, duration * pxPerSec + 40),
      sourceX,
      duration,
    };
  }, [cuts, pxPerSec, duration]);
}
