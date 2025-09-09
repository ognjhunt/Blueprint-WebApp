import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react"; // Added forwardRef, useImperativeHandle
import * as THREE from "three";
// Removed CSS3DRenderer import - we'll use our own interface
// Updated import to use modern THREE.SRGBColorSpace instead of deprecated sRGBEncoding
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js"; // <<< This is the one you want to use
import {
  CSS3DRenderer,
  CSS3DObject,
} from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";

interface DragControls {
  enabled: boolean;
  transformGroup: boolean;
  activate(): void;
  deactivate(): void;
  dispose(): void;
  addEventListener(type: string, listener: (event: any) => void): void;
  removeEventListener(type: string, listener: (event: any) => void): void;
  getObjects(): THREE.Object3D[];
  getDraggableObjects(): THREE.Object3D[];
}

// Add extended OrbitControls interface to fix TypeScript errors
declare module "three/examples/jsm/controls/OrbitControls" {
  interface OrbitControls {
    panLeft(distance: number, objectMatrix?: THREE.Matrix4): void;
    panUp(distance: number, objectMatrix?: THREE.Matrix4): void;
    dollyIn(dollyScale: number): void;
    dollyOut(dollyScale: number): void;
  }
}

// Add extended event interface for THREE.js events to include browser-like methods
declare module "three" {
  interface Event {
    preventDefault: () => void;
    stopPropagation: () => void;
  }

  // Add missing event types to Object3DEventMap
  interface Object3DEventMap {
    pointerdown: Event;
    pointerup: Event;
    pointermove: Event;
    click: Event;
    [key: string]: Event; // Allow any string key for event types
  }
}
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { USDZLoader } from "three/examples/jsm/loaders/USDZLoader";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import CloudUpload from "@/components/CloudUpload";
import { useLocation } from "wouter";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Box,
  CircleDot,
  Square,
  LayoutGrid,
  X,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { doc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import * as TWEEN from "@tweenjs/tween.js";
// Removed CSS3DObject import - we'll use our own interface

const pinSvg =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='red'><path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z'/></svg>";
const pinTexture = new THREE.TextureLoader().load(
  "data:image/svg+xml;utf8," + encodeURIComponent(pinSvg),
);
pinTexture.colorSpace = THREE.SRGBColorSpace;

const FALLBACK_MODEL_URL =
  "https://f005.backblazeb2.com/file/objectModels-dev/Mona_Lisa_PBR_hires_model.glb";

const loadModelWithFallback = async (url: string): Promise<THREE.Object3D> => {
  const isUSDZ = url.toLowerCase().endsWith(".usdz");
  const loader: any = isUSDZ ? new USDZLoader() : new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf: any) => {
        const model = gltf?.scene || gltf;
        resolve(model);
      },
      undefined,
      async (err: any) => {
        console.error("Error loading model", err);
        if (url !== FALLBACK_MODEL_URL) {
          try {
            const fallback = await loadModelWithFallback(FALLBACK_MODEL_URL);
            resolve(fallback);
          } catch (e) {
            reject(e);
          }
        } else {
          reject(err);
        }
      },
    );
  });
};

declare module "three" {
  interface Object3D {
    isDescendantOf?(obj: Object3D): boolean;
    addEventListener(type: string, listener: (event: any) => void): void;
  }

  // Fix for Mesh objects
  interface Mesh {
    addEventListener(type: string, listener: (event: any) => void): void;
  }
}

// Extend THREE.Object3D prototype with the isDescendantOf method
if (typeof THREE !== "undefined" && THREE.Object3D) {
  THREE.Object3D.prototype.isDescendantOf = function (
    obj: THREE.Object3D,
  ): boolean {
    let parent = this.parent;
    while (parent) {
      if (parent === obj) return true;
      parent = parent.parent;
    }
    return false;
  };
}

interface FileAnchorElements {
  marker: THREE.Object3D | null;
  contentObject: THREE.Object3D | null;
  closeButton?: THREE.Object3D;
  helperMesh?: THREE.Mesh; // If your content relies on a separate helper for transforms
  labelObject?: THREE.Object3D; // For icons with text labels
  isLoadingContent?: boolean; // Prevent multiple load attempts
}

// Define missing interfaces to fix type errors
interface ReferencePoint {
  id: string;
  x: number;
  y: number;
  z: number;
  x3D?: number; // Optional legacy properties that might be used elsewhere
  y3D?: number;
  z3D?: number;
  label: "A" | "B" | "C";
}

interface MarkedArea {
  id: string;
  name: string;
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

interface MarkedPoint {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
}

// Define FileAnchor interface to fix duplicate definition errors
interface FileAnchor {
  id: string;
  fileType: string;
  fileName: string;
  fileUrl: string;
  x: number;
  y: number;
  z: number;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}

interface ThreeViewerProps {
  modelPath: string;
  originPoint?: THREE.Vector3 | null;
  yRotation?: number | null;
  onLoad?: () => void;
  onError?: (error: string) => void;

  // Add these to match what you pass in:
  activeLabel?: "A" | "B" | "C" | null;
  awaiting3D?: boolean;
  setReferencePoints3D?: React.Dispatch<React.SetStateAction<ReferencePoint[]>>;
  setAwaiting3D?: (value: boolean) => void;
  setActiveLabel?: (label: "A" | "B" | "C" | null) => void;
  referencePoints3D?: ReferencePoint[];
  scaleFactor?: number;
  selectedArea?: string | null; // Add this prop
  isChoosingOrigin?: boolean;
  setIsChoosingOrigin?: React.Dispatch<React.SetStateAction<boolean>>; // Add this line
  setOriginPoint?: React.Dispatch<React.SetStateAction<THREE.Vector3 | null>>; // Add this line
  onOriginSet?: (point: THREE.Vector3) => void; // ADD THIS PROP
  qrPlacementMode?: boolean; // new
  placementMode?: { type: "link" | "model" | "file"; data?: any } | null;
  onLinkPlaced?: (pos: THREE.Vector3) => void;
  onQRPlaced?: (pos: THREE.Vector3) => void; // new
  onModelDropped?: (model: any, pos: THREE.Vector3) => void;
  onPlacementComplete?: (
    mode: { type: "link" | "model" | "file"; data?: any },
    position: THREE.Vector3,
    anchorId: string | null,
  ) => void; // Added this line
  modelAnchors?: ModelAnchor[];
  pendingLabelTextRef?: React.MutableRefObject<string>;
  showTextBoxInputRef?: React.MutableRefObject<boolean>;
  onTextBoxSubmit?: (
    text: string,
    realWorldCoords: { x: number; y: number; z: number },
  ) => void;
  isMarkingArea?: boolean;
  onAreaMarked?: (areaData: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  }) => void;
  markedAreas?: MarkedArea[];
  isMarkingPoint?: boolean;
  onPointMarked?: (pos: { x: number; y: number; z: number }) => void;
  markedPoints?: MarkedPoint[];
  fileAnchors?: FileAnchor[];
  webpageAnchors?: Array<{
    id: string;
    webpageUrl: string;
    x: number;
    y: number;
    z: number;
  }>;
  textAnchors?: TextAnchor[];
  onFileDropped?: (
    fileInfo: any,
    realWorldCoords: { x: number; y: number; z: number },
  ) => void;
  onCloudFileSelect?: (file: File) => void;
  onCloudLinkSelect?: (url: string) => void;
  onTextAnchorClick?: (anchorId: string, currentText: string) => void;
  onWebpageAnchorClick?: (anchorId: string, anchorUrl: string) => void;
  onFileAnchorClick?: (anchorId: string, anchorData: any) => void;
  // Anchor Data Props (Keep these)
  qrCodeAnchors?: Array<{
    id: string;
    x: number;
    y: number;
    z: number;
    [key: string]: any;
  }>;
  onBackgroundClick?: () => void;

  // NEW Visibility Props
  showQrCodes?: boolean;
  showTextAnchors?: boolean;
  showFileAnchors?: boolean;
  showWebpageAnchors?: boolean;
  showModelAnchors?: boolean;
  showMarkedPoints?: boolean;
  showGrid?: boolean;
  originOrientation?: THREE.Quaternion | null;
  originSettingStep?: "inactive" | "picking_position" | "picking_direction";
  tempOriginPos?: THREE.Vector3 | null;
  onOriginPositionPicked?: (point: THREE.Vector3) => void;
  onOriginDirectionPicked?: (
    position: THREE.Vector3,
    direction: THREE.Vector3,
  ) => void;
  onWalkModeChange?: (active: boolean) => void;
}

interface OriginMarkerConfig {
  radius?: number;
  color?: number;
  opacity?: number;
}

interface TextAnchor {
  id: string;
  x: number;
  y: number;
  z: number;
  textContent: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio";
}

interface ModelAnchor {
  id: string;
  modelName?: string; // e.g. "Antique_Iron_Safe.glb"
  x: number;
  y: number;
  z: number;
  contentType?: string;
  textContent?: string;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  position?: any; // Allow position property for compatibility
  // Add any other fields if needed
}

const labelColors: Record<"A" | "B" | "C", number> = {
  A: 0xff0000,
  B: 0x00ff00,
  C: 0x0000ff,
};

interface ThreeViewerImperativeHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  enterWalkMode: () => void;
  exitWalkMode: () => void;
}

export function getCameraWorldPose(camera: THREE.Camera) {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  camera.updateMatrixWorld(true);
  camera.matrixWorld.decompose(position, quaternion, scale);

  // Forward/look direction in world space
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);

  return { position, quaternion, forward };
}

export type OrthonormalFrame = {
  origin: THREE.Vector3; // O
  U: THREE.Vector3; // right/east
  V: THREE.Vector3; // up
  W: THREE.Vector3; // forward/north (or any consistent third axis)
};

// Build a world→frame matrix: [E^T | -E^T O]
function makeWorldToFrameMatrix(frame: OrthonormalFrame) {
  const { origin: O, U, V, W } = frame;

  const E = new THREE.Matrix4().makeBasis(U, V, W); // columns = U,V,W
  const R = new THREE.Matrix4().copy(E).transpose(); // E^T
  const T = new THREE.Matrix4().makeTranslation(-O.x, -O.y, -O.z);
  return new THREE.Matrix4().multiplyMatrices(R, T);
}

export function worldToFrame(p: THREE.Vector3, frame: OrthonormalFrame) {
  const M = makeWorldToFrameMatrix(frame);
  return p.clone().applyMatrix4(M);
}

