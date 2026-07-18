import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { useEditor } from "../../../store";

export function NumberField({
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
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <Input
        type="number"
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
    </div>
  );
}
