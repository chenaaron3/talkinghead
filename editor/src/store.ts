import { useMemo } from 'react';
import { create } from 'zustand';

import { buildProps } from '@src/lib/build-props';
import {
  cutsToGaps,
  cutsToKeepRegions,
  snapSourceSecToKeep,
} from '@src/lib/source-timeline';

import { removeBRoll, upsertBRoll } from './lib/broll';
import { removeSfx, upsertSfx, applySfxEdge } from './lib/sfx';
import { captionIndexAt, flattenCaptions, updateCaption } from './lib/captions';
import { captionActionRange } from './lib/caption-selection';
import { applySelection, primaryId } from './lib/selection';
import { useSelection } from './selection-store';
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
  SourceSfx,
  Transcript,
} from "@src/lib/types";
export type Asset = {
  key: string;
  label: string;
  src: string;
  thumbUrl: string;
};

export type SfxAsset = {
  key: string;
  label: string;
  src: string;
  durationSec: number;
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
  sfxAssets: SfxAsset[];
  dirty: boolean;
  saving: boolean;
  /** Playhead on output timeline (for Remotion preview). */
  frame: number;
  /** Source playhead position in seconds (for timeline display). */
  sourceSec: number;
  pxPerSec: number;
  waveform: WaveformData | null;
  waveformMax: number;
};

