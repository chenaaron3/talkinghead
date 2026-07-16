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

type EpisodePickerProps = {
  open: boolean;
  episodes: EpisodeListItem[];
  currentEpisodeId: string | null;
  loading?: boolean;
  onClose: () => void;
  onSelect: (episodeId: string) => void;
};

export function EpisodePicker({
  open,
  episodes,
  currentEpisodeId,
  loading = false,
  onClose,
  onSelect,
}: EpisodePickerProps) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Switch episode"
      description="Search episodes in source/"
      showCloseButton={false}
      className="top-[12vh] max-w-xl translate-y-0 sm:max-w-xl"
    >
      <CommandInput
        placeholder="Search episodes…"
        disabled={loading}
      />
      <CommandList>
        <CommandEmpty>
          {loading
            ? "Loading episodes…"
            : episodes.length === 0
              ? "No processed episodes in source/"
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
                  <div className="truncate font-medium">{episode.title}</div>
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
                {selected ? <CommandShortcut>Current</CommandShortcut> : null}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
