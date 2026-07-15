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

const UNDERLINE: Record<"broll" | "zoom", string> = {
  broll: "border-broll/70",
  zoom: "border-purple-400/70",
};

const HIGHLIGHT: Record<"broll" | "zoom", { idle: string; playhead: string }> =
  {
    broll: { idle: "bg-broll/45", playhead: "bg-broll/50" },
    zoom: { idle: "bg-purple-500/15", playhead: "bg-purple-500/20" },
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

/** B-roll / zoom: inactive = underline, active = highlight; word selected = both. */
function overlayRangeTint(
  range: ActiveRange,
  playheadActive: boolean,
  captionSelected: boolean,
): string[] {
  const kind = range.kind === "zoom" ? "zoom" : "broll";
  const showHighlight = range.selected || captionSelected;
  const showUnderline = !range.selected || captionSelected;

  return [
    "border-b-2",
    showUnderline ? UNDERLINE[kind] : "border-transparent",
    showHighlight
      ? playheadActive
        ? HIGHLIGHT[kind].playhead
        : HIGHLIGHT[kind].idle
      : "",
    roundEdge(range.edge),
    selectedEdgeShadow(range.edge, range.selected, COLOR_VAR[kind]),
  ];
}

function sfxRangeTint(range: ActiveRange, playheadActive: boolean): string[] {
  const bg = playheadActive ? "bg-sfx/50" : "bg-sfx/45";
  return [
    "border-b-2 border-transparent",
    bg,
    roundEdge(range.edge),
    selectedEdgeShadow(range.edge, true, COLOR_VAR.sfx),
  ];
}

function rangeTint(
  range: ActiveRange,
  playheadActive: boolean,
  captionSelected: boolean,
): string[] {
  if (range.kind === "sfx") {
    return sfxRangeTint(range, playheadActive);
  }
  return overlayRangeTint(range, playheadActive, captionSelected);
}

export function wordClassName(input: Input): string {
  const { active, styleRange, captionSelected, emphasis, isResizing } = input;

  const parts = [BASE];

  if (emphasis === "positive") parts.push("font-semibold text-[#00e676]");
  if (emphasis === "negative") parts.push("font-semibold text-[#ff5252]");
  if (isResizing) parts.push("cursor-ew-resize");

  if (styleRange) {
    parts.push(...rangeTint(styleRange, active, captionSelected));
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
