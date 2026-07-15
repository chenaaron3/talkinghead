import type { CaptionEmphasis } from "@src/lib/types";
import type { ActiveRange } from "./active-range";
import type { RangeEdge } from "./word-annotations";

const BASE =
  "inline cursor-text py-[0.05em] transition-colors [box-decoration-break:clone] [-webkit-box-decoration-break:clone]";

const COLOR_VAR: Record<ActiveRange["kind"], string> = {
  broll: "var(--color-broll)",
  sfx: "var(--color-sfx)",
  zoom: "var(--color-purple-400)",
};

function roundEdge(edge: RangeEdge | undefined): string {
  if (edge === "both") return "rounded-sm";
  if (edge === "start") return "rounded-l-sm";
  if (edge === "end") return "rounded-r-sm";
  return "";
}

function selectedEdgeShadow(
  edge: RangeEdge | undefined,
  selected: boolean,
  colorVar: string,
): string {
  if (!selected || edge === "middle") return "";
  if (edge === "both") {
    return `shadow-[inset_2px_0_0_0_${colorVar},inset_-2px_0_0_0_${colorVar}]`;
  }
  if (edge === "start") return `shadow-[inset_2px_0_0_0_${colorVar}]`;
  if (edge === "end") return `shadow-[inset_-2px_0_0_0_${colorVar}]`;
  return "";
}

type Input = {
  active: boolean;
  styleRange: ActiveRange | null;
  captionSelected: boolean;
  emphasis?: CaptionEmphasis;
  isResizing: boolean;
};

function rangeTint(range: ActiveRange, active: boolean): string[] {
  if (range.kind === "broll") {
    const bg = active
      ? "bg-broll/50"
      : range.selected
        ? "bg-broll/45"
        : "bg-broll/30";
    return [
      "border-b-2 border-transparent",
      bg,
      !range.selected ? "hover:bg-broll/40" : "",
      roundEdge(range.edge),
      selectedEdgeShadow(range.edge, range.selected, COLOR_VAR.broll),
    ];
  }

  if (range.kind === "sfx") {
    const bg = active ? "bg-sfx/50" : "bg-sfx/45";
    return [
      "border-b-2 border-transparent",
      bg,
      roundEdge(range.edge),
      selectedEdgeShadow(range.edge, true, COLOR_VAR.sfx),
    ];
  }

  const zoomStyle = active
    ? "border-b-purple-400 bg-purple-500/20"
    : range.selected
      ? "border-b-purple-300 bg-purple-500/15"
      : "border-b-purple-400/70";
  return [
    "border-b-2",
    zoomStyle,
    roundEdge(range.edge),
    selectedEdgeShadow(range.edge, range.selected, COLOR_VAR.zoom),
  ];
}

export function wordClassName(input: Input): string {
  const { active, styleRange, captionSelected, emphasis, isResizing } = input;

  const parts = [BASE];

  if (emphasis === "positive") parts.push("font-semibold text-[#00e676]");
  if (emphasis === "negative") parts.push("font-semibold text-[#ff5252]");
  if (isResizing) parts.push("cursor-ew-resize");

  if (styleRange) {
    parts.push(...rangeTint(styleRange, active));
    return parts.filter(Boolean).join(" ");
  }

  if (active) {
    parts.push("border-b-2 border-accent bg-accent/20");
  } else if (captionSelected) {
    parts.push("border-b-2 border-white bg-accent/30");
  } else {
    parts.push("border-b-2 border-transparent hover:bg-accent/15");
  }

  return parts.filter(Boolean).join(" ");
}
