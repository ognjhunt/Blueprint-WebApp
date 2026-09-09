import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Pause, Play } from "lucide-react";

export const heroScenes = [
  { id: "arm", src: "/images/site-led/embodiments/arm.webp", label: "Fixed arm", task: "Parts handling", alt: "Illustration of a Franka Panda-style fixed arm handling a machined part at a conveyor" },
  { id: "humanoid", src: "/images/site-led/embodiments/humanoid.webp", label: "Humanoid", task: "Packing", alt: "Illustration of a Figure 03-inspired bipedal humanoid packing cartons into a tote" },
  { id: "wheeled-humanoid", src: "/images/site-led/embodiments/wheeled-humanoid.webp", label: "Wheeled humanoid", task: "Kitting", alt: "Illustration of a wheeled humanoid moving a component tray between shelving and an assembly bench" },
  { id: "mobile-manipulator", src: "/images/site-led/embodiments/mobile-manipulator.webp", label: "Mobile manipulator", task: "Shelf picking", alt: "Illustration of a mobile base with a Franka Panda-style arm picking a component from shelving" },
] as const;

export const HERO_SCENE_INTERVAL = 6500;

export function EmbodimentHero({ children }: PropsWithChildren) {
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState<number[]>([]);
  const [paused, setPaused] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const region = useRef<HTMLElement>(null);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);
    const updateVisibility = () => setPageVisible(document.visibilityState !== "hidden");
    updatePreference(); updateVisibility();
    preference.addEventListener("change", updatePreference);
    document.addEventListener("visibilitychange", updateVisibility);
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.1 });
    if (region.current) observer?.observe(region.current);
    return () => {
      preference.removeEventListener("change", updatePreference);
      document.removeEventListener("visibilitychange", updateVisibility);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (paused || focused || reducedMotion || !visible || !pageVisible || loaded.length < 2) return;
    const timer = window.setTimeout(() => {
      for (let offset = 1; offset < heroScenes.length; offset++) {
        const next = (active + offset) % heroScenes.length;
        if (loaded.includes(next)) { setActive(next); break; }
      }
    }, HERO_SCENE_INTERVAL);
    return () => window.clearTimeout(timer);
  }, [active, loaded, paused, focused, reducedMotion, visible, pageVisible]);

  return (
    <section ref={region} className="ms-hero ms-rotating-hero" aria-labelledby="hero-title" data-scene={heroScenes[active].id}>
      <div className="ms-scene-artwork">
        {heroScenes.map((scene, index) => (
          <img key={scene.id} className={`ms-hero-art ms-scene-art ${active === index ? "is-active" : ""}`} src={scene.src} width="1536" height="1024" alt={scene.alt} aria-hidden={active !== index} loading={index === 0 ? "eager" : "lazy"} {...(index === 0 ? { fetchpriority: "high" } : {})} onLoad={() => setLoaded((current) => current.includes(index) ? current : [...current, index])} />
        ))}
      </div>
      <div className="ms-container ms-hero-inner">
        {children}
        <div className="ms-scene-controls" role="group" aria-label="Choose a robot illustration" onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}>
          <div className="ms-scene-label" aria-live="off"><span>{heroScenes[active].label}</span><span aria-hidden="true"> · </span><span>{heroScenes[active].task}</span></div>
          <div className="ms-scene-actions">
            {heroScenes.map((scene, index) => <button type="button" key={scene.id} className="ms-scene-selector" aria-label={`Show ${scene.label.toLowerCase()}`} aria-pressed={active === index} disabled={!loaded.includes(index) && index !== active} onClick={() => { setPaused(true); setActive(index); }}><span /></button>)}
            {!reducedMotion && <button type="button" className="ms-scene-pause" aria-label={paused ? "Play scene rotation" : "Pause scene rotation"} onClick={() => { setPaused(!paused); setFocused(false); }}>{paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}</button>}
          </div>
          <span className="ms-scene-disclosure">Illustrative scenes</span>
        </div>
      </div>
    </section>
  );
}
