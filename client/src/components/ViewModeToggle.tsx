"use client";
import React, { useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { USDZLoader } from "three-usdz-loader";
import * as THREE from "three";
import { Loader2 } from "lucide-react";

// Camera controller component
const CameraController = () => {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 2, 5);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return null;
};

// Component to load and display the USDZ model
const USDZModel = ({ modelUrl }: { modelUrl: string }) => {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const loaderRef = useRef<USDZLoader | null>(null);

  useEffect(() => {
    const loadModel = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Initialize loader if not already done
        if (!loaderRef.current) {
          loaderRef.current = new USDZLoader();
        }

        // Fetch the USDZ file as ArrayBuffer
        const response = await fetch(modelUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch model: ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        if (!arrayBuffer) {
          throw new Error("Failed to load model data");
        }

        // Parse the USDZ file
        const parsed = await loaderRef.current.parse(arrayBuffer);
        if (!parsed) {
          throw new Error("Failed to parse USDZ model");
        }

        // Set up the model
        parsed.scale.set(1, 1, 1);
        parsed.position.set(0, 0, 0);
        parsed.rotation.set(0, 0, 0);

        setModel(parsed);
      } catch (err) {
        console.error("Error loading USDZ model:", err);
        setError(err instanceof Error ? err.message : "Failed to load model");
      } finally {
        setIsLoading(false);
      }
    };

    if (modelUrl) {
      loadModel();
    }

    // Cleanup function
    return () => {
      if (model) {
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (child.material instanceof THREE.Material) {
              child.material.dispose();
            }
          }
        });
      }
    };
  }, [modelUrl]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading model...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        <span>Error loading model: {error}</span>
      </div>
    );
  }

  return model ? <primitive object={model} /> : null;
};

// Main viewer component
const ViewModeToggle = ({ modelUrl }: { modelUrl: string }) => {
  return (
    <div className="w-full h-full">
      <Canvas className="w-full h-full bg-gray-100">
        <PerspectiveCamera makeDefault position={[0, 2, 5]} />
        <CameraController />
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

        {/* USDZ Model */}
        <USDZModel modelUrl={modelUrl} />
      </Canvas>
    </div>
  );
};

export default ViewModeToggle;
