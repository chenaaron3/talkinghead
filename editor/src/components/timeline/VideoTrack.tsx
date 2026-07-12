import { useMemo } from "react";
import { useFlatWords } from "../../store";
import { GapCell } from "./GapCell";
import { SectionCell } from "./SectionCell";
import { TrackLabel } from "./shared";
import type { LayoutItem } from "./useTimelineLayout";

type Props = {
  width: number;
  items: LayoutItem[];
  onNeedleX: (x: number | null) => void;
};

export function VideoTrack({ width, items, onNeedleX }: Props) {
  const words = useFlatWords();

  const sectionTexts = useMemo(() => {
    const sections = items.filter(
      (i): i is Extract<LayoutItem, { kind: "section" }> => i.kind === "section",
    );
    const bounds = sections.map((s) => ({
      start: s.outputStart,
      end: s.outputEnd,
    }));
    const texts = sections.map(() => [] as string[]);
    for (const w of words) {
      const idx = bounds.findIndex(
        (b) => w.startFrame >= b.start && w.startFrame < b.end,
      );
      if (idx >= 0) texts[idx]!.push(w.text);
    }
    return texts.map((t) => t.join(" "));
  }, [items, words]);

  return (
    <TrackLabel label="Video" width={width}>
      {items.map((item) =>
        item.kind === "section" ? (
          <SectionCell
            key={`s-${item.index}`}
            item={item}
            label={sectionTexts[item.index] || `S${item.index + 1}`}
            onNeedleX={onNeedleX}
          />
        ) : (
          <GapCell key={`g-${item.id}`} item={item} />
        ),
      )}
    </TrackLabel>
  );
}
