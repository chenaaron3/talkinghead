import { useMemo } from 'react';
import { create } from 'zustand';

import { buildProps } from '@src/lib/episode/build-props';
import {
  cutsToGaps,
  cutsToKeepRegions,
  snapSourceSecToKeep,
} from '@src/lib/timeline/source-timeline';

import { episodeHeaders } from './lib/api';

import {
  clampBRollRange,
  removeBRoll,
  upsertBRoll,
  withBRollMediaOffset,
  withBRollTransform,
  withBRollVolume,
  withBRollKenBurns,
  withBRollBehind,
  withBRollSfx,
  withBRollSfxVolume,
  DEFAULT_KEN_BURNS,
  type Transform,
} from './lib/broll';
import {
  createVfxFromPreset,
  removeVfx,
  upsertVfx,
  withVfxIntensity,
  withVfxMedia,
  withVfxTransform,
  withQuoteTemplate,
  withQuoteStyle,
  withTextTemplate,
  withTextStyle,
  withTextContent,
  withTextSfx,
  withTextSfxVolume,
  isScreenTextVfxClip,
  type VfxPreset,
} from './lib/vfx';
import { normalizeCaptionOverrides } from '@src/lib/captions/parse-style';
import { type CaptionStyleOverrides } from '@src/lib/captions/style';
import {
  DEFAULT_CAPTION_TEMPLATE_ID,
  isCaptionTemplateId,
  type CaptionTemplateId,
} from '@src/lib/captions/templates';
import type { QuoteTemplateId } from '@src/lib/captions/quote-templates';
import type { TextTemplateId } from '@src/lib/text/templates';
import { findIntroTextVfx } from '@src/lib/episode/text-vfx';
import {
  musicFromAsset,
  withMusicOffset,
  withMusicVolume,
  type MusicAsset,
} from './lib/music';
import { removeSfx, upsertSfx, applySfxEdge, withSfxVolume } from './lib/sfx';
import { captionIndexAt, flattenCaptions, updateCaption } from './lib/captions';
import { captionActionRange } from './lib/caption-selection';
import { applySelection, primaryId } from './lib/selection';
import { useSelection } from './selection-store';
import { cutForCaption, cutForPause } from './lib/cuts';
import { sourceSecToOutputFrame, outputFrameToSourceSec } from './lib/frames';
import {
  punchInForCaption,
  resolvePunchInOrigin,
  withPunchInOrigin,
} from './lib/punchin';
import {
  withListicleTemplate,
  type ListicleTemplateId,
} from './lib/listicle';
import { MIN_LISTICLE_SEC, MIN_RANGE_SEC } from './lib/range';
import { cutKeepRegion, restoreGap, setSectionEdge } from './lib/sections';
import { deserializeWaveform, peakMax } from '@src/lib/audio/waveform';
import type { SerializedWaveform, WaveformData } from "@src/lib/audio/waveform";

import type { FlatCaption } from "./lib/captions";
import type {
  AudioAsset,
  CaptionEmphasis,
  EpisodeConfig,
  EpisodeProps,
  SourceBRoll,
  SourcePunchIn,
  SourceSfx,
  Transcript,
} from "@src/lib/types";
/** Library tile in the assets panel (not a timeline clip). */
export type LibraryAsset = {
  key: string;
  label: string;
  src: string;
  thumbUrl: string;
  width: number;
  height: number;
  /** Present for video b-roll; used to clamp play duration. */
  durationSec?: number;
};

export type { VfxPreset };

export type SfxAsset = {
  key: string;
  label: string;
  src: string;
  durationSec: number;
  /** Subfolder under public/sfx/, e.g. `meme`. Null for root files. */
  folder?: string | null;
};

export type { MusicAsset };

export type EditorMode = "default" | "scissor";

type EpisodeSnapshot = {
  config: EpisodeConfig;
  transcript: Transcript;
};

