import { useEditor } from "../../store";
import { TrackLabel } from "./shared";

type Props = {
  width: number;
  sourceX: (sourceSec: number) => number;
};

export function PunchInTrack({ width, sourceX }: Props) {
  const punchIns = useEditor((s) => s.config?.punchInSegments ?? []);

  return (
    <TrackLabel label="Zoom" width={width}>
      {punchIns.map((p, i) => {
        const left = sourceX(p.start);
        const right = sourceX(p.end);
        return (
          <div
            key={`punch-${i}`}
            className="absolute top-1 bottom-1 flex items-center overflow-hidden rounded bg-purple-500/50 px-1 text-[10px] text-white select-none"
            style={{ left, width: Math.max(8, right - left) }}
            title={`Punch-in ${p.start.toFixed(2)}–${p.end.toFixed(2)}s`}
          >
            {p.scale.toFixed(2)}x
          </div>
        );
      })}
    </TrackLabel>
  );
}
