import type { ReactNode } from "react";
import {
  BROLL_SCALE_MAX,
  BROLL_SCALE_MIN,
  TRANSFORM_DEFAULTS,
  type Transform,
} from "../../lib/broll";
import { useEditor } from "../../store";
import type { SourceBRoll } from "@src/lib/types";

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function NumberRow({
  label,
  value,
  step,
  min,
  max,
  onLiveChange,
}: {
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  onLiveChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        className="h-8 w-full rounded-md border border-border bg-panel-2 px-2 text-xs text-[#e8eaef] outline-none focus:border-accent"
        value={Number.isFinite(value) ? Number(value.toFixed(3)) : 0}
        step={step}
        min={min}
        max={max}
        onFocus={() => useEditor.getState().beginGesture()}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (!Number.isFinite(next)) return;
          onLiveChange(next);
        }}
      />
    </Field>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  display,
  onLiveChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onLiveChange: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  return (
    <Field label={`${label} · ${display}`}>
      <input
        type="range"
        className="w-full accent-(--color-accent)"
        value={value}
        min={min}
        max={max}
        step={step}
        onPointerDown={() => useEditor.getState().beginGesture()}
        onChange={(e) => onLiveChange(Number(e.target.value))}
        onPointerUp={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
      />
    </Field>
  );
}

export function BRollInspector({
  clip,
  transform,
}: {
  clip: SourceBRoll;
  transform: Transform;
}) {
  const updateBRollTransform = useEditor((s) => s.updateBRollTransform);

  const patch = (partial: Partial<Transform>, live: boolean) => {
    updateBRollTransform(clip.id, partial, live);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="truncate text-[11px] text-muted" title={clip.src}>
        {clip.src.split("/").pop()}
      </p>

      <SliderRow
        label="Scale"
        value={transform.scale}
        min={BROLL_SCALE_MIN}
        max={BROLL_SCALE_MAX}
        step={0.01}
        display={`${transform.scale.toFixed(2)}×`}
        onLiveChange={(scale) => patch({ scale }, true)}
        onCommit={(scale) => patch({ scale }, true)}
      />

      <NumberRow
        label="Offset X"
        value={transform.offsetX}
        step={0.01}
        onLiveChange={(offsetX) => patch({ offsetX }, true)}
      />

      <NumberRow
        label="Offset Y"
        value={transform.offsetY}
        step={0.01}
        onLiveChange={(offsetY) => patch({ offsetY }, true)}
      />

      <SliderRow
        label="Rotation"
        value={((transform.rotation % 360) + 360 + 180) % 360 - 180}
        min={-180}
        max={180}
        step={1}
        display={`${Math.round(transform.rotation)}°`}
        onLiveChange={(rotation) => patch({ rotation }, true)}
        onCommit={(rotation) => patch({ rotation }, true)}
      />

      <button
        type="button"
        className="mt-1 rounded-md border border-border bg-panel-2 px-2 py-1.5 text-xs text-[#e8eaef] hover:bg-[#2a3142]"
        onClick={() => {
          useEditor.getState().beginGesture();
          patch({ ...TRANSFORM_DEFAULTS }, false);
        }}
      >
        Reset transform
      </button>
    </div>
  );
}
