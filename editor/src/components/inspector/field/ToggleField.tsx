import { Label } from "../../ui/label";
import { Switch } from "../../ui/switch";
import { useEditor } from "../../../store";

export function ToggleField({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="normal-case tracking-normal text-xs text-[#e8eaef]">
        {label}
      </Label>
      <Switch
        checked={checked}
        onCheckedChange={(next) => {
          useEditor.getState().beginGesture();
          onCheckedChange(next);
        }}
      />
    </div>
  );
}
