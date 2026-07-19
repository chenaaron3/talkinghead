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

  const preview = (key: string, src: string) => {
    if (playingKey === key) {
      stopPreview();
      return;
    }
    stopPreview();
    const audio = new Audio(`/${src}`);
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
