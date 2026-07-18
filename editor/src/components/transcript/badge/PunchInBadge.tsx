import type { MouseEvent } from "react";

type Props = {
  selected: boolean;
  dragging: boolean;
  onMouseDown: (e: MouseEvent) => void;
};

export function PunchInBadge({ selected, dragging, onMouseDown }: Props) {
  return (
    <span
      className={[
        "relative mx-0.5 inline-flex cursor-ew-resize items-center align-middle select-none",
        dragging ? "z-10" : "",
      ].join(" ")}
      title="Zoom — drag to move start"
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
    >
      <span
        className={[
          "flex h-5 w-5 items-center justify-center rounded-full border-2 border-white/90 bg-purple-500 text-[14px] font-extrabold leading-none text-white shadow-[0_2px_6px_rgba(0,0,0,0.45)]",
          selected || dragging
            ? "ring-2 ring-purple-300 ring-offset-1 ring-offset-[#1a1d26]"
            : "hover:brightness-110",
        ].join(" ")}
      >
        +
      </span>
    </span>
  );
}
