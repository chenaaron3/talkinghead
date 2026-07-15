import { type ReactNode, useMemo } from "react";

import { captionInCut } from "../../lib/cuts";
import { sourceGaps } from "../../lib/sections";
import { buildWordAnnotations } from "../../lib/word-annotations";
import { useCaptionDragSelect } from "../../lib/use-caption-drag-select";
import { useSelection } from "../../selection-store";
import { useEditor, useFlatCaptions, useCaptionIndices } from "../../store";
import { Gap } from "./Gap";
import { useRangeResize } from "./useRangeResize";
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

    const annotation = annotations.get(caption.index) ?? {};

    nodes.push(
      <Word
        key={caption.index}
        caption={caption}
        annotation={annotation}
        isResizing={!!resize}
        listicleDragging={resize?.kind === "listicle"}
        sfxDraggingId={
          resize?.kind === "sfx" && resize.edge === "start" ? resize.id : null
        }
        captionIndices={captionIndices}
        onCaptionDragStart={(e) => onDragStart(caption.index, e)}
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

  return (
    <div
      className="min-h-0 overflow-auto border-r border-border bg-panel"
      onClick={() => {
        if (!resize) clearSelection();
      }}
    >
      <div className="max-w-[52rem] px-6 py-5 text-[18px] leading-[1.85] tracking-wide text-[#e8eaef]">
        {nodes}
      </div>
    </div>
  );
}
