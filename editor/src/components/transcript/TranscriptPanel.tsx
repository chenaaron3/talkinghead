import { type ReactNode, useMemo } from "react";

import { captionInCut } from "../../lib/cuts";
import { sourceGaps } from "../../lib/sections";
import { buildWordAnnotations } from "../../lib/word-annotations";
import { useCaptionDragSelect } from "../../lib/use-caption-drag-select";
import { useSelection } from "../../selection-store";
import { useEditor, useFlatCaptions, useCaptionIndices } from "../../store";
import { GhostGap } from "./GhostGap";
import { Gap } from "./Gap";
import { TranscriptToolbar } from "./TranscriptToolbar";
import { useRangeResize, markerDraggingFromResize } from "./useRangeResize";
import { useScissorGhosts } from "./useScissorGhosts";
import { Word } from "./Word";

export function TranscriptPanel() {
  const config = useEditor((s) => s.config);
  const clearSelection = useSelection((s) => s.clearSelection);
  const captions = useFlatCaptions();
  const {
    resize,
    snapToCaption,
    startRangeResize,
    startSfxDrag,
    startListicleDrag,
  } = useRangeResize();
  const scissors = useScissorGhosts();

  const gapMarkers = useMemo(
    () => (config ? sourceGaps(config) : []),
    [config],
  );

  const annotations = useMemo(
    () => buildWordAnnotations(captions, config),
    [captions, config],
  );

  const captionIndices = useCaptionIndices();
  const { onDragStart } = useCaptionDragSelect(captionIndices);

  const nodes: ReactNode[] = [];
  let gapIdx = 0;

  for (const caption of captions) {
    if (config && captionInCut(caption, config.cuts)) continue;

    while (
      gapIdx < gapMarkers.length &&
      gapMarkers[gapIdx]!.end <= caption.start
    ) {
      const gap = gapMarkers[gapIdx]!;
      nodes.push(
        <Gap
          key={`gap-${gap.id}`}
          id={gap.id}
          start={gap.start}
          end={gap.end}
        />,
      );
      gapIdx += 1;
    }

    const ghost = scissors.beforeCaption(caption.index);
    if (ghost) {
      nodes.push(<GhostGap key={ghost.key} pause={ghost} />);
    }

    const annotation = annotations.get(caption.index) ?? {};

    nodes.push(
      <Word
        key={caption.index}
        caption={caption}
        annotation={annotation}
        scissorMode={scissors.active}
        isResizing={!!resize}
        draggingStart={markerDraggingFromResize(resize)}
        captionIndices={captionIndices}
        onCaptionDragStart={
          scissors.active ? undefined : (e) => onDragStart(caption.index, e)
        }
        onResizeEnter={(shiftKey) => snapToCaption(caption, shiftKey)}
        onStartRangeResize={startRangeResize}
        onStartSfxDrag={startSfxDrag}
        onStartListicleDrag={
          annotation.listicleItemIndex != null
            ? (e) => startListicleDrag(e, annotation.listicleItemIndex!)
            : undefined
        }
      />,
    );
  }

  while (gapIdx < gapMarkers.length) {
    const gap = gapMarkers[gapIdx]!;
    nodes.push(
      <Gap key={`gap-${gap.id}`} id={gap.id} start={gap.start} end={gap.end} />,
    );
    gapIdx += 1;
  }

  if (scissors.trailing) {
    nodes.push(
      <GhostGap key={scissors.trailing.key} pause={scissors.trailing} />,
    );
  }

  return (
    <div className="flex min-h-0 flex-col border-r border-border bg-panel">
      <TranscriptToolbar />
      <div
        className="min-h-0 flex-1 overflow-auto"
        onClick={() => {
          if (!resize) clearSelection();
        }}
      >
        <div className="max-w-[52rem] px-6 py-5 text-[18px] leading-[1.85] tracking-wide text-[#e8eaef]">
          {nodes}
        </div>
      </div>
    </div>
  );
}
