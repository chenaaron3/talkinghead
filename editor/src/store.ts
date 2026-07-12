import { useMemo } from "react";
import { create } from "zustand";
import type {
  BRollClip,
  CaptionEmphasis,
  EpisodeProps,
  TranscriptWord,
} from "@src/lib/types";
import { removeBRoll, upsertBRoll } from "./lib/broll";
import {
  flattenWords,
  updateCaptionWord,
  type FlatWord,
} from "./lib/captions";
import { adjustSectionEdge, deleteGap } from "./lib/sections";

export type Asset = {
  key: string;
  label: string;
  src: string;
  thumbUrl: string;
};

type EditorState = {
  loadState: "loading" | "ready" | "error";
  error: string | null;
  props: EpisodeProps | null;
  transcriptWords: TranscriptWord[] | null;
  assets: Asset[];
  dirty: boolean;
  saving: boolean;
  /** Playhead position on the output timeline. */
  frame: number;
  /** Timeline zoom. */
  pxPerFrame: number;
  selectedBRollId: string | null;
  /** GapInfo.id of the focused gap. */
  selectedGap: number | null;
};

type EditorActions = {
  load: () => Promise<void>;
  save: () => Promise<void>;
  seek: (frame: number) => void;
  setPxPerFrame: (v: number) => void;
  selectBRoll: (id: string | null) => void;
  selectGap: (gapId: number | null) => void;
  clearSelection: () => void;
  /** Push one undo point before a drag so live updates collapse into it. */
  beginGesture: () => void;
  undo: () => void;
  redo: () => void;
  /** Delete the focused gap or b-roll. Returns false if nothing was focused. */
  deleteSelection: () => boolean;
  setWordText: (word: FlatWord, text: string) => void;
  setWordEmphasis: (
    word: FlatWord,
    emphasis: CaptionEmphasis | undefined,
  ) => void;
  placeBRollOnWord: (asset: Asset, word: FlatWord) => void;
  updateBRollRange: (
    id: string,
    startFrame: number,
    endFrame: number,
    live?: boolean,
  ) => void;
  adjustSection: (
    sectionIndex: number,
    edge: "start" | "end",
    deltaFrames: number,
    live?: boolean,
  ) => void;
};

const history: EpisodeProps[] = [];
const future: EpisodeProps[] = [];
let saveTimer: ReturnType<typeof setTimeout> | null = null;
/** True while a timeline handle drag is in progress — Player must not write frame. */
let scrubbing = false;

export function setTimelineScrubbing(active: boolean) {
  scrubbing = active;
}

export function isTimelineScrubbing() {
  return scrubbing;
}

