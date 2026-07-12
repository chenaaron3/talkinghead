import { useEditor } from "../../store";
import type { GapLayoutItem } from "./useTimelineLayout";

type Props = {
  item: GapLayoutItem;
};

export function GapCell({ item }: Props) {
  const fps = useEditor((s) => s.props?.fps ?? 30);
  const selectedGap = useEditor((s) => s.selectedGap);
  const selectGap = useEditor((s) => s.selectGap);
  const selected = selectedGap === item.id;

  return (
    <div
      className={`absolute top-1 bottom-1 flex cursor-pointer items-center justify-center overflow-hidden rounded px-1 text-[10px] select-none ${
        selected
          ? "z-[2] bg-gray-600 text-white outline outline-2 outline-white"
          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
      }`}
      style={{ left: item.x, width: item.width }}
      title={`Gap ${(item.frames / fps).toFixed(2)}s — click to focus, press Delete to remove`}
      onClick={(e) => {
        e.stopPropagation();
        selectGap(selected ? null : item.id);
      }}
    >
      ✂{(item.frames / fps).toFixed(1)}s
    </div>
  );
}
