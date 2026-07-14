import { GapCell } from "./GapCell";
import { SectionCell } from "./SectionCell";
import { TrackLabel } from "./shared";
import type { LayoutItem } from "./useTimelineLayout";

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
