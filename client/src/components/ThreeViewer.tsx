import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { CSS3DRenderer } from "three/examples/jsm/renderers/CSS3DRenderer";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { TransformControls } from "three/examples/jsm/controls/TransformControls";
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

  const [showTransformUI, setShowTransformUI] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<
    "translate" | "rotate" | "scale"
  >("translate");
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
    // Increase size and visibility
    transformControls.setSize(1.5); // Larger for better visibility

    // Set to world space by default, more intuitive for beginners
    transformControls.setSpace("world");

    // More precise snapping for better control
    transformControls.setTranslationSnap(0.05);
    transformControls.setRotationSnap(THREE.MathUtils.degToRad(5));
    transformControls.setScaleSnap(0.05);
  };

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

  useEffect(() => {
    if (!sceneRef.current || !fileAnchors || !cameraRef.current) return; // Added cameraRef check

    console.log("[ThreeViewer useEffect fileAnchors] Processing anchors:", fileAnchors);

    fileAnchors.forEach((anchor) => {
      // Skip if we've already added this anchor visually
      if (fileAnchorsRef.current.has(anchor.id)) {
        console.log(`[ThreeViewer useEffect fileAnchors] Anchor ${anchor.id} already exists, skipping.`);
        return;
      }

      console.log(`[ThreeViewer useEffect fileAnchors] Creating visual for anchor ${anchor.id}`, anchor);

      // 1. Calculate Position (same as before)
      const realWorldPosition = new THREE.Vector3(
        Number(anchor.x || 0),
        Number(anchor.y || 0),
        Number(anchor.z || 0),
      );
      let modelSpacePosition: THREE.Vector3;
      if (originPoint) {
        const offsetInModelUnits = realWorldPosition.clone().divideScalar(45.6);
        const originVector = originPoint instanceof THREE.Vector3
            ? originPoint.clone()
            : new THREE.Vector3(originPoint.x, originPoint.y, originPoint.z);
        modelSpacePosition = originVector.clone().add(offsetInModelUnits);
      } else {
        modelSpacePosition = realWorldPosition.clone().divideScalar(45.6);
        console.warn(`[ThreeViewer useEffect fileAnchors] No originPoint, placing anchor ${anchor.id} relative to world origin.`);
      }

      // 2. Create Visual based on fileType
      let anchorObject: THREE.Object3D | null = null; // To store the main visual object

      switch (anchor.fileType) {
        case "image":
          console.log(`[ThreeViewer useEffect fileAnchors] Creating image plane for ${anchor.fileName}`);
          const img = new Image();
          img.crossOrigin = "Anonymous"; // Important for textures from other origins
          img.onload = () => {
            try {
              const aspect = img.width / img.height;
              const planeWidth = 0.5; // Adjust size as needed
              const planeHeight = planeWidth / aspect;

              const texture = new THREE.Texture(img);
              texture.needsUpdate = true;
              texture.encoding = THREE.sRGBEncoding; // Use sRGB for color accuracy

              const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
                transparent: true, // Allow transparency if needed
              });
              const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
              const imagePlane = new THREE.Mesh(geometry, material);

              imagePlane.position.copy(modelSpacePosition);
              // Orient towards camera initially (optional, adjust as needed)
              imagePlane.lookAt(cameraRef.current!.position);
              imagePlane.rotation.x += Math.PI / 12; // Slight tilt up

              sceneRef.current!.add(imagePlane);
              fileAnchorsRef.current.set(anchor.id, imagePlane); // Store reference
              console.log(`[ThreeViewer useEffect fileAnchors] Image plane added for ${anchor.id}`);
            } catch(loadError) {
               console.error(`[ThreeViewer useEffect fileAnchors] Error creating image texture/mesh for ${anchor.id}:`, loadError);
               // Optionally create a fallback placeholder here
            }
          };
          img.onerror = (err) => {
            console.error(`[ThreeViewer useEffect fileAnchors] Error loading image ${anchor.fileUrl} for anchor ${anchor.id}:`, err);
             // Optionally create a fallback placeholder here
          };
          img.src = anchor.fileUrl; // Start loading
          // Note: We don't set anchorObject here because it's async
          break;

        case "video":
          console.log(`[ThreeViewer useEffect fileAnchors] Creating video plane for ${anchor.fileName}`);
          const video = document.createElement('video');
          video.crossOrigin = "Anonymous";
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          video.preload = "metadata"; // Load metadata first

          video.onloadeddata = () => {
             try {
                const aspect = video.videoWidth / video.videoHeight;
                const planeWidth = 0.6; // Adjust size
                const planeHeight = planeWidth / aspect;

                const videoTexture = new THREE.VideoTexture(video);
                videoTexture.needsUpdate = true;
                videoTexture.encoding = THREE.sRGBEncoding;

                const material = new THREE.MeshBasicMaterial({ map: videoTexture, side: THREE.DoubleSide, toneMapped: false });
                const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
                const videoPlane = new THREE.Mesh(geometry, material);

                videoPlane.position.copy(modelSpacePosition);
                videoPlane.lookAt(cameraRef.current!.position);
                videoPlane.rotation.x += Math.PI / 12; // Slight tilt

                sceneRef.current!.add(videoPlane);
                fileAnchorsRef.current.set(anchor.id, videoPlane); // Store reference
                console.log(`[ThreeViewer useEffect fileAnchors] Video plane added for ${anchor.id}`);
                // Start muted playback automatically (optional)
                video.play().catch(e => console.warn("Video autoplay prevented:", e));
             } catch(loadError) {
                 console.error(`[ThreeViewer useEffect fileAnchors] Error creating video texture/mesh for ${anchor.id}:`, loadError);
             }
          };
          video.onerror = (err) => {
             console.error(`[ThreeViewer useEffect fileAnchors] Error loading video ${anchor.fileUrl} for anchor ${anchor.id}:`, err);
          };
          video.src = anchor.fileUrl;
          // Note: We don't set anchorObject here because it's async
          break;

        case "document":
        default: // Fallback for documents or unknown types
          console.log(`[ThreeViewer useEffect fileAnchors] Creating document icon for ${anchor.fileName}`);
          const docGeometry = new THREE.BoxGeometry(0.15, 0.2, 0.02); // Simple box icon
          const docMaterial = new THREE.MeshBasicMaterial({ color: 0x2196f3 }); // Blue
          const docIcon = new THREE.Mesh(docGeometry, docMaterial);
          docIcon.position.copy(modelSpacePosition);
          sceneRef.current!.add(docIcon);
          anchorObject = docIcon; // Set the object to be stored
          break;
      }

      // Store the main visual object (if created synchronously)
      if (anchorObject) {
        fileAnchorsRef.current.set(anchor.id, anchorObject);
        console.log(`[ThreeViewer useEffect fileAnchors] Synchronous visual added for ${anchor.id}`);
      }

      // Add a text label regardless of type (optional)
      const labelDiv = document.createElement("div");
      labelDiv.textContent = anchor.fileName || "File";
      labelDiv.style.padding = "2px 5px";
      labelDiv.style.fontSize = "10px";
      labelDiv.style.color = "#333";
      labelDiv.style.backgroundColor = "rgba(255, 255, 255, 0.85)";
      labelDiv.style.borderRadius = "3px";
      labelDiv.style.border = "1px solid #ccc";
      labelDiv.style.whiteSpace = "nowrap";
      labelDiv.style.pointerEvents = "none"; // Prevent label from blocking clicks on the object

      const labelObject = new CSS3DObject(labelDiv);
      labelObject.scale.set(0.003, 0.003, 0.003); // Smaller scale
      // Position slightly above the calculated position
      labelObject.position.copy(modelSpacePosition).add(new THREE.Vector3(0, 0.15, 0)); // Adjust Y offset as needed
      sceneRef.current!.add(labelObject);
      // We don't store the label in fileAnchorsRef, only the main visual object

    });

    // Cleanup: Remove visuals for anchors that are no longer in the props
    const currentAnchorIds = new Set(fileAnchors.map(a => a.id));
    fileAnchorsRef.current.forEach((object, id) => {
        if (!currentAnchorIds.has(id)) {
            console.log(`[ThreeViewer useEffect fileAnchors] Cleaning up anchor ${id}`);
            sceneRef.current?.remove(object);
            // Also remove associated labels if they exist (you might need a separate map for labels)
            const labelToRemove = sceneRef.current?.children.find(child => child instanceof CSS3DObject && child.userData.anchorId === id);
            if (labelToRemove) {
                sceneRef.current?.remove(labelToRemove);
            }
            fileAnchorsRef.current.delete(id);
        }
    });


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

  // Add this function to ThreeViewer.tsx
  const addModelHighlight = (
    model: THREE.Object3D,
    scene: THREE.Scene | null,
  ) => {
    if (!scene) return;

    // Remove any existing highlights
    const existingOutline = scene.getObjectByName("model-highlight");
    if (existingOutline) {
      scene.remove(existingOutline);
    }

    // Create a bounding box
    const bbox = new THREE.Box3().setFromObject(model);

    // Create a box helper with cyan color
    const boxHelper = new THREE.Box3Helper(bbox, 0x00ffff);
    boxHelper.name = "model-highlight";
    boxHelper.material.depthTest = false; // Make it visible through objects
    boxHelper.material.transparent = true;
    boxHelper.material.opacity = 0.8;

    // Add to scene
    scene.add(boxHelper);

    // Subtle pulse animation
    const animate = () => {
      if (!boxHelper.material) return;

      requestAnimationFrame(animate);
      const time = Date.now() * 0.001;
      boxHelper.material.opacity = 0.4 + Math.sin(time * 4) * 0.2;
    };

    animate();
  };

  useEffect(() => {
    // Ensure both scene and textAnchors exist before proceeding.
    if (!sceneRef.current || !textAnchors) return;

    textAnchors.forEach((anchor: TextAnchor) => {
      // Skip if we've already added this anchor.
      if (textAnchorsRef.current.has(anchor.id)) return;

      // Create a local vector from the anchor's x, y, z.
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

      // FIXED POSITIONING LOGIC:
      // 1. Convert real-world feet to model units
      // 2. ADD to origin point (not subtract!)
      let modelSpacePosition;

      if (originPoint) {
        // Scale down by 45.6 to convert from feet to model units
        const offsetInModelUnits = new THREE.Vector3(
          anchorPosition.x / 45.6,
          anchorPosition.y / 45.6,
          anchorPosition.z / 45.6,
        );

        // Create a proper THREE.Vector3 from originPoint
        const originVector =
          originPoint instanceof THREE.Vector3
            ? originPoint.clone()
            : new THREE.Vector3(originPoint.x, originPoint.y, originPoint.z);

        // ADD this offset to the origin point (critically important - we add, not subtract!)
        modelSpacePosition = originVector.clone().add(offsetInModelUnits);

        console.log(`Text anchor ${anchor.id} positioning calculation:`, {
          originalPosition: anchorPosition,
          offsetInModelUnits,
          originPoint,
          finalPosition: modelSpacePosition,
        });
      } else {
        // If no origin, just convert from feet to model units
        modelSpacePosition = anchorPosition.clone().divideScalar(45.6);
      }

      // --- CREATE THE RED DOT ---
      const markerGeometry = new THREE.SphereGeometry(0.02, 16, 16);
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);

      // Use modelSpacePosition for positioning the marker
      markerMesh.position.copy(modelSpacePosition);
      markerMesh.renderOrder = 1000;
      sceneRef.current.add(markerMesh);

      // --- CREATE A CSS3DObject FOR THE LABEL ---
      const labelDiv = document.createElement("div");
      // For text anchors, we display the textContent.
      labelDiv.textContent = anchor.textContent;
      labelDiv.style.padding = "10px 12px";
      labelDiv.style.fontSize = "14px";
      labelDiv.style.color = "#ffffff";
      labelDiv.style.backgroundColor = "rgba(120, 120, 130, 0.82)";
      labelDiv.style.borderRadius = "12px";
      // Remove nowrap and add max-width with word wrapping
      labelDiv.style.whiteSpace = "normal";
      labelDiv.style.maxWidth = "220px"; // Set your desired max width
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

      const labelObject = new CSS3DObject(labelDiv);
      // Scale down the label as needed.
      labelObject.scale.set(0.0015, 0.0015, 0.0015);

      // Position the label slightly above the red dot using modelSpacePosition
      labelObject.position
        .copy(modelSpacePosition)
        .add(new THREE.Vector3(0, 0.05, 0));

      // Important: Store reference to anchor ID
      labelObject.userData.anchorId = anchor.id;
      // Also mark this as a text label for easier identification
      labelObject.userData.isTextLabel = true;

      sceneRef.current.add(labelObject);

      const compositeAnchor = {
        marker: markerMesh,
        label: labelObject,
        id: anchor.id,
      };

      // Track that we've added this text anchor.
      textAnchorsRef.current.set(anchor.id, markerMesh);
    });
  }, [textAnchors, originPoint]);

  useEffect(() => {
    // Highlight the selected model
    if (selectedModelId && anchorModelsRef.current.has(selectedModelId)) {
      const model = anchorModelsRef.current.get(selectedModelId);

      // Create outline effect for selected model
      if (model && sceneRef.current) {
        // Remove any existing highlight
        const existingOutline =
          sceneRef.current.getObjectByName("model-highlight");
        if (existingOutline) {
          sceneRef.current.remove(existingOutline);
        }

        // Create a bounding box for the model
        const bbox = new THREE.Box3().setFromObject(model);

        // Create a box helper with a distinct color
        const boxHelper = new THREE.Box3Helper(bbox, 0x00ffff);
        boxHelper.name = "model-highlight";

        // Add to scene
        sceneRef.current.add(boxHelper);

        // Pulse animation effect
        const animate = () => {
          if (!boxHelper || !sceneRef.current) return;

          const time = Date.now() * 0.001;
          const pulse = Math.sin(time * 4) * 0.1 + 0.9;

          boxHelper.material.opacity = pulse;

          requestAnimationFrame(animate);
        };

        animate();
      }
    } else {
      // Remove highlight when no model is selected
      if (sceneRef.current) {
        const existingOutline =
          sceneRef.current.getObjectByName("model-highlight");
        if (existingOutline) {
          sceneRef.current.remove(existingOutline);
        }
      }
    }

    return () => {
      // Cleanup when component unmounts
      if (sceneRef.current) {
        const existingOutline =
          sceneRef.current.getObjectByName("model-highlight");
        if (existingOutline) {
          sceneRef.current.remove(existingOutline);
        }
      }
    };
  }, [selectedModelId]);

  useEffect(() => {
    const handleTransformKeydown = (e: KeyboardEvent) => {
      if (!selectedModelId || !showTransformUI) return;

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
          setTransformMode("scale");
          transformControlsRef.current?.setMode("scale");
          break;
        case "escape": // Cancel transformations
          setShowTransformUI(false);
          transformControlsRef.current?.detach();
          if (orbitControlsRef.current) orbitControlsRef.current.enabled = true;
          break;
      }
    };

    window.addEventListener("keydown", handleTransformKeydown);

    return () => {
      window.removeEventListener("keydown", handleTransformKeydown);
    };
  }, [selectedModelId, showTransformUI]);

  useEffect(() => {
    if (!sceneRef.current || !webpageAnchors) return;

    console.log("Processing webpage anchors:", webpageAnchors);

    webpageAnchors.forEach(async (anchor) => {
      // Skip if we've already added this anchor
      if (anchorWebpagesRef.current.has(anchor.id)) {
        console.log(`Anchor ${anchor.id} already exists in scene, skipping`);
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

      // Create a small, semi-transparent marker for reference
      const markerGeometry = new THREE.SphereGeometry(0.01, 16, 16);
      const markerMaterial = new THREE.MeshBasicMaterial({
        color: 0x0066ff,
        transparent: true,
        opacity: 0.7,
      });
      const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
      markerMesh.position.copy(modelSpacePosition);
      markerMesh.renderOrder = 1000;
      sceneRef.current.add(markerMesh);

      // Load and add the actual webpage using CSS3DObject with iframe
      const webpageObject = await loadAndAddWebpage(
        anchor.webpageUrl,
        modelSpacePosition,
      );

      // If webpage loading was successful, store both objects
      if (webpageObject) {
        // Store webpage object in the map
        anchorWebpagesRef.current.set(anchor.id, webpageObject);

        // Associate marker with webpage for reference
        markerMesh.userData.webpageId = anchor.id;
        markerMesh.userData.webpageObject = webpageObject;
      } else {
        // Fallback to storing just the marker if webpage loading failed
        anchorWebpagesRef.current.set(anchor.id, markerMesh);

        // Create a label with the URL as fallback
        const labelDiv = document.createElement("div");
        labelDiv.textContent = anchor.webpageUrl;
        labelDiv.style.padding = "2px 4px";
        labelDiv.style.fontSize = "12px";
        labelDiv.style.color = "#000";
        labelDiv.style.backgroundColor = "rgba(255,255,255,0.8)";
        labelDiv.style.borderRadius = "4px";
        labelDiv.style.whiteSpace = "nowrap";

        const labelObject = new CSS3DObject(labelDiv);
        labelObject.scale.set(0.005, 0.005, 0.005);
        labelObject.position.copy(
          modelSpacePosition.clone().add(new THREE.Vector3(0, 0.05, 0)),
        );
        sceneRef.current.add(labelObject);
      }

      console.log(
        `Successfully added anchor ${anchor.id} to scene at position:`,
        modelSpacePosition,
      );
    });
  }, [webpageAnchors, originPoint]);

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

  const loadAndAddWebpage = async (url: string, position: THREE.Vector3) => {
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
    css3dObject.position.copy(position);

    // Adjust scale and position
    css3dObject.scale.set(0.0003, 0.0003, 0.0003); // Start small
    css3dObject.position.y += 0.1; // Lift slightly above the surface

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

    // Add keyboard shortcuts for transformation modes
    window.addEventListener("keydown", (event) => {
      if (!transformControls.object) return;

      switch (event.key.toLowerCase()) {
        case "g": // Move
          transformControls.setMode("translate");
          setTransformMode?.("translate");
          break;
        case "r": // Rotate
          transformControls.setMode("rotate");
          setTransformMode?.("rotate");
          break;
        case "s": // Scale
          transformControls.setMode("scale");
          setTransformMode?.("scale");
          break;
        case "x": // Toggle local/world space
          const newSpace =
            transformControls.space === "local" ? "world" : "local";
          transformControls.setSpace(newSpace);
          break;
        case "shift": // Enable precise mode
          transformControls.setTranslationSnap(0.01);
          transformControls.setRotationSnap(THREE.MathUtils.degToRad(5));
          transformControls.setScaleSnap(0.01);
          break;
      }
    });

    window.addEventListener("keyup", (event) => {
      if (event.key.toLowerCase() === "shift") {
        // Reset snapping when shift is released
        transformControls.setTranslationSnap(0.1);
        transformControls.setRotationSnap(THREE.MathUtils.degToRad(15));
        transformControls.setScaleSnap(0.1);
      }
    });

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
    // Determine if modelPath is an external URL or local path
    let fullModelPath = modelPath;
    
    // If it's not an external URL, prepend a slash for local path
    if (!modelPath.startsWith('http') && !modelPath.startsWith('/')) {
      fullModelPath = `/${modelPath}`;
    }

    console.log("Attempting to fetch 3D model from:", fullModelPath);
    
    // Set cross-origin setting for the loader
    loader.setCrossOrigin('anonymous');
    
    // For Firebase Storage URLs, we need to handle them directly
    if (fullModelPath.includes('firebasestorage.googleapis.com')) {
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
        model.scale.multiplyScalar(scale);
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
        if (attempt < maxAttempts - 1 && fullModelPath.includes('firebasestorage.googleapis.com')) {
          console.log(`Retrying model load... Attempt ${attempt + 1}/${maxAttempts}`);
          
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
      }
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

    async function handleClick(event: MouseEvent) {
      console.log("[ThreeViewer] handleClick fired!");
      if (
        !mountRef.current ||
        !clickMarkerRef.current ||
        !sceneRef.current ||
        !cameraRef.current
      )
        return;

      // 1) Convert click to normalized coords
      const rect = mountRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      const mouse = new THREE.Vector2(x, y);

      // 2) Perform the raycast
      raycasterRef.current.setFromCamera(mouse, cameraRef.current);
      const allIntersects = raycasterRef.current.intersectObjects(
        sceneRef.current.children,
        true,
      );

      // 3) If no intersection, bail out
      if (allIntersects.length === 0) return;

      // After your existing code that checks if something is clicked (inside handleClick)
      // Check if we clicked on an image or video anchor
      let isMediaAnchorClicked = false;
      let mediaAnchorId = null;
      let mediaObject = null;

      // Check all file anchors (images/videos)
      fileAnchorsRef.current.forEach((anchor, id) => {
        if (!isMediaAnchorClicked) {
          // Check if this anchor was clicked or contains the clicked object
          if (clickedObj === anchor || clickedObj.isDescendantOf?.(anchor)) {
            isMediaAnchorClicked = true;
            mediaAnchorId = id;
            mediaObject = anchor;
          }
        }
      });

      if (isMediaAnchorClicked && mediaObject) {
        console.log(`Media anchor clicked: ${mediaAnchorId}`);

        // If it's a video, check for the onClick handler
        if (mediaObject.userData.type === "video") {
          const videoPlane = mediaObject.children.find(
            (child) =>
              child instanceof THREE.Mesh &&
              child.material &&
              child.material.map instanceof THREE.VideoTexture,
          );

          if (videoPlane && videoPlane.userData.onClick) {
            videoPlane.userData.onClick();
          }
        }

        // Show transform controls for the media
        if (transformControlsRef.current) {
          // Get current mode or default to translate
          const currentMode = transformControlsRef.current.mode || "translate";

          // Attach to model
          transformControlsRef.current.attach(mediaObject);

          // Configure appearance and feedback
          transformControlsRef.current.setMode(currentMode);
          transformControlsRef.current.visible = true;

          // Add visual feedback
          addModelHighlight(mediaObject, sceneRef.current);

          // Show transformation UI
          setShowTransformUI(true);
          setTransformMode(currentMode as "translate" | "rotate" | "scale");

          // Animation feedback
          const originalScale = mediaObject.scale.clone();
          new TWEEN.Tween(mediaObject.scale)
            .to(
              {
                x: originalScale.x * 1.05,
                y: originalScale.y * 1.05,
                z: originalScale.z * 1.05,
              },
              150,
            )
            .easing(TWEEN.Easing.Cubic.Out)
            .yoyo(true)
            .repeat(1)
            .start();
        }

        return; // Exit early after handling media click
      }

      // MOVED: Handle origin point setting first - this is the key fix
      if (isChoosingOriginRef.current) {
        console.log("ORIGIN SELECTION MODE - Processing click");
        const hitPoint = allIntersects[0].point;
        if (onOriginSet && setIsChoosingOrigin) {
          onOriginSet(hitPoint.clone());
          setIsChoosingOrigin(false);

          originRef.current = hitPoint.clone();

          // (Optional: marker animation) - keep the animation as is
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
          originMarker.position.copy(hitPoint);
          sceneRef.current?.add(originMarker);

          // Animated ring
          const ringGeometry = new THREE.RingGeometry(0.05, 0.06, 32);
          const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            side: THREE.DoubleSide,
            transparent: true,
          });
          const ring = new THREE.Mesh(ringGeometry, ringMaterial);
          ring.rotation.x = Math.PI / 2;
          ring.position.copy(hitPoint);
          sceneRef.current?.add(ring);

          new TWEEN.Tween(ring.scale)
            .to({ x: 2, y: 2, z: 2 }, 1000)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();

          new TWEEN.Tween(ringMaterial)
            .to({ opacity: 0 }, 1000)
            .onComplete(() => sceneRef.current?.remove(ring))
            .start();

          console.log("Origin point set successfully!");
        }
        return;
      }

      if (qrPlacementModeRef.current && onQRPlaced) {
        // The user just clicked in the 3D view while in QR placement mode
        const hitPoint = allIntersects[0].point.clone();
        console.log(
          "[handleClick] Placing QR code at:",
          allIntersects[0].point,
        );
        onQRPlaced(hitPoint);
        return;
      } else if (placementModeRef.current?.type === "link" && onLinkPlaced) {
        // The user is placing a link
        const hitPoint = allIntersects[0].point.clone();
        console.log("[handleClick] Placing link at:", hitPoint);

        // Create immediate visual feedback
        const markerGeometry = new THREE.SphereGeometry(0.02, 16, 16);
        const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x0066ff }); // Blue color for links
        const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
        markerMesh.position.copy(hitPoint);
        markerMesh.renderOrder = 1000;
        sceneRef.current?.add(markerMesh);

        // Callback to parent component - this is the critical part!
        onLinkPlaced(hitPoint);

        // Add animation feedback
        new TWEEN.Tween(markerMesh.scale)
          .to({ x: 1.5, y: 1.5, z: 1.5 }, 300)
          .easing(TWEEN.Easing.Elastic.Out)
          .yoyo(true)
          .repeat(1)
          .start();

        // Try to immediately load and show a preview of the webpage
        const url = placementModeRef.current.data;
        if (url && typeof url === "string") {
          // Add visual loading indicator
          const loadingGeo = new THREE.SphereGeometry(0.05, 16, 16);
          const loadingMat = new THREE.MeshBasicMaterial({
            color: 0x3b82f6,
            transparent: true,
            opacity: 0.7,
          });
          const loadingIndicator = new THREE.Mesh(loadingGeo, loadingMat);
          loadingIndicator.position.copy(
            hitPoint.clone().add(new THREE.Vector3(0, 0.1, 0)),
          );
          sceneRef.current?.add(loadingIndicator);

          // Animate the loading indicator
          const animate = () => {
            if (!loadingIndicator.parent) return;
            loadingIndicator.rotation.y += 0.05;
            requestAnimationFrame(animate);
          };
          animate();

          // Try to load the webpage
          loadAndAddWebpage(url, hitPoint)
            .then((webObj) => {
              if (webObj && loadingIndicator.parent) {
                sceneRef.current?.remove(loadingIndicator);
              }
            })
            .catch((err) => {
              console.error("Error loading webpage:", err);
              if (loadingIndicator.parent) {
                sceneRef.current?.remove(loadingIndicator);
              }
            });
        }

        return;
      } else if (
        placementModeRef.current?.type === "file" &&
        placementModeRef.current.data
      ) {
        // The user is placing a file
        const hitPoint = allIntersects[0].point.clone();
        const fileData = placementModeRef.current.data;

        console.log(
          "[handleClick] Placing file at:",
          hitPoint,
          "File data:",
          fileData,
        );

        // Set marker color based on file type
        let markerColor;
        switch (fileData.fileType) {
          case "image":
            markerColor = 0x9c27b0; // Purple for images
            break;
          case "video":
            markerColor = 0xff5722; // Orange for videos
            break;
          case "document":
          default:
            markerColor = 0x2196f3; // Blue for documents/other
            break;
        }

        // Create immediate visual feedback
        const markerGeometry = new THREE.SphereGeometry(0.02, 16, 16);
        const markerMaterial = new THREE.MeshBasicMaterial({
          color: markerColor,
        });
        const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
        markerMesh.position.copy(hitPoint);
        markerMesh.renderOrder = 1000;
        sceneRef.current?.add(markerMesh);

        // Add a label above the marker
        const labelDiv = document.createElement("div");
        labelDiv.textContent = fileData.name || "File";
        labelDiv.style.padding = "2px 4px";
        labelDiv.style.fontSize = "12px";
        labelDiv.style.color = "#000";
        labelDiv.style.backgroundColor = "rgba(255,255,255,0.8)";
        labelDiv.style.borderRadius = "4px";
        labelDiv.style.whiteSpace = "nowrap";

        const labelObject = new CSS3DObject(labelDiv);
        labelObject.scale.set(0.005, 0.005, 0.005);
        labelObject.position.copy(
          hitPoint.clone().add(new THREE.Vector3(0, 0.05, 0)),
        );
        sceneRef.current?.add(labelObject);

        // Add a small animation/feedback
        new TWEEN.Tween(markerMesh.scale)
          .to({ x: 1.5, y: 1.5, z: 1.5 }, 300)
          .easing(TWEEN.Easing.Elastic.Out)
          .yoyo(true)
          .repeat(1)
          .start();

        // For file placement, we call onPlacementComplete from the parent
        if (onPlacementComplete) {
          // Call with a fake placement mode
          placementModeRef.current = {
            type: "file",
            data: fileData,
          };

          // Call the placement complete callback
          onPlacementComplete(hitPoint, null);

          // Reset the placement mode
          placementModeRef.current = null;
        }

        return;
      } else if (showTextBoxInputRef?.current && pendingLabelTextRef?.current) {
        console.log("[ThreeViewer] handleClick -- Text placement initiated!");
        // 1) The user wants to place a text label
        const hitPoint = allIntersects[0].point.clone();
        const textToPlace = pendingLabelTextRef.current; // Get text before clearing refs

        // 2) Turn off text placement mode immediately
        showTextBoxInputRef.current = false;
        pendingLabelTextRef.current = ""; // Clear the pending text

        // 3) Calculate real-world coordinates relative to origin
        if (originPoint) {
          const offset = hitPoint.clone().sub(originPoint);
          const scaledOffset = {
            x: offset.x * 45.64,
            y: offset.y * 45.64,
            z: offset.z * 45.64,
          };

          // 4) Call the callback to notify BlueprintEditor
          if (onTextBoxSubmit) {
            console.log(
              "[ThreeViewer] Calling onTextBoxSubmit with:",
              textToPlace,
              scaledOffset,
            );
            onTextBoxSubmit(textToPlace, scaledOffset);
          } else {
            console.error("[ThreeViewer] onTextBoxSubmit callback is missing!");
          }
        } else {
          console.error(
            "[ThreeViewer] Cannot place text anchor: Origin point not set.",
          );
          // Optionally show a toast or error message to the user
          // e.g., onError?.("Please set the origin point before placing text.");
        }

        return; // Exit handleClick after handling text placement
      } else {
        console.log("HANDLE CLICK - DID NOT MEET CRITERIA");
        console.log("qrPlacementMode is now:", qrPlacementMode);
        console.log("onQRPlaced is now:", onQRPlaced);
      }

      // IMPORTANT: Check for alignment mode (awaiting 3D picks)
      if (
        awaiting3DRef.current &&
        activeLabelRef.current &&
        setReferencePoints3D
      ) {
        const hitPoint = allIntersects[0].point;
        const sphereGeom = new THREE.SphereGeometry(0.02, 16, 16);
        const sphereMat = new THREE.MeshBasicMaterial({
          color: labelColors[activeLabelRef.current],
        });
        const newSphere = new THREE.Mesh(sphereGeom, sphereMat);
        newSphere.position.copy(hitPoint);
        sceneRef.current?.add(newSphere);
        newSphere.userData.label = activeLabelRef.current;

        transformControlsRef.current?.attach(newSphere);
        transformControlsRef.current?.setMode("translate");
        orbitControlsRef.current!.enabled = false;

        setReferencePoints3D((oldPoints) => [
          ...oldPoints,
          {
            label: activeLabelRef.current!,
            x3D: hitPoint.x,
            y3D: hitPoint.y,
            z3D: hitPoint.z,
          },
        ]);

        if (activeLabelRef.current === "A") {
          setActiveLabel?.("B");
        } else if (activeLabelRef.current === "B") {
          setActiveLabel?.("C");
        } else if (activeLabelRef.current === "C") {
          setActiveLabel?.(null);
        }

        setAwaiting3D?.(false);
        return;
      }

      // NOW we can check if originPoint exists for other operations that need it
      if (!originPoint) {
        console.log("Origin point is not set. Cannot calculate coordinates.");
        return; // Exit early if originPoint is not set
      }

      if (allIntersects.length > 0) {
        let clickedObj = allIntersects[0].object;
        let isModelClicked = false;
        let modelAnchorId = null;

        // Check if clicked on a 3D model from anchor models
        // We need to traverse up the parent chain to find the actual model
        let currentObj = clickedObj;
        let modelTransform = null;

        // First, try to find if it's a model by traversing up
        while (currentObj.parent && !isModelClicked) {
          // If the current object is in our anchorModelsRef
          for (const [id, model] of anchorModelsRef.current.entries()) {
            if (model === currentObj || currentObj.isDescendantOf?.(model)) {
              isModelClicked = true;
              modelAnchorId = id;
              modelTransform = model;
              // Stop the traversal since we found a match
              break;
            }
          }
          // If we didn't find a match yet, continue up the hierarchy
          if (!isModelClicked) {
            currentObj = currentObj.parent;
          }
        }

        // If we clicked on a model from our model anchors
        if (isModelClicked && modelTransform) {
          console.log(`Model clicked: ${modelAnchorId}`);

          // Use our new selection handler
          handleModelSelect(modelTransform, modelAnchorId);
          return;
        }

        // CHECK FOR TEXT ANCHORS, FILE ANCHORS, AND WEBPAGE ANCHORS
        let isAnchorClicked = false;
        let clickedAnchorId = null;
        let clickedAnchorObject = null;

        // Check text anchors
        // First check if we clicked directly on a text label (CSS3DObject with userData.isTextLabel)
        if (clickedObj.userData && clickedObj.userData.isTextLabel) {
          isAnchorClicked = true;
          clickedAnchorId = clickedObj.userData.anchorId;
          clickedAnchorObject = clickedObj;
          console.log(`Text label clicked directly: ${clickedAnchorId}`);
        }
        // Then check the composite objects in textAnchorsRef
        else {
          for (const [id, composite] of textAnchorsRef.current.entries()) {
            // Check if we clicked either the marker or the label
            if (
              clickedObj === composite.marker ||
              clickedObj === composite.label ||
              clickedObj.isDescendantOf?.(composite.marker) ||
              clickedObj.isDescendantOf?.(composite.label)
            ) {
              isAnchorClicked = true;
              clickedAnchorId = id;
              // Use the label for selection instead of the marker
              clickedAnchorObject = composite.label;
              console.log(`Text anchor component clicked: ${id}`);
              break;
            }
          }
        }

        // Check file anchors if no text anchor was clicked
        if (!isAnchorClicked) {
          for (const [id, object] of fileAnchorsRef.current.entries()) {
            if (clickedObj === object || clickedObj.isDescendantOf?.(object)) {
              isAnchorClicked = true;
              clickedAnchorId = id;
              clickedAnchorObject = object;
              console.log(`File anchor clicked: ${id}`);
              break;
            }
          }
        }

        // Check webpage anchors if still no match
        if (!isAnchorClicked) {
          for (const [id, object] of anchorWebpagesRef.current.entries()) {
            if (clickedObj === object || clickedObj.isDescendantOf?.(object)) {
              isAnchorClicked = true;
              clickedAnchorId = id;
              clickedAnchorObject = object;
              console.log(`Webpage anchor clicked: ${id}`);
              break;
            }
          }
        }

        // Handle the clicked anchor if found
        if (isAnchorClicked && clickedAnchorObject) {
          // Save the current selected ID
          setSelectedModelId(clickedAnchorId);

          // Store original transform for cancel/undo operations
          setLastTransform({
            position: clickedAnchorObject.position.clone(),
            rotation: clickedAnchorObject.rotation.clone(),
            scale: clickedAnchorObject.scale.clone(),
          });

          // Attach transform controls
          if (transformControlsRef.current) {
            transformControlsRef.current.attach(clickedAnchorObject);
            transformControlsRef.current.setMode("translate"); // Default to move mode
            setTransformMode("translate");

            // Show transform UI indicator
            setShowTransformUI(true);

            // Highlight the selected object
            addModelHighlight(clickedAnchorObject, sceneRef.current);

            // Animation for visual feedback
            new TWEEN.Tween(clickedAnchorObject.scale)
              .to(
                {
                  x: clickedAnchorObject.scale.x * 1.05,
                  y: clickedAnchorObject.scale.y * 1.05,
                  z: clickedAnchorObject.scale.z * 1.05,
                },
                150,
              )
              .yoyo(true)
              .repeat(1)
              .easing(TWEEN.Easing.Cubic.Out)
              .start();
          }

          if (
            clickedAnchorObject.userData &&
            clickedAnchorObject.userData.isTextLabel
          ) {
            // Add a subtle highlight effect to the label
            const labelElement = clickedAnchorObject.element;
            if (labelElement) {
              // Backup original background color
              const originalBgColor = labelElement.style.backgroundColor;
              labelElement.style.backgroundColor = "rgba(100, 149, 237, 0.9)"; // Cornflower blue with more opacity

              // Add a subtle animation
              labelElement.style.transition = "all 0.2s ease-in-out";

              // Restore original color on deselection
              const restoreOriginalColor = () => {
                if (
                  transformControlsRef.current &&
                  transformControlsRef.current.object !== clickedAnchorObject
                ) {
                  labelElement.style.backgroundColor = originalBgColor;
                }
              };

              // Set up a handler for deselection
              setTimeout(restoreOriginalColor, 100);
            }
          }
          return;
        }

        // Check if it's a reference point with a label
        while (
          clickedObj.parent &&
          !clickedObj.userData.label &&
          !isModelClicked &&
          clickedObj.name !== "Antique_Iron_Safe"
        ) {
          clickedObj = clickedObj.parent;
        }

        // If we clicked on a model from our model anchors
        if (isModelClicked && modelTransform) {
          console.log(`Model clicked: ${modelAnchorId}`);

          // Save the current selected model ID for updates
          setSelectedModelId(modelAnchorId);

          // Show transform controls and attach to the model
          if (transformControlsRef.current) {
            // Get current mode or default to translate
            const currentMode =
              transformControlsRef.current.mode || "translate";

            // Attach to model
            transformControlsRef.current.attach(modelTransform);

            // Configure appearance and feedback
            transformControlsRef.current.setMode(currentMode);
            transformControlsRef.current.visible = true;

            // Add visual feedback
            addModelHighlight(modelTransform, sceneRef.current);

            // Temporarily disable orbit controls while transforming
            if (orbitControlsRef.current) {
              // We'll keep orbit controls enabled but they'll be disabled during dragging
              orbitControlsRef.current.enabled = true;
            }

            // Show transformation UI
            setShowTransformUI(true);
            setTransformMode(currentMode as "translate" | "rotate" | "scale");

            // Play a subtle animation to show selection
            const originalScale = modelTransform.scale.clone();
            new TWEEN.Tween(modelTransform.scale)
              .to(
                {
                  x: originalScale.x * 1.05,
                  y: originalScale.y * 1.05,
                  z: originalScale.z * 1.05,
                },
                150,
              )
              .easing(TWEEN.Easing.Cubic.Out)
              .yoyo(true)
              .repeat(1)
              .start();
          }
          return;
        } else if (clickedObj.userData.label) {
          // This is the existing logic for labeled points
          orbitControlsRef.current!.enabled = false;
          transformControlsRef.current?.attach(clickedObj);
          transformControlsRef.current?.setMode("translate");
          isMarkerSelectedRef.current = true;
          return;
        } else {
          // #5: Calculate and display coordinates relative to originPoint prop
          if (originPoint) {
            const hitPoint = allIntersects[0].point.clone();
            // Create a new vector to avoid modifying the original point in the calculation
            const offset = hitPoint.clone().sub(originPoint);
            const distanceInFeet = offset.length() * 45.64;
            const msg = `X:${(offset.x * 45.64).toFixed(2)}, Y:${(offset.y * 45.64).toFixed(2)}, Z:${(offset.z * 45.64).toFixed(2)}
            distance = ${distanceInFeet.toFixed(2)} ft from origin`;

            console.log("Coordinate display:", msg);
            setDistanceDisplay(msg);
          }

          // Hide transform UI if we clicked elsewhere
          setShowTransformUI(false);
        }

        // If we didn't click on anything special, detach the transform controls
        transformControlsRef.current?.detach();
        if (orbitControlsRef.current) {
          orbitControlsRef.current.enabled = true;
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
      raycasterRef.current.setFromCamera({ x, y }, camera);
      return raycasterRef.current.intersectObjects(scene.children, true);
    }

    // Add this function to ThreeViewer.tsx
    const createBlenderStyleGizmo = (object) => {
      if (!sceneRef.current || !object) return;

      // Remove any existing gizmo
      const existingGizmo = sceneRef.current.getObjectByName("blender-gizmo");
      if (existingGizmo) {
        sceneRef.current.remove(existingGizmo);
      }

      // Create a group to hold our custom gizmo
      const gizmoGroup = new THREE.Group();
      gizmoGroup.name = "blender-gizmo";

      // X-axis (red) arrow
      const xArrow = createAxisArrow(0xff0000, new THREE.Vector3(1, 0, 0));
      gizmoGroup.add(xArrow);

      // Y-axis (green) arrow
      const yArrow = createAxisArrow(0x00ff00, new THREE.Vector3(0, 1, 0));
      gizmoGroup.add(yArrow);

      // Z-axis (blue) arrow
      const zArrow = createAxisArrow(0x0000ff, new THREE.Vector3(0, 0, 1));
      gizmoGroup.add(zArrow);

      // Position the gizmo at the object's position
      gizmoGroup.position.copy(object.position);

      // Add to scene
      sceneRef.current.add(gizmoGroup);

      // Helper function to create an arrow for an axis
      function createAxisArrow(color, direction) {
        const arrowLength = 0.3;
        const arrowHead = new THREE.ConeGeometry(0.05, 0.1, 8);
        const arrowBody = new THREE.CylinderGeometry(
          0.01,
          0.01,
          arrowLength - 0.1,
          8,
        );

        const material = new THREE.MeshBasicMaterial({ color: color });

        const headMesh = new THREE.Mesh(arrowHead, material);
        const bodyMesh = new THREE.Mesh(arrowBody, material);

        // Position the arrow parts
        bodyMesh.position.copy(
          direction.clone().multiplyScalar(arrowLength / 2 - 0.05),
        );
        headMesh.position.copy(
          direction.clone().multiplyScalar(arrowLength - 0.05),
        );

        // Rotate the arrow to point in the correct direction
        if (!direction.equals(new THREE.Vector3(0, 1, 0))) {
          const axis = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
          const angle = Math.acos(new THREE.Vector3(0, 1, 0).dot(direction));
          bodyMesh.setRotationFromAxisAngle(axis, angle);
          headMesh.setRotationFromAxisAngle(axis, angle);
        }

        const arrow = new THREE.Group();
        arrow.add(headMesh);
        arrow.add(bodyMesh);

        return arrow;
      }

      return gizmoGroup;
    };

    // Add this function to ThreeViewer.tsx
    const handleModelSelect = (model, anchorId) => {
      // Save the current model ID
      setSelectedModelId(anchorId);

      // Store original transform for cancel/undo operations
      setLastTransform({
        position: model.position.clone(),
        rotation: model.rotation.clone(),
        scale: model.scale.clone(),
      });

      // Attach transform controls
      if (transformControlsRef.current) {
        transformControlsRef.current.attach(model);
        transformControlsRef.current.setMode("translate"); // Default to move mode
        setTransformMode("translate");

        // Show transform UI indicator
        setShowTransformUI(true);

        // Highlight the selected model
        addModelHighlight(model, sceneRef.current);

        // Transition animation for visual feedback
        new TWEEN.Tween(model.scale)
          .to(
            {
              x: model.scale.x * 1.05,
              y: model.scale.y * 1.05,
              z: model.scale.z * 1.05,
            },
            150,
          )
          .yoyo(true)
          .repeat(1)
          .easing(TWEEN.Easing.Cubic.Out)
          .start();
      }
    };

    // Add this to your existing keyboard event handlers
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!transformControlsRef.current || !transformControlsRef.current.object)
        return;

      switch (event.key.toLowerCase()) {
        case "g": // Move
          transformControlsRef.current.setMode("translate");
          setTransformMode("translate");
          break;
        case "r": // Rotate
          transformControlsRef.current.setMode("rotate");
          setTransformMode("rotate");
          break;
        case "s": // Scale
          transformControlsRef.current.setMode("scale");
          setTransformMode("scale");
          break;
        case "x": // Constrain to X axis
          transformControlsRef.current.showX = true;
          transformControlsRef.current.showY = false;
          transformControlsRef.current.showZ = false;
          break;
        case "y": // Constrain to Y axis
          transformControlsRef.current.showX = false;
          transformControlsRef.current.showY = true;
          transformControlsRef.current.showZ = false;
          break;
        case "z": // Constrain to Z axis
          transformControlsRef.current.showX = false;
          transformControlsRef.current.showY = false;
          transformControlsRef.current.showZ = true;
          break;
        case " ": // Spacebar - Reset axis constraints
          transformControlsRef.current.showX = true;
          transformControlsRef.current.showY = true;
          transformControlsRef.current.showZ = true;
          break;
        case "escape": // Cancel transformation
          if (transformControlsRef.current.object) {
            const originalTransform = lastTransform;
            // Restore original position if available
            if (originalTransform.position) {
              transformControlsRef.current.object.position.copy(
                originalTransform.position,
              );
            }
            if (originalTransform.rotation) {
              transformControlsRef.current.object.rotation.copy(
                originalTransform.rotation,
              );
            }
            if (originalTransform.scale) {
              transformControlsRef.current.object.scale.copy(
                originalTransform.scale,
              );
            }
          }
          transformControlsRef.current.detach();
          setShowTransformUI(false);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

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

      const modelDataString = e.dataTransfer?.getData("application/model");
      const fileDataString = e.dataTransfer?.getData("application/file");
      console.log(
        "[ThreeViewer handleDrop] Retrieved fileDataString:",
        fileDataString,
      ); // Log retrieved data

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
            console.log("[ThreeViewer handleDrop] Processing dropped model:", modelInfo);
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
          } else if (fileDataString) { // Use the string retrieved earlier
            try {
              const fileInfo = JSON.parse(fileDataString); // Parse the string here
              console.log("[ThreeViewer] File dropped:", fileInfo, "at:", dropPoint);

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
                      console.log("[ThreeViewer] Calling onFileDropped with:", fileInfo, scaledOffset);
                      onFileDropped(fileInfo, scaledOffset); // Pass fileInfo and calculated coords
                  } else {
                      console.error("[ThreeViewer] onFileDropped callback is missing!");
                  }

                  // Remove loading indicator (it will be re-added by state update if needed)
                  sceneRef.current?.remove(loadingIndicator);
                  // Show temporary success feedback (optional)
                  showSuccessIndicator(dropPoint, fileInfo.name || "File");

              } else {
                   console.error("[ThreeViewer] Cannot place file anchor: Origin point not set.");
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
      window.removeEventListener("keydown", handleKeyDown);
      if (mountRef.current) {
        mountRef.current.removeEventListener("contextmenu", handleRightClick);
        mountRef.current.removeEventListener("click", handleClick);
        mountRef.current.removeEventListener("dragover", (e) => {
          e.preventDefault();
        });
        mountRef.current.removeEventListener("drop", handleFileDrop);
        mountRef.current.removeChild(renderer.domElement);
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
    };
  }, [modelPath]);

  useEffect(() => {
    // Set up listener for transform changes
    if (!transformControlsRef.current) return;

    const handleTransformChange = () => {
      if (!selectedModelId || !transformControlsRef.current?.object) return;

      const transformedObject = transformControlsRef.current.object;

      // Get the current world position/rotation/scale
      const currentPosition = transformedObject.position.clone();
      const currentRotation = transformedObject.rotation.clone();
      const currentScale = transformedObject.scale.clone();

      // Store the last transform for undo functionality
      setLastTransform({
        position: currentPosition,
        rotation: currentRotation,
        scale: currentScale,
      });

      // Debounce the Firebase update to avoid too many writes
      if (transformUpdateTimeout.current) {
        clearTimeout(transformUpdateTimeout.current);
      }

      transformUpdateTimeout.current = setTimeout(() => {
        // Convert to real-world coordinates
        const realWorldPos = convertToRealWorldCoords(currentPosition);

        // Update Firebase with the new transform
        updateAnchorTransform(selectedModelId, {
          x: realWorldPos.x,
          y: realWorldPos.y,
          z: realWorldPos.z,
          rotationX: currentRotation.x,
          rotationY: currentRotation.y,
          rotationZ: currentRotation.z,
          scaleX: currentScale.x,
          scaleY: currentScale.y,
          scaleZ: currentScale.z,
        });
      }, 300); // Wait 300ms after the last change
    };

    transformControlsRef.current.addEventListener(
      "objectChange",
      handleTransformChange,
    );

    return () => {
      transformControlsRef.current?.removeEventListener(
        "objectChange",
        handleTransformChange,
      );
    };
  }, [selectedModelId, transformControlsRef.current, originPoint]);

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
        scene.add(helper);
        tempBoxHelperRef.current = helper;

        // 2) Add a translucent fill
        const size = new THREE.Vector3();
        box3.getSize(size);
        const center = new THREE.Vector3();
        box3.getCenter(center);

        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const material = new THREE.MeshBasicMaterial({
          color: 0x0000ff, // or pick any highlight color
          transparent: true,
          opacity: 0.2, // 20% visible
        });
        const fillMesh = new THREE.Mesh(geometry, material);
        fillMesh.position.copy(center);

        // Optional: so you can see inside if camera is inside box
        // fillMesh.material.side = THREE.DoubleSide;

        scene.add(fillMesh);
        tempBoxMeshRef.current = fillMesh;
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

      {showTransformUI && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-4 left-4 bg-black/70 text-white rounded-lg shadow-lg px-4 py-2 z-50"
        >
          <div className="flex items-center gap-3">
            <div className="font-medium text-sm uppercase">
              {transformMode === "translate"
                ? "MOVE"
                : transformMode === "rotate"
                  ? "ROTATE"
                  : "SCALE"}
            </div>
            <div className="text-xs opacity-80">
              {transformMode === "translate"
                ? "G"
                : transformMode === "rotate"
                  ? "R"
                  : "S"}
            </div>
            <div className="text-xs">Press X/Y/Z to constrain to axis</div>
          </div>
        </motion.div>
      )}

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
