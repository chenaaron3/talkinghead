import { useMemo } from "react";
import { useFlatCaptions } from "../../store";
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
  const captions = useFlatCaptions();

  const sectionTexts = useMemo(() => {
    const sections = items.filter(
      (i): i is Extract<LayoutItem, { kind: "section" }> => i.kind === "section",
    );
    return sections.map((s) => {
      const text = captions
        .filter((c) => c.start >= s.start && c.start < s.end)
        .map((c) => c.text)
        .join(" ");
      return text || `S${s.keepRegionIndex + 1}`;
    });
  }, [items, captions]);

  let sectionIdx = 0;

  return (
    <TrackLabel label="Video" width={width}>
      {items.map((item) =>
        item.kind === "section" ? (
          <SectionCell
            key={`s-${item.keepRegionIndex}`}
            item={item}
            label={sectionTexts[sectionIdx++] || `S${item.keepRegionIndex + 1}`}
            onNeedleX={onNeedleX}
          />
        ) : (
          <GapCell key={`g-${item.id}`} item={item} />
        ),
      )}
    </TrackLabel>
  );
}
