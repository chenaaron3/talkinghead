import {
  DEFAULT_QUOTE_TEMPLATE_ID,
  isQuoteTemplateId,
  resolveQuoteTemplateStyle,
} from "../captions/quote-templates";
import {
  applyCaptionOverrides,
  CaptionGroupStyle,
  DEFAULT_CAPTION_STYLE,
} from "../captions/style";
import {
  DEFAULT_CAPTION_TEMPLATE_ID,
  isCaptionTemplateId,
  resolveCaptionTemplateStyle,
} from "../captions/templates";
import {
  groupStyledCaptionWords,
  padLastWordInGroups,
  prepareRenderCaptions,
  stripPunctuationForDisplay,
} from "../captions/words";
import { resolveListicleTemplate } from "../listicle/templates";
import {
  DEFAULT_TEXT_TEMPLATE_ID,
  isTextTemplateId,
  resolveTextTemplateStyle,
} from "../text/templates";
import {
  cutsToKeepSegments,
  intersectWithKeepRegions,
  mapSourceSecToOutputFrame,
  mapSourceSecToOutputSec,
  validateCuts,
} from "../timeline/source-timeline";
import { resolveKenBurns } from "../visual/ken-burns";
import {
  DEFAULT_PUNCH_IN_ANIMATE,
  DEFAULT_PUNCH_IN_WORD_BY_WORD,
} from "../visual/punchin";
import { arollBgSrcForCutout, DEFAULT_SHAKE_INTENSITY } from "./config-types";
import { COMPOSITION_HEIGHT, COMPOSITION_WIDTH } from "./constants";
import { compactEntranceSfx } from "./vfx";

import type {
  BRollClip,
  VfxClip,
  TextVfxClip,
  BuildPropsInput,
  TranscriptCaption,
  CaptionGroup,
  CaptionWord,
  EpisodeProps,
  KeepSegment,
  ListicleOverlay,
  PunchInSegment,
  SourceListicle,
  SourcePunchIn,
  SourceBRoll,
  SourceQuoteVfx,
  SourceScreenTextVfx,
  SourceVfx,
  SourceMusic,
  SourceSfx,
  SfxClip,
  MusicClip,
} from "../types";

function secToFrames(sec: number, fps: number): number {
  return Math.max(0, Math.round(sec * fps));
}

function resolveEpisodeCaptionStyle(
  config: BuildPropsInput["config"],
): CaptionGroupStyle {
  const templateId = isCaptionTemplateId(config.captionTemplateId)
    ? config.captionTemplateId
    : DEFAULT_CAPTION_TEMPLATE_ID;
  return applyCaptionOverrides(
    resolveCaptionTemplateStyle(templateId),
    config.captionStyle,
  );
}

function quoteVfxClips(vfx: SourceVfx[]): SourceQuoteVfx[] {
  return vfx.filter((clip): clip is SourceQuoteVfx => clip.type === "quote");
}

function resolveClipQuoteStyle(quote: SourceQuoteVfx): CaptionGroupStyle {
  const templateId = isQuoteTemplateId(quote.templateId)
    ? quote.templateId
    : DEFAULT_QUOTE_TEMPLATE_ID;
  return applyCaptionOverrides(
    resolveQuoteTemplateStyle(templateId),
    quote.style,
  );
}

/** First Quote whose range overlaps the caption word (start inclusive, end exclusive). */
function quoteForCaption(
  cap: TranscriptCaption,
  quotes: SourceQuoteVfx[],
): SourceQuoteVfx | null {
  for (const quote of quotes) {
    if (cap.start < quote.end && cap.end > quote.start) return quote;
  }
  return null;
}

