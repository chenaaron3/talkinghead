import { useCallback, useEffect, useRef, useState } from "react";

import { useEpisodeImport } from "../lib/use-episode-import";
import { useEditor } from "../store";
import { EpisodePicker } from "./EpisodePicker";
import { ExportButton } from "./ExportButton";
import { Button } from "./ui/button";

import type { EpisodeListItem } from "../types/episodes";

export function Navbar() {
  const episodeId = useEditor((s) => s.episodeId);
  const title = useEditor((s) => s.title);
  const dirty = useEditor((s) => s.dirty);
  const loadState = useEditor((s) => s.loadState);
  const switchEpisode = useEditor((s) => s.switchEpisode);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [episodes, setEpisodes] = useState<EpisodeListItem[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const autoOpenedRef = useRef(false);

  const refreshEpisodes = useCallback(async () => {
    setEpisodesLoading(true);
    try {
      const res = await fetch("/api/episodes");
      const data = (await res.json()) as {
        episodes?: EpisodeListItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load episodes");
      setEpisodes(data.episodes ?? []);
    } catch {
      setEpisodes([]);
    } finally {
      setEpisodesLoading(false);
    }
  }, []);

  const { importJobs, importVideos } = useEpisodeImport({
    onEpisodesChanged: () => {
      void refreshEpisodes();
    },
  });

  useEffect(() => {
    void refreshEpisodes();
  }, [refreshEpisodes]);

  useEffect(() => {
    if (loadState === "idle" && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      void refreshEpisodes();
      setPickerOpen(true);
    }
  }, [loadState, refreshEpisodes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      setPickerOpen((open) => !open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openPicker = () => {
    void refreshEpisodes();
    setPickerOpen(true);
  };

  const onSelectEpisode = async (nextEpisodeId: string) => {
    setPickerOpen(false);
    if (nextEpisodeId === episodeId) return;
    await switchEpisode(nextEpisodeId);
    void refreshEpisodes();
  };

  const displayTitle =
    loadState === "ready" && title
      ? title
      : episodeId
        ? episodeId
        : "Select episode…";

  return (
    <>
      <header className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-border bg-[#0f1117] px-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="max-w-[min(420px,45vw)] justify-start gap-2 px-2 font-medium"
          onClick={openPicker}
        >
          <span className="truncate">
            {dirty ? "● " : ""}
            {displayTitle}
          </span>
        </Button>

        <div className="flex items-center gap-2">
          <ExportButton compact />
        </div>
      </header>

      <EpisodePicker
        open={pickerOpen}
        episodes={episodes}
        currentEpisodeId={episodeId}
        loading={episodesLoading}
        importJobs={importJobs}
        onClose={() => setPickerOpen(false)}
        onSelect={(id) => void onSelectEpisode(id)}
        onImportVideos={importVideos}
      />
    </>
  );
}
