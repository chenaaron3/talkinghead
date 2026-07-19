import { useState } from 'react';

import { episodeHeaders } from '../../lib/api';
import { importMediaBatch } from '../../lib/import-media-batch';
import { cn } from '../../lib/utils';
import { useEditor } from '../../store';
import { Dropzone } from '../ui/dropzone';
import { useAudioPreview } from './useAudioPreview';

export function MusicTab() {
  const assets = useEditor((s) => s.musicAssets);
  const activeSrc = useEditor((s) => s.config?.music?.src ?? null);
  const onSelect = useEditor((s) => s.setMusic);
  const episodeId = useEditor((s) => s.episodeId);
  const refreshAssets = useEditor((s) => s.refreshAssets);
  const { playingKey, preview, stopPreview } = useAudioPreview();
  const [dropError, setDropError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const importMusic = async (files: File[]) => {
    if (!episodeId) {
      setDropError("Select an episode before adding music.");
      return;
    }
    setImporting(true);
    setDropError(null);
    try {
      const { errors } = await importMediaBatch(files, (file) =>
        fetch("/api/import-music", {
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

  return (
    <Dropzone
      className="min-h-0 flex-1 overflow-auto"
      multiple
      noClick
      noKeyboard
      accept={{
        "audio/mpeg": [".mp3"],
        "audio/wav": [".wav"],
        "audio/x-wav": [".wav"],
        "audio/mp4": [".m4a"],
        "audio/aac": [".m4a"],
        "audio/ogg": [".ogg"],
        "audio/flac": [".flac"],
      }}
      onDrop={(accepted) => {
        if (accepted.length === 0) return;
        stopPreview();
        void importMusic(accepted);
      }}
      onDropRejected={() => {
        setDropError(
          "Drop audio files (.mp3 / .wav / .m4a / .ogg / .flac).",
        );
      }}
    >
      {(dz) => (
        <div className="flex flex-col gap-1 p-2.5">
          {assets.map((asset) => {
            const active = asset.src === activeSrc;
            return (
              <div
                key={asset.key}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border bg-panel-2 px-2 py-1.5 select-none",
                  active
                    ? "border-music ring-1 ring-music"
                    : "border-border hover:border-music/60",
                )}
                onClick={() => {
                  stopPreview();
                  onSelect(asset);
                }}
                title={`${asset.label} (${asset.durationSec.toFixed(1)}s)`}
              >
                <button
                  type="button"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-music/25 text-music hover:bg-music/40"
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
                  {active ? "On" : `${asset.durationSec.toFixed(0)}s`}
                </span>
              </div>
            );
          })}
          {assets.length === 0 && !importing ? (
            <p className="text-xs text-muted">
              Drop audio here to add episode music, or use tracks from
              public/music.
            </p>
          ) : null}
          {importing ? (
            <p className="text-xs text-muted">Importing…</p>
          ) : null}
          {dropError ? (
            <p className="text-xs text-red-400">{dropError}</p>
          ) : null}
          {dz.isDragActive ? (
            <p className="text-center text-xs font-medium text-accent">
              Drop audio to add
            </p>
          ) : null}
        </div>
      )}
    </Dropzone>
  );
}
