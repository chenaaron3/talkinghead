import { useMemo, type ReactNode } from "react";
import type { SourceBRoll } from "@src/lib/types";
import type { FlatCaption } from "../../lib/captions";
import { sourceGaps } from "../../lib/sections";
import { useEditor, useFlatCaptions } from "../../store";
import { BRollHandle } from "./BRollHandle";
import { Gap } from "./Gap";
import { useBRollResize } from "./useBRollResize";
import { Word } from "./Word";

function brollCovering(
  bRolls: SourceBRoll[],
  caption: FlatCaption,
): SourceBRoll | undefined {
  return bRolls.find(
    (c) => caption.start < c.end && caption.end > c.start,
  );
}

export function TranscriptPanel() {
  const config = useEditor((s) => s.config);
  const selectedBRollId = useEditor((s) => s.selectedBRollId);
  const selectBRoll = useEditor((s) => s.selectBRoll);
  const selectGap = useEditor((s) => s.selectGap);
  const captions = useFlatCaptions();
  const { resize, startResize, snapToCaption } = useBRollResize();

  const bRolls = config?.bRolls ?? [];

  const gapMarkers = useMemo(
    () => (config ? sourceGaps(config) : []),
    [config],
  );

  const nodes: ReactNode[] = [];
  let gapIdx = 0;
  let i = 0;

  while (i < captions.length) {
    const caption = captions[i]!;
    while (
      gapIdx < gapMarkers.length &&
      gapMarkers[gapIdx]!.end <= caption.start
    ) {
      const gap = gapMarkers[gapIdx]!;
      nodes.push(
        <Gap key={`gap-${gap.id}`} id={gap.id} start={gap.start} end={gap.end} />,
      );
      gapIdx += 1;
    }

    const cover = brollCovering(bRolls, caption);
    if (!cover) {
      nodes.push(
        <Word
          key={caption.index}
          caption={caption}
          insideHighlight={false}
          isResizing={!!resize}
          onResizeEnter={() => snapToCaption(caption)}
        />,
      );
      i += 1;
      continue;
    }

    const runStart = i;
    while (
      i < captions.length &&
      brollCovering(bRolls, captions[i]!)?.id === cover.id
    ) {
      i += 1;
    }
    const run = captions.slice(runStart, i);
    const selected = selectedBRollId === cover.id || resize?.id === cover.id;

    nodes.push(
      <span
        key={`broll-${cover.id}-${runStart}`}
        className={[
          "relative inline rounded-sm px-0.5 py-[0.05em] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]",
          selected ? "bg-broll/45 ring-1 ring-broll" : "bg-broll/30",
        ].join(" ")}
        onClick={(e) => {
          e.stopPropagation();
          selectBRoll(cover.id);
        }}
      >
        <BRollHandle clip={cover} edge="start" onResizeStart={startResize} />
        {run.map((c) => (
          <Word
            key={c.index}
            caption={c}
            insideHighlight
            isResizing={!!resize}
            onResizeEnter={() => snapToCaption(c)}
          />
        ))}
        <BRollHandle clip={cover} edge="end" onResizeStart={startResize} />
      </span>,
    );
  }

  while (gapIdx < gapMarkers.length) {
    const gap = gapMarkers[gapIdx]!;
    nodes.push(
      <Gap key={`gap-${gap.id}`} id={gap.id} start={gap.start} end={gap.end} />,
    );
    gapIdx += 1;
  }

  return (
    <div
      className="min-h-0 overflow-auto border-r border-border bg-panel"
      onClick={() => {
        if (!resize) {
          selectBRoll(null);
          selectGap(null);
        }
      }}
    >
      <div className="max-w-[52rem] px-6 py-5 text-[18px] leading-[1.85] tracking-wide text-[#e8eaef]">
        {nodes}
      </div>
    </div>
  );
}
