import { useEffect, useRef, useState } from "react";

import { episodeHeaders } from "../../lib/api";
import { isVideoSrc } from "../../lib/broll";
import { importMediaBatch } from "../../lib/import-media-batch";
import { cn } from "../../lib/utils";
import { useEditor } from "../../store";
import { Dropzone } from "../ui/dropzone";
import { AssetPreviewDialog } from "./AssetPreviewDialog";

import type { LibraryAsset } from "../../store";

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

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
  onPreview,
  dropError,
  importing,
  isDragActive,
}: {
  assets: LibraryAsset[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onPreview: (asset: LibraryAsset) => void;
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
            onDoubleClick={(e) => {
              e.stopPropagation();
              onSelect(asset.key);
              onPreview(asset);
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

export function BRollTab() {
  const assets = useEditor((s) => s.assets);
  const episodeId = useEditor((s) => s.episodeId);
  const refreshAssets = useEditor((s) => s.refreshAssets);
  const removeBRollsBySrc = useEditor((s) => s.removeBRollsBySrc);
  const [dropError, setDropError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<LibraryAsset | null>(null);
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
      const { errors } = await importMediaBatch(files, (file) =>
        fetch("/api/import-broll", {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-Filename": encodeURIComponent(file.name),
            ...episodeHeaders(episodeId),
          },
          body: file,
        }),
      );
      await refreshAssets();
      if (errors.length > 0) {
        setDropError(errors.join(" · "));
      }
    } catch (err) {
      setDropError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    if (!selected || !episodeId) return;

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
  }, [selected, episodeId, removeBRollsBySrc, refreshAssets]);

  return (
    <>
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
            onPreview={setPreviewAsset}
            dropError={dropError}
            importing={importing}
            isDragActive={dz.isDragActive}
          />
        )}
      </Dropzone>
      <AssetPreviewDialog
        asset={previewAsset}
        onClose={() => setPreviewAsset(null)}
      />
    </>
  );
}
