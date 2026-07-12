import { useEditor } from "../../store";

type Props = {
  id: number;
  frames: number;
  outputFrame: number;
};

export function Gap({ id, frames, outputFrame }: Props) {
  const fps = useEditor((s) => s.props?.fps ?? 30);
  const selectedGap = useEditor((s) => s.selectedGap);
  const selectGap = useEditor((s) => s.selectGap);
  const seek = useEditor((s) => s.seek);

  const selected = selectedGap === id;

  return (
    <span
      className={[
        "mx-1 inline-block cursor-pointer rounded border border-dashed px-1.5 py-px align-baseline text-[12px] whitespace-nowrap select-none",
        selected
          ? "border-white bg-gray-600 text-white"
          : "border-gray-500 text-gray-400 hover:bg-gray-700",
      ].join(" ")}
      title={`Cut ${(frames / fps).toFixed(2)}s — click to focus, press Delete to restore`}
      onClick={(e) => {
        e.stopPropagation();
        selectGap(selected ? null : id);
        seek(outputFrame);
      }}
    >
      ✂ {(frames / fps).toFixed(1)}s
    </span>
  );
}
