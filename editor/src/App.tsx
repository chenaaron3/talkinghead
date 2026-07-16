import { useEffect } from "react";
import { cn } from "./lib/utils";
import { togglePlayback } from "./lib/player-bridge";
import { AssetsPanel } from "./components/AssetsPanel";
import { Navbar } from "./components/Navbar";
import { PlayerPanel } from "./components/PlayerPanel";
import { Timeline } from "./components/timeline/Timeline";
import { TranscriptPanel } from "./components/transcript/TranscriptPanel";
import { useSelection } from "./selection-store";
import { useEditor } from "./store";

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const editor = useEditor.getState();
      const selection = useSelection.getState();
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void editor.save();
      } else if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) editor.redo();
        else editor.undo();
      } else if (e.key === "Escape") {
        selection.clearSelection();
        editor.setMode("default");
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (isTypingTarget(e.target)) return;
        if (editor.deleteSelection()) e.preventDefault();
      } else if (isTypingTarget(e.target)) {
        return;
      } else if (
        !meta &&
        !e.altKey &&
        e.key.toLowerCase() === "c" &&
        editor.loadState === "ready"
      ) {
        e.preventDefault();
        editor.toggleMode();
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        togglePlayback();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (selection.selection?.kind === "caption") {
          if (e.shiftKey && editor.extendCaptionArrow(-1)) return;
          if (editor.seekAdjacentCaption(-1)) return;
        }
        editor.seekBySeconds(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (selection.selection?.kind === "caption") {
          if (e.shiftKey && editor.extendCaptionArrow(1)) return;
          if (editor.seekAdjacentCaption(1)) return;
        }
        editor.seekBySeconds(1);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}

export function App() {
  const loadState = useEditor((s) => s.loadState);
  const error = useEditor((s) => s.error);
  const episodeId = useEditor((s) => s.episodeId);
  const title = useEditor((s) => s.title);
  const dirty = useEditor((s) => s.dirty);

  useEffect(() => {
    void useEditor.getState().load();
  }, []);
  useGlobalShortcuts();

  useEffect(() => {
    const label =
      loadState === "ready" && title
        ? title
        : episodeId
          ? episodeId
          : "Editor";
    document.title = `${dirty ? "● " : ""}${label}`;
  }, [episodeId, title, dirty, loadState]);

  return (
    <div
      className={cn(
        "relative grid h-full min-h-0 w-full max-w-[100vw] overflow-hidden bg-[#12141a] text-[#e8eaef] font-sans",
        loadState === "ready" ? "grid-rows-[auto_1fr_280px]" : "grid-rows-[auto_1fr]",
      )}
    >
      <Navbar />

      {error ? (
        <div className="pointer-events-none absolute left-0 right-0 top-11 z-20 px-3 py-2">
          <div className="pointer-events-auto rounded-md bg-red-950 px-3 py-2 text-sm text-red-200 shadow-lg">
            {error}
          </div>
        </div>
      ) : null}

      {loadState === "loading" ? (
        <div className="flex min-h-0 items-center justify-center text-sm text-muted">
          Loading episode…
        </div>
      ) : loadState === "idle" ? (
        <div className="flex min-h-0 flex-col items-center justify-center gap-2 text-sm text-muted">
          <p>No episode open.</p>
          <p className="text-xs">Press ⌘K or click the title to choose one.</p>
        </div>
      ) : (
        <div className="grid min-h-0 min-w-0 grid-cols-[200px_1fr_280px] overflow-hidden border-b border-border">
          <AssetsPanel />
          <TranscriptPanel />
          <PlayerPanel />
        </div>
      )}

      {loadState === "ready" ? <Timeline /> : null}
    </div>
  );
}
