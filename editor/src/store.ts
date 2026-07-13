import { useMemo } from "react";
import { create } from "zustand";
import { buildProps } from "@src/lib/build-props";
import { snapSourceSecToKeep } from "@src/lib/source-timeline";
import type {
  CaptionEmphasis,
  EpisodeConfig,
  EpisodeProps,
  SourceBRoll,
  Transcript,
} from "@src/lib/types";
import { removeBRoll, snapToCaptionBoundary, upsertBRoll } from "./lib/broll";
import {
  flattenCaptions,
  updateCaption,
  type FlatCaption,
} from "./lib/captions";
import { sourceSecToOutputFrame } from "./lib/frames";
import { adjustSectionEdge, restoreGap } from "./lib/sections";

export type Asset = {
  key: string;
  label: string;
  src: string;
  thumbUrl: string;
};

type EpisodeSnapshot = {
  config: EpisodeConfig;
  transcript: Transcript;
};

type EditorState = {
  loadState: "loading" | "ready" | "error";
  error: string | null;
  episodeId: string | null;
  title: string;
  videoSrc: string;
  fps: number;
  width: number;
  height: number;
  config: EpisodeConfig | null;
  transcript: Transcript | null;
  props: EpisodeProps | null;
  assets: Asset[];
  dirty: boolean;
  saving: boolean;
  /** Playhead on output timeline (for Remotion preview). */
  frame: number;
  /** Source playhead position in seconds (for timeline display). */
  sourceSec: number;
  pxPerSec: number;
  selectedBRollId: string | null;
  selectedGap: number | null;
};

type EditorActions = {
  load: () => Promise<void>;
  save: () => Promise<void>;
  seekSource: (sourceSec: number) => void;
  seekOutput: (frame: number) => void;
  setPxPerSec: (v: number) => void;
  selectBRoll: (id: string | null) => void;
  selectGap: (gapId: number | null) => void;
  clearSelection: () => void;
  beginGesture: () => void;
  undo: () => void;
  redo: () => void;
  deleteSelection: () => boolean;
  setCaptionText: (caption: FlatCaption, text: string) => void;
  setCaptionEmphasis: (
    caption: FlatCaption,
    emphasis: CaptionEmphasis | undefined,
  ) => void;
  placeBRollOnCaption: (asset: Asset, caption: FlatCaption) => void;
  updateBRollRange: (
    id: string,
    start: number,
    end: number,
    live?: boolean,
  ) => void;
  adjustSection: (
    sectionIndex: number,
    edge: "start" | "end",
    deltaSec: number,
    live?: boolean,
  ) => void;
};

const history: EpisodeSnapshot[] = [];
const future: EpisodeSnapshot[] = [];
let saveTimer: ReturnType<typeof setTimeout> | null = null;
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

function recomputeProps(state: {
  episodeId: string;
  title: string;
  videoSrc: string;
  fps: number;
  width: number;
  height: number;
  config: EpisodeConfig;
  transcript: Transcript;
}): EpisodeProps {
  return buildProps({
    episodeId: state.episodeId,
    title: state.title,
    videoSrc: state.videoSrc,
    fps: state.fps,
    width: state.width,
    height: state.height,
    config: state.config,
    transcript: state.transcript,
  });
}

