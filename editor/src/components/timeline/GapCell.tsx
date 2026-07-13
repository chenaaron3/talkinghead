import { useEditor } from "../../store";
import type { GapLayoutItem } from "./useTimelineLayout";

type Props = {
  item: GapLayoutItem;
};

export function GapCell({ item }: Props) {
  const selectedGap = useEditor((s) => s.selectedGap);
  const selectGap = useEditor((s) => s.selectGap);
  const selected = selectedGap === item.id;
  const duration = item.end - item.start;

  return (
    <div
      className={`absolute top-1 bottom-1 flex cursor-pointer items-center justify-center overflow-hidden rounded px-1 text-[10px] select-none ${
        selected
          ? "z-[2] bg-red-500/80 text-white outline outline-2 outline-white"
          : "bg-red-900/60 text-red-200 hover:bg-red-800/70"
      }`}
      style={{ left: item.x, width: item.width }}
      title={`Removed ${duration.toFixed(2)}s — click to focus, press Delete to restore`}
      onClick={(e) => {
        e.stopPropagation();
        selectGap(selected ? null : item.id);
      }}
    >
      ✂{duration.toFixed(1)}s
    </div>
  );
}
