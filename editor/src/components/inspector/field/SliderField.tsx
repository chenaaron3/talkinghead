import { Label } from "../../ui/label";
import { Slider } from "../../ui/slider";
import { useEditor } from "../../../store";

export function SliderField({
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
    <div className="flex flex-col gap-1">
      <Label>
        {label} · {display}
      </Label>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onPointerDown={() => useEditor.getState().beginGesture()}
        onValueChange={([v]) => {
          if (v != null) onLiveChange(v);
        }}
        onValueCommit={([v]) => {
          if (v != null) onCommit(v);
        }}
      />
    </div>
  );
}
