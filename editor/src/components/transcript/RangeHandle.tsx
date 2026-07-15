import type { MouseEvent } from "react";

import type { RangeKind } from "../../lib/active-range";

type Props = {
  edge: "start" | "end";
  kind: RangeKind;
  onMouseDown: (e: MouseEvent) => void;
  /** Render inside a fixed-width slot without extra margin. */
  inset?: boolean;
};

const STYLES: Record<RangeKind, string> = {
  broll: "bg-broll hover:bg-[#e4bc3a]",
  sfx: "bg-sfx hover:bg-[#5eead4]",
  zoom: "bg-purple-400 hover:bg-purple-300",
};

export function RangeHandle({ edge, kind, onMouseDown, inset }: Props) {
  return (
    <span
      title={edge === "start" ? "Drag start" : "Drag end"}
      className={[
        "inline-block h-[1.05em] translate-y-[0.12em] cursor-ew-resize rounded-sm align-baseline",
        inset ? "w-full" : "w-1.5",
        STYLES[kind],
        inset ? "" : edge === "start" ? "mr-0.5" : "ml-0.5",
      ].join(" ")}
      onMouseDown={onMouseDown}
    />
  );
}
