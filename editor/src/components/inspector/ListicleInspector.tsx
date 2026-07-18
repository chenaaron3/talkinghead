import type { SourceListicleItem } from "@src/lib/types";

import { useEditor } from "../../store";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export function ListicleInspector({
  index,
  item,
}: {
  index: number;
  item: SourceListicleItem;
}) {
  const updateListicleItemLabel = useEditor((s) => s.updateListicleItemLabel);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] text-muted">Item {index + 1}</p>
      <div className="flex flex-col gap-1">
        <Label htmlFor="listicle-label">Label</Label>
        <Input
          id="listicle-label"
          type="text"
          value={item.label}
          onFocus={() => useEditor.getState().beginGesture()}
          onChange={(e) => updateListicleItemLabel(index, e.target.value, true)}
        />
      </div>
    </div>
  );
}
