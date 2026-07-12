import { useMemo, type ReactNode } from "react";
import type { BRollClip } from "@src/lib/types";
import type { FlatWord } from "../../lib/captions";
import type { Section } from "../../lib/frames";
import { gapsBetweenSections } from "../../lib/sections";
import { useEditor, useFlatWords } from "../../store";
import { BRollHandle } from "./BRollHandle";
import { Gap } from "./Gap";
import { useBRollResize } from "./useBRollResize";
import { Word } from "./Word";

const NO_SECTIONS: Section[] = [];

function brollCovering(
  bRolls: BRollClip[],
  word: FlatWord,
): BRollClip | undefined {
  return bRolls.find(
    (c) => word.startFrame < c.endFrame && word.endFrame > c.startFrame,
  );
}

export function TranscriptPanel() {
  const props = useEditor((s) => s.props);
  const selectedBRollId = useEditor((s) => s.selectedBRollId);
  const selectBRoll = useEditor((s) => s.selectBRoll);
  const selectGap = useEditor((s) => s.selectGap);
  const words = useFlatWords();
  const { resize, startResize, snapToWord } = useBRollResize();

  const sections = props?.sections ?? NO_SECTIONS;
  const bRolls = props?.bRolls ?? [];

  const gapMarkers = useMemo(
    () => gapsBetweenSections(sections),
    [sections],
  );

  const nodes: ReactNode[] = [];
  let gapIdx = 0;
  let i = 0;
  while (i < words.length) {
    const word = words[i]!;
    while (
      gapIdx < gapMarkers.length &&
      gapMarkers[gapIdx]!.outputFrame <= word.startFrame
    ) {
      const gap = gapMarkers[gapIdx]!;
      nodes.push(
        <Gap
          key={`gap-${gap.id}`}
          id={gap.id}
          frames={gap.frames}
          outputFrame={gap.outputFrame}
        />,
      );
      gapIdx += 1;
    }
    const cover = brollCovering(bRolls, word);
    if (!cover) {
      nodes.push(
        <Word
          key={word.flatIndex}
          word={word}
          insideHighlight={false}
          isResizing={!!resize}
          onResizeEnter={() => snapToWord(word)}
        />,
      );
      i += 1;
      continue;
    }

    const runStart = i;
    while (
      i < words.length &&
      brollCovering(bRolls, words[i]!)?.id === cover.id
    ) {
      i += 1;
    }
    const run = words.slice(runStart, i);
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
        {run.map((w) => (
          <Word
            key={w.flatIndex}
            word={w}
            insideHighlight
            isResizing={!!resize}
            onResizeEnter={() => snapToWord(w)}
          />
        ))}
        <BRollHandle clip={cover} edge="end" onResizeStart={startResize} />
      </span>,
    );
  }

  while (gapIdx < gapMarkers.length) {
    const gap = gapMarkers[gapIdx]!;
    nodes.push(
      <Gap
        key={`gap-${gap.id}`}
        id={gap.id}
        frames={gap.frames}
        outputFrame={gap.outputFrame}
      />,
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
