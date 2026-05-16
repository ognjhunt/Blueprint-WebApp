import { useEffect, useMemo, useRef, useState } from "react";
import { getOrbitControls, getSparkSplatMesh, getThree } from "@/lib/threeUtils";

type PreviewMode = "splat" | "provider" | "sample";
type SparkStatus = "idle" | "loading" | "ready" | "failed";
type SplatFormat = "spz" | "ply" | "splat";

const SPARK_LOAD_TIMEOUT_MS = 30000;

export interface ExactSiteSplatPreviewOption {
  url: string;
  label: string;
  format: SplatFormat;
  detail?: string;
}

interface ExactSiteSparkViewerProps {
  spzUrl?: string | null;
  splatOptions?: ExactSiteSplatPreviewOption[];
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
  splatOptions = [],
  panoUrl,
  thumbnailUrl,
  videoSrc,
  posterSrc,
  className = "",
}: ExactSiteSparkViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const normalizedSplatOptions = useMemo(() => {
    const options = splatOptions
      .map((option) => ({
        ...option,
        url: String(option.url || "").trim(),
      }))
      .filter((option) => option.url);
    const fallbackSpzUrl = String(spzUrl || "").trim();
    if (fallbackSpzUrl && !options.some((option) => option.url === fallbackSpzUrl)) {
      options.unshift({
        url: fallbackSpzUrl,
        label: "SPZ preview",
        format: "spz",
        detail: "Self-hosted Gaussian splat asset",
      });
    }
    return options;
  }, [spzUrl, splatOptions]);
  const [selectedSplatIndex, setSelectedSplatIndex] = useState(0);
  const selectedSplat = normalizedSplatOptions[selectedSplatIndex] || normalizedSplatOptions[0] || null;
  const selectedSplatUrl = selectedSplat?.url || null;
  const [sparkStatus, setSparkStatus] = useState<SparkStatus>(() => (selectedSplatUrl ? "idle" : "failed"));
  const [sparkError, setSparkError] = useState<string | null>(null);
  const [splatRequested, setSplatRequested] = useState(false);
  const fallbackImage = firstUrl(panoUrl, thumbnailUrl, posterSrc);
  const previewMode: PreviewMode = selectedSplatUrl ? "splat" : panoUrl || thumbnailUrl ? "provider" : "sample";
  const fallbackLabel = useMemo(() => {
    if (previewMode === "splat") return "Self-hosted splat preview";
    if (previewMode === "provider") return "Provider preview fallback";
    return "Sample/generated preview fallback";
  }, [previewMode]);
  const showFallback = !selectedSplatUrl || !splatRequested || sparkStatus === "loading" || sparkStatus === "failed";

  useEffect(() => {
    setSelectedSplatIndex(0);
  }, [normalizedSplatOptions]);

  useEffect(() => {
    setSparkStatus(selectedSplatUrl ? "idle" : "failed");
    setSparkError(null);
    setSplatRequested(false);
  }, [selectedSplatUrl]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !selectedSplatUrl || !splatRequested || typeof window === "undefined") {
      setSparkStatus(selectedSplatUrl ? "idle" : "failed");
      return undefined;
    }

    let cancelled = false;
    let frameId = 0;
    let resizeObserver: ResizeObserver | null = null;
    let renderer: any = null;
    let controls: any = null;
    let splat: any = null;
    let loadTimeoutId: number | null = null;
    let loadTimedOut = false;

    const init = async () => {
      setSparkStatus("loading");
      setSparkError(null);
      loadTimeoutId = window.setTimeout(() => {
        loadTimedOut = true;
        if (!cancelled) {
          setSparkStatus("failed");
          setSparkError(`${selectedSplat?.label || "Splat preview"} did not finish loading within 30 seconds.`);
        }
      }, SPARK_LOAD_TIMEOUT_MS);
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

        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
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
        controls.maxDistance = 40;
        controls.target.set(0, 0, 0);

        scene.add(new THREE.AmbientLight("#f8f7ec", 1.05));
        const key = new THREE.DirectionalLight("#fff2cf", 1.25);
        key.position.set(4, 5, 3);
        scene.add(key);

        const grid = new THREE.GridHelper(4, 16, "#9ba98f", "#2e392f");
        grid.position.y = -0.75;
        scene.add(grid);

        splat = new SplatMesh({ url: selectedSplatUrl });
        splat.name = "blueprint-exact-site-splat-preview";
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
        if (loadTimeoutId) {
          window.clearTimeout(loadTimeoutId);
          loadTimeoutId = null;
        }
        if (cancelled || loadTimedOut) {
          return;
        }

        const bounds = splat.getBoundingBox?.(true);
        if (bounds && !bounds.isEmpty?.()) {
          const center = bounds.getCenter(new THREE.Vector3());
          const size = bounds.getSize(new THREE.Vector3());
          const maxAxis = Math.max(size.x, size.y, size.z, 1);
          splat.updateMatrixWorld(true);
          const worldCenter = splat.localToWorld(center.clone());
          controls.target.copy(worldCenter);
          camera.position.set(worldCenter.x + maxAxis * 0.28, worldCenter.y + maxAxis * 0.22, worldCenter.z + maxAxis * 1.45);
          camera.near = Math.max(maxAxis / 1000, 0.01);
          camera.far = Math.max(maxAxis * 80, 100);
          controls.maxDistance = Math.max(maxAxis * 12, 10);
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
      } catch (error) {
        if (loadTimeoutId) {
          window.clearTimeout(loadTimeoutId);
          loadTimeoutId = null;
        }
        if (!cancelled) {
          setSparkStatus("failed");
          setSparkError(error instanceof Error ? error.message : "The splat loader could not start.");
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
      if (loadTimeoutId) {
        window.clearTimeout(loadTimeoutId);
      }
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
  }, [selectedSplat?.label, selectedSplatUrl, splatRequested]);

  const selectedFormatLabel = selectedSplat?.format ? selectedSplat.format.toUpperCase() : "SPLAT";

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

      {selectedSplatUrl && (!splatRequested || sparkStatus === "failed") ? (
        <div className="absolute inset-0 flex items-center justify-center px-5 text-center">
          <div className="max-w-[21rem] border border-white/18 bg-black/50 p-5 text-white shadow-[0_22px_70px_-46px_rgba(0,0,0,0.75)] backdrop-blur-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/58">
              {sparkStatus === "failed" ? `${selectedFormatLabel} did not load` : `${selectedFormatLabel} available`}
            </p>
            <p className="mt-3 text-sm leading-6 text-white/76">
              {sparkStatus === "failed"
                ? sparkError || "The fallback preview is still available while the splat viewer is unavailable."
                : selectedSplat?.detail || "Load the self-hosted splat only when you want to inspect it in-browser."}
            </p>
            <button
              type="button"
              onClick={() => {
                setSparkError(null);
                setSplatRequested(false);
                window.requestAnimationFrame(() => setSplatRequested(true));
              }}
              className="mt-5 inline-flex items-center justify-center bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              {sparkStatus === "failed" ? "Retry splat preview" : `Load ${selectedFormatLabel} preview`}
            </button>
          </div>
        </div>
      ) : null}

      {selectedSplatUrl && splatRequested && sparkStatus === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center px-5 text-center">
          <div className="max-w-[20rem] border border-white/16 bg-black/48 p-5 text-white shadow-[0_22px_70px_-46px_rgba(0,0,0,0.75)] backdrop-blur-md">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border border-white/20 border-t-white" />
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/72">
              Loading {selectedFormatLabel} preview
            </p>
            <p className="mt-3 text-sm leading-6 text-white/70">
              The fallback preview stays visible while the browser viewer starts.
            </p>
          </div>
        </div>
      ) : null}

      {normalizedSplatOptions.length > 1 ? (
        <div className="absolute right-4 top-4 flex border border-white/12 bg-black/34 p-1 backdrop-blur-sm">
          {normalizedSplatOptions.map((option, index) => (
            <button
              key={`${option.format}-${option.url}`}
              type="button"
              onClick={() => setSelectedSplatIndex(index)}
              className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition ${
                index === selectedSplatIndex
                  ? "bg-white text-slate-950"
                  : "text-white/58 hover:bg-white/10 hover:text-white"
              }`}
            >
              {option.format}
            </button>
          ))}
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-white/12 bg-black/28 px-4 py-3 text-xs text-white/70 backdrop-blur-sm sm:px-5">
        <span className="font-semibold uppercase tracking-[0.18em] text-white/72">{fallbackLabel}</span>
        {selectedSplatUrl ? (
          <span className="text-white/60">
            {sparkStatus === "ready"
              ? `${selectedFormatLabel} loaded in-browser`
              : sparkStatus === "failed"
                ? `${selectedFormatLabel} unavailable; fallback shown`
                : splatRequested
                  ? `Loading ${selectedFormatLabel}`
                  : `${selectedFormatLabel} loads on click`}
          </span>
        ) : (
          <span className="text-white/60">Splat preview activates when attached to the site package</span>
        )}
      </div>
    </div>
  );
}
