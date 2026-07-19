import { useEditor } from "../../store";
import { useAudioPreview } from "./useAudioPreview";

export function SfxTab() {
  const assets = useEditor((s) => s.sfxAssets);
  const { playingKey, preview, stopPreview } = useAudioPreview();

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="flex flex-col gap-1 p-2.5">
        {assets.map((asset) => (
          <div
            key={asset.key}
            className="flex cursor-grab items-center gap-2 rounded-lg border border-border bg-panel-2 px-2 py-1.5 select-none active:cursor-grabbing"
            draggable
            onDragStart={(e) => {
              stopPreview();
              e.dataTransfer.setData(
                "application/x-sfx-asset",
                JSON.stringify(asset),
              );
              e.dataTransfer.effectAllowed = "copy";
            }}
            title={`${asset.label} (${asset.durationSec.toFixed(2)}s)`}
          >
            <button
              type="button"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-sfx/25 text-sfx hover:bg-sfx/40"
              onClick={(e) => {
                e.stopPropagation();
                preview(asset.key, asset.src);
              }}
              title={playingKey === asset.key ? "Stop" : "Preview"}
            >
              {playingKey === asset.key ? "■" : "▶"}
            </button>
            <span className="min-w-0 flex-1 truncate text-[11px] text-[#e8eaef]">
              {asset.label}
            </span>
            <span className="shrink-0 text-[10px] text-muted">
              {asset.durationSec.toFixed(1)}s
            </span>
          </div>
        ))}
        {assets.length === 0 ? (
          <p className="text-xs text-muted">No files in public/sfx.</p>
        ) : null}
      </div>
    </div>
  );
}
