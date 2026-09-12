import { useEffect, useRef, useState } from "react";

type HeroMotionProps = {
  src: string;
  active: boolean;
  playing: boolean;
  enabled: boolean;
};

/** A locally assembled illustration clip; the original image remains underneath. */
export function HeroMotion({ src, active, playing, enabled }: HeroMotionProps) {
  const video = useRef<HTMLVideoElement>(null);
  const [requested, setRequested] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (active && playing && enabled) setRequested(true);
    if (!enabled) setReady(false);
  }, [active, playing, enabled]);

  useEffect(() => {
    // Rewind only on re-entry, so pause and tab visibility preserve the pose.
    if (active && video.current) video.current.currentTime = 0;
  }, [active]);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (!active || !playing || !enabled || !ready || failed) {
      element.pause();
      return;
    }
    let cancelled = false;
    element.play()?.catch(() => {
      // Autoplay rejection or decoding trouble leaves the original artwork visible.
      if (!cancelled) setFailed(true);
    });
    return () => { cancelled = true; element.pause(); };
  }, [active, playing, enabled, ready, failed]);

  if (!requested || !enabled || failed) return null;
  return (
    <video
      ref={video}
      className={`ms-scene-motion ${ready ? "is-ready" : ""}`}
      src={src}
      muted
      playsInline
      preload="auto"
      width="1536"
      height="1024"
      aria-hidden="true"
      tabIndex={-1}
      disablePictureInPicture
      onLoadedData={() => setReady(true)}
      onError={() => setFailed(true)}
    />
  );
}
