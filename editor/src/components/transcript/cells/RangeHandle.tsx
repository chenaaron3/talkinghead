import type { MouseEvent } from "react";

import type { RangeKind } from "../../../lib/active-range";

type Props = {
  edge: "start" | "end";
  kind: RangeKind;
  onMouseDown: (e: MouseEvent) => void;
  /** Render inside a fixed-width slot without extra margin. */
  inset?: boolean;
};

const STYLES: Record<RangeKind, string> = {
  broll: "bg-broll hover:bg-[#e4bc3a]",
  vfx: "bg-vfx hover:bg-[#fda4af]",
  sfx: "bg-sfx hover:bg-[#5eead4]",
  zoom: "bg-purple-400 hover:bg-purple-300",
  listicleMarker: "bg-amber-500 hover:bg-amber-400",
  listicleReveal: "bg-violet-500 hover:bg-violet-400",
};

/** Matches word highlight: 1em content + py-[0.05em] top/bottom. */
const HIGHLIGHT_H = "h-[calc(1em+0.1em)]";

export function RangeHandle({ edge, kind, onMouseDown, inset }: Props) {
  return (
    <span
      title={edge === "start" ? "Drag start" : "Drag end"}
      className={[
        "inline-block cursor-ew-resize rounded-sm align-middle",
        HIGHLIGHT_H,
        inset ? "w-full" : "w-1.5",
        STYLES[kind],
        inset ? "" : edge === "start" ? "mr-0.5" : "ml-0.5",
      ].join(" ")}
      onMouseDown={onMouseDown}
    />
  );
}
