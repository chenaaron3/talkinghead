import { useCallback, useRef } from 'react';

import { isSelected } from '../../../lib/selection';
import { useCaptionDragSelect } from '../../../lib/use-caption-drag-select';
import { useSelection } from '../../../selection-store';
import { useCaptionIndices, useEditor, useFlatCaptions } from '../../../store';
import { TrackLabel } from '../shared';

import type { FlatCaption } from "../../../lib/captions";

type Props = {
  width: number;
  sourceX: (sourceSec: number) => number;
};

export function CaptionTrack({ width, sourceX }: Props) {
  const captions = useFlatCaptions();
  const selection = useSelection((s) => s.selection);
  const selectCaption = useSelection((s) => s.selectCaption);
  const selectCaptionExtend = useSelection((s) => s.selectCaptionExtend);
  const seekSource = useEditor((s) => s.seekSource);
  const captionIndices = useCaptionIndices();
  const trackRef = useRef<HTMLDivElement>(null);

  const resolveIndexAtPoint = useCallback(
    (clientX: number, _clientY: number) => {
      const track = trackRef.current;
      if (!track || captions.length === 0) return null;
      const x = clientX - track.getBoundingClientRect().left;

      for (const caption of captions) {
        const left = sourceX(caption.start);
        const right = sourceX(caption.end);
        if (x >= left && x <= right) return caption.index;
      }

      for (let i = 0; i < captions.length - 1; i++) {
        const curr = captions[i]!;
        const next = captions[i + 1]!;
        const gapStart = sourceX(curr.end);
        const gapEnd = sourceX(next.start);
        if (x > gapStart && x < gapEnd) {
          const mid = (gapStart + gapEnd) / 2;
          return x < mid ? curr.index : next.index;
        }
      }

      const first = captions[0]!;
      const last = captions[captions.length - 1]!;
      if (x < sourceX(first.start)) return first.index;
      if (x > sourceX(last.end)) return last.index;
      return null;
    },
    [captions, sourceX],
  );

  const { onDragStart } = useCaptionDragSelect(
    captionIndices,
    resolveIndexAtPoint,
  );

  return (
    <TrackLabel label="Captions" width={width}>
      <div
        ref={trackRef}
        className="relative z-10 h-full w-full"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {captions.map((caption) => {
          const left = sourceX(caption.start);
          const right = sourceX(caption.end);
          const selected = isSelected(selection, "caption", caption.index);
          return (
            <CaptionBlock
              key={caption.index}
              caption={caption}
              left={left}
              width={Math.max(8, right - left)}
              selected={selected}
              onDragStart={(e) => onDragStart(caption.index, e)}
              onClick={(e) => {
                e.stopPropagation();
                if (e.shiftKey) {
                  selectCaptionExtend(caption.index, captionIndices);
                } else if (e.metaKey || e.ctrlKey) {
                  selectCaption(caption.index, "toggle");
                } else {
                  selectCaption(caption.index);
                }
                seekSource(caption.start);
              }}
            />
          );
        })}
      </div>
    </TrackLabel>
  );
}

function CaptionBlock({
  caption,
  left,
  width,
  selected,
  onDragStart,
  onClick,
}: {
  caption: FlatCaption;
  left: number;
  width: number;
  selected: boolean;
  onDragStart: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      data-caption-index={caption.index}
      className={`absolute top-1 bottom-1 z-[1] flex cursor-pointer items-center overflow-hidden rounded px-1 text-[10px] text-[#e8eaef] select-none ${selected
        ? "z-[2] bg-accent/50 outline outline-2 outline-white"
        : caption.emphasis === "positive"
          ? "bg-emerald-500/35"
          : caption.emphasis === "negative"
            ? "bg-red-500/35"
            : "bg-accent/25"
        }`}
      style={{ left, width }}
      title={`${caption.text}  ${caption.start.toFixed(2)}–${caption.end.toFixed(2)}s`}
      onMouseDown={onDragStart}
      onClick={onClick}
    >
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
        {caption.text}
      </span>
    </div>
  );
}
