import {
    groupCaptionWords, padLastWordInGroups, prepareRenderCaptions, stripPunctuationForDisplay
} from './caption-words';
import { COMPOSITION_HEIGHT, COMPOSITION_WIDTH } from './constants';
import {
    cutsToKeepSegments, intersectWithKeepRegions, mapSourceSecToOutputFrame,
    mapSourceSecToOutputSec, validateCuts
} from './source-timeline';

import {
  DEFAULT_PUNCH_IN_ANIMATE,
  DEFAULT_PUNCH_IN_WORD_BY_WORD,
} from "./punchin";
import type {
  BRollClip,
  VfxClip,
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
  SourceVfx,
  SourceMusic,
  SourceSfx,
  SfxClip,
  MusicClip,
} from "./types";
import { DEFAULT_SHAKE_INTENSITY } from "./config-types";

function secToFrames(sec: number, fps: number): number {
  return Math.max(0, Math.round(sec * fps));
}

function buildCaptionGroups(options: {
  captions: TranscriptCaption[];
  segments: KeepSegment[];
  fps: number;
  captionsAtATime: number;
}): CaptionGroup[] {
  const { captions, segments, fps, captionsAtATime } = options;
  const renderCaptions = prepareRenderCaptions(captions);

  const captionWords: CaptionWord[] = [];
  for (const cap of renderCaptions) {
    const outStart = mapSourceSecToOutputFrame(cap.start, segments, fps);
    const outEnd = mapSourceSecToOutputFrame(cap.end, segments, fps);
    if (outStart == null || outEnd == null) continue;

    const startFrame = outStart;
    const rawEnd = Math.round(Math.max(outEnd, outStart + 1));
    const endFrame = Math.max(startFrame + 3, rawEnd);

    captionWords.push({
      text: cap.text,
      startFrame,
      endFrame,
      ...(cap.emphasis ? { emphasis: cap.emphasis } : {}),
    });
  }

  return padLastWordInGroups(
    groupCaptionWords(captionWords, captionsAtATime)
      .map((group) => {
        const words = group.words
          .map((word) => ({
            ...word,
            text: stripPunctuationForDisplay(word.text),
          }))
          .filter((word) => word.text.length > 0);
        if (words.length === 0) return null;
        return {
          words,
          startFrame: words[0]!.startFrame,
          endFrame: words[words.length - 1]!.endFrame,
        };
      })
      .filter((group): group is CaptionGroup => group != null),
    fps,
  );
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
  segments: KeepSegment[],
  fps: number,
  cuts: BuildPropsInput["config"]["cuts"],
  durationSec: number,
): ListicleOverlay | null {
  if (!overlay || overlay.items.length === 0) return null;

  const items = overlay.items
    .map((item) => {
      const outSec = mapSourceSecToOutputSec(item.reveal, segments);
      if (outSec == null) return null;
      return {
        label: item.label,
        revealFrame: Math.max(0, Math.round(outSec * fps)),
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
    startFrame: Math.min(range.startFrame, items[0]!.revealFrame),
    endFrame: Math.max(
      range.endFrame,
      items[items.length - 1]!.revealFrame + 1,
    ),
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
    const wordByWord =
      punchIn.wordByWord ?? DEFAULT_PUNCH_IN_WORD_BY_WORD;
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
    if (clip.kenBurns != null) {
      built.kenBurns = clip.kenBurns;
    }
    result.push(built);
  }
  return result.sort((a, b) => a.startFrame - b.startFrame);
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

  const captionGroups = buildCaptionGroups({
    captions: transcript.captions,
    segments: keepSegments,
    fps,
    captionsAtATime: config.captionsAtATime,
  });

  const listicle = buildListicle(
    config.listicleOverlay,
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

  const vfx = buildVfx(
    config.vfx ?? [],
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

  return {
    episodeId,
    title,
    videoSrc,
    fps,
    width: COMPOSITION_WIDTH,
    height: COMPOSITION_HEIGHT,
    durationInFrames: Math.max(1, durationInFrames),
    titleDurationSec: config.titleDurationSec,
    captionsAtATime: config.captionsAtATime,
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
