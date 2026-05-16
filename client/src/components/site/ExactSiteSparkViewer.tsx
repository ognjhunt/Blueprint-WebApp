import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Move3d, Pause, Play, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { getOrbitControls, getSparkSplatMesh, getThree } from "@/lib/threeUtils";

type PreviewMode = "splat" | "provider" | "sample";
type SparkStatus = "idle" | "loading" | "ready" | "failed";
type SplatFormat = "spz" | "ply" | "splat";
type CameraTourState = "idle" | "playing";
type CameraTourKeyframe = {
  time: number;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
};
type RelativeCameraTourKeyframe = CameraTourKeyframe;
type VectorLike3 = { x: number; y: number; z: number };

const SPARK_LOAD_TIMEOUT_MS = 30000;
const CAMERA_TOUR_DURATION_MS = 9000;

function interpolateNumber(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function smoothStep(progress: number) {
  return progress * progress * (3 - 2 * progress);
}

function interpolateCameraKeyframes(keyframes: CameraTourKeyframe[], progress: number) {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const currentIndex = Math.max(
    0,
    keyframes.findIndex((keyframe, index) => {
      const next = keyframes[index + 1];
      return Boolean(next && clampedProgress >= keyframe.time && clampedProgress <= next.time);
    }),
  );
  const start = keyframes[currentIndex] || keyframes[0];
  const end = keyframes[currentIndex + 1] || start;
  const localRange = Math.max(end.time - start.time, 0.001);
  const localProgress = smoothStep((clampedProgress - start.time) / localRange);
  const mixVector = (from: [number, number, number], to: [number, number, number]) =>
    from.map((value, index) => interpolateNumber(value, to[index], localProgress)) as [number, number, number];

  return {
    position: mixVector(start.position, end.position),
    target: mixVector(start.target, end.target),
    fov: interpolateNumber(start.fov, end.fov, localProgress),
  };
}

export interface ExactSiteCameraPath {
  id: string;
  label: string;
  keyframes: RelativeCameraTourKeyframe[];
}

function expandRelativeCameraPath(
  worldCenter: VectorLike3,
  maxAxis: number,
  keyframes: RelativeCameraTourKeyframe[],
): CameraTourKeyframe[] {
  return keyframes.map((keyframe) => ({
    time: keyframe.time,
    position: [
      worldCenter.x + maxAxis * keyframe.position[0],
      worldCenter.y + maxAxis * keyframe.position[1],
      worldCenter.z + maxAxis * keyframe.position[2],
    ],
    target: [
      worldCenter.x + maxAxis * keyframe.target[0],
      worldCenter.y + maxAxis * keyframe.target[1],
      worldCenter.z + maxAxis * keyframe.target[2],
    ],
    fov: keyframe.fov,
  }));
}

function createCameraTourKeyframes(
  worldCenter: VectorLike3,
  maxAxis: number,
  cameraPath?: ExactSiteCameraPath | null,
): CameraTourKeyframe[] {
  if (cameraPath?.keyframes.length) {
    return expandRelativeCameraPath(worldCenter, maxAxis, cameraPath.keyframes);
  }

  const target: [number, number, number] = [
    worldCenter.x,
    worldCenter.y - maxAxis * 0.02,
    worldCenter.z,
  ];

  return [
    {
      time: 0,
      position: [worldCenter.x + maxAxis * 0.16, worldCenter.y + maxAxis * 0.12, worldCenter.z + maxAxis * 0.82],
      target,
      fov: 42,
    },
    {
      time: 0.32,
      position: [worldCenter.x - maxAxis * 0.26, worldCenter.y + maxAxis * 0.07, worldCenter.z + maxAxis * 0.58],
      target: [worldCenter.x - maxAxis * 0.1, target[1], target[2]],
      fov: 38,
    },
    {
      time: 0.66,
      position: [worldCenter.x + maxAxis * 0.04, worldCenter.y + maxAxis * 0.02, worldCenter.z + maxAxis * 0.42],
      target: [worldCenter.x + maxAxis * 0.08, worldCenter.y - maxAxis * 0.04, target[2]],
      fov: 32,
    },
    {
      time: 1,
      position: [worldCenter.x + maxAxis * 0.32, worldCenter.y + maxAxis * 0.13, worldCenter.z + maxAxis * 0.62],
      target: [worldCenter.x + maxAxis * 0.04, target[1], target[2]],
      fov: 40,
    },
  ];
}

export interface ExactSiteSplatPreviewOption {
  url: string;
  label: string;
  format: SplatFormat;
  detail?: string;
}

interface ExactSiteSparkViewerProps {
  spzUrl?: string | null;
  splatOptions?: ExactSiteSplatPreviewOption[];
  cameraPath?: ExactSiteCameraPath | null;
  cameraPathRunKey?: number;
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
  cameraPath,
  cameraPathRunKey = 0,
  panoUrl,
  thumbnailUrl,
  videoSrc,
  posterSrc,
  className = "",
}: ExactSiteSparkViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const sceneFrameRef = useRef<{
    worldCenter: VectorLike3;
    maxAxis: number;
  } | null>(null);
  const initialViewRef = useRef<{
    cameraPosition: any;
    target: any;
    minDistance: number;
    maxDistance: number;
    fov: number;
  } | null>(null);
  const cameraTourRef = useRef<{
    keyframes: CameraTourKeyframe[];
    startedAt: number;
  } | null>(null);
  const cameraPathRef = useRef<ExactSiteCameraPath | null | undefined>(cameraPath);
  const cameraPathRunKeyRef = useRef(cameraPathRunKey);
  const lastAppliedCameraPathRunKeyRef = useRef(cameraPathRunKey);
  const cameraTourStateRef = useRef<CameraTourState>("idle");
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
  const [cameraTourState, setCameraTourState] = useState<CameraTourState>("idle");
  const [splatRequested, setSplatRequested] = useState(false);
  const fallbackImage = firstUrl(panoUrl, thumbnailUrl, posterSrc);
  const previewMode: PreviewMode = selectedSplatUrl ? "splat" : panoUrl || thumbnailUrl ? "provider" : "sample";
  const fallbackLabel = useMemo(() => {
    if (previewMode === "splat") return "Self-hosted splat preview";
    if (previewMode === "provider") return "Provider preview fallback";
    return "Sample/generated preview fallback";
  }, [previewMode]);
  const showFallback = !selectedSplatUrl || !splatRequested || sparkStatus === "loading" || sparkStatus === "failed";
  const setCameraTourPhase = useCallback((nextState: CameraTourState) => {
    cameraTourStateRef.current = nextState;
    setCameraTourState(nextState);
  }, []);
  const applyCameraTourKeyframes = useCallback(
    (keyframes: CameraTourKeyframe[], startPlaying = false) => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      const firstKeyframe = keyframes[0];
      if (!camera || !controls || !firstKeyframe) {
        return;
      }

      cameraTourRef.current = {
        keyframes,
        startedAt: 0,
      };
      controls.target.set(...firstKeyframe.target);
      camera.position.set(...firstKeyframe.position);
      camera.fov = firstKeyframe.fov;
      camera.updateProjectionMatrix();
      controls.update();
      initialViewRef.current = {
        cameraPosition: camera.position.clone(),
        target: controls.target.clone(),
        minDistance: controls.minDistance,
        maxDistance: controls.maxDistance,
        fov: camera.fov,
      };
      setCameraTourPhase(startPlaying ? "playing" : "idle");
    },
    [setCameraTourPhase],
  );

  useEffect(() => {
    cameraPathRef.current = cameraPath;
    cameraPathRunKeyRef.current = cameraPathRunKey;
    const sceneFrame = sceneFrameRef.current;
    if (!sceneFrame || sparkStatus !== "ready") {
      return;
    }

    const shouldPlay = cameraPathRunKey !== lastAppliedCameraPathRunKeyRef.current;
    const keyframes = createCameraTourKeyframes(sceneFrame.worldCenter, sceneFrame.maxAxis, cameraPath);
    applyCameraTourKeyframes(keyframes, shouldPlay);
    lastAppliedCameraPathRunKeyRef.current = cameraPathRunKey;
  }, [applyCameraTourKeyframes, cameraPath, cameraPathRunKey, sparkStatus]);

  useEffect(() => {
    setSelectedSplatIndex(0);
  }, [normalizedSplatOptions]);

  useEffect(() => {
    setSparkStatus(selectedSplatUrl ? "idle" : "failed");
    setSparkError(null);
    setCameraTourPhase("idle");
    cameraTourRef.current = null;
    sceneFrameRef.current = null;
    setSplatRequested(false);
  }, [selectedSplatUrl, setCameraTourPhase]);

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
    let camera: any = null;
    let controls: any = null;
    let splat: any = null;
    let loadTimeoutId: number | null = null;
    let loadTimedOut = false;
    let stopTourOnUserInput: (() => void) | null = null;

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

        camera = new THREE.PerspectiveCamera(50, 1, 0.01, 500);
        camera.position.set(0.4, 0.7, 3.6);
        cameraRef.current = camera;

        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setClearColor(0x111711, 0.92);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.domElement.className = "absolute inset-0 h-full w-full";
        container.appendChild(renderer.domElement);
        stopTourOnUserInput = () => {
          if (cameraTourStateRef.current === "playing") {
            setCameraTourPhase("idle");
          }
        };
        renderer.domElement.addEventListener("pointerdown", stopTourOnUserInput);
        renderer.domElement.addEventListener("wheel", stopTourOnUserInput, { passive: true });
        renderer.domElement.addEventListener("touchstart", stopTourOnUserInput, { passive: true });

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.enablePan = true;
        controls.screenSpacePanning = true;
        controls.zoomSpeed = 0.86;
        controls.panSpeed = 0.72;
        controls.rotateSpeed = 0.62;
        controls.minDistance = 0.6;
        controls.maxDistance = 40;
        controls.target.set(0, 0, 0);
        controlsRef.current = controls;

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
        let worldCenter = new THREE.Vector3();
        let maxAxis = 2;
        splat.updateMatrixWorld(true);
        if (bounds && !bounds.isEmpty?.()) {
          const center = bounds.getCenter(new THREE.Vector3());
          const size = bounds.getSize(new THREE.Vector3());
          maxAxis = Math.max(size.x, size.y, size.z, 1);
          worldCenter = splat.localToWorld(center.clone());
        } else {
          splat.getWorldPosition?.(worldCenter);
        }

        sceneFrameRef.current = { worldCenter, maxAxis };
        const cameraTourKeyframes = createCameraTourKeyframes(worldCenter, maxAxis, cameraPathRef.current);
        camera.near = Math.max(maxAxis / 1000, 0.01);
        camera.far = Math.max(maxAxis * 80, 100);
        controls.minDistance = Math.max(maxAxis * 0.08, 0.08);
        controls.maxDistance = Math.max(maxAxis * 8, 8);
        camera.updateProjectionMatrix();
        applyCameraTourKeyframes(cameraTourKeyframes, cameraPathRunKeyRef.current > 0);
        lastAppliedCameraPathRunKeyRef.current = cameraPathRunKeyRef.current;

        setSparkStatus("ready");

        const tick = (timestamp: number) => {
          if (cancelled) {
            return;
          }
          const cameraTour = cameraTourRef.current;
          if (cameraTour && cameraTourStateRef.current === "playing") {
            if (!cameraTour.startedAt) {
              cameraTour.startedAt = timestamp;
            }
            const progress = Math.min((timestamp - cameraTour.startedAt) / CAMERA_TOUR_DURATION_MS, 1);
            const nextView = interpolateCameraKeyframes(cameraTour.keyframes, progress);
            camera.position.set(...nextView.position);
            camera.fov = nextView.fov;
            camera.updateProjectionMatrix();
            controls.target.set(...nextView.target);
            if (progress >= 1) {
              cameraTour.startedAt = 0;
              setCameraTourPhase("idle");
            }
          }
          controls.update();
          renderer.render(scene, camera);
          frameId = window.requestAnimationFrame(tick);
        };
        tick(window.performance.now());
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
      if (stopTourOnUserInput && renderer?.domElement) {
        renderer.domElement.removeEventListener("pointerdown", stopTourOnUserInput);
        renderer.domElement.removeEventListener("wheel", stopTourOnUserInput);
        renderer.domElement.removeEventListener("touchstart", stopTourOnUserInput);
      }
      controls?.dispose?.();
      if (controlsRef.current === controls) {
        controlsRef.current = null;
      }
      if (cameraRef.current === camera) {
        cameraRef.current = null;
      }
      initialViewRef.current = null;
      cameraTourRef.current = null;
      sceneFrameRef.current = null;
      cameraTourStateRef.current = "idle";
      splat?.dispose?.();
      if (renderer) {
        renderer.dispose?.();
        renderer.forceContextLoss?.();
        renderer.domElement?.remove?.();
      }
    };
  }, [applyCameraTourKeyframes, selectedSplat?.label, selectedSplatUrl, setCameraTourPhase, splatRequested]);

  const selectedFormatLabel = selectedSplat?.format ? selectedSplat.format.toUpperCase() : "SPLAT";
  const zoomViewer = (scale: number) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      return;
    }

    const target = controls.target;
    const offset = camera.position.clone().sub(target);
    const currentDistance = Math.max(offset.length(), 0.001);
    const minDistance = controls.minDistance || initialViewRef.current?.minDistance || 0.08;
    const maxDistance = controls.maxDistance || initialViewRef.current?.maxDistance || 40;
    const nextDistance = Math.min(Math.max(currentDistance * scale, minDistance), maxDistance);
    offset.normalize().multiplyScalar(nextDistance);
    camera.position.copy(target).add(offset);
    camera.updateProjectionMatrix();
    controls.update();
  };
  const resetViewer = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const initialView = initialViewRef.current;
    if (!camera || !controls || !initialView) {
      return;
    }

    camera.position.copy(initialView.cameraPosition);
    controls.target.copy(initialView.target);
    controls.minDistance = initialView.minDistance;
    controls.maxDistance = initialView.maxDistance;
    camera.fov = initialView.fov;
    camera.updateProjectionMatrix();
    controls.update();
    setCameraTourPhase("idle");
    if (cameraTourRef.current) {
      cameraTourRef.current.startedAt = 0;
    }
  };
  const toggleCameraTour = () => {
    if (!cameraTourRef.current) {
      return;
    }

    if (cameraTourStateRef.current === "playing") {
      setCameraTourPhase("idle");
      return;
    }

    cameraTourRef.current.startedAt = 0;
    setCameraTourPhase("playing");
  };

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

      <div
        ref={containerRef}
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        aria-label="Blueprint Exact-Site Preview viewer"
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(8,12,10,0.74),rgba(8,12,10,0.18)_48%,rgba(8,12,10,0.64))]" />

      {selectedSplatUrl && (!splatRequested || sparkStatus === "failed") ? (
        <div className="absolute inset-0 flex items-end justify-end px-5 pb-20 text-left sm:items-center sm:pr-8">
          <div className="max-w-[19rem] border border-white/18 bg-black/58 p-5 text-white shadow-[0_22px_70px_-46px_rgba(0,0,0,0.75)] backdrop-blur-md">
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
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-5 text-center">
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

      {sparkStatus === "ready" ? (
        <div className="absolute right-4 top-20 flex items-center gap-1 border border-white/12 bg-black/36 p-1 text-white backdrop-blur-sm">
          <button
            type="button"
            onClick={toggleCameraTour}
            className="inline-flex h-9 w-9 items-center justify-center text-white/72 transition hover:bg-white hover:text-slate-950"
            aria-label={
              cameraTourState === "playing"
                ? `Pause ${selectedFormatLabel} camera path`
                : `Play ${selectedFormatLabel} camera path`
            }
            title={cameraTourState === "playing" ? "Pause path" : "Play path"}
          >
            {cameraTourState === "playing" ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => zoomViewer(0.72)}
            className="inline-flex h-9 w-9 items-center justify-center text-white/72 transition hover:bg-white hover:text-slate-950"
            aria-label={`Zoom into ${selectedFormatLabel} preview`}
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => zoomViewer(1.38)}
            className="inline-flex h-9 w-9 items-center justify-center text-white/72 transition hover:bg-white hover:text-slate-950"
            aria-label={`Zoom out of ${selectedFormatLabel} preview`}
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={resetViewer}
            className="inline-flex h-9 w-9 items-center justify-center text-white/72 transition hover:bg-white hover:text-slate-950"
            aria-label={`Reset ${selectedFormatLabel} preview view`}
            title="Reset view"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {sparkStatus === "ready" ? (
        <div className="pointer-events-none absolute bottom-16 left-4 flex items-center gap-2 border border-white/12 bg-black/34 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/62 backdrop-blur-sm">
          <Move3d className="h-4 w-4" aria-hidden="true" />
          Drag / Zoom / Pan
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-white/12 bg-black/28 px-4 py-3 text-xs text-white/70 backdrop-blur-sm sm:px-5">
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
