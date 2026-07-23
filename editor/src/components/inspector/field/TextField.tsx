import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { useEditor } from "../../../store";

export function TextField({
  label,
  value,
  id,
  onLiveChange,
}: {
  label: string;
  value: string;
  id?: string;
  onLiveChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="text"
        value={value}
        onFocus={() => useEditor.getState().beginGesture()}
        onChange={(e) => onLiveChange(e.target.value)}
      />
    </div>
  );
}
