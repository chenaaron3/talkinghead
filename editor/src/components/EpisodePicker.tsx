import { useState } from "react";

import type { EpisodeImportJob } from "../lib/use-episode-import";
import type { EpisodeListItem } from "../types/episodes";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "./ui/command";
import { Dropzone } from "./ui/dropzone";

export type { EpisodeImportJob };

type EpisodePickerProps = {
  open: boolean;
  episodes: EpisodeListItem[];
  currentEpisodeId: string | null;
  loading?: boolean;
  importJobs?: EpisodeImportJob[];
  onClose: () => void;
  onSelect: (episodeId: string) => void;
  onImportVideos: (files: File[]) => void;
};

function statusLabel(job: EpisodeImportJob): string {
  switch (job.status) {
    case "queued":
      return "Queued";
    case "processing":
      return "Processing…";
    case "done":
      return "Done";
    case "failed":
      return "Failed";
  }
}

export function EpisodePicker({
  open,
  episodes,
  currentEpisodeId,
  loading = false,
  importJobs = [],
  onClose,
  onSelect,
  onImportVideos,
}: EpisodePickerProps) {
  const [dropError, setDropError] = useState<string | null>(null);

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Switch episode"
      description="Search episodes in source/, or drop videos to import"
      showCloseButton={false}
      className="top-[12vh] max-w-xl translate-y-0 sm:max-w-xl"
    >
      <Dropzone
        noClick
        noKeyboard
        multiple
        accept={{
          "video/mp4": [".mp4"],
          "video/quicktime": [".mov"],
          "video/webm": [".webm"],
        }}
        onDrop={(accepted) => {
          if (accepted.length === 0) return;
          setDropError(null);
          onImportVideos(accepted);
        }}
        onDropRejected={() => {
          setDropError("Drop .mp4 / .mov / .webm video files.");
        }}
      >
        {(dz) => (
          <>
            <CommandInput
              placeholder="Search episodes… or drop videos"
              disabled={loading}
            />
            <CommandList>
              {dropError ? (
                <div className="px-3 py-2 text-xs text-red-400">{dropError}</div>
              ) : null}
              {importJobs.length > 0 ? (
                <CommandGroup heading="Importing">
                  {importJobs.map((job) => (
                    <CommandItem
                      key={job.id}
                      value={`import ${job.filename} ${job.id}`}
                      disabled
                      className="opacity-100 data-[disabled=true]:opacity-100"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{job.filename}</div>
                        {job.error ? (
                          <div className="truncate text-xs text-red-400">
                            {job.error}
                          </div>
                        ) : job.episodeId ? (
                          <div className="truncate text-xs text-muted-foreground">
                            {job.episodeId}
                          </div>
                        ) : null}
                      </div>
                      <CommandShortcut
                        className={
                          job.status === "failed"
                            ? "text-red-400"
                            : job.status === "done"
                              ? "text-accent"
                              : undefined
                        }
                      >
                        {statusLabel(job)}
                      </CommandShortcut>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              <CommandEmpty>
                {loading
                  ? "Loading episodes…"
                  : episodes.length === 0
                    ? "No processed episodes in source/ — drop a video to import"
                    : "No matches"}
              </CommandEmpty>
              <CommandGroup heading="Episodes">
                {episodes.map((episode) => {
                  const selected = episode.episodeId === currentEpisodeId;
                  return (
                    <CommandItem
                      key={episode.episodeId}
                      value={`${episode.title} ${episode.episodeId}`}
                      onSelect={() => onSelect(episode.episodeId)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {episode.title}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {episode.episodeId}
                        </div>
                      </div>
                      {episode.scheduledLabel ? (
                        <div className="shrink-0 text-right">
                          <div className="text-[11px] font-medium text-accent">
                            {episode.fullyScheduled ? "Scheduled" : "Partial"}
                          </div>
                          <div className="max-w-[180px] truncate text-[11px] text-muted-foreground">
                            {episode.scheduledLabel}
                          </div>
                        </div>
                      ) : null}
                      {selected ? (
                        <CommandShortcut>Current</CommandShortcut>
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
            {dz.isDragActive ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-popover/80 text-sm font-medium text-accent">
                Drop videos to import
              </div>
            ) : null}
          </>
        )}
      </Dropzone>
    </CommandDialog>
  );
}