/** Words covered by listicle marker/reveal text (minimal mode only). */
function listicleHiddenCaptionRanges(
  overlay: SourceListicle | null,
  vfx: SourceVfx[],
): Array<{ start: number; end: number }> {
  if (!overlay) return [];
  if (resolveListicleTemplate(overlay.templateId).aggregated) return [];
  const byId = new Map(vfx.map((clip) => [clip.id, clip]));
  const ranges: Array<{ start: number; end: number }> = [];
  for (const item of overlay.items) {
    const marker = byId.get(item.markerId);
    const reveal = byId.get(item.revealId);
    if (marker) ranges.push({ start: marker.start, end: marker.end });
    if (reveal) ranges.push({ start: reveal.start, end: reveal.end });
  }
  return ranges;
}

function captionInListicleHiddenRange(
  cap: TranscriptCaption,
  ranges: Array<{ start: number; end: number }>,
): boolean {
  for (const range of ranges) {
    if (cap.start < range.end && cap.end > range.start) return true;
  }
  return false;
}

function buildCaptionGroups(options: {
  captions: TranscriptCaption[];
  segments: KeepSegment[];
  fps: number;
  captionStyle: CaptionGroupStyle;
  vfx: SourceVfx[];
  listicleOverlay: SourceListicle | null;
}): CaptionGroup[] {
  const { captions, segments, fps, captionStyle, vfx, listicleOverlay } =
    options;
  const renderCaptions = prepareRenderCaptions(captions);
  const quotes = quoteVfxClips(vfx);
  const hiddenRanges = listicleHiddenCaptionRanges(listicleOverlay, vfx);

  type StyledWord = CaptionWord & {
    styleKey: string;
    segmentKey: string;
    captionsAtATime: number;
    style: CaptionGroupStyle;
  };

  const styledWords: StyledWord[] = [];
  let segment = 0;

  for (const cap of renderCaptions) {
    if (captionInListicleHiddenRange(cap, hiddenRanges)) {
      segment++;
      continue;
    }

    const outStart = mapSourceSecToOutputFrame(cap.start, segments, fps);
    const outEnd = mapSourceSecToOutputFrame(cap.end, segments, fps);
    if (outStart == null || outEnd == null) continue;

    const startFrame = outStart;
    const rawEnd = Math.round(Math.max(outEnd, outStart + 1));
    const endFrame = Math.max(startFrame + 3, rawEnd);

    const quote = quoteForCaption(cap, quotes);
    const style = quote ? resolveClipQuoteStyle(quote) : captionStyle;
    const styleKey = quote ? `quote:${quote.id}` : "default";

    styledWords.push({
      text: cap.text,
      startFrame,
      endFrame,
      styleKey,
      segmentKey: String(segment),
      captionsAtATime: style.captionsAtATime,
      style,
      emphasis: cap.emphasis,
    });
  }

  const styleByKey = new Map<string, CaptionGroupStyle>();
  for (const word of styledWords) {
    styleByKey.set(word.styleKey, word.style);
  }

  const groups = groupStyledCaptionWords(styledWords)
    .map((group) => {
      const words = group.words
        .map((word) => ({
          ...word,
          text: stripPunctuationForDisplay(word.text),
        }))
        .filter((word) => word.text.length > 0);
      if (words.length === 0) return null;
      const style =
        styleByKey.get(group.styleKey) ?? captionStyle ?? DEFAULT_CAPTION_STYLE;
      const built: CaptionGroup = {
        words,
        startFrame: words[0]!.startFrame,
        endFrame: words[words.length - 1]!.endFrame,
        style,
      };
      return built;
    })
    .filter((group): group is CaptionGroup => group != null);

  return padLastWordInGroups(groups, fps);
}

function mapSourceRangeToOutputFrames(
  start: number,
  end: number,
  segments: KeepSegment[],
  fps: number,
  cuts: BuildPropsInput["config"]["cuts"],
  durationSec: number,
): { startFrame: number; endFrame: number } | null {
  const kept = intersectWithKeepRegions(start, end, cuts, durationSec);
  if (kept.length === 0) return null;

  const clipStart = kept[0]!.start;
  const clipEnd = kept[kept.length - 1]!.end;

  const startFrame = mapSourceSecToOutputFrame(clipStart, segments, fps);
  const endFrameRaw = mapSourceSecToOutputFrame(clipEnd, segments, fps);
  if (startFrame == null || endFrameRaw == null) return null;
  const endFrame = Math.max(startFrame + 1, endFrameRaw);
  if (endFrame <= startFrame) return null;
  return { startFrame, endFrame };
}

