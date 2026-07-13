import type { MouseEvent } from "react";
import type { SourceBRoll } from "@src/lib/types";

type Props = {
  clip: SourceBRoll;
  edge: "start" | "end";
  onResizeStart: (
    e: MouseEvent,
    clip: SourceBRoll,
    edge: "start" | "end",
  ) => void;
};

export function BRollHandle({ clip, edge, onResizeStart }: Props) {
  return (
    <span
      title={
        edge === "start" ? "Drag to snap start" : "Drag to snap end"
      }
      className={[
        "inline-block h-[1.05em] w-1.5 translate-y-[0.12em] cursor-ew-resize rounded-sm bg-broll align-baseline hover:bg-[#e4bc3a]",
        edge === "start" ? "mr-0.5" : "ml-0.5",
      ].join(" ")}
      onMouseDown={(e) => onResizeStart(e, clip, edge)}
    />
  );
}
