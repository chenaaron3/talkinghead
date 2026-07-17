import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Scissors } from "lucide-react";

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
  const captionsAtATime = useEditor((s) => s.config?.captionsAtATime ?? 1);
  const setCaptionsAtATime = useEditor((s) => s.setCaptionsAtATime);
  const title = useEditor((s) => s.title);
  const configTitle = useEditor((s) => s.config?.title ?? "");
  const setTitle = useEditor((s) => s.setTitle);
  const scissorMode = mode === "scissor";

  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  const tooltip = scissorMode
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
            className="h-7 max-w-full truncate rounded-md px-1 text-left text-sm font-medium text-[#e8eaef] hover:bg-panel-2"
            title="Click to edit title"
            onClick={() => setEditing(true)}
          >
            {title || "Untitled"}
          </button>
        )}
      </div>

      <TooltipProvider>
        <div className="flex shrink-0 items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex h-7 items-center overflow-hidden rounded-md border border-border bg-panel-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 shrink-0 rounded-none px-0"
                  disabled={captionsAtATime <= 1}
                  aria-label="Fewer words per caption"
                  onClick={() => setCaptionsAtATime(captionsAtATime - 1)}
                >
                  <Minus className="size-3.5" />
                </Button>
                <span className="min-w-13 select-none text-center text-xs text-[#e8eaef]">
                  {captionsAtATime} word{captionsAtATime === 1 ? "" : "s"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 shrink-0 rounded-none px-0"
                  disabled={captionsAtATime >= 5}
                  aria-label="More words per caption"
                  onClick={() => setCaptionsAtATime(captionsAtATime + 1)}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Words shown per caption group
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
            <TooltipContent side="bottom">{tooltip}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}
