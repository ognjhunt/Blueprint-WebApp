// Lightweight helper to dynamically import Three.js only when needed
// This prevents memory crashes by avoiding eager imports

let THREE: any = null;

export const getThree = async () => {
  if (!THREE) {
    THREE = await import("three");
  }
  return THREE;
};

// Helper functions that create Three.js objects on demand
export const createVector3 = async (x = 0, y = 0, z = 0) => {
  const THREE = await getThree();
  return new THREE.Vector3(x, y, z);
};

export const createQuaternion = async (x = 0, y = 0, z = 0, w = 1) => {
  const THREE = await getThree();
  return new THREE.Quaternion(x, y, z, w);
};

export const createRaycaster = async () => {
  const THREE = await getThree();
  return new THREE.Raycaster();
};

// Type-only exports for TypeScript (these don't load the actual library)
export type Vector3 = import("three").Vector3;
export type Quaternion = import("three").Quaternion;
export type Raycaster = import("three").Raycaster;
export type Scene = import("three").Scene;
export type PerspectiveCamera = import("three").PerspectiveCamera;
export type WebGLRenderer = import("three").WebGLRenderer;
export type Object3D = import("three").Object3D;