import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Sequence,
  Series,
  staticFile,
  useVideoConfig,
} from "remotion";

import { Video } from "@remotion/media";

import { BRollOverlay } from "./components/BRollOverlay";
import { TikTokCaptions } from "./components/captions/TikTokCaptions";
import { MusicOverlay } from "./components/MusicOverlay";
import { PunchIn } from "./components/PunchIn";
import { SfxOverlay } from "./components/SfxOverlay";
import { TikTokText } from "./components/TikTokText";
import { ScreenShake, shakesFromVfx, VfxOverlay } from "./components/VfxOverlay";
import { useListicleOverlay } from "./hooks/useListicleOverlay";
import { SAFE_AREA } from "./lib/episode/constants";

import type {
  EpisodeProps,
  OutputSection,
  TextVfxClip,
} from "./lib/types";

const ArollSeries: React.FC<{
  videoSrc: string;
  sections: OutputSection[];
  muted?: boolean;
}> = ({ videoSrc, sections, muted = false }) => {
  const { fps } = useVideoConfig();
  return (
    <Series>
      {sections.map((section, index) => (
        <Series.Sequence
          key={`${section.trimBefore}-${section.trimAfter}-${index}`}
          durationInFrames={section.durationInFrames}
          premountFor={Math.round(1.5 * fps)}
        >
          <AbsoluteFill>
            <Video
              src={staticFile(videoSrc)}
              trimBefore={section.trimBefore}
              trimAfter={section.trimAfter}
              objectFit="cover"
              muted={muted}
              style={{
                width: "100%",
                height: "100%",
              }}
            />
          </AbsoluteFill>
        </Series.Sequence>
      ))}
    </Series>
  );
};

export const TalkingHead: React.FC<EpisodeProps> = ({
  videoSrc,
  cutoutSrc,
  sections,
  captionGroups,
  listicle,
  punchIns,
  bRolls,
  vfx,
  sfx,
  music,
}) => {
  const { fps } = useVideoConfig();
  const { showText, node: listicleNode } = useListicleOverlay(listicle);
  const shakes = shakesFromVfx(vfx);
  const hasCutout = Boolean(cutoutSrc);
  const textClips = useMemo(
    () =>
      (vfx ?? []).filter((clip): clip is TextVfxClip => clip.type === "text"),
    [vfx],
  );

  const { behindBRolls, frontBRolls } = useMemo(() => {
    if (!bRolls?.length) {
      return { behindBRolls: null, frontBRolls: null };
    }
    if (!hasCutout) {
      return { behindBRolls: null, frontBRolls: bRolls };
    }
    const behind = bRolls.filter((c) => c.behind);
    const front = bRolls.filter((c) => !c.behind);
    return {
      behindBRolls: behind.length ? behind : null,
      frontBRolls: front.length ? front : null,
    };
  }, [bRolls, hasCutout]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ScreenShake shakes={shakes}>
        <PunchIn punchIns={punchIns}>
          <ArollSeries videoSrc={videoSrc} sections={sections} />
          {hasCutout ? (
            <>
              <BRollOverlay bRolls={behindBRolls} />
              <ArollSeries
                videoSrc={cutoutSrc!}
                sections={sections}
                muted
              />
            </>
          ) : null}
        </PunchIn>

        {/* Below text/listicle/captions so chrome stays readable over images */}
        <BRollOverlay bRolls={frontBRolls} />
        <VfxOverlay vfx={vfx} />
      </ScreenShake>

      <MusicOverlay music={music} captionGroups={captionGroups} sfx={sfx} />
      <SfxOverlay sfx={sfx} />

      <AbsoluteFill
        style={{
          top: SAFE_AREA.top,
          bottom: SAFE_AREA.bottom,
          left: SAFE_AREA.left,
          right: SAFE_AREA.right,
          width: "auto",
          height: "auto",
          pointerEvents: "none",
        }}
      >
        {textClips.map((clip) => {
          // Listicle may hide the intro text after MIN_TEXT_SEC.
          if (clip.startFrame === 0 && !showText) return null;
          const durationFrames = Math.max(1, clip.endFrame - clip.startFrame);
          return (
            <Sequence
              key={clip.id}
              from={clip.startFrame}
              durationInFrames={durationFrames}
              layout="none"
            >
              <TikTokText
                text={clip.text}
                durationSec={durationFrames / fps}
                style={clip.style}
              />
            </Sequence>
          );
        })}
        {listicleNode}
      </AbsoluteFill>
      <TikTokCaptions groups={captionGroups} />
    </AbsoluteFill>
  );
};
