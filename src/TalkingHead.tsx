import React from 'react';
import { AbsoluteFill, Series, staticFile, useVideoConfig } from 'remotion';

import { Video } from '@remotion/media';

import { BRollOverlay } from './components/BRollOverlay';
import { PunchIn } from './components/PunchIn';
import { TikTokCaptions } from './components/TikTokCaptions';
import { TikTokTitle } from './components/TikTokTitle';
import { useListicleOverlay } from './hooks/useListicleOverlay';
import { SAFE_AREA } from './lib/constants';

import type { EpisodeProps } from "./lib/types";

export const TalkingHead: React.FC<EpisodeProps> = ({
  title,
  videoSrc,
  sections,
  captionGroups,
  titleDurationSec,
  listicle,
  punchIns,
  bRolls,
}) => {
  const { fps } = useVideoConfig();
  const { showTitle, node: listicleNode } = useListicleOverlay(listicle);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <PunchIn punchIns={punchIns}>
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
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                />
              </AbsoluteFill>
            </Series.Sequence>
          ))}
        </Series>
      </PunchIn>

      {/* Below title/listicle/captions so chrome stays readable over images */}
      <BRollOverlay bRolls={bRolls} />

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
        {showTitle ? (
          <TikTokTitle title={title} durationSec={titleDurationSec} />
        ) : null}
        {listicleNode}
        <TikTokCaptions groups={captionGroups} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
