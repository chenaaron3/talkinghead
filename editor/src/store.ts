import { useMemo } from 'react';
import { create } from 'zustand';

import { buildProps } from '@src/lib/build-props';
import {
  cutsToGaps,
  cutsToKeepRegions,
  snapSourceSecToKeep,
} from '@src/lib/source-timeline';

import { removeBRoll, upsertBRoll } from './lib/broll';
import { captionIndexAt, flattenCaptions, updateCaption } from './lib/captions';
import { cutForCaption } from './lib/cuts';
import { sourceSecToOutputFrame, outputFrameToSourceSec } from './lib/frames';
import { punchInForCaption } from './lib/punchin';
import { MIN_LISTICLE_SEC, MIN_RANGE_SEC } from './lib/range';
import { cutKeepRegion, restoreGap, setSectionEdge } from './lib/sections';
import { deserializeWaveform, peakMax } from '@src/lib/waveform';
import type { SerializedWaveform, WaveformData } from "@src/lib/waveform";

import type { FlatCaption } from "./lib/captions";
import type {
  CaptionEmphasis,
  EpisodeConfig,
  EpisodeProps,
  SourceBRoll,
  Transcript,
} from "@src/lib/types";
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
  selectedPunchInIndex: number | null;
  selectedListicleItemIndex: number | null;
  selectedGap: number | null;
  selectedKeepRegionIndex: number | null;
  selectedCaptionIndex: number | null;
  waveform: WaveformData | null;
  waveformMax: number;
};

