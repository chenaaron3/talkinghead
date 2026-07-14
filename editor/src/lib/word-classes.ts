import type { CaptionEmphasis } from "@src/lib/types";
import type { RangeEdge, WordAnnotation } from "./word-annotations";

const BASE =
  "inline cursor-text py-[0.05em] transition-colors [box-decoration-break:clone] [-webkit-box-decoration-break:clone]";

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
  annotation: WordAnnotation;
  brollSelected: boolean;
  zoomSelected: boolean;
  captionSelected: boolean;
  emphasis?: CaptionEmphasis;
  isResizing: boolean;
};

export function wordClassName(input: Input): string {
  const {
    active,
    annotation,
    brollSelected,
    zoomSelected,
    captionSelected,
    emphasis,
    isResizing,
  } = input;
  const inBroll = annotation.bRollId != null;
  const inZoom = annotation.punchInIndex != null;

  const parts = [BASE];

  if (emphasis === "positive") parts.push("font-semibold text-[#00e676]");
  if (emphasis === "negative") parts.push("font-semibold text-[#ff5252]");
  if (isResizing) parts.push("cursor-ew-resize");

  if (inBroll) {
    const bg = active
      ? "bg-broll/50"
      : brollSelected
        ? "bg-broll/45"
        : "bg-broll/30";
    parts.push(
      "border-b-2 border-transparent px-0.5",
      bg,
      !brollSelected ? "hover:bg-broll/40" : "",
      roundEdge(annotation.bRollEdge),
      selectedEdgeShadow(
        annotation.bRollEdge,
        brollSelected,
        "var(--color-broll)",
      ),
    );
    return parts.filter(Boolean).join(" ");
  }

  if (inZoom) {
    const zoomStyle = active
      ? "border-b-purple-400 bg-purple-500/20"
      : zoomSelected
        ? "border-b-purple-300 bg-purple-500/15"
        : "border-b-purple-400/70";
    parts.push(
      "border-b-2",
      zoomStyle,
      roundEdge(annotation.punchInEdge),
      selectedEdgeShadow(
        annotation.punchInEdge,
        zoomSelected,
        "var(--color-purple-400)",
      ),
    );
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
