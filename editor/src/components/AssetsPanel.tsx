import { useEditor } from "../store";

export function AssetsPanel() {
  const assets = useEditor((s) => s.assets);
  return (
    <div className="min-h-0 overflow-auto border-r border-border bg-panel">
      <div className="grid grid-cols-2 gap-2 p-2.5">
        {assets.map((asset) => (
          <div
            key={asset.key}
            className="cursor-grab overflow-hidden rounded-lg border border-border bg-panel-2 select-none active:cursor-grabbing"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(
                "application/x-broll-asset",
                JSON.stringify(asset),
              );
              e.dataTransfer.effectAllowed = "copy";
            }}
            title={asset.label}
          >
            <img
              src={asset.thumbUrl}
              alt={asset.label}
              className="aspect-square w-full bg-black object-cover"
            />
            <span className="block truncate px-1.5 py-1 text-[10px] text-muted">
              {asset.label}
            </span>
          </div>
        ))}
        {assets.length === 0 ? (
          <p className="col-span-2 text-xs text-muted">
            Drop images into this episode folder to use as b-roll.
          </p>
        ) : null}
      </div>
    </div>
  );
}
