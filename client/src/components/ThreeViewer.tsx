import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { Loader2, AlertCircle } from "lucide-react";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {getStorage as getStorage2} from "firebase/storage";
const storage = getStorage2();

interface ThreeViewerProps {
  modelUrl: string;
  onLoadingChange?: (loading: boolean) => void;
  onError?: (error: string) => void;
}

const ThreeViewer: React.FC<ThreeViewerProps> = ({
  modelUrl,
  onLoadingChange,
  onError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const animationFrameRef = useRef<number>();
  const mountedRef = useRef(true);

  const updateLoading = (state: boolean) => {
    if (mountedRef.current) {
      setLoading(state);
      onLoadingChange?.(state);
    }
  };

  const handleError = (errorMessage: string) => {
    if (mountedRef.current) {
      setError(errorMessage);
      onError?.(errorMessage);
      updateLoading(false);
    }
  };

  const loadModel = async (url: string, retryCount = 0): Promise<void> => {
    console.log("Attempting to fetch 3D model from:", url);
    try {
      updateLoading(true);

      // 1. Get Firebase Storage reference and download URL
      let downloadUrl = url;
      if (url.includes('firebasestorage.googleapis.com')) {
        try {
          // Extract the path from the Firebase Storage URL
          const decodedPath = decodeURIComponent(url.split('/o/')[1].split('?')[0]);
          const storageRef = ref(storage, decodedPath);
          downloadUrl = await getDownloadURL(storageRef);
        } catch (error) {
          console.error("Error getting Firebase download URL:", error);
          throw new Error("Failed to get download URL from Firebase Storage");
        }
      }

      console.log("Loading model from download URL:", downloadUrl);

      // 2. Load the model using GLTFLoader with proper cors settings
      const loader = new GLTFLoader();
      loader.setCrossOrigin('anonymous');

      const gltf = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Load timeout")), 30000);

        loader.load(
          downloadUrl,
          (result) => {
            clearTimeout(timeout);
            resolve(result);
          },
          (progress) => {
            const percent = ((progress.loaded / progress.total) * 100).toFixed(2);
            console.log(`Loading progress: ${percent}%`);
          },
          (error) => {
            clearTimeout(timeout);
            console.error("GLTFLoader error:", error);
            reject(new Error(`Failed to load model: ${error.message}`));
          }
        );
      });

      // 3. Handle the loaded model
      if (!mountedRef.current || !sceneRef.current) return;

      if (modelRef.current) {
        sceneRef.current.remove(modelRef.current);
        modelRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      }

      modelRef.current = gltf.scene;
      sceneRef.current.add(modelRef.current);

      const box = new THREE.Box3().setFromObject(modelRef.current);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim;
      modelRef.current.scale.setScalar(scale);
      modelRef.current.position.copy(center).multiplyScalar(-scale);

      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.set(2, 2, 2);
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }

      updateLoading(false);
    } catch (error) {
      console.error("Error loading model:", error);

      if (retryCount < 3 && mountedRef.current) {
        console.log(`Retrying model load... Attempt ${retryCount + 1}/3`);
        const backoffTime = Math.pow(2, retryCount) * 1000;
        await new Promise((res) => setTimeout(res, backoffTime));
        return loadModel(url, retryCount + 1);
      }

      handleError(error instanceof Error ? error.message : String(error));
    }
  };

  const initRenderer = () => {
    if (!containerRef.current) return null;

    // Try to create renderer with different context attributes
    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true,
        failIfMajorPerformanceCaveat: true,
      });
    } catch (e) {
      console.warn(
        "Failed to create WebGL renderer with high performance settings, trying fallback",
      );
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: false,
          alpha: true,
          powerPreference: "default",
        });
      } catch (e2) {
        console.error("Failed to create WebGL renderer:", e2);
        return null;
      }
    }

    renderer.setSize(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight,
    );
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    return renderer;
  };

  const setupScene = () => {
    if (!containerRef.current) return null;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000,
    );
    camera.position.set(0, 2, 5);

    // Initialize renderer
    const renderer = initRenderer();
    if (!renderer) {
      handleError("Failed to initialize WebGL renderer");
      return null;
    }

    containerRef.current.appendChild(renderer.domElement);

    // Controls setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Add ground plane for reference
    const groundGeometry = new THREE.PlaneGeometry(10, 10);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.8,
      metalness: 0.2,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    return { scene, camera, renderer, controls };
  };
  useEffect(() => {
    mountedRef.current = true;
    const setup = setupScene();
    if (!setup) return;

    const { scene, camera, renderer, controls } = setup;
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;

    let isAnimating = true;
    const animate = () => {
      if (!isAnimating || !mountedRef.current) return;

      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };

    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);
    animate();

    // Load model if URL is provided
    if (modelUrl) {
      loadModel(modelUrl);
    }

    return () => {
      mountedRef.current = false;
      isAnimating = false;
      window.removeEventListener("resize", handleResize);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (renderer && containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
        renderer.dispose();
      }

      // Clean up model resources
      if (modelRef.current) {
        modelRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((material) => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      }
    };
  }, []);

  // Handle model URL changes
  useEffect(() => {
    if (modelUrl && sceneRef.current && mountedRef.current) {
      loadModel(modelUrl);
    }
  }, [modelUrl]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-sm">
          <div className="flex items-center gap-2 bg-white/90 px-4 py-2 rounded-lg shadow-lg">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-sm font-medium">Loading 3D model...</span>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/95">
          <Alert variant="destructive" className="w-[400px]">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load 3D model: {error}
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
};

export default React.memo(ThreeViewer);