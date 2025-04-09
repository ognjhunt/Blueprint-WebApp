import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { CSS3DRenderer } from "three/examples/jsm/renderers/CSS3DRenderer";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { TransformControls } from "three/examples/jsm/controls/TransformControls";
import { DragControls } from "three/examples/jsm/controls/DragControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Box, CircleDot, Square, LayoutGrid, X } from "lucide-react";
import { doc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import * as TWEEN from "@tweenjs/tween.js";
import { CSS3DObject } from "three/examples/jsm/renderers/CSS3DRenderer"; // NEW: Import CSS3DObject

declare module "three" {
  interface Object3D {
    isDescendantOf?(obj: Object3D): boolean;
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

interface ThreeViewerProps {
  modelPath: string;
  originPoint?: THREE.Vector3 | null;
  onLoad?: () => void;
  onError?: (error: string) => void;

  // Add these to match what you pass in:
  activeLabel?: "A" | "B" | "C" | null;
  awaiting3D?: boolean;
  setReferencePoints3D?: React.Dispatch<React.SetStateAction<ReferencePoint[]>>;
  setAwaiting3D?: (value: boolean) => void;
  setActiveLabel?: (label: "A" | "B" | "C" | null) => void;
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
  fileAnchors?: Array<{
    id: string;
    fileType: string;
    fileName: string;
    fileUrl: string;
    x: number;
    y: number;
    z: number;
  }>;
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
  onTextAnchorClick?: (anchorId: string, currentText: string) => void;
  onWebpageAnchorClick?: (anchorId: string, anchorUrl: string) => void;
  onFileAnchorClick?: (anchorId: string, anchorData: any) => void;
  qrCodeAnchors?: Array<{
    id: string;
    x: number;
    y: number;
    z: number;
    [key: string]: any;
  }>;
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
}

interface ModelAnchor {
  id: string;
  modelName?: string; // e.g. "Antique_Iron_Safe.glb"
  x: number;
  y: number;
  z: number;
  contentType?: string;
  textContent?: string;
  // Add any other fields if needed
}

const labelColors: Record<"A" | "B" | "C", number> = {
  A: 0xff0000,
  B: 0x00ff00,
  C: 0x0000ff,
};

const ThreeViewer: React.FC<ThreeViewerProps> = ({
  modelPath,
  onLoad,
  onError,
  onTextAnchorClick,
  onWebpageAnchorClick,
  qrCodeAnchors,
  onFileAnchorClick,
  onFileDropped,
  activeLabel,
  awaiting3D,
  setReferencePoints3D,
  setAwaiting3D,
  setActiveLabel,
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
  selectedArea,
}) => {
  console.log("ThreeViewer - modelPath prop:", modelPath); // ADD THIS LINE
  const mountRef = useRef<HTMLDivElement>(null);
  const qrPlacementModeRef = useRef(qrPlacementMode);
  useEffect(() => {
    qrPlacementModeRef.current = qrPlacementMode;
  }, [qrPlacementMode]);

  const textAnchorsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const fileAnchorsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const clickMarkerRef = useRef<THREE.Mesh | null>(null);
  const dragCircleRef = useRef<THREE.Mesh | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const orbitControlsRef = useRef<OrbitControls | null>(null);
  const dragControlsRef = useRef<DragControls | null>(null);

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

  const [location] = useLocation();
  const blueprintId = location.split("/").pop(); // assuming the route is /blueprint-editor/{id}
  const [originConfirmation, setOriginConfirmation] = useState<string>("");
  const [showSidePanel, setShowSidePanel] = useState(false);
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

  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null); // NEW: Unified ID
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
  const originMarkerRef = useRef<THREE.Mesh | null>(null);
  const [distanceDisplay, setDistanceDisplay] = useState<string>("");

  const [markingCornerStart, setMarkingCornerStart] =
    useState<THREE.Vector3 | null>(null);
  const [tempBoxHelper, setTempBoxHelper] = useState<THREE.Box3Helper | null>(
    null,
  );

  const convertToRealWorldCoords = (modelPosition: THREE.Vector3) => {
    if (!originPoint) return modelPosition.clone().multiplyScalar(45.6);

    // Start with the model's position in the scene
    const worldPos = modelPosition.clone();

    // Make it relative to origin point and convert to feet
    const originVector =
      originPoint instanceof THREE.Vector3
        ? originPoint.clone()
        : new THREE.Vector3(originPoint.x, originPoint.y, originPoint.z);

    // 1. Get the offset from origin
    const offset = worldPos.clone().sub(originVector);

    // 2. Convert to feet (multiply by 45.6)
    offset.multiplyScalar(45.6);

    return offset;
  };

  const updateAnchorTransform = async (
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
    if (!blueprintId) return;

    try {
      // Get a reference to the anchor document
      const anchorRef = doc(db, "anchors", anchorId);

      // Update just the transform properties
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

      console.log(`Updated anchor ${anchorId} transform in Firebase`);

      // Show a brief success indicator
      setTransformUpdateSuccess(true);
      setTimeout(() => setTransformUpdateSuccess(false), 2000);
    } catch (error) {
      console.error("Error updating anchor transform:", error);
      setTransformError("Failed to save changes");
      setTimeout(() => setTransformError(null), 3000);
    }
  };

  const updateOriginMarker = (
    scene: THREE.Scene,
    position: THREE.Vector3,
    config: OriginMarkerConfig = {},
  ) => {
    const { radius = 0.03, color = 0xffff00, opacity = 0.8 } = config;

    // Remove existing origin marker, if any
    if (originMarkerRef.current) {
      scene.remove(originMarkerRef.current);
      originMarkerRef.current = null;
    }

    // Create a bigger marker
    const markerGeometry = new THREE.SphereGeometry(radius, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      // ADD THESE LINES:
      //   depthTest: false,            //  <-- Force the marker to be visible on top
    });

    const marker = new THREE.Mesh(markerGeometry, markerMaterial);

    // Also force it to render on top
    marker.renderOrder = 999999; //  <-- High renderOrder so it doesn’t get occluded

    marker.position.copy(position);
    marker.name = "originMarker";
    scene.add(marker);

    originMarkerRef.current = marker;
    // originRef.current = position.clone();
  };

  // In ThreeViewer.tsx, find the configureTransformControls function
  const configureTransformControls = (transformControls: TransformControls) => {
    // Make the transform controls larger so it’s easy to see
    transformControls.setSize(1.8); // Increase if you want even bigger
    transformControls.setSpace("world");

    // Snap increments if desired
    transformControls.setTranslationSnap(0.05);
    transformControls.setRotationSnap(THREE.MathUtils.degToRad(5));
    transformControls.setScaleSnap(0.05);
  };

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
        sceneRef.current.remove(highlightedAreaMeshRef.current);
        highlightedAreaMeshRef.current = null;
      }
      return;
    }

    // Find the selected area in the markedAreas array
    const area = markedAreas.find((a) => a.id === selectedArea);
    if (!area) return;

    // Remove any existing highlight
    if (highlightedAreaMeshRef.current) {
      sceneRef.current.remove(highlightedAreaMeshRef.current);
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
    sceneRef.current.add(highlightMesh);
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
      orbitControlsRef.current.enabled = !isMarkingArea;
    }
  }, [isMarkingArea]);

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

  useEffect(() => {
    if (!originPoint) {
      // ADD THIS CHECK
      console.log(
        "ThreeViewer: originPoint is null, skipping origin marker update.",
      );
      return; // Return early if originPoint is null
    }

    if (!sceneRef.current || !originPoint) return;

    console.log(
      "ThreeViewer: useEffect for origin marker triggered. originPoint:",
      originPoint,
    );

    // Update or create the origin marker
    updateOriginMarker(sceneRef.current, originPoint, {
      radius: 0.03,
      color: 0xffff00,
      opacity: 0.8,
    });
  }, [sceneRef.current, originPoint]);

  // Inside ThreeViewer component

  // Inside ThreeViewer component

  useEffect(() => {
    if (!sceneRef.current || !fileAnchors || !cameraRef.current) return;

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

      // --- 1. Calculate Position --- (Keep existing logic)
      const realWorldPosition = new THREE.Vector3(
        Number(anchor.x || 0),
        Number(anchor.y || 0),
        Number(anchor.z || 0),
      );
      let modelSpacePosition: THREE.Vector3;
      if (originPoint) {
        const offsetInModelUnits = realWorldPosition.clone().divideScalar(45.6);
        const originVector =
          originPoint instanceof THREE.Vector3
            ? originPoint.clone()
            : new THREE.Vector3(originPoint.x, originPoint.y, originPoint.z);
        modelSpacePosition = originVector.clone().add(offsetInModelUnits);
      } else {
        modelSpacePosition = realWorldPosition.clone().divideScalar(45.6);
        console.warn(
          `[ThreeViewer fileAnchors] No originPoint for anchor ${anchor.id}. Placing relative to world origin.`,
        );
      }
      console.log(
        `[ThreeViewer fileAnchors] Calculated modelSpacePosition for ${anchor.id}:`,
        modelSpacePosition,
      );

      // --- 2. Create Visual based on fileType ---
      let anchorObject: THREE.Object3D | null = null;

      // --- Create Label --- (Keep existing logic)
      if (anchor.fileType !== "image" && anchor.fileType !== "video") {
        const labelDiv = document.createElement("div");
        labelDiv.textContent = anchor.fileName || "File";
        labelDiv.style.padding = "2px 5px";
        labelDiv.style.fontSize = "10px";
        labelDiv.style.color = "#333";
        labelDiv.style.backgroundColor = "rgba(255, 255, 255, 0.85)";
        labelDiv.style.borderRadius = "3px";
        labelDiv.style.border = "1px solid #ccc";
        labelDiv.style.whiteSpace = "nowrap";
        labelDiv.style.pointerEvents = "none";

        const labelObject = new CSS3DObject(labelDiv);
        labelObject.scale.set(0.003, 0.003, 0.003);
        labelObject.position
          .copy(modelSpacePosition)
          .add(new THREE.Vector3(0, 0.15, 0));
        labelObject.userData.isLabel = true;
        labelObject.userData.anchorId = anchor.id;
        sceneRef.current!.add(labelObject);
      }
      // --- Handle Media Types ---
      if (anchor.fileType === "image") {
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
            const aspect = img.width / img.height;
            const planeWidth = 0.15;
            const planeHeight = planeWidth / aspect;
            const texture = new THREE.Texture(img);
            texture.needsUpdate = true;
            texture.encoding = THREE.sRGBEncoding;

            const material = new THREE.MeshBasicMaterial({
              map: texture,
              side: THREE.DoubleSide,
              transparent: true,
              depthWrite: false,
              alphaTest: 0.1,
            });
            const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
            const imagePlane = new THREE.Mesh(geometry, material);

            // imagePlane.position.copy(modelSpacePosition);
            // imagePlane.lookAt(cameraRef.current!.position);
            imagePlane.position.copy(modelSpacePosition);

            imagePlane.userData.anchorId = anchor.id;
            imagePlane.userData.type = "file-image";

            // Modify pointerdown event listener to select the helper mesh
            imagePlane.addEventListener("pointerdown", (e) => {
              e.stopPropagation();
              e.preventDefault(); // Prevent default browser actions

              const helper = imagePlane.userData.helperMesh as THREE.Mesh;
              const anchorId = imagePlane.userData.anchorId;
              const fileAnchorData = fileAnchors?.find(
                (a) => a.id === anchorId,
              ); // Get full anchor data

              console.log(
                `Image plane clicked for ${anchorId}. Helper found: ${!!helper}`,
              );

              // 1. Notify BlueprintEditor
              if (onFileAnchorClick && fileAnchorData) {
                onFileAnchorClick(anchorId, fileAnchorData); // Pass anchor data too
              } else {
                console.warn(
                  `onFileAnchorClick callback missing or anchor data not found for ${anchorId}`,
                );
              }

              // 2. Select the HELPER mesh for 3D interaction
              if (helper) {
                handleAnchorSelect(anchorId, helper, "file"); // Pass the HELPER mesh
              } else {
                console.warn(
                  `Helper mesh not found for file anchor ${anchorId} on click.`,
                );
                // Fallback: Maybe select the visual object, but highlight might be weird
                // handleAnchorSelect(anchorId, imagePlane, "file");
              }
            });

            sceneRef.current!.add(imagePlane);
            console.log(
              `%c[ThreeViewer fileAnchors] Successfully ADDED imagePlane mesh to scene for ${anchor.id}`,
              "color: green;",
            );
            fileAnchorsRef.current.set(anchor.id, imagePlane);

            // AFTER (Inside the fileAnchors.forEach loop, AFTER creating imagePlane/videoPlane/pdfObject/docIcon):
            // --- ADD HELPER MESH FOR ALL FILE ANCHOR TYPES ---
            const visualObject = imagePlane; // or videoPlane, pdfObject, docIcon (use the correct variable name)
            const helperGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.01); // Small invisible box
            const helperMaterial = new THREE.MeshBasicMaterial({
              visible: false,
              depthTest: false, // Optional: helps with raycasting consistency
              transparent: true,
              opacity: 0,
            });
            const helperMesh = new THREE.Mesh(helperGeometry, helperMaterial);

            // Position helper exactly where the visual object is
            helperMesh.position.copy(visualObject.position);
            helperMesh.rotation.copy(visualObject.rotation); // Match rotation
            // Note: Scaling helpers might not be desired, especially for CSS objects.
            // helperMesh.scale.copy(visualObject.scale);

            // Link helper and visual object using userData
            visualObject.userData.helperMesh = helperMesh; // Link visual -> helper
            helperMesh.userData.visualObject = visualObject; // Link helper -> visual
            helperMesh.userData.anchorId = anchor.id; // Store anchor ID on helper
            helperMesh.userData.type = "file-helper"; // Identify helper type

            // Add helper to the main WebGL scene
            sceneRef.current!.add(helperMesh);
            console.log(
              `[ThreeViewer fileAnchors] Added helper mesh for anchor ${anchor.id}`,
            );
            // --- END HELPER MESH ADDITION ---

            sceneRef.current!.add(visualObject);
            // Store the VISUAL object in the ref (or the helper, depending on your selection strategy, but visual is often fine here)
            fileAnchorsRef.current.set(anchor.id, visualObject);
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
        const backblazeImageUrl =
          "https://f005.backblazeb2.com/file/uploadedFiles-dev/083B81B6-F5EB-4AF3-B491-1DE40976280F_Asset0017.jpg";
        console.log(
          `[ThreeViewer fileAnchors] Setting img.src for ${anchor.id} to Backblaze URL: ${backblazeImageUrl}`,
        );
        img.src = backblazeImageUrl;
      } else if (anchor.fileType === "video") {
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
            const aspect = video.videoWidth / video.videoHeight;
            const planeWidth = 0.25;
            const planeHeight = planeWidth / aspect;

            const videoTexture = new THREE.VideoTexture(video);
            videoTexture.needsUpdate = true;
            videoTexture.encoding = THREE.sRGBEncoding;

            const material = new THREE.MeshBasicMaterial({
              map: videoTexture,
              side: THREE.DoubleSide,
              toneMapped: false,
              depthWrite: false,
              depthTest: false,
            });
            const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
            const videoPlane = new THREE.Mesh(geometry, material);

            videoPlane.renderOrder = 1;

            videoPlane.position.copy(modelSpacePosition);
            // videoPlane.lookAt(cameraRef.current!.position);
            videoPlane.userData.anchorId = anchor.id;
            videoPlane.userData.type = "file-video";
            videoPlane.userData.videoElement = video;

            // Add a pointerdown event listener to select the video anchor
            videoPlane.addEventListener("pointerdown", (e) => {
              e.stopPropagation();
              // Try to get a helper mesh if it was created (if not, fall back to videoPlane itself)
              const helper = videoPlane.userData.helperMesh as THREE.Mesh;
              if (helper) {
                handleAnchorSelect(anchor.id, helper, "file");
              } else {
                handleAnchorSelect(anchor.id, videoPlane, "file");
              }
            });

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

            // AFTER (Inside the fileAnchors.forEach loop, AFTER creating imagePlane/videoPlane/pdfObject/docIcon):
            // --- ADD HELPER MESH FOR ALL FILE ANCHOR TYPES ---
            const visualObject = imagePlane; // or videoPlane, pdfObject, docIcon (use the correct variable name)
            const helperGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.01); // Small invisible box
            const helperMaterial = new THREE.MeshBasicMaterial({
              visible: false,
              depthTest: false, // Optional: helps with raycasting consistency
              transparent: true,
              opacity: 0,
            });
            const helperMesh = new THREE.Mesh(helperGeometry, helperMaterial);

            // Position helper exactly where the visual object is
            helperMesh.position.copy(visualObject.position);
            helperMesh.rotation.copy(visualObject.rotation); // Match rotation
            // Note: Scaling helpers might not be desired, especially for CSS objects.
            // helperMesh.scale.copy(visualObject.scale);

            // Link helper and visual object using userData
            visualObject.userData.helperMesh = helperMesh; // Link visual -> helper
            helperMesh.userData.visualObject = visualObject; // Link helper -> visual
            helperMesh.userData.anchorId = anchor.id; // Store anchor ID on helper
            helperMesh.userData.type = "file-helper"; // Identify helper type

            // Add helper to the main WebGL scene
            sceneRef.current!.add(helperMesh);
            console.log(
              `[ThreeViewer fileAnchors] Added helper mesh for anchor ${anchor.id}`,
            );
            // --- END HELPER MESH ADDITION ---

            sceneRef.current!.add(visualObject);
            // Store the VISUAL object in the ref (or the helper, depending on your selection strategy, but visual is often fine here)
            fileAnchorsRef.current.set(anchor.id, visualObject);
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
      } else if (anchor.fileType === "pdf") {
        //if (anchor.fileType === "pdf")
        console.log(
          `[ThreeViewer fileAnchors] Attempting to create PDF viewer for ${anchor.id} (${anchor.fileName}) using Backblaze URL`,
        );
        // Create an iframe to display the PDF file
        const iframe = document.createElement("iframe");
        iframe.crossOrigin = "Anonymous";
        iframe.style.width = "0.8"; // Adjust as needed for your scene
        iframe.style.height = "1";
        iframe.style.border = "none";

        // Use hardcoded Backblaze URL for PDFs
        const backblazePdfUrl =
          "https://f005.backblazeb2.com/file/uploadedFiles-dev/00225FF2-0FE0-4B55-88E6-94F21ADE5512_Bio+Exam+1+Study+Notes.pdf";
        console.log(
          `[ThreeViewer fileAnchors] Setting iframe.src for ${anchor.id} to Backblaze URL: ${backblazePdfUrl}`,
        );
        iframe.src = backblazePdfUrl;

        // Wrap the iframe in a CSS3DObject so it can be positioned in the scene
        const pdfObject = new CSS3DObject(iframe);
        pdfObject.position.copy(modelSpacePosition);
        pdfObject.userData.anchorId = anchor.id;
        pdfObject.userData.type = "file-pdf";

        // --- ADD HELPER MESH FOR PDF ANCHOR ---
        const helperGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);
        const helperMaterial = new THREE.MeshBasicMaterial({
          visible: false,
          depthTest: false,
          transparent: true,
          opacity: 0,
        });
        const helperMesh = new THREE.Mesh(helperGeometry, helperMaterial);
        helperMesh.position.copy(pdfObject.position);
        pdfObject.userData.helperMesh = helperMesh;
        helperMesh.userData.anchorId = anchor.id;
        helperMesh.userData.type = "file-helper";
        sceneRef.current!.add(helperMesh);
        // --- END HELPER MESH ---

        // Modify pointerdown listener to select the helper mesh
        if (onFileAnchorClick) {
          pdfObject.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            const helper = pdfObject.userData.helperMesh as THREE.Mesh;
            if (helper) {
              console.log(
                `PDF object clicked for ${anchor.id}, selecting helper mesh.`,
              );
              handleAnchorSelect(anchor.id, helper, "file");
            } else {
              console.warn(`Helper mesh not found for PDF anchor ${anchor.id}`);
            }
            onFileAnchorClick(anchor.id, anchor);
          });
        }

        sceneRef.current!.add(pdfObject);
        console.log(
          `[ThreeViewer fileAnchors] Successfully added PDF viewer for ${anchor.id}`,
        );
        fileAnchorsRef.current.set(anchor.id, pdfObject);
      } else {
        console.log(
          `[ThreeViewer fileAnchors] Creating document placeholder for ${anchor.id} (${anchor.fileName})`,
        );
        const docGeometry = new THREE.BoxGeometry(0.15, 0.2, 0.02);
        const docMaterial = new THREE.MeshBasicMaterial({ color: 0x60a5fa });
        const docIcon = new THREE.Mesh(docGeometry, docMaterial);
        docIcon.position.copy(modelSpacePosition);
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
  }, [fileAnchors, originPoint, cameraRef.current]);

  useEffect(() => {
    if (!sceneRef.current || !modelAnchors) return;

    modelAnchors.forEach((anchor) => {
      if (anchorModelsRef.current.has(anchor.id)) return;

      // 1) Convert your anchor coords from feet to the model's local coords
      let anchorPosition;
      if (anchor.position) {
        // If anchor has a nested position object
        anchorPosition = new THREE.Vector3(
          Number(anchor.position.x),
          Number(anchor.position.y),
          Number(anchor.position.z),
        );
      } else {
        // If anchor has direct x, y, z properties
        anchorPosition = new THREE.Vector3(
          Number(anchor.x || 0),
          Number(anchor.y || 0),
          Number(anchor.z || 0),
        );
      }

      // STORE ORIGINAL COORDS FOR REFERENCE
      const originalX = anchorPosition.x;
      const originalY = anchorPosition.y;
      const originalZ = anchorPosition.z;

      // Use originPoint directly for relative positioning
      if (originPoint) {
        console.log("Using originPoint for relative positioning:", originPoint);
        anchorPosition.sub(originPoint);
        anchorPosition.divideScalar(45.6);
      } else {
        console.log("No originPoint available, using global origin");
        anchorPosition.divideScalar(45.6);
      }

      console.log("Adding model for anchor", anchor.id, "at", anchorPosition);

      // --- LOAD 3D MODEL INSTEAD OF CREATING ORANGE DOT ---
      const loader = new GLTFLoader();
      const modelUrl =
        "https://f005.backblazeb2.com/file/objectModels-dev/Mona_Lisa_PBR_hires_model.glb";

      // Create temporary marker while model loads
      const tempMarkerGeometry = new THREE.SphereGeometry(0.02, 16, 16);
      const tempMarkerMaterial = new THREE.MeshBasicMaterial({
        color: 0xff8c00,
        transparent: true,
        opacity: 0.5,
      });
      const tempMarker = new THREE.Mesh(tempMarkerGeometry, tempMarkerMaterial);
      tempMarker.position.copy(anchorPosition);
      sceneRef.current.add(tempMarker);

      // Load the actual model
      // Load the actual model
      loader.load(
        modelUrl,
        (gltf) => {
          const model = gltf.scene;

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
          model.position.copy(anchorPosition);

          // Add the model to the scene
          sceneRef.current.add(model);

          // Remove temporary marker
          sceneRef.current.remove(tempMarker);

          // Store reference to the model
          anchorModelsRef.current.set(anchor.id, model);

          // Add user data to the model to identify it later
          model.userData.anchorId = anchor.id;

          console.log(`Model loaded successfully for anchor ${anchor.id}`);
        },
        (xhr) => {
          // Optional: Loading progress
          console.log(
            `${anchor.id} model: ${(xhr.loaded / xhr.total) * 100}% loaded`,
          );
        },
        (error) => {
          console.error(`Error loading model for anchor ${anchor.id}:`, error);

          // If model fails to load, keep the marker as fallback
          tempMarker.material.opacity = 1.0;
          anchorModelsRef.current.set(anchor.id, tempMarker);
        },
      );

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
        .copy(anchorPosition)
        .add(new THREE.Vector3(0, 0.15, 0)); // Increased Y offset for models

      // Add label to scene
      sceneRef.current.add(labelObject);
    });
  }, [modelAnchors, originPoint]);

  // NEW: Centralized selection handler for ALL anchor types
  // NEW: Centralized selection handler for ALL anchor types
  const handleAnchorSelect = (
    anchorId: string,
    objectToTransform: THREE.Object3D, // This is the object to attach controls to (often the helper)
    anchorType: "model" | "text" | "file" | "webpage",
  ) => {
    console.log(
      `Selecting ${anchorType} anchor: ${anchorId}`,
      objectToTransform,
    );

    // --- ADD LOGGING ---
    console.log(
      `[handleAnchorSelect] Called for ${anchorType} anchor: ${anchorId}`,
    );
    console.log(`[handleAnchorSelect] Object to transform:`, objectToTransform);
    console.log(
      `[handleAnchorSelect] Object type: ${objectToTransform.type}, name: ${objectToTransform.name}, userData:`,
      objectToTransform.userData,
    );
    // --- END LOGGING ---

    handleDeselect(); // Deselect previous first
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
      console.log(`[handleAnchorSelect] Attaching TransformControls...`); // ADD LOG
      transformControlsRef.current.attach(objectToTransform);
      console.log(
        `[handleAnchorSelect] Controls attached. Current object:`,
        transformControlsRef.current.object,
      );
      // Default to translate mode on new selection
      transformControlsRef.current.setMode("translate");
      setTransformMode("translate"); // Update state

      transformControlsRef.current.enabled = true; // Ensure controls are enabled
      // Make controls visible
      transformControlsRef.current.visible = true;
      console.log(
        `[handleAnchorSelect] Controls enabled: ${transformControlsRef.current.enabled}, visible: ${transformControlsRef.current.visible}`,
      );
    } else {
      console.error("TransformControls ref is not available!");
      return; // Cannot proceed without transform controls
    }

    // 4. Show Transform UI Indicator (We removed the UI, but keep state for logic)
    setShowTransformUI(true);

    // 5. Apply Highlighting
    highlightObject(objectToTransform, sceneRef.current); // Highlight the object attached to controls

    // 6. Visual Feedback Animation (Subtle scale pulse)
    // Avoid scaling CSS3D objects directly as it affects layout/size
    // Don't pulse helpers either
    if (
      !(objectToTransform instanceof CSS3DObject) &&
      !objectToTransform.userData?.type?.includes("helper")
    ) {
      const originalScale = objectToTransform.scale.clone();
      const targetScale = originalScale.clone().multiplyScalar(1.05); // Slightly larger

      new TWEEN.Tween(objectToTransform.scale)
        .to({ x: targetScale.x, y: targetScale.y, z: targetScale.z }, 150)
        .easing(TWEEN.Easing.Cubic.Out)
        .yoyo(true) // Go back to original size
        .repeat(1)
        .start();
    }

    // 7. Ensure OrbitControls are handled (disabled during drag via listeners)
    if (orbitControlsRef.current && transformControlsRef.current) {
      // Orbit controls will be disabled by the 'dragging-changed' listener
      // on TransformControls, so ensure they are enabled when *not* dragging.
      orbitControlsRef.current.enabled = !transformControlsRef.current.dragging;
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
  };

  const highlightObject = (
    object: THREE.Object3D | null,
    scene: THREE.Scene | null,
  ) => {
    if (!scene) return;

    // Remove any existing highlight
    const existingHighlight = scene.getObjectByName("selection-highlight");
    if (existingHighlight) {
      // If it was a CSS highlight, revert styles
      if (
        existingHighlight.userData.originalStyle &&
        existingHighlight.userData.targetElement
      ) {
        Object.assign(
          existingHighlight.userData.targetElement.style,
          existingHighlight.userData.originalStyle,
        );
      }
      scene.remove(existingHighlight);
    }

    if (!object) return; // If null, we just wanted to remove the highlight

    // ***** START CHANGE: Check if it's our text helper mesh *****
    if (
      object.userData?.type === "text-helper" &&
      object.userData?.labelObject
    ) {
      // Option 1: Highlight the CSS element via the labelObject reference
      const labelObject = object.userData.labelObject as CSS3DObject;
      const element = labelObject.element as HTMLElement;
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

        // Store original style and target element in a dummy object added to the scene
        const dummyObject = new THREE.Object3D();
        dummyObject.name = "selection-highlight"; // Use same name for easy removal
        dummyObject.userData.isCSSHighlight = true;
        dummyObject.userData.targetElement = element;
        dummyObject.userData.originalStyle = originalStyle;
        scene.add(dummyObject);
      }

      // Option 2 (Alternative/Additional): Highlight the helper mesh itself using Box3Helper
      // This provides a 3D bounding box highlight around the invisible helper
      try {
        // Since the helper is tiny, create a slightly larger box around its position
        const helperPos = object.position;
        const size = 0.05; // Adjust size of highlight box as needed
        const min = helperPos.clone().subScalar(size / 2);
        const max = helperPos.clone().addScalar(size / 2);
        const bbox = new THREE.Box3(min, max);

        // --- MODIFIED CHECK ---
        // For helper meshes, assume the position is valid and skip the potentially problematic isFinite check
        // Just ensure the box isn't empty (which it shouldn't be if size > 0)
        if (!bbox.isEmpty()) {
          // --- END MODIFIED CHECK ---
          const boxHelper = new THREE.Box3Helper(bbox, 0x00ffff); // Cyan color
          boxHelper.name = "selection-highlight"; // Use same name
          boxHelper.material.depthTest = false;
          boxHelper.material.transparent = true;
          boxHelper.material.opacity = 0.9;
          boxHelper.renderOrder = 10001;
          scene.add(boxHelper);

          // Optional pulse animation for BoxHelper
          const animatePulse = () => {
            if (!boxHelper.parent) return;
            requestAnimationFrame(animatePulse);
            const time = Date.now() * 0.002;
            boxHelper.material.opacity = 0.6 + Math.sin(time * 5) * 0.3;
          };
          animatePulse();
        } else {
          console.warn(
            "[highlightObject] Bounding box for helper mesh is empty.",
            object,
          );
        }
      } catch (error) {
        console.error(
          "Error creating bounding box highlight for helper:",
          error,
          object,
        );
      }
    }
    // ***** END CHANGE *****
    else if (object instanceof CSS3DObject) {
      // Original CSS3DObject handling (for webpages etc.)
      // Highlight CSS3DObject (Webpage iframe container)
      const element = object.element as HTMLElement;
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

        // Store original style and target element in a dummy object added to the scene
        const dummyObject = new THREE.Object3D();
        dummyObject.name = "selection-highlight";
        dummyObject.userData.isCSSHighlight = true;
        dummyObject.userData.targetElement = element;
        dummyObject.userData.originalStyle = originalStyle;
        scene.add(dummyObject);
      }
    } else if (object instanceof THREE.Mesh || object instanceof THREE.Group) {
      // Handle other Meshes/Groups (Models, File Planes)
      // Highlight Meshes or Groups (Models, File Planes) using Box3Helper
      try {
        const bbox = new THREE.Box3().setFromObject(object);
        // Check if bounding box is valid (not empty or infinite)
        if (!bbox.isEmpty() && bbox.min.isFinite() && bbox.max.isFinite()) {
          const boxHelper = new THREE.Box3Helper(bbox, 0x00ffff); // Cyan color
          boxHelper.name = "selection-highlight";
          boxHelper.material.depthTest = false;
          boxHelper.material.transparent = true;
          boxHelper.material.opacity = 0.9;
          boxHelper.renderOrder = 10001; // Ensure it renders on top
          scene.add(boxHelper);

          // Optional: Add subtle pulse animation to BoxHelper
          const animatePulse = () => {
            if (!boxHelper.parent) return; // Stop if removed
            requestAnimationFrame(animatePulse);
            const time = Date.now() * 0.002;
            boxHelper.material.opacity = 0.6 + Math.sin(time * 5) * 0.3;
          };
          animatePulse();
        } else {
          console.warn(
            "Cannot create highlight: Invalid bounding box for object",
            object,
          );
        }
      } catch (error) {
        console.error("Error creating bounding box highlight:", error, object);
      }
    }
  };

  useEffect(() => {
    // Ensure both scene and textAnchors exist before proceeding.
    if (!sceneRef.current || !textAnchors) return;

    const currentAnchorIds = new Set<string>(); // Keep track of anchors processed in this run

    textAnchors.forEach((anchor: TextAnchor) => {
      currentAnchorIds.add(anchor.id); // Mark this ID as current

      // Check if this anchor already exists visually
      const existingLabelObject = textAnchorsRef.current.get(anchor.id);

      if (existingLabelObject && existingLabelObject instanceof CSS3DObject) {
        // --- UPDATE EXISTING ANCHOR ---
        const currentVisualText = existingLabelObject.element.textContent;
        const newText = anchor.textContent;

        if (currentVisualText !== newText) {
          console.log(
            `Updating text for anchor ${anchor.id} from "${currentVisualText}" to "${newText}"`,
          );
          existingLabelObject.element.textContent = newText;
        }

        // Optionally update position if needed
        // You might need to recalculate modelSpacePosition here if position can change
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
      let anchorPosition;
      if (
        (anchor as any).position &&
        typeof (anchor as any).position === "object"
      ) {
        anchorPosition = new THREE.Vector3(
          Number((anchor as any).position.x || 0),
          Number((anchor as any).position.y || 0),
          Number((anchor as any).position.z || 0),
        );
      } else {
        anchorPosition = new THREE.Vector3(
          Number(anchor.x || 0),
          Number(anchor.y || 0),
          Number(anchor.z || 0),
        );
      }

      const originalX = anchorPosition.x;
      const originalY = anchorPosition.y;
      const originalZ = anchorPosition.z;
      let modelSpacePosition;
      if (originPoint) {
        const offsetInModelUnits = new THREE.Vector3(
          anchorPosition.x / 45.6,
          anchorPosition.y / 45.6,
          anchorPosition.z / 45.6,
        );
        const originVector =
          originPoint instanceof THREE.Vector3
            ? originPoint.clone()
            : new THREE.Vector3(originPoint.x, originPoint.y, originPoint.z);
        modelSpacePosition = originVector.clone().add(offsetInModelUnits);
        // console.log(`Text anchor ${anchor.id} positioning calculation:`, { // Keep commented unless debugging position
        //   originalPosition: anchorPosition,
        //   offsetInModelUnits,
        //   originPoint,
        //   finalPosition: modelSpacePosition,
        // });
      } else {
        modelSpacePosition = anchorPosition.clone().divideScalar(45.6);
      }

      // --- CREATE A CSS3DObject FOR THE LABEL ---
      const labelDiv = document.createElement("div");
      labelDiv.textContent = anchor.textContent;
      labelDiv.style.pointerEvents = "auto"; // keep pointer events ON

      labelDiv.style.padding = "10px 12px";
      labelDiv.style.fontSize = "14px";
      labelDiv.style.color = "#ffffff";
      labelDiv.style.backgroundColor = "rgba(120, 120, 130, 0.82)";
      labelDiv.style.borderRadius = "12px";
      labelDiv.style.whiteSpace = "normal";
      labelDiv.style.maxWidth = "220px";
      labelDiv.style.wordWrap = "break-word";
      labelDiv.style.overflowWrap = "break-word";
      labelDiv.style.textAlign = "left";
      labelDiv.style.backdropFilter = "blur(10px)";
      labelDiv.style.boxShadow = "0 4px 10px rgba(0, 0, 0, 0.2)";
      labelDiv.style.border = "1px solid rgba(255, 255, 255, 0.1)";
      labelDiv.style.fontFamily =
        "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif";
      labelDiv.style.fontWeight = "400";
      labelDiv.style.letterSpacing = "0.2px";

      const labelObject = new CSS3DObject(labelDiv); // Define labelObject here
      labelObject.scale.set(0.0015, 0.0015, 0.0015);
      labelObject.position.copy(modelSpacePosition);
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
      helperMesh.position.copy(labelObject.position);

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
      sceneRef.current.add(labelObject); // CSS layer
      sceneRef.current.add(helperMesh); // WebGL layer

      // Store the label object in the ref
      textAnchorsRef.current.set(anchor.id, labelObject); // Store the CSS3DObject directly
    }); // End forEach

    // --- CLEANUP REMOVED ANCHORS ---
    textAnchorsRef.current.forEach((labelObject, anchorId) => {
      if (!currentAnchorIds.has(anchorId)) {
        // This anchor is no longer in the props, remove it from the scene
        console.log(`Removing text anchor ${anchorId} from scene.`);
        if (labelObject && sceneRef.current) {
          sceneRef.current.remove(labelObject);
          // ALSO REMOVE THE HELPER MESH
          if (labelObject.userData.helperMesh && sceneRef.current) {
            sceneRef.current.remove(labelObject.userData.helperMesh);
            console.log(`Removing helper mesh for text anchor ${anchorId}.`);
          }
        }
        textAnchorsRef.current.delete(anchorId); // Remove from our tracking ref
      }
    });
  }, [
    textAnchors,
    originPoint,
    sceneRef.current,
    onTextAnchorClick,
    handleAnchorSelect,
  ]); // Added dependencies

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
          if (!(transformControlsRef.current.object instanceof CSS3DObject)) {
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

  useEffect(() => {
    if (!sceneRef.current || !qrCodeAnchors) {
      console.log(
        "[ThreeViewer qrCodeAnchors Effect] Skipping: No scene or anchors.",
      );
      return; // Exit if scene or anchors aren't ready
    }

    console.log(
      `%c[ThreeViewer qrCodeAnchors Effect] START - Processing ${qrCodeAnchors.length} anchors`,
      "color: purple; font-weight: bold;",
      qrCodeAnchors,
    );

    const currentAnchorIds = new Set(qrCodeAnchors.map((a) => a.id));

    // --- Add or Update Markers ---
    qrCodeAnchors.forEach((anchor) => {
      if (qrCodeMarkersRef.current.has(anchor.id)) {
        // Optional: Update position if needed, though QR codes are usually static
        // const existingMarker = qrCodeMarkersRef.current.get(anchor.id);
        // existingMarker.position.copy(calculateModelSpacePosition(anchor));
        return; // Already exists, skip creation
      }

      console.log(
        `[ThreeViewer qrCodeAnchors] Creating marker for Anchor ID: ${anchor.id}`,
      );

      // --- Calculate Position ---
      const realWorldPosition = new THREE.Vector3(
        Number(anchor.x || 0),
        Number(anchor.y || 0),
        Number(anchor.z || 0),
      );
      let modelSpacePosition: THREE.Vector3;

      if (originPoint) {
        const offsetInModelUnits = realWorldPosition
          .clone()
          .divideScalar(45.64); // Use your scale factor
        const originVector =
          originPoint instanceof THREE.Vector3
            ? originPoint.clone()
            : new THREE.Vector3(originPoint.x, originPoint.y, originPoint.z);
        modelSpacePosition = originVector.clone().add(offsetInModelUnits);
      } else {
        modelSpacePosition = realWorldPosition.clone().divideScalar(45.64); // Use your scale factor
        console.warn(
          `[ThreeViewer qrCodeAnchors] No originPoint for anchor ${anchor.id}. Placing relative to world origin.`,
        );
      }
      console.log(
        `[ThreeViewer qrCodeAnchors] Calculated modelSpacePosition for ${anchor.id}:`,
        modelSpacePosition,
      );

      // --- Create Visual Marker ---
      // Example: Simple orange sphere marker
      const markerGeometry = new THREE.SphereGeometry(0.025, 16, 16); // Adjust size as needed
      const markerMaterial = new THREE.MeshBasicMaterial({
        color: 0xffa500, // Orange color
        depthTest: false, // Make it render on top
        transparent: true,
        opacity: 0.9,
      });
      const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
      markerMesh.position.copy(modelSpacePosition);
      markerMesh.renderOrder = 9999; // Ensure it's visible

      // Add userData for potential future interactions
      markerMesh.userData.anchorId = anchor.id;
      markerMesh.userData.type = "qrCode";

      // Add marker to the scene
      sceneRef.current!.add(markerMesh);
      console.log(
        `%c[ThreeViewer qrCodeAnchors] Successfully ADDED marker mesh to scene for ${anchor.id}`,
        "color: green;",
      );

      // Store reference to the marker
      qrCodeMarkersRef.current.set(anchor.id, markerMesh);
    }); // <-- End of qrCodeAnchors.forEach

    // --- Cleanup Removed Markers ---
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
  }, [qrCodeAnchors, originPoint, sceneRef.current]);

  const loadAndAddWebpage = async (
    url: string,
    anchorId: string,
    position: THREE.Vector3,
  ) => {
    if (!sceneRef.current) return null;
    console.log("Loading webpage at position:", position, "URL:", url);

    // Create a container for the webpage with a better appearance
    const container = document.createElement("div");
    container.style.width = "800px";
    container.style.height = "600px";
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
    overlay.style.backgroundColor = "transparent";
    overlay.style.pointerEvents = "auto";
    overlay.addEventListener("pointerdown", (ev) => {
      ev.stopPropagation();
      ev.preventDefault(); // Prevent default actions

      // Find the associated helper mesh via the css3dObject
      const helper = css3dObject.userData.helperMesh as THREE.Mesh;
      const anchorId = css3dObject.userData.anchorId; // Get ID from CSS object
      const fileAnchorData = fileAnchors?.find((a) => a.id === anchorId); // Get full anchor data

      console.log(
        `PDF overlay clicked for ${anchorId}. Helper found: ${!!helper}`,
      );

      // 1. Notify BlueprintEditor
      if (onFileAnchorClick && fileAnchorData) {
        onFileAnchorClick(anchorId, fileAnchorData); // Pass anchor data
      } else {
        console.warn(
          `onFileAnchorClick callback missing or anchor data not found for PDF ${anchorId}`,
        );
      }

      // 2. Select the HELPER mesh
      if (helper) {
        handleAnchorSelect(anchorId, helper, "file"); // Select the HELPER
      } else {
        console.warn(
          `Helper mesh not found for PDF anchor ${anchorId} on click.`,
        );
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
    sceneRef.current.add(css3dObject);

    // Animate the appearance
    new TWEEN.Tween(css3dObject.scale)
      .to({ x: 0.005, y: 0.005, z: 0.005 }, 400)
      .easing(TWEEN.Easing.Back.Out)
      .start();

    console.log("Added webpage to scene:", url);
    return css3dObject;
  };

  useEffect(() => {
    if (!sceneRef.current || !webpageAnchors) return;

    console.log("Processing webpage anchors:", webpageAnchors);

    webpageAnchors.forEach(async (anchor) => {
      // Skip if we've already added this anchor
      if (anchorWebpagesRef.current.has(anchor.id)) {
        // Check if helper mesh exists, if not, add it (migration case)
        const existingWebpageObject = anchorWebpagesRef.current.get(anchor.id);
        if (
          existingWebpageObject &&
          !existingWebpageObject.userData.helperMesh &&
          sceneRef.current
        ) {
          console.log(
            `Adding missing helper mesh for existing webpage anchor ${anchor.id}`,
          );
          const helperGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);
          const helperMaterial = new THREE.MeshBasicMaterial({
            visible: false,
            depthTest: false,
            transparent: true,
            opacity: 0,
          });
          const helperMesh = new THREE.Mesh(helperGeometry, helperMaterial);
          helperMesh.position.copy(existingWebpageObject.position);
          helperMesh.rotation.copy(existingWebpageObject.rotation);
          helperMesh.scale.copy(existingWebpageObject.scale);
          helperMesh.userData.anchorId = anchor.id;
          helperMesh.userData.type = "webpage-helper";
          helperMesh.userData.cssObject = existingWebpageObject;
          existingWebpageObject.userData.helperMesh = helperMesh;
          sceneRef.current.add(helperMesh);
        } else {
          console.log(
            `Anchor ${anchor.id} already exists in scene (with helper), skipping`,
          );
        }
        return;
      }

      console.log(`Processing anchor ${anchor.id} with coordinates:`, {
        x: anchor.x,
        y: anchor.y,
        z: anchor.z,
        url: anchor.webpageUrl,
      });

      // Create a vector from the anchor's stored coordinates (which are in real-world feet)
      const realWorldPosition = new THREE.Vector3(
        Number(anchor.x || 0),
        Number(anchor.y || 0),
        Number(anchor.z || 0),
      );

      // FIXED POSITIONING LOGIC:
      // 1. Convert real-world feet to model units
      // 2. ADD to origin point (not subtract!)
      let modelSpacePosition;

      if (originPoint) {
        // Scale down by 45.6 to convert from feet to model units
        const offsetInModelUnits = new THREE.Vector3(
          realWorldPosition.x / 45.6,
          realWorldPosition.y / 45.6,
          realWorldPosition.z / 45.6,
        );

        // Create a proper THREE.Vector3 from originPoint (if it's not already one)
        const originVector =
          originPoint instanceof THREE.Vector3
            ? originPoint.clone()
            : new THREE.Vector3(originPoint.x, originPoint.y, originPoint.z);

        // ADD this offset to the origin point (critically important - we add, not subtract!)
        modelSpacePosition = originVector.clone().add(offsetInModelUnits);

        console.log(`Anchor ${anchor.id} positioning calculation:`, {
          realWorldPosition,
          offsetInModelUnits,
          originPoint,
          finalPosition: modelSpacePosition,
        });
      } else {
        // If no origin, just convert from feet to model units
        modelSpacePosition = realWorldPosition.clone().divideScalar(45.6);
      }

      // Load and add the actual webpage using CSS3DObject with iframe
      const webpageObject = await loadAndAddWebpage(
        anchor.webpageUrl,
        anchor.id, // Pass anchor ID
        modelSpacePosition,
      );

      // If webpage loading was successful, store both objects
      if (webpageObject && sceneRef.current) {
        // Add sceneRef check

        // --- ADD HELPER MESH FOR WEBPAGE ANCHOR ---
        const helperGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.01); // Tiny invisible box
        const helperMaterial = new THREE.MeshBasicMaterial({
          visible: false,
          depthTest: false,
          transparent: true,
          opacity: 0,
        });
        const helperMesh = new THREE.Mesh(helperGeometry, helperMaterial);
        helperMesh.position.copy(webpageObject.position); // Position helper where the CSS object is
        helperMesh.rotation.copy(webpageObject.rotation); // Match rotation
        helperMesh.scale.copy(webpageObject.scale); // Match scale (though scaling CSS might be tricky)
        helperMesh.userData.anchorId = anchor.id;
        helperMesh.userData.type = "webpage-helper";
        helperMesh.userData.cssObject = webpageObject; // Link helper back to CSS object
        webpageObject.userData.helperMesh = helperMesh; // Link CSS object to helper
        sceneRef.current!.add(helperMesh); // Add helper to the main scene
        // --- END HELPER MESH ---

        anchorWebpagesRef.current.set(anchor.id, webpageObject); // Store the CSS3DObject
        webpageObject.userData.anchorId = anchor.id;
        webpageObject.userData.isWebpageAnchor = true; // Mark for identification
      } else {
        // Fallback: Webpage failed to load. Don't add anything to the ref,
        // or consider adding a placeholder CSS3DObject if needed.
        console.warn(
          `Webpage anchor ${anchor.id} failed to load, not adding to scene map.`,
        );
        // Optionally create a fallback visual like a simple text label here if desired,
        // but don't store the non-existent marker in the ref.
        // Example fallback label (similar to before, but not stored in anchorWebpagesRef):
        if (sceneRef.current) {
          // Add sceneRef check for fallback
          const labelDiv = document.createElement("div");
          labelDiv.textContent = `Error: ${anchor.webpageUrl}`;
          labelDiv.style.padding = "2px 4px";
          labelDiv.style.fontSize = "12px";
          labelDiv.style.color = "#cc0000"; // Error color
          labelDiv.style.backgroundColor = "rgba(255,220,220,0.8)";
          labelDiv.style.borderRadius = "4px";
          labelDiv.style.whiteSpace = "nowrap";
          const labelObject = new CSS3DObject(labelDiv);
          labelObject.scale.set(0.005, 0.005, 0.005);
          labelObject.position.copy(modelSpacePosition); // Position at the anchor point
          sceneRef.current.add(labelObject);
        }
      }

      console.log(
        `Successfully added anchor ${anchor.id} to scene at position:`,
        modelSpacePosition,
      );
    });

    // Cleanup removed webpage anchors
    anchorWebpagesRef.current.forEach((webpageObject, id) => {
      if (!webpageAnchors.some((a) => a.id === id)) {
        console.log(`Cleaning up webpage anchor ${id}`);
        if (sceneRef.current) {
          sceneRef.current.remove(webpageObject);
          // Also remove the helper mesh
          const helperMesh = webpageObject.userData.helperMesh;
          if (helperMesh && sceneRef.current.getObjectById(helperMesh.id)) {
            sceneRef.current.remove(helperMesh);
            console.log(`Removed helper mesh for webpage anchor ${id}`);
          }
        }
        anchorWebpagesRef.current.delete(id);
      }
    });
  }, [webpageAnchors, originPoint, sceneRef, loadAndAddWebpage]); // Added sceneRef and loadAndAddWebpage dependencies

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
    const loader = new GLTFLoader();
    const fullModelPath = `/${finalModelPath}`;

    try {
      const gltf = await new Promise((resolve, reject) => {
        loader.load(fullModelPath, resolve, undefined, reject);
      });

      const model = gltf.scene;

      // Calculate bounding box for scaling
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      // Scale the model to a reasonable size (adjust 0.5 as needed)
      const scale = 0.1 / maxDim;
      model.scale.multiplyScalar(scale);

      // Position the model at the clicked point
      model.position.copy(position);

      sceneRef.current.add(model);
      return model;
    } catch (error) {
      console.error("Error loading model:", error);
      return null;
    }
  };

  useEffect(() => {
    if (!mountRef.current || !modelPath) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

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
      animateDragIndicatorRef.current = null;
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

    scene.background = new THREE.Color(0xf0f0f0);

    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000,
    );
    cameraRef.current = camera;
    camera.position.set(0.85, 0.85, 0.85);

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

    // --- Begin CSS3DRenderer Setup ---
    // Create a CSS3DRenderer for HTML/CSS elements (such as your webpage iframe)
    let cssRenderer;
    if (typeof window !== "undefined" && mountRef.current) {
      cssRenderer = new CSS3DRenderer();
      cssRenderer.setSize(
        mountRef.current.clientWidth,
        mountRef.current.clientHeight,
      );
      cssRenderer.domElement.style.position = "absolute";
      cssRenderer.domElement.style.top = "0px";
      cssRenderer.domElement.style.pointerEvents = "none";
      mountRef.current.appendChild(cssRenderer.domElement);
    }
    // --- End CSS3DRenderer Setup ---

    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControlsRef.current = orbitControls;

    const transformControls = new TransformControls(
      camera,
      renderer.domElement,
    );
    transformControlsRef.current = transformControls;
    scene.add(transformControls);

    // Configure gizmo appearance
    configureTransformControls(transformControls);

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

    transformControls.addEventListener("dragging-changed", (event) => {
      orbitControls.enabled = !event.value;
    });

    transformControls.addEventListener("mouseUp", () => {
      if (orbitControlsRef.current && !isMarkerSelectedRef.current) {
        orbitControlsRef.current.enabled = true;
      }
    });

    transformControls.addEventListener("objectChange", () => {
      const controlledObject = transformControls.object;
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

    const loader = new GLTFLoader();

    const fullModelPath =
      "https://f005.backblazeb2.com/file/objectModels-dev/home.glb";

    // Determine if modelPath is an external URL or local path
    // let fullModelPath = modelPath;

    // // If it's not an external URL, prepend a slash for local path
    // if (!modelPath.startsWith('http') && !modelPath.startsWith('/')) {
    //   fullModelPath = `/${modelPath}`;
    // }

    console.log("Attempting to fetch 3D model from:", fullModelPath);

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
      loader.load(
        fullModelPath,
        (gltf) => {
          const model = gltf.scene;
          parentModelRef.current = model;
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2 / maxDim;
          model.scale.multiplyScalar(scale * 2);
          model.position.copy(center).multiplyScalar(-scale);

          scene.add(model);

          onLoad?.();
          camera.position.set(0.85, 0.85, 0.85);
          orbitControls.target.set(0, 0, 0);
          orbitControls.update();
        },
        undefined,
        (error) => {
          console.error("Error loading model:", error);

          // Implement retry logic for Firebase Storage URLs
          if (
            attempt < maxAttempts - 1 &&
            fullModelPath.includes("firebasestorage.googleapis.com")
          ) {
            console.log(
              `Retrying model load... Attempt ${attempt + 1}/${maxAttempts}`,
            );

            // Wait a short delay before retrying
            setTimeout(() => {
              loadModelWithRetry(attempt + 1, maxAttempts);
            }, 1000); // 1 second delay between retries
          } else {
            // All retries failed or not a Firebase URL
            if (onError) {
              onError(error.message || "Error loading model");
            }
          }
        },
      );
    };

    // Start the loading process with retry
    loadModelWithRetry(0, 3);

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
          const msg = `Relative to origin: X:${offset.x.toFixed(2) * 45.64}, Y:${offset.y.toFixed(2) * 45.64}, Z:${offset.z.toFixed(2) * 45.64}`;
          setDistanceDisplay(msg);
        }

        if (clickMarkerRef.current) {
          clickMarkerRef.current.position.copy(hitPoint);
          clickMarkerRef.current.visible = true;
          setSelectedPoint(hitPoint.clone());
          setShowSidePanel(true);
          transformControls.detach();
          isMarkerSelectedRef.current = false;
        }
      }
    };

    // 1) Remove “if (originPoint) { ... }”
    // 2) Use “if (originRef.current) { ... }”
    // 3) Instead of offset = hitPoint.sub(originPoint),
    //    do offset = hitPoint.sub(originRef.current!).

    // async function handleClick(event: MouseEvent) {
    //   console.log("[ThreeViewer] handleClick fired!");
    //   if (
    //     !mountRef.current ||
    //     !clickMarkerRef.current ||
    //     !sceneRef.current ||
    //     !cameraRef.current
    //   )
    //     return;

    //   // 1) Convert click to normalized coords
    //   const rect = mountRef.current.getBoundingClientRect();
    //   const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    //   const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    //   const mouse = new THREE.Vector2(x, y);

    //   // 2) Perform the raycast
    //   raycasterRef.current.setFromCamera(mouse, cameraRef.current);
    //   const allIntersects = raycasterRef.current.intersectObjects(
    //     sceneRef.current.children,
    //     true,
    //   );

    //   // 3) If no intersection, bail out
    //   if (allIntersects.length === 0) return;

    //   // After your existing code that checks if something is clicked (inside handleClick)
    //   // Check if we clicked on an image or video anchor
    //   let isMediaAnchorClicked = false;
    //   let mediaAnchorId = null;
    //   let mediaObject = null;

    //   // Check all file anchors (images/videos)
    //   fileAnchorsRef.current.forEach((anchor, id) => {
    //     if (!isMediaAnchorClicked) {
    //       // Check if this anchor was clicked or contains the clicked object
    //       if (clickedObj === anchor || clickedObj.isDescendantOf?.(anchor)) {
    //         isMediaAnchorClicked = true;
    //         mediaAnchorId = id;
    //         mediaObject = anchor;
    //       }
    //     }
    //   });

    //   if (isMediaAnchorClicked && mediaObject) {
    //     console.log(`Media anchor clicked: ${mediaAnchorId}`);

    //     // If it's a video, check for the onClick handler
    //     if (mediaObject.userData.type === "video") {
    //       const videoPlane = mediaObject.children.find(
    //         (child) =>
    //           child instanceof THREE.Mesh &&
    //           child.material &&
    //           child.material.map instanceof THREE.VideoTexture,
    //       );

    //       if (videoPlane && videoPlane.userData.onClick) {
    //         videoPlane.userData.onClick();
    //       }
    //     }

    //     // Show transform controls for the media
    //     if (transformControlsRef.current) {
    //       // Get current mode or default to translate
    //       const currentMode = transformControlsRef.current.mode || "translate";

    //       // Attach to model
    //       transformControlsRef.current.attach(mediaObject);

    //       // Configure appearance and feedback
    //       transformControlsRef.current.setMode(currentMode);
    //       transformControlsRef.current.visible = true;

    //       // Add visual feedback
    //       addModelHighlight(mediaObject, sceneRef.current);

    //       // Show transformation UI
    //       setShowTransformUI(true);
    //       setTransformMode(currentMode as "translate" | "rotate" | "scale");

    //       // Animation feedback
    //       const originalScale = mediaObject.scale.clone();
    //       new TWEEN.Tween(mediaObject.scale)
    //         .to(
    //           {
    //             x: originalScale.x * 1.05,
    //             y: originalScale.y * 1.05,
    //             z: originalScale.z * 1.05,
    //           },
    //           150,
    //         )
    //         .easing(TWEEN.Easing.Cubic.Out)
    //         .yoyo(true)
    //         .repeat(1)
    //         .start();
    //     }

    //     return; // Exit early after handling media click
    //   }

    //   // MOVED: Handle origin point setting first - this is the key fix
    //   if (isChoosingOriginRef.current) {
    //     console.log("ORIGIN SELECTION MODE - Processing click");
    //     const hitPoint = allIntersects[0].point;
    //     if (onOriginSet && setIsChoosingOrigin) {
    //       onOriginSet(hitPoint.clone());
    //       setIsChoosingOrigin(false);

    //       originRef.current = hitPoint.clone();

    //       // (Optional: marker animation) - keep the animation as is
    //       const originMarkerGeometry = new THREE.SphereGeometry(0.03, 16, 16);
    //       const originMarkerMaterial = new THREE.MeshBasicMaterial({
    //         color: 0xffff00,
    //         transparent: true,
    //         opacity: 0.8,
    //       });
    //       const originMarker = new THREE.Mesh(
    //         originMarkerGeometry,
    //         originMarkerMaterial,
    //       );
    //       originMarker.position.copy(hitPoint);
    //       sceneRef.current?.add(originMarker);

    //       // Animated ring
    //       const ringGeometry = new THREE.RingGeometry(0.05, 0.06, 32);
    //       const ringMaterial = new THREE.MeshBasicMaterial({
    //         color: 0xffff00,
    //         side: THREE.DoubleSide,
    //         transparent: true,
    //       });
    //       const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    //       ring.rotation.x = Math.PI / 2;
    //       ring.position.copy(hitPoint);
    //       sceneRef.current?.add(ring);

    //       new TWEEN.Tween(ring.scale)
    //         .to({ x: 2, y: 2, z: 2 }, 1000)
    //         .easing(TWEEN.Easing.Quadratic.Out)
    //         .start();

    //       new TWEEN.Tween(ringMaterial)
    //         .to({ opacity: 0 }, 1000)
    //         .onComplete(() => sceneRef.current?.remove(ring))
    //         .start();

    //       console.log("Origin point set successfully!");
    //     }
    //     return;
    //   }

    //   if (qrPlacementModeRef.current && onQRPlaced) {
    //     // The user just clicked in the 3D view while in QR placement mode
    //     const hitPoint = allIntersects[0].point.clone();
    //     console.log(
    //       "[handleClick] Placing QR code at:",
    //       allIntersects[0].point,
    //     );
    //     onQRPlaced(hitPoint);
    //     return;
    //   } else if (placementModeRef.current?.type === "link" && onLinkPlaced) {
    //     // The user is placing a link
    //     const hitPoint = allIntersects[0].point.clone();
    //     console.log("[handleClick] Placing link at:", hitPoint);

    //     // Create immediate visual feedback
    //     const markerGeometry = new THREE.SphereGeometry(0.02, 16, 16);
    //     const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x0066ff }); // Blue color for links
    //     const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
    //     markerMesh.position.copy(hitPoint);
    //     markerMesh.renderOrder = 1000;
    //     sceneRef.current?.add(markerMesh);

    //     // Callback to parent component - this is the critical part!
    //     onLinkPlaced(hitPoint);

    //     // Add animation feedback
    //     new TWEEN.Tween(markerMesh.scale)
    //       .to({ x: 1.5, y: 1.5, z: 1.5 }, 300)
    //       .easing(TWEEN.Easing.Elastic.Out)
    //       .yoyo(true)
    //       .repeat(1)
    //       .start();

    //     // Try to immediately load and show a preview of the webpage
    //     const url = placementModeRef.current.data;
    //     if (url && typeof url === "string") {
    //       // Add visual loading indicator
    //       const loadingGeo = new THREE.SphereGeometry(0.05, 16, 16);
    //       const loadingMat = new THREE.MeshBasicMaterial({
    //         color: 0x3b82f6,
    //         transparent: true,
    //         opacity: 0.7,
    //       });
    //       const loadingIndicator = new THREE.Mesh(loadingGeo, loadingMat);
    //       loadingIndicator.position.copy(
    //         hitPoint.clone().add(new THREE.Vector3(0, 0.1, 0)),
    //       );
    //       sceneRef.current?.add(loadingIndicator);

    //       // Animate the loading indicator
    //       const animate = () => {
    //         if (!loadingIndicator.parent) return;
    //         loadingIndicator.rotation.y += 0.05;
    //         requestAnimationFrame(animate);
    //       };
    //       animate();

    //       // Try to load the webpage
    //       loadAndAddWebpage(url, hitPoint)
    //         .then((webObj) => {
    //           if (webObj && loadingIndicator.parent) {
    //             sceneRef.current?.remove(loadingIndicator);
    //           }
    //         })
    //         .catch((err) => {
    //           console.error("Error loading webpage:", err);
    //           if (loadingIndicator.parent) {
    //             sceneRef.current?.remove(loadingIndicator);
    //           }
    //         });
    //     }

    //     return;
    //   } else if (
    //     placementModeRef.current?.type === "file" &&
    //     placementModeRef.current.data
    //   ) {
    //     // The user is placing a file
    //     const hitPoint = allIntersects[0].point.clone();
    //     const fileData = placementModeRef.current.data;

    //     console.log(
    //       "[handleClick] Placing file at:",
    //       hitPoint,
    //       "File data:",
    //       fileData,
    //     );

    //     // Set marker color based on file type
    //     let markerColor;
    //     switch (fileData.fileType) {
    //       case "image":
    //         markerColor = 0x9c27b0; // Purple for images
    //         break;
    //       case "video":
    //         markerColor = 0xff5722; // Orange for videos
    //         break;
    //       case "document":
    //       default:
    //         markerColor = 0x2196f3; // Blue for documents/other
    //         break;
    //     }

    //     // Create immediate visual feedback
    //     const markerGeometry = new THREE.SphereGeometry(0.02, 16, 16);
    //     const markerMaterial = new THREE.MeshBasicMaterial({
    //       color: markerColor,
    //     });
    //     const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
    //     markerMesh.position.copy(hitPoint);
    //     markerMesh.renderOrder = 1000;
    //     sceneRef.current?.add(markerMesh);

    //     // Add a label above the marker
    //     const labelDiv = document.createElement("div");
    //     labelDiv.textContent = fileData.name || "File";
    //     labelDiv.style.padding = "2px 4px";
    //     labelDiv.style.fontSize = "12px";
    //     labelDiv.style.color = "#000";
    //     labelDiv.style.backgroundColor = "rgba(255,255,255,0.8)";
    //     labelDiv.style.borderRadius = "4px";
    //     labelDiv.style.whiteSpace = "nowrap";

    //     const labelObject = new CSS3DObject(labelDiv);
    //     labelObject.scale.set(0.005, 0.005, 0.005);
    //     labelObject.position.copy(
    //       hitPoint.clone().add(new THREE.Vector3(0, 0.05, 0)),
    //     );
    //     sceneRef.current?.add(labelObject);

    //     // Add a small animation/feedback
    //     new TWEEN.Tween(markerMesh.scale)
    //       .to({ x: 1.5, y: 1.5, z: 1.5 }, 300)
    //       .easing(TWEEN.Easing.Elastic.Out)
    //       .yoyo(true)
    //       .repeat(1)
    //       .start();

    //     // For file placement, we call onPlacementComplete from the parent
    //     if (onPlacementComplete) {
    //       // Call with a fake placement mode
    //       placementModeRef.current = {
    //         type: "file",
    //         data: fileData,
    //       };

    //       // Call the placement complete callback
    //       onPlacementComplete(hitPoint, null);

    //       // Reset the placement mode
    //       placementModeRef.current = null;
    //     }

    //     return;
    //   } else if (showTextBoxInputRef?.current && pendingLabelTextRef?.current) {
    //     console.log("[ThreeViewer] handleClick -- Text placement initiated!");
    //     // 1) The user wants to place a text label
    //     const hitPoint = allIntersects[0].point.clone();
    //     const textToPlace = pendingLabelTextRef.current; // Get text before clearing refs

    //     // 2) Turn off text placement mode immediately
    //     showTextBoxInputRef.current = false;
    //     pendingLabelTextRef.current = ""; // Clear the pending text

    //     // 3) Calculate real-world coordinates relative to origin
    //     if (originPoint) {
    //       const offset = hitPoint.clone().sub(originPoint);
    //       const scaledOffset = {
    //         x: offset.x * 45.64,
    //         y: offset.y * 45.64,
    //         z: offset.z * 45.64,
    //       };

    //       // 4) Call the callback to notify BlueprintEditor
    //       if (onTextBoxSubmit) {
    //         console.log(
    //           "[ThreeViewer] Calling onTextBoxSubmit with:",
    //           textToPlace,
    //           scaledOffset,
    //         );
    //         onTextBoxSubmit(textToPlace, scaledOffset);
    //       } else {
    //         console.error("[ThreeViewer] onTextBoxSubmit callback is missing!");
    //       }
    //     } else {
    //       console.error(
    //         "[ThreeViewer] Cannot place text anchor: Origin point not set.",
    //       );
    //       // Optionally show a toast or error message to the user
    //       // e.g., onError?.("Please set the origin point before placing text.");
    //     }

    //     return; // Exit handleClick after handling text placement
    //   } else {
    //     console.log("HANDLE CLICK - DID NOT MEET CRITERIA");
    //     console.log("qrPlacementMode is now:", qrPlacementMode);
    //     console.log("onQRPlaced is now:", onQRPlaced);
    //   }

    //   // IMPORTANT: Check for alignment mode (awaiting 3D picks)
    //   if (
    //     awaiting3DRef.current &&
    //     activeLabelRef.current &&
    //     setReferencePoints3D
    //   ) {
    //     const hitPoint = allIntersects[0].point;
    //     const sphereGeom = new THREE.SphereGeometry(0.02, 16, 16);
    //     const sphereMat = new THREE.MeshBasicMaterial({
    //       color: labelColors[activeLabelRef.current],
    //     });
    //     const newSphere = new THREE.Mesh(sphereGeom, sphereMat);
    //     newSphere.position.copy(hitPoint);
    //     sceneRef.current?.add(newSphere);
    //     newSphere.userData.label = activeLabelRef.current;

    //     transformControlsRef.current?.attach(newSphere);
    //     transformControlsRef.current?.setMode("translate");
    //     orbitControlsRef.current!.enabled = false;

    //     setReferencePoints3D((oldPoints) => [
    //       ...oldPoints,
    //       {
    //         label: activeLabelRef.current!,
    //         x3D: hitPoint.x,
    //         y3D: hitPoint.y,
    //         z3D: hitPoint.z,
    //       },
    //     ]);

    //     if (activeLabelRef.current === "A") {
    //       setActiveLabel?.("B");
    //     } else if (activeLabelRef.current === "B") {
    //       setActiveLabel?.("C");
    //     } else if (activeLabelRef.current === "C") {
    //       setActiveLabel?.(null);
    //     }

    //     setAwaiting3D?.(false);
    //     return;
    //   }

    //   // NOW we can check if originPoint exists for other operations that need it
    //   if (!originPoint) {
    //     console.log("Origin point is not set. Cannot calculate coordinates.");
    //     return; // Exit early if originPoint is not set
    //   }

    //   if (allIntersects.length > 0) {
    //     let clickedObj = allIntersects[0].object;
    //     let isModelClicked = false;
    //     let modelAnchorId = null;

    //     // Check if clicked on a 3D model from anchor models
    //     // We need to traverse up the parent chain to find the actual model
    //     let currentObj = clickedObj;
    //     let modelTransform = null;

    //     // First, try to find if it's a model by traversing up
    //     while (currentObj.parent && !isModelClicked) {
    //       // If the current object is in our anchorModelsRef
    //       for (const [id, model] of anchorModelsRef.current.entries()) {
    //         if (model === currentObj || currentObj.isDescendantOf?.(model)) {
    //           isModelClicked = true;
    //           modelAnchorId = id;
    //           modelTransform = model;
    //           // Stop the traversal since we found a match
    //           break;
    //         }
    //       }
    //       // If we didn't find a match yet, continue up the hierarchy
    //       if (!isModelClicked) {
    //         currentObj = currentObj.parent;
    //       }
    //     }

    //     // If we clicked on a model from our model anchors
    //     if (isModelClicked && modelTransform) {
    //       console.log(`Model clicked: ${modelAnchorId}`);

    //       // Use our new selection handler
    //       handleModelSelect(modelTransform, modelAnchorId);
    //       return;
    //     }

    //     // CHECK FOR TEXT ANCHORS, FILE ANCHORS, AND WEBPAGE ANCHORS
    //     let isAnchorClicked = false;
    //     let clickedAnchorId = null;
    //     let clickedAnchorObject = null;

    //     // Check text anchors
    //     // First check if we clicked directly on a text label (CSS3DObject with userData.isTextLabel)
    //     if (clickedObj.userData && clickedObj.userData.isTextLabel) {
    //       isAnchorClicked = true;
    //       clickedAnchorId = clickedObj.userData.anchorId;
    //       clickedAnchorObject = clickedObj;
    //       console.log(`Text label clicked directly: ${clickedAnchorId}`);
    //     }
    //     // Then check the composite objects in textAnchorsRef
    //     else {
    //       for (const [id, composite] of textAnchorsRef.current.entries()) {
    //         // Check if we clicked either the marker or the label
    //         if (
    //           clickedObj === composite.marker ||
    //           clickedObj === composite.label ||
    //           clickedObj.isDescendantOf?.(composite.marker) ||
    //           clickedObj.isDescendantOf?.(composite.label)
    //         ) {
    //           isAnchorClicked = true;
    //           clickedAnchorId = id;
    //           // Use the label for selection instead of the marker
    //           clickedAnchorObject = composite.label;
    //           console.log(`Text anchor component clicked: ${id}`);
    //           break;
    //         }
    //       }
    //     }

    //     // Check file anchors if no text anchor was clicked
    //     if (!isAnchorClicked) {
    //       for (const [id, object] of fileAnchorsRef.current.entries()) {
    //         if (clickedObj === object || clickedObj.isDescendantOf?.(object)) {
    //           isAnchorClicked = true;
    //           clickedAnchorId = id;
    //           clickedAnchorObject = object;
    //           console.log(`File anchor clicked: ${id}`);
    //           break;
    //         }
    //       }
    //     }

    //     // Check webpage anchors if still no match
    //     if (!isAnchorClicked) {
    //       for (const [id, object] of anchorWebpagesRef.current.entries()) {
    //         if (clickedObj === object || clickedObj.isDescendantOf?.(object)) {
    //           isAnchorClicked = true;
    //           clickedAnchorId = id;
    //           clickedAnchorObject = object;
    //           console.log(`Webpage anchor clicked: ${id}`);
    //           break;
    //         }
    //       }
    //     }

    //     // Handle the clicked anchor if found
    //     if (isAnchorClicked && clickedAnchorObject) {
    //       // Save the current selected ID
    //       setSelectedModelId(clickedAnchorId);

    //       // Store original transform for cancel/undo operations
    //       setLastTransform({
    //         position: clickedAnchorObject.position.clone(),
    //         rotation: clickedAnchorObject.rotation.clone(),
    //         scale: clickedAnchorObject.scale.clone(),
    //       });

    //       // Attach transform controls
    //       if (transformControlsRef.current) {
    //         transformControlsRef.current.attach(clickedAnchorObject);
    //         transformControlsRef.current.setMode("translate"); // Default to move mode
    //         setTransformMode("translate");

    //         // Show transform UI indicator
    //         setShowTransformUI(true);

    //         // Highlight the selected object
    //         addModelHighlight(clickedAnchorObject, sceneRef.current);

    //         // Animation for visual feedback
    //         new TWEEN.Tween(clickedAnchorObject.scale)
    //           .to(
    //             {
    //               x: clickedAnchorObject.scale.x * 1.05,
    //               y: clickedAnchorObject.scale.y * 1.05,
    //               z: clickedAnchorObject.scale.z * 1.05,
    //             },
    //             150,
    //           )
    //           .yoyo(true)
    //           .repeat(1)
    //           .easing(TWEEN.Easing.Cubic.Out)
    //           .start();
    //       }

    //       if (
    //         clickedAnchorObject.userData &&
    //         clickedAnchorObject.userData.isTextLabel
    //       ) {
    //         // Add a subtle highlight effect to the label
    //         const labelElement = clickedAnchorObject.element;
    //         if (labelElement) {
    //           // Backup original background color
    //           const originalBgColor = labelElement.style.backgroundColor;
    //           labelElement.style.backgroundColor = "rgba(100, 149, 237, 0.9)"; // Cornflower blue with more opacity

    //           // Add a subtle animation
    //           labelElement.style.transition = "all 0.2s ease-in-out";

    //           // Restore original color on deselection
    //           const restoreOriginalColor = () => {
    //             if (
    //               transformControlsRef.current &&
    //               transformControlsRef.current.object !== clickedAnchorObject
    //             ) {
    //               labelElement.style.backgroundColor = originalBgColor;
    //             }
    //           };

    //           // Set up a handler for deselection
    //           setTimeout(restoreOriginalColor, 100);
    //         }
    //       }
    //       return;
    //     }

    //     // Check if it's a reference point with a label
    //     while (
    //       clickedObj.parent &&
    //       !clickedObj.userData.label &&
    //       !isModelClicked &&
    //       clickedObj.name !== "Antique_Iron_Safe"
    //     ) {
    //       clickedObj = clickedObj.parent;
    //     }

    //     // If we clicked on a model from our model anchors
    //     if (isModelClicked && modelTransform) {
    //       console.log(`Model clicked: ${modelAnchorId}`);

    //       // Save the current selected model ID for updates
    //       setSelectedModelId(modelAnchorId);

    //       // Show transform controls and attach to the model
    //       if (transformControlsRef.current) {
    //         // Get current mode or default to translate
    //         const currentMode =
    //           transformControlsRef.current.mode || "translate";

    //         // Attach to model
    //         transformControlsRef.current.attach(modelTransform);

    //         // Configure appearance and feedback
    //         transformControlsRef.current.setMode(currentMode);
    //         transformControlsRef.current.visible = true;

    //         // Add visual feedback
    //         addModelHighlight(modelTransform, sceneRef.current);

    //         // Temporarily disable orbit controls while transforming
    //         if (orbitControlsRef.current) {
    //           // We'll keep orbit controls enabled but they'll be disabled during dragging
    //           orbitControlsRef.current.enabled = true;
    //         }

    //         // Show transformation UI
    //         setShowTransformUI(true);
    //         setTransformMode(currentMode as "translate" | "rotate" | "scale");

    //         // Play a subtle animation to show selection
    //         const originalScale = modelTransform.scale.clone();
    //         new TWEEN.Tween(modelTransform.scale)
    //           .to(
    //             {
    //               x: originalScale.x * 1.05,
    //               y: originalScale.y * 1.05,
    //               z: originalScale.z * 1.05,
    //             },
    //             150,
    //           )
    //           .easing(TWEEN.Easing.Cubic.Out)
    //           .yoyo(true)
    //           .repeat(1)
    //           .start();
    //       }
    //       return;
    //     } else if (clickedObj.userData.label) {
    //       // This is the existing logic for labeled points
    //       orbitControlsRef.current!.enabled = false;
    //       transformControlsRef.current?.attach(clickedObj);
    //       transformControlsRef.current?.setMode("translate");
    //       isMarkerSelectedRef.current = true;
    //       return;
    //     } else {
    //       // #5: Calculate and display coordinates relative to originPoint prop
    //       if (originPoint) {
    //         const hitPoint = allIntersects[0].point.clone();
    //         // Create a new vector to avoid modifying the original point in the calculation
    //         const offset = hitPoint.clone().sub(originPoint);
    //         const distanceInFeet = offset.length() * 45.64;
    //         const msg = `X:${(offset.x * 45.64).toFixed(2)}, Y:${(offset.y * 45.64).toFixed(2)}, Z:${(offset.z * 45.64).toFixed(2)}
    //         distance = ${distanceInFeet.toFixed(2)} ft from origin`;

    //         console.log("Coordinate display:", msg);
    //         setDistanceDisplay(msg);
    //       }

    //       // Hide transform UI if we clicked elsewhere
    //       setShowTransformUI(false);
    //     }

    //     // If we didn't click on anything special, detach the transform controls
    //     transformControlsRef.current?.detach();
    //     if (orbitControlsRef.current) {
    //       orbitControlsRef.current.enabled = true;
    //     }
    //   }
    // }

    async function handleClick(event: MouseEvent) {
      console.log("[ThreeViewer] handleClick fired!");
      if (
        !mountRef.current ||
        !sceneRef.current ||
        !cameraRef.current ||
        !transformControlsRef.current // Add check for transform controls
      ) {
        console.warn("[handleClick] Missing refs, aborting.");
        return;
      }

      // Prevent click handling if dragging transform controls
      if (transformControlsRef.current.dragging) {
        console.log(
          "[handleClick] Ignoring click while dragging transform controls.",
        );
        return;
      }

      // 1) Convert click to normalized coords
      const rect = mountRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      const mouse = new THREE.Vector2(x, y);

      // 2) Perform the raycast
      raycasterRef.current.setFromCamera(mouse, cameraRef.current);
      const allIntersects = raycasterRef.current.intersectObjects(
        sceneRef.current.children,
        true, // Check descendants
      );

      // Filter out non-visible objects and helpers like the highlight itself
      const visibleIntersects = allIntersects.filter(
        (intersect) =>
          intersect.object.visible &&
          intersect.object.name !== "selection-highlight" &&
          !intersect.object.name.includes("Helper") &&
          // IMPORTANT: Also filter out the origin marker itself if it exists
          (!originMarkerRef.current ||
            intersect.object !== originMarkerRef.current),
      );

      // ***** START CONFIRMATION LOGGING *****
      console.log(
        `[handleClick] Visible Intersects Count: ${visibleIntersects.length}`,
      );
      if (visibleIntersects.length > 0) {
        const firstHit = visibleIntersects[0].object;
        console.log(`[handleClick] First Hit Object Name: ${firstHit.name}`);
        console.log(`[handleClick] First Hit Object Type: ${firstHit.type}`);
        // Log userData directly without stringifying to avoid circular reference errors
        console.log(
          `[handleClick] First Hit Object userData:`,
          firstHit.userData, // <--- FIXED LINE
        );
        console.log(
          `[handleClick] First Hit Distance: ${visibleIntersects[0].distance}`,
        );
        // Check if it's a CSS3DObject specifically
        if (firstHit instanceof CSS3DObject) {
          console.log("[handleClick] First Hit IS a CSS3DObject.");
        } else {
          console.log("[handleClick] First Hit is NOT a CSS3DObject.");
        }
      }
      // ***** END CONFIRMATION LOGGING *****

      // --- Early Exit for Special Modes ---
      // (Keep your existing logic for origin, QR, link, file, text, alignment placement modes here)
      // ... (Your existing code for placement modes) ...
      if (isChoosingOriginRef.current) {
        console.log("[handleClick] Origin selection mode.");
        if (visibleIntersects.length > 0) {
          const hitPoint = visibleIntersects[0].point;
          if (onOriginSet && setIsChoosingOrigin) {
            onOriginSet(hitPoint.clone());
            setIsChoosingOrigin(false);
            originRef.current = hitPoint.clone(); // Also update local ref if needed
            console.log("Origin point set at:", hitPoint);
            updateOriginMarker(sceneRef.current, hitPoint.clone()); // Use your marker function
          }
        } else {
          console.log("[handleClick] Origin selection click missed model.");
        }
        return; // Handled origin setting
      }

      if (qrPlacementModeRef.current && onQRPlaced) {
        console.log("[handleClick] QR placement mode.");
        if (visibleIntersects.length > 0) {
          const hitPoint = visibleIntersects[0].point.clone();
          console.log("[handleClick] Placing QR code at:", hitPoint);
          onQRPlaced(hitPoint); // Callback to parent
        } else {
          console.log("[handleClick] QR placement click missed model.");
        }
        return; // Handled QR placement
      }

      if (placementModeRef.current?.type === "link" && onLinkPlaced) {
        console.log("[handleClick] Link placement mode.");
        if (visibleIntersects.length > 0) {
          const hitPoint = visibleIntersects[0].point.clone();
          const url = placementModeRef.current.data;
          console.log("[handleClick] Placing link at:", hitPoint, "URL:", url);
          onLinkPlaced(hitPoint); // Callback to parent
          if (url && typeof url === "string") {
            loadAndAddWebpage(url, hitPoint); // Attempt to show preview
          }
        } else {
          console.log("[handleClick] Link placement click missed model.");
        }
        return; // Handled link placement
      }

      if (placementModeRef.current?.type === "file" && onPlacementComplete) {
        console.log("[handleClick] File placement mode.");
        if (visibleIntersects.length > 0) {
          const hitPoint = visibleIntersects[0].point.clone();
          const fileData = placementModeRef.current.data;
          console.log(
            "[handleClick] Placing file at:",
            hitPoint,
            "Data:",
            fileData,
          );
          onPlacementComplete(hitPoint, null); // Use the generic placement callback
        } else {
          console.log("[handleClick] File placement click missed model.");
        }
        return; // Handled file placement
      }

      if (showTextBoxInputRef?.current && pendingLabelTextRef?.current) {
        console.log("[handleClick] Text placement mode.");
        if (visibleIntersects.length > 0) {
          const hitPoint = visibleIntersects[0].point.clone();
          const textToPlace = pendingLabelTextRef.current;

          showTextBoxInputRef.current = false;
          pendingLabelTextRef.current = "";

          if (originPoint) {
            const realWorldCoords = convertToRealWorldCoords(hitPoint);
            if (onTextBoxSubmit) {
              console.log(
                "[handleClick] Calling onTextBoxSubmit:",
                textToPlace,
                realWorldCoords,
              );
              onTextBoxSubmit(textToPlace, realWorldCoords);
            } else {
              console.error("[handleClick] onTextBoxSubmit callback missing!");
            }
          } else {
            console.error("[handleClick] Cannot place text: Origin not set.");
            onError?.("Please set the origin point before placing text.");
          }
        } else {
          console.log("[handleClick] Text placement click missed model.");
        }
        return; // Handled text placement
      }

      if (
        awaiting3DRef.current &&
        activeLabelRef.current &&
        setReferencePoints3D
      ) {
        console.log("[handleClick] Alignment point placement mode.");
        if (visibleIntersects.length > 0) {
          const hitPoint = visibleIntersects[0].point;
          const sphereGeom = new THREE.SphereGeometry(0.02, 16, 16);
          const sphereMat = new THREE.MeshBasicMaterial({
            color: labelColors[activeLabelRef.current],
          });
          const newSphere = new THREE.Mesh(sphereGeom, sphereMat);
          newSphere.position.copy(hitPoint);
          sceneRef.current?.add(newSphere);
          newSphere.userData.label = activeLabelRef.current; // Important for identification

          transformControlsRef.current?.attach(newSphere);
          transformControlsRef.current?.setMode("translate");
          if (orbitControlsRef.current)
            orbitControlsRef.current.enabled = false; // Disable orbit while adjusting

          setReferencePoints3D((oldPoints) => [
            ...oldPoints,
            {
              label: activeLabelRef.current!,
              x3D: hitPoint.x,
              y3D: hitPoint.y,
              z3D: hitPoint.z,
            },
          ]);

          if (activeLabelRef.current === "A") setActiveLabel?.("B");
          else if (activeLabelRef.current === "B") setActiveLabel?.("C");
          else if (activeLabelRef.current === "C") setActiveLabel?.(null); // Done

          setAwaiting3D?.(false); // No longer awaiting this point
        } else {
          console.log("[handleClick] Alignment point click missed model.");
        }
        return; // Handled alignment point placement
      }

      // --- Anchor Selection Logic ---
      if (visibleIntersects.length > 0) {
        let clickedObj = visibleIntersects[0].object;
        let foundAnchor = false;
        let selectedAnchorObjectForHighlight: THREE.Object3D | null = null; // Store object for potential highlight

        // Traverse up the hierarchy to find the main anchor object
        let currentObj: THREE.Object3D | null = clickedObj;
        while (currentObj && !foundAnchor) {
          // Check Text Anchors FIRST
          if (
            currentObj instanceof CSS3DObject &&
            currentObj.userData.isTextLabel === true // Check our custom flag
          ) {
            const anchorId = currentObj.userData.anchorId;
            const currentText = currentObj.element.textContent || "";
            const helperMesh = currentObj.userData.helperMesh as THREE.Mesh; // Get the helper mesh

            console.log(
              `Text label clicked: ${anchorId}, Text: "${currentText}"`,
              helperMesh ? "Helper found." : "Helper NOT found!",
            );

            // Call the info panel callback FIRST
            if (onTextAnchorClick) {
              onTextAnchorClick(anchorId, currentText);
            } else {
              console.warn("onTextAnchorClick prop is missing in ThreeViewer");
            }

            // NOW, if helper mesh exists, call handleAnchorSelect to show gizmo
            if (helperMesh) {
              handleAnchorSelect(anchorId, helperMesh, "text"); // Select the HELPER mesh
              foundAnchor = true; // Mark as found *after* selection attempt
              selectedAnchorObjectForHighlight = helperMesh; // Highlight the helper mesh
            } else {
              console.warn(
                `Helper mesh not found for text anchor ${anchorId} during click.`,
              );
              // Still mark as found to prevent distance display, even if gizmo fails
              foundAnchor = true;
              selectedAnchorObjectForHighlight = currentObj; // Highlight the CSS object as fallback
            }
            // Break here since we've handled the text anchor click
            break;
          }

          // Check Models (only if text anchor wasn't found yet)
          if (!foundAnchor) {
            for (const [id, model] of anchorModelsRef.current.entries()) {
              // Make sure to check descendants as well for complex models
              if (currentObj === model || currentObj.isDescendantOf?.(model)) {
                handleAnchorSelect(id, model, "model");
                foundAnchor = true;
                selectedAnchorObjectForHighlight = model;
                break; // Exit inner loop
              }
            }
            if (foundAnchor) break; // Exit outer loop if model found
          }

          // Check File Anchors (only if not found yet)
          if (!foundAnchor) {
            for (const [id, fileObject] of fileAnchorsRef.current.entries()) {
              // Check the main object OR its helper mesh
              const helperMesh = fileObject.userData.helperMesh as THREE.Mesh;
              if (
                currentObj === fileObject ||
                (helperMesh && currentObj === helperMesh)
              ) {
                const objectToSelect = helperMesh || fileObject; // Prefer helper if it exists
                console.log(
                  `File anchor clicked: ${id}, selecting ${objectToSelect === helperMesh ? "helper" : "main object"}`,
                );
                handleAnchorSelect(id, objectToSelect, "file");
                foundAnchor = true;
                selectedAnchorObjectForHighlight = objectToSelect;
                // Also trigger the specific file click handler if needed
                if (onFileAnchorClick) {
                  const fileAnchorData = fileAnchors?.find((a) => a.id === id);
                  if (fileAnchorData) {
                    onFileAnchorClick(id, fileAnchorData);
                  }
                }
                break; // Exit inner loop
              }
            }
            if (foundAnchor) break; // Exit outer loop if file found
          }

          // Check Webpage Anchors (only if not found yet)
          if (!foundAnchor) {
            for (const [
              id,
              webpageObj, // This is the CSS3DObject (iframe container)
            ] of anchorWebpagesRef.current.entries()) {
              // Check if the clicked object IS the webpage object itself OR its helper
              const helperMesh = webpageObj.userData.helperMesh as THREE.Mesh;
              if (
                currentObj === webpageObj ||
                (helperMesh && currentObj === helperMesh)
              ) {
                const anchorId = webpageObj.userData.anchorId; // Get ID from CSS object

                if (helperMesh) {
                  console.log(
                    `Webpage anchor (CSS or helper) clicked: ${anchorId}, selecting helper mesh.`,
                  );
                  handleAnchorSelect(anchorId, helperMesh, "webpage"); // Select the HELPER
                  foundAnchor = true;
                  selectedAnchorObjectForHighlight = helperMesh; // Highlight the helper
                  // Also call the info panel callback if needed
                  if (onWebpageAnchorClick) {
                    const originalAnchorData = webpageAnchors?.find(
                      (a) => a.id === anchorId,
                    );
                    const anchorUrl = originalAnchorData?.webpageUrl || "";
                    onWebpageAnchorClick(anchorId, anchorUrl);
                  }
                } else {
                  console.warn(
                    `Helper mesh not found for webpage anchor ${anchorId}`,
                  );
                  // Fallback: maybe just call the info panel click?
                  const originalAnchorData = webpageAnchors?.find(
                    (a) => a.id === anchorId,
                  );
                  const anchorUrl = originalAnchorData?.webpageUrl || "";
                  if (onWebpageAnchorClick) {
                    onWebpageAnchorClick(anchorId, anchorUrl);
                    foundAnchor = true; // Mark as found to prevent distance display
                    selectedAnchorObjectForHighlight = webpageObj; // Highlight CSS obj as fallback
                  }
                }

                break; // Exit the loop once found
              }
            }
            if (foundAnchor) break; // Exit outer loop if webpage found
          }

          // Check Alignment Point Markers (only if not found yet)
          if (!foundAnchor) {
            if (
              currentObj instanceof THREE.Mesh &&
              currentObj.userData.label &&
              ["A", "B", "C"].includes(currentObj.userData.label)
            ) {
              console.log(
                `[handleClick] Clicked on alignment marker: ${currentObj.userData.label}`,
              );
              // Don't call handleAnchorSelect for alignment markers, just attach directly
              transformControlsRef.current?.attach(currentObj);
              transformControlsRef.current?.setMode("translate");
              if (orbitControlsRef.current)
                orbitControlsRef.current.enabled = false;
              highlightObject(currentObj, sceneRef.current); // Highlight the marker
              foundAnchor = true;
              selectedAnchorObjectForHighlight = currentObj; // Store for potential highlight update if needed
              // No break needed, already at end of checks for this level
            }
          }

          // If we found any anchor type at this level, stop traversing up
          if (foundAnchor) {
            break; // Exit the while loop
          }

          currentObj = currentObj.parent; // Move up the hierarchy
        } // End while loop

        // ***** START CONFIRMATION LOGGING *****
        console.log(
          `[handleClick] After Anchor Check Loop - foundAnchor: ${foundAnchor}`,
        );
        // ***** END CONFIRMATION LOGGING *****

        // If an anchor was found and selected/handled, apply highlight and return
        if (foundAnchor) {
          console.log("Anchor found, preventing distance display.");
          // Apply highlight to the object identified during the loop
          if (selectedAnchorObjectForHighlight) {
            highlightObject(selectedAnchorObjectForHighlight, sceneRef.current);
          } else {
            // Clear highlight if somehow no object was stored but anchor was found
            highlightObject(null, sceneRef.current);
          }
          return; // <-- IMPORTANT: Prevent fall-through to distance calculation
        }
      } // End if (visibleIntersects.length > 0)

      // --- Deselection or Background Click ---
      // This part only runs if NO anchor was found OR click missed everything
      console.log(
        "[handleClick] No anchor found or click missed. Deselecting.",
      );

      handleDeselect(); // Deselect any currently selected anchor

      // --- DISTANCE CALCULATION (The part you want to AVOID for anchors) ---
      // Only show distance if the click hit *something* (but not a selectable anchor)
      // and the origin point is set.
      if (visibleIntersects.length > 0 && originPoint) {
        const hitPoint = visibleIntersects[0].point.clone();
        const offset = hitPoint.clone().sub(originPoint);
        const distanceInFeet = offset.length() * 45.64; // Assuming 45.64 is your scale factor
        const msg = `X: ${(offset.x * 45.64).toFixed(2)}, Y: ${(offset.y * 45.64).toFixed(2)}, Z: ${(offset.z * 45.64).toFixed(2)}
          distance = ${distanceInFeet.toFixed(2)} ft from origin`;
        console.log("Coordinate display:", msg);
        setDistanceDisplay(msg); // Update the distance display state
      } else if (visibleIntersects.length > 0) {
        // Hit something, but origin not set
        setDistanceDisplay(
          "Origin not set. Cannot calculate relative coordinates.",
        );
      } else {
        // Clicked empty space
        setDistanceDisplay(""); // Clear distance display
      }
    } // End of handleClick

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
      raycasterRef.current.setFromCamera({ x, y }, camera);
      return raycasterRef.current.intersectObjects(scene.children, true);
    }

    mountRef.current.addEventListener("contextmenu", handleRightClick);
    mountRef.current.addEventListener("click", (e) => {
      // Prevent other handlers from capturing the click
      e.stopPropagation();
      handleClick(e);
    });
    // mountRef.current.addEventListener("drop", handleFileDrop);
    mountRef.current.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    function animate() {
      requestAnimationFrame(animate);

      // Minimal updates during animation
      TWEEN.update();

      // Always update orbit controls - they should remain responsive
      if (orbitControls) {
        orbitControls.update();
      }

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
      const isModelDrag = e.dataTransfer.types.includes("application/model");

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
          sceneRef.current.children.filter((obj) => obj.name !== "dragCircle"),
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
        e.dataTransfer.items,
      );

      const modelDataString = e.dataTransfer?.getData("application/model");
      const fileDataString = e.dataTransfer?.getData("application/file");
      // ADDED: log the raw fileDataString
      console.log("[ThreeViewer] handleDrop - fileDataString:", fileDataString);

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
        const intersects = raycasterRef.current.intersectObjects(
          sceneRef.current.children,
          true,
        );

        // Filter out intersections with the drag circle itself
        const validIntersects = intersects.filter(
          (intersect) => intersect.object !== dragCircleRef.current,
        );

        if (validIntersects.length === 0) {
          console.warn("Drop occurred, but no valid intersection point found.");
          // Optionally hide loading indicator if it was shown
          const existingLoadingIndicator =
            sceneRef.current.getObjectByName("loadingIndicator");
          if (existingLoadingIndicator)
            sceneRef.current.remove(existingLoadingIndicator);
          return;
        }

        const dropPoint = validIntersects[0].point.clone();

        // Create loading indicator exactly at drop point
        const loadingIndicator = createLoadingIndicator(dropPoint);
        // Add a name to easily find and remove it
        loadingIndicator.name = "loadingIndicator";
        sceneRef.current.add(loadingIndicator);

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

            // Load the model using GLTFLoader
            const loader = new GLTFLoader();

            try {
              // Use the URL from the model data
              const modelUrl =
                modelInfo.modelUrl ||
                "https://f005.backblazeb2.com/file/objectModels-dev/Mona_Lisa_PBR_hires_model.glb";

              loader.load(
                modelUrl,
                (gltf) => {
                  const model = gltf.scene;

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
                  sceneRef.current.add(model);

                  // Store reference to the model
                  anchorModelsRef.current.set(newAnchorId, model);

                  // Add user data to identify it later
                  model.userData.anchorId = newAnchorId;

                  if (loadingIndicator.parent)
                    sceneRef.current.remove(loadingIndicator);

                  // Calculate offset from origin if it exists
                  let scaledX = dropPoint.x * 45.64;
                  let scaledY = dropPoint.y * 45.64;
                  let scaledZ = dropPoint.z * 45.64;

                  if (originPoint) {
                    const offset = dropPoint.clone().sub(originPoint);
                    scaledX = offset.x * 45.64;
                    scaledY = offset.y * 45.64;
                    scaledZ = offset.z * 45.64;
                  }

                  // Create anchor in Firestore
                  if (blueprintId) {
                    // Ensure currentUser is available before accessing uid
                    const userId = currentUser?.uid || "anonymous"; // Use optional chaining and provide a fallback

                    setDoc(doc(db, "anchors", newAnchorId), {
                      id: newAnchorId,
                      createdDate: new Date(),
                      contentID: `model-${Date.now()}`,
                      contentType: "model",
                      modelName: modelInfo.name || "3D Model",
                      host: userId, // Use the safe userId
                      blueprintID: blueprintId,
                      x: scaledX,
                      y: scaledY,
                      z: scaledZ,
                      scaleX: model.scale.x,
                      scaleY: model.scale.y,
                      scaleZ: model.scale.z,
                      rotationX: model.rotation.x,
                      rotationY: model.rotation.y,
                      rotationZ: model.rotation.z,
                      isPrivate: false,
                    })
                      .then(() => {
                        console.log(
                          "Saved model anchor to Firestore:",
                          newAnchorId,
                        );

                        // CRITICAL FIX: Update blueprint document in a separate operation
                        updateDoc(doc(db, "blueprints", blueprintId), {
                          anchorIDs: arrayUnion(newAnchorId),
                        })
                          .then(() => {
                            console.log(
                              "Updated blueprint with new anchor ID:",
                              newAnchorId,
                            );
                          })
                          .catch((err) => {
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
                },
                (xhr) => {
                  console.log(
                    `Model: ${(xhr.loaded / xhr.total) * 100}% loaded`,
                  );
                },
                (error) => {
                  console.error("Error loading model:", error);
                  sceneRef.current.remove(loadingIndicator);
                  showErrorIndicator(dropPoint);
                },
              );
            } catch (error) {
              console.error("Error processing model:", error);
              sceneRef.current.remove(loadingIndicator);
              showErrorIndicator(dropPoint);
            }
          } catch (error) {
            console.error("Error parsing model data:", error);
            sceneRef.current.remove(loadingIndicator);
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
              const offset = dropPoint.clone().sub(originPoint);
              const scaledOffset = {
                x: offset.x * 45.64,
                y: offset.y * 45.64,
                z: offset.z * 45.64,
              };

              // Call the callback to notify BlueprintEditor
              if (onFileDropped) {
                console.log(
                  "[ThreeViewer] Calling onFileDropped with:",
                  fileInfo,
                  scaledOffset,
                );
                onFileDropped(fileInfo, scaledOffset); // Pass fileInfo and calculated coords
              } else {
                console.error(
                  "[ThreeViewer] onFileDropped callback is missing!",
                );
              }

              // Remove loading indicator (it will be re-added by state update if needed)
              sceneRef.current?.remove(loadingIndicator);
              // Show temporary success feedback (optional)
              showSuccessIndicator(dropPoint, fileInfo.name || "File");
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

    function showErrorIndicator(position) {
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
      const data = e.dataTransfer.getData("application/json");
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
      if (mountRef.current) {
        mountRef.current.removeEventListener("contextmenu", handleRightClick);
        mountRef.current.removeEventListener("click", handleClick);
        mountRef.current.removeEventListener("dragover", (e) => {
          e.preventDefault();
        });
        mountRef.current.removeEventListener("drop", handleFileDrop);
        mountRef.current.removeChild(renderer.domElement);
        if (
          cssRenderer &&
          cssRenderer.domElement &&
          mountRef.current.contains(cssRenderer.domElement)
        ) {
          mountRef.current.removeChild(cssRenderer.domElement);
        }
      }
      transformControls.dispose();
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
  // UPDATED: useEffect for saving transform changes for ANY selected anchor
  useEffect(() => {
    if (!transformControlsRef.current) return;

    const handleTransformChange = () => {
      // Use the new unified state variables
      if (
        !selectedAnchorId ||
        !selectedAnchorType || // Need type to know it's a data anchor
        !transformControlsRef.current?.object
      ) {
        // Also check if the currently attached object is an alignment marker (A, B, C)
        // If so, we don't want to save it via updateAnchorTransform
        const attachedObj = transformControlsRef.current?.object;
        if (
          attachedObj &&
          attachedObj.userData.label &&
          ["A", "B", "C"].includes(attachedObj.userData.label)
        ) {
          console.log(
            "Transform changed for alignment marker, not saving to DB.",
          );
          // Update the reference points state directly if needed
          if (setReferencePoints3D) {
            setReferencePoints3D((prevPoints) =>
              prevPoints.map((p) => {
                if (p.label === attachedObj.userData.label) {
                  return {
                    ...p,
                    x3D: attachedObj.position.x,
                    y3D: attachedObj.position.y,
                    z3D: attachedObj.position.z,
                  };
                }
                return p;
              }),
            );
          }
          return; // Don't proceed to save anchor data
        }
        // If no anchor selected, or it's not a data anchor, do nothing
        return;
      }

      const transformedObject = transformControlsRef.current.object;
      const isHelper = transformedObject.userData?.type?.includes("helper");

      // Get the current world position/rotation/scale from the transformed object
      const currentPosition = transformedObject.position.clone();
      const currentRotation = transformedObject.rotation.clone();
      const currentScale = transformedObject.scale.clone();

      // Store the last transform state locally (useful for immediate feedback or potential undo)
      setLastTransform({
        position: currentPosition,
        rotation: currentRotation,
        scale: currentScale,
      });

      // ***** START CHANGE: Link helper transform to CSS3DObject *****
      // If the transformed object is a helper, update its corresponding CSS object
      if (isHelper && transformedObject.userData?.cssObject) {
        // General case (e.g., webpage)
        const cssObject = transformedObject.userData.cssObject as CSS3DObject;
        cssObject.position.copy(currentPosition);
        cssObject.rotation.copy(currentRotation);
        // cssObject.scale.copy(currentScale); // Apply scale cautiously
      } else if (isHelper && transformedObject.userData?.labelObject) {
        // Specific case for text labels
        const labelObject = transformedObject.userData
          .labelObject as CSS3DObject;
        labelObject.position.copy(currentPosition);
        labelObject.rotation.copy(currentRotation);
        // labelObject.scale.copy(currentScale); // Apply scale cautiously
      }
      // ***** END CHANGE *****

      // Debounce the Firebase update to avoid excessive writes during drag
      if (transformUpdateTimeout.current) {
        clearTimeout(transformUpdateTimeout.current);
      }

      transformUpdateTimeout.current = setTimeout(() => {
        if (!selectedAnchorId) return; // Check again inside timeout

        // Convert the TRANSFORMED object's world position to real-world coordinates relative to origin
        // This works whether it's the model itself or a helper mesh
        const realWorldPos = convertToRealWorldCoords(currentPosition);

        console.log(
          `Debounced Save for ${selectedAnchorType} anchor ${selectedAnchorId}:`,
          { realWorldPos, currentRotation, currentScale },
        );

        // Call the existing function to update Firebase
        // This function needs to handle updating the correct fields (x, y, z, rotation, scale)
        // Note: You might not want to save scale for text/webpage anchors unless you explicitly handle it
        updateAnchorTransform(selectedAnchorId, {
          x: realWorldPos.x,
          y: realWorldPos.y,
          z: realWorldPos.z,
          rotationX: currentRotation.x,
          rotationY: currentRotation.y,
          rotationZ: currentRotation.z,
          // Only include scale if you intend to save/restore it for this anchor type
          // Avoid saving scale for helper-controlled anchors unless intended
          scaleX: isHelper ? (lastTransform.scale?.x ?? 1) : currentScale.x, // Use previous scale for helpers or 1 if null
          scaleY: isHelper ? (lastTransform.scale?.y ?? 1) : currentScale.y,
          scaleZ: isHelper ? (lastTransform.scale?.z ?? 1) : currentScale.z,
        });
      }, 500); // Wait 500ms after the last transform change before saving
    };

    // Add listener when component mounts or controls/selection changes
    transformControlsRef.current.addEventListener(
      "objectChange",
      handleTransformChange,
    );

    // Cleanup listener when component unmounts or dependencies change
    return () => {
      transformControlsRef.current?.removeEventListener(
        "objectChange",
        handleTransformChange,
      );
      // Clear any pending timeout on cleanup
      if (transformUpdateTimeout.current) {
        clearTimeout(transformUpdateTimeout.current);
      }
    };
    // Dependencies: Listen for changes in selected anchor, controls, and origin (for coord conversion)
  }, [
    selectedAnchorId,
    selectedAnchorType,
    transformControlsRef.current,
    originPoint,
    convertToRealWorldCoords,
    updateAnchorTransform,
    setReferencePoints3D, // Added dependency
    lastTransform, // Added dependency for scale fallback
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
      sceneRef.current.add(originMarker);

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
        console.log("Added Antique Safe to scene at position:", selectedPoint);

        // 1) Generate a unique anchor ID
        const newAnchorId = `anchor-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)}`;

        // Compute the offset relative to origin and then scale by 45.64.
        // If no origin is set, default to using selectedPoint directly.
        let scaledX = selectedPoint.x * 45.64;
        let scaledY = selectedPoint.y * 45.64;
        let scaledZ = selectedPoint.z * 45.64;
        if (originPoint) {
          const offset = selectedPoint.clone().sub(originPoint);
          scaledX = offset.x * 45.64;
          scaledY = offset.y * 45.64;
          scaledZ = offset.z * 45.64;
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
        await updateDoc(doc(db, "blueprints", blueprintId), {
          anchorIDs: arrayUnion(newAnchorId),
        });

        // done!
      }
    }

    setShowSidePanel(false);
    setPromptInput("");
  };

  return (
    <>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

      {showTextBoxInputRef && selectedPoint && (
        <div
          style={{
            position: "absolute",
            left: `${projectToScreen(selectedPoint).x}px`,
            top: `${projectToScreen(selectedPoint).y}px`,
            zIndex: 1000,
            background: "white",
            border: "1px solid #ccc",
            padding: "4px",
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
            autoFocus
          />
        </div>
      )}

      {originConfirmation && (
        <motion.div
          className="absolute top-16 left-1/2 -translate-x-1/2 bg-yellow-100 border border-yellow-300 text-yellow-900 px-4 py-2 rounded shadow"
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
            className="fixed top-16 right-0 w-96 h-[calc(100vh-4rem)] bg-white shadow-lg p-6 overflow-y-auto"
          >
            <Card className="border-0 shadow-none">
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
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  {options.map((option, index) => (
                    <button
                      key={index}
                      className="p-4 border rounded-lg hover:bg-gray-50 transition-colors flex flex-col items-center justify-center gap-2 text-center"
                    >
                      {option.icon}
                      <span className="text-sm">{option.label}</span>
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
          className="fixed top-4 right-4 bg-green-100 border border-green-500 text-green-800 px-4 py-2 rounded shadow-lg z-50"
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
          className="fixed top-4 right-4 bg-red-100 border border-red-500 text-red-800 px-4 py-2 rounded shadow-lg z-50"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{transformError}</span>
          </div>
        </motion.div>
      )}

      {distanceDisplay && (
        <motion.div
          className="absolute top-20 right-4 bg-blue-100 border border-blue-300 text-blue-900 px-4 py-2 rounded shadow-lg"
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
};

export default React.memo(ThreeViewer);
