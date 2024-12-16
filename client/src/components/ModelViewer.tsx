import { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, useGLTF } from "@react-three/drei";
import { Loader2 } from "lucide-react";

// Model component that handles the 3D model loading
const Model = ({ url }: { url: string }) => {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
};

const ModelViewer = ({ modelUrl }: { modelUrl: string }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset states when URL changes
    setIsLoading(true);
    setError(null);

    const loadModel = async () => {
      try {
        // For now, we'll just simulate the loading
        // In production, you would convert USDZ to GLTF here
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setIsLoading(false);
      } catch (err) {
        setError("Failed to load 3D model");
        setIsLoading(false);
      }
    };

    loadModel();
  }, [modelUrl]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center text-red-500">
        {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading 3D model...</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <Canvas className="w-full h-full" style={{ background: "#f3f4f6" }}>
        <PerspectiveCamera makeDefault position={[0, 2, 5]} />
        <OrbitControls
          enableDamping
          dampingFactor={0.1}
          minDistance={2}
          maxDistance={10}
        />

        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <directionalLight position={[-10, -10, -5]} intensity={0.5} />

        {/* Grid and axes helpers */}
        <gridHelper args={[20, 20]} />
        <axesHelper args={[5]} />

        {/* Model */}
        <Model url={modelUrl} />
      </Canvas>
    </div>
  );
};

export default ModelViewer;
