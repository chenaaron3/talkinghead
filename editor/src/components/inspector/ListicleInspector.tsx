import type { SourceListicleItem } from "@src/lib/types";

import { useEditor } from '../../store';
import { TextField } from './field';

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
      <TextField
        id="listicle-label"
        label="Label"
        value={item.label}
        onLiveChange={(label) => updateListicleItemLabel(index, label, true)}
      />
    </div>
  );
}
