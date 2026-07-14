import type { MouseEvent } from "react";

type Props = {
  number: number;
  label: string;
  selected: boolean;
  dragging: boolean;
  onMouseDown: (e: MouseEvent) => void;
};

export function ListicleBadge({
  number,
  label,
  selected,
  dragging,
  onMouseDown,
}: Props) {
  return (
    <span
      className={[
        "relative mx-0.5 inline-flex -translate-y-0.5 cursor-ew-resize flex-col items-center align-middle select-none",
        dragging ? "z-10" : "",
      ].join(" ")}
      title={`${number}. ${label} — drag to move reveal point`}
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
    >
      <span
        className={[
          "flex h-5 w-5 items-center justify-center rounded-full border-2 border-white/90 bg-[#00c853] text-[11px] font-extrabold leading-none text-white shadow-[0_2px_6px_rgba(0,0,0,0.45)]",
          selected || dragging
            ? "ring-2 ring-[#69f0ae] ring-offset-1 ring-offset-[#1a1d26]"
            : "hover:brightness-110",
        ].join(" ")}
      >
        {number}
      </span>
      <span
        className="mt-px h-1.5 w-0.5 rounded-full bg-[#00c853]/80"
        aria-hidden
      />
    </span>
  );
}
