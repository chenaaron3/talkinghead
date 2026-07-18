import type { InterWordPause } from "@src/lib/inter-word-gaps";
import { useEditor } from "../../store";

type Props = {
  pause: InterWordPause;
};

export function GhostGap({ pause }: Props) {
  const cutInterWordPause = useEditor((s) => s.cutInterWordPause);
  const seekSource = useEditor((s) => s.seekSource);

  return (
    <span
      className={[
        "mx-1 inline-block cursor-pointer rounded border border-dashed px-1.5 py-px align-baseline text-[12px] whitespace-nowrap select-none",
        pause.isProcessLevel
          ? "border-zinc-400/80 text-zinc-300 hover:bg-zinc-700/40"
          : "border-zinc-500/60 text-zinc-400 hover:bg-zinc-800/50",
      ].join(" ")}
      title={`Pause ${pause.rawGapSec.toFixed(2)}s — click to cut ${pause.removedSec.toFixed(2)}s`}
      onClick={(e) => {
        e.stopPropagation();
        seekSource(pause.cutStart);
        cutInterWordPause(pause);
      }}
    >
      {pause.removedSec.toFixed(1)}s
    </span>
  );
}
