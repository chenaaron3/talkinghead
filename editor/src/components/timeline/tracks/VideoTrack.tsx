import { GapCell } from "../cells/GapCell";
import { SectionCell } from "../cells/SectionCell";
import type { LayoutItem } from "../hooks/useTimelineLayout";
import { TrackLabel } from "../shared";

type Props = {
  width: number;
  items: LayoutItem[];
};

export function VideoTrack({ width, items }: Props) {
  return (
    <TrackLabel label="Video" width={width}>
      {items.map((item) =>
        item.kind === "section" ? (
          <SectionCell key={`s-${item.keepRegionIndex}`} item={item} />
        ) : (
          <GapCell key={`g-${item.id}`} item={item} />
        ),
      )}
    </TrackLabel>
  );
}
