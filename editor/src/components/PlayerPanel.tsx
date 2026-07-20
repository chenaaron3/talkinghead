import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { Player } from '@remotion/player';
import { COMPOSITION_HEIGHT, COMPOSITION_WIDTH } from '@src/lib/constants';
import { TalkingHead } from '@src/TalkingHead';

import { setPlayer } from '../lib/player-bridge';
import { isTimelineScrubbing, useEditor } from '../store';
import { TransformOverlay } from './player/TransformOverlay';
import { PunchInOriginOverlay } from './player/PunchInOriginOverlay';

import type { PlayerRef } from '@remotion/player';
export function PlayerPanel() {
  const props = useEditor((s) => s.props);
  const frame = useEditor((s) => s.frame);
  const seekOutput = useEditor((s) => s.seekOutput);
  const syncActiveCaption = useEditor((s) => s.syncActiveCaption);

  const ref = useRef<PlayerRef | null>(null);
  /** While set, ignore player→store frame sync until player catches up. */
  const seekTargetRef = useRef<number | null>(null);
  const [transformDragging, setTransformDragging] = useState(false);

  const onOverlayDragging = useCallback((dragging: boolean) => {
    setTransformDragging(dragging);
  }, []);

  const setPlayerRef = useCallback((instance: PlayerRef | null) => {
    ref.current = instance;
    setPlayer(instance);
  }, []);

  useLayoutEffect(() => {
    const player = ref.current;
    if (!player) return;

    const onUpdate = () => {
      if (isTimelineScrubbing()) return;
      const current = player.getCurrentFrame();
      const target = seekTargetRef.current;
      if (target != null) {
        if (Math.abs(current - target) <= 1) {
          seekTargetRef.current = null;
        }
        return;
      }
      seekOutput(current);
      if (player.isPlaying()) {
        syncActiveCaption();
      }
    };

    player.addEventListener("frameupdate", onUpdate);
    return () => {
      player.removeEventListener("frameupdate", onUpdate);
    };
  }, [seekOutput, syncActiveCaption]);

  useLayoutEffect(() => {
    const player = ref.current;
    if (!player) return;
    if (isTimelineScrubbing()) {
      seekTargetRef.current = frame;
      player.seekTo(frame);
      return;
    }
    const current = player.getCurrentFrame();
    if (Math.abs(current - frame) <= 1) {
      seekTargetRef.current = null;
      return;
    }
    // Playback lag: player advanced a few frames past a stale store frame
    // (slow React sync). Don't pause/seek — that was causing random stalls.
    // Larger gaps are intentional seeks (e.g. click timeline while playing).
    const lag = current - frame;
    if (player.isPlaying() && lag > 0 && lag <= 8) {
      return;
    }
    seekTargetRef.current = frame;
    if (player.isPlaying()) {
      player.pause();
    }
    player.seekTo(frame);
  }, [frame]);

  if (!props) return null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0b0c10]">
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
        <div
          className="relative h-full max-h-full w-auto max-w-full"
          style={{
            aspectRatio: `${COMPOSITION_WIDTH} / ${COMPOSITION_HEIGHT}`,
          }}
        >
          <Player
            ref={setPlayerRef}
            component={TalkingHead}
            inputProps={props}
            durationInFrames={Math.max(1, props.durationInFrames)}
            compositionWidth={COMPOSITION_WIDTH}
            compositionHeight={COMPOSITION_HEIGHT}
            fps={props.fps}
            style={{ width: "100%", height: "100%" }}
            controls={!transformDragging}
            clickToPlay={!transformDragging}
            spaceKeyToPlayOrPause={false}
            acknowledgeRemotionLicense
          />
          <TransformOverlay onDraggingChange={onOverlayDragging} />
          <PunchInOriginOverlay onDraggingChange={onOverlayDragging} />
        </div>
      </div>
      <div className="shrink-0 border-t border-border px-2 py-1 text-center text-xs text-muted">
        f{frame} / {props.durationInFrames}
      </div>
    </div>
  );
}