type EditorActions = {
  load: () => Promise<void>;
  save: () => Promise<void>;
  seekSource: (sourceSec: number) => void;
  seekOutput: (frame: number) => void;
  setPxPerSec: (v: number) => void;
  selectBRoll: (id: string | null) => void;
  selectPunchIn: (index: number | null) => void;
  selectListicleItem: (index: number | null) => void;
  selectGap: (gapId: number | null) => void;
  selectKeepRegion: (index: number | null) => void;
  selectCaption: (index: number | null) => void;
  seekBySeconds: (delta: number) => void;
  seekAdjacentCaption: (direction: -1 | 1) => boolean;
  syncActiveCaption: () => void;
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
  addPunchInOnCaption: (caption: FlatCaption) => void;
  cutCaption: (caption: FlatCaption) => void;
  updateBRollRange: (
    id: string,
    start: number,
    end: number,
    live?: boolean,
  ) => void;
  setSectionEdge: (
    sectionIndex: number,
    edge: "start" | "end",
    targetSec: number,
    live?: boolean,
  ) => void;
  updatePunchInRange: (
    index: number,
    start: number,
    end: number,
    live?: boolean,
  ) => void;
  updateListicleOverlay: (start: number, end: number, live?: boolean) => void;
  updateListicleItemReveal: (
    index: number,
    reveal: number,
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
    selectedPunchInIndex: null,
    selectedListicleItemIndex: null,
    selectedGap: null,
    selectedKeepRegionIndex: null,
    selectedCaptionIndex: null,
    waveform: null,
    waveformMax: 0,

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
          waveform?: SerializedWaveform | null;
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
          waveform: null,
          waveformMax: 0,
        });

        if (ep.waveform?.peaks?.length) {
          const waveform = deserializeWaveform(ep.waveform);
          set({
            waveform,
            waveformMax: peakMax(waveform.peaks),
          });
        }
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

    seekBySeconds: (delta) => {
      const { sourceSec, transcript } = get();
      if (!transcript) return;
      const next = Math.max(
        0,
        Math.min(transcript.duration, sourceSec + delta),
      );
      get().seekSource(next);
    },

    seekAdjacentCaption: (direction) => {
      const { selectedCaptionIndex, transcript } = get();
      if (!transcript || selectedCaptionIndex == null) return false;
      const next = selectedCaptionIndex + direction;
      if (next < 0 || next >= transcript.captions.length) return false;
      const caption = transcript.captions[next]!;
      set({ selectedCaptionIndex: next });
      get().seekSource(caption.start);
      return true;
    },

    syncActiveCaption: () => {
      const { sourceSec, transcript, selectedCaptionIndex } = get();
      if (!transcript) return;
      const index = captionIndexAt(sourceSec, transcript.captions);
      if (index == null || index === selectedCaptionIndex) return;
      set({ selectedCaptionIndex: index });
    },

    seekOutput: (frame) => {
      const { props, frame: prevFrame } = get();
      if (!props) return;
      const sourceSec = outputFrameToSourceSec(frame, props);
      if (frame === prevFrame) return;
      set({ frame, sourceSec });
    },

    setPxPerSec: (pxPerSec) => set({ pxPerSec }),

    selectBRoll: (id) =>
      set({
        selectedBRollId: id,
        ...(id != null
          ? {
              selectedGap: null,
              selectedKeepRegionIndex: null,
              selectedPunchInIndex: null,
              selectedListicleItemIndex: null,
            }
          : {}),
      }),
    selectPunchIn: (index) =>
      set({
        selectedPunchInIndex: index,
        ...(index != null
          ? {
              selectedBRollId: null,
              selectedGap: null,
              selectedKeepRegionIndex: null,
              selectedListicleItemIndex: null,
            }
          : {}),
      }),
    selectListicleItem: (index) =>
      set({
        selectedListicleItemIndex: index,
        ...(index != null
          ? {
              selectedBRollId: null,
              selectedPunchInIndex: null,
              selectedGap: null,
              selectedKeepRegionIndex: null,
            }
          : {}),
      }),
    selectGap: (gapId) =>
      set({
        selectedGap: gapId,
        ...(gapId != null
          ? {
              selectedBRollId: null,
              selectedPunchInIndex: null,
              selectedListicleItemIndex: null,
              selectedKeepRegionIndex: null,
              selectedCaptionIndex: null,
            }
          : {}),
      }),
    selectKeepRegion: (index) =>
      set({
        selectedKeepRegionIndex: index,
        ...(index != null
          ? {
              selectedBRollId: null,
              selectedPunchInIndex: null,
              selectedListicleItemIndex: null,
              selectedGap: null,
              selectedCaptionIndex: null,
            }
          : {}),
      }),
    selectCaption: (index) =>
      set({
        selectedCaptionIndex: index,
        ...(index != null
          ? {
              selectedBRollId: null,
              selectedPunchInIndex: null,
              selectedListicleItemIndex: null,
              selectedGap: null,
              selectedKeepRegionIndex: null,
            }
          : {}),
      }),
    clearSelection: () =>
      set({
        selectedBRollId: null,
        selectedPunchInIndex: null,
        selectedListicleItemIndex: null,
        selectedGap: null,
        selectedKeepRegionIndex: null,
        selectedCaptionIndex: null,
      }),

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
      const {
        config,
        transcript,
        selectedGap,
        selectedKeepRegionIndex,
        selectedBRollId,
        selectedPunchInIndex,
      } = get();
      if (!config || !transcript) return false;
      if (selectedGap != null) {
        commit({
          config: restoreGap(config, selectedGap),
          transcript,
        });
        set({ selectedGap: null });
        return true;
      }
      if (selectedKeepRegionIndex != null) {
        const keeps = cutsToKeepRegions(config.cuts, transcript.duration);
        const keep = keeps[selectedKeepRegionIndex];
        if (!keep) return false;
        const nextConfig = cutKeepRegion(
          config,
          selectedKeepRegionIndex,
          transcript.duration,
        );
        const gap = cutsToGaps(nextConfig.cuts).find(
          (g) => keep.start >= g.start - 0.001 && keep.start < g.end,
        );
        commit({ config: nextConfig, transcript });
        set({ selectedKeepRegionIndex: null, selectedGap: gap?.id ?? null });
        return true;
      }
      if (selectedPunchInIndex != null) {
        if (!config.punchInSegments[selectedPunchInIndex]) return false;
        commit({
          config: {
            ...config,
            punchInSegments: config.punchInSegments.filter(
              (_, i) => i !== selectedPunchInIndex,
            ),
          },
          transcript,
        });
        set({ selectedPunchInIndex: null });
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
      set({
        selectedBRollId: clip.id,
        selectedGap: null,
        selectedKeepRegionIndex: null,
        selectedPunchInIndex: null,
        selectedListicleItemIndex: null,
      });
    },

    addPunchInOnCaption: (caption) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const segment = punchInForCaption(caption);
      const punchInSegments = [...config.punchInSegments, segment].sort(
        (a, b) => a.start - b.start,
      );
      const newIndex = punchInSegments.indexOf(segment);
      commit({ config: { ...config, punchInSegments }, transcript });
      set({
        selectedPunchInIndex: newIndex,
        selectedBRollId: null,
        selectedGap: null,
        selectedKeepRegionIndex: null,
        selectedListicleItemIndex: null,
        selectedCaptionIndex: caption.index,
      });
    },

    cutCaption: (caption) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const cuts = cutForCaption(config.cuts, caption);
      const gap = cutsToGaps(cuts).find(
        (g) => caption.start >= g.start && caption.start < g.end,
      );
      commit({ config: { ...config, cuts }, transcript });
      set({
        selectedGap: gap?.id ?? null,
        selectedKeepRegionIndex: null,
        selectedBRollId: null,
        selectedPunchInIndex: null,
        selectedListicleItemIndex: null,
        selectedCaptionIndex: caption.index,
      });
    },

    updateBRollRange: (id, start, end, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const clip = config.bRolls.find((c) => c.id === id);
      if (!clip) return;
      if (end <= start + MIN_RANGE_SEC) return;
      const result = upsertBRoll(config.bRolls, {
        ...clip,
        start,
        end,
      });
      if ("error" in result) return;
      commit({ config: { ...config, bRolls: result }, transcript }, live);
    },

    setSectionEdge: (sectionIndex, edge, targetSec, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      commit(
        {
          config: setSectionEdge(
            config,
            sectionIndex,
            edge,
            targetSec,
            transcript.duration,
          ),
          transcript,
        },
        live,
      );
    },

    updatePunchInRange: (index, start, end, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const seg = config.punchInSegments[index];
      if (!seg) return;
      const duration = transcript.duration;
      if (end <= start + MIN_RANGE_SEC) return;
      const nextStart = Math.max(0, Math.min(start, duration - MIN_RANGE_SEC));
      const nextEnd = Math.min(end, duration);
      if (nextEnd <= nextStart + MIN_RANGE_SEC) return;
      const punchInSegments = config.punchInSegments.map((p, i) =>
        i === index ? { ...p, start: nextStart, end: nextEnd } : p,
      );
      commit({ config: { ...config, punchInSegments }, transcript }, live);
    },

    updateListicleOverlay: (start, end, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript || !config.listicleOverlay) return;
      const duration = transcript.duration;
      if (end <= start + MIN_LISTICLE_SEC) return;
      const nextStart = Math.max(0, start);
      const nextEnd = Math.min(end, duration);
      if (nextEnd <= nextStart + MIN_LISTICLE_SEC) return;
      const items = config.listicleOverlay.items.map((item) => ({
        ...item,
        reveal: Math.max(nextStart, Math.min(nextEnd, item.reveal)),
      }));
      commit(
        {
          config: {
            ...config,
            listicleOverlay: {
              ...config.listicleOverlay,
              start: nextStart,
              end: nextEnd,
              items,
            },
          },
          transcript,
        },
        live,
      );
    },

    updateListicleItemReveal: (index, reveal, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript || !config.listicleOverlay) return;
      const { start, end } = config.listicleOverlay;
      const nextReveal = Math.max(start, Math.min(end, reveal));
      const items = config.listicleOverlay.items.map((item, i) =>
        i === index ? { ...item, reveal: nextReveal } : item,
      );
      commit(
        {
          config: {
            ...config,
            listicleOverlay: { ...config.listicleOverlay, items },
          },
          transcript,
        },
        live,
      );
    },
  };
});

export function useFlatCaptions(): FlatCaption[] {
  const captions = useEditor((s) => s.transcript?.captions);
  return useMemo(() => (captions ? flattenCaptions(captions) : []), [captions]);
}
