import { useEffect } from "react";
import { togglePlayback } from "./lib/player-bridge";
import { AssetsPanel } from "./components/AssetsPanel";
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
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (isTypingTarget(e.target)) return;
        if (editor.deleteSelection()) e.preventDefault();
      } else if (isTypingTarget(e.target)) {
        return;
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
  const episodeId = useEditor((s) => s.props?.episodeId);
  const dirty = useEditor((s) => s.dirty);

  useEffect(() => {
    void useEditor.getState().load();
  }, []);
  useGlobalShortcuts();

  useEffect(() => {
    document.title = episodeId
      ? `${dirty ? "● " : ""}${episodeId}`
      : "Editor";
  }, [episodeId, dirty]);

  if (loadState === "loading") {
    return (
      <div className="flex h-full items-center justify-center bg-[#12141a] text-sm text-muted">
        Loading episode…
      </div>
    );
  }
  if (loadState === "error") {
    return (
      <div className="bg-red-950 px-3 py-2 text-sm text-red-200">
        {error ?? "Failed to load episode"}
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 w-full max-w-[100vw] grid-rows-[1fr_280px] overflow-hidden bg-[#12141a] text-[#e8eaef] font-sans">
      {error ? (
        <div className="absolute left-0 right-0 top-0 z-20 bg-red-950 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid min-h-0 min-w-0 grid-cols-[200px_1fr_280px] overflow-hidden border-b border-border">
        <AssetsPanel />
        <TranscriptPanel />
        <PlayerPanel />
      </div>

      <Timeline />
    </div>
  );
}