type EditorActions = {
  load: () => Promise<void>;
  save: () => Promise<void>;
  seekSource: (sourceSec: number) => void;
  seekOutput: (frame: number) => void;
  setPxPerSec: (v: number) => void;
  seekBySeconds: (delta: number) => void;
  seekAdjacentCaption: (direction: -1 | 1) => boolean;
  extendCaptionArrow: (direction: -1 | 1) => boolean;
  syncActiveCaption: () => void;
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
  placeSfxOnCaption: (asset: SfxAsset, caption: FlatCaption) => void;
  addPunchInOnCaption: (caption: FlatCaption) => void;
  cutCaption: (caption: FlatCaption) => void;
  updateBRollRange: (
    id: string,
    start: number,
    end: number,
    live?: boolean,
  ) => void;
  updateSfxRange: (
    id: string,
    edge: "start" | "end",
    value: number,
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

function newId(prefix = "id"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
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
    sfxAssets: [],
    dirty: false,
    saving: false,
    frame: 0,
    sourceSec: 0,
    pxPerSec: 40,
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
          sfx?: SfxAsset[];
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
          sfxAssets: as.sfx ?? [],
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
      const { transcript } = get();
      const { selection, captionFocus, selectCaption } =
        useSelection.getState();
      if (!transcript || selection?.kind !== "caption") return false;
      const focusId = captionFocus ?? primaryId(selection);
      const focus = typeof focusId === "number" ? focusId : null;
      if (focus == null) return false;
      const next = focus + direction;
      if (next < 0 || next >= transcript.captions.length) return false;
      const caption = transcript.captions[next]!;
      selectCaption(next);
      get().seekSource(caption.start);
      return true;
    },

    extendCaptionArrow: (direction) => {
      const { transcript } = get();
      const {
        selection,
        captionAnchor,
        captionFocus,
        selectCaptionRange,
      } = useSelection.getState();
      if (!transcript || selection?.kind !== "caption") return false;

      const anchorId = captionAnchor ?? primaryId(selection);
      const focusId = captionFocus ?? primaryId(selection);
      const anchor = typeof anchorId === "number" ? anchorId : null;
      const focus = typeof focusId === "number" ? focusId : null;
      if (anchor == null || focus == null) return false;

      const nextFocus = focus + direction;
      if (nextFocus < 0 || nextFocus >= transcript.captions.length) return false;

      const ordered = transcript.captions.map((_, i) => i);
      selectCaptionRange(anchor, nextFocus, ordered);
      get().seekSource(transcript.captions[nextFocus]!.start);
      return true;
    },

    syncActiveCaption: () => {
      const { sourceSec, transcript } = get();
      const { selection, selectCaption } = useSelection.getState();
      if (!transcript) return;
      if (selection?.kind === "caption" && selection.ids.length > 1) return;
      const index = captionIndexAt(sourceSec, transcript.captions);
      if (index == null) return;
      const current =
        selection?.kind === "caption" ? selection.ids[0] ?? null : null;
      if (index === current) return;
      selectCaption(index);
    },

    seekOutput: (frame) => {
      const { props, frame: prevFrame } = get();
      if (!props) return;
      const sourceSec = outputFrameToSourceSec(frame, props);
      if (frame === prevFrame) return;
      set({ frame, sourceSec });
    },

    setPxPerSec: (pxPerSec) => set({ pxPerSec }),

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
      const { config, transcript } = get();
      const { selection, setSelection, clearSelection } =
        useSelection.getState();
      if (!config || !transcript || !selection) return false;

      if (selection.kind === "gap") {
        const gapId = selection.ids[0];
        if (gapId == null) return false;
        commit({
          config: restoreGap(config, gapId),
          transcript,
        });
        clearSelection();
        return true;
      }

      if (selection.kind === "keepRegion") {
        const index = selection.ids[0];
        if (index == null) return false;
        const keeps = cutsToKeepRegions(config.cuts, transcript.duration);
        const keep = keeps[index];
        if (!keep) return false;
        const nextConfig = cutKeepRegion(
          config,
          index,
          transcript.duration,
        );
        const gap = cutsToGaps(nextConfig.cuts).find(
          (g) => keep.start >= g.start - 0.001 && keep.start < g.end,
        );
        commit({ config: nextConfig, transcript });
        setSelection(
          gap?.id != null
            ? applySelection(null, "gap", [gap.id], "replace")
            : null,
        );
        return true;
      }

      if (selection.kind === "punchIn") {
        const index = selection.ids[0];
        if (index == null || !config.punchInSegments[index]) return false;
        commit({
          config: {
            ...config,
            punchInSegments: config.punchInSegments.filter(
              (_, i) => i !== index,
            ),
          },
          transcript,
        });
        clearSelection();
        return true;
      }

      if (selection.kind === "broll") {
        const id = selection.ids[0];
        if (!id) return false;
        commit({
          config: {
            ...config,
            bRolls: removeBRoll(config.bRolls, id),
          },
          transcript,
        });
        clearSelection();
        return true;
      }

      if (selection.kind === "sfx") {
        const id = selection.ids[0];
        if (!id) return false;
        commit({
          config: {
            ...config,
            sfx: removeSfx(config.sfx ?? [], id),
          },
          transcript,
        });
        clearSelection();
        return true;
      }

      if (selection.kind === "caption") {
        const indices = selection.ids.filter(
          (id): id is number => typeof id === "number",
        );
        if (indices.length === 0) return false;
        const firstIndex = Math.min(...indices);
        const caption = transcript.captions[firstIndex];
        if (!caption) return false;
        get().cutCaption({ ...caption, index: firstIndex });
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
        id: newId("broll"),
        src: asset.src,
        start: caption.start,
        end: Math.max(caption.start + 0.04, caption.end),
      };
      const result = upsertBRoll(config.bRolls, clip);
      if ("error" in result) return;
      commit({ config: { ...config, bRolls: result }, transcript });
      useSelection.getState().selectBRoll(clip.id);
    },

    placeSfxOnCaption: (asset, caption) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const srcDurationSec = Math.max(MIN_RANGE_SEC, asset.durationSec);
      const clip: SourceSfx = {
        id: newId("sfx"),
        src: asset.src,
        start: caption.start,
        end: Math.min(transcript.duration, caption.start + srcDurationSec),
        srcDurationSec,
      };
      const result = upsertSfx(config.sfx ?? [], clip);
      if ("error" in result) return;
      commit({ config: { ...config, sfx: result }, transcript });
      useSelection.getState().selectSfx(clip.id);
    },

    addPunchInOnCaption: (caption) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const { selection } = useSelection.getState();
      const range = captionActionRange(transcript, selection, caption);
      const segment = punchInForCaption(range);
      const punchInSegments = [...config.punchInSegments, segment].sort(
        (a, b) => a.start - b.start,
      );
      const newIndex = punchInSegments.indexOf(segment);
      commit({ config: { ...config, punchInSegments }, transcript });
      useSelection.getState().selectPunchIn(newIndex);
    },

    cutCaption: (caption) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const { selection } = useSelection.getState();
      const range = captionActionRange(transcript, selection, caption);
      const cuts = cutForCaption(config.cuts, range, transcript.captions);
      const gap = cutsToGaps(cuts).find(
        (g) => range.start >= g.start && range.start < g.end,
      );
      commit({ config: { ...config, cuts }, transcript });
      const { selectGap, clearSelection } = useSelection.getState();
      if (gap?.id != null) selectGap(gap.id);
      else clearSelection();
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

    updateSfxRange: (id, edge, value, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const clip = (config.sfx ?? []).find((c) => c.id === id);
      if (!clip) return;
      const next = applySfxEdge(clip, edge, value, transcript.duration);
      if (next.start === clip.start && next.end === clip.end) return;
      const result = upsertSfx(config.sfx ?? [], next);
      if ("error" in result) return;
      commit({ config: { ...config, sfx: result }, transcript }, live);
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

export function useCaptionIndices(): number[] {
  const captions = useEditor((s) => s.transcript?.captions);
  return useMemo(
    () => (captions ? captions.map((_, i) => i) : []),
    [captions],
  );
}
