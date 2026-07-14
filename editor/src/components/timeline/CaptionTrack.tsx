import { useFlatCaptions, useEditor } from "../../store";
import { TrackLabel } from "./shared";

type Props = {
  width: number;
  sourceX: (sourceSec: number) => number;
};

export function CaptionTrack({ width, sourceX }: Props) {
  const captions = useFlatCaptions();
  const selectedCaptionIndex = useEditor((s) => s.selectedCaptionIndex);
  const selectCaption = useEditor((s) => s.selectCaption);
  const seekSource = useEditor((s) => s.seekSource);

  return (
    <TrackLabel label="Captions" width={width}>
      {captions.map((caption) => {
        const left = sourceX(caption.start);
        const right = sourceX(caption.end);
        const selected = selectedCaptionIndex === caption.index;
        return (
          <div
            key={caption.index}
            className={`absolute top-1 bottom-1 flex items-center overflow-hidden rounded px-1 text-[10px] text-[#e8eaef] select-none ${
              selected
                ? "z-[2] bg-accent/50 outline outline-2 outline-white"
                : caption.emphasis === "positive"
                  ? "bg-emerald-500/35"
                  : caption.emphasis === "negative"
                    ? "bg-red-500/35"
                    : "bg-accent/25"
            }`}
            style={{ left, width: Math.max(8, right - left) }}
            title={`${caption.text}  ${caption.start.toFixed(2)}–${caption.end.toFixed(2)}s`}
            onClick={(e) => {
              e.stopPropagation();
              selectCaption(caption.index);
              seekSource(caption.start);
            }}
          >
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              {caption.text}
            </span>
          </div>
        );
      })}
    </TrackLabel>
  );
}
