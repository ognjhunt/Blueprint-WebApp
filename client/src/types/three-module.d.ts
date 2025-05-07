// Type declarations for three.js modules that don't have TypeScript definitions

declare module 'three/examples/jsm/controls/OrbitControls' {
  import { Camera, EventDispatcher, Vector3 } from 'three';
  
  export class OrbitControls extends EventDispatcher {
    constructor(camera: Camera, domElement?: HTMLElement);
    
    enabled: boolean;
    target: Vector3;
    minDistance: number;
    maxDistance: number;
    minZoom: number;
    maxZoom: number;
    minPolarAngle: number;
    maxPolarAngle: number;
    minAzimuthAngle: number;
    maxAzimuthAngle: number;
    enableDamping: boolean;
    dampingFactor: number;
    enableZoom: boolean;
    zoomSpeed: number;
    enableRotate: boolean;
    rotateSpeed: number;
    enablePan: boolean;
    panSpeed: number;
    screenSpacePanning: boolean;
    keyPanSpeed: number;
    autoRotate: boolean;
    autoRotateSpeed: number;
    enableKeys: boolean;
    keys: { LEFT: number; UP: number; RIGHT: number; BOTTOM: number };
    mouseButtons: { LEFT: number; MIDDLE: number; RIGHT: number };
    touches: { ONE: number; TWO: number };
    
    update(): boolean;
    dispose(): void;
    getAzimuthalAngle(): number;
    getPolarAngle(): number;
    saveState(): void;
    reset(): void;
  }
}

declare module 'three/examples/jsm/loaders/GLTFLoader' {
  import { 
    AnimationClip, 
    Camera, 
    Group, 
    Loader, 
    LoadingManager, 
    Object3D, 
    Scene 
  } from 'three';
  
  export interface GLTF {
    animations: AnimationClip[];
    scene: Scene;
    scenes: Scene[];
    cameras: Camera[];
    asset: {
      copyright?: string;
      generator?: string;
      version?: string;
      minVersion?: string;
      extensions?: any;
      extras?: any;
    };
    parser: any;
    userData: any;
  }
  
  export class GLTFLoader extends Loader {
    constructor(manager?: LoadingManager);
    
    load(
      url: string, 
      onLoad: (gltf: GLTF) => void, 
      onProgress?: (event: ProgressEvent) => void, 
      onError?: (event: ErrorEvent) => void
    ): void;
    
    setDRACOLoader(dracoLoader: any): GLTFLoader;
    setDDSLoader(ddsLoader: any): GLTFLoader;
    
    parse(
      data: ArrayBuffer | string, 
      path: string, 
      onLoad: (gltf: GLTF) => void, 
      onError?: (event: ErrorEvent) => void
    ): void;
  }
}