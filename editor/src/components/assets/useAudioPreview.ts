import { useRef, useState } from "react";

export function useAudioPreview() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const stopPreview = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    audioRef.current = null;
    setPlayingKey(null);
  };

  const preview = (key: string, src: string, volume = 1) => {
    if (playingKey === key) {
      stopPreview();
      return;
    }
    stopPreview();
    const audio = new Audio(`/${src}`);
    // HTMLMediaElement.volume throws outside [0, 1]; loudness gain can exceed 1.
    audio.volume = Math.min(1, Math.max(0, volume));
    audioRef.current = audio;
    setPlayingKey(key);
    void audio.play().catch(() => {
      setPlayingKey(null);
    });
    audio.onended = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
        setPlayingKey(null);
      }
    };
  };

  return { playingKey, preview, stopPreview };
}
