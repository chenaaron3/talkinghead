import { useEditor } from "../../store";
import { TrackLabel } from "./shared";

type Props = {
  width: number;
  sourceX: (sourceSec: number) => number;
};

export function ListicleTrack({ width, sourceX }: Props) {
  const listicle = useEditor((s) => s.config?.listicleOverlay);

  if (!listicle) {
    return <TrackLabel label="List" width={width}>{null}</TrackLabel>;
  }

  return (
    <TrackLabel label="List" width={width}>
      <div
        className="absolute top-1 bottom-1 rounded bg-green-600/40"
        style={{
          left: sourceX(listicle.start),
          width: Math.max(
            8,
            sourceX(listicle.end) - sourceX(listicle.start),
          ),
        }}
        title={`Listicle ${listicle.start.toFixed(2)}–${listicle.end.toFixed(2)}s`}
      />
      {listicle.items.map((item, i) => (
        <div
          key={`li-${i}`}
          className="absolute top-1 bottom-1 flex w-6 items-center justify-center rounded bg-green-500/70 text-[9px] text-white"
          style={{ left: sourceX(item.reveal) }}
          title={item.label}
        >
          {i + 1}
        </div>
      ))}
    </TrackLabel>
  );
}
