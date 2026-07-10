import React from 'react';
import { AbsoluteFill, Series, staticFile, useVideoConfig } from 'remotion';

import { Video } from '@remotion/media';

import { TikTokCaptions } from './components/TikTokCaptions';
import { TikTokTitle } from './components/TikTokTitle';
import { SAFE_AREA } from './lib/constants';

import type { EpisodeProps } from "./lib/types";

export const TalkingHead: React.FC<EpisodeProps> = ({
  title,
  videoSrc,
  sections,
  captionGroups,
  titleDurationSec,
}) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
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

      <AbsoluteFill
        style={{
          top: SAFE_AREA.top,
          bottom: SAFE_AREA.bottom,
          left: SAFE_AREA.left,
          right: SAFE_AREA.right,
          width: "auto",
          height: "auto",
          pointerEvents: "none",
          // backgroundColor: "#fff",
        }}
      >
        <TikTokTitle title={title} durationSec={titleDurationSec} />
        <TikTokCaptions groups={captionGroups} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
