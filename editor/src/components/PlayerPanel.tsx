import { useEffect, useLayoutEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { TalkingHead } from "@src/TalkingHead";
import { isTimelineScrubbing, useEditor } from "../store";
import { ExportButton } from "./ExportButton";

export function PlayerPanel() {
  const props = useEditor((s) => s.props);
  const frame = useEditor((s) => s.frame);
  const seekOutput = useEditor((s) => s.seekOutput);

  const ref = useRef<PlayerRef>(null);
  /** While set, ignore player→store frame sync until player catches up. */
  const seekTargetRef = useRef<number | null>(null);

  useEffect(() => {
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
    };

    player.addEventListener("frameupdate", onUpdate);
    return () => {
      player.removeEventListener("frameupdate", onUpdate);
    };
  }, [seekOutput]);

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
    <div className="flex min-h-0 flex-col items-center justify-center gap-2 bg-[#0b0c10] p-3">
      <ExportButton />
      <div className="aspect-[9/16] w-full max-w-[240px] overflow-hidden rounded-lg border border-border bg-black [&_>div]:h-full! [&_>div]:w-full!">
        <Player
          ref={ref}
          component={TalkingHead}
          inputProps={props}
          durationInFrames={Math.max(1, props.durationInFrames)}
          compositionWidth={props.width}
          compositionHeight={props.height}
          fps={props.fps}
          style={{ width: "100%", height: "100%" }}
          controls
          clickToPlay
          spaceKeyToPlayOrPause
          acknowledgeRemotionLicense
        />
      </div>
      <div className="text-xs text-muted">
        f{frame} / {props.durationInFrames}
      </div>
    </div>
  );
}