function newId(): string {
  return `broll-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useEditor = create<EditorState & EditorActions>((set, get) => {
  const pushHistory = (props: EpisodeProps) => {
    history.push(props);
    if (history.length > 50) history.shift();
    future.length = 0;
  };

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void get().save(), 400);
  };

  /** Apply an edit. `live` = mid-drag: history was already pushed by beginGesture. */
  const commit = (next: EpisodeProps, live = false) => {
    const prev = get().props;
    if (!live && prev) pushHistory(prev);
    set({ props: next, dirty: true, error: null });
    scheduleSave();
  };

  const restore = (props: EpisodeProps) => {
    set({ props, dirty: true });
    scheduleSave();
  };

  return {
    loadState: "loading",
    error: null,
    props: null,
    transcriptWords: null,
    assets: [],
    dirty: false,
    saving: false,
    frame: 0,
    pxPerFrame: 0.35,
    selectedBRollId: null,
    selectedGap: null,

    load: async () => {
      try {
        const [epRes, assetsRes] = await Promise.all([
          fetch("/api/episode"),
          fetch("/api/assets"),
        ]);
        const ep = (await epRes.json()) as {
          props?: EpisodeProps;
          transcript?: { words: TranscriptWord[] } | null;
          error?: string;
        };
        const as = (await assetsRes.json()) as {
          assets?: Asset[];
          error?: string;
        };
        if (!epRes.ok) throw new Error(ep.error ?? "Failed to load episode");
        if (!assetsRes.ok) throw new Error(as.error ?? "Failed to load assets");
        set({
          props: { ...ep.props!, bRolls: ep.props!.bRolls ?? [] },
          transcriptWords: ep.transcript?.words ?? null,
          assets: as.assets ?? [],
          loadState: "ready",
        });
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : String(err),
          loadState: "error",
        });
      }
    },

    save: async () => {
      const props = get().props;
      if (!props) return;
      set({ saving: true });
      try {
        const res = await fetch("/api/props", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ props }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Save failed");
        set({ dirty: false });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      } finally {
        set({ saving: false });
      }
    },

    seek: (frame) => set({ frame }),
    setPxPerFrame: (pxPerFrame) => set({ pxPerFrame }),

    selectBRoll: (id) =>
      set({ selectedBRollId: id, ...(id != null ? { selectedGap: null } : {}) }),
    selectGap: (gapId) =>
      set({
        selectedGap: gapId,
        ...(gapId != null ? { selectedBRollId: null } : {}),
      }),
    clearSelection: () => set({ selectedBRollId: null, selectedGap: null }),

    beginGesture: () => {
      const props = get().props;
      if (props) pushHistory(props);
    },

    undo: () => {
      const current = get().props;
      const prev = history.pop();
      if (!current || !prev) return;
      future.push(current);
      restore(prev);
    },

    redo: () => {
      const current = get().props;
      const next = future.pop();
      if (!current || !next) return;
      history.push(current);
      restore(next);
    },

    deleteSelection: () => {
      const { props, transcriptWords, selectedGap, selectedBRollId } = get();
      if (!props) return false;
      if (selectedGap != null) {
        commit(deleteGap(props, selectedGap, transcriptWords));
        set({ selectedGap: null });
        return true;
      }
      if (selectedBRollId) {
        commit(removeBRoll(props, selectedBRollId));
        set({ selectedBRollId: null });
        return true;
      }
      return false;
    },

    setWordText: (word, text) => {
      const props = get().props;
      if (!props) return;
      commit(updateCaptionWord(props, word.groupIndex, word.wordIndex, { text }));
    },

    setWordEmphasis: (word, emphasis) => {
      const props = get().props;
      if (!props) return;
      commit(
        updateCaptionWord(
          props,
          word.groupIndex,
          word.wordIndex,
          emphasis == null ? { clearEmphasis: true } : { emphasis },
        ),
      );
    },

    placeBRollOnWord: (asset, word) => {
      const props = get().props;
      if (!props) return;
      const clip: BRollClip = {
        id: newId(),
        src: asset.src,
        startFrame: word.startFrame,
        endFrame: Math.max(word.startFrame + 1, word.endFrame),
      };
      const result = upsertBRoll(props, clip);
      if ("error" in result) return;
      commit(result);
      set({ selectedBRollId: clip.id, selectedGap: null });
    },

    updateBRollRange: (id, startFrame, endFrame, live = false) => {
      const props = get().props;
      if (!props) return;
      const clip = (props.bRolls ?? []).find((c) => c.id === id);
      if (!clip) return;
      const result = upsertBRoll(props, {
        ...clip,
        startFrame,
        endFrame: Math.max(startFrame + 1, endFrame),
      });
      if ("error" in result) return;
      commit(result, live);
    },

    adjustSection: (sectionIndex, edge, deltaFrames, live = false) => {
      const { props, transcriptWords } = get();
      if (!props) return;
      commit(
        adjustSectionEdge(props, sectionIndex, edge, deltaFrames, transcriptWords),
        live,
      );
    },
  };
});

/** Captions flattened to a single word list, annotated with their group position. */
export function useFlatWords(): FlatWord[] {
  const groups = useEditor((s) => s.props?.captionGroups);
  return useMemo(() => (groups ? flattenWords(groups) : []), [groups]);
}
