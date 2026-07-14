import type { MouseEvent } from "react";

type Props = {
  edge: "start" | "end";
  color: "broll" | "zoom";
  onMouseDown: (e: MouseEvent) => void;
};

const STYLES = {
  broll: "bg-broll hover:bg-[#e4bc3a]",
  zoom: "bg-purple-400 hover:bg-purple-300",
} as const;

export function RangeHandle({ edge, color, onMouseDown }: Props) {
  return (
    <span
      title={edge === "start" ? "Drag start" : "Drag end"}
      className={[
        "inline-block h-[1.05em] w-1.5 translate-y-[0.12em] cursor-ew-resize rounded-sm align-baseline",
        STYLES[color],
        edge === "start" ? "mr-0.5" : "ml-0.5",
      ].join(" ")}
      onMouseDown={onMouseDown}
    />
  );
}
