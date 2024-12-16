"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import ViewModeToggle from "@/components/ViewModeToggle";
import ErrorBoundary from "@/components/ErrorBoundary";
import ModelViewer from "@/components/ModelViewer";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': any;
    }
  }
}
import { MouseEvent } from "react"; // Import MouseEvent
import { createDrawTools, type DrawTools } from "@/lib/drawTools";
import {
  syncElementWithFirebase,
  updateAnchorInFirebase,
  deleteAnchorFromFirebase,
} from "@/lib/anchorSync";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  doc,
  getDoc, // Add this import
  updateDoc,
  arrayUnion,
  arrayRemove,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useLocation } from "wouter";
import ScreenShareButton from "@/components/ScreenShareButton";

import { motion, AnimatePresence } from "framer-motion";
import {
  Ruler,
  Move,
  Plus,
  Settings,
  Save,
  Grid,
  Minus,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Loader2,
  Hand,
  MessageCircle,
  Send,
  RotateCw,
  AlignStartHorizontal,
  AlignStartVertical,
  Layers,
  Copy,
  Trash2,
  Square,
  Eye,
  Pencil,
  PlusCircle,
  Text,
  X,
} from "lucide-react";

import {
  MapPin,
  Touchpad,
  Search,
  Image as ImageIcon,
  Video,
  Circle,
  Cube as CubeIcon,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import FileUpload from "@/components/FileUpload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import Nav from "@/components/Nav";

// // Add the grid pattern CSS here
// <style>
//   .bg-grid-pattern {
//     background-image: linear-gradient(to right, rgba(0, 0, 0, 0.1) 1px, transparent 1px),
//       linear-gradient(to bottom, rgba(0, 0, 0, 0.1) 1px, transparent 1px);
//     background-size: 20px 20px;
//     image-rendering: pixelated;
//   }
// </style>

interface Position {
  x: number;
  y: number;
}

interface ARElement {
  id: string;
  anchorId?: string; // Add this to track the corresponding Firebase anchor
  type: "infoCard" | "marker" | "interactive" | "media" | "shape" | "label";
  position: Position;
  content: ElementContent;
}

interface ElementContent {
  title: string;
  description: string;
  trigger: "proximity" | "click" | "always";
  mediaUrl?: string;
  mediaType?: "image" | "video";
}

const handleMediaUpload = async (file: File) => {
  if (!selectedElement || !blueprintId) return;

  try {
    // Update the element with the new media file
    await updateAnchorInFirebase(
      selectedElement,
      selectedElement.anchorId!,
      blueprintId,
      file,
    );

    // Get the download URL and update local state
    const { downloadUrl } = await uploadMediaToFirebase(
      file,
      blueprintId,
      selectedElement.anchorId!,
    );

    updateElementContent(selectedElement.id, {
      mediaUrl: downloadUrl,
      mediaType: file.type.startsWith("image/") ? "image" : "video",
    });
  } catch (error) {
    console.error("Media upload error:", error);
    toast({
      title: "Upload Failed",
      description: "Failed to upload media. Please try again.",
      variant: "destructive",
    });
  }
};

interface Zone {
  id: string;
  name: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface ZoomState {
  isZooming: boolean;
  startY: number;
  lastScale: number;
}

interface ARElement {
  id: string;
  type: "infoCard" | "marker" | "interactive" | "media" | "shape" | "label";
  position: Position;
  content: ElementContent;
}

interface EditorState {
  layout: {
    url: string;
    url3D?: string; // Add this line
    name: string;
    aspectRatio: number;
    originalWidth: number;
    originalHeight: number;
  };
  scale: number;
  containerScale: number;
  position: Position;
  rotation: number;
  snapToGrid: boolean;
  isPlacementMode: boolean;
}

interface Message {
  id: string;
  content: string;
  isAi: boolean;
  isImage?: boolean;
  isLoading?: boolean;
}

// Helper functions
const createImageFromFile = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

const availableElements = [
  {
    id: "label",
    type: "label",
    name: "Label",
    category: "labels",
    icon: <Text className="h-6 w-6" />,
  },
  {
    id: "infoCard",
    type: "infoCard",
    name: "Info Card",
    category: "infoCard",
    icon: <Card className="h-6 w-6" />,
  },
  {
    id: "marker",
    type: "marker",
    name: "Marker",
    category: "marker",
    icon: <MapPin className="h-6 w-6" />,
  },
  {
    id: "interactive",
    type: "interactive",
    name: "Interactive",
    category: "interactive",
    icon: <Touchpad className="h-6 w-6" />,
  },
  {
    id: "image",
    type: "media",
    name: "Image",
    category: "media",
    icon: <ImageIcon className="h-6 w-6" />,
  },
  {
    id: "video",
    type: "media",
    name: "Video",
    category: "media",
    icon: <Video className="h-6 w-6" />,
  },
];

const GRID_BASE_SIZE = 20; // Base grid size in pixels
const MIN_ZOOM = 0.25; // Minimum zoom level
const MAX_ZOOM = 5; // Maximum zoom level
const ZOOM_SPEED = 0.1; // How much zoom changes per step
const INITIAL_ZOOM_PADDING = 0.9; // Leave 10% padding when initially fitting image

const createImageUrl = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Function to convert Firebase anchor data back to an AR element
const convertAnchorToElement = (anchorData: any): ARElement => {
  console.log("Converting anchor data:", anchorData);

  const baseElement: ARElement = {
    id: anchorData.contentID,
    anchorId: anchorData.id,
    type: anchorData.contentType as ARElement["type"],
    position: {
      x: anchorData.x,
      y: anchorData.y,
    },
    content: {
      title: anchorData.title || "Untitled Element",
      description: anchorData.description || "No description",
      trigger: anchorData.trigger || "click",
    },
  };

  // Add media-specific properties for media elements
  if (anchorData.contentType === "media") {
    return {
      ...baseElement,
      content: {
        ...baseElement.content,
        mediaUrl: anchorData.mediaUrl || "",
        mediaType: anchorData.mediaType || "image",
      },
    };
  }

  // Add label-specific properties
  if (anchorData.contentType === "label") {
    return {
      ...baseElement,
      content: {
        ...baseElement.content,
        title: anchorData.textContent || anchorData.title,
      },
    };
  }

  return baseElement;
};

// Function to load all anchors for a blueprint
const loadBlueprintAnchors = async (blueprintId: string) => {
  try {
    console.log("Starting to load anchors for blueprint:", blueprintId);

    // First, get the blueprint document to get the anchor IDs
    const blueprintRef = doc(db, "blueprints", blueprintId);
    const blueprintSnap = await getDoc(blueprintRef);

    if (!blueprintSnap.exists()) {
      console.error("Blueprint not found");
      return [];
    }

    const blueprintData = blueprintSnap.data();
    const anchorIDs = blueprintData.anchorIDs || [];
    console.log("Found anchor IDs:", anchorIDs);

    if (anchorIDs.length === 0) {
      console.log("No anchors found for blueprint");
      return [];
    }

    // Then fetch all anchors in parallel
    const anchorPromises = anchorIDs.map(async (anchorId: string) => {
      console.log("Fetching anchor:", anchorId);
      const anchorRef = doc(db, "anchors", anchorId);
      const anchorSnap = await getDoc(anchorRef);

      if (!anchorSnap.exists()) {
        console.log("Anchor not found:", anchorId);
        return null;
      }

      const data = anchorSnap.data();
      console.log("Anchor data retrieved:", data);
      return data;
    });

    const anchors = await Promise.all(anchorPromises);
    console.log("All anchors loaded:", anchors);

    // Filter out any null values and convert to AR elements
    const elements = anchors
      .filter((anchor): anchor is NonNullable<typeof anchor> => anchor !== null)
      .map((anchorData) => {
        const element = convertAnchorToElement(anchorData);
        console.log("Converted anchor to element:", element);
        return element;
      });

    console.log("Final converted elements:", elements);
    return elements;
  } catch (error) {
    console.error("Error loading blueprint anchors:", error);
    return [];
  }
};

export default function BlueprintEditor() {
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [geminiAnalysis, setGeminiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [location] = useLocation();
  const blueprintId = location.split("/").pop(); // assuming the route is /blueprint-editor/{id}
  const [generatingImage, setGeneratingImage] = useState(false); // Add loading state
  const storage = getStorage();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [mouseScreenPos, setMouseScreenPos] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<"2D" | "3D">("2D");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isHighlighting, setIsHighlighting] = useState(false);
  const [highlightStartPos, setHighlightStartPos] = useState<Position | null>(
    null,
  );
  const [highlightCurrentPos, setHighlightCurrentPos] =
    useState<Position | null>(null);

  const [zoomState, setZoomState] = useState<ZoomState>({
    isZooming: false,
    startY: 0,
    lastScale: 1,
  });

  const [promptPosition, setPromptPosition] = useState({ x: 0, y: 0 });
  const [promptInput, setPromptInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentStep, setCurrentStep] = useState(0);
  const [elements, setElements] = useState<ARElement[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawTools, setDrawTools] = useState<DrawTools | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [selectedElement, setSelectedElement] = useState<ARElement | null>(
    null,
  );
  const [showGrid, setShowGrid] = useState(true);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isPanMode, setIsPanMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      content:
        "Hello! I can help you edit your Blueprint. What would you like to do?",
      isAi: true,
    },
  ]);
  const { toast } = useToast();

  type EditorCommand = {
    action: "add" | "edit" | "delete" | "move";
    elementType?:
      | "video"
      | "image"
      | "marker"
      | "infoCard"
      | "label"
      | "interactive";
    position?: { x: number; y: number };
    content?: Partial<ElementContent>;
  };

  // Parser function to identify commands from natural language
  const parseEditorCommand = (message: string): EditorCommand | null => {
    message = message.toLowerCase();

    // Add video command
    if (message.includes("add video") || message.includes("insert video")) {
      return {
        action: "add",
        elementType: "video",
      };
    }

    // Add image command
    if (message.includes("add image") || message.includes("insert image")) {
      return {
        action: "add",
        elementType: "image",
      };
    }

    // Add marker command
    if (message.includes("add marker") || message.includes("place marker")) {
      return {
        action: "add",
        elementType: "marker",
      };
    }

    // Add more command patterns here...

    return null;
  };

  // Function to execute editor commands
  const executeEditorCommand = async (command: EditorCommand) => {
    switch (command.action) {
      case "add":
        if (command.elementType) {
          // Add the element using existing addElement function
          addElement(command.elementType);

          // If it's a media element, trigger file selection
          if (
            command.elementType === "video" ||
            command.elementType === "image"
          ) {
            // Create a hidden file input and trigger it
            const input = document.createElement("input");
            input.type = "file";
            input.accept =
              command.elementType === "video" ? "video/*" : "image/*";
            input.style.display = "none";

            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) {
                try {
                  const url = await createImageUrl(file);
                  if (selectedElement) {
                    updateElementContent(selectedElement.id, {
                      mediaUrl: url,
                      mediaType:
                        command.elementType === "video" ? "video" : "image",
                    });
                  }
                } catch (error) {
                  toast({
                    title: "Upload Failed",
                    description: "Failed to upload media. Please try again.",
                    variant: "destructive",
                  });
                }
              }
            };

            document.body.appendChild(input);
            input.click();
            document.body.removeChild(input);
          }
        }
        break;

      // Add more cases for other actions...
    }
  };

  const [editorState, setEditorState] = useState<EditorState>({
    layout: {
      url: "",
      name: "",
      aspectRatio: 1,
      originalWidth: 0,
      originalHeight: 0,
    },
    scale: 1,
    containerScale: 1,
    position: { x: 0, y: 0 },
    rotation: 0,
    snapToGrid: false,
    isPlacementMode: false,
  });

  const [zones, setZones] = useState<Zone[]>([]);
  const [isDefiningZone, setIsDefiningZone] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showPreviewMode, setShowPreviewMode] = useState(false);

  useEffect(() => {
    if (containerRef.current) {
      const tools = createDrawTools({
        containerRef,
        scale: editorState.scale,
        gridSize: calculateGridSize(editorState.scale),
      });
      setDrawTools(tools);
    }
  }, [containerRef.current, editorState.scale]);

  const filteredElements = availableElements.filter((element) => {
    const matchesSearch = element.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || element.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  useEffect(() => {
    if (drawTools) {
      drawTools.updateScale(editorState.scale);
    }
  }, [editorState.scale]);

  const createImageFromFile = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image"));
      };

      img.src = url;
    });
  };

  // Add near handleFileUpload
  const handle3DFileUpload = async (file: File) => {
    setSelectedFile(file);
    setLoading(true);
    try {
      // Upload to Firebase Storage
      const storageRef = ref(
        storage,
        `blueprints/${blueprintId}/3d/${file.name}`,
      );
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // Update Firestore with the 3D model URL
      const blueprintRef = doc(db, "blueprints", blueprintId);

      // Get the current blueprint data
      const blueprintSnap = await getDoc(blueprintRef); // Fetch the document
      const blueprintData = blueprintSnap.data() || {}; // Get data or empty object

      await updateDoc(blueprintRef, {
        floorPlan3DUrl: downloadURL, // Update 3D URL
        features: {
          ...blueprintData.features, // Now blueprintData is defined
          arVisualizations: {
            details: {
              arModelUrls: downloadURL,
              enabled: true,
            },
            enabled: true, // Add this line to enable the feature
          },
        },
      });

      // Update local state
      setEditorState((prev) => ({
        ...prev,
        layout: {
          ...prev.layout,
          url3D: downloadURL,
        },
      }));

      setSelectedFile(null); // Clear selected file

      toast({
        title: "Success",
        description: "3D model uploaded successfully",
      });
    } catch (error) {
      console.error("3D model upload error:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload 3D model. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    try {
      const fileType = file.type.toLowerCase();

      if (
        fileType === "image/png" ||
        fileType === "image/jpeg" ||
        fileType === "image/jpg"
      ) {
        const img = await createImageFromFile(file);
        const result = await createImageUrl(file);

        const containerWidth = containerRef.current?.clientWidth || 800;
        const containerHeight = containerRef.current?.clientHeight || 600;

        // Calculate scale while maintaining aspect ratio and adding padding
        const scaleWidth = (containerWidth * INITIAL_ZOOM_PADDING) / img.width;
        const scaleHeight =
          (containerHeight * INITIAL_ZOOM_PADDING) / img.height;
        const initialScale = Math.min(scaleWidth, scaleHeight);

        // Center the image
        const xOffset = (containerWidth - img.width * initialScale) / 2;
        const yOffset = (containerHeight - img.height * initialScale) / 2;

        setEditorState((prev) => ({
          ...prev,
          layout: {
            url: result,
            name: file.name,
            aspectRatio: img.width / img.height,
            originalWidth: img.width,
            originalHeight: img.height,
          },
          scale: initialScale,
          containerScale: initialScale,
          position: {
            x: xOffset,
            y: yOffset,
          },
          isPlacementMode: true,
        }));

        // Now upload to Firebase Storage:
        const storageRef = ref(storage, `blueprints/${blueprintId}`);
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);

        // Update Firestore with the downloadURL
        await updateDoc(doc(db, "blueprints", blueprintId), {
          floorPlanUrl: downloadURL,
        });

        // Update the editor state layout url to the newly uploaded file:
        setEditorState((prev) => ({
          ...prev,
          layout: { ...prev.layout, url: downloadURL },
        }));
      } else {
        throw new Error(
          "Unsupported file type. Please upload PNG, JPG, or PDF.",
        );
      }
    } catch (error) {
      console.error("Image upload error:", error);
      toast({
        title: "Upload Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to load the file. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragEnd = async (elementId: string, position: Position) => {
    try {
      const element = elements.find((el) => el.id === elementId);
      if (!element) return;

      // Update position in local state and Firebase
      await updateElementPosition(elementId, position);
    } catch (error) {
      console.error("Error handling drag end:", error);
      toast({
        title: "Error",
        description: "Failed to update element position. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDragLeave = () => {
    setIsDraggingFile(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);

    const file = e.dataTransfer.files[0];
    if (file && (file.type === "image/png" || file.type === "image/jpeg")) {
      await handleFileUpload(file);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // For pinch-to-zoom gestures
      const delta = -e.deltaY * 0.01;
      handleZoom(delta, e.clientX, e.clientY);
    } else {
      // Regular scrolling for pan
      setEditorState((prev) => ({
        ...prev,
        position: {
          x: prev.position.x - e.deltaX,
          y: prev.position.y - e.deltaY,
        },
      }));
    }
  };

  const handleZoomStart = (e: React.MouseEvent) => {
    if (e.altKey) {
      // Use Alt key as a modifier for zoom mode
      e.preventDefault();
      setZoomState({
        isZooming: true,
        startY: e.clientY,
        lastScale: editorState.scale,
      });
    }
  };

  const handleZoomMove = (e: React.MouseEvent) => {
    if (zoomState.isZooming) {
      e.preventDefault();
      const deltaY = (zoomState.startY - e.clientY) * 0.01;
      const newScale = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, zoomState.lastScale + deltaY),
      );

      // Calculate zoom center point (use mouse position)
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        const centerX = e.clientX;
        const centerY = e.clientY;

        // Update scale with proper center point
        setEditorState((prev) => {
          // Calculate the point we're zooming into in the image's coordinate space
          const zoomPointX = (centerX - prev.position.x) / prev.scale;
          const zoomPointY = (centerY - prev.position.y) / prev.scale;

          // Calculate new position to maintain zoom point
          const newPosX = centerX - zoomPointX * newScale;
          const newPosY = centerY - zoomPointY * newScale;

          return {
            ...prev,
            scale: newScale,
            containerScale: newScale,
            position: { x: newPosX, y: newPosY },
          };
        });
      }
    }
  };

  const handleZoomEnd = () => {
    if (zoomState.isZooming) {
      setZoomState((prev) => ({
        ...prev,
        isZooming: false,
      }));
    }
  };

  // Add this new function to calculate grid size:
  const calculateGridSize = (scale: number): number => {
    const baseSize = GRID_BASE_SIZE;
    // Adjust grid size based on zoom level
    if (scale < 0.5) return baseSize * 4;
    if (scale < 1) return baseSize * 2;
    if (scale > 2) return baseSize / 2;
    return baseSize;
  };

  const handleZoom = (delta: number, centerX?: number, centerY?: number) => {
    if (!containerRef.current) return;

    const ZOOM_FACTOR = 0.1; // Smaller value for smoother zoom
    const container = containerRef.current.getBoundingClientRect();

    setEditorState((prev) => {
      // Calculate new scale with smooth interpolation
      const scaleDelta = delta * ZOOM_FACTOR * prev.scale;
      const newScale = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, prev.scale + scaleDelta),
      );

      // Use provided center point or container center
      const zoomCenterX = centerX ?? container.width / 2;
      const zoomCenterY = centerY ?? container.height / 2;

      // Calculate the point we're zooming into in the image's coordinate space
      const zoomPointX = (zoomCenterX - prev.position.x) / prev.scale;
      const zoomPointY = (zoomCenterY - prev.position.y) / prev.scale;

      // Calculate new position to maintain zoom point
      const newPosX = zoomCenterX - zoomPointX * newScale;
      const newPosY = zoomCenterY - zoomPointY * newScale;

      return {
        ...prev,
        scale: newScale,
        containerScale: newScale,
        position: { x: newPosX, y: newPosY },
      };
    });
  };

  const handlePanStart = (e: React.MouseEvent<HTMLDivElement>) => {
    // If we are in pan mode, do the old pan logic:
    if (isPanMode && e.button === 0) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - editorState.position.x,
        y: e.clientY - editorState.position.y,
      });
    } else {
      // Not in pan mode, start highlighting instead
      if (!containerRef.current) return;
      const bounds = containerRef.current.getBoundingClientRect();
      // mousePos is calculated in handlePanMove, but we can calculate here similarly:
      const newMouseX = (e.clientX - bounds.left) / editorState.containerScale;
      const newMouseY = (e.clientY - bounds.top) / editorState.containerScale;

      setIsHighlighting(true);
      setHighlightStartPos({ x: newMouseX, y: newMouseY });
      setHighlightCurrentPos({ x: newMouseX, y: newMouseY });
    }
  };

  const handleViewModeChange = (newMode: "2D" | "3D") => {
    setViewMode(newMode);
    // Clear elements when switching to 3D mode
    if (newMode === "3D") {
      setElements([]);
    }
  };

  const handlePanMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanMode && isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      setEditorState((prev) => ({
        ...prev,
        position: { x: newX, y: newY },
      }));
    }

    if (containerRef.current) {
      const bounds = containerRef.current.getBoundingClientRect();
      const newMouseX = (e.clientX - bounds.left) / editorState.containerScale;
      const newMouseY = (e.clientY - bounds.top) / editorState.containerScale;
      setMousePos({ x: newMouseX, y: newMouseY });
      setMouseScreenPos({ x: e.clientX, y: e.clientY });

      // If we are highlighting, update the highlightCurrentPos
      if (isHighlighting && highlightStartPos) {
        setHighlightCurrentPos({ x: newMouseX, y: newMouseY });
      }
    }
  };

  const handlePanEnd = () => {
    if (isPanMode) {
      setIsDragging(false);
    }

    if (isHighlighting) {
      // finalize highlight here if needed
      setIsHighlighting(false);
      // For now, we just stop highlighting. You can handle the selected area if desired.
    }
  };

  const handleRotation = (degrees: number) => {
    setEditorState((prev) => ({
      ...prev,
      rotation: (prev.rotation + degrees) % 360,
    }));
  };

  const handleAlign = (direction: "horizontal" | "vertical") => {
    if (!containerRef.current || !editorState.layout.url) return;

    const container = containerRef.current.getBoundingClientRect();
    const newPosition = { ...editorState.position };

    if (direction === "horizontal") {
      newPosition.x =
        (container.width -
          (editorState.layout.originalWidth || 0) * editorState.scale) /
        2;
    } else {
      newPosition.y =
        (container.height -
          (editorState.layout.originalHeight || 0) * editorState.scale) /
        2;
    }

    setEditorState((prev) => ({
      ...prev,
      position: newPosition,
    }));
  };

  const addElement = async (type: ARElement["type"] | "shape" | "media") => {
    try {
      const newElement: ARElement = {
        id: `element-${Date.now()}`,
        type,
        position: { x: 50, y: 50 },
        content: {
          title: `New ${type}`,
          description: "Description here",
          trigger: "click",
        },
      };

      // Then sync with Firebase BEFORE adding to local state
      let anchorId;
      if (blueprintId) {
        const hostId = "2EVim3RYhrgtP3KOKV2UykjXfqs2"; // Get this from your auth context
        anchorId = await syncElementWithFirebase(
          newElement,
          blueprintId,
          hostId,
        );
      }

      // Add to local state with anchorId
      const elementWithAnchor = {
        ...newElement,
        anchorId, // Add the anchorId from Firebase
      };

      setElements((prev) => [...prev, elementWithAnchor]);
      setSelectedElement(elementWithAnchor);
    } catch (error) {
      console.error("Error adding element:", error);
      toast({
        title: "Error",
        description: "Failed to add element. Please try again.",
        variant: "destructive",
      });
      throw error; // Re-throw to ensure error is handled properly
    }
  };

  // Also update your updateElementPosition function
  const updateElementPosition = async (id: string, position: Position) => {
    try {
      // Find the element to update
      const element = elements.find((el) => el.id === id);
      if (!element) return;

      // Update local state
      setElements((prev) =>
        prev.map((el) => (el.id === id ? { ...el, position } : el)),
      );

      // Update Firebase if we have an anchorId and blueprintId
      if (element.anchorId && blueprintId) {
        await updateAnchorInFirebase(
          { ...element, position },
          element.anchorId,
          blueprintId,
        );
      }
    } catch (error) {
      console.error("Error updating element position:", error);
      toast({
        title: "Error",
        description: "Failed to update element position. Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateElementContent = async (
    id: string,
    content: Partial<ElementContent>,
  ) => {
    try {
      // Find the element to update
      const updatedElement = elements.find((el) => el.id === id);
      if (!updatedElement) return;

      const newContent = { ...updatedElement.content, ...content };

      // Update both states atomically
      setElements((prev) =>
        prev.map((el) => (el.id === id ? { ...el, content: newContent } : el)),
      );

      setSelectedElement((prev) =>
        prev?.id === id ? { ...prev, content: newContent } : prev,
      );

      // Update Firebase if we have an anchorId and blueprintId
      if (updatedElement.anchorId && blueprintId) {
        await updateAnchorInFirebase(
          { ...updatedElement, content: newContent },
          updatedElement.anchorId,
          blueprintId,
        );
      }
    } catch (error) {
      console.error("Error updating element content:", error);
      toast({
        title: "Error",
        description: "Failed to update element content. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDuplicateElement = (element: ARElement) => {
    const newElement = {
      ...element,
      id: `element-${Date.now()}`,
      position: {
        x: element.position.x + 5,
        y: element.position.y + 5,
      },
    };
    setElements((prev) => [...prev, newElement]);
  };

  const handleDeleteElement = async (elementId: string) => {
    try {
      const element = elements.find((el) => el.id === elementId);
      if (element && blueprintId) {
        const anchorId = element.anchorId; // You'll need to add this to your element type
        if (anchorId) {
          await deleteAnchorFromFirebase(anchorId, blueprintId);
        }
      }

      setElements((prev) => prev.filter((el) => el.id !== elementId));
      setSelectedElement(null);
    } catch (error) {
      console.error("Error deleting element:", error);
      toast({
        title: "Error",
        description: "Failed to delete element. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleLayerOrder = (
    elementId: string,
    direction: "forward" | "backward",
  ) => {
    setElements((prev) => {
      const index = prev.findIndex((el) => el.id === elementId);
      if (index === -1) return prev;

      const newElements = [...prev];
      const element = newElements[index];

      if (direction === "forward" && index < newElements.length - 1) {
        newElements.splice(index, 1);
        newElements.splice(index + 1, 0, element);
      } else if (direction === "backward" && index > 0) {
        newElements.splice(index, 1);
        newElements.splice(index - 1, 0, element);
      }

      return newElements;
    });
  };

  const saveLayout = () => {
    if (!editorState.layout.url) {
      toast({
        title: "No layout",
        description: "Please upload a floor plan before saving.",
        variant: "destructive",
      });
      return;
    }

    try {
      localStorage.setItem(
        "blueprint-layout",
        JSON.stringify({
          elements,
          layout: editorState.layout,
        }),
      );
      toast({
        title: "Layout Saved",
        description: "Your AR element layout has been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save layout. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Add a helper to generate unique IDs for messages if you don't have one:
  function generateMessageId() {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  // // Replace your handleSendMessage function with this one
  // const handleSendMessage = useCallback(async () => {
  //   if (!input.trim()) return;

  //   const userMessageId = generateMessageId();
  //   const userMessage = {
  //     id: userMessageId,
  //     content: input,
  //     isAi: false,
  //     isImage: false,
  //   };
  //   setMessages((prev) => [...prev, userMessage]);
  //   setInput("");

  //   if (/I want a sign that says/i.test(userMessage.content)) {
  //     setGeneratingImage(true);
  //     const loadingId = generateMessageId();
  //     const loadingMessage = {
  //       id: loadingId,
  //       content: "Generating image...",
  //       isAi: true,
  //       isImage: false,
  //       isLoading: true, // ADD THIS LINE
  //     };
  //     setMessages((prev) => [...prev, loadingMessage]);

  //     try {
  //       const hiveResponse = await fetch(
  //         "https://api.thehive.ai/api/v3/hive/sdxl-enhanced",
  //         {
  //           method: "POST",
  //           headers: {
  //             accept: "application/json",
  //             authorization: "Bearer ", //zWgw8Jzre3zOXmAnNcbTa1fNJX7LRPc2
  //             "Content-Type": "application/json",
  //           },
  //           body: JSON.stringify({
  //             input: {
  //               prompt: userMessage.content,
  //               negative_prompt: "realistic",
  //               image_size: { width: 1024, height: 1024 },
  //               guidance_scale: 5,
  //               num_images: 1,
  //               seed: -1,
  //               output_format: "jpeg",
  //             },
  //           }),
  //         },
  //       );
  //       const hiveData = await hiveResponse.json();
  //       if (
  //         hiveData &&
  //         hiveData.output &&
  //         hiveData.output[0] &&
  //         hiveData.output[0].url
  //       ) {
  //         const imageUrl = hiveData.output[0].url;
  //         const imageMessage = {
  //           id: generateMessageId(),
  //           content: imageUrl,
  //           isAi: true,
  //           isImage: true,
  //         };
  //         setMessages((prev) =>
  //           prev.filter((m) => m.id !== loadingId).concat(imageMessage),
  //         );
  //       } else {
  //         const errorMessage = {
  //           id: generateMessageId(),
  //           content: "Sorry, I couldn't generate the image.",
  //           isAi: true,
  //           isImage: false,
  //         };
  //         setMessages((prev) =>
  //           prev.filter((m) => m.id !== loadingId).concat(errorMessage),
  //         );
  //       }
  //     } catch (error) {
  //       const errorMessage = {
  //         id: generateMessageId(),
  //         content: "There was an error generating the image.",
  //         isAi: true,
  //         isImage: false,
  //       };
  //       setMessages((prev) =>
  //         prev.filter((m) => m.id !== loadingId).concat(errorMessage),
  //       );
  //     }
  //   } else {
  //     try {
  //       const response = await fetch(
  //         "https://api.openai.com/v1/chat/completions",
  //         {
  //           method: "POST",
  //           headers: {
  //             "Content-Type": "application/json",
  //             Authorization: "Bearer ", //const mySecret = process.env['OpenAIKey']
  //           },
  //           body: JSON.stringify({
  //             model: "gpt-4o-mini",
  //             messages: [
  //               ...messages
  //                 .filter((m) => !m.isAi)
  //                 .map((m) => ({ role: "user", content: m.content })),
  //               { role: "user", content: input },
  //             ],
  //           }),
  //         },
  //       );

  //       const data = await response.json();
  //       if (data && data.choices && data.choices.length > 0) {
  //         const aiMessage = {
  //           id: generateMessageId(),
  //           content: data.choices[0].message.content.trim(),
  //           isAi: true,
  //           isImage: false,
  //         };
  //         setMessages((prev) => [...prev, aiMessage]);
  //       } else {
  //         const errorMessage = {
  //           id: generateMessageId(),
  //           content: "Sorry, I couldn't understand your request.",
  //           isAi: true,
  //           isImage: false,
  //         };
  //         setMessages((prev) => [...prev, errorMessage]);
  //       }
  //     } catch (error) {
  //       const errorMessage = {
  //         id: generateMessageId(),
  //         content: "There was an error processing your request.",
  //         isAi: true,
  //         isImage: false,
  //       };
  //       setMessages((prev) => [...prev, errorMessage]);
  //     }
  //   }
  // }, [input, promptInput, messages]);

  // Modify your handleSendMessage function to include command processing
  const handleSendMessage = useCallback(async () => {
    if (!input.trim()) return;

    const userMessageId = generateMessageId();
    const userMessage = {
      id: userMessageId,
      content: input,
      isAi: false,
      isImage: false,
    };
    setMessages((prev) => [...prev, userMessage]);

    // Check for editor commands
    const command = parseEditorCommand(input);
    if (command) {
      // Execute the command
      await executeEditorCommand(command);

      // Add AI confirmation message
      const confirmationMessage = {
        id: generateMessageId(),
        content: `I've ${command.action}ed the ${command.elementType} to your Blueprint. You can now customize it in the properties panel.`,
        isAi: true,
        isImage: false,
      };
      setMessages((prev) => [...prev, confirmationMessage]);

      setInput("");
      return;
    }

    // Rest of your existing handleSendMessage logic...
  }, [input, selectedElement]);

  // In your message rendering code where you map over messages:
  <div className="h-[300px] overflow-y-auto p-4 space-y-4 border rounded-md mt-4">
    {messages.map((msg) => (
      <div
        key={msg.id}
        className={`flex ${msg.isAi ? "justify-start" : "justify-end"}`}
      >
        <div
          className={`rounded-lg p-3 max-w-[80%] ${
            msg.isAi
              ? "bg-secondary text-secondary-foreground"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {msg.isImage ? ( // Check if it's an image message
            <img
              src={msg.content}
              alt="Generated"
              className="max-w-full h-auto rounded"
            />
          ) : (
            msg.content
          )}
        </div>
      </div>
    ))}
  </div>;

  // Load saved layout from localStorage on mount
  useEffect(() => {
    const savedLayout = localStorage.getItem("blueprint-layout");
    if (savedLayout) {
      try {
        const { elements: savedElements, layout } = JSON.parse(savedLayout);
        setElements(savedElements);
        setEditorState((prev) => ({
          ...prev,
          layout,
        }));
      } catch (error) {
        console.error("Error loading saved layout:", error);
      }
    }
  }, []);

  useEffect(() => {
    if (!blueprintId) return;

    const loadBlueprint = async () => {
      setLoading(true);
      try {
        const blueprintRef = doc(db, "blueprints", blueprintId);
        const blueprintSnap = await getDoc(blueprintRef);

        if (blueprintSnap.exists()) {
          const blueprintData = blueprintSnap.data();

          // Only load AR elements if we're in 2D mode
          if (viewMode === "2D") {
            console.log("Loading AR elements for blueprint:", blueprintId);
            const arElements = await loadBlueprintAnchors(blueprintId);
            console.log("Loaded AR elements:", arElements);

            if (arElements.length > 0) {
              setElements(arElements);
            } else {
              setElements([]);
            }
          }

          // Update editor state based on view mode
          if (viewMode === "2D" && blueprintData.floorPlanUrl) {
            // Load 2D floor plan ONLY IF floorPlanUrl exists
            const img = new Image();
            img.onload = () => {
              const containerWidth = containerRef.current?.clientWidth || 800;
              const containerHeight = containerRef.current?.clientHeight || 600;
              const scale = Math.min(
                containerWidth / img.width,
                containerHeight / img.height,
              );

              setEditorState((prev) => ({
                ...prev,
                layout: {
                  url: blueprintData.floorPlanUrl,
                  url3D: blueprintData.floorPlan3DUrl,
                  name: blueprintData.name || "FloorPlan",
                  aspectRatio: img.width / img.height,
                  originalWidth: img.width,
                  originalHeight: img.height,
                },
                scale: scale,
                containerScale: scale,
                position: {
                  x: (containerWidth - img.width * scale) / 2,
                  y: (containerHeight - img.height * scale) / 2,
                },
                isPlacementMode: true,
              }));
            };
            img.src = blueprintData.floorPlanUrl;
          } else if (viewMode === "3D") {
            return (
              <div className="absolute inset-0 flex items-center justify-center">
                {editorState.layout.url3D ? (
                  <ErrorBoundary fallback={<div>Error loading 3D model</div>}>
                    <ModelViewer modelUrl={editorState.layout.url3D} />
                  </ErrorBoundary>
                ) : (
                  <FileUpload
                    onFileSelect={handle3DFileUpload}
                    loading={isLoading}
                    show3DUpload
                    blueprintId={blueprintId}
                  />
                )}
              </div>
            );
          } else if (viewMode === "2D" && !blueprintData.floorPlanUrl) {
            // Reset the layout if no floorPlanUrl
            setEditorState((prev) => ({
              ...prev,
              layout: {
                url: "",
                url3D: "",
                name: "",
                aspectRatio: 1,
                originalWidth: 0,
                originalHeight: 0,
              },
              scale: 1,
              containerScale: 1,
              position: { x: 0, y: 0 },
              isPlacementMode: false,
            }));
          }
        }
      } catch (error) {
        console.error("Error in loadBlueprint:", error);
        toast({
          title: "Error",
          description: "Failed to load blueprint data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadBlueprint();
  }, [blueprintId, viewMode]); // Add viewMode as a dependency

  // Function to trigger analysis manually or automatically
  const triggerAnalysis = useCallback(async () => {
    if (!editorState.layout.url || isAnalyzing) return;

    try {
      setIsAnalyzing(true);
      await analyzeFloorPlanWithGemini(editorState.layout.url);
    } catch (error) {
      console.error("Error analyzing floor plan:", error);
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze the floor plan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [editorState.layout.url, isAnalyzing]);

  // Only trigger analysis once when floor plan is first loaded
  useEffect(() => {
    if (editorState.layout.url && !isAnalyzing) {
      const analyzeFloorPlan = async () => {
        try {
          setIsAnalyzing(true);
          const base64Image = await convertImageToBase64(
            editorState.layout.url,
          );
          if (!base64Image)
            throw new Error("Failed to convert image to base64");

          const response = await fetch(
            "https://generativelanguage.googleapis.com/v1/models/gemini-pro-vision:generateContent",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: "Analyze this floor plan and provide insights about the layout, potential hotspots, and suggestions for improvement. Focus on spatial organization, traffic flow, and areas that could benefit from AR enhancements.",
                      },
                      {
                        inline_data: {
                          mime_type: "image/jpeg",
                          data: base64Image,
                        },
                      },
                    ],
                  },
                ],
              }),
            },
          );

          if (!response.ok) {
            throw new Error(
              "Gemini analysis request failed: " + response.statusText,
            );
          }

          const analysisData = await response.json();
          const analysis = analysisData.candidates[0].content.parts[0].text;
          setGeminiAnalysis(analysis);
          toast({
            title: "Analysis Complete",
            description: "Floor plan analysis has been generated successfully.",
          });
        } catch (error) {
          console.error("Floor plan analysis error:", error);
          toast({
            title: "Analysis Failed",
            description: "Failed to analyze the floor plan. Please try again.",
            variant: "destructive",
          });
        } finally {
          setIsAnalyzing(false);
        }
      };

      analyzeFloorPlan();
    }
  }, [editorState.layout.url]); // Only depend on layout URL

  // ADD THIS FUNCTION inside your BlueprintEditor component, before return:
  async function analyzeFloorPlanWithGemini(floorPlanUrl: string) {
    if (!floorPlanUrl) return;
    setIsAnalyzing(true);
    try {
      const base64Image = await convertImageToBase64(floorPlanUrl);
      if (!base64Image) throw new Error("Failed to convert image to base64");

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1/models/gemini-1-vision:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: "Analyze this floor plan and provide insights about the layout, potential hotspots, and suggestions for improvement. Focus on spatial organization, traffic flow, and areas that could benefit from AR enhancements.",
                  },
                  {
                    inline_data: {
                      mime_type: "image/jpeg",
                      data: base64Image,
                    },
                  },
                ],
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          "Gemini analysis request failed: " + response.statusText,
        );
      }

      const analysisData = await response.json();
      const analysis = analysisData.candidates[0].content.parts[0].text;
      setGeminiAnalysis(analysis);
      toast({
        title: "Analysis Complete",
        description: "Floor plan analysis has been generated successfully.",
      });
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Analysis Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to analyze floor plan",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function convertImageToBase64(
    imageUrl: string,
  ): Promise<string | null> {
    try {
      // For Firebase Storage URLs, we need to fetch with no-cors
      const response = await fetch(imageUrl, {
        mode: "no-cors",
        cache: "no-cache",
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      });

      if (!response.ok) {
        console.error("Response not ok:", response.status, response.statusText);
        throw new Error("Failed to fetch image: " + response.statusText);
      }

      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result && typeof reader.result === "string") {
            // Get the base64 data after the "base64," marker
            const base64Data = reader.result.split(",")[1];
            resolve(base64Data);
          } else {
            reject(new Error("Failed to convert to base64"));
          }
        };
        reader.onerror = (error) => {
          console.error("FileReader error:", error);
          reject(new Error("Failed to read image file"));
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error converting image to base64:", error);
      toast({
        title: "Image Processing Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to process the floor plan image",
        variant: "destructive",
      });
      return null;
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Nav />
      <div className="pt-16 flex h-[calc(100vh-4rem)]">
        {/* Analysis Results Panel */}
        {(isAnalyzing || geminiAnalysis) && (
          <div className="fixed top-20 right-4 w-96 bg-white rounded-lg shadow-lg p-4 z-50">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-lg">Floor Plan Analysis</h3>
              {!isAnalyzing && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setGeminiAnalysis(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {isAnalyzing ? (
              <div className="flex items-center justify-center space-x-2 p-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm text-gray-600">
                  Analyzing floor plan...
                </span>
              </div>
            ) : geminiAnalysis ? (
              <div className="space-y-4">
                <div className="prose prose-sm max-h-96 overflow-y-auto">
                  {geminiAnalysis}
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setGeminiAnalysis(null);
                      triggerAnalysis();
                    }}
                    disabled={isAnalyzing}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Analyze Again
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Fixed Bottom-Right Buttons */}
        <div className="fixed bottom-4 right-4 z-50 flex gap-2">
          <ScreenShareButton />
          <Button
            variant="outline"
            size="icon"
            className="rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-blue-600 text-white"
            onClick={() => setIsChatOpen(true)}
          >
            <MessageCircle className="h-6 w-6" />
          </Button>
        </div>

        {/* Floating Chat Box */}
        {isChatOpen && (
          <div className="fixed bottom-20 right-4 bg-white rounded shadow p-4 w-80 z-50">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <h3 className="text-lg font-semibold">Blueprint Editor AI</h3>
                <p className="text-sm text-gray-500">
                  How can I help you with your Blueprint today?
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsChatOpen(false)}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M6 18L18 6M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </Button>
            </div>
            <div className="h-[300px] overflow-y-auto p-4 space-y-4 border rounded-md mt-4">
              {messages.map(
                (
                  msg, // Correct key usage
                ) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.isAi ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`rounded-lg p-3 max-w-[80%] ${
                        msg.isAi
                          ? "bg-secondary text-secondary-foreground"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ),
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              />
              <Button size="icon" onClick={handleSendMessage}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Tools Sidebar */}
        <div
          className="w-64 bg-white/95 backdrop-blur-sm border-r p-4 fixed top-16 left-0 bottom-0 overflow-y-auto shadow-lg z-[100] transition-all duration-200 ease-in-out pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Elements</h2>

            {/* Search Bar */}
            <div className="relative">
              <Input
                type="text"
                placeholder="Search elements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
              <Search className="absolute right-2 top-2 h-5 w-5 text-gray-400" />
            </div>

            {/* Categories */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Categories</h3>
              <Button
                onClick={() => setSelectedCategory("all")}
                className={`w-full justify-start ${selectedCategory === "all" ? "bg-primary text-white" : "bg-white"}`}
                variant="outline"
              >
                All Elements
              </Button>
              <Button
                onClick={() => setSelectedCategory("infoCard")}
                className={`w-full justify-start ${selectedCategory === "infoCard" ? "bg-primary text-white" : "bg-white"}`}
                variant="outline"
              >
                Info Cards
              </Button>
              <Button
                onClick={() => setSelectedCategory("marker")}
                className={`w-full justify-start ${selectedCategory === "marker" ? "bg-primary text-white" : "bg-white"}`}
                variant="outline"
              >
                Markers
              </Button>
              <Button
                onClick={() => setSelectedCategory("interactive")}
                className={`w-full justify-start ${selectedCategory === "interactive" ? "bg-primary text-white" : "bg-white"}`}
                variant="outline"
              >
                Interactive Elements
              </Button>

              <Button
                onClick={() => setSelectedCategory("media")}
                className={`w-full justify-start ${selectedCategory === "media" ? "bg-primary text-white" : "bg-white"}`}
                variant="outline"
              >
                Media
              </Button>
              <Button
                onClick={() => setSelectedCategory("labels")}
                className={`w-full justify-start ${selectedCategory === "labels" ? "bg-primary text-white" : "bg-white"}`}
                variant="outline"
              >
                Labels
              </Button>
            </div>

            {/* Elements List */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Elements</h3>
              <div className="grid grid-cols-2 gap-2">
                {filteredElements.map((elementType) => (
                  <div
                    key={elementType.id}
                    className="flex flex-col items-center justify-center p-2 border rounded cursor-pointer hover:bg-gray-100"
                    onClick={() => addElement(elementType.type)}
                  >
                    {elementType.icon}
                    <span className="text-xs mt-1 text-center">
                      {elementType.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* View Options */}
            <div className="space-y-2 mt-4">
              <h3 className="text-sm font-medium">View Options</h3>
              <Button
                onClick={() => setShowGrid(!showGrid)}
                className="w-full justify-start"
                variant={showGrid ? "default" : "outline"}
              >
                <Grid className="w-4 h-4 mr-2" />
                Show Grid
              </Button>
              <Button
                onClick={() => setIsPanMode(!isPanMode)}
                className="w-full justify-start"
                variant={isPanMode ? "default" : "outline"}
              >
                <Hand className="w-4 h-4 mr-2" />
                Pan Tool
              </Button>
            </div>

            {/* Actions */}
            <div className="space-y-2 mt-4">
              <h3 className="text-sm font-medium">Actions</h3>
              <Button
                onClick={saveLayout}
                className="w-full justify-start"
                disabled={!editorState.layout.url}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Layout
              </Button>
            </div>
          </div>
        </div>

        {/* Main Editor Area */}
        <div
          className={`flex-1 relative ml-64 min-h-[calc(100vh-4rem)] isolate ${isPanMode ? "cursor-grab" : ""} ${
            isDragging ? "cursor-grabbing" : ""
          } ${editorState.isPlacementMode ? "ring-2 ring-primary ring-opacity-50" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onMouseDown={zoomState.isZooming ? handleZoomStart : handlePanStart}
          onMouseMove={zoomState.isZooming ? handleZoomMove : handlePanMove}
          onMouseUp={zoomState.isZooming ? handleZoomEnd : handlePanEnd}
          onMouseLeave={zoomState.isZooming ? handleZoomEnd : handlePanEnd}
          onWheel={handleWheel}
          onContextMenu={(e: MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            if (!containerRef.current) return;

            const containerBounds =
              containerRef.current.getBoundingClientRect();

            // Calculate position relative to container taking into account scroll position
            const x = e.clientX - containerBounds.left;
            const y = e.clientY - containerBounds.top;

            // Set the prompt position in screen coordinates
            setPromptPosition({
              x: x + containerBounds.left,
              y: y + containerBounds.top,
            });
            setShowAiPrompt(true);
          }}
          ref={containerRef}
        >
          {editorState.layout.url && (
            <ViewModeToggle
              mode={viewMode}
              onChange={handleViewModeChange}
              has3DModel={!!editorState.layout.url3D}
            />
          )}

          {viewMode === "2D" ? (
            <>
              <div
                className={`absolute top-0 left-0 ${showGrid ? "bg-grid-pattern" : ""}`}
                style={{
                  width: `${editorState.layout.originalWidth * editorState.scale}px`,
                  height: `${editorState.layout.originalHeight * editorState.scale}px`,
                  transform: `translate(${editorState.position.x}px, ${editorState.position.y}px) scale(${editorState.containerScale})`,
                  transformOrigin: "center",
                  transition: isDragging ? "none" : "transform 0.1s ease-out",
                  zIndex: 0,
                }}
              >
                {editorState.layout.url && (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ zIndex: 1 }}
                  >
                    <img
                      src={editorState.layout.url}
                      alt="Store Layout"
                      className="w-auto h-auto max-w-none"
                      style={{ transformOrigin: "center center" }}
                    />
                  </div>
                )}

                {elements.map((element) => (
                  <motion.div
                    key={element.id}
                    className={`absolute cursor-move p-4 rounded-lg group ${selectedElement?.id === element.id ? "ring-2 ring-blue-500" : ""}`}
                    style={{
                      left: `${element.position.x}%`,
                      top: `${element.position.y}%`,
                      transform: "translate(-50%, -50%)",
                      zIndex: 2,
                    }}
                    drag
                    dragMomentum={false}
                    onDragEnd={(event, info) => {
                      if (containerRef.current) {
                        const bounds =
                          containerRef.current.getBoundingClientRect();
                        const newPosition = {
                          x:
                            ((event.clientX - bounds.left) / bounds.width) *
                            100,
                          y:
                            ((event.clientY - bounds.top) / bounds.height) *
                            100,
                        };
                        handleDragEnd(element.id, newPosition);
                      }
                    }}
                    onDoubleClick={() => setSelectedElement(element)}
                    initial={{ scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <div className="bg-gradient-to-br from-gray-700 to-gray-800 text-white rounded-xl p-4 relative transition-all duration-200 shadow-lg group-hover:shadow-xl">
                      <div className="text-sm font-medium flex items-center gap-2">
                        {element.content.title}
                        <Pencil className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-white" />
                      </div>
                      <div className="text-xs text-white/80">
                        {element.type}
                      </div>
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-75 transition-opacity pointer-events-none whitespace-nowrap">
                        Double-tap to edit
                      </div>
                    </div>
                  </motion.div>
                ))}

                {!editorState.layout.url && !isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FileUpload
                      onFileSelect={handleFileUpload}
                      onFile3DSelect={handle3DFileUpload}
                      loading={isLoading}
                      show3DUpload
                      blueprintId={blueprintId} // Add this prop
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="absolute inset-0 flex items-center justify-center">
                {editorState.layout.url3D ? (
                  <div className="w-full h-full">
                    <model-viewer
                      src={editorState.layout.url3D}
                      alt="3D Floor Plan"
                      camera-controls
                      auto-rotate
                      style={{ width: "100%", height: "100%" }}
                    />
                  </div>
                ) : (
                  <FileUpload
                    onFileSelect={handle3DFileUpload}
                    loading={isLoading}
                    show3DUpload
                    blueprintId={blueprintId} // Add this line
                  />
                )}
              </div>
            </>
          )}

          {isLoading && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-white/80"
              style={{ zIndex: 3 }}
            >
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="ml-2">Processing image...</span>
            </div>
          )}

          {/* Placement Mode Button */}

          {showAiPrompt && (
            <motion.div
              style={{
                position: "fixed",
                left: `${promptPosition.x}px`,
                top: `${promptPosition.y}px`,
                zIndex: 9999,
              }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-lg shadow-md p-4 w-80 relative space-y-3"
            >
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2"
                onClick={() => setShowAiPrompt(false)}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M6 18L18 6M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </Button>
              <textarea
                placeholder="What would you like to see here?"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onInput={(e) => {
                  e.currentTarget.style.height = "auto";
                  e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                }}
                rows={1}
                className="w-full px-4 py-3 text-base rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
              />
              {generatingImage ? ( // Conditionally render loading indicator or submit button
                <div className="flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  Generating...
                </div>
              ) : (
                <Button
                  onClick={async () => {
                    setGeneratingImage(true); // Set loading state to true *before* the API call
                    await handleSendMessage();
                    setGeneratingImage(false);
                    setShowAiPrompt(false);
                    setPromptInput("");
                  }}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg px-4 py-2"
                >
                  Submit
                </Button>
              )}
            </motion.div> // Correctly closed motion.div
          )}
        </div>

        {/* Placement Mode Button */}
        {editorState.layout.url && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
            <Button
              variant={editorState.isPlacementMode ? "default" : "secondary"}
              onClick={() =>
                setEditorState((prev) => ({
                  ...prev,
                  isPlacementMode: !prev.isPlacementMode,
                }))
              }
              className="shadow-lg bg-primary text-white hover:bg-primary/90"
              size="lg"
            >
              {editorState.isPlacementMode ? (
                <>
                  <Pencil className="w-4 h-4 mr-2" />
                  Editing Layout
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Place AR Elements
                </>
              )}
            </Button>
          </div>
        )}

        {/* Controls */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 space-x-2 z-[100]">
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm p-2 rounded-lg shadow-lg">
            <div className="space-x-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleZoom(-0.1)}
                title="Zoom Out"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleZoom(0.1)}
                title="Zoom In"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-x-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleRotation(-90)}
                title="Rotate Left"
              >
                <RotateCw className="h-4 w-4 -scale-x-100" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleRotation(90)}
                title="Rotate Right"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-x-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleAlign("horizontal")}
                title="Align Horizontally"
              >
                <AlignStartHorizontal className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleAlign("vertical")}
                title="Align Vertically"
              >
                <AlignStartVertical className="h-4 w-4" />
              </Button>
            </div>

            <Button
              variant={editorState.snapToGrid ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setEditorState((prev) => ({
                  ...prev,
                  snapToGrid: !prev.snapToGrid,
                }))
              }
              className="ml-2"
            >
              <Grid className="h-4 w-4 mr-2" />
              Snap to Grid
            </Button>
          </div>
        </div>

        {/* Properties Panel */}
        <AnimatePresence>
          {selectedElement && (
            <motion.div
              className="w-80 bg-white/95 backdrop-blur-sm border-l p-4 fixed top-16 right-0 bottom-0 shadow-lg z-50 overflow-y-auto"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Element Properties</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={selectedElement.content.title}
                      onChange={(e) =>
                        updateElementContent(selectedElement.id, {
                          title: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={selectedElement.content.description}
                      onChange={(e) =>
                        updateElementContent(selectedElement.id, {
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trigger">Trigger Type</Label>
                    <Select
                      value={selectedElement.content.trigger}
                      onValueChange={(value) =>
                        updateElementContent(selectedElement.id, {
                          trigger: value as "proximity" | "click" | "always",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select trigger type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="click">Click</SelectItem>
                        <SelectItem value="proximity">Proximity</SelectItem>
                        <SelectItem value="always">Always</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedElement.type === "media" && (
                    <div className="space-y-2">
                      <Label>Media Upload</Label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                        {selectedElement.content.mediaUrl ? (
                          <div className="space-y-2">
                            {selectedElement.content.mediaType === "image" ? (
                              <img
                                src={selectedElement.content.mediaUrl}
                                alt="Uploaded media"
                                className="max-w-full h-auto rounded"
                              />
                            ) : (
                              <video
                                src={selectedElement.content.mediaUrl}
                                controls
                                className="max-w-full h-auto rounded"
                              />
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              className="w-full"
                              onClick={() =>
                                updateElementContent(selectedElement.id, {
                                  mediaUrl: undefined,
                                  mediaType: undefined,
                                })
                              }
                            >
                              Remove Media
                            </Button>
                          </div>
                        ) : (
                          <div className="text-center">
                            <Input
                              type="file"
                              accept={
                                selectedElement.type === "image"
                                  ? "image/*"
                                  : "video/*"
                              }
                              className="hidden"
                              id="media-upload"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    const url = await createImageUrl(file);
                                    updateElementContent(selectedElement.id, {
                                      mediaUrl: url,
                                      mediaType: file.type.startsWith("image")
                                        ? "image"
                                        : "video",
                                    });
                                  } catch (error) {
                                    toast({
                                      title: "Upload Failed",
                                      description:
                                        "Failed to upload media. Please try again.",
                                      variant: "destructive",
                                    });
                                  }
                                }
                              }}
                            />
                            <Label
                              htmlFor="media-upload"
                              className="cursor-pointer flex flex-col items-center justify-center gap-2"
                            >
                              <div className="p-2 bg-primary/10 rounded-full">
                                {selectedElement.type === "image" ? (
                                  <ImageIcon className="w-6 h-6 text-primary" />
                                ) : (
                                  <Video className="w-6 h-6 text-primary" />
                                )}
                              </div>
                              <span className="text-sm text-gray-500">
                                Click to upload {selectedElement.type}
                              </span>
                            </Label>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={selectedElement.content.title}
                      onChange={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        updateElementContent(selectedElement.id, {
                          title: e.target.value,
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                      className="focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={selectedElement.content.description}
                      onChange={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        updateElementContent(selectedElement.id, {
                          description: e.target.value,
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                      className="focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Trigger Type</Label>
                    <Select
                      value={selectedElement.content.trigger}
                      onValueChange={(value) =>
                        updateElementContent(selectedElement.id, {
                          trigger: value as "proximity" | "click" | "always",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="proximity">Proximity</SelectItem>
                        <SelectItem value="click">Click</SelectItem>
                        <SelectItem value="always">Always Visible</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label>Position</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">
                            X: {selectedElement.position.x.toFixed(1)}%
                          </Label>
                          <Input
                            type="range"
                            min="0"
                            max="100"
                            value={selectedElement.position.x}
                            onChange={(e) =>
                              updateElementPosition(selectedElement.id, {
                                ...selectedElement.position,
                                x: parseFloat(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs">
                            Y: {selectedElement.position.y.toFixed(1)}%
                          </Label>
                          <Input
                            type="range"
                            min="0"
                            max="100"
                            value={selectedElement.position.y}
                            onChange={(e) =>
                              updateElementPosition(selectedElement.id, {
                                ...selectedElement.position,
                                y: parseFloat(e.target.value),
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Layer Management</Label>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleLayerOrder(selectedElement.id, "forward")
                          }
                          className="flex-1"
                        >
                          <Layers className="h-4 w-4 mr-2" />
                          Bring Forward
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleLayerOrder(selectedElement.id, "backward")
                          }
                          className="flex-1"
                        >
                          <Layers className="h-4 w-4 mr-2 rotate-180" />
                          Send Backward
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Element Actions</Label>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleDuplicateElement(selectedElement)
                          }
                          className="flex-1"
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            handleDeleteElement(selectedElement.id)
                          }
                          className="flex-1"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
