import { useEffect, useRef, useState } from "react";
import { Captions, Scissors } from "lucide-react";

import { useSelection } from "../../selection-store";
import { useEditor } from "../../store";
import { Button } from "../ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

export function TranscriptToolbar() {
  const mode = useEditor((s) => s.mode);
  const toggleMode = useEditor((s) => s.toggleMode);
  const title = useEditor((s) => s.title);
  const configTitle = useEditor((s) => s.config?.title ?? "");
  const setTitle = useEditor((s) => s.setTitle);
  const selection = useSelection((s) => s.selection);
  const selectCaptionsPanel = useSelection((s) => s.selectCaptionsPanel);
  const selectTitlePanel = useSelection((s) => s.selectTitlePanel);
  const clearSelection = useSelection((s) => s.clearSelection);
  const scissorMode = mode === "scissor";
  const captionsOpen = selection?.kind === "captions";
  const titleOpen = selection?.kind === "title";

  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  const scissorTooltip = scissorMode
    ? "Click pauses to cut · Click words to delete · Esc to exit"
    : "Scissor mode (C)";

  return (
    <div
      className={[
        "flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2",
        scissorMode ? "bg-[#1a1d28]" : "bg-panel",
      ].join(" ")}
    >
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={configTitle}
            aria-label="Episode title"
            className="h-7 w-full min-w-0 rounded-md border border-accent bg-panel-2 px-2 text-sm font-medium text-[#e8eaef] outline-none"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        ) : (
          <button
            type="button"
            className={[
              "h-7 max-w-full truncate rounded-md px-1 text-left text-sm font-medium text-[#e8eaef] hover:bg-panel-2",
              titleOpen ? "bg-accent/15 ring-1 ring-accent" : "",
            ].join(" ")}
            title="Click to edit title"
            onClick={() => {
              selectTitlePanel();
              setEditing(true);
            }}
          >
            {title || "Untitled"}
          </button>
        )}
      </div>

      <TooltipProvider>
        <div className="flex shrink-0 items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={captionsOpen ? "default" : "outline"}
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-xs"
                aria-pressed={captionsOpen}
                onClick={() => {
                  if (captionsOpen) clearSelection();
                  else selectCaptionsPanel();
                }}
              >
                <Captions className="size-3.5" />
                Captions
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Edit default caption style
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={scissorMode ? "default" : "outline"}
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-xs"
                aria-pressed={scissorMode}
                onClick={() => toggleMode()}
              >
                <Scissors className="size-3.5" />
                Scissors
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{scissorTooltip}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}
