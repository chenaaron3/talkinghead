import {
    groupCaptionWords, padLastWordInGroups, prepareRenderCaptions, stripPunctuationForDisplay
} from './caption-words';
import { COMPOSITION_HEIGHT, COMPOSITION_WIDTH } from './constants';
import {
    clipRangeToCaptions, cutsToKeepSegments, intersectWithKeepRegions, mapSourceSecToOutputFrame,
    mapSourceSecToOutputSec, validateCuts
} from './source-timeline';

import type {
  BRollClip,
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
} from "./types";

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
  captions: TranscriptCaption[],
  cuts: BuildPropsInput["config"]["cuts"],
  durationSec: number,
): { startFrame: number; endFrame: number } | null {
  const kept = intersectWithKeepRegions(start, end, cuts, durationSec);
  if (kept.length === 0) return null;

  let clipStart = kept[0]!.start;
  let clipEnd = kept[kept.length - 1]!.end;
  const captionClip = clipRangeToCaptions(clipStart, clipEnd, captions);
  if (!captionClip) return null;
  clipStart = captionClip.start;
  clipEnd = captionClip.end;

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
  captions: TranscriptCaption[],
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
    captions,
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
      captions,
      cuts,
      durationSec,
    );
    if (!frames) continue;
    result.push({
      startFrame: frames.startFrame,
      endFrame: frames.endFrame,
      scale: punchIn.scale,
    });
  }
  return result.length > 0 ? result : null;
}

function buildBRolls(
  bRolls: SourceBRoll[],
  segments: KeepSegment[],
  fps: number,
  captions: TranscriptCaption[],
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
      captions,
      cuts,
      durationSec,
    );
    if (!frames) continue;
    result.push({
      id: clip.id,
      src: clip.src,
      startFrame: frames.startFrame,
      endFrame: frames.endFrame,
    });
  }
  return result.sort((a, b) => a.startFrame - b.startFrame);
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
    transcript.captions,
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
    transcript.captions,
    config.cuts,
    transcript.duration,
  );

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
  };
}

export { secToFrames };
