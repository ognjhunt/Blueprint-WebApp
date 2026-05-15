import { useEffect, useMemo, useRef, useState } from "react";
import { getOrbitControls, getSparkSplatMesh, getThree } from "@/lib/threeUtils";

type PreviewMode = "spz" | "provider" | "sample";
type SparkStatus = "idle" | "loading" | "ready" | "failed";

interface ExactSiteSparkViewerProps {
  spzUrl?: string | null;
  panoUrl?: string | null;
  thumbnailUrl?: string | null;
  videoSrc?: string | null;
  posterSrc?: string | null;
  className?: string;
}

function firstUrl(...values: Array<string | null | undefined>) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || null;
}

export function ExactSiteSparkViewer({
  spzUrl,
  panoUrl,
  thumbnailUrl,
  videoSrc,
  posterSrc,
  className = "",
}: ExactSiteSparkViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [sparkStatus, setSparkStatus] = useState<SparkStatus>(() => (spzUrl ? "idle" : "failed"));
  const fallbackImage = firstUrl(panoUrl, thumbnailUrl, posterSrc);
  const previewMode: PreviewMode = spzUrl ? "spz" : panoUrl || thumbnailUrl ? "provider" : "sample";
  const fallbackLabel = useMemo(() => {
    if (previewMode === "spz") return "Self-hosted SPZ preview";
    if (previewMode === "provider") return "Provider preview fallback";
    return "Sample/generated preview fallback";
  }, [previewMode]);
  const showFallback = !spzUrl || sparkStatus === "failed";

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !spzUrl || typeof window === "undefined") {
      setSparkStatus(spzUrl ? "idle" : "failed");
      return undefined;
    }

    let cancelled = false;
    let frameId = 0;
    let resizeObserver: ResizeObserver | null = null;
    let renderer: any = null;
    let controls: any = null;
    let splat: any = null;

    const init = async () => {
      setSparkStatus("loading");
      try {
        const [THREE, OrbitControls, SplatMesh] = await Promise.all([
          getThree(),
          getOrbitControls(),
          getSparkSplatMesh(),
        ]);
        if (cancelled) {
          return;
        }

        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#111711");

        const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 500);
        camera.position.set(0.4, 0.7, 3.6);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setClearColor(0x111711, 0.92);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.domElement.className = "absolute inset-0 h-full w-full";
        container.appendChild(renderer.domElement);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.enablePan = false;
        controls.minDistance = 0.6;
        controls.maxDistance = 10;
        controls.target.set(0, 0, 0);

        scene.add(new THREE.AmbientLight("#f8f7ec", 1.05));
        const key = new THREE.DirectionalLight("#fff2cf", 1.25);
        key.position.set(4, 5, 3);
        scene.add(key);

        const grid = new THREE.GridHelper(4, 16, "#9ba98f", "#2e392f");
        grid.position.y = -0.75;
        scene.add(grid);

        splat = new SplatMesh({ url: spzUrl });
        splat.name = "blueprint-exact-site-spz-preview";
        splat.quaternion.set(1, 0, 0, 0);
        splat.position.set(0, -0.12, 0);
        scene.add(splat);

        const resize = () => {
          const width = container.clientWidth || 1;
          const height = container.clientHeight || 1;
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
        };

        resize();
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(container);

        await splat.initialized;
        if (cancelled) {
          return;
        }

        const bounds = splat.getBoundingBox?.(true);
        if (bounds && !bounds.isEmpty?.()) {
          const center = bounds.getCenter(new THREE.Vector3());
          const size = bounds.getSize(new THREE.Vector3());
          const maxAxis = Math.max(size.x, size.y, size.z, 1);
          controls.target.copy(center);
          camera.position.set(center.x + maxAxis * 0.28, center.y + maxAxis * 0.22, center.z + maxAxis * 1.45);
          camera.near = Math.max(maxAxis / 1000, 0.01);
          camera.far = Math.max(maxAxis * 40, 100);
          camera.updateProjectionMatrix();
        }

        setSparkStatus("ready");

        const tick = () => {
          if (cancelled) {
            return;
          }
          splat.rotation.y += 0.0025;
          controls.update();
          renderer.render(scene, camera);
          frameId = window.requestAnimationFrame(tick);
        };
        tick();
      } catch {
        if (!cancelled) {
          setSparkStatus("failed");
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      controls?.dispose?.();
      splat?.dispose?.();
      if (renderer) {
        renderer.dispose?.();
        renderer.forceContextLoss?.();
        renderer.domElement?.remove?.();
      }
    };
  }, [spzUrl]);

  return (
    <div
      className={`relative min-h-[28rem] overflow-hidden bg-[#111711] text-white sm:min-h-[34rem] lg:min-h-[38rem] ${className}`}
      data-preview-mode={previewMode}
    >
      {showFallback ? (
        videoSrc ? (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={videoSrc}
            poster={fallbackImage || undefined}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : fallbackImage ? (
          <img className="absolute inset-0 h-full w-full object-cover" src={fallbackImage} alt="" />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#151b15,#273125_48%,#101310)]" />
        )
      ) : null}

      <div ref={containerRef} className="absolute inset-0" aria-label="Blueprint Exact-Site Preview viewer" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,12,10,0.74),rgba(8,12,10,0.18)_48%,rgba(8,12,10,0.64))]" />
      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-white/12 bg-black/28 px-4 py-3 text-xs text-white/70 backdrop-blur-sm sm:px-5">
        <span className="font-semibold uppercase tracking-[0.18em] text-white/72">{fallbackLabel}</span>
        {spzUrl ? (
          <span className="text-white/60">
            {sparkStatus === "ready" ? "SPZ loaded in-browser" : sparkStatus === "failed" ? "SPZ unavailable; fallback shown" : "Loading SPZ"}
          </span>
        ) : (
          <span className="text-white/60">SPZ activates when attached to the site package</span>
        )}
      </div>
    </div>
  );
}