export const useEditor = create<EditorState & EditorActions>((set, get) => {
  const pushHistory = (snapshot: EpisodeSnapshot) => {
    history.push(snapshot);
    if (history.length > 50) history.shift();
    future.length = 0;
  };

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void get().save(), 400);
  };

  const snapshot = (): EpisodeSnapshot | null => {
    const { config, transcript } = get();
    if (!config || !transcript) return null;
    return { config, transcript };
  };

  const commit = (next: EpisodeSnapshot, live = false) => {
    const prev = snapshot();
    if (!live && prev) pushHistory(prev);

    const state = get();
    if (!state.episodeId) return;

    const props = recomputeProps({
      episodeId: state.episodeId,
      title: state.title,
      videoSrc: state.videoSrc,
      fps: state.fps,
      width: state.width,
      height: state.height,
      config: next.config,
      transcript: next.transcript,
    });

    const sourceSec = state.sourceSec;

    set({
      config: next.config,
      transcript: next.transcript,
      props,
      frame: sourceSecToOutputFrame(
        sourceSec,
        next.config,
        state.fps,
        next.transcript.duration,
      ),
      sourceSec,
      dirty: true,
      error: null,
    });
    scheduleSave();
  };

  const restore = (snap: EpisodeSnapshot) => {
    const state = get();
    if (!state.episodeId) return;
    const props = recomputeProps({
      episodeId: state.episodeId,
      title: state.title,
      videoSrc: state.videoSrc,
      fps: state.fps,
      width: state.width,
      height: state.height,
      config: snap.config,
      transcript: snap.transcript,
    });
    set({
      config: snap.config,
      transcript: snap.transcript,
      props,
      dirty: true,
    });
    scheduleSave();
  };

  return {
    loadState: "loading",
    error: null,
    episodeId: null,
    title: "",
    videoSrc: "",
    fps: 30,
    width: 1080,
    height: 1920,
    config: null,
    transcript: null,
    props: null,
    assets: [],
    dirty: false,
    saving: false,
    frame: 0,
    sourceSec: 0,
    pxPerSec: 40,
    selectedBRollId: null,
    selectedGap: null,

    load: async () => {
      try {
        const [epRes, assetsRes] = await Promise.all([
          fetch("/api/episode"),
          fetch("/api/assets"),
        ]);
        const ep = (await epRes.json()) as {
          episodeId?: string;
          config?: EpisodeConfig;
          transcript?: Transcript;
          props?: EpisodeProps;
          error?: string;
        };
        const as = (await assetsRes.json()) as {
          assets?: Asset[];
          error?: string;
        };
        if (!epRes.ok) throw new Error(ep.error ?? "Failed to load episode");
        if (!assetsRes.ok) throw new Error(as.error ?? "Failed to load assets");
        if (!ep.config || !ep.transcript || !ep.props) {
          throw new Error("Episode payload incomplete");
        }
        set({
          episodeId: ep.episodeId ?? ep.props.episodeId,
          title: ep.props.title,
          videoSrc: ep.props.videoSrc,
          fps: ep.props.fps,
          width: ep.props.width,
          height: ep.props.height,
          config: ep.config,
          transcript: ep.transcript,
          props: ep.props,
          assets: as.assets ?? [],
          loadState: "ready",
          frame: 0,
          sourceSec: 0,
        });
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : String(err),
          loadState: "error",
        });
      }
    },

    save: async () => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      set({ saving: true });
      try {
        const res = await fetch("/api/episode", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config, transcript }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          props?: EpisodeProps;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Save failed");
        if (data.props) set({ props: data.props });
        set({ dirty: false });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      } finally {
        set({ saving: false });
      }
    },

    seekSource: (sourceSec) => {
      const { config, fps, transcript } = get();
      if (!config || !transcript) return;
      const snapped = snapSourceSecToKeep(
        sourceSec,
        config.cuts,
        transcript.duration,
      );
      const frame = sourceSecToOutputFrame(
        snapped,
        config,
        fps,
        transcript.duration,
      );
      set({ sourceSec: snapped, frame });
    },

    seekOutput: (frame) => {
      const { props } = get();
      if (!props) return;
      const fps = props.fps;
      const outputSec = frame / fps;
      let cursor = 0;
      let sourceSec = 0;
      for (const s of props.sections) {
        const segEnd = cursor + s.durationInFrames / fps;
        if (outputSec >= cursor && outputSec <= segEnd + 0.001) {
          sourceSec = s.trimBefore / fps + (outputSec - cursor);
          break;
        }
        cursor = segEnd;
      }
      set({ frame, sourceSec });
    },

    setPxPerSec: (pxPerSec) => set({ pxPerSec }),

    selectBRoll: (id) =>
      set({ selectedBRollId: id, ...(id != null ? { selectedGap: null } : {}) }),
    selectGap: (gapId) =>
      set({
        selectedGap: gapId,
        ...(gapId != null ? { selectedBRollId: null } : {}),
      }),
    clearSelection: () => set({ selectedBRollId: null, selectedGap: null }),

    beginGesture: () => {
      const snap = snapshot();
      if (snap) pushHistory(snap);
    },

    undo: () => {
      const current = snapshot();
      const prev = history.pop();
      if (!current || !prev) return;
      future.push(current);
      restore(prev);
    },

    redo: () => {
      const current = snapshot();
      const next = future.pop();
      if (!current || !next) return;
      history.push(current);
      restore(next);
    },

    deleteSelection: () => {
      const { config, transcript, selectedGap, selectedBRollId } = get();
      if (!config || !transcript) return false;
      if (selectedGap != null) {
        commit({
          config: restoreGap(config, selectedGap),
          transcript,
        });
        set({ selectedGap: null });
        return true;
      }
      if (selectedBRollId) {
        commit({
          config: {
            ...config,
            bRolls: removeBRoll(config.bRolls, selectedBRollId),
          },
          transcript,
        });
        set({ selectedBRollId: null });
        return true;
      }
      return false;
    },

    setCaptionText: (caption, text) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      commit({
        config,
        transcript: updateCaption(transcript, caption.index, { text }),
      });
    },

    setCaptionEmphasis: (caption, emphasis) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      commit({
        config,
        transcript: updateCaption(
          transcript,
          caption.index,
          emphasis == null ? { clearEmphasis: true } : { emphasis },
        ),
      });
    },

    placeBRollOnCaption: (asset, caption) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const clip: SourceBRoll = {
        id: newId(),
        src: asset.src,
        start: caption.start,
        end: Math.max(caption.start + 0.04, caption.end),
      };
      const result = upsertBRoll(config.bRolls, clip);
      if ("error" in result) return;
      commit({ config: { ...config, bRolls: result }, transcript });
      set({ selectedBRollId: clip.id, selectedGap: null });
    },

    updateBRollRange: (id, start, end, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const clip = config.bRolls.find((c) => c.id === id);
      if (!clip) return;
      const snappedStart = snapToCaptionBoundary(
        start,
        transcript.captions,
        "start",
      );
      const snappedEnd = snapToCaptionBoundary(
        Math.max(start + 0.04, end),
        transcript.captions,
        "end",
      );
      const result = upsertBRoll(config.bRolls, {
        ...clip,
        start: snappedStart,
        end: Math.max(snappedStart + 0.04, snappedEnd),
      });
      if ("error" in result) return;
      commit({ config: { ...config, bRolls: result }, transcript }, live);
    },

    adjustSection: (sectionIndex, edge, deltaSec, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      commit(
        {
          config: adjustSectionEdge(
            config,
            sectionIndex,
            edge,
            deltaSec,
            transcript.duration,
          ),
          transcript,
        },
        live,
      );
    },
  };
});

export function useFlatCaptions(): FlatCaption[] {
  const captions = useEditor((s) => s.transcript?.captions);
  return useMemo(
    () => (captions ? flattenCaptions(captions) : []),
    [captions],
  );
}
