import { useCallback, useLayoutEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { COMPOSITION_HEIGHT, COMPOSITION_WIDTH } from "@src/lib/constants";
import { TalkingHead } from "@src/TalkingHead";
import { setPlayer } from "../lib/player-bridge";
import { isTimelineScrubbing, useEditor } from "../store";
import { ExportButton } from "./ExportButton";

export function PlayerPanel() {
  const props = useEditor((s) => s.props);
  const frame = useEditor((s) => s.frame);
  const seekOutput = useEditor((s) => s.seekOutput);
  const syncActiveCaption = useEditor((s) => s.syncActiveCaption);

  const ref = useRef<PlayerRef | null>(null);
  /** While set, ignore player→store frame sync until player catches up. */
  const seekTargetRef = useRef<number | null>(null);

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
    seekTargetRef.current = frame;
    if (player.isPlaying()) {
      player.pause();
    }
    player.seekTo(frame);
  }, [frame]);

  if (!props) return null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0b0c10]">
      <div className="shrink-0 border-b border-border p-2">
        <ExportButton />
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
        <div
          className="w-full max-h-full"
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
            controls
            clickToPlay
            spaceKeyToPlayOrPause={false}
            acknowledgeRemotionLicense
          />
        </div>
      </div>
      <div className="shrink-0 border-t border-border px-2 py-1 text-center text-xs text-muted">
        f{frame} / {props.durationInFrames}
      </div>
    </div>
  );
}