type EditorState = {
  loadState: "idle" | "loading" | "ready" | "error";
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
  assets: LibraryAsset[];
  sfxAssets: SfxAsset[];
  musicAssets: MusicAsset[];
  dirty: boolean;
  saving: boolean;
  /** Playhead on output timeline (for Remotion preview). */
  frame: number;
  /** Source playhead position in seconds (for timeline display). */
  sourceSec: number;
  pxPerSec: number;
  waveform: WaveformData | null;
  waveformMax: number;
  scheduledLabel: string | null;
  fullyScheduled: boolean;
  mode: EditorMode;
};

type EditorActions = {
  load: (episodeId?: string | null) => Promise<void>;
  switchEpisode: (episodeId: string) => Promise<void>;
  refreshAssets: () => Promise<void>;
  refreshSchedule: () => Promise<void>;
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
  removeBRollsBySrc: (src: string) => void;
  setCaptionText: (caption: FlatCaption, text: string) => void;
  setCaptionEmphasis: (
    caption: FlatCaption,
    emphasis: CaptionEmphasis | undefined,
  ) => void;
  placeBRollOnCaption: (asset: LibraryAsset, caption: FlatCaption) => void;
  setDefaultBRollSfx: (src: string | null) => void;
  placeVfxOnCaption: (preset: VfxPreset, caption: FlatCaption) => void;
  setVfxLocation: (
    id: string,
    place: { label: string; lat: number; lon: number },
  ) => Promise<void>;
  placeSfxOnCaption: (asset: SfxAsset, caption: FlatCaption) => void;
  setMusic: (asset: MusicAsset) => void;
  clearMusic: () => void;
  updateMusicVolume: (volume: number, live?: boolean) => void;
  updateMusicOffset: (mediaOffsetSec: number, live?: boolean) => void;
  addPunchInOnCaption: (caption: FlatCaption) => void;
  cutCaption: (caption: FlatCaption) => void;
  setMode: (mode: EditorMode) => void;
  toggleMode: () => void;
  updateCaptionOverrides: (
    patch: CaptionStyleOverrides,
    live?: boolean,
  ) => void;
  /** Switch caption template; preserves Y override only. */
  setCaptionTemplate: (templateId: CaptionTemplateId, live?: boolean) => void;
  updateQuoteTemplate: (id: string, templateId: QuoteTemplateId) => void;
  updateQuoteStyle: (
    id: string,
    patch: CaptionStyleOverrides,
    live?: boolean,
  ) => void;
  updateTextTemplate: (id: string, templateId: TextTemplateId) => void;
  updateTextVfxStyle: (
    id: string,
    patch: CaptionStyleOverrides,
    live?: boolean,
  ) => void;
  updateTextVfxContent: (id: string, text: string, live?: boolean) => void;
  updateTextVfxSfx: (id: string, sfx: AudioAsset | null, live?: boolean) => void;
  updateTextVfxSfxVolume: (id: string, volume: number, live?: boolean) => void;
  setTitle: (title: string) => void;
  cutInterWordPause: (pause: {
    cutStart: number;
    cutEnd: number;
  }) => void;
  updateBRollRange: (
    id: string,
    start: number,
    end: number,
    live?: boolean,
  ) => void;
  updateBRollTransform: (
    id: string,
    patch: Partial<Transform>,
    live?: boolean,
  ) => void;
  updateBRollMediaOffset: (
    id: string,
    mediaOffsetSec: number,
    live?: boolean,
  ) => void;
  updateBRollVolume: (id: string, volume: number, live?: boolean) => void;
  updateBRollKenBurns: (
    id: string,
    kenBurns: number | null,
    live?: boolean,
  ) => void;
  updateBRollBehind: (id: string, behind: boolean, live?: boolean) => void;
  updateBRollSfx: (id: string, sfx: AudioAsset | null, live?: boolean) => void;
  updateBRollSfxVolume: (id: string, volume: number, live?: boolean) => void;
  updateVfxRange: (
    id: string,
    start: number,
    end: number,
    live?: boolean,
  ) => void;
  updateVfxTransform: (
    id: string,
    patch: Partial<Transform>,
    live?: boolean,
  ) => void;
  updateVfxIntensity: (id: string, intensity: number, live?: boolean) => void;
  updateSfxRange: (
    id: string,
    edge: "start" | "end",
    value: number,
    live?: boolean,
  ) => void;
  updateSfxVolume: (id: string, volume: number, live?: boolean) => void;
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
  updatePunchIn: (
    index: number,
    patch: Partial<
      Pick<
        SourcePunchIn,
        "scale" | "wordByWord" | "animate" | "originX" | "originY"
      >
    >,
    live?: boolean,
  ) => void;
  updateListicleOverlay: (start: number, end: number, live?: boolean) => void;
  updateListicleTemplate: (templateId: ListicleTemplateId) => void;
  updateListicleMarkerStart: (
    index: number,
    start: number,
    live?: boolean,
  ) => void;
};

