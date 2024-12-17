"use client";
import React, { useEffect, useRef, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { USDZLoader } from "three-usdz-loader";
import * as THREE from "three";

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

  useEffect(() => {
    const loader = new USDZLoader();
    loader.load(
      modelUrl,
      (usdz) => {
        setModel(usdz);
      },
      undefined,
      (error) => {
        console.error("Error loading USDZ model:", error);
      },
    );
  }, [modelUrl]);

  return model ? <primitive object={model} /> : null;
};

// Main viewer component
const ModelViewer = ({ modelUrl }: { modelUrl: string }) => {
  return (
    <div className="w-full h-full">
      <Canvas className="w-full h-full bg-gray-100">
        <PerspectiveCamera makeDefault position={[0, 2, 5]} />
        <CameraController />
        <OrbitControls enableDamping dampingFactor={0.1} />

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

export default ModelViewer;
