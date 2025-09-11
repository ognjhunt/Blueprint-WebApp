// Lightweight helper to dynamically import Three.js only when needed
// This prevents memory crashes by avoiding eager imports

let THREE: any = null;
let OrbitControls: any = null;
let TransformControls: any = null;
let CSS3DRenderer: any = null;
let CSS3DObject: any = null;
let PointerLockControls: any = null;
let GLTFLoader: any = null;
let USDZLoader: any = null;

export const getThree = async () => {
  if (!THREE) {
    THREE = await import("three");
  }
  return THREE;
};

export const getOrbitControls = async () => {
  if (!OrbitControls) {
    const module = await import("three/examples/jsm/controls/OrbitControls");
    OrbitControls = module.OrbitControls;
  }
  return OrbitControls;
};

export const getTransformControls = async () => {
  if (!TransformControls) {
    const module = await import("three/examples/jsm/controls/TransformControls.js");
    TransformControls = module.TransformControls;
  }
  return TransformControls;
};

export const getCSS3DRenderer = async () => {
  if (!CSS3DRenderer) {
    const module = await import("three/examples/jsm/renderers/CSS3DRenderer.js");
    CSS3DRenderer = module.CSS3DRenderer;
    CSS3DObject = module.CSS3DObject;
  }
  return { CSS3DRenderer, CSS3DObject };
};

export const getPointerLockControls = async () => {
  if (!PointerLockControls) {
    const module = await import("three/examples/jsm/controls/PointerLockControls.js");
    PointerLockControls = module.PointerLockControls;
  }
  return PointerLockControls;
};

export const getGLTFLoader = async () => {
  if (!GLTFLoader) {
    const module = await import("three/examples/jsm/loaders/GLTFLoader");
    GLTFLoader = module.GLTFLoader;
  }
  return GLTFLoader;
};

export const getUSDZLoader = async () => {
  if (!USDZLoader) {
    const module = await import("three/examples/jsm/loaders/USDZLoader");
    USDZLoader = module.USDZLoader;
  }
  return USDZLoader;
};

// Get CSS3DObject class specifically
export const getCSS3DObject = async () => {
  if (!CSS3DObject) {
    const module = await import("three/examples/jsm/renderers/CSS3DRenderer.js");
    CSS3DObject = module.CSS3DObject;
  }
  return CSS3DObject;
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

export const createMatrix4 = async () => {
  const THREE = await getThree();
  return new THREE.Matrix4();
};

export const createEuler = async (x = 0, y = 0, z = 0, order = 'XYZ') => {
  const THREE = await getThree();
  return new THREE.Euler(x, y, z, order);
};

export const createClock = async () => {
  const THREE = await getThree();
  return new THREE.Clock();
};

export const createPlane = async (normal?: any, constant?: number) => {
  const THREE = await getThree();
  return new THREE.Plane(normal, constant);
};

export const createBox3 = async (min?: any, max?: any) => {
  const THREE = await getThree();
  return new THREE.Box3(min, max);
};

// Geometry creators
export const createSphereGeometry = async (radius = 1, widthSegments = 32, heightSegments = 16) => {
  const THREE = await getThree();
  return new THREE.SphereGeometry(radius, widthSegments, heightSegments);
};

export const createPlaneGeometry = async (width = 1, height = 1, widthSegments = 1, heightSegments = 1) => {
  const THREE = await getThree();
  return new THREE.PlaneGeometry(width, height, widthSegments, heightSegments);
};

export const createBoxGeometry = async (width = 1, height = 1, depth = 1) => {
  const THREE = await getThree();
  return new THREE.BoxGeometry(width, height, depth);
};

export const createCylinderGeometry = async (radiusTop = 1, radiusBottom = 1, height = 1, radialSegments = 32) => {
  const THREE = await getThree();
  return new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
};

export const createCircleGeometry = async (radius = 1, segments = 32) => {
  const THREE = await getThree();
  return new THREE.CircleGeometry(radius, segments);
};

export const createBufferGeometry = async () => {
  const THREE = await getThree();
  return new THREE.BufferGeometry();
};

export const createEdgesGeometry = async (geometry: any) => {
  const THREE = await getThree();
  return new THREE.EdgesGeometry(geometry);
};

// Material creators
export const createMeshBasicMaterial = async (parameters?: any) => {
  const THREE = await getThree();
  return new THREE.MeshBasicMaterial(parameters);
};

export const createSpriteMaterial = async (parameters?: any) => {
  const THREE = await getThree();
  return new THREE.SpriteMaterial(parameters);
};

export const createLineBasicMaterial = async (parameters?: any) => {
  const THREE = await getThree();
  return new THREE.LineBasicMaterial(parameters);
};

export const createMeshLambertMaterial = async (parameters?: any) => {
  const THREE = await getThree();
  return new THREE.MeshLambertMaterial(parameters);
};

// Object creators
export const createMesh = async (geometry?: any, material?: any) => {
  const THREE = await getThree();
  return new THREE.Mesh(geometry, material);
};

export const createSprite = async (material?: any) => {
  const THREE = await getThree();
  return new THREE.Sprite(material);
};

export const createGroup = async () => {
  const THREE = await getThree();
  return new THREE.Group();
};

export const createScene = async () => {
  const THREE = await getThree();
  return new THREE.Scene();
};

export const createPerspectiveCamera = async (fov = 75, aspect = 1, near = 0.1, far = 1000) => {
  const THREE = await getThree();
  return new THREE.PerspectiveCamera(fov, aspect, near, far);
};

export const createWebGLRenderer = async (parameters?: any) => {
  const THREE = await getThree();
  return new THREE.WebGLRenderer(parameters);
};

export const createLine = async (geometry?: any, material?: any) => {
  const THREE = await getThree();
  return new THREE.Line(geometry, material);
};

export const createLineSegments = async (geometry?: any, material?: any) => {
  const THREE = await getThree();
  return new THREE.LineSegments(geometry, material);
};

// Helper creators
export const createGridHelper = async (size = 10, divisions = 10, colorCenterLine?: number, colorGrid?: number) => {
  const THREE = await getThree();
  return new THREE.GridHelper(size, divisions, colorCenterLine, colorGrid);
};

export const createBox3Helper = async (box: any, color = 0xffff00) => {
  const THREE = await getThree();
  return new THREE.Box3Helper(box, color);
};

// Texture loaders
export const createTextureLoader = async () => {
  const THREE = await getThree();
  return new THREE.TextureLoader();
};

// Attributes
export const createFloat32BufferAttribute = async (array: any, itemSize: number) => {
  const THREE = await getThree();
  return new THREE.Float32BufferAttribute(array, itemSize);
};

// Type-only exports for TypeScript (these don't load the actual library)
export type Vector3 = import("three").Vector3;
export type Quaternion = import("three").Quaternion;
export type Raycaster = import("three").Raycaster;
export type Scene = import("three").Scene;
export type PerspectiveCamera = import("three").PerspectiveCamera;
export type WebGLRenderer = import("three").WebGLRenderer;
export type Object3D = import("three").Object3D;
export type Mesh = import("three").Mesh;
export type Matrix4 = import("three").Matrix4;
export type Euler = import("three").Euler;
export type Camera = import("three").Camera;
export type Material = import("three").Material;
export type Geometry = import("three").Geometry;
export type BufferGeometry = import("three").BufferGeometry;