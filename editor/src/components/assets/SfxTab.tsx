import { ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { loudnessGainFor } from '@src/lib/audio/loudness';
import { SFX_VOLUME_DEFAULT } from '@src/lib/episode/media';

import { cn } from '../../lib/utils';
import { useEditor } from '../../store';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { useAudioPreview } from './useAudioPreview';

import type { SfxAsset } from '../../store';
const FOLDER_ORDER = ["meme", "beep-bop", "realistic"] as const;

const FOLDER_LABELS: Record<string, string> = {
  meme: "Meme",
  "beep-bop": "Beep Bop",
  realistic: "Realistic",
};

function folderLabel(folder: string | null): string {
  if (!folder) return "Other";
  return FOLDER_LABELS[folder] ?? folder;
}

function groupSfxAssets(assets: SfxAsset[]) {
  const groups = new Map<string | null, SfxAsset[]>();
  for (const asset of assets) {
    const key =
      asset.folder ??
      (asset.src.split("/").length >= 3 ? asset.src.split("/")[1]! : null);
    const list = groups.get(key) ?? [];
    list.push(asset);
    groups.set(key, list);
  }

  const ordered: Array<{
    folder: string | null;
    label: string;
    assets: SfxAsset[];
  }> = [];
  for (const folder of FOLDER_ORDER) {
    const list = groups.get(folder);
    if (list && list.length > 0) {
      ordered.push({ folder, label: folderLabel(folder), assets: list });
      groups.delete(folder);
    }
  }
  for (const [folder, list] of groups) {
    if (list.length === 0) continue;
    ordered.push({ folder, label: folderLabel(folder), assets: list });
  }
  return ordered;
}

function SfxRow({
  asset,
  playingKey,
  onPreview,
  onDragStart,
}: {
  asset: SfxAsset;
  playingKey: string | null;
  onPreview: (key: string, src: string, volume?: number) => void;
  onDragStart: () => void;
}) {
  return (
    <div
      className="flex cursor-grab items-center gap-2 rounded-lg border border-border bg-panel-2 px-2 py-1.5 select-none active:cursor-grabbing"
      draggable
      onDragStart={(e) => {
        onDragStart();
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
          console.log(SFX_VOLUME_DEFAULT * loudnessGainFor(asset.src))
          onPreview(
            asset.key,
            asset.src,
            SFX_VOLUME_DEFAULT * loudnessGainFor(asset.src),
          );
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
  );
}

export function SfxTab() {
  const assets = useEditor((s) => s.sfxAssets);
  const { playingKey, preview, stopPreview } = useAudioPreview();
  const [openFolders, setOpenFolders] = useState<Set<string>>(() => new Set());

  const groups = groupSfxAssets(assets);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="flex flex-col gap-1 p-2.5">
        {groups.map(({ folder, label, assets: groupAssets }) => {
          const folderKey = folder ?? "__other__";
          const open = openFolders.has(folderKey);
          return (
            <Collapsible
              key={folderKey}
              open={open}
              onOpenChange={(next) => {
                setOpenFolders((prev) => {
                  const nextSet = new Set(prev);
                  if (next) nextSet.add(folderKey);
                  else nextSet.delete(folderKey);
                  return nextSet;
                });
              }}
              className="overflow-hidden rounded-lg border border-border"
            >
              <CollapsibleTrigger className="flex w-full items-center gap-1.5 bg-panel-2 px-2 py-1.5 text-left hover:bg-panel-2/80">
                <ChevronRight
                  className={cn(
                    "size-3.5 shrink-0 text-muted transition-transform",
                    open && "rotate-90",
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[#e8eaef]">
                  {label}
                </span>
                <span className="shrink-0 text-[10px] text-muted">
                  {groupAssets.length}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex flex-col gap-1 border-t border-border p-1.5">
                  {groupAssets.map((asset) => (
                    <SfxRow
                      key={asset.key}
                      asset={asset}
                      playingKey={playingKey}
                      onPreview={preview}
                      onDragStart={stopPreview}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
        {assets.length === 0 ? (
          <p className="text-xs text-muted">No files in public/sfx.</p>
        ) : null}
      </div>
    </div>
  );
}
