import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { Cover } from "./Cover";
import { TalkingHead } from "./TalkingHead";
/** Generated cache of per-episode props.json — rebuilt by process/editor. */
import allProps from "./generated/all-props.json";
import episodesIndex from "./generated/episodes.json";
import type { EpisodeProps } from "./lib/types";

const WIDTH = 1080;
const HEIGHT = 1920;

const fallbackProps: EpisodeProps = {
  episodeId: "day1",
  title: "Retardmaxxing Day 1",
  videoSrc: "episodes/day1/video.mov",
  fps: 30,
  width: WIDTH,
  height: HEIGHT,
  durationInFrames: 30 * 10,
  titleDurationSec: 5,
  captionsAtATime: 1,
  sections: [{ trimBefore: 0, trimAfter: 30 * 10, durationInFrames: 30 * 10 }],
  captionGroups: [],
  listicle: null,
  punchIns: null,
  bRolls: [],
  sfx: [],
};

const propsMap = allProps as Record<string, EpisodeProps>;

function getProps(episodeId: string): EpisodeProps {
  return propsMap[episodeId] ?? { ...fallbackProps, episodeId };
}

export const calculateMetadata: CalculateMetadataFunction<EpisodeProps> = ({
  props,
}) => {
  return {
    fps: props.fps,
    durationInFrames: Math.max(1, props.durationInFrames),
    width: WIDTH,
    height: HEIGHT,
  };
};

const calculateCoverMetadata: CalculateMetadataFunction<EpisodeProps> = ({
  props,
}) => {
  return {
    fps: props.fps,
    durationInFrames: 1,
    width: WIDTH,
    height: HEIGHT,
  };
};

function remotionCompositionId(prefix: string, episodeId: string): string {
  // Remotion allows only a-z, A-Z, 0-9, CJK, and -
  const safe = episodeId.replace(/[^a-zA-Z0-9-]/g, "-");
  return `${prefix}-${safe}`;
}

export const RemotionRoot: React.FC = () => {
  const episodeIds =
    episodesIndex.episodes.length > 0
      ? episodesIndex.episodes
      : Object.keys(propsMap);

  const primaryId = episodeIds[0] ?? fallbackProps.episodeId;
  const primaryProps = getProps(primaryId);

  return (
    <>
      <Composition
        id="TalkingHead"
        component={TalkingHead}
        durationInFrames={primaryProps.durationInFrames}
        fps={primaryProps.fps}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={primaryProps}
        calculateMetadata={calculateMetadata}
      />
      <Composition
        id="Cover"
        component={Cover}
        durationInFrames={1}
        fps={primaryProps.fps}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={primaryProps}
        calculateMetadata={calculateCoverMetadata}
      />
      {episodeIds.map((id) => {
        const props = getProps(id);
        return (
          <React.Fragment key={id}>
            <Composition
              id={remotionCompositionId("TalkingHead", id)}
              component={TalkingHead}
              durationInFrames={props.durationInFrames}
              fps={props.fps}
              width={WIDTH}
              height={HEIGHT}
              defaultProps={props}
              calculateMetadata={calculateMetadata}
            />
            <Composition
              id={remotionCompositionId("Cover", id)}
              component={Cover}
              durationInFrames={1}
              fps={props.fps}
              width={WIDTH}
              height={HEIGHT}
              defaultProps={props}
              calculateMetadata={calculateCoverMetadata}
            />
          </React.Fragment>
        );
      })}
    </>
  );
};
