import { useEditor } from "../../store";

type Props = {
  id: number;
  start: number;
  end: number;
};

export function Gap({ id, start, end }: Props) {
  const selectedGap = useEditor((s) => s.selectedGap);
  const selectGap = useEditor((s) => s.selectGap);
  const seekSource = useEditor((s) => s.seekSource);

  const selected = selectedGap === id;
  const duration = end - start;

  return (
    <span
      className={[
        "mx-1 inline-block cursor-pointer rounded border border-dashed px-1.5 py-px align-baseline text-[12px] whitespace-nowrap select-none",
        selected
          ? "border-white bg-red-700 text-white"
          : "border-red-500 text-red-300 hover:bg-red-900/50",
      ].join(" ")}
      title={`Removed ${duration.toFixed(2)}s — click to focus, press Delete to restore`}
      onClick={(e) => {
        e.stopPropagation();
        selectGap(selected ? null : id);
        seekSource(start);
      }}
    >
      ✂ {duration.toFixed(1)}s
    </span>
  );
}
