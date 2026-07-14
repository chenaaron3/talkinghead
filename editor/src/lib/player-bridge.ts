import type { PlayerRef } from "@remotion/player";

let player: PlayerRef | null = null;

export function setPlayer(playerRef: PlayerRef | null) {
  player = playerRef;
}

export function togglePlayback() {
  if (!player) return;
  if (player.isPlaying()) player.pause();
  else player.play();
}
