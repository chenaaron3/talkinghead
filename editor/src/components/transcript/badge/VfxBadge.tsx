import type { MouseEvent } from "react";
import type { VfxType } from "@src/lib/types";

import { VFX_META } from "../../../lib/vfx";

type Props = {
  label: string;
  kind?: VfxType;
  selected: boolean;
  dragging: boolean;
  onMouseDown: (e: MouseEvent) => void;
};

/** Matches word highlight: 1em content + py-[0.05em] top/bottom. */
const HIGHLIGHT_H = "h-[calc(1em+0.1em)]";

export function VfxBadge({
  label,
  kind = "location",
  selected,
  dragging,
  onMouseDown,
}: Props) {
  const { Icon } = VFX_META[kind];

  return (
    <span
      className={[
        "relative mr-0.5 inline-flex cursor-ew-resize items-center align-middle select-none",
        HIGHLIGHT_H,
        "aspect-square",
        dragging ? "z-10" : "",
      ].join(" ")}
      title={`${label} — drag to move start`}
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
    >
      <span
        className={[
          "flex h-full w-full items-center justify-center rounded-sm bg-vfx/40 text-vfx",
          selected || dragging
            ? "shadow-[inset_0_0_0_2px_#fda4af]"
            : "hover:brightness-110",
        ].join(" ")}
      >
        <Icon className="size-3" />
      </span>
    </span>
  );
}
