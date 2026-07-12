import type { MouseEvent } from "react";
import type { BRollClip } from "@src/lib/types";

type Props = {
  clip: BRollClip;
  edge: "start" | "end";
  onResizeStart: (
    e: MouseEvent,
    clip: BRollClip,
    edge: "start" | "end",
  ) => void;
};

export function BRollHandle({ clip, edge, onResizeStart }: Props) {
  return (
    <span
      title={
        edge === "start" ? "Drag to snap start word" : "Drag to snap end word"
      }
      className={[
        "inline-block h-[1.05em] w-1.5 translate-y-[0.12em] cursor-ew-resize rounded-sm bg-broll align-baseline hover:bg-[#e4bc3a]",
        edge === "start" ? "mr-0.5" : "ml-0.5",
      ].join(" ")}
      onMouseDown={(e) => onResizeStart(e, clip, edge)}
    />
  );
}