const history: EpisodeSnapshot[] = [];
const future: EpisodeSnapshot[] = [];
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let scrubbing = false;

function resetHistory() {
  history.length = 0;
  future.length = 0;
}

function setEpisodeUrl(episodeId: string | null) {
  const url = new URL(window.location.href);
  if (episodeId) {
    url.searchParams.set("episode", episodeId);
  } else {
    url.searchParams.delete("episode");
  }
  window.history.replaceState(null, "", url);
}

function resolveInitialEpisodeId(defaultEpisodeId: string | null): string | null {
  const fromUrl = new URL(window.location.href).searchParams.get("episode");
  if (fromUrl?.trim()) return fromUrl.trim();
  return defaultEpisodeId;
}

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

    const title =
      next.config.title?.trim() || state.episodeId;

    const props = recomputeProps({
      episodeId: state.episodeId,
      title,
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
      title,
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
    const title = snap.config.title?.trim() || state.episodeId;
    const props = recomputeProps({
      episodeId: state.episodeId,
      title,
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
      title,
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
    musicAssets: [],
    dirty: false,
    saving: false,
    frame: 0,
    sourceSec: 0,
    pxPerSec: 40,
    waveform: null,
    waveformMax: 0,
    scheduledLabel: null,
    fullyScheduled: false,
    mode: "default",

    load: async (requestedEpisodeId?: string | null) => {
      set({ loadState: "loading", error: null });
      try {
        let episodeId = requestedEpisodeId ?? null;
        if (!episodeId) {
          const bootstrapRes = await fetch("/api/bootstrap");
          const bootstrap = (await bootstrapRes.json()) as {
            defaultEpisodeId?: string | null;
          };
          episodeId = resolveInitialEpisodeId(
            bootstrap.defaultEpisodeId ?? null,
          );
        }

        if (!episodeId) {
          resetHistory();
          set({
            loadState: "idle",
            episodeId: null,
            title: "",
            videoSrc: "",
            fps: 30,
            width: 0,
            height: 0,
            config: null,
            transcript: null,
            props: null,
            assets: [],
            sfxAssets: [],
            musicAssets: [],
            dirty: false,
            frame: 0,
            sourceSec: 0,
            waveform: null,
            waveformMax: 0,
            scheduledLabel: null,
            fullyScheduled: false,
            error: null,
          });
          setEpisodeUrl(null);
          return;
        }

        const headers = episodeHeaders(episodeId);
        const [epRes, assetsRes] = await Promise.all([
          fetch("/api/episode", { headers }),
          fetch("/api/assets", { headers }),
        ]);
        const ep = (await epRes.json()) as {
          episodeId?: string;
          config?: EpisodeConfig;
          transcript?: Transcript;
          props?: EpisodeProps;
          waveform?: SerializedWaveform | null;
          schedule?: {
            scheduledLabel?: string | null;
            fullyScheduled?: boolean;
          };
          error?: string;
        };
        const as = (await assetsRes.json()) as {
          assets?: LibraryAsset[];
          sfx?: SfxAsset[];
          music?: MusicAsset[];
          error?: string;
        };
        if (!epRes.ok) throw new Error(ep.error ?? "Failed to load episode");
        if (!assetsRes.ok) throw new Error(as.error ?? "Failed to load assets");
        if (!ep.config || !ep.transcript || !ep.props) {
          throw new Error("Episode payload incomplete");
        }
        resetHistory();
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
          musicAssets: as.music ?? [],
          loadState: "ready",
          dirty: false,
          frame: 0,
          sourceSec: 0,
          waveform: null,
          waveformMax: 0,
          scheduledLabel: ep.schedule?.scheduledLabel ?? null,
          fullyScheduled: ep.schedule?.fullyScheduled ?? false,
          mode: "default",
          error: null,
        });
        setEpisodeUrl(ep.episodeId ?? ep.props.episodeId);

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

    switchEpisode: async (episodeId: string) => {
      const { dirty, episodeId: currentEpisodeId } = get();
      if (episodeId === currentEpisodeId) return;
      if (dirty) {
        const discard = window.confirm(
          "You have unsaved changes. Discard them and switch episodes?",
        );
        if (!discard) return;
      }
      await get().load(episodeId);
    },

    refreshAssets: async () => {
      const { episodeId } = get();
      if (!episodeId) return;
      try {
        const res = await fetch("/api/assets", {
          headers: episodeHeaders(episodeId),
        });
        const data = (await res.json()) as {
          assets?: LibraryAsset[];
          sfx?: SfxAsset[];
          music?: MusicAsset[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Failed to refresh assets");
        set({
          assets: data.assets ?? [],
          sfxAssets: data.sfx ?? [],
          musicAssets: data.music ?? [],
        });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    },

    refreshSchedule: async () => {
      const { episodeId } = get();
      if (!episodeId) return;
      try {
        const res = await fetch("/api/episode", {
          headers: episodeHeaders(episodeId),
        });
        const data = (await res.json()) as {
          schedule?: {
            scheduledLabel?: string | null;
            fullyScheduled?: boolean;
          };
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Failed to refresh schedule");
        set({
          scheduledLabel: data.schedule?.scheduledLabel ?? null,
          fullyScheduled: data.schedule?.fullyScheduled ?? false,
        });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    },

    save: async () => {
      const { config, transcript, episodeId } = get();
      if (!config || !transcript || !episodeId) return;
      set({ saving: true });
      try {
        const res = await fetch("/api/episode", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...episodeHeaders(episodeId),
          },
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
      // Keep Quote / b-roll / etc. selected while scrubbing playhead for preview.
      if (selection != null && selection.kind !== "caption") return;
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

      if (selection.kind === "vfx") {
        const id = selection.ids[0];
        if (!id) return false;
        commit({
          config: {
            ...config,
            vfx: removeVfx(config.vfx ?? [], id),
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

      if (selection.kind === "music") {
        if (!config.music) return false;
        commit({
          config: { ...config, music: null },
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

    removeBRollsBySrc: (src) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const next = config.bRolls.filter((c) => c.src !== src);
      if (next.length === config.bRolls.length) return;
      commit({
        config: { ...config, bRolls: next },
        transcript,
      });
      const { selection, clearSelection } = useSelection.getState();
      if (selection?.kind === "broll") {
        const stillThere = next.some((c) => selection.ids.includes(c.id));
        if (!stillThere) clearSelection();
      }
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
      const { config, transcript, sfxAssets } = get();
      if (!config || !transcript) return;
      const { selection } = useSelection.getState();
      const range = captionActionRange(transcript, selection, caption);
      let end = Math.max(range.start + MIN_RANGE_SEC, range.end);
      const defaultSrc = config.defaultBRollSfx;
      const sfxAsset = defaultSrc
        ? sfxAssets.find((a) => a.src === defaultSrc)
        : undefined;
      const entranceSfx: AudioAsset | undefined = sfxAsset
        ? {
            src: sfxAsset.src,
            srcDurationSec: Math.max(MIN_RANGE_SEC, sfxAsset.durationSec),
          }
        : undefined;
      const base = {
        id: newId("broll"),
        src: asset.src,
        start: range.start,
        end,
        width: asset.width,
        height: asset.height,
        kenBurns: DEFAULT_KEN_BURNS,
        ...(config.cutout ? { behind: true as const } : {}),
        ...(entranceSfx ? { sfx: entranceSfx } : {}),
      };
      let clip: SourceBRoll;
      if (asset.durationSec != null && asset.durationSec > 0) {
        const maxEnd = range.start + asset.durationSec;
        if (end > maxEnd) {
          end = Math.max(range.start + MIN_RANGE_SEC, maxEnd);
        }
        clip = {
          ...base,
          end,
          srcDurationSec: asset.durationSec,
        };
      } else {
        clip = base;
      }

      const result = upsertBRoll(config.bRolls, clip);
      if ("error" in result) return;
      commit({
        config: { ...config, bRolls: result },
        transcript,
      });
      useSelection.getState().selectBRoll(clip.id);
    },

    setDefaultBRollSfx: (src) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      if (src === config.defaultBRollSfx) return;
      commit({
        config: { ...config, defaultBRollSfx: src },
        transcript,
      });
    },

    placeVfxOnCaption: (preset, caption) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const { selection } = useSelection.getState();
      const range = captionActionRange(transcript, selection, caption);
      const end = Math.max(range.start + MIN_RANGE_SEC, range.end);
      const clip = createVfxFromPreset(
        preset,
        { start: range.start, end },
        newId("vfx"),
      );
      const result = upsertVfx(config.vfx ?? [], clip);
      if ("error" in result) return;
      commit({ config: { ...config, vfx: result }, transcript });
      useSelection.getState().selectVfx(clip.id);
    },

    setVfxLocation: async (id, place) => {
      const { episodeId, config, transcript } = get();
      if (!episodeId || !config || !transcript) return;
      const clip = (config.vfx ?? []).find((c) => c.id === id);
      if (!clip || clip.type !== "location") return;

      const res = await fetch("/api/vfx/location-map", {
        method: "POST",
        headers: {
          ...episodeHeaders(episodeId),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          label: place.label,
          lat: place.lat,
          lon: place.lon,
        }),
      });
      const data = (await res.json()) as {
        asset?: {
          src: string;
          width: number;
          height: number;
          label: string;
        };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to bake location map");
      }
      if (!data.asset) {
        throw new Error("Location map response missing asset");
      }

      // Re-read in case state changed during bake.
      const latest = get();
      if (!latest.config || !latest.transcript) return;
      const current = (latest.config.vfx ?? []).find((c) => c.id === id);
      if (!current) return;
      const next = withVfxMedia(current, {
        src: data.asset.src,
        width: data.asset.width,
        height: data.asset.height,
        label: data.asset.label || place.label,
      });
      const result = upsertVfx(latest.config.vfx ?? [], next);
      if ("error" in result) return;
      commit({
        config: { ...latest.config, vfx: result },
        transcript: latest.transcript,
      });
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

    setMusic: (asset) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const music = musicFromAsset(asset);
      commit({ config: { ...config, music }, transcript });
      useSelection.getState().selectMusic(music.id);
    },

    clearMusic: () => {
      const { config, transcript } = get();
      if (!config || !transcript || !config.music) return;
      commit({ config: { ...config, music: null }, transcript });
      useSelection.getState().selectMusic(null);
    },

    updateMusicVolume: (volume, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript || !config.music) return;
      const music = withMusicVolume(config.music, volume);
      commit({ config: { ...config, music }, transcript }, live);
    },

    updateMusicOffset: (mediaOffsetSec, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript || !config.music) return;
      const music = withMusicOffset(config.music, mediaOffsetSec);
      commit({ config: { ...config, music }, transcript }, live);
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

    setMode: (mode) => {
      set({ mode });
    },

    toggleMode: () => {
      set((state) => ({
        mode: state.mode === "scissor" ? "default" : "scissor",
      }));
    },

    updateCaptionOverrides: (patch, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const captionStyle = normalizeCaptionOverrides({
        ...config.captionStyle,
        ...patch,
      });
      commit(
        {
          config: {
            ...config,
            captionStyle,
          },
          transcript,
        },
        live,
      );
    },

    setCaptionTemplate: (templateId, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const id = isCaptionTemplateId(templateId)
        ? templateId
        : DEFAULT_CAPTION_TEMPLATE_ID;
      const prev = normalizeCaptionOverrides(config.captionStyle);
      const captionStyle: CaptionStyleOverrides =
        prev.y != null ? { y: prev.y } : {};
      commit(
        {
          config: {
            ...config,
            captionTemplateId: id,
            captionStyle,
          },
          transcript,
        },
        live,
      );
    },

    setTitle: (title) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const next = title.length === 0 ? null : title;
      if (next === config.title) return;
      const firstWordStart = transcript.captions[0]?.start ?? Number.POSITIVE_INFINITY;
      const intro = findIntroTextVfx(config.vfx ?? [], firstWordStart);
      const vfx = (config.vfx ?? []).map((clip) => {
        if (intro && clip.id === intro.id) {
          return withTextContent(clip, next ?? "");
        }
        return clip;
      });
      commit(
        {
          config: { ...config, title: next, vfx },
          transcript,
        },
        true,
      );
    },

    cutInterWordPause: (pause) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const cuts = cutForPause(config.cuts, {
        start: pause.cutStart,
        end: pause.cutEnd,
      });
      const gap = cutsToGaps(cuts).find(
        (g) =>
          pause.cutStart >= g.start - 0.001 &&
          pause.cutStart < g.end + 0.001,
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
      const clamped = clampBRollRange(clip, start, end);
      const result = upsertBRoll(config.bRolls, {
        ...clip,
        start: clamped.start,
        end: clamped.end,
      });
      if ("error" in result) return;
      commit({ config: { ...config, bRolls: result }, transcript }, live);
    },

    updateBRollTransform: (id, patch, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const clip = config.bRolls.find((c) => c.id === id);
      if (!clip) return;
      const next = withBRollTransform(clip, patch);
      const result = upsertBRoll(config.bRolls, next);
      if ("error" in result) return;
      commit({ config: { ...config, bRolls: result }, transcript }, live);
    },

    updateBRollMediaOffset: (id, mediaOffsetSec, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const clip = config.bRolls.find((c) => c.id === id);
      if (!clip) return;
      const next = withBRollMediaOffset(clip, mediaOffsetSec);
      const result = upsertBRoll(config.bRolls, next);
      if ("error" in result) return;
      commit({ config: { ...config, bRolls: result }, transcript }, live);
    },

    updateBRollVolume: (id, volume, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const clip = config.bRolls.find((c) => c.id === id);
      if (!clip) return;
      const next = withBRollVolume(clip, volume);
      const result = upsertBRoll(config.bRolls, next);
      if ("error" in result) return;
      commit({ config: { ...config, bRolls: result }, transcript }, live);
    },

    updateBRollKenBurns: (id, kenBurns, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const clip = config.bRolls.find((c) => c.id === id);
      if (!clip) return;
      const next = withBRollKenBurns(clip, kenBurns);
      const result = upsertBRoll(config.bRolls, next);
      if ("error" in result) return;
      commit({ config: { ...config, bRolls: result }, transcript }, live);
    },

    updateBRollBehind: (id, behind, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      if (!config.cutout) return;
      const clip = config.bRolls.find((c) => c.id === id);
      if (!clip) return;
      const next = withBRollBehind(clip, behind);
      const result = upsertBRoll(config.bRolls, next);
      if ("error" in result) return;
      commit({ config: { ...config, bRolls: result }, transcript }, live);
    },

    updateBRollSfx: (id, sfx, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const clip = config.bRolls.find((c) => c.id === id);
      if (!clip) return;
      const next = withBRollSfx(clip, sfx);
      const result = upsertBRoll(config.bRolls, next);
      if ("error" in result) return;
      commit({ config: { ...config, bRolls: result }, transcript }, live);
    },

    updateBRollSfxVolume: (id, volume, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const clip = config.bRolls.find((c) => c.id === id);
      if (!clip) return;
      const next = withBRollSfxVolume(clip, volume);
      const result = upsertBRoll(config.bRolls, next);
      if ("error" in result) return;
      commit({ config: { ...config, bRolls: result }, transcript }, live);
    },

    updateVfxRange: (id, start, end, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      if (end <= start + MIN_RANGE_SEC) return;

      const clip = (config.vfx ?? []).find((c) => c.id === id);
      if (!clip) return;
      const result = upsertVfx(config.vfx ?? [], {
        ...clip,
        start,
        end,
      });
      if ("error" in result) return;
      commit({ config: { ...config, vfx: result }, transcript }, live);
    },

    updateVfxTransform: (id, patch, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const clip = (config.vfx ?? []).find((c) => c.id === id);
      if (!clip) return;
      const next = withVfxTransform(clip, patch);
      const result = upsertVfx(config.vfx ?? [], next);
      if ("error" in result) return;
      commit({ config: { ...config, vfx: result }, transcript }, live);
    },

    updateVfxIntensity: (id, intensity, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const clip = (config.vfx ?? []).find((c) => c.id === id);
      if (!clip) return;
      const next = withVfxIntensity(clip, intensity);
      const result = upsertVfx(config.vfx ?? [], next);
      if ("error" in result) return;
      commit({ config: { ...config, vfx: result }, transcript }, live);
    },

    updateQuoteTemplate: (id, templateId) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const clip = (config.vfx ?? []).find((c) => c.id === id);
      if (!clip) return;
      const next = withQuoteTemplate(clip, templateId);
      const result = upsertVfx(config.vfx ?? [], next);
      if ("error" in result) return;
      commit({ config: { ...config, vfx: result }, transcript });
    },

    updateQuoteStyle: (id, patch, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const clip = (config.vfx ?? []).find((c) => c.id === id);
      if (!clip) return;
      const next = withQuoteStyle(clip, patch);
      const result = upsertVfx(config.vfx ?? [], next);
      if ("error" in result) return;
      commit({ config: { ...config, vfx: result }, transcript }, live);
    },

    updateTextTemplate: (id, templateId) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;

      const clip = (config.vfx ?? []).find((c) => c.id === id);
      if (!clip) return;
      const next = withTextTemplate(clip, templateId);
      const result = upsertVfx(config.vfx ?? [], next);
      if ("error" in result) return;
      commit({
        config: { ...config, vfx: result },
        transcript,
      });
    },

    updateTextVfxStyle: (id, patch, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;

      const clip = (config.vfx ?? []).find((c) => c.id === id);
      if (!clip) return;
      const next = withTextStyle(clip, patch);
      const result = upsertVfx(config.vfx ?? [], next);
      if ("error" in result) return;
      commit(
        { config: { ...config, vfx: result }, transcript },
        live,
      );
    },

    updateTextVfxContent: (id, text, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;

      const clip = (config.vfx ?? []).find((c) => c.id === id);
      if (!clip) return;
      const next = withTextContent(clip, text);
      const result = upsertVfx(config.vfx ?? [], next);
      if ("error" in result) return;
      commit(
        { config: { ...config, vfx: result }, transcript },
        live,
      );
    },

    updateTextVfxSfx: (id, sfx, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;

      const clip = (config.vfx ?? []).find((c) => c.id === id);
      if (!clip || !isScreenTextVfxClip(clip)) return;
      const next = withTextSfx(clip, sfx);
      const result = upsertVfx(config.vfx ?? [], next);
      if ("error" in result) return;
      commit(
        { config: { ...config, vfx: result }, transcript },
        live,
      );
    },

    updateTextVfxSfxVolume: (id, volume, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;

      const clip = (config.vfx ?? []).find((c) => c.id === id);
      if (!clip || !isScreenTextVfxClip(clip)) return;
      const next = withTextSfxVolume(clip, volume);
      const result = upsertVfx(config.vfx ?? [], next);
      if ("error" in result) return;
      commit(
        { config: { ...config, vfx: result }, transcript },
        live,
      );
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

    updateSfxVolume: (id, volume, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const clip = (config.sfx ?? []).find((c) => c.id === id);
      if (!clip) return;
      const next = withSfxVolume(clip, volume);
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

    updatePunchIn: (index, patch, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript) return;
      const seg = config.punchInSegments[index];
      if (!seg) return;
      if (patch.scale != null && !(patch.scale > 0)) return;
      const { originX: patchOx, originY: patchOy, ...otherPatch } = patch;
      let next: SourcePunchIn = { ...seg, ...otherPatch };
      if (patchOx != null || patchOy != null) {
        const resolved = resolvePunchInOrigin(seg);
        next = withPunchInOrigin(
          next,
          patchOx ?? resolved.originX,
          patchOy ?? resolved.originY,
        );
      }
      const punchInSegments = config.punchInSegments.map((p, i) =>
        i === index ? next : p,
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

      const clampClip = <T extends { start: number; end: number }>(clip: T): T => {
        let clipStart = Math.max(nextStart, clip.start);
        let clipEnd = Math.min(nextEnd, clip.end);
        if (clipEnd <= clipStart + MIN_RANGE_SEC) {
          clipEnd = Math.min(nextEnd, clipStart + MIN_RANGE_SEC);
        }
        return { ...clip, start: clipStart, end: clipEnd };
      };

      const clipIds = new Set<string>();
      for (const item of config.listicleOverlay.items) {
        clipIds.add(item.markerId);
        clipIds.add(item.revealId);
      }
      const vfx = (config.vfx ?? []).map((clip) =>
        clipIds.has(clip.id) ? clampClip(clip) : clip,
      );

      commit(
        {
          config: {
            ...config,
            listicleOverlay: {
              ...config.listicleOverlay,
              start: nextStart,
              end: nextEnd,
            },
            vfx,
          },
          transcript,
        },
        live,
      );
    },

    updateListicleTemplate: (templateId) => {
      const { config, transcript } = get();
      if (!config || !transcript || !config.listicleOverlay) return;
      commit({
        config: withListicleTemplate(config, templateId),
        transcript,
      });
    },

    updateListicleMarkerStart: (index, start, live = false) => {
      const { config, transcript } = get();
      if (!config || !transcript || !config.listicleOverlay) return;
      const item = config.listicleOverlay.items[index];
      if (!item) return;
      const marker = (config.vfx ?? []).find((c) => c.id === item.markerId);
      if (!marker) return;
      const { start: listStart, end: listEnd } = config.listicleOverlay;
      const duration = marker.end - marker.start;
      const nextStart = Math.max(listStart, Math.min(listEnd, start));
      let nextEnd = nextStart + duration;
      if (nextEnd > listEnd) {
        nextEnd = listEnd;
      }
      if (nextEnd <= nextStart + MIN_RANGE_SEC) return;

      const vfx = (config.vfx ?? []).map((clip) =>
        clip.id === item.markerId
          ? { ...clip, start: nextStart, end: nextEnd }
          : clip,
      );

      commit(
        {
          config: {
            ...config,
            vfx,
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
