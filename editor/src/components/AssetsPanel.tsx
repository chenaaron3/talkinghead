import { useEffect, useRef, useState } from 'react';

import { episodeHeaders } from '../lib/api';
import { isVideoSrc } from '../lib/broll';
import { cn } from '../lib/utils';
import { useEditor } from '../store';
import { Dropzone } from './ui/dropzone';

import type { LibraryAsset, SfxAsset } from '../store';
type Tab = "broll" | "sfx";

function BRollThumb({ asset }: { asset: LibraryAsset }) {
  if (isVideoSrc(asset.src)) {
    return (
      <video
        src={asset.thumbUrl}
        muted
        playsInline
        preload="metadata"
        className="aspect-square w-full bg-black object-cover"
      />
    );
  }
  return (
    <img
      src={asset.thumbUrl}
      alt={asset.label}
      className="aspect-square w-full bg-black object-cover"
    />
  );
}

function BRollGrid({
  assets,
  selectedKey,
  onSelect,
  dropError,
  importing,
  isDragActive,
}: {
  assets: LibraryAsset[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  dropError: string | null;
  importing: boolean;
  isDragActive: boolean;
}) {
  return (
    <div className="grid min-h-full grid-cols-2 content-start gap-2 p-2.5">
      {assets.map((asset) => {
        const selected = asset.key === selectedKey;
        return (
          <div
            key={asset.key}
            className={cn(
              "cursor-grab overflow-hidden rounded-lg border bg-panel-2 select-none active:cursor-grabbing",
              selected
                ? "border-accent ring-1 ring-accent"
                : "border-border",
            )}
            draggable
            onClick={(e) => {
              e.stopPropagation();
              onSelect(selected ? null : asset.key);
            }}
            onDragStart={(e) => {
              e.dataTransfer.setData(
                "application/x-broll-asset",
                JSON.stringify(asset),
              );
              e.dataTransfer.effectAllowed = "copy";
            }}
            title={
              asset.durationSec != null
                ? `${asset.label} (${asset.durationSec.toFixed(1)}s)`
                : asset.label
            }
          >
            <BRollThumb asset={asset} />
            <span className="block truncate px-1.5 py-1 text-[10px] text-muted">
              {asset.label}
            </span>
          </div>
        );
      })}
      {assets.length === 0 && !importing ? (
        <p className="col-span-2 text-xs text-muted">
          Drop images or videos here to use as b-roll.
        </p>
      ) : null}
      {importing ? (
        <p className="col-span-2 text-xs text-muted">Importing…</p>
      ) : null}
      {dropError ? (
        <p className="col-span-2 text-xs text-red-400">{dropError}</p>
      ) : null}
      {isDragActive ? (
        <p className="col-span-2 text-center text-xs font-medium text-accent">
          Drop media to add
        </p>
      ) : null}
    </div>
  );
}

function SfxGrid({ assets }: { assets: SfxAsset[] }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const stopPreview = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    audioRef.current = null;
    setPlayingKey(null);
  };

  const preview = (asset: SfxAsset) => {
    if (playingKey === asset.key) {
      stopPreview();
      return;
    }
    stopPreview();
    const audio = new Audio(`/${asset.src}`);
    audioRef.current = audio;
    setPlayingKey(asset.key);
    void audio.play().catch(() => {
      setPlayingKey(null);
    });
    audio.onended = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
        setPlayingKey(null);
      }
    };
  };

  return (
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
              preview(asset);
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
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

export function AssetsPanel() {
  const assets = useEditor((s) => s.assets);
  const sfxAssets = useEditor((s) => s.sfxAssets);
  const episodeId = useEditor((s) => s.episodeId);
  const refreshAssets = useEditor((s) => s.refreshAssets);
  const removeBRollsBySrc = useEditor((s) => s.removeBRollsBySrc);
  const [tab, setTab] = useState<Tab>("broll");
  const [dropError, setDropError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const deletingRef = useRef(false);

  const selected = assets.find((a) => a.key === selectedKey) ?? null;

  const importBRoll = async (files: File[]) => {
    if (!episodeId) {
      setDropError("Select an episode before adding b-roll.");
      return;
    }
    setImporting(true);
    setDropError(null);
    try {
      for (const file of files) {
        const res = await fetch("/api/import-broll", {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-Filename": encodeURIComponent(file.name),
            ...episodeHeaders(episodeId),
          },
          body: file,
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? `Failed to import ${file.name}`);
        }
      }
      await refreshAssets();
    } catch (err) {
      setDropError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    if (!selected || !episodeId || tab !== "broll") return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (isTypingTarget(e.target)) return;
      if (deletingRef.current) return;
      e.preventDefault();
      e.stopImmediatePropagation();

      const asset = selected;
      deletingRef.current = true;
      setDropError(null);
      void (async () => {
        try {
          const res = await fetch("/api/broll-asset", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              ...episodeHeaders(episodeId),
            },
            body: JSON.stringify({ key: asset.key }),
          });
          const data = (await res.json()) as { error?: string; src?: string };
          if (!res.ok) {
            throw new Error(data.error ?? "Failed to delete asset");
          }
          if (data.src) removeBRollsBySrc(data.src);
          setSelectedKey(null);
          await refreshAssets();
        } catch (err) {
          setDropError(err instanceof Error ? err.message : String(err));
        } finally {
          deletingRef.current = false;
        }
      })();
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [selected, episodeId, tab, removeBRollsBySrc, refreshAssets]);

  return (
    <div className="flex min-h-0 flex-col overflow-hidden border-r border-border bg-panel">
      <div className="flex shrink-0 border-b border-border">
        {(
          [
            ["broll", "B-roll"],
            ["sfx", "SFX"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`flex-1 px-2 py-1.5 text-[11px] ${tab === id
              ? "border-b-2 border-accent text-[#e8eaef]"
              : "text-muted hover:text-[#e8eaef]"
              }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "broll" ? (
        <Dropzone
          className="min-h-0 flex-1 overflow-auto"
          multiple
          noClick
          noKeyboard
          accept={{
            "image/jpeg": [".jpg", ".jpeg"],
            "image/png": [".png"],
            "image/webp": [".webp"],
            "image/gif": [".gif"],
            "image/heic": [".heic"],
            "image/heif": [".heif"],
            "video/mp4": [".mp4"],
            "video/quicktime": [".mov"],
            "video/webm": [".webm"],
          }}
          onDrop={(accepted) => {
            if (accepted.length === 0) return;
            void importBRoll(accepted);
          }}
          onDropRejected={() => {
            setDropError(
              "Drop image or video files (.jpg / .png / .webp / .gif / .heic / .mp4 / .mov / .webm).",
            );
          }}
        >
          {(dz) => (
            <BRollGrid
              assets={assets}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              dropError={dropError}
              importing={importing}
              isDragActive={dz.isDragActive}
            />
          )}
        </Dropzone>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <SfxGrid assets={sfxAssets} />
        </div>
      )}
    </div>
  );
}
