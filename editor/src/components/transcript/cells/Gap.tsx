import { Scissors } from 'lucide-react';

import { isSelected } from '../../../lib/selection';
import { useSelection } from '../../../selection-store';
import { useEditor } from '../../../store';

type Props = {
  id: number;
  start: number;
  end: number;
  /** 0 = lightest (smallest cut), 1 = darkest (largest cut). */
  intensity: number;
};

/** Linear light→dark red from cut size relative to other gaps. */
function cutRed(t: number): { border: string; text: string; fill: string } {
  const u = Math.min(1, Math.max(0, t));
  // light red-300 → dark red-800
  const r = Math.round(252 + (153 - 252) * u);
  const g = Math.round(165 + (27 - 165) * u);
  const b = Math.round(165 + (27 - 165) * u);
  return {
    border: `rgb(${r} ${g} ${b})`,
    text: `rgb(${r} ${g} ${b})`,
    fill: `rgb(${Math.round(r * 0.55)} ${Math.round(g * 0.55)} ${Math.round(b * 0.55)})`,
  };
}

export function Gap({ id, start, end, intensity }: Props) {
  const selection = useSelection((s) => s.selection);
  const selectGap = useSelection((s) => s.selectGap);
  const seekSource = useEditor((s) => s.seekSource);
  const scissorMode = useEditor((s) => s.mode === "scissor");

  const selected = isSelected(selection, "gap", id);
  const expanded = selected || scissorMode;
  const duration = end - start;
  const red = cutRed(intensity);

  return (
    <span
      className={[
        "mx-0.5 inline-flex cursor-pointer items-center justify-center rounded border border-dashed align-baseline whitespace-nowrap select-none",
        expanded
          ? "gap-0.5 px-1.5 py-px text-[12px]"
          : "px-1.5 py-1 hover:brightness-125",
        selected ? "text-white" : "",
      ].join(" ")}
      style={{
        borderColor: selected ? "white" : red.border,
        color: selected ? "white" : red.text,
        backgroundColor: red.fill,
      }}
      title={`Removed ${duration.toFixed(2)}s — click to focus, press Delete to restore`}
      onClick={(e) => {
        e.stopPropagation();
        selectGap(selected ? null : id);
        seekSource(start);
      }}
    >
      <Scissors
        className={
          expanded ? "size-3 shrink-0" : "size-3 shrink-0 rotate-90"
        }
        strokeWidth={2.25}
      />
      {expanded ? `${duration.toFixed(1)}s` : null}
    </span>
  );
}

export function gapIntensity(
  duration: number,
  minDuration: number,
  maxDuration: number,
): number {
  if (maxDuration <= minDuration) return 0.5;
  return (duration - minDuration) / (maxDuration - minDuration);
}