function buildListicle(
  overlay: SourceListicle | null,
  vfx: SourceVfx[],
  segments: KeepSegment[],
  fps: number,
  cuts: BuildPropsInput["config"]["cuts"],
  durationSec: number,
): ListicleOverlay | null {
  if (!overlay || overlay.items.length === 0) return null;

  const aggregated = resolveListicleTemplate(overlay.templateId).aggregated;
  const byId = new Map(vfx.map((clip) => [clip.id, clip]));

  const items = overlay.items
    .map((item) => {
      const marker = byId.get(item.markerId);
      const reveal = byId.get(item.revealId);
      if (
        marker?.type !== "listicle-text" ||
        reveal?.type !== "listicle-text"
      ) {
        return null;
      }
      const outSec = mapSourceSecToOutputSec(marker.start, segments);
      if (outSec == null) return null;
      return {
        text: reveal.text,
        startFrame: Math.max(0, Math.round(outSec * fps)),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  if (items.length === 0) return null;

  const range = mapSourceRangeToOutputFrames(
    overlay.start,
    overlay.end,
    segments,
    fps,
    cuts,
    durationSec,
  );
  if (!range) return null;

  return {
    startFrame: Math.min(range.startFrame, items[0]!.startFrame),
    endFrame: Math.max(range.endFrame, items[items.length - 1]!.startFrame + 1),
    aggregated,
    items,
  };
}

function wordStartFramesForPunchIn(
  punchIn: SourcePunchIn,
  frames: { startFrame: number; endFrame: number },
  captions: TranscriptCaption[],
  segments: KeepSegment[],
  fps: number,
): number[] {
  const starts: number[] = [];
  for (const caption of captions) {
    if (caption.end <= punchIn.start || caption.start >= punchIn.end) continue;
    const sourceSec = Math.max(punchIn.start, caption.start);
    const frame = mapSourceSecToOutputFrame(sourceSec, segments, fps);
    if (frame == null) continue;
    if (frame < frames.startFrame || frame >= frames.endFrame) continue;
    if (starts.length === 0 || starts[starts.length - 1] !== frame) {
      starts.push(frame);
    }
  }
  if (starts.length === 0 || starts[0]! > frames.startFrame) {
    starts.unshift(frames.startFrame);
  }
  return starts;
}

function buildPunchIns(
  punchIns: SourcePunchIn[],
  segments: KeepSegment[],
  fps: number,
  captions: TranscriptCaption[],
  cuts: BuildPropsInput["config"]["cuts"],
  durationSec: number,
): PunchInSegment[] | null {
  const result: PunchInSegment[] = [];
  for (const punchIn of punchIns) {
    const frames = mapSourceRangeToOutputFrames(
      punchIn.start,
      punchIn.end,
      segments,
      fps,
      cuts,
      durationSec,
    );
    if (!frames) continue;
    const wordByWord = punchIn.wordByWord ?? DEFAULT_PUNCH_IN_WORD_BY_WORD;
    const animate = punchIn.animate ?? DEFAULT_PUNCH_IN_ANIMATE;
    const built: PunchInSegment = {
      startFrame: frames.startFrame,
      endFrame: frames.endFrame,
      scale: punchIn.scale,
      wordByWord,
      animate,
    };
    if (punchIn.originX != null) built.originX = punchIn.originX;
    if (punchIn.originY != null) built.originY = punchIn.originY;
    if (wordByWord) {
      built.wordStartFrames = wordStartFramesForPunchIn(
        punchIn,
        frames,
        captions,
        segments,
        fps,
      );
    }
    result.push(built);
  }
  return result.length > 0 ? result : null;
}

function buildBRolls(
  bRolls: SourceBRoll[],
  segments: KeepSegment[],
  fps: number,
  cuts: BuildPropsInput["config"]["cuts"],
  durationSec: number,
): BRollClip[] {
  const result: BRollClip[] = [];
  for (const clip of bRolls) {
    const frames = mapSourceRangeToOutputFrames(
      clip.start,
      clip.end,
      segments,
      fps,
      cuts,
      durationSec,
    );
    if (!frames) continue;
    const built: BRollClip = {
      id: clip.id,
      src: clip.src,
      width: clip.width,
      height: clip.height,
      startFrame: frames.startFrame,
      endFrame: frames.endFrame,
      scale: clip.scale ?? 1,
      offsetX: clip.offsetX ?? 0,
      offsetY: clip.offsetY ?? 0,
      rotation: clip.rotation ?? 0,
    };
    if (clip.mediaOffsetSec != null && clip.mediaOffsetSec > 0) {
      built.mediaOffsetSec = clip.mediaOffsetSec;
    }
    if (clip.volume != null) {
      built.volume = clip.volume;
    }
    const kenBurns = resolveKenBurns(clip.kenBurns);
    if (kenBurns != null) {
      built.kenBurns = kenBurns;
    }
    if (clip.behind) {
      built.behind = true;
    }
    if (clip.sfx) {
      built.sfx = compactEntranceSfx(clip.sfx);
    }
    result.push(built);
  }
  return result.sort((a, b) => a.startFrame - b.startFrame);
}

function resolveClipTextStyle(clip: SourceScreenTextVfx): CaptionGroupStyle {
  const templateId = isTextTemplateId(clip.templateId)
    ? clip.templateId
    : DEFAULT_TEXT_TEMPLATE_ID;
  return applyCaptionOverrides(
    resolveTextTemplateStyle(templateId),
    clip.style,
  );
}

function buildVfx(
  vfx: SourceVfx[],
  segments: KeepSegment[],
  fps: number,
  cuts: BuildPropsInput["config"]["cuts"],
  durationSec: number,
): VfxClip[] {
  const result: VfxClip[] = [];
  for (const clip of vfx) {
    const frames = mapSourceRangeToOutputFrames(
      clip.start,
      clip.end,
      segments,
      fps,
      cuts,
      durationSec,
    );
    if (!frames) continue;

    if (clip.type === "shake") {
      result.push({
        id: clip.id,
        type: "shake",
        startFrame: frames.startFrame,
        endFrame: frames.endFrame,
        intensity: clip.intensity ?? DEFAULT_SHAKE_INTENSITY,
      });
      continue;
    }

    if (clip.type === "text" || clip.type === "listicle-text") {
      const built: TextVfxClip = {
        id: clip.id,
        type: "text",
        startFrame: frames.startFrame,
        endFrame: frames.endFrame,
        text: clip.text,
        style: resolveClipTextStyle(clip),
      };
      if (clip.sfx) {
        built.sfx = compactEntranceSfx(clip.sfx);
      }
      result.push(built);
      continue;
    }

    // Quote restyles captions — not a visual-plane VFX.
    if (clip.type === "quote") continue;

    // Location (and future media VFX): skip until media is baked.
    if (!clip.src || !(clip.width && clip.height)) continue;
    result.push({
      id: clip.id,
      type: "location",
      src: clip.src,
      width: clip.width,
      height: clip.height,
      startFrame: frames.startFrame,
      endFrame: frames.endFrame,
      scale: clip.scale ?? 1,
      offsetX: clip.offsetX ?? 0,
      offsetY: clip.offsetY ?? 0,
      rotation: clip.rotation ?? 0,
    });
  }
  return result.sort((a, b) => a.startFrame - b.startFrame);
}

function buildSfx(
  sfx: SourceSfx[],
  segments: KeepSegment[],
  fps: number,
  cuts: BuildPropsInput["config"]["cuts"],
  durationSec: number,
): SfxClip[] {
  const result: SfxClip[] = [];
  for (const clip of sfx) {
    const frames = mapSourceRangeToOutputFrames(
      clip.start,
      clip.end,
      segments,
      fps,
      cuts,
      durationSec,
    );
    if (!frames) continue;
    const built: SfxClip = {
      id: clip.id,
      src: clip.src,
      startFrame: frames.startFrame,
      endFrame: frames.endFrame,
    };
    if (clip.volume != null) {
      built.volume = clip.volume;
    }
    result.push(built);
  }
  return result.sort((a, b) => a.startFrame - b.startFrame);
}

function buildMusic(music: SourceMusic | null | undefined): MusicClip | null {
  if (!music) return null;
  const clip: MusicClip = {
    id: music.id,
    src: music.src,
    srcDurationSec: music.srcDurationSec,
  };
  if (music.volume != null) {
    clip.volume = music.volume;
  }
  if (music.mediaOffsetSec != null && music.mediaOffsetSec > 0) {
    clip.mediaOffsetSec = music.mediaOffsetSec;
  }
  return clip;
}

/** Deterministically derive frame-only props from config + transcript. */
export function buildProps(input: BuildPropsInput): EpisodeProps {
  const { episodeId, title, videoSrc, fps, config, transcript } = input;

  validateCuts(config.cuts, transcript.duration);
  const keepSegments = cutsToKeepSegments(
    config.cuts,
    fps,
    transcript.duration,
  );
  const durationInFrames = keepSegments.reduce(
    (sum, seg) => sum + seg.durationInFrames,
    0,
  );

  const captionStyle = resolveEpisodeCaptionStyle(config);
  const captionGroups = buildCaptionGroups({
    captions: transcript.captions,
    segments: keepSegments,
    fps,
    captionStyle,
    vfx: config.vfx ?? [],
    listicleOverlay: config.listicleOverlay,
  });

  const listicle = buildListicle(
    config.listicleOverlay,
    config.vfx ?? [],
    keepSegments,
    fps,
    config.cuts,
    transcript.duration,
  );

  const punchIns = buildPunchIns(
    config.punchInSegments,
    keepSegments,
    fps,
    transcript.captions,
    config.cuts,
    transcript.duration,
  );

  const bRolls = buildBRolls(
    config.bRolls,
    keepSegments,
    fps,
    config.cuts,
    transcript.duration,
  );

  const listicleAggregated =
    config.listicleOverlay != null &&
    resolveListicleTemplate(config.listicleOverlay.templateId).aggregated;
  const sourceVfx = (config.vfx ?? []).filter(
    (clip) => clip.type !== "listicle-text" || !listicleAggregated,
  );
  const vfx = buildVfx(
    sourceVfx,
    keepSegments,
    fps,
    config.cuts,
    transcript.duration,
  );

  const sfx = buildSfx(
    config.sfx ?? [],
    keepSegments,
    fps,
    config.cuts,
    transcript.duration,
  );

  const music = buildMusic(config.music);

  // When cutout exists, play the room plate (person punched out) so soft
  // matte edges don't stack two copies of the subject (halo / blur).
  const resolvedVideoSrc = config.cutout
    ? arollBgSrcForCutout(config.cutout.src)
    : videoSrc;

  return {
    episodeId,
    title,
    videoSrc: resolvedVideoSrc,
    cutoutSrc: config.cutout?.src ?? null,
    fps,
    width: COMPOSITION_WIDTH,
    height: COMPOSITION_HEIGHT,
    durationInFrames: Math.max(1, durationInFrames),
    sections: keepSegments.map((seg) => ({
      trimBefore: seg.trimBefore,
      trimAfter: seg.trimAfter,
      durationInFrames: seg.durationInFrames,
    })),
    captionGroups,
    listicle,
    punchIns,
    bRolls,
    vfx,
    sfx,
    music,
  };
}

export { secToFrames };