const ThreeViewer = React.memo(
  forwardRef<ThreeViewerImperativeHandle, ThreeViewerProps>((props, ref) => {
    const {
      modelPath,
      yRotation,
      onLoad,
      onError,
      onTextAnchorClick,
      onWebpageAnchorClick,
      qrCodeAnchors,
      onFileAnchorClick,
      onBackgroundClick,
      onFileDropped,
      onCloudFileSelect,
      onCloudLinkSelect,
      activeLabel,
      awaiting3D,
      setReferencePoints3D,
      setAwaiting3D,
      setActiveLabel,
      referencePoints3D,
      pendingLabelTextRef,
      scaleFactor,
      setIsChoosingOrigin,
      isChoosingOrigin,
      setOriginPoint,
      onOriginSet,
      qrPlacementMode, // new
      onQRPlaced, // new
      placementMode, // ADD THIS
      onLinkPlaced, // ADD THIS
      originPoint,
      modelAnchors,
      fileAnchors,
      showTextBoxInputRef,
      onTextBoxSubmit,
      isMarkingArea,
      onAreaMarked,
      webpageAnchors,
      textAnchors,
      onModelDropped,
      onPlacementComplete,
      markedAreas,
      isMarkingPoint,
      onPointMarked,
      markedPoints,
      selectedArea,
      showQrCodes,
      showTextAnchors,
      showFileAnchors,
      showWebpageAnchors,
      showModelAnchors,
      showMarkedPoints = true,
      showGrid,
      onWalkModeChange,
      originOrientation, // Added originOrientation here
    } = props;
    console.log("ThreeViewer - modelPath prop:", modelPath); // ADD THIS LINE
    const mountRef = useRef<HTMLDivElement>(null);
    // const previousOriginPointRef = useRef<THREE.Vector3 | null>(
    //   originPoint || null,
    // ); // Initialize with prop or null
    // To this:
    const previousOriginPointRef = useRef<THREE.Vector3 | null>(null);
    const hasInitializedOriginRef = useRef(false);
    const qrPlacementModeRef = useRef(qrPlacementMode);
    useEffect(() => {
      qrPlacementModeRef.current = qrPlacementMode;
    }, [qrPlacementMode]);

    // Remove alignment markers when reference points are cleared
    useEffect(() => {
      if (!referencePoints3D || !sceneRef.current) return;
      const scene = sceneRef.current;

      alignmentMarkersRef.current.forEach((marker, label) => {
        const exists = referencePoints3D.some((p) => p.label === label);
        if (!exists) {
          scene.remove(marker);
          marker.geometry.dispose();
          const mat = marker.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) {
            mat.forEach((m) => m.dispose());
          } else {
            mat.dispose();
          }
          alignmentMarkersRef.current.delete(label);
        }
      });
    }, [referencePoints3D]);

    useEffect(() => {
      isMarkingAreaRef.current = !!isMarkingArea;
      isMarkingPointRef.current = !!isMarkingPoint;
      if (rendererRef.current) {
        rendererRef.current.domElement.style.cursor =
          isMarkingArea || isMarkingPoint ? "crosshair" : "auto";
      }
    }, [isMarkingArea, isMarkingPoint]);

    const [activeFileAnchorId, setActiveFileAnchorId] = useState<string | null>(
      null,
    );
    const SCALE_FACTOR = scaleFactor || 34.85; //was for home: 46.5306122451 //was for office: 34.85
    const MAX_ZOOM_OUT_MULTIPLIER = 1.5; // limit how far users can zoom out
    const fileAnchorElementsRef = useRef<Map<string, FileAnchorElements>>(
      new Map(),
    );
    // const textAnchorsRef = useRef<Map<string, THREE.Object3D>>(new Map());
    const textAnchorsRef = useRef<Map<string, CSS3DObject>>(new Map());
    const pointMarkersRef = useRef<Map<string, THREE.Sprite>>(new Map());
    const fileAnchorsRef = useRef<Map<string, THREE.Object3D>>(new Map());
    const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster()); //check
    const clickMarkerRef = useRef<THREE.Mesh | null>(null);
    const dragCircleRef = useRef<THREE.Mesh | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const gridRef = useRef<THREE.GridHelper | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const transformControlsRef = useRef<TransformControls | null>(null);
    const orbitControlsRef = useRef<OrbitControls | null>(null);
    const dragControlsRef = useRef<DragControls | null>(null);
    // ---- Walk mode refs/state ----
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const pointerLockRef = useRef<PointerLockControls | null>(null);
    const walkBoundsRef = useRef<THREE.Box3 | null>(null);
    const [isWalkMode, setIsWalkMode] = useState(false);
    const isWalkModeRef = useRef(false);
    const clockRef = useRef(new THREE.Clock());
    const keysRef = useRef({
      forward: false,
      back: false,
      left: false,
      right: false,
      sprint: false,
    });
    const walkParamsRef = useRef({
      velocity: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      accel: 3.0,
      damping: 10.0,
      sprintMul: 2.0,
      eye: 0.055,
    });
    const PDF_THUMBNAIL_URL = "/images/PDF_file_icon.svg";
    const DOCX_THUMBNAIL_URL = "/images/docx_icon.svg.png";
    const PPTX_THUMBNAIL_URL = "/images/pptx_thumbnail.png";

    useEffect(() => {
      if (!sceneRef.current) return;
      if (!gridRef.current) {
        gridRef.current = new THREE.GridHelper(10, 10);
        (gridRef.current.material as THREE.Material).opacity = 0.25;
        (gridRef.current.material as THREE.Material).transparent = true;
        sceneRef.current.add(gridRef.current);
      }
      gridRef.current.visible = showGrid ?? true;
    }, [showGrid]);

    const enterWalkMode = () => {
      if (!pointerLockRef.current) return;
      isWalkModeRef.current = true;
      setIsWalkMode(true);
      onWalkModeChange?.(true);
      if (orbitControlsRef.current) orbitControlsRef.current.enabled = false;
      if (transformControlsRef.current)
        transformControlsRef.current.enabled = false;
    };

    const exitWalkMode = () => {
      isWalkModeRef.current = false;
      setIsWalkMode(false);
      pointerLockRef.current?.unlock();
      onWalkModeChange?.(false);
      if (orbitControlsRef.current) orbitControlsRef.current.enabled = true;
      if (transformControlsRef.current)
        transformControlsRef.current.enabled = true;
    };

    useImperativeHandle(ref, () => ({
      zoomIn() {
        if (!orbitControlsRef.current) return;
        // Example approach: move camera closer to target by ~10%
        const controls = orbitControlsRef.current;
        // Use the camera reference directly instead of controls.object
        const cam = cameraRef.current;
        if (!cam) return;
        const direction = cam.position
          .clone()
          .sub(controls.target)
          .multiplyScalar(0.9);
        cam.position.copy(controls.target.clone().add(direction));
        controls.update();
      },
      zoomOut() {
        if (!orbitControlsRef.current) return;
        // Move camera further from target by ~10%
        const controls = orbitControlsRef.current;
        const cam = cameraRef.current;
        if (!cam) return;
        const direction = cam.position.clone().sub(controls.target);
        const maxDistance = controls.maxDistance ?? Infinity;
        const newDistance = direction.length() * 1.1;
        if (newDistance > maxDistance) {
          direction.setLength(maxDistance);
        } else {
          direction.multiplyScalar(1.1);
        }
        cam.position.copy(controls.target.clone().add(direction));
        controls.update();
      },
      enterWalkMode,
      exitWalkMode,
    }));

    const isMarkerSelectedRef = useRef<boolean>(false);
    const anchorModelsRef = useRef<Map<string, THREE.Object3D>>(new Map());
    const anchorWebpagesRef = useRef<Map<string, THREE.Object3D>>(new Map());
    const parentModelRef = useRef<THREE.Object3D | null>(null);
    const isDrawingRef = useRef(false);
    const corner1Ref = useRef<THREE.Vector3 | null>(null);
    const corner2Ref = useRef<THREE.Vector3 | null>(null);
    const tempBoxHelperRef = useRef<THREE.Box3Helper | null>(null);
    const tempBoxMeshRef = useRef<THREE.Mesh | null>(null);
    const [transformUpdateSuccess, setTransformUpdateSuccess] = useState(false);
    const [transformError, setTransformError] = useState<string | null>(null);
    const animateDragIndicatorRef = useRef<() => void | null>(null);
    const highlightedAreaMeshRef = useRef<THREE.Mesh | null>(null);
    const qrCodeMarkersRef = useRef<Map<string, THREE.Object3D>>(new Map()); // <<< ADD THIS LINE
    const alignmentMarkersRef = useRef<Map<string, THREE.Mesh>>(new Map());

    // --- Area marking v2 (plane-locked) ---
    type AreaBasis = {
      origin: THREE.Vector3;
      U: THREE.Vector3;
      V: THREE.Vector3;
      N: THREE.Vector3;
    };
    const isMarkingAreaRef = useRef<boolean>(!!isMarkingArea);
    const isMarkingPointRef = useRef<boolean>(!!isMarkingPoint);
    const areaBasisRef = useRef<AreaBasis | null>(null);
    const areaPlaneRef = useRef<THREE.Plane | null>(null);
    const areaPreviewRef = useRef<THREE.Mesh | null>(null);
    const areaPreviewOutlineRef = useRef<THREE.LineSegments | null>(null);
    const areaUVRef = useRef<{ u1: number; v1: number } | null>(null);

    const [location] = useLocation();
    const blueprintId = location.split("/").pop(); // assuming the route is /blueprint-editor/{id}
    const [originConfirmation, setOriginConfirmation] = useState<string>("");
    const [showSidePanel, setShowSidePanel] = useState(false);
    const [modelLoadProgress, setModelLoadProgress] = useState(0);
    const [modelLoaded, setModelLoaded] = useState(false);

    const [promptInput, setPromptInput] = useState("");
    const [selectedPoint, setSelectedPoint] = useState<THREE.Vector3 | null>(
      null,
    );
    const [textInput, setTextInput] = useState("");
    const lastDragUpdateRef = useRef(0);

    const projectToScreen = (point: THREE.Vector3) => {
      if (!cameraRef.current || !mountRef.current) return { x: 0, y: 0 };
      const vector = point.clone();
      vector.project(cameraRef.current);
      const rect = mountRef.current.getBoundingClientRect();
      const x = ((vector.x + 1) / 2) * rect.width;
      const y = ((-vector.y + 1) / 2) * rect.height;
      return { x, y };
    };

    useEffect(() => {
      if (originConfirmation) {
        const timer = setTimeout(() => setOriginConfirmation(""), 4000);
        return () => clearTimeout(timer);
      }
    }, [originConfirmation]);
    const pointMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map()); // Ref to store 3D point meshes
    const transformUpdateTimeout = useRef<NodeJS.Timeout | null>(null);

    const options = [
      { icon: <Box size={24} />, label: "Add 3D Object" },
      { icon: <CircleDot size={24} />, label: "Add Point of Interest" },
      { icon: <Square size={24} />, label: "Add Boundary Box" },
      { icon: <LayoutGrid size={24} />, label: "Add Information Panel" },
    ];
    const placementModeRef = useRef(placementMode);
    const activeLabelRef = useRef(activeLabel);
    const awaiting3DRef = useRef(awaiting3D);
    const isChoosingOriginRef = useRef(isChoosingOrigin);

    const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(
      null,
    ); // NEW: Unified ID
    const [selectedAnchorType, setSelectedAnchorType] = useState<
      "model" | "text" | "file" | "webpage" | null
    >(null); // NEW: Type of selected anchor
    const [showTransformUI, setShowTransformUI] = useState(false);
    const [transformMode, setTransformMode] = useState<
      "translate" | "rotate" | "scale" | null // Allow null initially
    >(null);
    const [lastTransform, setLastTransform] = useState<{
      position: THREE.Vector3 | null;
      rotation: THREE.Euler | null;
      scale: THREE.Vector3 | null;
    }>({ position: null, rotation: null, scale: null });

    const originRef = useRef<THREE.Vector3 | null>(null);
    const originMarkerRef = useRef<THREE.Object3D | null>(null); // Changed to THREE.Object3D to support both Mesh and Group
    const [distanceDisplay, setDistanceDisplay] = useState<string>("");

    const [markingCornerStart, setMarkingCornerStart] =
      useState<THREE.Vector3 | null>(null);
    const [tempBoxHelper, setTempBoxHelper] = useState<THREE.Box3Helper | null>(
      null,
    );
    const originNodeRef = useRef<THREE.Object3D | null>(null);
    const originDirectionLineRef = useRef<THREE.Line | null>(null);

    const createCircularFileMarker = (
      anchorId: string,
      onClick: () => void,
    ): CSS3DObject => {
      const markerDiv = document.createElement("div");
      markerDiv.style.width = "30px"; // Adjust size as needed
      markerDiv.style.height = "30px";
      markerDiv.style.borderRadius = "50%";
      markerDiv.style.backgroundColor = "#f0f0f0"; // Light gray, similar to example
      markerDiv.style.border = "1px solid #b0b0b0"; // Slightly darker border
      markerDiv.style.boxShadow =
        "inset 1px 1px 3px rgba(0,0,0,0.15), 0px 1px 2px rgba(0,0,0,0.1)";
      markerDiv.style.cursor = "pointer";
      markerDiv.style.display = "flex";
      markerDiv.style.alignItems = "center";
      markerDiv.style.justifyContent = "center";
      markerDiv.style.transition = "transform 0.1s ease-out";
      markerDiv.style.pointerEvents = "auto"; // Ensure it's clickable

      // Optional: add a subtle inner element or icon if desired
      // const innerDot = document.createElement('div');
      // innerDot.style.width = '8px';
      // innerDot.style.height = '8px';
      // innerDot.style.borderRadius = '50%';
      // innerDot.style.backgroundColor = '#c0c0c0';
      // markerDiv.appendChild(innerDot);

      markerDiv.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        onClick();
      });
      markerDiv.addEventListener("mouseenter", () => {
        markerDiv.style.transform = "scale(1.1)";
      });
      markerDiv.addEventListener("mouseleave", () => {
        markerDiv.style.transform = "scale(1.0)";
      });

      const css3DObject = new CSS3DObject(markerDiv);
      css3DObject.userData.isMarker = true;
      css3DObject.userData.anchorId = anchorId;
      return css3DObject;
    };

    // Helper function to create the close button
    const createCloseButton = (onClick: () => void): CSS3DObject => {
      const buttonDiv = document.createElement("button");
      buttonDiv.innerHTML = "×"; // X symbol for close
      buttonDiv.style.width = "24px";
      buttonDiv.style.height = "24px";
      buttonDiv.style.position = "absolute"; // Positioned by CSS3DObject's transform
      buttonDiv.style.top = "-12px"; // Adjust for visual placement relative to content corner
      buttonDiv.style.right = "-12px";
      buttonDiv.style.padding = "0";
      buttonDiv.style.backgroundColor = "rgba(40, 40, 40, 0.8)";
      buttonDiv.style.color = "white";
      buttonDiv.style.border = "1px solid rgba(255,255,255,0.3)";
      buttonDiv.style.borderRadius = "50%";
      buttonDiv.style.cursor = "pointer";
      buttonDiv.style.zIndex = "20"; // Ensure on top
      buttonDiv.style.pointerEvents = "auto";
      buttonDiv.style.fontSize = "16px";
      buttonDiv.style.lineHeight = "22px";
      buttonDiv.style.textAlign = "center";
      buttonDiv.style.display = "flex";
      buttonDiv.style.alignItems = "center";
      buttonDiv.style.justifyContent = "center";

      buttonDiv.addEventListener("pointerdown", (e) => {
        e.stopPropagation(); // Important
        onClick();
      });

      const cssObj = new CSS3DObject(buttonDiv);
      cssObj.userData.isCloseButton = true;
      return cssObj;
    };

    // Helper function to create the actual file content (refactored from your existing logic)
    // IMPORTANT: This function will be long, containing your existing file-type handling.
    // It needs to be adapted to return a Promise<THREE.Object3D | null>.
    // Helper meshes and CSS Labels (for icons) ARE ADDED to the scene within this function.
    // The main visual object (imagePlane, videoPlane) is RETURNED.
    const createActualFileContent = async (
      anchor: any, // Use your FileAnchor type
      modelSpacePosition: THREE.Vector3,
      camera: THREE.Camera,
      scene: THREE.Scene,
      fileAnchorsProp: any[], // Pass the full fileAnchors prop for data lookup if needed
      onFileAnchorClickHandler: typeof onFileAnchorClick, // Pass callbacks
      handleAnchorSelectHandler: typeof handleAnchorSelect, // Pass callbacks
    ): Promise<THREE.Object3D | null> => {
      // --- Determine fileType (copy your logic) ---
      const fileNameLower = anchor.fileName?.toLowerCase() || "";
      let determinedFileType = anchor.fileType;
      if (!determinedFileType) {
        if (fileNameLower.endsWith(".pdf")) determinedFileType = "pdf";
        else if (
          fileNameLower.endsWith(".docx") ||
          fileNameLower.endsWith(".doc")
        )
          determinedFileType = "docx";
        else if (
          fileNameLower.endsWith(".pptx") ||
          fileNameLower.endsWith(".ppt")
        )
          determinedFileType = "pptx";
        else if (fileNameLower.match(/\.(jpg|jpeg|png|gif|webp)$/i))
          determinedFileType = "image";
        else if (fileNameLower.match(/\.(mp4|mov|webm)$/i))
          determinedFileType = "video";
        else if (fileNameLower.match(/\.(mp3|wav|ogg)$/i))
          determinedFileType = "audio";
        else determinedFileType = "document"; // Fallback
      }

      let visualObject: THREE.Object3D | null = null;

      // --- IMAGE ---
      if (determinedFileType === "image") {
        visualObject = await new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.onload = () => {
            try {
              const aspect = img.width / img.height;
              const planeWidth = 0.15; // Adjust as needed
              const planeHeight = planeWidth / aspect;
              const canvas = document.createElement("canvas");
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext("2d")!;
              const r = Math.min(110, canvas.width / 2, canvas.height / 2); // Rounded corners
              ctx.beginPath();
              ctx.moveTo(r, 0);
              /* ... your rounded rect path ... */ ctx.lineTo(0, r);
              ctx.quadraticCurveTo(0, 0, r, 0);
              ctx.closePath();
              ctx.clip();
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              const texture = new THREE.CanvasTexture(canvas);
              texture.colorSpace = THREE.SRGBColorSpace;
              const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
                transparent: true,
                depthWrite: false,
                alphaTest: 0.1,
              });
              const imagePlane = new THREE.Mesh(
                new THREE.PlaneGeometry(planeWidth, planeHeight),
                material,
              );
              imagePlane.position.copy(modelSpacePosition);
              imagePlane.userData = {
                anchorId: anchor.id,
                type: "file-image-content",
              };

              // Use THREE.Mesh.onPointerDown instead of addEventListener due to TypeScript issues
              const mesh = new THREE.Mesh(
                new THREE.PlaneGeometry(planeWidth, planeHeight),
                material,
              );
              mesh.position.copy(modelSpacePosition);
              mesh.userData = {
                anchorId: anchor.id,
                type: "file-image-content",
                onPointerDown: (e: any) => {
                  e.stopPropagation();
                  const helper = mesh.userData.helperMesh as THREE.Mesh;
                  const faData = fileAnchorsProp?.find(
                    (f) => f.id === anchor.id,
                  );
                  if (onFileAnchorClickHandler && faData)
                    onFileAnchorClickHandler(anchor.id, faData);
                  handleAnchorSelectHandler(anchor.id, helper || mesh, "file");
                },
              };

              const helperGeo = new THREE.BoxGeometry(0.01, 0.01, 0.01);
              const helperMat = new THREE.MeshBasicMaterial({ visible: false });
              const helperMesh = new THREE.Mesh(helperGeo, helperMat);
              helperMesh.position.copy(mesh.position);
              helperMesh.rotation.copy(mesh.rotation);
              mesh.userData.helperMesh = helperMesh;
              helperMesh.userData = {
                visualObject: mesh,
                anchorId: anchor.id,
                type: "file-helper",
              };
              scene.add(helperMesh);
              scene.add(mesh);
              resolve(mesh);
            } catch (err) {
              console.error("Error creating image content:", err);
              resolve(null);
            }
          };
          img.onerror = (err) => {
            console.error("Error loading image for content:", err);
            resolve(null);
          };
          let imageUrl =
            //   anchor.fileUrl ||
            "https://f005.backblazeb2.com/file/uploadedFiles-dev/083B81B6-F5EB-4AF3-B491-1DE40976280F_Asset0017.jpg"; // Fallback for testing

          // Decode HTML entities in the URL
          imageUrl = imageUrl.replace(/&amp;/g, "&");

          img.src = imageUrl;
        });
      }
      // --- VIDEO ---
      else if (determinedFileType === "video") {
        visualObject = await new Promise((resolve) => {
          const video = document.createElement("video");
          video.crossOrigin = "Anonymous";
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          video.preload = "auto";
          video.onloadeddata = () => {
            try {
              const aspect = video.videoWidth / video.videoHeight;
              const planeWidth = 0.25;
              const planeHeight = planeWidth / aspect;
              const videoTexture = new THREE.VideoTexture(video);
              videoTexture.colorSpace = THREE.SRGBColorSpace;
              // Rounded corners for video (alphaMap)
              const alphaCanvas =
                document.createElement(
                  "canvas",
                ); /* ... setup alphaCanvas for rounded rect ... */
              // ... (draw white rounded rect on black background for alphaMap) ...
              const alphaTexture = new THREE.CanvasTexture(alphaCanvas);
              const material = new THREE.MeshBasicMaterial({
                map: videoTexture,
                alphaMap: alphaTexture,
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: false,
              });
              const videoPlane = new THREE.Mesh(
                new THREE.PlaneGeometry(planeWidth, planeHeight),
                material,
              );
              videoPlane.position.copy(modelSpacePosition);
              videoPlane.userData = {
                anchorId: anchor.id,
                type: "file-video-content",
                videoElement: video,
              };

              videoPlane.addEventListener("pointerdown", (e) => {
                /* ... your listener ... */
              });

              const helperGeo = new THREE.BoxGeometry(
                0.01,
                0.01,
                0.01,
              ); /* ... create helper ... */
              const helperMesh = new THREE.Mesh(
                helperGeo,
                new THREE.MeshBasicMaterial({ visible: false }),
              );
              helperMesh.position.copy(videoPlane.position);
              videoPlane.userData.helperMesh = helperMesh;
              helperMesh.userData = {
                visualObject: videoPlane,
                anchorId: anchor.id,
                type: "file-helper",
              };
              scene.add(helperMesh);
              video
                .play()
                .catch((e) => console.warn("Video autoplay prevented", e));
              resolve(videoPlane);
            } catch (err) {
              console.error("Error creating video content:", err);
              resolve(null);
            }
          };
          video.onerror = (err) => {
            console.error("Error loading video for content:", err);
            resolve(null);
          };
          video.src =
            //      anchor.fileUrl ||
            "https://f005.backblazeb2.com/file/uploadedFiles-dev/24406E68-8FBD-4BAC-B773-E09EE0497599_Blueprint++In+Shared+Space+-+With+Explanations.mp4"; // Fallback
        });
      }
      // --- AUDIO ---
      else if (determinedFileType === "audio") {
        // Your existing audio CSS3DObject creation
        const wrapper =
          document.createElement("div"); /* ... style wrapper ... */
        const btn = document.createElement("button");
        /* ... style button ... */ wrapper.appendChild(btn);
        const label = document.createElement("span");
        /* ... style label ... */ wrapper.appendChild(label);
        const audioEl = new Audio(anchor.fileUrl);
        // Store audio element reference in a local variable instead of using HTMLElement.userData
        const audioElRef = audioEl;
        btn.addEventListener("click", (e) => {
          /* ... play/pause logic ... */
        });
        const cssObj = new CSS3DObject(wrapper);
        cssObj.scale.set(0.0015, 0.0015, 0.0015);
        cssObj.position.copy(modelSpacePosition);
        cssObj.userData = { anchorId: anchor.id, type: "file-audio-content" };

        const helperGeo = new THREE.BoxGeometry(
          0.01,
          0.01,
          0.01,
        ); /* ... create helper ... */
        const helperMesh = new THREE.Mesh(
          helperGeo,
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        helperMesh.position.copy(cssObj.position);
        cssObj.userData.helperMesh = helperMesh;
        helperMesh.userData = {
          visualObject: cssObj,
          anchorId: anchor.id,
          type: "file-helper",
        };
        scene.add(helperMesh); // Add helper to WebGL scene
        // CSS3DObject is added by the caller, so we just return it.
        wrapper.addEventListener("pointerdown", (ev) => {
          /* your listener */
        });
        visualObject = cssObj; // Synchronous
      }
      // --- PDF, DOCX, PPTX ICONS (or thumbnail if available) ---
      else if (
        anchor.thumbnailUrl ||
        ["pdf", "docx", "pptx"].includes(determinedFileType)
      ) {
        visualObject = await new Promise((resolve) => {
          const imgSrc =
            anchor.thumbnailUrl ||
            (determinedFileType === "pdf"
              ? PDF_THUMBNAIL_URL
              : determinedFileType === "docx"
                ? DOCX_THUMBNAIL_URL
                : PPTX_THUMBNAIL_URL);
          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.onload = () => {
            try {
              const aspect = img.width / img.height;
              const planeWidth = 0.1;
              const planeHeight = planeWidth / aspect;
              const texture = new THREE.Texture(img);
              texture.needsUpdate = true;
              texture.colorSpace = THREE.SRGBColorSpace;
              const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
                transparent: true,
                alphaTest: 0.1,
              });
              const iconPlane = new THREE.Mesh(
                new THREE.PlaneGeometry(planeWidth, planeHeight),
                material,
              );
              iconPlane.position.copy(modelSpacePosition);
              iconPlane.userData = {
                anchorId: anchor.id,
                type: `file-${determinedFileType}-icon-content`,
              };

              // Add CSS Label if it's an icon (not just a thumbnail preview)
              let labelObject;
              if (!anchor.thumbnailUrl) {
                // Only add label for specific icons, not generic thumbnails
                const labelDiv =
                  document.createElement("div"); /* ... style labelDiv ... */
                labelDiv.textContent =
                  anchor.fileName || determinedFileType.toUpperCase();
                labelObject = new CSS3DObject(labelDiv);
                labelObject.scale.set(0.001, 0.001, 0.001);
                labelObject.position
                  .copy(iconPlane.position)
                  .add(new THREE.Vector3(0, -planeHeight / 2 - 0.015, 0));
                scene.add(labelObject); // Add CSS Label to CSS3D scene here
                iconPlane.userData.labelObject = labelObject;
              }

              iconPlane.addEventListener("pointerdown", (e) => {
                /* ... your listener ... */
              });

              const helperGeo = new THREE.BoxGeometry(
                0.01,
                0.01,
                0.01,
              ); /* ... create helper ... */
              const helperMesh = new THREE.Mesh(
                helperGeo,
                new THREE.MeshBasicMaterial({ visible: false }),
              );
              helperMesh.position.copy(iconPlane.position);
              iconPlane.userData.helperMesh = helperMesh;
              helperMesh.userData = {
                visualObject: iconPlane,
                anchorId: anchor.id,
                type: "file-helper",
              };
              scene.add(helperMesh);
              resolve(iconPlane);
            } catch (err) {
              console.error("Error creating icon content:", err);
              resolve(null);
            }
          };
          img.onerror = (err) => {
            console.error("Error loading icon image for content:", err);
            resolve(null);
          };
          img.src = imgSrc;
        });
      }
      // --- DEFAULT DOCUMENT PLACEHOLDER ---
      else {
        const docGeometry = new THREE.BoxGeometry(0.15, 0.2, 0.02);
        const docMaterial = new THREE.MeshBasicMaterial({ color: 0x60a5fa });
        const docIcon = new THREE.Mesh(docGeometry, docMaterial);
        docIcon.position.copy(modelSpacePosition);
        docIcon.userData = {
          anchorId: anchor.id,
          type: "file-document-content",
        };
        docIcon.addEventListener("pointerdown", (e) => {
          /* ... your listener ... */
        });

        const helperGeo = new THREE.BoxGeometry(
          0.01,
          0.01,
          0.01,
        ); /* ... create helper ... */
        const helperMesh = new THREE.Mesh(
          helperGeo,
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        helperMesh.position.copy(docIcon.position);
        docIcon.userData.helperMesh = helperMesh;
        helperMesh.userData = {
          visualObject: docIcon,
          anchorId: anchor.id,
          type: "file-helper",
        };
        scene.add(helperMesh);
        visualObject = docIcon; // Synchronous
      }
      return visualObject;
    };

    // const applyAnchorOffset = (realWorldPos: THREE.Vector3) => {
    //   return new THREE.Vector3(
    //     realWorldPos.x + 1.31, // Add 1.31 to x
    //     realWorldPos.y, // Keep y unchanged
    //     realWorldPos.z - 38, // Subtract 38 from z
    //   );
    // };

    // UPDATED: This function now converts coordinates TO real-world using blueprint scale
    const convertToRealWorldCoords = (modelPosition: THREE.Vector3) => {
      if (!originNodeRef.current) {
        console.warn(
          "[convertToRealWorldCoords] OriginNode not set. Using fallback conversion.",
        );
        return modelPosition.clone().multiplyScalar(SCALE_FACTOR);
      }

      // Get position relative to origin
      const relativePos = modelPosition
        .clone()
        .sub(originNodeRef.current.position);

      // Apply coordinate system correction based on yRotation using proper rotation matrix
      let correctedPos = relativePos.clone();
      const rotationDegrees = yRotation || 0;
      const rotationRadians = (rotationDegrees * Math.PI) / 180;
      const cosTheta = Math.cos(rotationRadians);
      const sinTheta = Math.sin(rotationRadians);

      // Apply Y-axis rotation matrix
      correctedPos.set(
        relativePos.x * cosTheta + relativePos.z * sinTheta, // x' = x*cos(θ) + z*sin(θ)
        relativePos.y, // y' = y (unchanged)
        -relativePos.x * sinTheta + relativePos.z * cosTheta, // z' = -x*sin(θ) + z*cos(θ)
      );

      return correctedPos.multiplyScalar(SCALE_FACTOR);
    };

    // UPDATED: This function converts FROM real-world coordinates using blueprint scale
    const convertFromRealWorldCoords = (realWorldPos: THREE.Vector3) => {
      if (!originNodeRef.current) {
        console.warn(
          "[convertFromRealWorldCoords] OriginNode not set. Using fallback conversion.",
        );
        return realWorldPos.clone().divideScalar(SCALE_FACTOR);
      }

      // Convert from real-world units to model units
      let modelSpaceOffset = realWorldPos.clone().divideScalar(SCALE_FACTOR);

      // Apply INVERSE coordinate system correction based on yRotation using proper rotation matrix
      const rotationDegrees = yRotation || 0;
      const rotationRadians = (-rotationDegrees * Math.PI) / 180; // Negative for inverse rotation
      const cosTheta = Math.cos(rotationRadians);
      const sinTheta = Math.sin(rotationRadians);

      // Apply inverse Y-axis rotation matrix
      let correctedOffset = modelSpaceOffset.clone();
      correctedOffset.set(
        modelSpaceOffset.x * cosTheta + modelSpaceOffset.z * sinTheta, // x' = x*cos(-θ) + z*sin(-θ)
        modelSpaceOffset.y, // y' = y (unchanged)
        -modelSpaceOffset.x * sinTheta + modelSpaceOffset.z * cosTheta, // z' = -x*sin(-θ) + z*cos(-θ)
      );

      // Add the offset to the origin position to get final model position
      return correctedOffset.add(originNodeRef.current.position);
    };

    // Ensure updateAnchorTransform is stable if it relies on props/state not listed in its own useCallback deps (if any)
    // For simplicity, assuming it's stable or defined such that it doesn't cause re-creations that break useCallback below.
    // If updateAnchorTransform is NOT wrapped in useCallback and uses props like blueprintId, it should be.
    // Let's ensure blueprintId is stable for updateAnchorTransform
    const updateAnchorTransform = useCallback(
      async (
        anchorId: string,
        transform: {
          x: number;
          y: number;
          z: number;
          rotationX: number;
          rotationY: number;
          rotationZ: number;
          scaleX: number;
          scaleY: number;
          scaleZ: number;
        },
      ) => {
        if (!blueprintId) {
          console.error("[updateAnchorTransform] blueprintId is missing.");
          return;
        }
        if (!anchorId) {
          console.error("[updateAnchorTransform] anchorId is missing.");
          return;
        }
        if (!db) {
          console.error(
            "[updateAnchorTransform] Firebase db is not initialized.",
          );
          return;
        }
        try {
          const anchorRef = doc(db, "anchors", anchorId);
          await updateDoc(anchorRef, {
            x: transform.x,
            y: transform.y,
            z: transform.z,
            rotationX: transform.rotationX,
            rotationY: transform.rotationY,
            rotationZ: transform.rotationZ,
            scaleX: transform.scaleX,
            scaleY: transform.scaleY,
            scaleZ: transform.scaleZ,
            lastModified: new Date(),
          });
          console.log(
            `[updateAnchorTransform] Successfully updated anchor ${anchorId} in Firebase`,
          );
          // Removed setTransformUpdateSuccess/Error from here as it might be better handled by the caller or a global state
        } catch (error) {
          console.error(
            `[updateAnchorTransform] Error updating anchor ${anchorId}:`,
            error,
          );
        }
      },
      [blueprintId],
    ); // Depends on blueprintId

    // ADJUST ANCHORS FUNCTION (now with useCallback)
    const adjustAnchorsForOriginChange = useCallback(
      (oldOriginModel: THREE.Vector3, newOriginModel: THREE.Vector3) => {
        console.log(
          `[AdjustAnchors] Called. Old: ${oldOriginModel.toArray()}, New: ${newOriginModel.toArray()}`,
        );

        // Calculate the delta in model space
        const deltaOriginModelSpace = newOriginModel
          .clone()
          .sub(oldOriginModel);

        // Apply rotation correction if needed
        const rotationDegrees = yRotation || 0;
        const rotationRadians = (rotationDegrees * Math.PI) / 180;
        const cosTheta = Math.cos(rotationRadians);
        const sinTheta = Math.sin(rotationRadians);

        // Apply rotation to the delta
        const rotatedDelta = new THREE.Vector3(
          deltaOriginModelSpace.x * cosTheta +
            deltaOriginModelSpace.z * sinTheta,
          deltaOriginModelSpace.y,
          -deltaOriginModelSpace.x * sinTheta +
            deltaOriginModelSpace.z * cosTheta,
        );

        // Scale to real-world units
        const deltaRealWorldOffset = rotatedDelta.multiplyScalar(SCALE_FACTOR);

        console.log(
          `[AdjustAnchors] Delta RealWorld Offset (to subtract): ${deltaRealWorldOffset.toArray()}`,
        );

        const updateList = (list: any[] | undefined, type: string) => {
          if (!list || list.length === 0) {
            console.log(
              `[AdjustAnchors] No anchors of type "${type}" to adjust.`,
            );
            return;
          }
          console.log(
            `[AdjustAnchors] Processing ${list.length} anchors of type "${type}".`,
          );

          list.forEach((anchor) => {
            if (
              anchor.id === undefined ||
              anchor.x === undefined ||
              anchor.y === undefined ||
              anchor.z === undefined
            ) {
              console.warn(
                `[AdjustAnchors] Skipping ${type} anchor (ID: ${anchor.id || "unknown"}): missing id or coordinates.`,
              );
              return;
            }

            const currentRealWorldPos = new THREE.Vector3(
              Number(anchor.x),
              Number(anchor.y),
              Number(anchor.z),
            );

            // Subtract the delta to maintain the same physical position
            const newRealWorldPos = currentRealWorldPos
              .clone()
              .sub(deltaRealWorldOffset);

            console.log(`  Adjusting ${type} anchor ${anchor.id}:`);
            console.log(
              `    Old RealWorld XYZ: (${anchor.x}, ${anchor.y}, ${anchor.z})`,
            );
            console.log(
              `    New RealWorld XYZ: (${newRealWorldPos.x}, ${newRealWorldPos.y}, ${newRealWorldPos.z})`,
            );

            const payload = {
              x: newRealWorldPos.x,
              y: newRealWorldPos.y,
              z: newRealWorldPos.z,
              rotationX: Number(
                anchor.rotationX || (anchor.rotation && anchor.rotation.x) || 0,
              ),
              rotationY: Number(
                anchor.rotationY || (anchor.rotation && anchor.rotation.y) || 0,
              ),
              rotationZ: Number(
                anchor.rotationZ || (anchor.rotation && anchor.rotation.z) || 0,
              ),
              scaleX: Number(
                anchor.scaleX || (anchor.scale && anchor.scale.x) || 1,
              ),
              scaleY: Number(
                anchor.scaleY || (anchor.scale && anchor.scale.y) || 1,
              ),
              scaleZ: Number(
                anchor.scaleZ || (anchor.scale && anchor.scale.z) || 1,
              ),
            };

            updateAnchorTransform(anchor.id, payload);
          });
        };

        // Update all anchor types
        updateList(fileAnchors, "file");
        updateList(modelAnchors, "model");
        updateList(textAnchors, "text");
        updateList(webpageAnchors, "webpage");
        updateList(qrCodeAnchors, "qrCode");
      },
      [
        fileAnchors,
        modelAnchors,
        textAnchors,
        webpageAnchors,
        qrCodeAnchors,
        updateAnchorTransform,
        SCALE_FACTOR,
        yRotation, // Add yRotation as a dependency
      ],
    );

    // USE EFFECT FOR ORIGIN CHANGE
    useEffect(() => {
      const currentOrigin = originPoint; // The new origin from props
      const previousOrigin = previousOriginPointRef.current;

      console.log(
        "[Origin Change Effect] Current Origin (from prop):",
        currentOrigin ? currentOrigin.toArray() : null,
      );
      console.log(
        "[Origin Change Effect] Previous Origin (from ref):",
        previousOrigin ? previousOrigin.toArray() : null,
      );
      console.log(
        "[Origin Change Effect] Has initialized:",
        hasInitializedOriginRef.current,
      );

      // Handle initial load - don't adjust anchors on first mount
      if (!hasInitializedOriginRef.current && currentOrigin) {
        console.log(
          "[Origin Change Effect] Initial origin load - not adjusting anchors",
        );
        previousOriginPointRef.current = currentOrigin.clone();
        hasInitializedOriginRef.current = true;
        return;
      }

      // Handle origin changes after initialization
      if (
        currentOrigin &&
        previousOrigin &&
        !currentOrigin.equals(previousOrigin)
      ) {
        console.log(
          "[Origin Change Effect] Origin has changed. Calling adjustAnchorsForOriginChange.",
        );
        adjustAnchorsForOriginChange(previousOrigin, currentOrigin);
      } else if (!currentOrigin && previousOrigin) {
        console.log(
          "[Origin Change Effect] Origin has been cleared (set to null).",
        );
      }

      // Update the ref to the current originPoint prop for the next comparison
      previousOriginPointRef.current = currentOrigin
        ? currentOrigin.clone()
        : null;
    }, [originPoint, adjustAnchorsForOriginChange]);

    useEffect(() => {
      console.log("🔄 Origin update effect triggered", {
        hasScene: !!sceneRef.current,
        hasOriginNode: !!originNodeRef.current,
        originPoint: originPoint ? originPoint.toArray() : null,
      });

      // Only update if both scene and origin node exist
      if (!sceneRef.current || !originNodeRef.current) {
        console.log("⏳ Waiting for scene and origin node to be ready");
        return;
      }

      // Update the origin position
      if (originPoint) {
        originNodeRef.current.position.copy(originPoint);
        console.log(
          "✅ Updated origin node position to:",
          originNodeRef.current.position.toArray(),
        );
      } else {
        originNodeRef.current.position.set(0, 0, 0);
        console.log("✅ Reset origin node position to (0,0,0)");
      }

      // Update the visual marker
      updateOriginMarker(sceneRef.current, originNodeRef.current);
    }, [originPoint, yRotation]); // Keep dependencies the same

    // UPDATED: This function now creates a full gizmo (sphere + axes)
    // and attaches it to the main origin node.
    const updateOriginMarker = (
      scene: THREE.Scene,
      parentNode: THREE.Object3D,
    ) => {
      console.log("🔄 Origin useEffect triggered", {
        hasScene: !!sceneRef.current,
        originPoint: originPoint ? originPoint.toArray() : null,
        originOrientation: originOrientation ? "present" : "missing",
      });

      // Remove existing marker
      if (originMarkerRef.current) {
        if (originMarkerRef.current.parent === parentNode) {
          parentNode.remove(originMarkerRef.current);
        } else if (originMarkerRef.current.parent === sceneRef.current) {
          sceneRef.current?.remove(originMarkerRef.current);
        }
        originMarkerRef.current = null;
      }

      if (!originPoint) {
        console.log("❌ No originPoint, skipping marker creation");
        return;
      }

      console.log("✅ Creating origin marker with forward axis");

      const markerGroup = new THREE.Group();
      markerGroup.name = "originMarkerVisuals";

      // Center Sphere
      const sphereGeo = new THREE.SphereGeometry(0.03, 16, 16);
      const sphereMat = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        depthTest: false,
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.renderOrder = 999;
      markerGroup.add(sphere);

      const axisLength = 0.2;
      const headLength = 0.05;
      const headWidth = 0.02;

      // X-Axis (Red)
      const xAxis = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 0, 0),
        axisLength,
        0xff0000,
        headLength,
        headWidth,
      );

      // Y-Axis (Green)
      const yAxis = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 0),
        axisLength,
        0x00ff00,
        headLength,
        headWidth,
      );

      // Z-Axis (Forward) - SUPER VISIBLE
      const forwardAxis = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, 0),
        1.0, // Very long
        0xff00ff, // Bright magenta color
        0.2, // Big head
        0.08, // Wide head
      );

      // Make the forward axis materials ignore depth testing
      if (forwardAxis.line.material instanceof THREE.LineBasicMaterial) {
        forwardAxis.line.material.depthTest = false;
        forwardAxis.line.material.transparent = true;
        forwardAxis.line.material.opacity = 1.0;
      }
      if (forwardAxis.cone.material instanceof THREE.MeshBasicMaterial) {
        forwardAxis.cone.material.depthTest = false;
        forwardAxis.cone.material.transparent = true;
        forwardAxis.cone.material.opacity = 1.0;
      }

      // Set render orders
      xAxis.renderOrder = 999;
      yAxis.renderOrder = 999;
      forwardAxis.renderOrder = 10000; // Highest priority

      // Set depth test for X and Y axes
      if (xAxis.line.material instanceof THREE.LineBasicMaterial) {
        xAxis.line.material.depthTest = false;
        (xAxis.cone.material as THREE.MeshBasicMaterial).depthTest = false;
      }
      if (yAxis.line.material instanceof THREE.LineBasicMaterial) {
        yAxis.line.material.depthTest = false;
        (yAxis.cone.material as THREE.MeshBasicMaterial).depthTest = false;
      }

      // Add all axes to the group
      markerGroup.add(xAxis, yAxis, forwardAxis);

      console.log("🚀 Added super-visible forward axis");

      // Store and attach the marker
      originMarkerRef.current = markerGroup;
      parentNode.add(markerGroup);
    };

    // In ThreeViewer.tsx, find the configureTransformControls function
    const configureTransformControls = (
      transformControls: TransformControls,
    ) => {
      // Make the transform controls larger so it’s easy to see
      transformControls.setSize(1.8); // Increase if you want even bigger
      transformControls.setSpace("world");

      // Snap increments if desired
      transformControls.setTranslationSnap(0.05);
      transformControls.setRotationSnap(THREE.MathUtils.degToRad(5));
      transformControls.setScaleSnap(0.05);
    };

    useEffect(() => {
      // --- Visibility Check ---
      if (!showQrCodes) {
        // If hidden, remove all existing QR markers and clear the map
        qrCodeMarkersRef.current.forEach((marker, id) => {
          sceneRef.current!.remove(marker);
        });
        qrCodeMarkersRef.current.clear();
        console.log(
          "[ThreeViewer QR Effect] All QR Code markers removed due to visibility toggle.",
        );
        return; // Exit early
      }
      // --- End Visibility Check ---

      // If no anchors are passed (or an empty array), remove any existing QR markers.
      if (!qrCodeAnchors || qrCodeAnchors.length === 0) {
        // Loop through your stored markers and remove them from the scene.
        qrCodeMarkersRef.current.forEach((marker, id) => {
          sceneRef.current!.remove(marker);
        });
        // Clear the markers map.
        qrCodeMarkersRef.current.clear();
        console.log("[ThreeViewer QR Effect] All QR Code markers removed.");
        return;
      }

      console.log(
        `%c[ThreeViewer qrCodeAnchors Effect] START - Processing ${qrCodeAnchors.length} anchors`,
        "color: purple; font-weight: bold;",
      );

      const currentAnchorIds = new Set(qrCodeAnchors.map((a) => a.id));

      // --- Create or update markers ---
      qrCodeAnchors.forEach((anchor) => {
        if (qrCodeMarkersRef.current.has(anchor.id)) {
          return;
        }

        console.log(
          `[ThreeViewer qrCodeAnchors] Creating marker for Anchor ID: ${anchor.id}`,
        );

        // UPDATED: Use consistent coordinate conversion
        const realWorldPos = new THREE.Vector3(
          Number(anchor.x || 0),
          Number(anchor.y || 0),
          Number(anchor.z || 0),
        );

        const worldPosition = convertFromRealWorldCoords(realWorldPos);

        console.log(
          `[ThreeViewer qrCodeAnchors] Calculated worldPosition for ${anchor.id}:`,
          worldPosition,
        );

        // --- Create a marker mesh ---
        const markerGeometry = new THREE.SphereGeometry(0.025, 16, 16);
        const markerMaterial = new THREE.MeshBasicMaterial({
          color: 0xffa500,
          depthTest: false,
          transparent: true,
          opacity: 0.9,
        });
        const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
        markerMesh.position.copy(worldPosition);
        markerMesh.renderOrder = 9999;
        markerMesh.userData.anchorId = anchor.id;
        markerMesh.userData.type = "qrCode";

        sceneRef.current!.add(markerMesh);
        qrCodeMarkersRef.current.set(anchor.id, markerMesh);
      });

      // --- Cleanup Removed Markers ---
      qrCodeMarkersRef.current.forEach((marker, id) => {
        if (!currentAnchorIds.has(id)) {
          console.log(
            `[ThreeViewer qrCodeAnchors] Removing marker for removed anchor ${id}`,
          );
          sceneRef.current!.remove(marker);
          qrCodeMarkersRef.current.delete(id);
        }
      });

      console.log(
        `%c[ThreeViewer qrCodeAnchors Effect] END`,
        "color: purple; font-weight: bold;",
      );
    }, [qrCodeAnchors, originPoint, yRotation, sceneRef.current, showQrCodes]);

    // Then, in a useEffect:
    useEffect(() => {
      if (!transformControlsRef.current || !sceneRef.current) return;

      requestAnimationFrame(() => {
        const transformControls = transformControlsRef.current;
        if (!transformControls || !transformControls.children?.length) return;

        // Access the main gizmo group
        const gizmo = transformControls.children[0] as THREE.Object3D;

        gizmo.traverse((child: THREE.Object3D) => {
          // For each axis part, apply a bright color
          if (child instanceof THREE.Mesh) {
            // Red for X axis
            if (child.name.includes("X")) {
              child.material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            }
            // Green for Y axis
            if (child.name.includes("Y")) {
              child.material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            }
            // Blue for Z axis
            if (child.name.includes("Z")) {
              child.material = new THREE.MeshBasicMaterial({ color: 0x0000ff });
            }
          }
        });
      });
    }, [transformControlsRef.current, sceneRef.current]);

    // Add effect to handle selected area changes
    useEffect(() => {
      if (!sceneRef.current || !markedAreas || !selectedArea) {
        // If no area is selected, remove any existing highlight
        if (highlightedAreaMeshRef.current && sceneRef.current) {
          sceneRef.current?.remove(highlightedAreaMeshRef.current);
          highlightedAreaMeshRef.current = null;
        }
        return;
      }

      // Find the selected area in the markedAreas array
      const area = markedAreas.find((a) => a.id === selectedArea);
      if (!area) return;

      // Remove any existing highlight
      if (highlightedAreaMeshRef.current) {
        sceneRef.current?.remove(highlightedAreaMeshRef.current);
        highlightedAreaMeshRef.current = null;
      }

      // Create a box to represent the area
      const min = new THREE.Vector3(area.min.x, area.min.y, area.min.z);
      const max = new THREE.Vector3(area.max.x, area.max.y, area.max.z);
      const box = new THREE.Box3(min, max);

      // Get the size and center of the box
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Create a mesh to represent the highlighted area
      const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
      const material = new THREE.MeshBasicMaterial({
        color: 0x4f46e5, // Indigo color
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      });

      const highlightMesh = new THREE.Mesh(geometry, material);
      highlightMesh.position.copy(center);
      highlightMesh.renderOrder = 10000; // Ensure it renders on top

      // Add to scene
      sceneRef.current?.add(highlightMesh);
      highlightedAreaMeshRef.current = highlightMesh;

      // Add a pulse animation effect
      const pulseAnimation = () => {
        if (!highlightedAreaMeshRef.current) return;

        const time = Date.now() * 0.001;
        const opacity = 0.2 + Math.sin(time * 2) * 0.1;

        if (highlightedAreaMeshRef.current.material) {
          (
            highlightedAreaMeshRef.current.material as THREE.MeshBasicMaterial
          ).opacity = opacity;
        }

        requestAnimationFrame(pulseAnimation);
      };

      pulseAnimation();
    }, [selectedArea, markedAreas]);

    useEffect(() => {
      placementModeRef.current = placementMode;
    }, [placementMode]);

    useEffect(() => {
      if (orbitControlsRef.current) {
        orbitControlsRef.current.enabled = !isMarkingArea && !isMarkingPoint;
      }
    }, [isMarkingArea, isMarkingPoint]);

    // Add this useEffect after your other transform-related effects
    useEffect(() => {
      if (!transformControlsRef.current || !sceneRef.current) return;

      // Wait for the next frame to ensure the transform controls are fully initialized
      requestAnimationFrame(() => {
        const transformControls = transformControlsRef.current;
        if (
          !transformControls ||
          !transformControls.children ||
          transformControls.children.length === 0
        )
          return;

        // Now we can safely access the gizmo
        const gizmo = transformControls.children[0] as THREE.Object3D;
        if (gizmo) {
          gizmo.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh) {
              // Red for X axis
              if (child.name.includes("X")) {
                child.material = new THREE.MeshBasicMaterial({
                  color: 0xff0000,
                });
              }
              // Green for Y axis
              if (child.name.includes("Y")) {
                child.material = new THREE.MeshBasicMaterial({
                  color: 0x00ff00,
                });
              }
              // Blue for Z axis
              if (child.name.includes("Z")) {
                child.material = new THREE.MeshBasicMaterial({
                  color: 0x0000ff,
                });
              }
            }
          });
        }
      });
    }, [transformControlsRef.current, sceneRef.current]);

    // Setup transform controls event listeners
    useEffect(() => {
      if (!transformControlsRef.current) return;

      const transformControls = transformControlsRef.current;

      // Start of dragging - disable orbit controls
      const handleMouseDown = () => {
        if (orbitControlsRef.current) {
          orbitControlsRef.current.enabled = false;
        }
      };

      // End of dragging - re-enable orbit controls
      const handleMouseUp = () => {
        if (orbitControlsRef.current) {
          orbitControlsRef.current.enabled = true;
        }
      };

      transformControls.addEventListener("mouseDown", handleMouseDown);
      transformControls.addEventListener("mouseUp", handleMouseUp);

      return () => {
        transformControls.removeEventListener("mouseDown", handleMouseDown);
        transformControls.removeEventListener("mouseUp", handleMouseUp);
      };
    }, [transformControlsRef.current]);

    // The useEffect that calls updateOriginMarker is already updated in the previous step
    // to pass originNodeRef.current and depends on originPoint and originOrientation.
    // No change needed for the calling useEffect here.

    // Inside ThreeViewer component

    // Inside ThreeViewer component

    useEffect(() => {
      if (!sceneRef.current || !fileAnchors || !cameraRef.current) return;

      // --- Visibility Check ---
      if (!showFileAnchors) {
        fileAnchorsRef.current.forEach((object, id) => {
          console.log(
            `[ThreeViewer File Effect] Removing file anchor ${id} due to visibility toggle.`,
          );
          if (
            object.userData.type === "file-video" &&
            object.userData.videoElement
          ) {
            object.userData.videoElement.pause();
            object.userData.videoElement.src = "";
          }
          sceneRef.current?.remove(object); // Remove visual object
          // Remove associated label if it exists
          const labelToRemove = sceneRef.current?.children.find(
            (child) =>
              child.userData.isLabel === true && child.userData.anchorId === id,
          );
          if (labelToRemove) {
            sceneRef.current?.remove(labelToRemove);
          }
          // Remove helper mesh if it exists
          if (object.userData.helperMesh && sceneRef.current) {
            sceneRef.current?.remove(object.userData.helperMesh);
          }
        });
        fileAnchorsRef.current.clear();
        console.log(
          "[ThreeViewer File Effect] All File anchors removed due to visibility toggle.",
        );
        return; // Exit early
      }
      // --- End Visibility Check ---

      console.log(
        `%c[ThreeViewer fileAnchors Effect] START - Processing ${fileAnchors.length} anchors`,
        "color: blue; font-weight: bold;",
        fileAnchors,
      );

      const currentAnchorIds = new Set(fileAnchors.map((a) => a.id));

      fileAnchors.forEach((anchor) => {
        if (fileAnchorsRef.current.has(anchor.id)) {
          return; // Already exists
        }

        console.log(
          `[ThreeViewer fileAnchors] Processing Anchor ID: ${anchor.id}, Type: ${anchor.fileType}, Name: ${anchor.fileName}, URL: ${anchor.fileUrl}`,
        );

        // --- 1. Calculate Position (NEW LOGIC) ---
        // Convert real-world coordinates back to model space
        const realWorldPos = new THREE.Vector3(
          Number(anchor.x || 0),
          Number(anchor.y || 0),
          Number(anchor.z || 0),
        );

        const worldPosition = convertFromRealWorldCoords(realWorldPos);

        console.log(
          `[ThreeViewer fileAnchors] Calculated worldPosition for ${anchor.id}:`,
          worldPosition.toArray(),
        );

        const fileNameLower = anchor.fileName?.toLowerCase() || "";
        let determinedFileType = anchor.fileType;

        if (!determinedFileType) {
          if (fileNameLower.endsWith(".pdf")) determinedFileType = "pdf";
          else if (fileNameLower.endsWith(".docx")) determinedFileType = "docx";
          else if (fileNameLower.endsWith(".doc"))
            determinedFileType = "docx"; // Treat .doc as docx for icon
          else if (fileNameLower.endsWith(".pptx")) determinedFileType = "pptx";
          else if (fileNameLower.endsWith(".ppt"))
            determinedFileType = "pptx"; // Treat .ppt as pptx for icon
          else if (
            fileNameLower.endsWith(".jpg") ||
            fileNameLower.endsWith(".jpeg") ||
            fileNameLower.endsWith(".png") ||
            fileNameLower.endsWith(".gif") ||
            fileNameLower.endsWith(".webp")
          )
            determinedFileType = "image";
          else if (
            fileNameLower.endsWith(".mp4") ||
            fileNameLower.endsWith(".mov") ||
            fileNameLower.endsWith(".webm")
          )
            determinedFileType = "video";
          else if (
            fileNameLower.endsWith(".mp3") ||
            fileNameLower.endsWith(".wav") ||
            fileNameLower.endsWith(".ogg")
          )
            determinedFileType = "audio";
        }

        // --- 2. Create Visual based on fileType ---
        let anchorObject: THREE.Object3D | null = null;

        // --- Handle Media Types ---
        if (determinedFileType === "image") {
          console.log(
            `[ThreeViewer fileAnchors] Attempting to create image plane for ${anchor.id} (${anchor.fileName}) using Backblaze URL`,
          );
          const img = new Image();
          img.crossOrigin = "Anonymous";

          img.onload = () => {
            console.log(
              `%c[ThreeViewer fileAnchors] img.onload FIRED for ${anchor.id}. Image dimensions: ${img.width}x${img.height}`,
              "color: green;",
            );
            if (img.width === 0 || img.height === 0) {
              console.error(
                `[ThreeViewer fileAnchors] Image ${anchor.id} loaded but has zero dimensions! URL: ${img.src}`,
              );
              return;
            }
            try {
              let aspect;
              if (
                anchor.width &&
                anchor.height &&
                anchor.width > 0 &&
                anchor.height > 0
              ) {
                aspect = anchor.width / anchor.height;
                console.log(
                  `[ThreeViewer fileAnchors Image] Using dimensions from anchor data for ${anchor.id}: ${anchor.width}x${anchor.height}, Aspect: ${aspect}`,
                );
              } else {
                aspect = img.width / img.height;
                console.log(
                  `[ThreeViewer fileAnchors Image] Using dimensions from loaded image for ${anchor.id}: ${img.width}x${img.height}, Aspect: ${aspect}`,
                );
              }
              const planeWidth = 0.075; // Or some other default visual size
              const planeHeight = planeWidth / aspect;
              const canvas = document.createElement("canvas");
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext("2d");

              // 2) Define your corner radius in pixels
              const desiredRadius = 110; // Increased for more pronounced rounding
              // Ensure radius is not larger than half the canvas dimensions
              const r = Math.min(
                desiredRadius,
                canvas.width / 2,
                canvas.height / 2,
              );

              // 3) Build a rounded‐rect clipping path using the calculated radius 'r'
              if (ctx) {
                ctx.beginPath();
                ctx.moveTo(r, 0);
                ctx.lineTo(canvas.width - r, 0);
                ctx.quadraticCurveTo(canvas.width, 0, canvas.width, r);
                ctx.lineTo(canvas.width, canvas.height - r);
                ctx.quadraticCurveTo(
                  canvas.width,
                  canvas.height,
                  canvas.width - r,
                  canvas.height,
                );
                ctx.lineTo(r, canvas.height);
                ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - r);
                ctx.lineTo(0, r);
                ctx.quadraticCurveTo(0, 0, r, 0);
                ctx.closePath();
                ctx.clip();

                // 4) Draw the image into the clipped area
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              }

              // 5) Use the canvas as your texture
              const texture = new THREE.CanvasTexture(canvas);
              texture.needsUpdate = true;
              texture.colorSpace = THREE.SRGBColorSpace;

              const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
                transparent: true,
                depthWrite: false,
                alphaTest: 0.1,
              });

              // 6) Same PlaneGeometry—UVs stay perfect
              const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
              const imagePlane = new THREE.Mesh(geometry, material);

              imagePlane.position.copy(worldPosition); // Use worldPosition

              imagePlane.userData.anchorId = anchor.id;
              imagePlane.userData.type = "file-image";

              sceneRef.current!.add(imagePlane);
              console.log(
                `%c[ThreeViewer fileAnchors] Successfully ADDED imagePlane mesh to scene for ${anchor.id}`,
                "color: green;",
              );
              fileAnchorsRef.current.set(anchor.id, imagePlane);

              // --- ADD HELPER MESH FOR IMAGE ANCHOR ---
              const helperGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.01); // Small invisible box
              const helperMaterial = new THREE.MeshBasicMaterial({
                visible: false,
                depthTest: false, // Optional: helps with raycasting consistency
                transparent: true,
                opacity: 0,
              });
              const helperMesh = new THREE.Mesh(helperGeometry, helperMaterial);

              // Position helper exactly where the image plane is
              helperMesh.position.copy(imagePlane.position);
              helperMesh.rotation.copy(imagePlane.rotation); // Match rotation

              // Link helper and visual object using userData
              imagePlane.userData.helperMesh = helperMesh; // Link visual -> helper
              helperMesh.userData.visualObject = imagePlane; // Link helper -> visual
              helperMesh.userData.anchorId = anchor.id; // Store anchor ID on helper
              helperMesh.userData.type = "file-helper"; // Identify helper type

              // Add helper to the main WebGL scene
              sceneRef.current!.add(helperMesh);
              console.log(
                `[ThreeViewer fileAnchors] Added helper mesh for image anchor ${anchor.id}`,
              );
              // --- END HELPER MESH ADDITION ---
            } catch (loadError) {
              console.error(
                `[ThreeViewer fileAnchors] Error creating image texture/mesh inside onload for ${anchor.id} (${anchor.fileName}):`,
                loadError,
              );
            }
          };
          img.onerror = (errEvent) => {
            console.error(
              `%c[ThreeViewer fileAnchors] img.onerror FIRED for anchor ${anchor.id} (${anchor.fileName}). URL: ${img.src}. Check Network tab for details (CORS?). Error event:`,
              "color: red; font-weight: bold;",
              errEvent,
            );
          };

          // Use hardcoded Backblaze URL for images
          let imageUrl =
            // anchor.fileUrl ||
            "https://f005.backblazeb2.com/file/uploadedFiles-dev/083B81B6-F5EB-4AF3-B491-1DE40976280F_Asset0017.jpg"; // Fallback only if fileUrl is missing

          // Decode HTML entities in the URL (fixes &amp; to &)
          imageUrl = imageUrl.replace(/&amp;/g, "&");

          console.log(
            `[ThreeViewer fileAnchors] Setting img.src for ${anchor.id} to: ${imageUrl}`,
          );
          img.src = imageUrl;
        } else if (
          determinedFileType === "audio" || // ← Firestore flag
          anchor.fileName?.toLowerCase().endsWith(".mp3") // ← fallback detection
        ) {
          /* ---------- AUDIO PREVIEW ---------- */
          // 1.  build a tiny audio player UI (CSS3D)
          const wrapper = document.createElement("div");
          wrapper.style.pointerEvents = "auto";
          Object.assign(wrapper.style, {
            padding: "10px 14px",
            fontSize: "14px",
            color: "#fff",
            background: "rgba(120,120,130,0.82)",
            borderRadius: "12px",
            maxWidth: "180px", // Keep this
            display: "flex",
            alignItems: "center",
            gap: "8px",
            backdropFilter: "blur(10px)",
            boxShadow: "0 4px 10px rgba(0,0,0,.20)",
            border: "1px solid rgba(255,255,255,.10)",
            fontFamily:
              "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
            boxSizing: "border-box", // Keep this
          });

          // ▸ / ❚❚  toggle button
          const btn = document.createElement("button");
          btn.textContent = "►";
          Object.assign(btn.style, {
            width: "22px",
            height: "22px",
            borderRadius: "50%",
            border: "none",
            background: "#4f46e5",
            color: "#fff",
            cursor: "pointer",
            flexShrink: "0", // Keep this: Prevent button from shrinking
          });
          wrapper.appendChild(btn);

          // file label
          const label = document.createElement("span");
          label.textContent = anchor.fileName || "audio.mp3";

          // Calculated width for the label:
          // Wrapper content box width = 180px (wrapper.maxWidth) - 28px (wrapper L/R padding) = 152px
          // Space taken by button + gap = 22px (button.width) + 8px (gap) = 30px
          // Available width for label = 152px - 30px = 122px
          const labelAvailableWidth = "162px";

          Object.assign(label.style, {
            display: "block", // ADDED: Treat as a block for width/overflow
            width: labelAvailableWidth, // MODIFIED: Set explicit width
            // maxWidth: labelAvailableWidth, // Redundant if width is set, but harmless
            minWidth: "0", // Keep this: Crucial for allowing shrinkage for ellipsis
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          });
          wrapper.appendChild(label);

          // 2.  create the Audio element (kept off‑screen)
          const audioEl = new Audio(anchor.fileUrl);
          audioEl.preload = "auto";
          // Use a property rather than userData which doesn't exist on HTMLDivElement
          (wrapper as any).audioEl = audioEl; // stash a ref for later

          // 3.  play / pause logic
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (audioEl.paused) {
              audioEl.play();
              btn.textContent = "❚❚";
            } else {
              audioEl.pause();
              btn.textContent = "►";
            }
          });

          // 4.  turn the wrapper into a CSS3DObject
          const cssObj = new CSS3DObject(wrapper);
          // cssObj.scale.set(0.0015, 0.0015, 0.0015);
          cssObj.scale.set(0.001, 0.001, 0.001); // same size as textAnchor
          cssObj.position.copy(worldPosition); // Use worldPosition
          cssObj.userData.anchorId = anchor.id;
          cssObj.userData.type = "file-audio";

          // 5.  helper mesh (for transforms / selection)
          const helperGeo = new THREE.BoxGeometry(0.01, 0.01, 0.01);
          const helperMat = new THREE.MeshBasicMaterial({ visible: false });
          const helperMesh = new THREE.Mesh(helperGeo, helperMat);
          helperMesh.position.copy(cssObj.position);
          helperMesh.userData.visualObject = cssObj;
          helperMesh.userData.anchorId = anchor.id;
          helperMesh.userData.type = "file-helper";
          cssObj.userData.helperMesh = helperMesh;

          // 6.  click‑through → choose + open side‑panel
          wrapper.addEventListener("pointerdown", (ev) => {
            ev.stopPropagation();
            ev.preventDefault(); // <<<< ADD THIS LINE
            if (onFileAnchorClick) {
              const data = fileAnchors?.find((a) => a.id === anchor.id);
              if (data) onFileAnchorClick(anchor.id, data);
            }
            handleAnchorSelect(anchor.id, helperMesh, "file");
          });

          sceneRef.current!.add(cssObj);
          sceneRef.current!.add(helperMesh);
          fileAnchorsRef.current.set(anchor.id, cssObj);
          /* ---------- END AUDIO PREVIEW ---------- */
        } else if (determinedFileType === "video") {
          console.log(
            `[ThreeViewer fileAnchors] Attempting to create video plane for ${anchor.id} (${anchor.fileName}) using Backblaze URL`,
          );
          const video = document.createElement("video");
          video.crossOrigin = "Anonymous";
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          video.preload = "auto";

          video.onloadeddata = () => {
            console.log(
              `%c[ThreeViewer fileAnchors] video.onloadeddata FIRED for ${anchor.id}. Video dimensions: ${video.videoWidth}x${video.videoHeight}`,
              "color: green;",
            );
            if (video.videoWidth === 0 || video.videoHeight === 0) {
              console.error(
                `[ThreeViewer fileAnchors] Video ${anchor.id} loaded but has zero dimensions! URL: ${video.src}`,
              );
              return;
            }
            try {
              let aspect;
              if (
                anchor.width &&
                anchor.height &&
                anchor.width > 0 &&
                anchor.height > 0
              ) {
                aspect = anchor.width / anchor.height;
                console.log(
                  `[ThreeViewer fileAnchors Video] Using dimensions from anchor data for ${anchor.id}: ${anchor.width}x${anchor.height}, Aspect: ${aspect}`,
                );
              } else {
                aspect = video.videoWidth / video.videoHeight;
                console.log(
                  `[ThreeViewer fileAnchors Video] Using dimensions from loaded video for ${anchor.id}: ${video.videoWidth}x${video.videoHeight}, Aspect: ${aspect}`,
                );
              }
              const planeWidth = 0.125; // Or some other default visual size
              const planeHeight = planeWidth / aspect;

              const videoTexture = new THREE.VideoTexture(video);
              videoTexture.needsUpdate = true; // VideoTexture itself handles frame updates
              videoTexture.colorSpace = THREE.SRGBColorSpace;

              // --- Create Alpha Map for Rounded Corners ---
              const alphaCanvas = document.createElement("canvas");
              alphaCanvas.width = video.videoWidth; // Match video dimensions for UV alignment
              alphaCanvas.height = video.videoHeight;
              const alphaCtx = alphaCanvas.getContext("2d");

              if (alphaCtx) {
                const desiredRadiusVideo = 70; // Desired radius in pixels of the source video
                // Ensure radius is not larger than half the canvas dimensions
                const rVideo = Math.min(
                  desiredRadiusVideo,
                  alphaCanvas.width / 2,
                  alphaCanvas.height / 2,
                );

                // Fill canvas with black (this will be the transparent parts)
                alphaCtx.fillStyle = "black";
                alphaCtx.fillRect(0, 0, alphaCanvas.width, alphaCanvas.height);

                // Draw a white rounded rectangle (this will be the opaque parts)
                alphaCtx.fillStyle = "white";
                alphaCtx.beginPath();
                alphaCtx.moveTo(rVideo, 0);
                alphaCtx.lineTo(alphaCanvas.width - rVideo, 0);
                alphaCtx.quadraticCurveTo(
                  alphaCanvas.width,
                  0,
                  alphaCanvas.width,
                  rVideo,
                );
                alphaCtx.lineTo(alphaCanvas.width, alphaCanvas.height - rVideo);
                alphaCtx.quadraticCurveTo(
                  alphaCanvas.width,
                  alphaCanvas.height,
                  alphaCanvas.width - rVideo,
                  alphaCanvas.height,
                );
                alphaCtx.lineTo(rVideo, alphaCanvas.height);
                alphaCtx.quadraticCurveTo(
                  0,
                  alphaCanvas.height,
                  0,
                  alphaCanvas.height - rVideo,
                );
                alphaCtx.lineTo(0, rVideo);
                alphaCtx.quadraticCurveTo(0, 0, rVideo, 0);
                alphaCtx.closePath();
                alphaCtx.fill();
              } else {
                console.error(
                  "[ThreeViewer fileAnchors] Could not get 2D context for video alphaMap canvas",
                );
              }

              const roundedRectAlphaTexture = new THREE.CanvasTexture(
                alphaCanvas,
              );
              roundedRectAlphaTexture.needsUpdate = true; // Update once after drawing
              // Alpha map doesn't need SRGB, it's grayscale data.
              // roundedRectAlphaTexture.colorSpace = THREE.SRGBColorSpace; // Not needed for alphaMap

              const material = new THREE.MeshBasicMaterial({
                map: videoTexture,
                alphaMap: roundedRectAlphaTexture, // Apply the alpha map
                transparent: true, // IMPORTANT: Material must be transparent for alphaMap
                side: THREE.DoubleSide,
                toneMapped: false, // Keep existing property
                depthWrite: false, // Keep existing property
                depthTest: false, // Keep existing property
              });
              const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight); // Geometry remains the same
              const videoPlane = new THREE.Mesh(geometry, material);

              videoPlane.renderOrder = 1;

              videoPlane.position.copy(worldPosition); // Use worldPosition
              // videoPlane.lookAt(cameraRef.current!.position);
              videoPlane.userData.anchorId = anchor.id;
              videoPlane.userData.type = "file-video";
              videoPlane.userData.videoElement = video;

              sceneRef.current!.add(videoPlane);
              console.log(
                `%c[ThreeViewer fileAnchors] Successfully ADDED videoPlane mesh to scene for ${anchor.id}`,
                "color: green;",
              );
              fileAnchorsRef.current.set(anchor.id, videoPlane);

              video
                .play()
                .then(() =>
                  console.log(
                    `[ThreeViewer fileAnchors] Video ${anchor.id} playing.`,
                  ),
                )
                .catch((e) =>
                  console.warn(
                    `[ThreeViewer fileAnchors] Video ${anchor.id} autoplay prevented.`,
                    e,
                  ),
                );

              // --- ADD HELPER MESH FOR VIDEO ANCHOR ---
              const helperGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.01); // Small invisible box
              const helperMaterial = new THREE.MeshBasicMaterial({
                visible: false,
                depthTest: false, // Optional: helps with raycasting consistency
                transparent: true,
                opacity: 0,
              });
              const helperMesh = new THREE.Mesh(helperGeometry, helperMaterial);

              // Position helper exactly where the video plane is
              helperMesh.position.copy(videoPlane.position);
              helperMesh.rotation.copy(videoPlane.rotation); // Match rotation

              // Link helper and visual object using userData
              videoPlane.userData.helperMesh = helperMesh; // Link visual -> helper
              helperMesh.userData.visualObject = videoPlane; // Link helper -> visual
              helperMesh.userData.anchorId = anchor.id; // Store anchor ID on helper
              helperMesh.userData.type = "file-helper"; // Identify helper type

              // Add helper to the main WebGL scene
              sceneRef.current!.add(helperMesh);
              console.log(
                `[ThreeViewer fileAnchors] Added helper mesh for video anchor ${anchor.id}`,
              );
              // --- END HELPER MESH ADDITION ---
            } catch (loadError) {
              console.error(
                `[ThreeViewer fileAnchors] Error creating video texture/mesh inside onloadeddata for ${anchor.id} (${anchor.fileName}):`,
                loadError,
              );
            }
          };
          video.onerror = (errEvent) => {
            console.error(
              `%c[ThreeViewer fileAnchors] video.onerror FIRED for anchor ${anchor.id} (${anchor.fileName}). URL: ${video.src}. Check Network tab for details (CORS?). Error event:`,
              "color: red; font-weight: bold;",
              errEvent,
            );
          };

          // Use hardcoded Backblaze URL for videos
          const backblazeVideoUrl =
            "https://f005.backblazeb2.com/file/uploadedFiles-dev/24406E68-8FBD-4BAC-B773-E09EE0497599_Blueprint++In+Shared+Space+-+With+Explanations.mp4";
          console.log(
            `[ThreeViewer fileAnchors] Setting video.src for ${anchor.id} to Backblaze URL: ${backblazeVideoUrl}`,
          );
          video.src = backblazeVideoUrl;
        } else if (anchor.thumbnailUrl) {
          // If a thumbnail URL exists (even for PDFs/docs), treat it like an image
          console.log(
            `[ThreeViewer fileAnchors] Found thumbnailUrl for ${anchor.id} (${anchor.fileName}). Rendering as image preview. URL: ${anchor.thumbnailUrl}`,
          );
          const img = new Image();
          img.crossOrigin = "Anonymous"; // Important for textures from other origins

          img.onload = () => {
            console.log(`Thumbnail image loaded for ${anchor.id}`);
            try {
              const aspect = img.width / img.height;
              // Adjust size as needed for previews
              const planeWidth = 0.15;
              const planeHeight = planeWidth / aspect;
              const texture = new THREE.Texture(img);
              texture.needsUpdate = true;
              texture.colorSpace = THREE.SRGBColorSpace; // Use sRGB for color accuracy

              const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
                transparent: true, // Enable transparency if needed
                depthWrite: false, // Often good for overlay elements
              });
              const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
              const imagePlane = new THREE.Mesh(geometry, material);

              imagePlane.position.copy(worldPosition); // Use worldPosition
              // Optional: Make it face the camera slightly? Or keep it aligned with world axes?
              // imagePlane.lookAt(cameraRef.current!.position);

              imagePlane.userData.anchorId = anchor.id;
              // Distinguish preview type if needed
              imagePlane.userData.type = "file-preview";

              // Add click listener (similar to image anchors)
              imagePlane.addEventListener("pointerdown", (e) => {
                e.stopPropagation();
                const helper = imagePlane.userData.helperMesh as THREE.Mesh;
                const anchorId = imagePlane.userData.anchorId;
                const fileAnchorData = fileAnchors?.find(
                  (a) => a.id === anchorId,
                );

                if (onFileAnchorClick && fileAnchorData) {
                  onFileAnchorClick(anchorId, fileAnchorData);
                }
                if (helper) {
                  handleAnchorSelect(anchorId, helper, "file");
                } else {
                  handleAnchorSelect(anchorId, imagePlane, "file"); // Fallback
                }
              });

              sceneRef.current!.add(imagePlane);
              fileAnchorsRef.current.set(anchor.id, imagePlane);

              // Add helper mesh (reuse existing logic)
              const helperGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);
              const helperMaterial = new THREE.MeshBasicMaterial({
                visible: false,
                depthTest: false,
                transparent: true,
                opacity: 0,
              });
              const helperMesh = new THREE.Mesh(helperGeometry, helperMaterial);
              helperMesh.position.copy(imagePlane.position);
              helperMesh.rotation.copy(imagePlane.rotation);
              imagePlane.userData.helperMesh = helperMesh;
              helperMesh.userData.visualObject = imagePlane; // Changed from videoPlane to imagePlane
              helperMesh.userData.anchorId = anchor.id;
              helperMesh.userData.type = "file-helper";
              sceneRef.current!.add(helperMesh);
            } catch (loadError) {
              console.error(
                `Error creating thumbnail mesh for ${anchor.id}:`,
                loadError,
              );
              // Optionally add the blue box fallback here if mesh creation fails
            }
          };
          img.onerror = (errEvent) => {
            console.error(
              `Error loading thumbnail image for anchor ${anchor.id}. URL: ${img.src}`,
              errEvent,
            );
            // Optionally add the blue box fallback here on image load error
            // You might call a function createFallbackPlaceholder(anchor, modelSpacePosition);
          };
          img.src = anchor.thumbnailUrl; // Use the thumbnail URL from Firestore

          // --- Keep existing PDF iframe logic if fileType is explicitly "pdf" AND no thumbnail exists ---
        } else if (determinedFileType === "pdf") {
          // This implies !anchor.thumbnailUrl due to prior 'else if'
          console.log(
            `[ThreeViewer fileAnchors] Creating CSS3D PDF anchor for ${anchor.id}`,
          );

          const backgroundDiv = document.createElement("div");
          backgroundDiv.style.backgroundColor = "rgba(230, 230, 230, 0.85)"; // Light grey
          backgroundDiv.style.padding = "10px";
          backgroundDiv.style.borderRadius = "8px";
          backgroundDiv.style.boxShadow = "0 3px 7px rgba(0,0,0,0.2)";
          backgroundDiv.style.display = "flex";
          backgroundDiv.style.flexDirection = "column";
          backgroundDiv.style.alignItems = "center";
          backgroundDiv.style.justifyContent = "center";
          backgroundDiv.style.width = "100px"; // Adjust width as needed
          backgroundDiv.style.pointerEvents = "auto"; // Crucial for clicks
          backgroundDiv.style.fontFamily =
            "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif";
          backgroundDiv.style.boxSizing = "border-box";

          const iconImg = document.createElement("img");
          iconImg.src = PDF_THUMBNAIL_URL;
          iconImg.style.width = "40px";
          iconImg.style.height = "40px";
          iconImg.style.marginBottom = "8px";
          iconImg.style.objectFit = "contain";
          backgroundDiv.appendChild(iconImg);

          const textLabelDiv = document.createElement("div");
          textLabelDiv.textContent = anchor.fileName || "PDF Document";
          textLabelDiv.style.fontSize = "11px";
          textLabelDiv.style.color = "#333";
          textLabelDiv.style.textAlign = "center";
          textLabelDiv.style.maxWidth = "100%"; // Takes full width of padded backgroundDiv
          textLabelDiv.style.overflow = "hidden";
          textLabelDiv.style.textOverflow = "ellipsis";
          textLabelDiv.style.whiteSpace = "nowrap";
          textLabelDiv.style.wordBreak = "break-all";
          backgroundDiv.appendChild(textLabelDiv);

          const cssAnchorObject = new CSS3DObject(backgroundDiv);
          cssAnchorObject.position.copy(worldPosition); // Use worldPosition
          // cssAnchorObject.scale.set(0.0015, 0.0015, 0.0015); // Adjust scale if needed
          cssAnchorObject.scale.set(0.00075, 0.00075, 0.00075);
          cssAnchorObject.userData.anchorId = anchor.id;
          cssAnchorObject.userData.type = "file-pdf-css-anchor"; // New distinct type
          cssAnchorObject.userData.isCSS3DObject = true; // Explicitly mark
          cssAnchorObject.userData.element = backgroundDiv; // Store element ref

          const helperGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);
          const helperMaterial = new THREE.MeshBasicMaterial({
            visible: false,
            depthTest: false,
            transparent: true,
            opacity: 0,
          });
          const helperMesh = new THREE.Mesh(helperGeometry, helperMaterial);
          helperMesh.position.copy(cssAnchorObject.position);
          // Match helper rotation/scale to the CSS object if it's not billboarded
          // For now, assuming CSS object's orientation is managed or default is fine.
          // helperMesh.rotation.copy(cssAnchorObject.rotation);
          // helperMesh.scale.copy(cssAnchorObject.scale);

          cssAnchorObject.userData.helperMesh = helperMesh;
          helperMesh.userData.visualObject = cssAnchorObject;
          helperMesh.userData.anchorId = anchor.id;
          helperMesh.userData.type = "file-helper"; // Consistent helper type

          backgroundDiv.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            e.preventDefault();
            const currentAnchorId = cssAnchorObject.userData.anchorId; // Get ID from the object
            const fileAnchorData =
              fileAnchors?.find((a) => a.id === currentAnchorId) || anchor;

            console.log(`CSS3D PDF anchor clicked: ${currentAnchorId}`);

            if (onFileAnchorClick && fileAnchorData) {
              onFileAnchorClick(currentAnchorId, fileAnchorData);
            }
            // Ensure helperMesh is used for selection
            const actualHelperMesh = cssAnchorObject.userData
              .helperMesh as THREE.Mesh;
            if (actualHelperMesh) {
              handleAnchorSelect(currentAnchorId, actualHelperMesh, "file");
            } else {
              console.warn(
                `Helper mesh not found for CSS3D PDF anchor ${currentAnchorId}`,
              );
              handleAnchorSelect(currentAnchorId, cssAnchorObject, "file"); // Fallback
            }
          });

          sceneRef.current!.add(cssAnchorObject);
          sceneRef.current!.add(helperMesh);
          fileAnchorsRef.current.set(anchor.id, cssAnchorObject); // Store the CSS3DObject

          console.log(
            `%c[ThreeViewer fileAnchors] Added CSS3D PDF anchor for ${anchor.id}`,
            "color: darkcyan;",
          );
        }
        // --- END NEW LOGIC FOR PDF ICON ---

        // --- START NEW LOGIC FOR DOCX ICON ---
        else if (determinedFileType === "docx") {
          // This implies !anchor.thumbnailUrl
          console.log(
            `[ThreeViewer fileAnchors] Creating CSS3D DOCX anchor for ${anchor.id}`,
          );

          const backgroundDiv = document.createElement("div");
          backgroundDiv.style.backgroundColor = "rgba(230, 230, 230, 0.85)";
          backgroundDiv.style.padding = "10px";
          backgroundDiv.style.borderRadius = "8px";
          backgroundDiv.style.boxShadow = "0 3px 7px rgba(0,0,0,0.2)";
          backgroundDiv.style.display = "flex";
          backgroundDiv.style.flexDirection = "column";
          backgroundDiv.style.alignItems = "center";
          backgroundDiv.style.justifyContent = "center";
          backgroundDiv.style.width = "100px";
          backgroundDiv.style.pointerEvents = "auto";
          backgroundDiv.style.fontFamily =
            "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif";
          backgroundDiv.style.boxSizing = "border-box";

          const iconImg = document.createElement("img");
          iconImg.src = DOCX_THUMBNAIL_URL;
          iconImg.style.width = "40px";
          iconImg.style.height = "40px";
          iconImg.style.marginBottom = "8px";
          iconImg.style.objectFit = "contain";
          backgroundDiv.appendChild(iconImg);

          const textLabelDiv = document.createElement("div");
          textLabelDiv.textContent = anchor.fileName || "Word Document";
          textLabelDiv.style.fontSize = "11px";
          textLabelDiv.style.color = "#333";
          textLabelDiv.style.textAlign = "center";
          textLabelDiv.style.maxWidth = "100%";
          textLabelDiv.style.overflow = "hidden";
          textLabelDiv.style.textOverflow = "ellipsis";
          textLabelDiv.style.whiteSpace = "nowrap";
          textLabelDiv.style.wordBreak = "break-all";
          backgroundDiv.appendChild(textLabelDiv);

          const cssAnchorObject = new CSS3DObject(backgroundDiv);
          cssAnchorObject.position.copy(worldPosition); // Use worldPosition
          // cssAnchorObject.scale.set(0.0015, 0.0015, 0.0015);
          cssAnchorObject.scale.set(0.00075, 0.00075, 0.00075);
          cssAnchorObject.userData.anchorId = anchor.id;
          cssAnchorObject.userData.type = "file-docx-css-anchor";
          cssAnchorObject.userData.isCSS3DObject = true;
          cssAnchorObject.userData.element = backgroundDiv;

          const helperGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);
          const helperMaterial = new THREE.MeshBasicMaterial({
            visible: false,
            depthTest: false,
            transparent: true,
            opacity: 0,
          });
          const helperMesh = new THREE.Mesh(helperGeometry, helperMaterial);
          helperMesh.position.copy(cssAnchorObject.position);

          cssAnchorObject.userData.helperMesh = helperMesh;
          helperMesh.userData.visualObject = cssAnchorObject;
          helperMesh.userData.anchorId = anchor.id;
          helperMesh.userData.type = "file-helper";

          backgroundDiv.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            e.preventDefault();
            const currentAnchorId = cssAnchorObject.userData.anchorId;
            const fileAnchorData =
              fileAnchors?.find((a) => a.id === currentAnchorId) || anchor;

            console.log(`CSS3D DOCX anchor clicked: ${currentAnchorId}`);

            if (onFileAnchorClick && fileAnchorData) {
              onFileAnchorClick(currentAnchorId, fileAnchorData);
            }
            const actualHelperMesh = cssAnchorObject.userData
              .helperMesh as THREE.Mesh;
            if (actualHelperMesh) {
              handleAnchorSelect(currentAnchorId, actualHelperMesh, "file");
            } else {
              console.warn(
                `Helper mesh not found for CSS3D DOCX anchor ${currentAnchorId}`,
              );
              handleAnchorSelect(currentAnchorId, cssAnchorObject, "file"); // Fallback
            }
          });

          sceneRef.current!.add(cssAnchorObject);
          sceneRef.current!.add(helperMesh);
          fileAnchorsRef.current.set(anchor.id, cssAnchorObject);

          console.log(
            `%c[ThreeViewer fileAnchors] Added CSS3D DOCX anchor for ${anchor.id}`,
            "color: darkcyan;",
          );
        }
        // --- END NEW LOGIC FOR DOCX ICON ---

        // --- START NEW LOGIC FOR PPTX ICON ---
        else if (determinedFileType === "pptx") {
          // This implies !anchor.thumbnailUrl
          console.log(
            `[ThreeViewer fileAnchors] Creating CSS3D PPTX anchor for ${anchor.id}`,
          );

          const backgroundDiv = document.createElement("div");
          backgroundDiv.style.backgroundColor = "rgba(230, 230, 230, 0.85)";
          backgroundDiv.style.padding = "10px";
          backgroundDiv.style.borderRadius = "8px";
          backgroundDiv.style.boxShadow = "0 3px 7px rgba(0,0,0,0.2)";
          backgroundDiv.style.display = "flex";
          backgroundDiv.style.flexDirection = "column";
          backgroundDiv.style.alignItems = "center";
          backgroundDiv.style.justifyContent = "center";
          backgroundDiv.style.width = "100px";
          backgroundDiv.style.pointerEvents = "auto";
          backgroundDiv.style.fontFamily =
            "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif";
          backgroundDiv.style.boxSizing = "border-box";

          const iconImg = document.createElement("img");
          iconImg.src = PPTX_THUMBNAIL_URL;
          iconImg.style.width = "40px";
          iconImg.style.height = "40px";
          iconImg.style.marginBottom = "8px";
          iconImg.style.objectFit = "contain";
          backgroundDiv.appendChild(iconImg);

          const textLabelDiv = document.createElement("div");
          textLabelDiv.textContent = anchor.fileName || "PowerPoint Document";
          textLabelDiv.style.fontSize = "11px";
          textLabelDiv.style.color = "#333";
          textLabelDiv.style.textAlign = "center";
          textLabelDiv.style.maxWidth = "100%";
          textLabelDiv.style.overflow = "hidden";
          textLabelDiv.style.textOverflow = "ellipsis";
          textLabelDiv.style.whiteSpace = "nowrap";
          textLabelDiv.style.wordBreak = "break-all";
          backgroundDiv.appendChild(textLabelDiv);

          const cssAnchorObject = new CSS3DObject(backgroundDiv);
          cssAnchorObject.position.copy(worldPosition); // Use worldPosition
          // cssAnchorObject.scale.set(0.0015, 0.0015, 0.0015);
          cssAnchorObject.scale.set(0.00075, 0.00075, 0.00075);
          cssAnchorObject.userData.anchorId = anchor.id;
          cssAnchorObject.userData.type = "file-pptx-css-anchor";
          cssAnchorObject.userData.isCSS3DObject = true;
          cssAnchorObject.userData.element = backgroundDiv;

          const helperGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);
          const helperMaterial = new THREE.MeshBasicMaterial({
            visible: false,
            depthTest: false,
            transparent: true,
            opacity: 0,
          });
          const helperMesh = new THREE.Mesh(helperGeometry, helperMaterial);
          helperMesh.position.copy(cssAnchorObject.position);

          cssAnchorObject.userData.helperMesh = helperMesh;
          helperMesh.userData.visualObject = cssAnchorObject;
          helperMesh.userData.anchorId = anchor.id;
          helperMesh.userData.type = "file-helper";

          backgroundDiv.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            e.preventDefault();
            const currentAnchorId = cssAnchorObject.userData.anchorId;
            const fileAnchorData =
              fileAnchors?.find((a) => a.id === currentAnchorId) || anchor;

            console.log(`CSS3D PPTX anchor clicked: ${currentAnchorId}`);

            if (onFileAnchorClick && fileAnchorData) {
              onFileAnchorClick(currentAnchorId, fileAnchorData);
            }
            const actualHelperMesh = cssAnchorObject.userData
              .helperMesh as THREE.Mesh;
            if (actualHelperMesh) {
              handleAnchorSelect(currentAnchorId, actualHelperMesh, "file");
            } else {
              console.warn(
                `Helper mesh not found for CSS3D PPTX anchor ${currentAnchorId}`,
              );
              handleAnchorSelect(currentAnchorId, cssAnchorObject, "file"); // Fallback
            }
          });

          sceneRef.current!.add(cssAnchorObject);
          sceneRef.current!.add(helperMesh);
          fileAnchorsRef.current.set(anchor.id, cssAnchorObject);

          console.log(
            `%c[ThreeViewer fileAnchors] Added CSS3D PPTX anchor for ${anchor.id}`,
            "color: darkcyan;",
          );
        } else {
          console.log(
            `[ThreeViewer fileAnchors] Creating document placeholder for ${anchor.id} (${anchor.fileName})`,
          );
          const docGeometry = new THREE.BoxGeometry(0.15, 0.2, 0.02);
          const docMaterial = new THREE.MeshBasicMaterial({ color: 0x60a5fa });
          const docIcon = new THREE.Mesh(docGeometry, docMaterial);
          docIcon.position.copy(worldPosition); // Use worldPosition
          docIcon.userData.anchorId = anchor.id;
          docIcon.userData.type = "file-document";

          // --- ADD HELPER MESH FOR DOCUMENT ANCHOR ---
          const helperGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);
          const helperMaterial = new THREE.MeshBasicMaterial({
            visible: false,
            depthTest: false,
            transparent: true,
            opacity: 0,
          });
          const helperMesh = new THREE.Mesh(helperGeometry, helperMaterial);
          helperMesh.position.copy(docIcon.position);
          docIcon.userData.helperMesh = helperMesh;
          helperMesh.userData.anchorId = anchor.id;
          helperMesh.userData.type = "file-helper";
          sceneRef.current!.add(helperMesh);
          // --- END HELPER MESH ---

          // Modify pointerdown listener to select the helper mesh
          docIcon.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            const helper = docIcon.userData.helperMesh as THREE.Mesh;
            if (helper) {
              console.log(
                `Document placeholder clicked for ${anchor.id}, selecting helper mesh.`,
              );
              handleAnchorSelect(anchor.id, helper, "file");
            } else {
              console.warn(
                `Helper mesh not found for document anchor ${anchor.id}`,
              );
            }
            if (onFileAnchorClick) {
              onFileAnchorClick(anchor.id, anchor);
            }
          });

          sceneRef.current!.add(docIcon);
          anchorObject = docIcon;
          if (anchorObject) {
            fileAnchorsRef.current.set(anchor.id, anchorObject);
            console.log(
              `[ThreeViewer fileAnchors] Document placeholder added for ${anchor.id}`,
            );
          }
        }
      }); // <-- End of fileAnchors.forEach

      // --- Cleanup --- (Keep existing logic)
      fileAnchorsRef.current.forEach((object, id) => {
        if (!currentAnchorIds.has(id)) {
          console.log(
            `[ThreeViewer fileAnchors] Cleaning up visuals for anchor ${id}`,
          );
          if (
            object.userData.type === "file-video" &&
            object.userData.videoElement
          ) {
            object.userData.videoElement.pause();
            object.userData.videoElement.src = "";
          }
          sceneRef.current?.remove(object);
          const labelToRemove = sceneRef.current?.children.find(
            (child) =>
              child.userData.isLabel === true && child.userData.anchorId === id,
          );
          if (labelToRemove) {
            sceneRef.current?.remove(labelToRemove);
          }
          fileAnchorsRef.current.delete(id);
        }
      });

      console.log(
        `%c[ThreeViewer fileAnchors Effect] END`,
        "color: blue; font-weight: bold;",
      );
    }, [
      fileAnchors,
      originPoint,
      yRotation,
      cameraRef.current,
      showFileAnchors,
    ]);

    useEffect(() => {
      if (!sceneRef.current || !modelAnchors) return;

      // --- Visibility Check ---
      if (!showModelAnchors) {
        anchorModelsRef.current.forEach((modelObject, id) => {
          console.log(
            `[ThreeViewer Model Effect] Removing model anchor ${id} due to visibility toggle.`,
          );
          if (sceneRef.current) {
            sceneRef.current?.remove(modelObject);
            // Remove associated label if it exists
            const labelToRemove = sceneRef.current.children.find(
              (child) =>
                child &&
                child.userData &&
                child.userData.isCSS3DObject &&
                child.userData.anchorId === id,
            );
            if (labelToRemove) {
              sceneRef.current?.remove(labelToRemove);
            }
          }
        });
        anchorModelsRef.current.clear();
        console.log(
          "[ThreeViewer Model Effect] All Model anchors removed due to visibility toggle.",
        );
        return; // Exit early
      }
      // --- End Visibility Check ---

      modelAnchors.forEach((anchor) => {
        if (anchorModelsRef.current.has(anchor.id)) return;

        // UPDATED: Use consistent coordinate conversion
        const realWorldPos = new THREE.Vector3(
          Number(anchor.x || 0),
          Number(anchor.y || 0),
          Number(anchor.z || 0),
        );

        const worldPosition = convertFromRealWorldCoords(realWorldPos);

        console.log("Adding model for anchor", anchor.id, "at", worldPosition);

        // --- LOAD 3D MODEL INSTEAD OF CREATING ORANGE DOT ---
        const modelUrl =
          "https://f005.backblazeb2.com/file/objectModels-dev/Mona_Lisa_PBR_hires_model.glb";

        // Create temporary marker while model loads
        const tempMarkerGeometry = new THREE.SphereGeometry(0.02, 16, 16);
        const tempMarkerMaterial = new THREE.MeshBasicMaterial({
          color: 0xff8c00,
          transparent: true,
          opacity: 0.5,
        });
        const tempMarker = new THREE.Mesh(
          tempMarkerGeometry,
          tempMarkerMaterial,
        );
        tempMarker.position.copy(worldPosition);
        sceneRef.current?.add(tempMarker);
        // Load the actual model
        loadModelWithFallback(modelUrl)
          .then((model) => {
            // Calculate bounding box for scaling
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);

            // Base scale factor (if not already in the anchor)
            const baseFactor = 0.1 / maxDim;

            // Check if anchor has rotation and scale data
            if (
              anchor.rotationX !== undefined &&
              anchor.rotationY !== undefined &&
              anchor.rotationZ !== undefined
            ) {
              model.rotation.set(
                Number(anchor.rotationX),
                Number(anchor.rotationY),
                Number(anchor.rotationZ),
              );
            }

            if (
              anchor.scaleX !== undefined &&
              anchor.scaleY !== undefined &&
              anchor.scaleZ !== undefined
            ) {
              model.scale.set(
                Number(anchor.scaleX) * baseFactor,
                Number(anchor.scaleY) * baseFactor,
                Number(anchor.scaleZ) * baseFactor,
              );
            } else {
              // Use default scaling if not specified
              model.scale.multiplyScalar(baseFactor);
            }

            // Position the model at the anchor position
            model.position.copy(worldPosition);

            // Add the model to the scene
            sceneRef.current?.add(model);

            // Remove temporary marker
            sceneRef.current?.remove(tempMarker);

            // Store reference to the model
            anchorModelsRef.current.set(anchor.id, model);

            // Add user data to the model to identify it later
            model.userData.anchorId = anchor.id;

            console.log(`Model loaded successfully for anchor ${anchor.id}`);
          })
          .catch((error) => {
            console.error(
              `Error loading model for anchor ${anchor.id}:`,
              error,
            );

            // If model fails to load, keep the marker as fallback
            tempMarker.material.opacity = 1.0;
            anchorModelsRef.current.set(anchor.id, tempMarker);
          });

        // --- CREATE A CSS3DObject FOR THE LABEL ---
        const labelDiv = document.createElement("div");
        // Display model name instead of coordinates for model anchors
        labelDiv.textContent = anchor.modelName || "3D Model";
        labelDiv.style.padding = "2px 4px";
        labelDiv.style.fontSize = "12px";

        labelDiv.style.color = "#000";
        labelDiv.style.backgroundColor = "rgba(255,255,255,0.8)";
        labelDiv.style.borderRadius = "4px";
        labelDiv.style.whiteSpace = "nowrap";

        const labelObject = new CSS3DObject(labelDiv);
        // Scale the label down (adjust 0.01 as needed)
        labelObject.scale.set(0.005, 0.005, 0.005);

        // Shift label up a bit so it doesn't overlap the model
        labelObject.position
          .copy(worldPosition)
          .add(new THREE.Vector3(0, 0.15, 0)); // Increased Y offset for models

        // Add label to scene
        sceneRef.current?.add(labelObject);
      });
    }, [modelAnchors, originPoint, yRotation, showModelAnchors]);

    // NEW: Centralized selection handler for ALL anchor types
    const handleAnchorSelect = (
      anchorId: string,
      objectToTransform: THREE.Object3D, // This is the object to attach controls to (often the helper)
      anchorType: "model" | "text" | "file" | "webpage",
    ) => {
      console.log(
        `[handleAnchorSelect] Called for ${anchorType} anchor: ${anchorId}. Object:`,
        objectToTransform,
        `Current selection: ${selectedAnchorId} (${selectedAnchorType})`,
      );

      // If the same anchor is already selected, ensure its state and avoid full deselect/reselect
      if (selectedAnchorId === anchorId && selectedAnchorType === anchorType) {
        console.log(
          `[handleAnchorSelect] Anchor ${anchorId} (${anchorType}) is already selected. Ensuring state.`,
        );
        // Ensure transform controls are attached to the correct object
        if (
          transformControlsRef.current &&
          transformControlsRef.current.object !== objectToTransform
        ) {
          transformControlsRef.current.attach(objectToTransform);
          // Re-apply the current transform mode if needed, or default
          transformControlsRef.current.setMode(transformMode || "translate");
          transformControlsRef.current.visible = true;
          transformControlsRef.current.enabled = true;
        } else if (
          transformControlsRef.current &&
          !transformControlsRef.current.visible
        ) {
          // If controls were hidden for the same object, make them visible
          transformControlsRef.current.visible = true;
          transformControlsRef.current.enabled = true;
        }
        // Ensure the object is highlighted
        highlightObject(objectToTransform, sceneRef.current);
        // Ensure OrbitControls are correctly enabled/disabled
        if (orbitControlsRef.current && transformControlsRef.current) {
          orbitControlsRef.current.enabled =
            !transformControlsRef.current.dragging;
        }
        return; // Exit early
      }

      handleDeselect(); // Deselect previous (different) anchor first

      // 1. Update State
      setSelectedAnchorId(anchorId);
      setSelectedAnchorType(anchorType);

      // 2. Store Original Transform (for potential undo/cancel)
      setLastTransform({
        position: objectToTransform.position.clone(),
        rotation: objectToTransform.rotation.clone(),
        scale: objectToTransform.scale.clone(),
      });

      // 3. Attach Transform Controls
      if (transformControlsRef.current) {
        console.log(
          `[handleAnchorSelect] Attaching TransformControls to:`,
          objectToTransform,
        );
        transformControlsRef.current.attach(objectToTransform);
        const currentMode = transformMode || "translate"; // Use existing mode or default
        transformControlsRef.current.setMode(currentMode);
        setTransformMode(currentMode); // Ensure state is in sync

        transformControlsRef.current.enabled = true;
        transformControlsRef.current.visible = true;
        console.log(
          `[handleAnchorSelect] Controls attached. Mode: ${currentMode}, Enabled: ${transformControlsRef.current.enabled}, Visible: ${transformControlsRef.current.visible}`,
        );
      } else {
        console.error(
          "[handleAnchorSelect] TransformControls ref is not available!",
        );
        return;
      }

      // 4. Show Transform UI Indicator (State update, actual UI might be removed)
      setShowTransformUI(true);

      // 5. Apply Highlighting
      highlightObject(objectToTransform, sceneRef.current);

      // 6. Visual Feedback Animation (Subtle scale pulse)
      if (
        !(
          objectToTransform &&
          objectToTransform.userData &&
          objectToTransform.userData.isCSS3DObject
        ) &&
        !objectToTransform.userData?.type?.includes("helper") && // Avoid pulsing helpers directly
        !objectToTransform.userData?.visualObject // Also avoid if it's a helper whose visual part is pulsed by highlightObject
      ) {
        const originalScale = objectToTransform.scale.clone();
        const targetScale = originalScale.clone().multiplyScalar(1.05);

        new TWEEN.Tween(objectToTransform.scale)
          .to({ x: targetScale.x, y: targetScale.y, z: targetScale.z }, 150)
          .easing(TWEEN.Easing.Cubic.Out)
          .yoyo(true)
          .repeat(1)
          .start();
      }

      // 7. Ensure OrbitControls are handled
      if (orbitControlsRef.current && transformControlsRef.current) {
        orbitControlsRef.current.enabled =
          !transformControlsRef.current.dragging;
      }
    };

    // NEW: Function to handle deselection
    const handleDeselect = () => {
      if (selectedAnchorId) {
        console.log(`Deselecting anchor: ${selectedAnchorId}`);
        setSelectedAnchorId(null);
        setSelectedAnchorType(null);
        setShowTransformUI(false); // Update state even though UI is gone
        if (transformControlsRef.current) {
          transformControlsRef.current.detach();
          transformControlsRef.current.visible = false; // Hide gizmo
          transformControlsRef.current.enabled = false; // Disable controls
        }
        highlightObject(null, sceneRef.current); // Remove highlight
        if (orbitControlsRef.current) {
          orbitControlsRef.current.enabled = true; // Ensure orbit controls are re-enabled
        }
      }
      //  if (onBackgroundClick) onBackgroundClick();
    };

    const highlightObject = (
      objectToHighlight: THREE.Object3D | null,
      scene: THREE.Scene | null,
    ) => {
      if (!scene) return;

      // --- 1. Remove ALL previous highlights ---
      const prevBoxHighlightPrimary = scene.getObjectByName(
        "highlight-box3-primary",
      );
      if (prevBoxHighlightPrimary) scene.remove(prevBoxHighlightPrimary);

      const prevCSSHighlightPrimaryDummy = scene.getObjectByName(
        "highlight-css-primary-dummy",
      );
      if (
        prevCSSHighlightPrimaryDummy &&
        prevCSSHighlightPrimaryDummy.userData.isCSSHighlight &&
        prevCSSHighlightPrimaryDummy.userData.targetElement &&
        prevCSSHighlightPrimaryDummy.userData.originalStyle
      ) {
        Object.assign(
          prevCSSHighlightPrimaryDummy.userData.targetElement.style,
          prevCSSHighlightPrimaryDummy.userData.originalStyle,
        );
        scene.remove(prevCSSHighlightPrimaryDummy);
      }

      const prevHelperBoxHighlight = scene.getObjectByName(
        "highlight-box3-helper",
      );
      if (prevHelperBoxHighlight) scene.remove(prevHelperBoxHighlight);

      const prevHelperCSSHighlightDummy = scene.getObjectByName(
        "highlight-css-helper-visual-dummy",
      );
      if (
        prevHelperCSSHighlightDummy &&
        prevHelperCSSHighlightDummy.userData.isCSSHighlight &&
        prevHelperCSSHighlightDummy.userData.targetElement &&
        prevHelperCSSHighlightDummy.userData.originalStyle
      ) {
        Object.assign(
          prevHelperCSSHighlightDummy.userData.targetElement.style,
          prevHelperCSSHighlightDummy.userData.originalStyle,
        );
        scene.remove(prevHelperCSSHighlightDummy);
      }

      // If objectToHighlight is null, we just wanted to remove existing highlights
      if (!objectToHighlight) return;

      // --- 2. Apply new highlight(s) based on the type of objectToHighlight ---

      if (objectToHighlight.userData?.type?.endsWith("-helper")) {
        // This is a helper mesh (e.g., for text, file, webpage anchors)
        const helperMesh = objectToHighlight;

        // Highlight Effect 1: Apply CSS styling to the helper's visual part if it's a CSS3DObject
        // (e.g., style the text label div or the audio player div)
        const visualObject = (helperMesh.userData.visualObject || // For files/icons
          helperMesh.userData.labelObject || // For text labels
          helperMesh.userData.cssObject) as CSS3DObject | undefined; // For webpages

        if (
          visualObject &&
          visualObject.userData &&
          visualObject.userData.isCSS3DObject
        ) {
          const element = visualObject.userData.element as HTMLElement;
          if (element) {
            const originalStyle = {
              outline: element.style.outline || "",
              outlineOffset: element.style.outlineOffset || "",
              boxShadow: element.style.boxShadow || "",
              transition: element.style.transition || "",
              transform: element.style.transform || "", // For potential scale pulse
            };

            element.style.outline = "3px solid #00ffff"; // Cyan outline
            element.style.outlineOffset = "2px";
            element.style.boxShadow = "0 0 15px rgba(0, 255, 255, 0.7)";
            element.style.transition =
              "outline 0.1s ease-in-out, box-shadow 0.1s ease-in-out, transform 0.1s ease-in-out";
            // element.style.transform = "scale(1.03)"; // Optional subtle scale

            const dummy = new THREE.Object3D();
            dummy.name = "highlight-css-helper-visual-dummy";
            dummy.userData.isCSSHighlight = true;
            dummy.userData.targetElement = element;
            dummy.userData.originalStyle = originalStyle;
            scene.add(dummy);
          }
        }

        // Highlight Effect 2: Add a 3D Box3Helper around the helper mesh itself
        try {
          const bbox = new THREE.Box3().setFromObject(helperMesh);
          if (
            !bbox.isEmpty() &&
            isFinite(bbox.min.x) &&
            isFinite(bbox.min.y) &&
            isFinite(bbox.min.z) &&
            isFinite(bbox.max.x) &&
            isFinite(bbox.max.y) &&
            isFinite(bbox.max.z)
          ) {
            const boxHelper = new THREE.Box3Helper(bbox, 0x00ffff); // Cyan color
            boxHelper.name = "highlight-box3-helper";
            // Safely handle materials which might be an array or a single material
            const mat = boxHelper.material;
            if (Array.isArray(mat)) {
              mat.forEach((m) => {
                m.depthTest = false;
                m.transparent = true;
                m.opacity = 0.9;
              });
            } else {
              mat.depthTest = false;
              mat.transparent = true;
              mat.opacity = 0.9;
            }
            boxHelper.renderOrder = 10001;
            scene.add(boxHelper);

            const animatePulse = () => {
              if (!boxHelper.parent) return;
              requestAnimationFrame(animatePulse);
              const time = Date.now() * 0.002;
              (boxHelper.material as THREE.Material).opacity =
                0.6 + Math.sin(time * 5) * 0.3;
            };
            animatePulse();
          }
        } catch (error) {
          console.error(
            "Error creating Box3Helper for helper mesh:",
            error,
            helperMesh,
          );
        }
      } else if (
        objectToHighlight &&
        objectToHighlight.userData &&
        objectToHighlight.userData.isCSS3DObject
      ) {
        // This is a directly selected CSS3DObject (e.g., a webpage anchor's iframe container)
        const element = objectToHighlight.userData.element as HTMLElement;
        if (element) {
          const originalStyle = {
            outline: element.style.outline || "",
            outlineOffset: element.style.outlineOffset || "",
            boxShadow: element.style.boxShadow || "",
            transition: element.style.transition || "",
          };

          element.style.outline = "3px solid #00ffff"; // Cyan outline
          element.style.outlineOffset = "2px";
          element.style.boxShadow = "0 0 15px rgba(0, 255, 255, 0.7)";
          element.style.transition =
            "outline 0.1s ease-in-out, box-shadow 0.1s ease-in-out";

          const dummy = new THREE.Object3D();
          dummy.name = "highlight-css-primary-dummy";
          dummy.userData.isCSSHighlight = true;
          dummy.userData.targetElement = element;
          dummy.userData.originalStyle = originalStyle;
          scene.add(dummy);
        }
      } else if (
        objectToHighlight instanceof THREE.Mesh ||
        objectToHighlight instanceof THREE.Group
      ) {
        // This is a directly selected WebGL mesh or group (e.g., a 3D model anchor)
        try {
          if (
            objectToHighlight instanceof THREE.Mesh &&
            objectToHighlight.geometry
          ) {
            objectToHighlight.geometry.computeBoundingBox();
          } else if (objectToHighlight instanceof THREE.Group) {
            objectToHighlight.updateMatrixWorld(true);
          }

          const bbox = new THREE.Box3().setFromObject(objectToHighlight);
          if (
            !bbox.isEmpty() &&
            isFinite(bbox.min.x) &&
            isFinite(bbox.min.y) &&
            isFinite(bbox.min.z) &&
            isFinite(bbox.max.x) &&
            isFinite(bbox.max.y) &&
            isFinite(bbox.max.z)
          ) {
            const boxHelper = new THREE.Box3Helper(bbox, 0x00ffff); // Cyan color
            boxHelper.name = "highlight-box3-primary";

            // Safely handle materials which might be an array or a single material
            const mat = boxHelper.material;
            if (Array.isArray(mat)) {
              mat.forEach((m) => {
                m.depthTest = false;
                m.transparent = true;
                m.opacity = 0.9;
              });
            } else {
              mat.depthTest = false;
              mat.transparent = true;
              mat.opacity = 0.9;
            }
            boxHelper.renderOrder = 10001;
            scene.add(boxHelper);

            const animatePulse = () => {
              if (!boxHelper.parent) return;
              requestAnimationFrame(animatePulse);
              const time = Date.now() * 0.002;
              (boxHelper.material as THREE.Material).opacity =
                0.6 + Math.sin(time * 5) * 0.3;
            };
            animatePulse();
          } else {
            console.warn(
              "Cannot create highlight: Invalid bounding box for Mesh/Group.",
              objectToHighlight,
              bbox,
            );
          }
        } catch (error) {
          console.error(
            "Error creating Box3Helper for Mesh/Group:",
            error,
            objectToHighlight,
          );
        }
      } else {
        console.warn(
          "[highlightObject] Unhandled object type for highlighting:",
          objectToHighlight.type,
          objectToHighlight,
        );
      }
    };

    useEffect(() => {
      // Ensure both scene and textAnchors exist before proceeding.
      if (!sceneRef.current || !textAnchors) return;

      // --- Visibility Check ---
      if (!showTextAnchors) {
        textAnchorsRef.current.forEach((labelObject, anchorId) => {
          if (labelObject && sceneRef.current) {
            sceneRef.current?.remove(labelObject);
            if (labelObject.userData.helperMesh && sceneRef.current) {
              sceneRef.current?.remove(labelObject.userData.helperMesh);
            }
          }
        });
        textAnchorsRef.current.clear();
        console.log(
          "[ThreeViewer Text Effect] All Text anchors removed due to visibility toggle.",
        );
        return; // Exit early
      }
      // --- End Visibility Check ---

      const currentAnchorIds = new Set<string>(); // Keep track of anchors processed in this run

      textAnchors.forEach((anchor: TextAnchor) => {
        currentAnchorIds.add(anchor.id); // Mark this ID as current

        // Check if this anchor already exists visually
        const existingLabelObject = textAnchorsRef.current.get(anchor.id);

        if (existingLabelObject instanceof CSS3DObject) {
          // --- UPDATE EXISTING ANCHOR ---
          const element = existingLabelObject.element as HTMLElement;
          const textDiv = element.querySelector(
            ".bp-text",
          ) as HTMLElement | null;
          const currentVisualText = textDiv?.textContent;
          const newText = anchor.textContent;

          if (textDiv && currentVisualText !== newText) {
            console.log(
              `Updating text for anchor ${anchor.id} from "${currentVisualText}" to "${newText}"`,
            );
            textDiv.textContent = newText;
          }

          // Handle media updates
          const mediaEl = element.querySelector(".bp-media");
          if (anchor.mediaUrl) {
            if (!mediaEl) {
              // Create new media element
              const newMedia =
                anchor.mediaType === "video"
                  ? document.createElement("video")
                  : document.createElement("img");
              newMedia.className = "bp-media";
              if (anchor.mediaType === "video") {
                const v = newMedia as HTMLVideoElement;
                v.src = anchor.mediaUrl;
                v.width = 160;
                v.controls = true;
                v.style.marginBottom = "8px";
              } else {
                const i = newMedia as HTMLImageElement;
                i.src = anchor.mediaUrl;
                i.style.width = "160px";
                i.style.borderRadius = "8px";
                i.style.marginBottom = "8px";
              }
              element.insertBefore(newMedia, textDiv || null);
            } else {
              if (anchor.mediaType === "video" && mediaEl.tagName !== "VIDEO") {
                mediaEl.remove();
                const v = document.createElement("video");
                v.className = "bp-media";
                v.src = anchor.mediaUrl;
                v.width = 160;
                v.controls = true;
                v.style.marginBottom = "8px";
                element.insertBefore(v, textDiv || null);
              } else if (
                anchor.mediaType === "image" &&
                mediaEl.tagName !== "IMG"
              ) {
                mediaEl.remove();
                const i = document.createElement("img");
                i.className = "bp-media";
                i.src = anchor.mediaUrl;
                i.style.width = "160px";
                i.style.borderRadius = "8px";
                i.style.marginBottom = "8px";
                element.insertBefore(i, textDiv || null);
              } else {
                // Same type, just update src
                (mediaEl as HTMLMediaElement).src = anchor.mediaUrl;
              }
            }
          } else if (mediaEl) {
            mediaEl.remove();
          }

          // Optionally update position if needed
          // existingLabelObject.position.copy(newModelSpacePosition);

          // IMPORTANT: Also update the helper mesh position if the anchor can be moved externally
          const helperMesh = existingLabelObject.userData
            .helperMesh as THREE.Mesh;
          if (helperMesh) {
            // Recalculate modelSpacePosition if necessary and update helper
            // helperMesh.position.copy(newModelSpacePosition);
          }

          return; // Skip adding logic, move to next anchor
        }

        // --- ADD NEW ANCHOR ---
        // Real-world coordinates from anchor data
        const realWorldAnchorPos = new THREE.Vector3(
          Number(anchor.x || 0),
          Number(anchor.y || 0),
          Number(anchor.z || 0),
        );

        console.log(`in �️ [Text Anchor ${anchor.id}] Debug:`);
        console.log("  Firebase coordinates:", realWorldAnchorPos.toArray());
        console.log(
          "  Current originNodeRef.current.position:",
          originNodeRef.current?.position.toArray(),
        );
        console.log("  Current SCALE_FACTOR:", SCALE_FACTOR);

        const worldPosition = convertFromRealWorldCoords(realWorldAnchorPos);

        console.log("  Final worldPosition:", worldPosition.toArray());
        console.log(
          "  Distance from origin:",
          worldPosition.distanceTo(
            originNodeRef.current?.position || new THREE.Vector3(),
          ),
        );

        // --- CREATE A CSS3DObject FOR THE LABEL ---
        const labelDiv = document.createElement("div");
        labelDiv.style.pointerEvents = "auto"; // keep pointer events ON
        labelDiv.style.display = "flex";
        labelDiv.style.flexDirection = "column";
        labelDiv.style.alignItems = "center";

        if (anchor.mediaUrl) {
          if (anchor.mediaType === "video") {
            const v = document.createElement("video");
            v.className = "bp-media";
            v.src = anchor.mediaUrl;
            v.width = 160;
            v.controls = true;
            v.style.marginBottom = "8px";
            labelDiv.appendChild(v);
          } else {
            const i = document.createElement("img");
            i.className = "bp-media";
            i.src = anchor.mediaUrl;
            i.style.width = "160px";
            i.style.borderRadius = "8px";
            i.style.marginBottom = "8px";
            labelDiv.appendChild(i);
          }
        }

        const textDiv = document.createElement("div");
        textDiv.className = "bp-text";
        textDiv.textContent = anchor.textContent;
        textDiv.style.padding = "10px 12px";
        textDiv.style.fontSize = "11px";
        textDiv.style.color = "#ffffff";
        textDiv.style.backgroundColor = "rgba(120, 120, 130, 0.82)";
        textDiv.style.borderRadius = "12px";
        textDiv.style.whiteSpace = "normal";
        textDiv.style.maxWidth = "160px";
        textDiv.style.wordWrap = "break-word";
        textDiv.style.overflowWrap = "break-word";
        textDiv.style.textAlign = "left";
        textDiv.style.backdropFilter = "blur(10px)";
        textDiv.style.boxShadow = "0 4px 10px rgba(0, 0, 0, 0.2)";
        textDiv.style.border = "1px solid rgba(255, 255, 255, 0.1)";
        textDiv.style.fontFamily =
          "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif";
        textDiv.style.fontWeight = "400";
        textDiv.style.letterSpacing = "0.2px";

        // --- ADDED FOR SCROLLABLE TEXT ---
        textDiv.style.maxHeight = "180px"; // Set a max height for the text anchor
        textDiv.style.overflowY = "auto"; // Add a scrollbar if content exceeds max height

        // --- Custom Scrollbar Styling (for WebKit browsers like Chrome/Safari) ---
        const styleId = "custom-scrollbar-style";
        if (!document.getElementById(styleId)) {
          const style = document.createElement("style");
          style.id = styleId;
          style.innerHTML = `
            .scrollable-text-anchor::-webkit-scrollbar {
              width: 8px;
            }
            .scrollable-text-anchor::-webkit-scrollbar-track {
              background: rgba(0, 0, 0, 0.1);
              border-radius: 10px;
            }
            .scrollable-text-anchor::-webkit-scrollbar-thumb {
              background: rgba(255, 255, 255, 0.3);
              border-radius: 10px;
            }
            .scrollable-text-anchor::-webkit-scrollbar-thumb:hover {
              background: rgba(255, 255, 255, 0.5);
            }
          `;
          document.head.appendChild(style);
        }
        textDiv.classList.add("scrollable-text-anchor");
        // --- END OF ADDED CODE ---

        labelDiv.appendChild(textDiv);

        const labelObject = new CSS3DObject(labelDiv); // Define labelObject here
        //labelObject.scale.set(0.0015, 0.0015, 0.0015);
        labelObject.scale.set(0.00075, 0.00075, 0.00075);
        labelObject.position.copy(worldPosition); // Use calculated worldPosition
        labelObject.userData.anchorId = anchor.id;
        labelObject.userData.isTextLabel = true;
        labelObject.userData.type = "text"; // Add type for easier identification

        // 2) Create a small invisible helper mesh in the WebGL scene:
        const helperGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.01); // Tiny box
        const helperMaterial = new THREE.MeshBasicMaterial({
          visible: false, // Make it invisible
          depthTest: false, // Optional: might help with raycasting consistency
          transparent: true,
          opacity: 0,
        });
        const helperMesh = new THREE.Mesh(helperGeometry, helperMaterial);

        // Place helper mesh exactly where the label is:
        helperMesh.position.copy(worldPosition); // Use calculated worldPosition

        // Store a reference in labelObject.userData so we can find it later:
        // AND store a reference back from the helper to the label
        labelObject.userData.helperMesh = helperMesh;
        helperMesh.userData.labelObject = labelObject; // Reference back to the CSS3DObject
        helperMesh.userData.anchorId = anchor.id; // Also store anchorId on helper
        helperMesh.userData.type = "text-helper"; // Identify the helper

        // ADD THIS EVENT LISTENER (now inside the scope where labelObject is defined):
        labelDiv.addEventListener("pointerdown", (ev) => {
          ev.stopPropagation();
          ev.preventDefault(); // Add this to prevent potential conflicts
          console.log(
            `[Text Label PointerDown] Event propagation stopped for ${anchor.id}`,
          );

          // ***** CHANGE: Select the HELPER MESH *****
          const helper = labelObject.userData.helperMesh as THREE.Mesh;
          if (helper) {
            console.log(
              `Text label div clicked for ${anchor.id}, selecting helper mesh.`,
            );
            handleAnchorSelect(anchor.id, helper, "text"); // Pass helper mesh to selection handler
          } else {
            console.warn(`Helper mesh not found for text anchor ${anchor.id}`);
          }
          // ***** END CHANGE *****

          if (onTextAnchorClick) {
            // Still call the info panel callback
            onTextAnchorClick(anchor.id, anchor.textContent);
          }
        });

        // Add both to the scene:
        sceneRef.current?.add(labelObject); // CSS layer
        sceneRef.current?.add(helperMesh); // WebGL layer

        // Store the label object in the ref
        textAnchorsRef.current.set(anchor.id, labelObject); // Store the CSS3DObject directly
      }); // End forEach

      // --- CLEANUP REMOVED ANCHORS ---
      textAnchorsRef.current.forEach((labelObject, anchorId) => {
        if (!currentAnchorIds.has(anchorId)) {
          // This anchor is no longer in the props, remove it from the scene
          console.log(`Removing text anchor ${anchorId} from scene.`);
          if (labelObject && sceneRef.current) {
            sceneRef.current?.remove(labelObject);
            // ALSO REMOVE THE HELPER MESH
            if (labelObject.userData.helperMesh && sceneRef.current) {
              sceneRef.current?.remove(labelObject.userData.helperMesh);
              console.log(`Removing helper mesh for text anchor ${anchorId}.`);
            }
          }
          textAnchorsRef.current.delete(anchorId); // Remove from our tracking ref
        }
      });
    }, [
      textAnchors,
      originPoint,
      yRotation,
      sceneRef.current,
      onTextAnchorClick,
      handleAnchorSelect,
      showTextAnchors,
    ]);

    // Update keyboard shortcuts useEffect
    useEffect(() => {
      const handleTransformKeydown = (e: KeyboardEvent) => {
        // Use selectedAnchorId now
        if (
          !selectedAnchorId ||
          !showTransformUI ||
          !transformControlsRef.current?.object
        )
          return;

        switch (e.key.toLowerCase()) {
          case "g": // Move
            setTransformMode("translate");
            transformControlsRef.current?.setMode("translate");
            break;
          case "r": // Rotate
            setTransformMode("rotate");
            transformControlsRef.current?.setMode("rotate");
            break;
          case "s": // Scale
            // Prevent scaling for CSS3DObjects (text, webpages) as it often breaks layout/interaction
            const isCSS3DRelated =
              transformControlsRef.current.object &&
              (transformControlsRef.current.object.userData?.isCSS3DObject ||
                transformControlsRef.current.object.userData?.type?.includes(
                  "webpage",
                ) ||
                transformControlsRef.current.object.userData?.type?.includes(
                  "text",
                ));

            if (!isCSS3DRelated) {
              setTransformMode("scale");
              transformControlsRef.current?.setMode("scale");
            } else {
              console.warn("Scaling is disabled for text and webpage anchors.");
              // Optionally show a small message to the user
            }
            break;
          case "escape": // Cancel transformations / Deselect
            handleDeselect(); // Use the deselect handler
            // Optionally restore original transform if needed (handleDeselect doesn't do this)
            // You might want to add restore logic here or within handleDeselect if desired
            break;
        }
      };

      window.addEventListener("keydown", handleTransformKeydown);

      return () => {
        window.removeEventListener("keydown", handleTransformKeydown);
      };
      // Dependency uses selectedAnchorId
    }, [selectedAnchorId, showTransformUI, handleDeselect]); // Add handleDeselect dependency

    // ⬇⬇⬇ NEW: Pan camera with the arrow keys ⬇⬇⬇
    useEffect(() => {
      const handleArrowNavigate = (e: KeyboardEvent) => {
        // Get the current value of the ref *inside* the handler
        const controls = orbitControlsRef.current;

        // *** MORE ROBUST CHECK ***
        // Check if controls exist AND if the necessary methods are functions
        if (
          !controls ||
          typeof controls.panLeft !== "function" ||
          typeof controls.dollyIn !== "function" ||
          typeof controls.dollyOut !== "function" ||
          typeof controls.update !== "function"
        ) {
          // Log a warning if controls aren't fully ready
          console.warn(
            "Arrow key navigation skipped: OrbitControls not fully initialized yet.",
          );
          return; // Exit if controls are not valid
        }

        // Define movement amounts
        const panSpeed = 0.02;
        const dollySpeed = 0.98;

        // Now we can safely use 'controls'
        switch (e.key) {
          case "ArrowLeft":
            if (typeof controls.panLeft === "function") {
              controls.panLeft(panSpeed);
            }
            controls.update();
            break;
          case "ArrowRight":
            if (typeof controls.panLeft === "function") {
              controls.panLeft(-panSpeed);
            }
            controls.update();
            break;
          case "ArrowUp":
            if (typeof controls.dollyIn === "function") {
              controls.dollyIn(1 / dollySpeed);
            }
            controls.update();
            break;
          case "ArrowDown":
            if (typeof controls.dollyOut === "function") {
              controls.dollyOut(1 / dollySpeed);
            }
            controls.update();
            break;
          default:
            return; // Ignore other keys
        }
      };

      window.addEventListener("keydown", handleArrowNavigate);
      return () => window.removeEventListener("keydown", handleArrowNavigate);
    }, []); // Keep empty dependency array, the check inside handles the timing
    // ⬆⬆⬆ END ARROW-KEY PANNING ⬆⬆ "�

    useEffect(() => {
      if (!showQrCodes) {
        // If hidden, remove all existing QR markers and clear the map
        qrCodeMarkersRef.current.forEach((marker, id) => {
          sceneRef.current!.remove(marker);
        });
        qrCodeMarkersRef.current.clear();
        console.log(
          "[ThreeViewer QR Effect] All QR Code markers removed due to visibility toggle.",
        );
        return; // Exit early
      }

      if (!sceneRef.current || !qrCodeAnchors) {
        console.log(
          "[ThreeViewer qrCodeAnchors Effect] Skipping: No scene or anchors.",
        );
        return;
      }

      console.log(
        `%c[ThreeViewer qrCodeAnchors Effect] START - Processing ${qrCodeAnchors.length} anchors`,
        "color: purple; font-weight: bold;",
        qrCodeAnchors,
      );

      const currentAnchorIds = new Set(
        qrCodeAnchors.map((anchor) => anchor.id),
      );

      qrCodeAnchors.forEach((anchor) => {
        if (qrCodeMarkersRef.current.has(anchor.id)) return;

        console.log(
          `[ThreeViewer qrCodeAnchors] Creating marker for Anchor ID: ${anchor.id}`,
        );
        const realWorldPosition = new THREE.Vector3(
          Number(anchor.x || 0),
          Number(anchor.y || 0),
          Number(anchor.z || 0),
        );
        let modelSpacePosition: THREE.Vector3;
        if (originPoint) {
          const offsetInModelUnits = realWorldPosition
            .clone()
            .divideScalar(SCALE_FACTOR); //45.64
          const originVector =
            originPoint instanceof THREE.Vector3
              ? originPoint.clone()
              : new THREE.Vector3(0, 0, 0);
          modelSpacePosition = originVector.clone().add(offsetInModelUnits);
        } else {
          modelSpacePosition = realWorldPosition
            .clone()
            .divideScalar(SCALE_FACTOR); //45.64
          console.warn(
            `[ThreeViewer qrCodeAnchors] No originPoint for anchor ${anchor.id}. Placing relative to world origin.`,
          );
        }
        console.log(
          `[ThreeViewer qrCodeAnchors] Calculated modelSpacePosition for ${anchor.id}:`,
          modelSpacePosition,
        );

        const markerGeometry = new THREE.SphereGeometry(0.025, 16, 16);
        const markerMaterial = new THREE.MeshBasicMaterial({
          color: 0xffa500,
          depthTest: false,
          transparent: true,
          opacity: 0.9,
        });
        const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
        markerMesh.position.copy(modelSpacePosition);
        markerMesh.renderOrder = 9999;
        markerMesh.userData.anchorId = anchor.id;
        markerMesh.userData.type = "qrCode";
        sceneRef.current?.add(markerMesh);
        console.log(
          `%c[ThreeViewer qrCodeAnchors] Successfully ADDED marker mesh to scene for ${anchor.id}`,
          "color: green;",
        );
        qrCodeMarkersRef.current.set(anchor.id, markerMesh);
      });

      qrCodeMarkersRef.current.forEach((marker, id) => {
        if (!currentAnchorIds.has(id)) {
          console.log(
            `[ThreeViewer qrCodeAnchors] Cleaning up marker for anchor ${id}`,
          );
          sceneRef.current?.remove(marker);
          qrCodeMarkersRef.current.delete(id);
        }
      });

      console.log(
        `%c[ThreeViewer qrCodeAnchors Effect] END`,
        "color: purple; font-weight: bold;",
      );
    }, [qrCodeAnchors, originPoint, yRotation, sceneRef.current, showQrCodes]);

    const loadAndAddWebpage = async (
      url: string,
      anchorId: string,
      position: THREE.Vector3,
    ) => {
      if (!sceneRef.current) return null;
      console.log("Loading webpage at position:", position, "URL:", url);

      // Create a container for the webpage with a better appearance
      const container = document.createElement("div");
      container.style.width = "400px";
      container.style.height = "300px";
      container.style.overflow = "hidden";
      container.style.borderRadius = "8px";
      container.style.boxShadow = "0 10px 30px rgba(0,0,0,0.3)";
      container.style.position = "relative";
      container.style.backgroundColor = "white";

      /* INSERT THE FOLLOWING CODE HERE */
      const overlay = document.createElement("div");
      overlay.style.position = "absolute";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.width = "100%";
      overlay.style.height = "100%";
      overlay.style.zIndex = "100"; // Ensure the overlay is on top of the iframe
      overlay.style.backgroundColor = "transparent"; // Make overlay invisible but clickable
      overlay.style.pointerEvents = "auto"; // Allow pointer events on the overlay

      overlay.addEventListener("pointerdown", (ev) => {
        ev.stopPropagation();
        ev.preventDefault(); // Prevent default browser actions like text selection

        const helper = css3dObject.userData.helperMesh as THREE.Mesh; // css3dObject is the webpage container (CSS3DObject)
        const anchorId = css3dObject.userData.anchorId;

        // Find the webpage anchor data from the webpageAnchors prop
        const webpageAnchorData = webpageAnchors?.find(
          (a) => a.id === anchorId,
        );

        console.log(
          `Webpage overlay clicked for ${anchorId}. Helper found: ${!!helper}. Webpage data found: ${!!webpageAnchorData}`,
        );

        // 1. Notify BlueprintEditor by calling onWebpageAnchorClick
        if (onWebpageAnchorClick && webpageAnchorData) {
          onWebpageAnchorClick(anchorId, webpageAnchorData.webpageUrl); // Pass anchorId and URL
        } else {
          console.warn(
            `onWebpageAnchorClick callback missing or webpage anchor data not found for ${anchorId}`,
          );
        }

        // 2. Select the HELPER mesh with the correct anchor type "webpage"
        if (helper) {
          handleAnchorSelect(anchorId, helper, "webpage"); // Correctly select as "webpage"
        } else {
          console.warn(
            `Helper mesh not found for webpage anchor ${anchorId} on click.`,
          );
          // As a fallback, if no helper, you might still want to trigger the panel
          // by calling onWebpageAnchorClick (already done above) and potentially
          // selecting the css3dObject itself if that's handled by handleAnchorSelect,
          // though transforming CSS3DObjects directly can be tricky.
          // For now, ensuring the callback and correct type for handleAnchorSelect is key.
          if (webpageAnchorData) {
            // If we have data, but no helper, still try to select the main object
            handleAnchorSelect(anchorId, css3dObject, "webpage");
          }
        }
      });
      container.appendChild(overlay);

      // Add a URL bar to show what's being loaded
      const urlBar = document.createElement("div");
      urlBar.style.width = "100%";
      urlBar.style.height = "30px";
      urlBar.style.backgroundColor = "#f0f0f0";
      urlBar.style.borderBottom = "1px solid #ccc";
      urlBar.style.display = "flex";
      urlBar.style.alignItems = "center";
      urlBar.style.padding = "0 10px";
      urlBar.style.fontSize = "12px";
      urlBar.style.color = "#333";
      urlBar.style.fontFamily = "Arial, sans-serif";
      urlBar.innerHTML = `
      <div style="
        display: flex; 
        align-items: center; 
        width: 100%; 
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px;">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
        <span style="overflow: hidden; text-overflow: ellipsis;">${url}</span>
      </div>
    `;
      container.appendChild(urlBar);

      // Create content container
      const contentContainer = document.createElement("div");
      contentContainer.style.width = "100%";
      contentContainer.style.height = "calc(100% - 30px)";
      contentContainer.style.position = "relative";
      container.appendChild(contentContainer);

      // Add loading indicator
      const loadingDiv = document.createElement("div");
      loadingDiv.style.position = "absolute";
      loadingDiv.style.top = "0";
      loadingDiv.style.left = "0";
      loadingDiv.style.width = "100%";
      loadingDiv.style.height = "100%";
      loadingDiv.style.display = "flex";
      loadingDiv.style.flexDirection = "column";
      loadingDiv.style.alignItems = "center";
      loadingDiv.style.justifyContent = "center";
      loadingDiv.style.backgroundColor = "white";
      loadingDiv.style.zIndex = "10";
      loadingDiv.innerHTML = `
      <div style="
        width: 40px;
        height: 40px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #3498db;
        border-radius: 50%;
        margin-bottom: 15px;
        animation: spin 1s linear infinite;
      "></div>
      <div style="font-family: Arial, sans-serif; color: #666;">Loading webpage...</div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
      contentContainer.appendChild(loadingDiv);

      // Create and add the iframe
      const iframe = document.createElement("iframe");
      iframe.src = url;
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "none";
      contentContainer.appendChild(iframe);

      // When iframe loads, remove loading indicator
      iframe.onload = () => {
        loadingDiv.style.display = "none";
        console.log("Webpage loaded successfully:", url);
      };

      // Handle iframe errors
      iframe.onerror = () => {
        loadingDiv.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 15px;">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <div style="font-family: Arial, sans-serif; color: #e74c3c; font-weight: bold; margin-bottom: 5px;">Error loading webpage</div>
        <div style="font-family: Arial, sans-serif; color: #666; font-size: 12px;">${url}</div>
      `;
        console.error("Failed to load webpage:", url);
      };

      // Create the CSS3DObject with the container
      const css3dObject = new CSS3DObject(container);
      css3dObject.position.copy(position); // Position directly at the anchor point

      // Adjust scale
      css3dObject.scale.set(0.0003, 0.0003, 0.0003); // Start small
      // css3dObject.position.y += 0.1; // <-- Line removed or commented out
      css3dObject.userData.anchorId = anchorId;
      // Add to scene
      sceneRef.current?.add(css3dObject);

      // Animate the appearance
      new TWEEN.Tween(css3dObject.scale)
        .to({ x: 0.005, y: 0.005, z: 0.005 }, 400)
        .easing(TWEEN.Easing.Back.Out)
        .start();

      console.log("Added webpage to scene:", url);
      return css3dObject;
    };

    useEffect(() => {
      if (!sceneRef.current || !webpageAnchors) {
        // webpageAnchors is from props
        console.log(
          "[ThreeViewer webpageAnchors Effect] Skipping: No scene or webpageAnchors prop.",
        );
        return;
      }

      // Visibility Check
      if (!showWebpageAnchors) {
        // showWebpageAnchors is from props
        anchorWebpagesRef.current.forEach((webpageObject, id) => {
          console.log(
            `[ThreeViewer Webpage Effect] Removing webpage anchor ${id} due to visibility toggle.`,
          );
          if (sceneRef.current) {
            sceneRef.current.remove(webpageObject); // Remove the main CSS3DObject
            const helperMesh = webpageObject.userData.helperMesh;
            if (helperMesh && sceneRef.current.getObjectById(helperMesh.id)) {
              sceneRef.current.remove(helperMesh); // Remove its helper mesh
            }
          }
        });
        anchorWebpagesRef.current.clear();
        console.log(
          "[ThreeViewer Webpage Effect] All Webpage anchors removed due to visibility toggle.",
        );
        return;
      }

      console.log(
        "[ThreeViewer webpageAnchors Effect] Processing webpage anchors:",
        webpageAnchors,
      );

      const currentAnchorIdsOnScreen = new Set(
        anchorWebpagesRef.current.keys(),
      );
      const propAnchorIds = new Set(webpageAnchors.map((a) => a.id));

      // Add or update anchors
      webpageAnchors.forEach(async (anchor) => {
        if (anchorWebpagesRef.current.has(anchor.id)) {
          // Optionally update existing anchor's position or URL if they can change
          // For now, assuming only new anchors are added this way.
          console.log(
            `[ThreeViewer webpageAnchors Effect] Anchor ${anchor.id} already exists. Skipping add.`,
          );
          return;
        }

        console.log(
          `[ThreeViewer webpageAnchors Effect] Preparing to add new anchor ${anchor.id}`,
        );

        // Calculate localPosition from anchor's real-world coordinates
        // Convert real-world coordinates back to model space
        const realWorldPos = new THREE.Vector3(
          Number(anchor.x || 0),
          Number(anchor.y || 0),
          Number(anchor.z || 0),
        );

        const worldPosition = convertFromRealWorldCoords(realWorldPos);

        const webpageObject = await loadAndAddWebpage(
          // This function adds to scene
          anchor.webpageUrl,
          anchor.id,
          worldPosition, // Use the newly calculated world position
        );

        if (webpageObject && sceneRef.current) {
          // Ensure scene is still current
          // Create and add helper mesh
          if (!webpageObject.userData.helperMesh) {
            const helperGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);
            const helperMaterial = new THREE.MeshBasicMaterial({
              visible: false,
            });
            const helperMesh = new THREE.Mesh(helperGeometry, helperMaterial);
            // Helper mesh position should also be based on finalWorldPosition
            // If webpageObject's position was set correctly by loadAndAddWebpage, this is fine.
            // For clarity and robustness, explicitly use finalWorldPosition for the helper if its parent is the scene.
            // If the helper is meant to be a child of webpageObject, then its local position would be (0,0,0).
            // Assuming helper is added to scene and needs world coordinates:
            helperMesh.position.copy(worldPosition);
            // If helper is child of webpageObject, then:
            // helperMesh.position.set(0,0,0); // As it's local to webpageObject which is at finalWorldPosition
            // The current pattern seems to be adding helpers to the scene directly.
            // We also need to ensure rotation and scale match if the webpageObject itself isn't billboarded.
            // For simplicity, let's assume the helper should match the webpageObject's world transform.
            helperMesh.rotation.copy(webpageObject.rotation); // This might need adjustment if webpageObject is billboarded
            helperMesh.scale.copy(webpageObject.scale); // This might also need adjustment
            helperMesh.userData = {
              anchorId: anchor.id,
              type: "webpage-helper",
              cssObject: webpageObject,
            };
            webpageObject.userData.helperMesh = helperMesh;
            sceneRef.current.add(helperMesh);
            console.log(
              `[ThreeViewer webpageAnchors Effect] Added helper mesh for ${anchor.id}`,
            );
          }

          anchorWebpagesRef.current.set(anchor.id, webpageObject);
          console.log(
            `[ThreeViewer webpageAnchors Effect] Added webpageObject for anchor ${anchor.id} to anchorWebpagesRef.`,
          );
        } else {
          console.warn(
            `[ThreeViewer webpageAnchors Effect] Failed to load or add webpageObject for anchor ${anchor.id}.`,
          );
        }
      });

      // Cleanup removed anchors
      currentAnchorIdsOnScreen.forEach((id) => {
        if (!propAnchorIds.has(id)) {
          const webpageObject = anchorWebpagesRef.current.get(id);
          if (webpageObject && sceneRef.current) {
            sceneRef.current.remove(webpageObject);
            const helperMesh = webpageObject.userData.helperMesh;
            if (helperMesh && sceneRef.current.getObjectById(helperMesh.id)) {
              sceneRef.current.remove(helperMesh);
            }
            anchorWebpagesRef.current.delete(id);
            console.log(
              `[ThreeViewer webpageAnchors Effect] Cleaned up removed anchor ${id}.`,
            );
          }
        }
      });
    }, [
      webpageAnchors,
      originPoint,
      yRotation, // ADD THIS LINE
      sceneRef,
      loadAndAddWebpage,
      showWebpageAnchors,
    ]);

    const createTextBoxMesh = (text: string, position: THREE.Vector3) => {
      // Create a canvas to draw the text
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;
      const fontSize = 24;
      context.font = `${fontSize}px sans-serif`;
      const textWidth = context.measureText(text).width;
      canvas.width = textWidth + 20; // add padding
      canvas.height = fontSize + 20;

      // Draw background and text
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "black";
      context.font = `${fontSize}px sans-serif`;
      context.fillText(text, 10, fontSize + 5);

      // Create texture and material
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true,
      });

      // Create plane geometry (adjust the scaleFactor as needed)
      const scaleFactor = 0.005;
      const geometry = new THREE.PlaneGeometry(
        canvas.width * scaleFactor,
        canvas.height * scaleFactor,
      );
      const textMesh = new THREE.Mesh(geometry, material);
      textMesh.position.copy(position);
      // Rotate the plane to be vertical (if needed)
      // textMesh.rotation.x = -Math.PI / 2;
      textMesh.rotation.x = 0;
      textMesh.rotation.y = Math.PI / 2;

      // Add the text mesh to the parent model if available; otherwise, add it to the scene
      if (parentModelRef.current) {
        parentModelRef.current.add(textMesh);
      } else {
        sceneRef.current?.add(textMesh);
      }

      // Hide the green dot (clickMarker)
      if (clickMarkerRef.current) {
        clickMarkerRef.current.visible = false;
      }
    };

    // optional: auto-clear that readout after a few seconds
    useEffect(() => {
      if (distanceDisplay) {
        const timer = setTimeout(() => {
          setDistanceDisplay("");
        }, 6000); // Increased from 3000 to 6000ms (6 seconds)
        return () => clearTimeout(timer);
      }
    }, [distanceDisplay]);

    useEffect(() => {
      if (sceneRef.current && scaleFactor && scaleFactor > 0) {
        // This sets the WHOLE SCENE so that 1 scene‐unit = 1 real‐foot
        sceneRef.current.scale.set(scaleFactor, scaleFactor, scaleFactor);
      }
    }, [scaleFactor]);

    useEffect(() => {
      activeLabelRef.current = activeLabel;
    }, [activeLabel]);

    useEffect(() => {
      isChoosingOriginRef.current = isChoosingOrigin;
    }, [isChoosingOrigin]);

    useEffect(() => {
      awaiting3DRef.current = awaiting3D;
    }, [awaiting3D]);

    // -----------------------------------
    // ONLY ADDITION #1: Give the safe a name (if it's the safe file).
    // -----------------------------------
    const loadAndAddModel = async (
      modelPath: string,
      position: THREE.Vector3,
    ) => {
      if (!sceneRef.current) return;

      // Ensure modelPath is a valid string before processing.
      if (!modelPath || typeof modelPath !== "string") {
        console.error("Invalid modelPath provided:", modelPath);
        return null;
      }

      // If modelPath does not include the 'models/' folder, prepend it.
      let finalModelPath = modelPath;
      if (!modelPath.startsWith("models/")) {
        finalModelPath = `models/${modelPath}`;
      }
      const fullModelPath = `/${finalModelPath}`;

      try {
        const model = await loadModelWithFallback(fullModelPath);

        // Calculate bounding box for scaling
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        // Scale the model to a reasonable size (adjust 0.5 as needed)
        const scale = 0.1 / maxDim;
        model.scale.multiplyScalar(scale);

        // Position the model at the clicked point
        model.position.copy(position);

        sceneRef.current?.add(model);
        return model;
      } catch (error) {
        console.error("Error loading model:", error);
        return null;
      }
    };

    const propsRef = useRef(props);

    // This effect runs on every render to keep the ref updated with the latest props
    useEffect(() => {
      propsRef.current = props;
    });

    useEffect(() => {
      if (!mountRef.current || !modelPath) return;

      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // 🔥 ADD THE ORIGIN NODE CREATION RIGHT HERE:
      const originNode = new THREE.Object3D();
      originNode.name = "OriginNode";
      // 🚨 CRITICAL FIX: Set the position immediately if originPoint exists
      if (originPoint) {
        originNode.position.copy(originPoint);
        console.log(
          "🎯 Origin node positioned at:",
          originNode.position.toArray(),
        );
      } else {
        originNode.position.set(0, 0, 0);
        console.log("🎯 Origin node positioned at default (0,0,0)");
      }

      scene.add(originNode);
      originNodeRef.current = originNode;

      {
        // Create an improved drag indicator system
        const circleGeo = new THREE.CircleGeometry(0.18, 16); // Slightly larger but fewer segments
        const circleMat = new THREE.MeshBasicMaterial({
          color: 0x00ff00,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide,
          depthTest: false, // Make sure it's always visible
        });
        const dragIndicator = new THREE.Mesh(circleGeo, circleMat);
        dragIndicator.rotation.x = -Math.PI / 2;
        dragIndicator.renderOrder = 9999; // Ensure it renders on top
        dragIndicator.visible = false;
        scene.add(dragIndicator);

        // Store the circle in ref
        dragCircleRef.current = dragIndicator;

        // No animation function needed
        // Using let to avoid direct assignment to read-only ref.current
        let animateFunc = animateDragIndicatorRef.current;
        animateFunc = null;
      }

      // Create an invisible plane for faster raycasting during drag operations
      const dragPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(1000, 1000),
        new THREE.MeshBasicMaterial({
          visible: false,
          side: THREE.DoubleSide,
        }),
      );
      dragPlane.rotation.x = -Math.PI / 2; // Horizontal plane
      dragPlane.name = "dragPlane";
      scene.add(dragPlane);

      // --- Area preview (new) ---
      {
        const previewGeom = new THREE.PlaneGeometry(1, 1);
        const previewMat = new THREE.MeshBasicMaterial({
          color: 0x3b82f6, // tailwind blue-600-ish
          transparent: true,
          opacity: 0.25,
          side: THREE.DoubleSide,
          depthTest: false,
        });
        const preview = new THREE.Mesh(previewGeom, previewMat);
        preview.visible = false;
        preview.renderOrder = 9998;
        scene.add(preview);
        areaPreviewRef.current = preview;

        const edges = new THREE.EdgesGeometry(previewGeom);
        const outline = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({
            color: 0x3b82f6,
            transparent: true,
            opacity: 0.9,
            depthTest: false,
          }),
        );
        outline.visible = false;
        outline.renderOrder = 9999;
        scene.add(outline);
        areaPreviewOutlineRef.current = outline;
      }

      scene.background = new THREE.Color(0xf0f0f0);

      const camera = new THREE.PerspectiveCamera(
        75,
        mountRef.current.clientWidth / mountRef.current.clientHeight,
        0.1,
        1000,
      );
      cameraRef.current = camera;
      camera.position.set(0.55, 0.55, 0.55);

      // Add checks and error handling for WebGL renderer creation
      let renderer;
      try {
        // Make sure mountRef.current exists and we're in a browser environment
        if (typeof window !== "undefined" && mountRef.current) {
          renderer = new THREE.WebGLRenderer({
            antialias: true,
            canvas: document.createElement("canvas"), // Create a canvas element first
            alpha: true, // Add alpha for better compatibility
          });
          renderer.setSize(
            mountRef.current.clientWidth,
            mountRef.current.clientHeight,
          );
          mountRef.current.appendChild(renderer.domElement);
        } else {
          console.warn("DOM not ready for WebGL initialization");
          return; // Exit early if not ready
        }
      } catch (error) {
        console.error("Failed to create WebGL renderer:", error);
        // Create a fallback message for the user
        if (mountRef.current) {
          const errorDiv = document.createElement("div");
          errorDiv.style.position = "absolute";
          errorDiv.style.top = "0";
          errorDiv.style.left = "0";
          errorDiv.style.width = "100%";
          errorDiv.style.height = "100%";
          errorDiv.style.display = "flex";
          errorDiv.style.alignItems = "center";
          errorDiv.style.justifyContent = "center";
          errorDiv.style.backgroundColor = "#f0f0f0";
          errorDiv.style.color = "#333";
          errorDiv.style.padding = "20px";
          errorDiv.style.boxSizing = "border-box";
          errorDiv.style.textAlign = "center";
          errorDiv.innerHTML =
            "<p>WebGL not supported. Please try a different browser or device.</p>";
          mountRef.current.appendChild(errorDiv);
        }
        return;
      }
      renderer.setPixelRatio(window.devicePixelRatio);
      mountRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // --- Begin CSS3DRenderer Setup ---
      // Create a CSS3DRenderer for HTML/CSS elements (such as your webpage iframe)
      let cssRenderer: CSS3DRenderer | undefined; // Add type for clarity
      if (typeof window !== "undefined" && mountRef.current) {
        cssRenderer = new CSS3DRenderer(); // <<< USE THE IMPORTED RENDERER
        cssRenderer.setSize(
          mountRef.current.clientWidth,
          mountRef.current.clientHeight,
        );
        cssRenderer.domElement.style.position = "absolute";
        cssRenderer.domElement.style.top = "0px";
        // Crucial: The main CSS3DRenderer overlay should not intercept pointer events,
        // allowing clicks to reach the WebGL canvas. Individual HTML elements
        // within CSS3DObjects can have 'pointer-events: auto'.
        cssRenderer.domElement.style.pointerEvents = "none";
        mountRef.current.appendChild(cssRenderer.domElement);
      }
      // --- End CSS3DRenderer Setup ---

      const orbitControls = new OrbitControls(camera, renderer.domElement);
      orbitControls.enableDamping = true;
      const initialDistance = camera.position.distanceTo(orbitControls.target);
      orbitControls.maxDistance = initialDistance * MAX_ZOOM_OUT_MULTIPLIER;
      orbitControlsRef.current = orbitControls;

      // Create the transform controls directly using the imported module
      const transformControls = new TransformControls(
        camera,
        renderer.domElement,
      );
      transformControlsRef.current = transformControls;
      scene.add(transformControls);

      // Configure the controls
      if (transformControlsRef.current) {
        configureTransformControls(transformControlsRef.current);
      }

      // ---- Walk controls (PointerLock) ----
      const initWalkControls = () => {
        if (!cameraRef.current || !rendererRef.current) return;
        if (pointerLockRef.current) {
          pointerLockRef.current.disconnect();
          pointerLockRef.current = null;
        }
        const plc = new PointerLockControls(
          cameraRef.current,
          rendererRef.current.domElement,
        );
        pointerLockRef.current = plc;
        plc.addEventListener("lock", () => {
          if (orbitControlsRef.current)
            orbitControlsRef.current.enabled = false;
          if (transformControlsRef.current)
            transformControlsRef.current.enabled = false;
          onWalkModeChange?.(true);
        });
        plc.addEventListener("unlock", () => {
          isWalkModeRef.current = false;
          setIsWalkMode(false);
          onWalkModeChange?.(false);
          if (orbitControlsRef.current) orbitControlsRef.current.enabled = true;
          if (transformControlsRef.current)
            transformControlsRef.current.enabled = true;
        });
      };
      initWalkControls();

      // handleTransformKeyDown is called later once controls are loaded
      const handleTransformKeyDown = (event: KeyboardEvent) => {
        // Use selectedAnchorId to ensure an anchor is actually selected for transform
        if (!selectedAnchorId || !transformControlsRef.current?.object) return;

        const currentControls = transformControlsRef.current; // Use ref here

        switch (event.key.toLowerCase()) {
          case "g": // Move
            currentControls.setMode("translate");
            setTransformMode("translate"); // Keep state in sync if needed elsewhere
            break;
          case "r": // Rotate
            currentControls.setMode("rotate");
            setTransformMode("rotate");
            break;
          case "s": // Scale
            // Prevent scaling CSS3DObjects via helper mesh if desired
            if (currentControls.object?.userData?.type?.includes("helper")) {
              // Or check if selectedAnchorType is text/webpage/pdf etc.
              console.warn(
                "Scaling is generally not recommended for CSS-based anchors.",
              );
              // Optionally allow it, or just return
              // return;
            }
            currentControls.setMode("scale");
            setTransformMode("scale");
            break;
          case "escape": // Cancel transformations / Deselect
            console.log("Escape pressed - Deselecting");
            handleDeselect(); // Use the central deselect handler
            break;
        }
      };
      window.addEventListener("keydown", handleTransformKeyDown);

      // Use transformControlsRef.current instead of transformControls
      transformControlsRef.current!.addEventListener(
        "dragging-changed",
        (event) => {
          orbitControls.enabled = !event.value;
        },
      );

      transformControlsRef.current!.addEventListener("mouseUp", () => {
        if (orbitControlsRef.current && !isMarkerSelectedRef.current) {
          orbitControlsRef.current.enabled = true;
        }
      });

      transformControlsRef.current!.addEventListener("objectChange", () => {
        const controlledObject = transformControlsRef.current!.object;
        if (controlledObject && controlledObject instanceof THREE.Mesh) {
          const draggedPointLabel = controlledObject.userData.label;
          if (draggedPointLabel && setReferencePoints3D) {
            setReferencePoints3D((oldPoints) => {
              const updatedPoints = [...oldPoints];
              const idx = updatedPoints.findIndex(
                (pt) => pt.label === draggedPointLabel,
              );
              if (idx !== -1) {
                updatedPoints[idx] = {
                  ...updatedPoints[idx],
                  x: controlledObject.position.x,
                  y: controlledObject.position.y,
                  z: controlledObject.position.z,
                  x3D: controlledObject.position.x,
                  y3D: controlledObject.position.y,
                  z3D: controlledObject.position.z,
                };
              }
              return updatedPoints;
            });
          }
        }
      });

      // --- Area marking v2: pointer handlers ---
      const markThickness = 0.05; // world meters

      function getMouseNDC(e: PointerEvent) {
        const rect = mountRef.current!.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        return new THREE.Vector2(x, y);
      }

      function chooseLockedNormal(n: THREE.Vector3) {
        const a = new THREE.Vector3(
          Math.abs(n.x),
          Math.abs(n.y),
          Math.abs(n.z),
        );
        if (a.y >= a.x && a.y >= a.z)
          return new THREE.Vector3(0, Math.sign(n.y) || 1, 0); // floor/ceiling
        if (a.x >= a.z) return new THREE.Vector3(Math.sign(n.x) || 1, 0, 0); // wall (YZ)
        return new THREE.Vector3(0, 0, Math.sign(n.z) || 1); // wall (XY)
      }

      function basisFromNormal(
        origin: THREE.Vector3,
        N: THREE.Vector3,
      ): AreaBasis {
        const U = new THREE.Vector3();
        const V = new THREE.Vector3();
        const helper =
          Math.abs(N.y) > 0.9
            ? new THREE.Vector3(1, 0, 0)
            : new THREE.Vector3(0, 1, 0);
        U.crossVectors(helper, N).normalize();
        V.crossVectors(N, U).normalize();
        return { origin: origin.clone(), U, V, N: N.clone().normalize() };
      }

      function rectCornerWorld(b: AreaBasis, u: number, v: number) {
        return b.origin.clone().addScaledVector(b.U, u).addScaledVector(b.V, v);
      }

      const onPointerDown = (e: PointerEvent) => {
        if (
          !isMarkingAreaRef.current ||
          !cameraRef.current ||
          !parentModelRef.current
        )
          return;

        const ndc = getMouseNDC(e);
        raycasterRef.current.setFromCamera(ndc, cameraRef.current);
        const hits = raycasterRef.current.intersectObject(
          parentModelRef.current,
          true,
        );
        if (hits.length === 0) return;

        const hit = hits[0];
        const hitPoint = hit.point.clone();
        const faceNormal = (hit.face?.normal || new THREE.Vector3(0, 1, 0))
          .clone()
          .transformDirection(hit.object.matrixWorld)
          .normalize();

        const N = chooseLockedNormal(faceNormal);
        const basis = basisFromNormal(hitPoint, N);
        areaBasisRef.current = basis;
        areaPlaneRef.current = new THREE.Plane().setFromNormalAndCoplanarPoint(
          N,
          hitPoint,
        );
        areaUVRef.current = { u1: 0, v1: 0 }; // start at origin

        // show preview aligned with basis
        if (areaPreviewRef.current && areaPreviewOutlineRef.current) {
          const rot = new THREE.Matrix4().makeBasis(basis.U, basis.V, basis.N);
          areaPreviewRef.current.setRotationFromMatrix(rot);
          areaPreviewOutlineRef.current.setRotationFromMatrix(rot);
          areaPreviewRef.current.position.copy(hitPoint);
          areaPreviewOutlineRef.current.position.copy(hitPoint);
          areaPreviewRef.current.scale.set(0.001, 0.001, 1);
          areaPreviewOutlineRef.current.scale.set(0.001, 0.001, 1);
          areaPreviewRef.current.visible = true;
          areaPreviewOutlineRef.current.visible = true;
        }

        if (orbitControlsRef.current) orbitControlsRef.current.enabled = false;
      };

      const onPointerMove = (e: PointerEvent) => {
        if (
          !isMarkingAreaRef.current ||
          !cameraRef.current ||
          !areaPlaneRef.current ||
          !areaBasisRef.current
        ) {
          return;
        }

        const ndc = getMouseNDC(e);
        raycasterRef.current.setFromCamera(ndc, cameraRef.current);
        const p = new THREE.Vector3();
        const hit = raycasterRef.current.ray.intersectPlane(
          areaPlaneRef.current,
          p,
        );
        if (!hit) return;

        const b = areaBasisRef.current;
        const rel = p.clone().sub(b.origin);
        const u = rel.dot(b.U);
        const v = rel.dot(b.V);

        areaUVRef.current = { u1: u, v1: v };

        // center & size in plane space
        const uMin = Math.min(0, u);
        const uMax = Math.max(0, u);
        const vMin = Math.min(0, v);
        const vMax = Math.max(0, v);
        const center = rectCornerWorld(b, (uMin + uMax) / 2, (vMin + vMax) / 2);
        const width = Math.max(0.01, uMax - uMin);
        const height = Math.max(0.01, vMax - vMin);

        if (areaPreviewRef.current && areaPreviewOutlineRef.current) {
          areaPreviewRef.current.position.copy(center);
          areaPreviewOutlineRef.current.position.copy(center);
          areaPreviewRef.current.scale.set(width, height, 1);
          areaPreviewOutlineRef.current.scale.set(width, height, 1);
        }
      };

      const onPointerUp = (_e: PointerEvent) => {
        if (
          !isMarkingAreaRef.current ||
          !areaBasisRef.current ||
          !areaUVRef.current
        )
          return;

        const b = areaBasisRef.current;
        const { u1, v1 } = areaUVRef.current;

        const uMin = Math.min(0, u1);
        const uMax = Math.max(0, u1);
        const vMin = Math.min(0, v1);
        const vMax = Math.max(0, v1);

        const corners = [
          rectCornerWorld(b, uMin, vMin),
          rectCornerWorld(b, uMax, vMin),
          rectCornerWorld(b, uMax, vMax),
          rectCornerWorld(b, uMin, vMax),
        ];

        const box = new THREE.Box3();
        for (const c of corners) {
          box.expandByPoint(c.clone().addScaledVector(b.N, -markThickness / 2));
          box.expandByPoint(c.clone().addScaledVector(b.N, markThickness / 2));
        }

        // hide preview & reset
        if (areaPreviewRef.current && areaPreviewOutlineRef.current) {
          areaPreviewRef.current.visible = false;
          areaPreviewOutlineRef.current.visible = false;
        }
        areaPlaneRef.current = null;
        areaUVRef.current = null;
        areaBasisRef.current = null;
        if (orbitControlsRef.current) orbitControlsRef.current.enabled = true;

        onAreaMarked?.({
          min: { x: box.min.x, y: box.min.y, z: box.min.z },
          max: { x: box.max.x, y: box.max.y, z: box.max.z },
        });
      };

      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(5, 5, 5);
      scene.add(directionalLight);

      const markerGeometry = new THREE.SphereGeometry(0.02, 16, 16);
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      const clickMarker = new THREE.Mesh(markerGeometry, markerMaterial);
      clickMarkerRef.current = clickMarker;
      scene.add(clickMarker);
      clickMarker.visible = false;

      const fullModelPath = modelPath ? encodeURI(modelPath) : "";

      if (!fullModelPath) {
        console.error("No modelPath provided to ThreeViewer");
        onError?.("No 3D model path provided");
        return;
      }

      console.log("Attempting to fetch 3D model from:", fullModelPath);
      const isUSDZ = fullModelPath.toLowerCase().endsWith(".usdz");
      const loader: any = isUSDZ ? new USDZLoader() : new GLTFLoader();

      // Set cross-origin setting for the loader
      loader.setCrossOrigin("anonymous");

      // For Firebase Storage URLs, we need to handle them directly
      if (fullModelPath.includes("firebasestorage.googleapis.com")) {
        console.log("Loading model from direct URL:", fullModelPath);

        // Add special request header management for Firebase Storage
        // Create a custom loader manager for Firebase URLs
        const manager = new THREE.LoadingManager();
        manager.setURLModifier((url) => {
          // If it's a Firebase URL and we're having CORS issues, we could potentially:
          // 1. Try with a different token parameter format
          // 2. Route through a CORS proxy if available
          // 3. Add additional error handling specific to Firebase Storage
          return url;
        });

        loader.manager = manager;
      }

      // Set up loading with retry logic
      const loadModelWithRetry = (attempt = 0, maxAttempts = 3) => {
        console.log(
          `Loading model attempt ${attempt + 1}/${maxAttempts}: ${fullModelPath}`,
        );

        loader.load(
          fullModelPath,
          (gltf: any) => {
            console.log("Model loaded successfully");
            const model = gltf.scene || gltf;
            parentModelRef.current = model;
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2 / maxDim;
            model.scale.multiplyScalar(scale);
            model.position.copy(center).multiplyScalar(-scale);
            scene.add(model);
            walkBoundsRef.current = new THREE.Box3().setFromObject(model);
            setModelLoadProgress(100);
            setModelLoaded(true);
            onLoad?.();
            camera.position.set(0.55, 0.55, 0.55);
            orbitControls.target.set(0, 0, 0);
            orbitControls.update();
          },
          (xhr) => {
            if (xhr.lengthComputable) {
              const percentComplete = (xhr.loaded / xhr.total) * 100;
              setModelLoadProgress(percentComplete);
            } else {
              console.log(`Downloaded ${xhr.loaded} bytes so far`);
            }
          },
          (error) => {
            console.error(
              `Error loading model (attempt ${attempt + 1}):`,
              error,
            );

            // Check for network-related errors that shouldn't be retried
            const errorMessage = error?.message || error?.toString() || "";
            const isNetworkError =
              errorMessage.includes("Failed to fetch") ||
              errorMessage.includes("CORS") ||
              errorMessage.includes("ERR_FAILED") ||
              errorMessage.includes("ERR_NETWORK") ||
              errorMessage.includes("ERR_INTERNET_DISCONNECTED") ||
              errorMessage.includes("404") ||
              errorMessage.includes("Not Found") ||
              (error as any)?.code === "NetworkError" ||
              (error as any)?.name === "NetworkError";

            if (isNetworkError) {
              console.log(
                `Network error detected: ${errorMessage}. Immediately loading fallback model...`,
              );
              loadFallbackModel();
              return;
            }

            // For non-network errors (like parsing errors), try retrying
            if (attempt < maxAttempts - 1) {
              console.log(
                `Retrying model load... Attempt ${attempt + 2}/${maxAttempts}`,
              );
              setTimeout(
                () => {
                  loadModelWithRetry(attempt + 1, maxAttempts);
                },
                1000 * (attempt + 1),
              ); // Exponential backoff
            } else {
              console.log("All retries exhausted, loading fallback model...");
              loadFallbackModel();
            }
          },
        );
      };

      // Fallback model loader
      const loadFallbackModel = () => {
        const fallbackUrl =
          "https://f005.backblazeb2.com/file/objectModels-dev/6_26_2025.glb";
        console.log("Loading fallback model:", fallbackUrl);

        const fallbackLoader = new GLTFLoader();
        fallbackLoader.load(
          fallbackUrl,
          (gltf: any) => {
            console.log("Fallback model loaded successfully");
            const model = gltf.scene || gltf;
            parentModelRef.current = model;
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2 / maxDim;
            model.scale.multiplyScalar(scale);
            model.position.copy(center).multiplyScalar(-scale);
            scene.add(model);
            setModelLoadProgress(100);
            setModelLoaded(true);
            onLoad?.();
            camera.position.set(0.55, 0.55, 0.55);
            orbitControls.target.set(0, 0, 0);
            orbitControls.update();
          },
          (xhr) => {
            if (xhr.lengthComputable) {
              const percentComplete = (xhr.loaded / xhr.total) * 100;
              setModelLoadProgress(percentComplete);
            }
          },
          (error) => {
            console.error("Error loading fallback model:", error);

            // Try a different fallback URL if the first one fails
            const backupFallbackUrl =
              "https://f005.backblazeb2.com/file/objectModels-dev/home.glb";
            console.log("Trying backup fallback model:", backupFallbackUrl);

            fallbackLoader.load(
              backupFallbackUrl,
              (gltf: any) => {
                console.log("Backup fallback model loaded successfully");
                const model = gltf.scene || gltf;
                parentModelRef.current = model;
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 2 / maxDim;
                model.scale.multiplyScalar(scale);
                model.position.copy(center).multiplyScalar(-scale);
                scene.add(model);
                setModelLoadProgress(100);
                setModelLoaded(true);
                onLoad?.();
                camera.position.set(0.55, 0.55, 0.55);
                orbitControls.target.set(0, 0, 0);
                orbitControls.update();
              },
              undefined,
              (backupError) => {
                console.error(
                  "Error loading backup fallback model:",
                  backupError,
                );
                // If all fallbacks fail, call the error handler
                if (onError) {
                  onError("All model loading attempts failed");
                }
              },
            );
          },
        );
      };

      // Add a safety check before starting
      try {
        console.log("Starting model load process for:", fullModelPath);
        loadModelWithRetry(0, 3);
      } catch (error) {
        console.error("Error starting model load:", error);
        loadFallbackModel();
      }

      const handleRightClick = (event: MouseEvent) => {
        event.preventDefault();
        if (!mountRef.current) return;

        const rect = mountRef.current.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const mouse = new THREE.Vector2(x, y);
        raycasterRef.current.setFromCamera(mouse, camera);

        const intersects = raycasterRef.current.intersectObjects(
          scene.children,
          true,
        );

        if (intersects.length > 0) {
          const hitPoint = intersects[0].point;

          if (originPoint) {
            const offset = hitPoint.clone().sub(originPoint);
            const msg = `Relative to origin: X:${(offset.x * SCALE_FACTOR).toFixed(2)}, Y:${(offset.y * SCALE_FACTOR).toFixed(2)}, Z:${(offset.z * SCALE_FACTOR).toFixed(2)}`;
            setDistanceDisplay(msg);
          }

          if (clickMarkerRef.current) {
            clickMarkerRef.current.position.copy(hitPoint);
            clickMarkerRef.current.visible = true;
            setSelectedPoint(hitPoint.clone());
            setShowSidePanel(true);
            transformControlsRef.current?.detach();
            isMarkerSelectedRef.current = false;
          }
        }
      };

      async function handleClick(event: MouseEvent) {
        // Prevent the click from bubbling to other handlers
        event.stopPropagation();

        // NEW: ignore normal click handling while marking areas
        if (isMarkingAreaRef.current) return;

        // Use a ref to get the latest props inside this event handler,
        // as it's defined in a useEffect that only runs once.
        const currentProps = propsRef.current;

        if (
          !mountRef.current ||
          !sceneRef.current ||
          !cameraRef.current ||
          !transformControlsRef.current
        ) {
          return;
        }

        if (transformControlsRef.current.dragging) {
          return;
        }

        // --- Setup Raycasting (keep this part) ---
        const rect = mountRef.current.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        const mouse = new THREE.Vector2(x, y);
        raycasterRef.current.setFromCamera(mouse, cameraRef.current);

        let modelIntersects: THREE.Intersection[] = [];
        if (parentModelRef.current) {
          modelIntersects = raycasterRef.current.intersectObject(
            parentModelRef.current,
            true,
          );
        }

        // --- 1. Handle Special Modes (like Origin Setting) ---
        // These modes take priority over all other click actions.

        // Two-step origin setting (position)
        if (
          currentProps.originSettingStep === "picking_position" &&
          currentProps.onOriginPositionPicked
        ) {
          if (modelIntersects.length > 0) {
            currentProps.onOriginPositionPicked(
              modelIntersects[0].point.clone(),
            );
          } else {
            console.log("Origin position picking click missed the model.");
          }
          return; // Exit after handling
        }

        // Two-step origin setting (direction)
        if (
          currentProps.originSettingStep === "picking_direction" &&
          currentProps.onOriginDirectionPicked &&
          currentProps.tempOriginPos
        ) {
          if (modelIntersects.length > 0) {
            currentProps.onOriginDirectionPicked(
              currentProps.tempOriginPos.clone(),
              modelIntersects[0].point.clone(),
            );
          } else {
            console.log("Origin direction picking click missed the model.");
          }
          return; // Exit after handling
        }

        // One-step (legacy) origin setting
        if (isChoosingOriginRef.current && currentProps.onOriginSet) {
          if (modelIntersects.length > 0) {
            currentProps.onOriginSet(modelIntersects[0].point.clone());
          } else {
            setOriginConfirmation(
              "Please click on the model to set the origin.",
            );
          }
          return; // Exit
        }

        // --- 2. Handle Placement Modes (QR, Text, etc.) ---

        if (qrPlacementModeRef.current && currentProps.onQRPlaced) {
          if (modelIntersects.length > 0) {
            currentProps.onQRPlaced(modelIntersects[0].point.clone());
          }
          return;
        }

        if (
          showTextBoxInputRef?.current &&
          pendingLabelTextRef?.current &&
          currentProps.onTextBoxSubmit
        ) {
          if (modelIntersects.length > 0) {
            const hitPoint = modelIntersects[0].point.clone();
            const textToPlace = pendingLabelTextRef.current;
            showTextBoxInputRef.current = false;
            pendingLabelTextRef.current = "";
            currentProps.onTextBoxSubmit(
              textToPlace,
              convertToRealWorldCoords(hitPoint),
            );
          }
          return;
        }

        // Generic placement mode for links, files, models
        if (placementModeRef.current && currentProps.onPlacementComplete) {
          if (modelIntersects.length > 0) {
            currentProps.onPlacementComplete(
              placementModeRef.current,
              modelIntersects[0].point.clone(),
              null,
            );
          }
          return;
        }

        // Alignment wizard point placement
        if (
          awaiting3DRef.current &&
          activeLabelRef.current &&
          currentProps.setReferencePoints3D
        ) {
          if (modelIntersects.length > 0) {
            const alignHitPoint = modelIntersects[0].point.clone();
            const sphereGeom = new THREE.SphereGeometry(0.02, 16, 16);
            const sphereMat = new THREE.MeshBasicMaterial({
              color: labelColors[activeLabelRef.current],
            });
            const newSphere = new THREE.Mesh(sphereGeom, sphereMat);
            newSphere.position.copy(alignHitPoint);
            newSphere.userData.label = activeLabelRef.current;

            // Remove existing marker for this label if present
            if (alignmentMarkersRef.current.has(activeLabelRef.current)) {
              const oldMarker = alignmentMarkersRef.current.get(
                activeLabelRef.current,
              )!;
              sceneRef.current.remove(oldMarker);
              oldMarker.geometry.dispose();
              const oldMat = oldMarker.material as
                | THREE.Material
                | THREE.Material[];
              if (Array.isArray(oldMat)) {
                oldMat.forEach((m) => m.dispose());
              } else {
                oldMat.dispose();
              }
            }

            sceneRef.current.add(newSphere);
            alignmentMarkersRef.current.set(activeLabelRef.current, newSphere);

            // 1. ADD THIS: Immediately update the state with the new point's 3D coordinates.
            const newPoint = {
              id: `ref-${activeLabelRef.current}-${Date.now()}`, // Unique ID for the point
              label: activeLabelRef.current,
              x: 0,
              y: 0,
              z: 0, // 2D coords, not relevant for this action
              x3D: alignHitPoint.x,
              y3D: alignHitPoint.y,
              z3D: alignHitPoint.z,
            };
            currentProps.setReferencePoints3D((prevPoints) => [
              ...prevPoints,
              newPoint,
            ]);

            // 2. REMOVED: The line below was causing the gizmo to appear.
            // transformControlsRef.current.attach(newSphere);

            currentProps.setAwaiting3D?.(false);
          }
          return;
        }

        // --- 3. Handle Regular Interactions (Selecting/Deselecting) ---
        const allIntersects = raycasterRef.current.intersectObjects(
          sceneRef.current.children,
          true,
        );
        const visibleIntersects = allIntersects.filter((intersect) => {
          const obj = intersect.object;
          return (
            obj.visible &&
            obj !== originMarkerRef.current &&
            !obj.name.startsWith("highlight-") &&
            obj.name !== "dragPlane" &&
            obj !== dragCircleRef.current &&
            !(
              transformControlsRef.current &&
              obj.isDescendantOf?.(transformControlsRef.current)
            )
          );
        });

        if (visibleIntersects.length === 0) {
          // Clicked on empty space
          handleDeselect();
          currentProps.onBackgroundClick?.();
          return;
        }

        // --- Logic for selecting an anchor ---
        let clickedObj = visibleIntersects[0].object;
        let foundAnchor = false;

        while (clickedObj) {
          if (clickedObj.userData?.anchorId && clickedObj.userData?.type) {
            const { anchorId, type } = clickedObj.userData;
            let selectableType: "text" | "file" | "model" | "webpage" | null =
              null;

            if (type.startsWith("text")) selectableType = "text";
            else if (type.startsWith("file")) selectableType = "file";
            else if (type.startsWith("model")) selectableType = "model";
            else if (type.startsWith("webpage")) selectableType = "webpage";

            if (selectableType) {
              handleAnchorSelect(anchorId, clickedObj, selectableType);
              foundAnchor = true;
              break;
            }
          }
          clickedObj = clickedObj.parent as THREE.Object3D;
        }

        // --- 4. Fallback Behavior (like showing distance) ---
        if (!foundAnchor) {
          handleDeselect(); // Deselect if click didn't result in selecting a new anchor

          if (currentProps.originPoint && modelIntersects.length > 0) {
            const displayOffset = modelIntersects[0].point
              .clone()
              .sub(currentProps.originPoint);

            // Apply coordinate system correction based on yRotation for display using proper rotation matrix
            let correctedDisplayOffset = displayOffset.clone();
            const rotationDegrees = yRotation || 0;
            const rotationRadians = (rotationDegrees * Math.PI) / 180;
            const cosTheta = Math.cos(rotationRadians);
            const sinTheta = Math.sin(rotationRadians);

            // Apply Y-axis rotation matrix for display
            correctedDisplayOffset.set(
              displayOffset.x * cosTheta + displayOffset.z * sinTheta, // x' = x*cos(θ) + z*sin(θ)
              displayOffset.y, // y' = y (unchanged)
              -displayOffset.x * sinTheta + displayOffset.z * cosTheta, // z' = -x*sin(θ) + z*cos(θ)
            );
            // If rotationDegrees === 0, use displayOffset as-is (no correction)

            const msg = `Relative to origin: X:${(correctedDisplayOffset.x * SCALE_FACTOR).toFixed(2)}, Y:${(correctedDisplayOffset.y * SCALE_FACTOR).toFixed(2)}, Z:${(correctedDisplayOffset.z * SCALE_FACTOR).toFixed(2)} ft`;
            setDistanceDisplay(msg);
          }
        }
      }

      function getNDCCoords(event: MouseEvent, container: HTMLDivElement) {
        const rect = container.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        return { x, y };
      }

      function doRaycast(
        x: number,
        y: number,
        camera: THREE.Camera,
        scene: THREE.Scene,
      ) {
        raycasterRef.current.setFromCamera(new THREE.Vector2(x, y), camera);
        return raycasterRef.current.intersectObjects(scene.children, true);
      }

      // ---- Walk start: first click chooses the drop point ----
      const handleWalkStartClick = (e: MouseEvent) => {
        if (!isWalkModeRef.current || pointerLockRef.current?.isLocked) return;
        if (!cameraRef.current || !sceneRef.current || !mountRef.current)
          return;
        const rect = mountRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const mouse = new THREE.Vector2(x, y);
        raycasterRef.current.setFromCamera(mouse, cameraRef.current);
        const hits = raycasterRef.current.intersectObjects(
          sceneRef.current.children,
          true,
        );
        if (hits.length > 0) {
          const p = hits[0].point.clone();
          let floorY = walkBoundsRef.current?.min.y ?? p.y;
          if (parentModelRef.current && walkBoundsRef.current) {
            const start = new THREE.Vector3(
              p.x,
              walkBoundsRef.current.max.y + 1,
              p.z,
            );
            const downRay = new THREE.Raycaster(
              start,
              new THREE.Vector3(0, -1, 0),
            );
            const downHits = downRay.intersectObject(
              parentModelRef.current,
              true,
            );
            if (downHits.length > 0) {
              floorY = downHits[downHits.length - 1].point.y;
            }
          }
          const bounds = walkBoundsRef.current;
          const eye = walkParamsRef.current.eye;
          const newX = bounds
            ? THREE.MathUtils.clamp(p.x, bounds.min.x, bounds.max.x)
            : p.x;
          const newZ = bounds
            ? THREE.MathUtils.clamp(p.z, bounds.min.z, bounds.max.z)
            : p.z;
          cameraRef.current.position.set(newX, floorY + eye, newZ);
          pointerLockRef.current?.lock();
          e.stopPropagation();
        }
      };

      // ---- Keyboard for movement ----
      const onKeyDown = (e: KeyboardEvent) => {
        switch (e.code) {
          case "KeyW":
          case "ArrowUp":
            keysRef.current.forward = true;
            e.preventDefault();
            break;
          case "KeyS":
          case "ArrowDown":
            keysRef.current.back = true;
            e.preventDefault();
            break;
          case "KeyA":
          case "ArrowLeft":
            keysRef.current.left = true;
            e.preventDefault();
            break;
          case "KeyD":
          case "ArrowRight":
            keysRef.current.right = true;
            e.preventDefault();
            break;
          case "ShiftLeft":
          case "ShiftRight":
            keysRef.current.sprint = true;
            break;
        }
      };
      const onKeyUp = (e: KeyboardEvent) => {
        switch (e.code) {
          case "KeyW":
          case "ArrowUp":
            keysRef.current.forward = false;
            e.preventDefault();
            break;
          case "KeyS":
          case "ArrowDown":
            keysRef.current.back = false;
            e.preventDefault();
            break;
          case "KeyA":
          case "ArrowLeft":
            keysRef.current.left = false;
            e.preventDefault();
            break;
          case "KeyD":
          case "ArrowRight":
            keysRef.current.right = false;
            e.preventDefault();
            break;
          case "ShiftLeft":
          case "ShiftRight":
            keysRef.current.sprint = false;
            break;
        }
      };
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);

      mountRef.current.addEventListener("contextmenu", handleRightClick);
      mountRef.current.addEventListener("click", handleWalkStartClick, {
        capture: true,
      });
      // Clicks should not bubble to parent elements
      mountRef.current.addEventListener("click", handleClick);

      function animate() {
        requestAnimationFrame(animate);

        // Minimal updates during animation
        TWEEN.update();

        // Always update orbit controls - they should remain responsive
        // if (orbitControls) {
        orbitControls.update();
        //  }

        // ---- Walk step (runs only while in walk mode) ----
        const delta = clockRef.current.getDelta();
        if (
          isWalkModeRef.current &&
          pointerLockRef.current?.isLocked &&
          camera
        ) {
          const cam = camera;
          const { velocity, direction, accel, damping, sprintMul, eye } =
            walkParamsRef.current;

          velocity.x -= velocity.x * damping * delta;
          velocity.z -= velocity.z * damping * delta;

          direction.set(0, 0, 0);
          if (keysRef.current.forward) direction.z -= 1;
          if (keysRef.current.back) direction.z += 1;
          if (keysRef.current.left) direction.x -= 1;
          if (keysRef.current.right) direction.x += 1;
          if (direction.lengthSq() > 0) direction.normalize();

          const speed = accel * (keysRef.current.sprint ? sprintMul : 1);
          velocity.x += direction.x * speed * delta;
          velocity.z += direction.z * speed * delta;

          pointerLockRef.current.moveRight(velocity.x * delta);
          pointerLockRef.current.moveForward(-velocity.z * delta);

          if (walkBoundsRef.current) {
            cam.position.x = THREE.MathUtils.clamp(
              cam.position.x,
              walkBoundsRef.current.min.x,
              walkBoundsRef.current.max.x,
            );
            cam.position.z = THREE.MathUtils.clamp(
              cam.position.z,
              walkBoundsRef.current.min.z,
              walkBoundsRef.current.max.z,
            );
          }

          let floorY = walkBoundsRef.current?.min.y ?? cam.position.y;
          if (parentModelRef.current && walkBoundsRef.current) {
            const start = new THREE.Vector3(
              cam.position.x,
              walkBoundsRef.current.max.y + 1,
              cam.position.z,
            );
            const downRay = new THREE.Raycaster(
              start,
              new THREE.Vector3(0, -1, 0),
            );
            const floorHits = downRay.intersectObject(
              parentModelRef.current,
              true,
            );
            if (floorHits.length > 0) {
              floorY = floorHits[floorHits.length - 1].point.y;
            }
          }
          cam.position.y = Math.min(
            floorY + eye,
            walkBoundsRef.current?.max.y ?? Infinity,
          );
        }

        // ─── Make each CSS3D label face the camera ───
        textAnchorsRef.current.forEach((labelObject) => {
          labelObject.rotation.set(0, 0, 0); // ← reset
          labelObject.lookAt(camera.position); // ← face camera
        });

        anchorWebpagesRef.current.forEach((cssObject) => {
          cssObject.rotation.set(0, 0, 0);
          cssObject.lookAt(camera.position);
        });

        // Single render pass
        if (renderer && scene && camera) {
          renderer.render(scene, camera);
          // Only render CSS if needed
          if (cssRenderer) cssRenderer.render(scene, camera);
        }
      }
      animate();

      function handleDragEnter(e: DragEvent) {
        e.preventDefault();
        // Show the green circle
        if (dragCircleRef.current) {
          dragCircleRef.current.visible = true;
        }
      }

      const throttleTime = 16; // ~60fps

      function handleDragOver(e: DragEvent) {
        e.preventDefault();

        // Always ensure the drag indicator is visible first
        if (dragCircleRef.current && !dragCircleRef.current.visible) {
          dragCircleRef.current.visible = true;
          dragCircleRef.current.scale.set(1, 1, 1);
        }

        // Check what's being dragged
        const isModelDrag =
          e.dataTransfer?.types.includes("application/model") || false;

        // Do a raycast so we know where to move the circle
        // Fast raycast against the drag plane only
        if (
          !cameraRef.current ||
          !dragCircleRef.current ||
          !mountRef.current ||
          !sceneRef.current
        )
          return;

        const rect = mountRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const mouse = new THREE.Vector2(x, y);
        raycasterRef.current.setFromCamera(mouse, cameraRef.current);

        // Only raycast against the drag plane for maximum performance
        const dragPlane = sceneRef.current.getObjectByName("dragPlane");
        if (dragPlane) {
          const intersects = raycasterRef.current.intersectObject(
            dragPlane,
            false,
          );

          if (intersects.length > 0) {
            // Direct position update - no animations
            const point = intersects[0].point;
            dragCircleRef.current.position.copy(point);

            // Ensure visibility without animations
            if (!dragCircleRef.current.visible) {
              dragCircleRef.current.visible = true;
            }
          }
        } else {
          // Fallback to scene raycast if drag plane not found (should be rare)
          const intersects = raycasterRef.current.intersectObjects(
            sceneRef.current.children.filter(
              (obj) => obj.name !== "dragCircle",
            ),
            false, // Don't check descendants for better performance
          );

          if (intersects.length > 0) {
            dragCircleRef.current.position.copy(intersects[0].point);
            dragCircleRef.current.visible = true;
          }
        }
      }

      function handleDragLeave(e: DragEvent) {
        e.preventDefault();
        // Hide the circle if user drags out
        if (dragCircleRef.current) {
          dragCircleRef.current.visible = false;
        }
      }

      function handleDrop(e: DragEvent) {
        e.preventDefault();

        console.log(
          "[ThreeViewer] handleDrop fired with dataTransfer items:",
          e.dataTransfer?.items || "No dataTransfer items",
        );

        const modelDataString = e.dataTransfer?.getData("application/model");
        const fileDataString = e.dataTransfer?.getData("application/file");
        // ADDED: log the raw fileDataString
        console.log(
          "[ThreeViewer] handleDrop - fileDataString:",
          fileDataString,
        );

        if (!fileDataString) {
          console.warn(
            "[ThreeViewer] No 'application/file' data found. Skipping anchor creation.",
          );
          return;
        }

        // Immediately hide the drag indicator with animation
        if (dragCircleRef.current) {
          new TWEEN.Tween(dragCircleRef.current.scale)
            .to({ x: 0, y: 0, z: 0 }, 200)
            .onComplete(() => {
              if (dragCircleRef.current) {
                // Add check here
                dragCircleRef.current.visible = false;
                dragCircleRef.current.scale.set(1, 1, 1);
              }
            })
            .start();
        }

        // Get drop point first to ensure accuracy
        const rect = mountRef.current!.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const mouse = new THREE.Vector2(x, y);

        // Use requestAnimationFrame to prevent blocking the UI
        requestAnimationFrame(async () => {
          if (!cameraRef.current || !sceneRef.current) return;

          raycasterRef.current.setFromCamera(mouse, cameraRef.current);
          const intersects = parentModelRef.current
            ? raycasterRef.current.intersectObject(parentModelRef.current, true)
            : raycasterRef.current.intersectObjects(
                sceneRef.current.children,
                true,
              );

          // Filter out intersections with the drag circle itself
          const validIntersects = intersects.filter(
            (intersect) => intersect.object !== dragCircleRef.current,
          );

          if (validIntersects.length === 0) {
            console.warn(
              "Drop occurred, but no valid intersection point found.",
            );
            // Optionally hide loading indicator if it was shown
            const existingLoadingIndicator =
              sceneRef.current.getObjectByName("loadingIndicator");
            if (existingLoadingIndicator)
              sceneRef.current?.remove(existingLoadingIndicator);
            return;
          }

          const dropPoint = validIntersects[0].point.clone();

          // Create loading indicator exactly at drop point
          const loadingIndicator = createLoadingIndicator(dropPoint);
          // Add a name to easily find and remove it
          loadingIndicator.name = "loadingIndicator";
          sceneRef.current?.add(loadingIndicator);

          if (modelDataString) {
            try {
              const modelInfo = JSON.parse(modelDataString); // Parse the string here
              console.log(
                "[ThreeViewer handleDrop] Processing dropped model:",
                modelInfo,
              );
              // Show loading animation
              const animate = () => {
                if (!loadingIndicator.parent) return;
                loadingIndicator.rotation.y += 0.1;
                requestAnimationFrame(animate);
              };
              animate();

              // Create a unique anchor ID for the model
              const newAnchorId = `anchor-model-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

              try {
                // Use the URL from the model data
                const modelUrl =
                  modelInfo.modelUrl ||
                  "https://f005.backblazeb2.com/file/objectModels-dev/Mona_Lisa_PBR_hires_model.glb";

                const model = await loadModelWithFallback(modelUrl);

                // Calculate bounding box for scaling
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);

                // Base scale factor
                const baseFactor = 0.1 / maxDim;
                model.scale.multiplyScalar(baseFactor);

                // Position the model at the drop point
                model.position.copy(dropPoint);

                // Add to scene
                sceneRef.current?.add(model);

                // Store reference to the model
                anchorModelsRef.current.set(newAnchorId, model);

                // Add user data to identify it later
                model.userData.anchorId = newAnchorId;

                if (loadingIndicator.parent && sceneRef.current)
                  sceneRef.current.remove(loadingIndicator);

                // Calculate real-world coordinates using existing helper
                let realWorldPos = dropPoint
                  .clone()
                  .multiplyScalar(SCALE_FACTOR);

                if (originPoint) {
                  realWorldPos = convertToRealWorldCoords(dropPoint);
                }

                // Create anchor in Firestore
                if (blueprintId) {
                  const userId = "anonymous";

                  setDoc(doc(db, "anchors", newAnchorId), {
                    id: newAnchorId,
                    createdDate: new Date(),
                    contentID: `model-${Date.now()}`,
                    contentType: "model",
                    modelName: modelInfo.name || "3D Model",
                    host: userId,
                    blueprintID: blueprintId,
                    x: realWorldPos.x,
                    y: realWorldPos.y,
                    z: realWorldPos.z,
                    scaleX: model.scale.x,
                    scaleY: model.scale.y,
                    scaleZ: model.scale.z,
                    rotationX: model.rotation.x,
                    rotationY: model.rotation.y,
                    rotationZ: model.rotation.z,
                    isPrivate: false,
                  })
                    .then(() => {
                      updateDoc(doc(db, "blueprints", blueprintId), {
                        anchorIDs: arrayUnion(newAnchorId),
                      }).catch((err) => {
                        console.error(
                          "Error updating blueprint with anchor ID:",
                          err,
                        );
                      });
                    })
                    .catch((err) => {
                      console.error("Error saving model anchor:", err);
                    });
                }

                // Show success feedback
                showSuccessIndicator(dropPoint, modelInfo.name || "3D Model");
              } catch (error) {
                console.error("Error processing model:", error);
                if (sceneRef.current) {
                  sceneRef.current?.remove(loadingIndicator);
                }
                showErrorIndicator(dropPoint);
              }
            } catch (error) {
              console.error("Error parsing model data:", error);
              if (sceneRef.current) {
                sceneRef.current?.remove(loadingIndicator);
              }
              showErrorIndicator(dropPoint);
            }
          } else if (fileDataString) {
            // Use the string retrieved earlier
            try {
              const fileInfo = JSON.parse(fileDataString); // Parse the string here
              console.log(
                "[ThreeViewer] File dropped:",
                fileInfo,
                "at:",
                dropPoint,
              );

              // Calculate real-world coordinates relative to origin
              if (originPoint) {
                const realWorldPos = convertToRealWorldCoords(dropPoint);

                // Call the callback to notify BlueprintEditor
                if (onFileDropped) {
                  console.log(
                    "[ThreeViewer] Calling onFileDropped with:",
                    fileInfo, //bet
                    realWorldPos,
                  );
                  onFileDropped(fileInfo, realWorldPos); // Pass fileInfo and calculated coords
                } else {
                  console.error(
                    "[ThreeViewer] onFileDropped callback is missing!",
                  );
                }

                // Remove loading indicator (it will be re-added by state update if needed)
                sceneRef.current?.remove(loadingIndicator);
                // Show temporary success feedback (optional)
                showSuccessIndicator(dropPoint, fileInfo.name || "File");

                // ── HIDE the green “drop” marker ──
                if (dragCircleRef.current) {
                  dragCircleRef.current.visible = false;
                  dragCircleRef.current.scale.set(1, 1, 1);
                }
              } else {
                console.error(
                  "[ThreeViewer] Cannot place file anchor: Origin point not set.",
                );
                sceneRef.current?.remove(loadingIndicator);
                showErrorIndicator(dropPoint, "Set origin first");
                // Optionally show a toast or error message to the user via onError prop
                onError?.("Please set the origin point before placing files.");
              }
            } catch (error) {
              console.error("Error processing dropped file data:", error);
              sceneRef.current?.remove(loadingIndicator);
              showErrorIndicator(dropPoint);
            }
          } else {
            // Handle case where neither model nor file data was found
            console.warn("No valid model or file data found in drop event.");
            sceneRef.current?.remove(loadingIndicator); // Remove loading indicator
          }
        });
      }

      // Helper function to create loading indicator
      function createLoadingIndicator(position) {
        // Create a pulsing ring indicator
        const geometry = new THREE.RingGeometry(0.08, 0.12, 32);
        const material = new THREE.MeshBasicMaterial({
          color: 0x3b82f6, // Blue color
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide,
          depthTest: false,
        });

        const loadingMesh = new THREE.Mesh(geometry, material);
        loadingMesh.rotation.x = -Math.PI / 2;
        loadingMesh.position.copy(position);
        loadingMesh.renderOrder = 10000;

        // Add inner dot
        const dotGeometry = new THREE.SphereGeometry(0.03, 16, 16);
        const dotMaterial = new THREE.MeshBasicMaterial({
          color: 0x3b82f6,
          transparent: true,
          opacity: 0.9,
          depthTest: false,
        });
        const dot = new THREE.Mesh(dotGeometry, dotMaterial);
        dot.position.copy(position);
        dot.position.y += 0.01; // Slightly above

        loadingMesh.add(dot);

        // Start pulsing animation
        const pulse = () => {
          if (!loadingMesh.parent) return; // Stop if removed
          const time = Date.now() * 0.002;
          loadingMesh.scale.x = 1 + Math.sin(time * 3) * 0.2;
          loadingMesh.scale.y = 1 + Math.sin(time * 3) * 0.2;
          loadingMesh.scale.z = 1;
          dot.scale.x = 1 + Math.cos(time * 4) * 0.3;
          dot.scale.y = 1 + Math.cos(time * 4) * 0.3;
          dot.scale.z = 1 + Math.cos(time * 4) * 0.3;
          requestAnimationFrame(pulse);
        };
        pulse();

        return loadingMesh;
      }

      // Helper functions for showing success/error indicators
      function showSuccessIndicator(position, modelName) {
        // Create success indicator
        const ringGeometry = new THREE.RingGeometry(0.1, 0.12, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: 0x10b981, // Green
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide,
          depthTest: false,
        });

        const successRing = new THREE.Mesh(ringGeometry, ringMaterial);
        successRing.rotation.x = -Math.PI / 2;
        successRing.position.copy(position);
        successRing.renderOrder = 10000;
        sceneRef.current?.add(successRing);

        // Add label for model name
        const labelDiv = document.createElement("div");
        labelDiv.textContent = modelName || "3D Model";
        labelDiv.style.padding = "4px 8px";
        labelDiv.style.fontSize = "12px";
        labelDiv.style.color = "#0f172a";
        labelDiv.style.backgroundColor = "rgba(255,255,255,0.9)";
        labelDiv.style.borderRadius = "4px";
        labelDiv.style.whiteSpace = "nowrap";
        labelDiv.style.boxShadow = "0 2px 5px rgba(0,0,0,0.1)";
        labelDiv.style.fontWeight = "500";

        const labelObject = new CSS3DObject(labelDiv);
        labelObject.scale.set(0.005, 0.005, 0.005);
        labelObject.position.copy(
          position.clone().add(new THREE.Vector3(0, 0.15, 0)),
        );
        sceneRef.current?.add(labelObject);

        // Add expansion animation
        successRing.scale.set(0, 0, 0);
        labelObject.scale.set(0, 0, 0);

        new TWEEN.Tween(successRing.scale)
          .to({ x: 1, y: 1, z: 1 }, 400)
          .easing(TWEEN.Easing.Back.Out)
          .start();

        new TWEEN.Tween(labelObject.scale)
          .to({ x: 0.005, y: 0.005, z: 0.005 }, 400)
          .easing(TWEEN.Easing.Back.Out)
          .delay(200)
          .start();

        // Remove after animation
        setTimeout(() => {
          new TWEEN.Tween(successRing.material)
            .to({ opacity: 0 }, 800)
            .onComplete(() => {
              sceneRef.current?.remove(successRing);
            })
            .start();

          new TWEEN.Tween(labelObject.scale)
            .to({ x: 0, y: 0, z: 0 }, 400)
            .delay(1000)
            .onComplete(() => {
              sceneRef.current?.remove(labelObject);
            })
            .start();
        }, 2000);
      }

      function showErrorIndicator(position, message?: string) {
        // Create error indicator (red cross)
        const crossGroup = new THREE.Group();
        crossGroup.position.copy(position);

        const lineGeometry1 = new THREE.BoxGeometry(0.15, 0.02, 0.02);
        const lineGeometry2 = new THREE.BoxGeometry(0.02, 0.15, 0.02);
        const material = new THREE.MeshBasicMaterial({ color: 0xef4444 });

        const line1 = new THREE.Mesh(lineGeometry1, material);
        line1.rotation.z = Math.PI / 4;
        const line2 = new THREE.Mesh(lineGeometry2, material);
        line2.rotation.z = Math.PI / 4;

        crossGroup.add(line1);
        crossGroup.add(line2);
        crossGroup.scale.set(0, 0, 0);
        sceneRef.current?.add(crossGroup);

        // Animation
        new TWEEN.Tween(crossGroup.scale)
          .to({ x: 1, y: 1, z: 1 }, 300)
          .easing(TWEEN.Easing.Back.Out)
          .start();

        setTimeout(() => {
          new TWEEN.Tween(crossGroup.scale)
            .to({ x: 0, y: 0, z: 0 }, 300)
            .onComplete(() => {
              sceneRef.current?.remove(crossGroup);
            })
            .start();
        }, 1500);
      }

      const handleFileDrop = (e: DragEvent) => {
        e.preventDefault();
        const data = e.dataTransfer?.getData("application/json") || "";
        if (!data) return;
        try {
          const fileData = JSON.parse(data);
          // Convert drop coordinates into normalized device coordinates
          const rect = mountRef.current!.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          const mouse = new THREE.Vector2(x, y);
          raycasterRef.current.setFromCamera(mouse, cameraRef.current!);
          const intersects = raycasterRef.current.intersectObjects(
            sceneRef.current!.children,
            true,
          );
          let dropPoint: THREE.Vector3;
          if (intersects.length > 0) {
            dropPoint = intersects[0].point;
          } else {
            // Fallback: use camera direction at z=0 (or choose another default)
            dropPoint = new THREE.Vector3(0, 0, 0);
          }
          // Create an image and when loaded, create a textured plane mesh
          const img = new Image();
          img.src = fileData.url;
          img.onload = () => {
            const texture = new THREE.Texture(img);
            texture.needsUpdate = true;
            // Determine plane geometry based on image aspect ratio (adjust sizes as desired)
            const aspect = img.width / img.height;
            const geometry = new THREE.PlaneGeometry(1 * aspect, 1);
            const material = new THREE.MeshBasicMaterial({
              map: texture,
              side: THREE.DoubleSide,
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(dropPoint);
            sceneRef.current!.add(mesh);
            // Optionally, you could now call your Firebase functions to create a new anchor
            // so that this placement is saved.
          };
        } catch (err) {
          console.error("Error processing dropped file", err);
        }
      };
      //  mountRef.current.addEventListener("drop", handleFileDrop);
      mountRef.current.addEventListener("dragenter", handleDragEnter);
      mountRef.current.addEventListener("dragover", handleDragOver);
      mountRef.current.addEventListener("dragleave", handleDragLeave);
      mountRef.current.addEventListener("drop", handleDrop); // Keep this, but make sure handleDrop calls the fixed logic

      const handleResize = () => {
        if (!mountRef.current) return;
        camera.aspect =
          mountRef.current.clientWidth / mountRef.current.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(
          mountRef.current.clientWidth,
          mountRef.current.clientHeight,
        );
      };

      // --- ADD THIS NEW POINTER-BASED AREA-MARKING LOGIC ---
      let isDrawingArea = false;

      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("keydown", handleTransformKeyDown); // Use correct handler name
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        renderer?.domElement.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        if (mountRef.current) {
          mountRef.current.removeEventListener("contextmenu", handleRightClick);
          mountRef.current.removeEventListener("click", handleWalkStartClick, {
            capture: true,
          } as any);
          mountRef.current.removeEventListener("click", handleClick);
          mountRef.current.removeEventListener("dragenter", handleDragEnter);
          mountRef.current.removeEventListener("dragover", handleDragOver);
          mountRef.current.removeEventListener("dragleave", handleDragLeave);
          mountRef.current.removeEventListener("drop", handleDrop);
          mountRef.current.removeChild(renderer.domElement);
          if (
            cssRenderer &&
            cssRenderer.domElement &&
            mountRef.current.contains(cssRenderer.domElement)
          ) {
            mountRef.current.removeChild(cssRenderer.domElement);
          }
        }
        transformControlsRef.current?.dispose();
        scene.clear();
        if (renderer) {
          renderer.dispose();
        }

        anchorModelsRef.current.clear();
        anchorWebpagesRef.current.clear();
        textAnchorsRef.current.clear();
        fileAnchorsRef.current.clear();
        qrCodeMarkersRef.current.clear();
      };
    }, [modelPath]);

    // UPDATED: useEffect for saving transform changes for ANY selected anchor
    useEffect(() => {
      if (!transformControlsRef.current) return;

      const controls = transformControlsRef.current;

      // Function to handle live visual updates of linked objects during drag
      const handleLiveVisualUpdateDuringDrag = () => {
        if (!controls.object || !controls.dragging) return;

        const transformedObject = controls.object;
        const isHelper = transformedObject.userData?.type?.includes("helper");

        if (isHelper) {
          const visualLinkedToHelper =
            transformedObject.userData.visualObject || // For WebGL file visuals
            transformedObject.userData.cssObject || // For Webpage CSS3D visuals
            transformedObject.userData.labelObject; // For Text CSS3D visuals

          if (
            visualLinkedToHelper &&
            visualLinkedToHelper !== transformedObject
          ) {
            const currentWorldPosition = new THREE.Vector3();
            const currentWorldQuaternion = new THREE.Quaternion();
            // Get current transform of the helper being dragged
            transformedObject.getWorldPosition(currentWorldPosition);
            transformedObject.getWorldQuaternion(currentWorldQuaternion);

            // Update linked visual's position and rotation
            visualLinkedToHelper.position.copy(currentWorldPosition);
            visualLinkedToHelper.rotation.setFromQuaternion(
              currentWorldQuaternion,
            );

            // For WebGL visual objects (not CSS3D), also update scale live if needed
            // CSS3DObjects should maintain their original scale for proper rendering
            if (
              !visualLinkedToHelper.isCSS3DObject &&
              !visualLinkedToHelper.userData?.isCSS3DObject
            ) {
              const currentWorldScale = new THREE.Vector3();
              transformedObject.getWorldScale(currentWorldScale);
              visualLinkedToHelper.scale.copy(currentWorldScale);
            }
            // Note: CSS3DObject.scale is for pixel-to-unit conversion, never changed by gizmo scale.
          }
        }
      };

      // Function to handle the final save operation on mouseUp
      const handleFinalTransformSave = () => {
        if (!controls.object) {
          console.log("[Final Save] Aborted: No object on transformControls.");
          return;
        }

        const transformedObject = controls.object;

        // Handle alignment markers ("A", "B", "C") separately (local update, no DB save)
        if (
          transformedObject.userData.label &&
          ["A", "B", "C"].includes(transformedObject.userData.label)
        ) {
          console.log(
            "Transform finalized for alignment marker, updating local state only.",
          );
          if (setReferencePoints3D) {
            setReferencePoints3D((prevPoints) =>
              prevPoints.map((p) =>
                p.label === transformedObject.userData.label
                  ? {
                      ...p,
                      x3D: transformedObject.position.x, // Local position is fine for these simple markers
                      y3D: transformedObject.position.y,
                      z3D: transformedObject.position.z,
                    }
                  : p,
              ),
            );
          }
          return;
        }

        // Proceed only if a data anchor was actually selected
        if (!selectedAnchorId || !selectedAnchorType) {
          console.log(
            "[Final Save] Aborted: No selectedAnchorId or selectedAnchorType from component state.",
          );
          // It's possible the anchor was deselected before mouseUp if not dragging.
          // If controls.object.userData.anchorId exists, we might be able to use it,
          // but relying on selectedAnchorId from state is safer to ensure context.
          return;
        }

        // Ensure the currently selected anchor matches the one on the transform controls
        if (selectedAnchorId !== transformedObject.userData.anchorId) {
          console.warn(
            `[Final Save] Mismatch: selectedAnchorId is ${selectedAnchorId}, but gizmo object anchorId is ${transformedObject.userData.anchorId}. Aborting save.`,
          );
          return;
        }

        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();

        transformedObject.getWorldPosition(worldPosition);
        transformedObject.getWorldQuaternion(worldQuaternion);
        transformedObject.getWorldScale(worldScale); // This is the scale of the gizmo-controlled object (e.g., helper)

        const worldRotation = new THREE.Euler().setFromQuaternion(
          worldQuaternion,
          transformedObject.rotation.order, // Use the rotation order of the object itself
        );

        // If the transformed object was a helper, its linked visual was already updated by handleLiveVisualUpdateDuringDrag.
        // Here, we just need to ensure the final state is consistent for setLastTransform.

        setLastTransform({
          // Store the final world transform of the gizmo-controlled object
          position: worldPosition.clone(),
          rotation: worldRotation.clone(),
          scale: worldScale.clone(),
        });

        const realWorldPos = convertToRealWorldCoords(worldPosition);

        console.log(
          `[Final Save] Saving for ${selectedAnchorType} anchor ${selectedAnchorId}:`,
          {
            realWorldPos: realWorldPos.toArray(),
            rotation: worldRotation.toArray().slice(0, 3),
            scale: worldScale.toArray(),
          },
        );
        console.log(
          "[Final Save] Using originPoint for conversion:",
          originPoint ? originPoint.toArray() : null,
        );

        // For CSS3D objects (webpages, text), always keep scale at 1,1,1
        // For other objects (models, files), use the actual transformed scale
        const finalScale =
          selectedAnchorType === "webpage" || selectedAnchorType === "text"
            ? { x: 1, y: 1, z: 1 }
            : { x: worldScale.x, y: worldScale.y, z: worldScale.z };

        updateAnchorTransform(selectedAnchorId, {
          x: realWorldPos.x,
          y: realWorldPos.y,
          z: realWorldPos.z,
          rotationX: worldRotation.x,
          rotationY: worldRotation.y,
          rotationZ: worldRotation.z,
          scaleX: finalScale.x,
          scaleY: finalScale.y,
          scaleZ: finalScale.z,
        });
      };

      controls.addEventListener(
        "objectChange",
        handleLiveVisualUpdateDuringDrag,
      );
      controls.addEventListener("mouseUp", handleFinalTransformSave);

      return () => {
        controls.removeEventListener(
          "objectChange",
          handleLiveVisualUpdateDuringDrag,
        );
        controls.removeEventListener("mouseUp", handleFinalTransformSave);
        // No need to clear transformUpdateTimeout.current as it's removed.
      };
    }, [
      selectedAnchorId,
      selectedAnchorType,
      originPoint,
      convertToRealWorldCoords, // Assuming these are stable (useCallback if not)
      updateAnchorTransform, // Assuming these are stable (useCallback if not)
      setReferencePoints3D, // For alignment markers
      setLastTransform, // To update the lastTransform state
      // transformControlsRef.current is not needed as a dependency if the ref object itself doesn't change
    ]);

    useEffect(() => {
      if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;

      const container = mountRef.current;
      const camera = cameraRef.current;
      const scene = sceneRef.current;
      let isDrawing = false; // local flag
      let pointerId: number | null = null;

      function onPointerDown(e: PointerEvent) {
        if (!isMarkingArea) return;
        if (e.button !== 0) return; // Only do bounding box with left button

        e.preventDefault();
        e.stopPropagation();

        // Disable OrbitControls entirely
        if (orbitControlsRef.current) {
          orbitControlsRef.current.enabled = false;
        }

        // Capture pointer so we continue getting pointermove even if mouse leaves the element
        container.setPointerCapture(e.pointerId);
        pointerId = e.pointerId;
        isDrawing = true;

        // First corner
        const rect = container.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const mouse = new THREE.Vector2(x, y);

        raycasterRef.current.setFromCamera(mouse, camera);
        const intersects = raycasterRef.current.intersectObjects(
          scene.children,
          true,
        );

        if (intersects.length > 0) {
          const hitPoint = intersects[0].point.clone();
          corner1Ref.current = hitPoint;
          corner2Ref.current = hitPoint.clone();

          // Clear any old helper
          if (tempBoxHelperRef.current) {
            scene.remove(tempBoxHelperRef.current);
            tempBoxHelperRef.current = null;
          }
        }
      }

      function onPointerMove(e: PointerEvent) {
        if (!isMarkingArea) return;
        if (!isDrawing) return;
        if (corner1Ref.current === null) return;

        e.preventDefault();
        e.stopPropagation();

        const rect = container.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const mouse = new THREE.Vector2(x, y);

        raycasterRef.current.setFromCamera(mouse, camera);
        const intersects = raycasterRef.current.intersectObjects(
          scene.children,
          true,
        );

        if (intersects.length > 0) {
          corner2Ref.current = intersects[0].point.clone();

          // Continuously update the temporary box helper
          const box3 = new THREE.Box3().setFromPoints([
            corner1Ref.current,
            corner2Ref.current,
          ]);

          if (tempBoxHelperRef.current) {
            scene.remove(tempBoxHelperRef.current);
            tempBoxHelperRef.current = null;
          }
          if (tempBoxMeshRef.current) {
            scene.remove(tempBoxMeshRef.current);
            tempBoxMeshRef.current = null;
          }

          // 1) Re-create the yellow wireframe helper
          const helper = new THREE.Box3Helper(box3, 0xffff00);
          helper.renderOrder = 9999; // Add: High render order
          scene.add(helper);
          tempBoxHelperRef.current = helper;

          // 2) Add a translucent fill
          const size = new THREE.Vector3();
          box3.getSize(size);
          const center = new THREE.Vector3();
          box3.getCenter(center);

          const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
          const material = new THREE.MeshBasicMaterial({
            color: 0x0000ff, // Blue color
            transparent: true,
            opacity: 0.3, // Optional: Slightly increased opacity
            depthTest: false, // Add: Render on top of other objects
            side: THREE.DoubleSide, // Ensure: Visible from inside
          });
          const fillMesh = new THREE.Mesh(geometry, material);
          fillMesh.position.copy(center);
          fillMesh.renderOrder = 9998; // Add: High render order (just below helper)

          scene.add(fillMesh);
          tempBoxMeshRef.current = fillMesh;

          // --- END CHANGES ---
        }
      }

      function onPointerUp(e: PointerEvent) {
        if (!isMarkingArea) return;
        if (!isDrawing) return;
        if (e.pointerId !== pointerId) return; // ignore if not same pointer

        e.preventDefault();
        e.stopPropagation();

        // Release pointer capture
        container.releasePointerCapture(e.pointerId);
        pointerId = null;
        isDrawing = false;

        // Re‐enable OrbitControls
        if (orbitControlsRef.current) {
          orbitControlsRef.current.enabled = true;
        }

        if (corner1Ref.current && corner2Ref.current) {
          // Final bounding box
          const box3 = new THREE.Box3().setFromPoints([
            corner1Ref.current,
            corner2Ref.current,
          ]);

          onAreaMarked?.({
            min: { x: box3.min.x, y: box3.min.y, z: box3.min.z },
            max: { x: box3.max.x, y: box3.max.y, z: box3.max.z },
          });

          // Reset corners
          corner1Ref.current = null;
          corner2Ref.current = null;
          console.log("Area Marked:", box3);

          if (tempBoxHelperRef.current) {
            scene.remove(tempBoxHelperRef.current);
            tempBoxHelperRef.current = null;
          }
          if (tempBoxMeshRef.current) {
            scene.remove(tempBoxMeshRef.current);
            tempBoxMeshRef.current = null;
          }
        }
      }

      container.addEventListener("pointerdown", onPointerDown, {
        passive: false,
      });
      container.addEventListener("pointermove", onPointerMove, {
        passive: false,
      });
      container.addEventListener("pointerup", onPointerUp, { passive: false });

      return () => {
        container.removeEventListener("pointerdown", onPointerDown);
        container.removeEventListener("pointermove", onPointerMove);
        container.removeEventListener("pointerup", onPointerUp);
      };
    }, [isMarkingArea, onAreaMarked]);

    useEffect(() => {
      if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;
      const container = mountRef.current;
      const camera = cameraRef.current;
      const scene = sceneRef.current;

      function onPointerDown(e: PointerEvent) {
        if (!isMarkingPointRef.current) return;
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = container.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const mouse = new THREE.Vector2(x, y);
        raycasterRef.current.setFromCamera(mouse, camera);
        const intersects = parentModelRef.current
          ? raycasterRef.current.intersectObject(parentModelRef.current, true)
          : raycasterRef.current.intersectObjects(scene.children, true);

        if (intersects.length > 0) {
          const hitPoint = intersects[0].point.clone();
          const real = convertToRealWorldCoords(hitPoint);
          onPointMarked?.({ x: real.x, y: real.y, z: real.z });
        }
      }

      container.addEventListener("pointerdown", onPointerDown, {
        passive: false,
      });
      return () => {
        container.removeEventListener("pointerdown", onPointerDown);
      };
    }, [isMarkingPoint, onPointMarked, convertToRealWorldCoords]);

    useEffect(() => {
      if (!sceneRef.current) return;
      const scene = sceneRef.current;

      if (!showMarkedPoints) {
        pointMarkersRef.current.forEach((marker) => {
          scene.remove(marker);
        });
        pointMarkersRef.current.clear();
        return;
      }

      const currentIds = new Set(markedPoints?.map((p) => p.id));
      pointMarkersRef.current.forEach((sprite, id) => {
        if (!currentIds.has(id)) {
          scene.remove(sprite);
          pointMarkersRef.current.delete(id);
        }
      });
      markedPoints?.forEach((p) => {
        let sprite = pointMarkersRef.current.get(p.id);
        if (!sprite) {
          const material = new THREE.SpriteMaterial({
            map: pinTexture,
            depthTest: false,
            depthWrite: false,
          });
          sprite = new THREE.Sprite(material);
          sprite.scale.set(0.035, 0.035, 0.035);
          sprite.center.set(0.5, 0);
          scene.add(sprite);
          pointMarkersRef.current.set(p.id, sprite);
        }
        const worldPos = convertFromRealWorldCoords(
          new THREE.Vector3(p.x, p.y, p.z),
        );
        sprite.position.copy(worldPos);
      });
    }, [markedPoints, showMarkedPoints, convertFromRealWorldCoords]);

    useEffect(() => {
      if (!mountRef.current) return; // Ensure mountRef is available

      const rendererNode = mountRef.current; // Capture for cleanup

      // NEW: Add a pointermove listener for the direction feedback line
      const handlePointerMove = (event: PointerEvent) => {
        // Access props correctly, e.g., props.originSettingStep, props.tempOriginPos
        if (
          props.originSettingStep !== "picking_direction" ||
          !props.tempOriginPos ||
          !cameraRef.current ||
          !sceneRef.current
        ) {
          // If not in the right mode, ensure the line is hidden
          if (originDirectionLineRef.current) {
            originDirectionLineRef.current.visible = false;
          }
          return;
        }

        const rect = rendererNode.getBoundingClientRect(); // Use captured rendererNode
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        if (!raycasterRef.current) raycasterRef.current = new THREE.Raycaster(); // Ensure raycaster is initialized
        raycasterRef.current.setFromCamera(
          new THREE.Vector2(x, y),
          cameraRef.current,
        );

        // Raycast against the parent model for accuracy
        let currentHoverPoint: THREE.Vector3 | null = null;
        if (parentModelRef.current) {
          const modelIntersects = raycasterRef.current.intersectObject(
            parentModelRef.current,
            true,
          );
          if (modelIntersects.length > 0) {
            currentHoverPoint = modelIntersects[0].point;
          }
        } else {
          // Fallback to general scene if parentModelRef is not yet loaded (though unlikely in this step)
          const intersects = raycasterRef.current.intersectObjects(
            sceneRef.current.children,
            true,
          );
          if (intersects.length > 0) {
            currentHoverPoint = intersects[0].point;
          }
        }

        if (currentHoverPoint) {
          if (!originDirectionLineRef.current) {
            // Create the line for the first time
            const material = new THREE.LineBasicMaterial({
              color: 0x00ffff,
              linewidth: 2,
              depthTest: false,
            });
            // Use props.tempOriginPos here
            const points = [
              props.tempOriginPos.clone(),
              currentHoverPoint.clone(),
            ];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, material);
            line.renderOrder = 9999; // Ensure visible
            originDirectionLineRef.current = line;
            sceneRef.current.add(line);
          } else {
            // Update existing line
            const positions = originDirectionLineRef.current.geometry.attributes
              .position as THREE.BufferAttribute;
            // Use props.tempOriginPos here
            positions.setXYZ(
              0,
              props.tempOriginPos.x,
              props.tempOriginPos.y,
              props.tempOriginPos.z,
            );
            positions.setXYZ(
              1,
              currentHoverPoint.x,
              currentHoverPoint.y,
              currentHoverPoint.z,
            );
            positions.needsUpdate = true;
            originDirectionLineRef.current.visible = true;
          }
        } else {
          // If no intersection, hide the line
          if (originDirectionLineRef.current) {
            originDirectionLineRef.current.visible = false;
          }
        }
      };

      rendererNode.addEventListener("pointermove", handlePointerMove);

      return () => {
        rendererNode.removeEventListener("pointermove", handlePointerMove);
        if (originDirectionLineRef.current && sceneRef.current) {
          // Check sceneRef.current for safety
          sceneRef.current.remove(originDirectionLineRef.current);
          // Optional: Dispose geometry and material of the line
          if (originDirectionLineRef.current.geometry)
            originDirectionLineRef.current.geometry.dispose();
          if (originDirectionLineRef.current.material) {
            if (Array.isArray(originDirectionLineRef.current.material)) {
              originDirectionLineRef.current.material.forEach((m) =>
                m.dispose(),
              );
            } else {
              originDirectionLineRef.current.material.dispose();
            }
          }
          originDirectionLineRef.current = null;
        }
      };
    }, [props.originSettingStep, props.tempOriginPos, parentModelRef.current]); // Add dependencies: props.originSettingStep, props.tempOriginPos, parentModelRef

    useEffect(() => {
      // Need a valid scene and an origin before we draw anything
      if (!sceneRef.current) return;
      if (!originPoint) return;

      // If we haven't created the origin marker yet, do so now:
      if (!originMarkerRef.current) {
        const originMarkerGeometry = new THREE.SphereGeometry(0.03, 16, 16);
        const originMarkerMaterial = new THREE.MeshBasicMaterial({
          color: 0xffff00,
          transparent: true,
          opacity: 0.8,
        });
        const originMarker = new THREE.Mesh(
          originMarkerGeometry,
          originMarkerMaterial,
        );
        originMarker.position.copy(originPoint);
        sceneRef.current?.add(originMarker);

        originMarkerRef.current = originMarker;
      } else {
        // If we've already created the marker, just update its position & make it visible
        originMarkerRef.current.position.copy(originPoint);
        originMarkerRef.current.visible = true;
      }
    }, [sceneRef.current, originPoint]);

    const handleSubmit = async () => {
      if (!selectedPoint || !promptInput) return;

      // Check if the input mentions the safe
      if (
        promptInput.toLowerCase().includes("safe") ||
        promptInput.toLowerCase().includes("antique")
      ) {
        const model = await loadAndAddModel(
          "models/Antique_Iron_Safe.glb",
          selectedPoint,
        );
        if (model) {
          console.log(
            "Added Antique Safe to scene at position:",
            selectedPoint,
          );

          // 1) Generate a unique anchor ID
          const newAnchorId = `anchor-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 8)}`;

          // Compute the offset relative to origin and then scale by 45.64.
          // If no origin is set, default to using selectedPoint directly.
          let scaledX = selectedPoint.x * SCALE_FACTOR;
          let scaledY = selectedPoint.y * SCALE_FACTOR;
          let scaledZ = selectedPoint.z * SCALE_FACTOR;
          if (originPoint) {
            const offset = selectedPoint.clone().sub(originPoint);
            scaledX = offset.x * SCALE_FACTOR;
            scaledY = offset.y * SCALE_FACTOR;
            scaledZ = offset.z * SCALE_FACTOR;
          }

          // 2) Create the anchor document in Firestore
          //    (similar to how your other anchors are structured)
          await setDoc(doc(db, "anchors", newAnchorId), {
            id: newAnchorId,
            createdDate: new Date(),
            contentID: `element-${Date.now()}`,
            contentType: "model",
            modelName: "Antique_Iron_Safe.glb", // or any name for your model
            host: "2EVim3RYhrgtP3KOKV2UykjXfqs2", // get from context/auth
            blueprintID: blueprintId, // the blueprint ID
            x: scaledX, // store the scaled 3D coordinates
            y: scaledY,
            z: scaledZ,
            isPrivate: false, // optional
            // You can store any additional fields you want here
          });

          // 3) Add this anchor ID to the blueprint’s anchorIDs array
          if (typeof blueprintId === "string") {
            await updateDoc(doc(db, "blueprints", blueprintId), {
              anchorIDs: arrayUnion(newAnchorId),
            });
          }

          // done!
        }
      }

      setShowSidePanel(false);
      setPromptInput("");
    };

    return (
      <>
        <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
        <div className="absolute top-4 right-4 z-50">
          <CloudUpload
            onFileSelect={(file) => {
              if (onCloudFileSelect) {
                onCloudFileSelect(file);
              } else {
                onFileDropped?.({ file }, { x: 0, y: 0, z: 0 });
              }
            }}
            onLinkSelect={(url) => {
              onCloudLinkSelect?.(url);
            }}
          />
        </div>
        {/* +++ ADD THIS PROGRESS BAR +++ */}
        {!modelLoaded && modelLoadProgress > 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-60 h-2 bg-slate-800 rounded overflow-hidden z-50">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${modelLoadProgress}%` }}
            />
          </div>
        )}

        {isWalkMode && (
          <div className="fixed bottom-20 right-4 z-[100000] rounded-xl border border-white/10 bg-black/70 text-white px-4 py-3 shadow-lg backdrop-blur">
            <div className="text-sm font-medium">Walk Mode</div>
            <div className="mt-1 text-xs opacity-90">
              Click the floor to drop in · Move with <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> · Hold <kbd>Shift</kbd> to sprint · Move mouse to
              look · Press <kbd>Esc</kbd> to exit
            </div>
          </div>
        )}

        {showTextBoxInputRef && selectedPoint && (
          <div
            className="absolute z-50 p-1 bg-slate-900 border border-slate-700 rounded"
            style={{
              left: `${projectToScreen(selectedPoint).x}px`,
              top: `${projectToScreen(selectedPoint).y}px`,
            }}
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onBlur={() => {
                createTextBoxMesh(textInput, selectedPoint);
                setTextInput("");
                // Optionally, if you want to hide the overlay:
                // setShowTextBoxInput(false);
              }}
              className="bg-transparent border-none text-slate-100 outline-none"
              autoFocus
            />
          </div>
        )}

        {originConfirmation && (
          <motion.div
            className="absolute top-16 left-1/2 -translate-x-1/2 bg-amber-400/20 border border-amber-400 text-amber-200 px-4 py-2 rounded shadow-lg backdrop-blur-sm"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{ zIndex: 999999 }}
          >
            {originConfirmation}
          </motion.div>
        )}

        <AnimatePresence>
          {showSidePanel && (
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-16 right-0 w-96 h-[calc(100vh-4rem)] bg-slate-950/90 backdrop-blur-xl border-l border-slate-800 p-6 overflow-y-auto text-slate-100"
            >
              <Card className="border-0 shadow-none bg-transparent text-slate-100">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-center">
                    <CardTitle>Add to Scene</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowSidePanel(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      What would you like to add here?
                    </label>
                    <Input
                      value={promptInput}
                      onChange={(e) => setPromptInput(e.target.value)}
                      placeholder="Describe what you want to add..."
                      className="w-full bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    {options.map((option, index) => (
                      <button
                        key={index}
                        className="p-4 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors flex flex-col items-center justify-center gap-2 text-center"
                      >
                        {option.icon}
                        <span className="text-sm text-slate-200">
                          {option.label}
                        </span>
                      </button>
                    ))}
                  </div>

                  <Button className="w-full mt-6" onClick={handleSubmit}>
                    Add to Scene
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {transformUpdateSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed top-4 right-4 bg-emerald-400/20 border border-emerald-500 text-emerald-200 px-4 py-2 rounded shadow-lg backdrop-blur-sm z-50"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>Transform saved</span>
            </div>
          </motion.div>
        )}

        {transformError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed top-4 right-4 bg-rose-400/20 border border-rose-500 text-rose-200 px-4 py-2 rounded shadow-lg backdrop-blur-sm z-50"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>{transformError}</span>
            </div>
          </motion.div>
        )}

        {distanceDisplay && (
          <motion.div
            className="absolute top-20 right-4 bg-white text-black px-4 py-2 rounded-lg shadow-lg ring-1 ring-black/15"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.2 }}
            style={{
              zIndex: 999999,
              fontSize: "1rem",
              fontWeight: "500",
              whiteSpace: "pre-line",
            }}
          >
            {distanceDisplay}
          </motion.div>
        )}
      </>
    );
  }),
);

// Using a separate export statement to avoid double memo
export default ThreeViewer;
