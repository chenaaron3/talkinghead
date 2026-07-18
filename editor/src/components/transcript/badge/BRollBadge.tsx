import type { MouseEvent } from "react";

import { isVideoSrc } from "../../../lib/broll";

type Props = {
  src: string;
  label: string;
  selected: boolean;
  dragging: boolean;
  onMouseDown: (e: MouseEvent) => void;
};

/** Matches word highlight: 1em content + py-[0.05em] top/bottom. */
const HIGHLIGHT_H = "h-[calc(1em+0.1em)]";

export function BRollBadge({
  src,
  label,
  selected,
  dragging,
  onMouseDown,
}: Props) {
  const ring =
    selected || dragging
      ? "shadow-[inset_0_0_0_2px_#e4bc3a]"
      : "hover:brightness-110";

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
      {isVideoSrc(src) ? (
        <video
          src={`/${src}`}
          muted
          playsInline
          preload="metadata"
          className={["h-full w-full rounded-sm object-cover", ring].join(" ")}
          draggable={false}
        />
      ) : (
        <img
          src={`/${src}`}
          alt=""
          className={["h-full w-full rounded-sm object-cover", ring].join(" ")}
          draggable={false}
        />
      )}
    </span>
  );
}
