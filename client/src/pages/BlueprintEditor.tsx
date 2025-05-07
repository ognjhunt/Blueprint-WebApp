"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as THREE from "three";
import ThreeViewer from "@/components/ThreeViewer";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import ViewModeToggle from "@/components/ViewModeToggle";
//import WorkflowEditor from "@/components/WorkflowEditor";
import { QRCodeCanvas } from "qrcode.react";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import FeatureConfigHub from "@/components/FeatureConfigScreens";
import { Switch } from "@/components/ui/switch";

// Helper component for audience type effect
interface AudienceTypeEffectProps {
  goal: string;
  audienceType: string | null;
  updateOnboardingData: (field: keyof OnboardingData, value: any) => void;
}

function AudienceTypeEffect({ goal, audienceType, updateOnboardingData }: AudienceTypeEffectProps) {
  useEffect(() => {
    if (goal === "customerEngagement" && !audienceType) {
      updateOnboardingData("audienceType", "customers");
    } else if (goal === "staffTraining" && !audienceType) {
      updateOnboardingData("audienceType", "staff");
    }
  }, [goal, audienceType, updateOnboardingData]);
  
  return null;
}
// Firebase
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db } from "@/lib/firebase";

// UI Components
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider"; // Added Slider import
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";

// Icons
import {
  LayoutDashboard,
  Map,
  Home,
  Box,
  Tag,
  LayoutGrid,
  Settings,
  ChevronRight,
  ChevronDown,
  Search,
  Plus,
  Minus,
  Volume2,
  Check,
  X,
  Ruler,
  Eye,
  EyeOff,
  Grid3X3,
  Save,
  MessageSquare,
  BookmarkIcon,
  Heart,
  CirclePlay,
  LayoutPanelTop,
  Award,
  MousePointer,
  MessageCircle,
  Upload,
  Download,
  Share2,
  Trash2,
  Undo,
  BarChart2,
  Redo,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Maximize,
  Minimize,
  Move,
  RotateCcw,
  PenTool,
  StickyNote,
  Image as ImageIcon,
  Video,
  File,
  PanelLeft,
  PanelRight,
  Layers,
  QrCode,
  Link,
  Target,
  MapPin,
  Type,
  Hand,
  Loader2,
  Circle,
  AlertCircle,
  Info,
  CheckCircle2,
  Square,
  Palette,
  Library,
  Landmark,
  ChevronsUpDown,
  MoreHorizontal,
  UserPlus,
  Zap,
  Users,
  GraduationCap,
  Presentation,
  Calendar,
  Share,
  DollarSign,
  Handshake,
  Star,
  ThumbsUp,
  CircleDollarSign,
  Trophy,
  Clock,
  Accessibility,
  ScanText,
  Gamepad2,
  HelpCircle,
  ArrowRight,
  Compass,
  ShoppingCart,
  PercentCircle,
  Ticket,
  FileText,
  Briefcase,
  Smartphone,
  Coffee,
  Bell,
  Gift,
} from "lucide-react";

// Types
import { MarkedArea } from "@/types/AreaMarkingStyles";

// Define ThreeViewerRef type for ref usage
interface ThreeViewerRef {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
}

// Define TextAnchor type (if not already defined/imported)
interface TextAnchor {
  id: string;
  x: number;
  y: number;
  z: number;
  textContent: string;
  // Add other potential fields like contentType, contentID, createdDate, blueprintID etc.
  contentType?: string;
  contentID?: string;
  createdDate?: any; // Consider using Date or Timestamp type
  blueprintID?: string;
  position?: { x: number; y: number; z: number }; // Handle potential nested position
}

// 🔧 NEW util ---------------------------------------------------------------
/**
 * Returns a normalised file‑type keyword the rest of your code can count on.
 * Looks at `fileInfo.fileType` first (what you saved in Firestore on upload),
 * then falls back to MIME‑type or extension sniffing when that’s missing.
 */
export function getSimpleFileType(fileInfo: {
  fileType?: string;
  type?: string; // MIME
  name?: string; // original filename
}): "image" | "video" | "audio" | "pdf" | "document" {
  // 1️⃣ already classified during upload?
  if (
    fileInfo.fileType &&
    ["image", "video", "audio", "pdf"].includes(fileInfo.fileType)
  )
    return fileInfo.fileType as any;

  // 2️⃣ MIME or extension fallback (covers mp3 ⇒ audio/mpeg, mp4 ⇒ video/mp4 …)
  const mime = fileInfo.type ?? "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/"))
    return "audio"; /* :contentReference[oaicite:0]{index=0} */
  if (mime === "application/pdf") return "pdf";

  // 3️⃣ bare‑bones extension sniff (for cases where browsers drop MIME on drag)
  const ext = (fileInfo.name ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
  if (["mp4", "mov", "webm"].includes(ext)) return "video";
  if (["mp3", "wav", "aac", "flac"].includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";

  return "document"; // ← sensible catch‑all
}

/**
 * Main component for the Blueprint Editor
 * A complete rewrite focused on modern UI/UX and seamless integration with ThreeViewer
 */
export default function BlueprintEditor() {
  // ========================
  // STATE MANAGEMENT
  // ========================

  // Auth and navigation
  const { currentUser } = useAuth();
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showQrCodes, setShowQrCodes] = useState(true);
  const [showTextAnchors, setShowTextAnchors] = useState(true); // New state for Text
  const [showFileAnchors, setShowFileAnchors] = useState(true); // New state for Files (incl. images/videos)
  const [showWebpageAnchors, setShowWebpageAnchors] = useState(true); // New state for Webpages
  const [showModelAnchors, setShowModelAnchors] = useState(true); // New state for 3D Models
  const [location] = useLocation();
  const blueprintId = location.split("/").pop();
  const { toast } = useToast();

  // Onboarding states - ADD THESE
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState(1);
  // Define interfaces for onboarding data
  interface AreaItem {
    id: string;
    name: string;
  }

  // Define typings for onboarding data
  interface OnboardingData {
    goal: string;
    useCases: string[]; // Array of use case identifiers
    audienceType: string;
    keyAreas: (string | AreaItem)[]; // Can be either strings or objects with id and name
    expectedVisitors: string;
    techComfort: string;
    preferredStyle: string;
    specialFeatures: string[]; // Array of special feature identifiers
  }

  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    goal: "",
    useCases: [], // Changed from primaryUseCase (string) to useCases (array)
    audienceType: "",
    keyAreas: [], // Can be either strings or objects with id and name
    expectedVisitors: "",
    techComfort: "moderate",
    preferredStyle: "professional",
    specialFeatures: [],
  });

  // Onboarding pre-filled data - ADD THIS
  const [prefillData, setPrefillData] = useState<any | null>(null);

  // Core view states
  const [viewMode, setViewMode] = useState("3D");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(360);
  const [activePanel, setActivePanel] = useState("elements");
  const [isLoading, setIsLoading] = useState(true);
  const [blueprintTitle, setBlueprintTitle] = useState("");
  const [blueprintStatus, setBlueprintStatus] = useState("pending");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [, setLocation] = useLocation();
  const navigateToDashboard = () => {
    setLocation("/dashboard");
  };
  // 3D viewer states
  const [model3DPath, setModel3DPath] = useState("");
  const [originPoint, setOriginPoint] = useState<any | null>(null);
  const [isChoosingOrigin, setIsChoosingOrigin] = useState(false);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [referencePoints2D, setReferencePoints2D] = useState<any[]>([]);
  const [referencePoints3D, setReferencePoints3D] = useState<any[]>([]);
  const [floorPlanImage, setFloorPlanImage] = useState("");
  const [showGrid, setShowGrid] = useState(true);
  const [markedAreas, setMarkedAreas] = useState<any[]>([]);
  const [selectedArea, setSelectedArea] = useState<any | null>(null); // Add this new state

  const [isMarkingArea, setIsMarkingArea] = useState(false);
  const [pendingArea, setPendingArea] = useState<any | null>(null);
  const [areaName, setAreaName] = useState("");
  const [areaNameDialogOpen, setAreaNameDialogOpen] = useState(false);
  const [remarkingAreaId, setRemarkingAreaId] = useState<string | null>(null);
  // const corner1Ref = useRef(null);
  const [onboardingMode, setOnboardingMode] = useState("fullscreen"); // "fullscreen" or "sidebar"

  // Element states
  // const [activeSection, setActiveSection] = useState(null); // ADDED - Tracks the open Canva-style panel ('text', 'media', '3d', 'uploads', 'webpages', 'areas', 'settings', or null)
  const [elements, setElements] = useState<any[]>([]);
  const [panelWidth, setPanelWidth] = useState(360); // RENAMED from sidebarWidth
  const [selectedElement, setSelectedElement] = useState<any | null>(null);
  const [hoveredElement, setHoveredElement] = useState<any | null>(null);

  const [selectedAnchorData, setSelectedAnchorData] = useState<any | null>(null);

  // Helper once at top of the file (reuse in the other two fixes)
  const getSimpleType = (mime: string) =>
    mime.includes("image")
      ? "image"
      : mime.includes("video")
        ? "video"
        : mime.includes("audio")
          ? "audio"
          : mime.includes("pdf")
            ? "pdf"
            : "document";

  const handleDeleteAnchor = async (anchorId: string, blueprintId: string) => {
    toast({
      title: "Are you sure?",
      description: "Deleting this anchor cannot be undone.",
      variant: "destructive",
      action: (
        <Button
          variant="destructive"
          onClick={async () => {
            try {
              // 1) Delete from Firestore
              await deleteDoc(doc(db, "anchors", anchorId));
              await updateDoc(doc(db, "blueprints", blueprintId), {
                anchorIDs: arrayRemove(anchorId),
              });

              // 2) Remove the anchor from local state arrays so that ThreeViewer cleans up
              setTextAnchors((prev) => prev.filter((a) => a.id !== anchorId));
              setFileAnchors((prev) => prev.filter((a) => a.id !== anchorId));
              setWebpageAnchors((prev) =>
                prev.filter((a) => a.id !== anchorId),
              );
              setQrCodeAnchors((prev) => prev.filter((a) => a.id !== anchorId));
              setModelAnchors((prev) => prev.filter((a) => a.id !== anchorId));

              // 3) Deselect the anchor so that any transform controls or highlighting are removed
              setSelectedAnchorData(null);

              // 4) Show success toast
              toast({
                title: "Anchor Deleted",
                description: "This anchor has been permanently removed.",
                variant: "default",
              });
            } catch (error) {
              console.error("Error deleting anchor:", error);
              toast({
                title: "Deletion Failed",
                description: "Could not delete anchor. Please try again.",
                variant: "destructive",
              });
            }
          }}
        >
          Confirm
        </Button>
      ),
    });
  };

  //const isPanelOpen = activeSection !== null;
  const [elementCategories, setElementCategories] = useState([
    { id: "all", name: "All Elements", icon: <LayoutGrid size={18} /> },
    { id: "text", name: "Text", icon: <Type size={18} /> },
    { id: "image", name: "Image", icon: <ImageIcon size={18} /> },
    { id: "video", name: "Video", icon: <Video size={18} /> },
    { id: "file", name: "Files", icon: <File size={18} /> },
    { id: "webpage", name: "Webpages", icon: <Link size={18} /> },
  ]);
  const [selectedCategory, setSelectedCategory] = useState("all");

  // ADDED: Define sections for the new icon bar
  const sections = [
    { id: "text", name: "Text", icon: <Type size={24} /> },
    { id: "media", name: "Media", icon: <ImageIcon size={24} /> }, // Combined Image & Video
    { id: "3d", name: "3D Content", icon: <Box size={24} /> },
    { id: "webpages", name: "Webpages", icon: <Link size={24} /> },
    { id: "uploads", name: "Uploads", icon: <Upload size={24} /> },
    { id: "separator", type: "separator" }, // Special type for separator
    { id: "areas", name: "Areas", icon: <Square size={24} /> },
    { id: "settings", name: "Settings", icon: <Settings size={24} /> },
  ];

  // Models and assets states
  const [modelAnchors, setModelAnchors] = useState<any[]>([]);
  const [webpageAnchors, setWebpageAnchors] = useState<any[]>([]);
  const [textAnchors, setTextAnchors] = useState<TextAnchor[]>([]);
  const [textContent, setTextContent] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null); // Explicitly type state
  const [editingTextAnchorId, setEditingTextAnchorId] = useState<string | null>(
    null,
  ); // ADDED STAT
  const [editingWebpageAnchorId, setEditingWebpageAnchorId] = useState<
    string | null
  >(null);
  const [editingFileAnchorId, setEditingFileAnchorId] = useState<string | null>(
    null,
  );
  const isPanelOpen = activeSection !== null;
  const [fileAnchors, setFileAnchors] = useState<any[]>([]);
  const [qrCodeAnchors, setQrCodeAnchors] = useState<any[]>([]); // <<< ADD THIS LINE
  const [featuredModels, setFeaturedModels] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [externalUrl, setExternalUrl] = useState("");

  // Text editing states
  const pendingLabelTextRef = useRef("");
  const showTextBoxInputRef = useRef(false);

  // QR code states
  const [qrPlacementMode, setQrPlacementMode] = useState(false);
  const [qrGenerationActive, setQrGenerationActive] = useState(false);
  const [qrGenerationStep, setQrGenerationStep] = useState(0);
  const [qrLocations, setQrLocations] = useState<any[]>([]);
  const [qrAnchorIds, setQrAnchorIds] = useState<string[]>([]);
  const [qrCodeStrings, setQrCodeStrings] = useState<string[]>([]);
  const [currentPlacingIndex, setCurrentPlacingIndex] = useState(0);
  const [qrCodeModalOpen, setQrCodeModalOpen] = useState(false);
  const [qrCodeValue, setQrCodeValue] = useState("");
  const [isBatchPrinting, setIsBatchPrinting] = useState(false);

  const [customArea, setCustomArea] = useState("");

  // Collaboration states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  // Interactive states
  const [isDragging, setIsDragging] = useState(false);
  const [placementMode, setPlacementMode] = useState<{ type: "link" | "file" | "model"; data?: any } | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [activeLabel, setActiveLabel] = useState<"A" | "B" | "C" | null>(null);
  const [awaiting3D, setAwaiting3D] = useState(false);
  const [showAlignmentWizard, setShowAlignmentWizard] = useState(false);
  const [showDistanceDialog, setShowDistanceDialog] = useState(false);
  const [realDistance, setRealDistance] = useState(10);
  const [activeAreaToMark, setActiveAreaToMark] = useState<any | null>(null);
  // Refs
  const containerRef = useRef(null);
  const threeViewerRef = useRef<ThreeViewerRef>(null);
  const sidebarRef = useRef(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelFileInputRef = useRef<HTMLInputElement>(null);
  const corner1Ref = useRef(null);
  const storage = getStorage();

  const [featureConfigStep, setFeatureConfigStep] = useState(0);
  const [currentFeature, setCurrentFeature] = useState(null);
  const [featureConfigData, setFeatureConfigData] = useState({});
  const [showFeatureConfig, setShowFeatureConfig] = useState(false);

  // Add this function to show a success animation when an area is marked
  const showAreaMarkedSuccess = (areaName) => {
    const successElement = document.createElement("div");
    successElement.className = "area-marked-success";
    successElement.innerHTML = `
      <div class="success-content">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="success-icon">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
        <p>${areaName} marked!</p>
      </div>
    `;

    document.body.appendChild(successElement);

    // Add this CSS to your stylesheet
    const style = document.createElement("style");
    style.textContent = `
      .area-marked-success {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(0,0,0,0.7);
        border-radius: 8px;
        color: white;
        padding: 16px 32px;
        z-index: 9999;
        animation: fadeInOut 1.5s forwards;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .success-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .success-icon {
        width: 24px;
        height: 24px;
        color: #10B981;
        animation: checkmark 0.8s cubic-bezier(0.65, 0, 0.45, 1) forwards;
      }

      @keyframes fadeInOut {
        0% { opacity: 0; }
        20% { opacity: 1; }
        80% { opacity: 1; }
        100% { opacity: 0; }
      }

      @keyframes checkmark {
        0% { stroke-dashoffset: 100; }
        100% { stroke-dashoffset: 0; }
      }
    `;
    document.head.appendChild(style);

    // Remove after animation completes
    setTimeout(() => {
      document.body.removeChild(successElement);
    }, 1500);

    // Also show a toast notification
    toast({
      title: "Area Marked Successfully",
      description: `${areaName} has been added to your navigation`,
      variant: "default",
    });

    // Update progress and check if all required areas are marked
    checkAllAreasMarked();
  };

  // Add this function to check if a specific area has been marked
  // Add this function to check if a specific area has been marked
  const isAreaMarked = (area: string | AreaItem) => {
    // Get the area name - handle both string IDs and area objects
    let areaName;
    if (typeof area === "string") {
      areaName = getAreaLabel(area, prefillData?.industry);
    } else if (area && typeof area === "object") {
      areaName = area.name || "";
    } else {
      return false; // Invalid area
    }

    // Check if any marked area matches this name
    return markedAreas.some(
      (markedArea) => markedArea.name.toLowerCase() === areaName.toLowerCase(),
    );
  };

  // Filter marked areas to only include those from navigation configuration
  const getNavigationMarkedAreas = () => {
    if (!onboardingData.keyAreas || onboardingData.keyAreas.length === 0) {
      return [];
    }

    return markedAreas.filter((markedArea) => {
      // Only include areas that match names in the navigation configuration
      return onboardingData.keyAreas.some((area: string | AreaItem) => {
        let areaName;
        if (typeof area === "string") {
          areaName = getAreaLabel(area, prefillData?.industry);
        } else if (area && typeof area === "object") {
          areaName = area.name || "";
        } else {
          return false; // Skip this area
        }

        return markedArea.name.toLowerCase() === areaName.toLowerCase();
      });
    });
  };

  // Check if all required areas have been marked
  // Check if all required areas have been marked
  const checkAllAreasMarked = () => {
    // If there are no key areas defined, consider it done
    if (onboardingData.keyAreas.length === 0) return true;

    // Check if all required key areas have been marked
    const allAreasMarked = onboardingData.keyAreas.every((area) =>
      isAreaMarked(area),
    );

    if (allAreasMarked) {
      toast({
        title: "All Areas Marked!",
        description: "You can now proceed to the next step",
        action: (
          <ToastAction altText="Continue" onClick={nextOnboardingStep}>
            Continue
          </ToastAction>
        ),
        duration: 6000,
      });
    }

    return allAreasMarked;
  };

  // Add this function near the top of your file
  const getUseCasesByIndustry = (industry) => {
    const baseCases = [
      {
        value: "navigation",
        label: "Navigation & Wayfinding",
        icon: <Map className="h-8 w-8 mb-2" />,
        description: "Help visitors find their way around",
      },
      {
        value: "information",
        label: "Product Information",
        icon: <Info className="h-8 w-8 mb-2" />,
        description: "Display details about products",
      },
      {
        value: "engagement",
        label: "Interactive Experiences",
        icon: <Zap className="h-8 w-8 mb-2" />,
        description: "Create fun, engaging activities",
      },
    ];

    // Museum-specific base cases (excluding Product Information)
    const museumBaseCases = [
      {
        value: "navigation",
        label: "Navigation & Wayfinding",
        icon: <Map className="h-8 w-8 mb-2" />,
        description: "Help visitors find their way around",
      },
      {
        value: "engagement",
        label: "Interactive Experiences",
        icon: <Zap className="h-8 w-8 mb-2" />,
        description: "Create fun, engaging activities",
      },
    ];

    // Industry-specific use cases
    const industryCases = {
      retail: [
        {
          value: "promotion",
          label: "Special Offers",
          icon: <BarChart2 className="h-8 w-8 mb-2" />,
          description: "Highlight deals and promotions",
        },
        {
          value: "newArrivals",
          label: "New Arrivals",
          icon: <Tag className="h-8 w-8 mb-2" />,
          description: "Showcase new products",
        },
        {
          value: "inventory",
          label: "Inventory Checking",
          icon: <Layers className="h-8 w-8 mb-2" />,
          description: "Check stock availability",
        },
        {
          value: "loyalty",
          label: "Loyalty Program",
          icon: <Award className="h-8 w-8 mb-2" />,
          description: "Reward repeat customers",
        },
      ],
      restaurant: [
        {
          value: "menu",
          label: "Digital Menu",
          icon: <FileText className="h-8 w-8 mb-2" />,
          description: "Browse dishes and specials",
        },
        {
          value: "reservation",
          label: "Table Reservations",
          icon: <Calendar className="h-8 w-8 mb-2" />,
          description: "Book tables in advance",
        },
        {
          value: "waitlist",
          label: "Wait List Management",
          icon: <Clock className="h-8 w-8 mb-2" />,
          description: "Get notified when table is ready",
        },
        {
          value: "ordering",
          label: "Online Ordering",
          icon: <ShoppingCart className="h-8 w-8 mb-2" />,
          description: "Order directly from your table",
        },
      ],
      office: [
        {
          value: "workspace",
          label: "Workspace Booking",
          icon: <Briefcase className="h-8 w-8 mb-2" />,
          description: "Reserve desks or meeting rooms",
        },
        {
          value: "visitor",
          label: "Visitor Management",
          icon: <UserPlus className="h-8 w-8 mb-2" />,
          description: "Check in guests and visitors",
        },
        {
          value: "facilities",
          label: "Facilities Requests",
          icon: <Trophy className="h-8 w-8 mb-2" />,
          description: "Report issues or request services",
        },
      ],
      hotel: [
        {
          value: "onlineCheckIn",
          label: "Online Check-in",
          icon: <Smartphone className="h-8 w-8 mb-2" />,
          description: "Skip the front desk line",
        },
        {
          value: "amenitiesGuide",
          label: "Amenities Guide",
          icon: <Coffee className="h-8 w-8 mb-2" />,
          description: "Discover hotel facilities",
        },
        {
          value: "roomService",
          label: "Room Service",
          icon: <Bell className="h-8 w-8 mb-2" />,
          description: "Order food and services",
        },
      ],
      museum: [
        {
          value: "exhibits",
          label: "Exhibit Information",
          icon: <LayoutPanelTop className="h-8 w-8 mb-2" />,
          description: "Display details about exhibits",
        },
        {
          value: "audioTours",
          label: "Audio Tours",
          icon: <Volume2 className="h-8 w-8 mb-2" />,
          description: "Provide guided audio experiences",
        },
        {
          value: "membership",
          label: "Membership Info",
          icon: <Award className="h-8 w-8 mb-2" />,
          description: "Details about membership programs",
        },
        {
          value: "education",
          label: "Educational Resources",
          icon: <GraduationCap className="h-8 w-8 mb-2" />,
          description: "Learning materials for visitors",
        },
      ],
    };

    // Common cases for all industries
    const commonCases = [
      {
        value: "reviews",
        label: "Customer Reviews",
        icon: <MessageSquare className="h-8 w-8 mb-2" />,
        description: "Display product reviews",
      },
      {
        value: "events",
        label: "Events & Announcements",
        icon: <Calendar className="h-8 w-8 mb-2" />,
        description: "Promote upcoming events",
      },
      {
        value: "feedback",
        label: "Customer Feedback",
        icon: <MessageCircle className="h-8 w-8 mb-2" />,
        description: "Collect visitor opinions",
      },
    ];

    // Get industry-specific cases or default to retail
    const specificCases = industryCases[industry] || industryCases.retail;

    // Apply special base cases for museum, otherwise use regular base cases
    const applicableBaseCases =
      industry === "museum" ? museumBaseCases : baseCases;

    // Combine appropriate base cases, industry-specific cases, and common cases
    return [...applicableBaseCases, ...specificCases, ...commonCases];
  };

  const NavigationConfig = () => (
    <div className="space-y-5">
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
        <h4 className="font-medium text-blue-800 mb-2 flex items-center">
          <MapPin className="h-4 w-4 mr-1.5" />
          Navigation Style
        </h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-lg border p-3 cursor-pointer hover:border-blue-500 transition-all flex flex-col items-center text-center">
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
              <ArrowRight className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium">Turn-by-turn</span>
            <span className="text-xs text-gray-500 mt-1">
              Step-by-step directions
            </span>
          </div>

          <div className="bg-white rounded-lg border p-3 cursor-pointer hover:border-blue-500 transition-all flex flex-col items-center text-center">
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
              <Map className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium">Map View</span>
            <span className="text-xs text-gray-500 mt-1">Interactive map</span>
          </div>

          <div className="bg-white rounded-lg border p-3 cursor-pointer hover:border-blue-500 transition-all flex flex-col items-center text-center">
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
              <Compass className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium">AR Guide</span>
            <span className="text-xs text-gray-500 mt-1">
              Augmented reality
            </span>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-3">Key Navigation Points</h4>
        <div className="space-y-2 mb-4">
          <div className="flex items-center p-2 bg-gray-50 rounded-md">
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <Home className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Main Entrance</p>
              <p className="text-xs text-gray-500">Default starting point</p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center p-2 bg-gray-50 rounded-md">
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <ShoppingCart className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Checkout Area</p>
              <p className="text-xs text-gray-500">Payment location</p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center p-2 bg-gray-50 rounded-md">
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <HelpCircle className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Customer Service</p>
              <p className="text-xs text-gray-500">Help desk location</p>
            </div>
            <Switch />
          </div>
        </div>

        <Button variant="outline" size="sm" className="w-full">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Custom Location
        </Button>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-3">Navigation Features</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Clock className="h-4 w-4 text-gray-500 mr-2" />
              <Label className="cursor-pointer">Estimated Time</Label>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Ruler className="h-4 w-4 text-gray-500 mr-2" />
              <Label className="cursor-pointer">Distance Indicators</Label>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Accessibility className="h-4 w-4 text-gray-500 mr-2" />
              <Label className="cursor-pointer">Accessibility Routes</Label>
            </div>
            <Switch />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Volume2 className="h-4 w-4 text-gray-500 mr-2" />
              <Label className="cursor-pointer">Voice Guidance</Label>
            </div>
            <Switch />
          </div>
        </div>
      </div>
    </div>
  );

  // For Product Information
  const ProductInfoConfig = () => (
    <div className="space-y-5">
      <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
        <h4 className="font-medium text-indigo-800 mb-2 flex items-center">
          <Info className="h-4 w-4 mr-1.5" />
          Product Information Options
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-lg border p-3 cursor-pointer hover:border-indigo-500 transition-all flex flex-col items-center text-center">
            <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center mb-2">
              <ScanText className="h-6 w-6 text-indigo-600" />
            </div>
            <span className="text-sm font-medium">Scan Products</span>
            <span className="text-xs text-gray-500 mt-1">
              Point device at products
            </span>
          </div>

          <div className="bg-white rounded-lg border p-3 cursor-pointer hover:border-indigo-500 transition-all flex flex-col items-center text-center">
            <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center mb-2">
              <QrCode className="h-6 w-6 text-indigo-600" />
            </div>
            <span className="text-sm font-medium">QR Codes</span>
            <span className="text-xs text-gray-500 mt-1">
              Scan product QR codes
            </span>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-3">Information to Display</h4>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="flex items-center space-x-2">
            <Checkbox id="price" defaultChecked />
            <label htmlFor="price" className="text-sm cursor-pointer">
              Price & Discounts
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="specs" defaultChecked />
            <label htmlFor="specs" className="text-sm cursor-pointer">
              Specifications
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="reviews" defaultChecked />
            <label htmlFor="reviews" className="text-sm cursor-pointer">
              Customer Reviews
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="variants" />
            <label htmlFor="variants" className="text-sm cursor-pointer">
              Product Variants
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="inventory" />
            <label htmlFor="inventory" className="text-sm cursor-pointer">
              Stock Levels
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="related" />
            <label htmlFor="related" className="text-sm cursor-pointer">
              Related Products
            </label>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-3">Data Source</h4>
        <div className="space-y-3">
          <RadioGroup defaultValue="manual">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="manual" id="manual" />
              <Label htmlFor="manual">Manual Entry</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="shopify" id="shopify" />
              <Label htmlFor="shopify">Import from Shopify</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="csv" id="csv" />
              <Label htmlFor="csv">Upload CSV</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="api" id="api" />
              <Label htmlFor="api">API Integration</Label>
            </div>
          </RadioGroup>
        </div>
      </div>
    </div>
  );

  // For Interactive Experiences
  const InteractiveExperiencesConfig = () => (
    <div className="space-y-5">
      <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
        <h4 className="font-medium text-purple-800 mb-2 flex items-center">
          <Zap className="h-4 w-4 mr-1.5" />
          Interactive Experience Types
        </h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-lg border p-3 cursor-pointer hover:border-purple-500 transition-all flex flex-col items-center text-center">
            <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center mb-2">
              <Gamepad2 className="h-6 w-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium">Mini-Games</span>
            <span className="text-xs text-gray-500 mt-1">
              Fun interactive games
            </span>
          </div>

          <div className="bg-white rounded-lg border p-3 cursor-pointer hover:border-purple-500 transition-all flex flex-col items-center text-center">
            <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center mb-2">
              <HelpCircle className="h-6 w-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium">Quizzes</span>
            <span className="text-xs text-gray-500 mt-1">Test knowledge</span>
          </div>

          <div className="bg-white rounded-lg border p-3 cursor-pointer hover:border-purple-500 transition-all flex flex-col items-center text-center">
            <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center mb-2">
              <ScanText className="h-6 w-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium">Scavenger Hunt</span>
            <span className="text-xs text-gray-500 mt-1">
              Find hidden items
            </span>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-3">Engagement Goals</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Time Spent</p>
              <p className="text-xs text-gray-500">
                Target interaction duration
              </p>
            </div>
            <Select defaultValue="medium">
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Brief (1-2m)</SelectItem>
                <SelectItem value="medium">Medium (3-5m)</SelectItem>
                <SelectItem value="long">Extended (5m+)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Difficulty Level</p>
              <p className="text-xs text-gray-500">Challenge complexity</p>
            </div>
            <Select defaultValue="medium">
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Challenging</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Reward Mechanism</p>
              <p className="text-xs text-gray-500">Player incentives</p>
            </div>
            <Select defaultValue="points">
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="points">Points</SelectItem>
                <SelectItem value="badges">Badges</SelectItem>
                <SelectItem value="discounts">Discounts</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-3">Experience Features</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Volume2 className="h-4 w-4 text-gray-500 mr-2" />
              <Label className="cursor-pointer">Sound Effects</Label>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Share2 className="h-4 w-4 text-gray-500 mr-2" />
              <Label className="cursor-pointer">Social Sharing</Label>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Trophy className="h-4 w-4 text-gray-500 mr-2" />
              <Label className="cursor-pointer">Leaderboard</Label>
            </div>
            <Switch />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Users className="h-4 w-4 text-gray-500 mr-2" />
              <Label className="cursor-pointer">Multiplayer</Label>
            </div>
            <Switch />
          </div>
        </div>
      </div>
    </div>
  );

  // For Special Offers
  const SpecialOffersConfig = () => (
    <div className="space-y-5">
      <div className="bg-red-50 p-4 rounded-lg border border-red-100">
        <h4 className="font-medium text-red-800 mb-2 flex items-center">
          <PercentCircle className="h-4 w-4 mr-1.5" />
          Offer Types
        </h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-lg border p-3 cursor-pointer hover:border-red-500 transition-all flex flex-col items-center text-center">
            <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mb-2">
              <PercentCircle className="h-6 w-6 text-red-600" />
            </div>
            <span className="text-sm font-medium">Discounts</span>
            <span className="text-xs text-gray-500 mt-1">Percentage off</span>
          </div>

          <div className="bg-white rounded-lg border p-3 cursor-pointer hover:border-red-500 transition-all flex flex-col items-center text-center">
            <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mb-2">
              <Ticket className="h-6 w-6 text-red-600" />
            </div>
            <span className="text-sm font-medium">Coupons</span>
            <span className="text-xs text-gray-500 mt-1">Special codes</span>
          </div>

          <div className="bg-white rounded-lg border p-3 cursor-pointer hover:border-red-500 transition-all flex flex-col items-center text-center">
            <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mb-2">
              <Gift className="h-6 w-6 text-red-600" />
            </div>
            <span className="text-sm font-medium">Free Gifts</span>
            <span className="text-xs text-gray-500 mt-1">With purchase</span>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-3">Promotion Schedule</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Frequency</p>
              <p className="text-xs text-gray-500">
                How often to rotate offers
              </p>
            </div>
            <Select defaultValue="weekly">
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Targeting</p>
              <p className="text-xs text-gray-500">Who receives offers</p>
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Visitors</SelectItem>
                <SelectItem value="first">First-time</SelectItem>
                <SelectItem value="returning">Returning</SelectItem>
                <SelectItem value="members">Members Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-3">Delivery Method</h4>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox id="popup" defaultChecked />
            <label htmlFor="popup" className="text-sm cursor-pointer">
              Pop-up notification
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="banner" defaultChecked />
            <label htmlFor="banner" className="text-sm cursor-pointer">
              Banner display
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="products" />
            <label htmlFor="products" className="text-sm cursor-pointer">
              On product pages
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="qr" />
            <label htmlFor="qr" className="text-sm cursor-pointer">
              QR code scan
            </label>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-3">Analytics</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <BarChart2 className="h-4 w-4 text-gray-500 mr-2" />
              <Label className="cursor-pointer">Track Offer Performance</Label>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <ShoppingCart className="h-4 w-4 text-gray-500 mr-2" />
              <Label className="cursor-pointer">Track Conversions</Label>
            </div>
            <Switch defaultChecked />
          </div>
        </div>
      </div>
    </div>
  );

  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);

  // Update the FeatureConfigurationPanel component to prioritize feature ordering
  const FeatureConfigurationPanel = () => {
    const selectedFeatures = onboardingData.useCases;

    // Sort features to ensure Navigation is always configured last
    useEffect(() => {
      if (selectedFeatures.includes("navigation")) {
        // Reorder features to put navigation last
        const sortedFeatures = [...selectedFeatures].sort((a, b) => {
          // If 'a' is navigation, it should come after 'b'
          if (a === "navigation") return 1;
          // If 'b' is navigation, it should come after 'a'
          if (b === "navigation") return -1;

          // Secondary priority: place 'exhibits' or 'information' features before others
          const isExhibitA = a.includes("exhibit") || a.includes("information");
          const isExhibitB = b.includes("exhibit") || b.includes("information");

          if (isExhibitA && !isExhibitB) return -1;
          if (!isExhibitA && isExhibitB) return 1;

          // For all other cases, maintain original order
          return 0;
        });

        // Only update if the order is different to avoid infinite loop
        if (
          JSON.stringify(sortedFeatures) !== JSON.stringify(selectedFeatures)
        ) {
          setOnboardingData((prev) => ({
            ...prev,
            useCases: sortedFeatures,
          }));
        }
      }
    }, [selectedFeatures]);

    // Define the current feature being configured
    const currentFeature = selectedFeatures[currentFeatureIndex];

    // Track configured feature data to pass between components
    const [featureConfigStorage, setFeatureConfigStorage] = useState({});

    // Function to save feature configuration data
    const saveFeatureConfig = (featureData) => {
      // Store the config data in both state locations
      setFeatureConfigData((prev) => ({
        ...prev,
        [currentFeature]: featureData,
      }));

      // Also store in our temporary storage for passing between components
      setFeatureConfigStorage((prev) => ({
        ...prev,
        [currentFeature]: featureData,
      }));

      // For navigation feature, update the keyAreas in onboardingData
      if (currentFeature === "navigation" && featureData.allAreas) {
        // Store the full area objects with all properties, not just IDs
        const navigationAreas = featureData.allAreas;

        // Update onboardingData with these areas
        setOnboardingData((prev) => ({
          ...prev,
          keyAreas: navigationAreas,
        }));
      }

      // Save to Firestore
      if (blueprintId) {
        try {
          const featureConfigRef = doc(db, "blueprintFeatures", blueprintId);
          setDoc(
            featureConfigRef,
            {
              [currentFeature]: featureData,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
          console.log(`Saved ${currentFeature} configuration to Firestore`);
        } catch (error) {
          console.error("Error saving feature configuration:", error);
          toast({
            title: "Configuration Error",
            description:
              "Failed to save feature configuration. Please try again.",
            variant: "destructive",
          });
        }
      }

      // Move to next feature or finish configuration
      if (currentFeatureIndex < selectedFeatures.length - 1) {
        setCurrentFeatureIndex(currentFeatureIndex + 1);
      } else {
        setShowFeatureConfig(false);
        // Now proceed to step 3
        setOnboardingStep(3);
      }
    };

    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        {/* Header */}
        <div className="border-b py-4 px-6 flex justify-between items-center bg-white">
          <div className="flex items-center">
            <Landmark className="h-6 w-6 text-indigo-500 mr-2" />
            <span className="font-semibold text-xl">Blueprint</span>
          </div>
          <Badge className="bg-indigo-100 text-indigo-800">
            Feature Setup {currentFeatureIndex + 1} of {selectedFeatures.length}
          </Badge>
        </div>

        {/* Main content with scrolling */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-3xl mx-auto w-full">
          <React.Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                <span className="ml-3 text-lg">Loading configuration...</span>
              </div>
            }
          >
            {/* Pass previously configured exhibit data to navigation config when relevant */}
            {currentFeature === "navigation" &&
            featureConfigStorage["exhibits"] ? (
              <FeatureConfigHub
                featureType={currentFeature}
                onSave={saveFeatureConfig}
                initialData={featureConfigData[currentFeature] || {}}
                blueprintId={blueprintId}
                placeData={prefillData?.placeData}
                exhibitData={featureConfigStorage["exhibits"]}
              />
            ) : (
              <FeatureConfigHub
                featureType={currentFeature}
                onSave={saveFeatureConfig}
                initialData={featureConfigData[currentFeature] || {}}
                blueprintId={blueprintId}
                placeData={prefillData?.placeData}
              />
            )}
          </React.Suspense>
        </div>

        {/* Bottom navigation bar */}
        <div className="border-t p-6 flex justify-between items-center bg-white">
          <Button
            variant="outline"
            onClick={() => {
              if (currentFeatureIndex > 0) {
                setCurrentFeatureIndex(currentFeatureIndex - 1);
              } else {
                // Go back to step 2
                setShowFeatureConfig(false);
              }
            }}
            className="px-6"
          >
            Back
          </Button>

          <div className="flex items-center space-x-2">
            {selectedFeatures.map((_, index) => (
              <div
                key={index}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  index < currentFeatureIndex
                    ? "bg-indigo-600"
                    : index === currentFeatureIndex
                      ? "bg-indigo-500 ring-2 ring-indigo-200"
                      : "bg-gray-300"
                }`}
              />
            ))}
          </div>

          <Button
            onClick={() => {
              // This button is now mainly for skipping configuration
              // The main save functionality is in the feature-specific screens
              if (currentFeatureIndex < selectedFeatures.length - 1) {
                setCurrentFeatureIndex(currentFeatureIndex + 1);
              } else {
                setShowFeatureConfig(false);
                setCurrentFeatureIndex(0); // Reset for next time
                setOnboardingStep(3);
              }
            }}
            className="px-6"
          >
            {currentFeatureIndex === selectedFeatures.length - 1
              ? "Skip & Complete Setup"
              : "Skip Feature"}
          </Button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const fetchBlueprintData = async () => {
      if (!blueprintId) {
        console.error("No blueprint ID available");
        setIsLoading(false);
        return;
      }

      try {
        // Get blueprint document reference
        const blueprintRef = doc(db, "blueprints", blueprintId);
        const blueprintSnap = await getDoc(blueprintRef);

        if (!blueprintSnap.exists()) {
          console.error("Blueprint not found");
          setIsLoading(false);
          return;
        }

        const blueprintData = blueprintSnap.data();

        // Set blueprint title
        setBlueprintTitle(
          blueprintData.name ||
            blueprintData.businessName ||
            "Untitled Blueprint",
        );

        // Set blueprint status
        setBlueprintStatus(blueprintData.status || "pending");

        // Skip onboarding if blueprint is already active
        if (
          blueprintData.status === "active" ||
          blueprintData.onboardingCompleted
        ) {
          setShowOnboarding(false);
        }

        // Set prefill data
        setPrefillData({
          businessName: blueprintData.businessName || "Your Business",
          industry: blueprintData.locationType || "retail",
          employeeCount: blueprintData.employeeCount || "10-50",
          // Add any other fields from the blueprint document
        });

        // Set 3D model path - use actual path from the document or default
        setModel3DPath(
          blueprintData.floorPlan3DUrl ||
            "https://f005.backblazeb2.com/file/objectModels-dev/home.glb",
        );

        // Set floor plan image if available
        if (blueprintData.floorPlanUrl) {
          setFloorPlanImage(blueprintData.floorPlanUrl);
        }

        // Set origin point if available
        if (blueprintData.origin) {
          setOriginPoint(
            new THREE.Vector3(
              blueprintData.origin.x || 0,
              blueprintData.origin.y || 0,
              blueprintData.origin.z || 0,
            ),
          );
        }

        // Set scale factor if available
        if (blueprintData.scale) {
          setScaleFactor(blueprintData.scale);
        }

        // Set marked areas if available
        if (
          blueprintData.markedAreas &&
          Array.isArray(blueprintData.markedAreas)
        ) {
          setMarkedAreas(blueprintData.markedAreas);
        }

        // Load uploaded files if available
        if (
          blueprintData.uploadedFiles &&
          Array.isArray(blueprintData.uploadedFiles)
        ) {
          // Sort by upload date (newest first) before setting state
          const sortedFiles = [...blueprintData.uploadedFiles].sort((a, b) => {
            // Convert string dates to Date objects if needed
            const dateA =
              a.uploadDate instanceof Date
                ? a.uploadDate
                : new Date(a.uploadDate);
            const dateB =
              b.uploadDate instanceof Date
                ? b.uploadDate
                : new Date(b.uploadDate);
            return dateB.getTime() - dateA.getTime();
          });
          setUploadedFiles(sortedFiles);
        }

        // Load blueprint anchors (if needed)
        loadBlueprintAnchors(blueprintId);
      } catch (error) {
        console.error("Error fetching blueprint data:", error);
        toast({
          title: "Error",
          description: "Failed to load blueprint data. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchBlueprintData();
  }, [blueprintId]);

  // ========================
  // INITIALIZATION & DATA LOADING
  // ========================

  // Move these helper functions outside the component
  const getAreasByIndustry = (industry) => {
    const industryAreas = {
      retail: [
        { value: "entrance", label: "Entrance" },
        { value: "checkout", label: "Checkout" },
        { value: "displays", label: "Product Displays" },
        { value: "fitting", label: "Fitting Rooms" },
        { value: "storage", label: "Storage Areas" },
        { value: "seating", label: "Customer Seating" },
      ],
      restaurant: [
        { value: "entrance", label: "Entrance" },
        { value: "dining", label: "Dining Area" },
        { value: "bar", label: "Bar" },
        { value: "kitchen", label: "Kitchen" },
        { value: "restrooms", label: "Restrooms" },
        { value: "outdoor", label: "Outdoor Seating" },
        { value: "private", label: "Private Dining" },
        { value: "counter", label: "Order Counter" },
        { value: "pickup", label: "Pickup Area" },
      ],
      office: [
        { value: "reception", label: "Reception" },
        { value: "workspaces", label: "Workspaces" },
        { value: "meeting", label: "Meeting Rooms" },
        { value: "kitchen", label: "Kitchen/Break Area" },
        { value: "restrooms", label: "Restrooms" },
      ],
      museum: [
        { value: "entrance", label: "Main Entrance" },
        { value: "lobby", label: "Lobby" },
        { value: "ticketing", label: "Ticketing Area" },
        { value: "mainGallery", label: "Main Gallery" },
        { value: "specialExhibits", label: "Special Exhibits" },
        { value: "permanentCollection", label: "Permanent Collection" },
        { value: "interactiveArea", label: "Interactive Zone" },
        { value: "theater", label: "Theater/Auditorium" },
        { value: "cafe", label: "Museum Café" },
        { value: "giftShop", label: "Gift Shop" },
        { value: "education", label: "Education Center" },
        { value: "restrooms", label: "Restrooms" },
        { value: "outdoorSpace", label: "Outdoor Space" },
        { value: "researchArea", label: "Research Area" },
        { value: "storage", label: "Collection Storage" },
        { value: "adminOffices", label: "Administrative Offices" },
      ],
    };

    // Default to retail if industry not found
    return industryAreas[industry] || industryAreas["retail"];
  };

  // Helper functions for labels
  function getGoalLabel(goal: string): string {
    const goals: Record<string, string> = {
      customerEngagement: "Drive Customer Engagement & Sales",
      staffTraining: "Empower Your Team",
      //    partnerShowcase: "Make Your Space Your Own",
      //    eventPlanning: "Plan Events",
    };
    return goals[goal] || goal;
  }

  function getUseCaseLabel(useCases: string[]): string {
    if (!useCases || useCases.length === 0) return "None selected";

    const useCaseLabels: Record<string, string> = {
      navigation: "Navigation & Wayfinding",
      information: "Product Information",
      engagement: "Interactive Experiences",
      promotion: "Special Offers",
      newArrivals: "New Arrivals",
      inventory: "Inventory Checking",
      reviews: "Customer Reviews",
      recommendations: "Personalized Recommendations",
      loyalty: "Loyalty Program",
      events: "Store Events",
      staff: "Staff Assistance",
      feedback: "Customer Feedback",
    };

    if (useCases.length === 1) {
      return useCaseLabels[useCases[0]] || useCases[0];
    }

    return `${useCases.length} use cases selected`;
  }

  function getAreaLabel(area: string | AreaItem, industry: string): string {
    if (!area) return "";

    // If area is an object with name property, return the name
    if (typeof area !== 'string' && area.name) {
      return area.name;
    }

    // Otherwise treat it as a string key and look it up
    const areas = getAreasByIndustry(industry);
    const areaKey = typeof area === 'string' ? area : area.id;
    const foundArea = areas.find((a) => a.value === areaKey);
    return foundArea ? foundArea.label : String(areaKey);
  }

  function getFeatureLabel(feature: string): string {
    const features: Record<string, string> = {
      audioGuide: "Audio Guide",
      virtualTour: "Virtual Tour",
      socialSharing: "Social Sharing",
      analytics: "Visitor Analytics",
      customQr: "Custom QR Codes",
      realTimeUpdates: "Real-Time Updates",
    };
    return features[feature] || feature;
  }

  const InteractiveOnboarding = () => {
    // Check if we have prefill data loaded
    if (isLoading || !prefillData) {
      return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-lg font-medium">Setting up your Blueprint...</p>
        </div>
      );
    }

    // Helper to determine if we should show sidebar mode
    const shouldShowSidebar = onboardingMode === "sidebar";

    const getNextAreaToMark = () => {
      // If no key areas are defined, suggest a custom area
      if (!onboardingData.keyAreas || onboardingData.keyAreas.length === 0) {
        return "Custom Area";
      }

      // Get the area names from marked areas (normalize to lowercase)
      const markedAreaNames = markedAreas.map((area) =>
        area.name.toLowerCase(),
      );

      // Find first unmarked area
      const nextArea = onboardingData.keyAreas.find((area) => {
        // Get the area name directly
        const areaName =
          typeof area === "string"
            ? getAreaLabel(area, prefillData?.industry)
            : area.name;

        return !markedAreaNames.includes(areaName.toLowerCase());
      });

      if (!nextArea) return "Custom Area";

      return typeof nextArea === "string"
        ? getAreaLabel(nextArea, prefillData?.industry)
        : nextArea.name;
    };

    // New helper function to prepare an area for marking
    const prepareAreaForMarking = (area: string | AreaItem) => {
      // Set as the active area to mark
      setActiveAreaToMark(area);

      // Activate marking mode if not already active
      if (!isMarkingArea) {
        setIsMarkingArea(true);

        // Get area name based on the type
        const areaName =
          typeof area === "string"
            ? getAreaLabel(area, prefillData?.industry || '')
            : area.name;

        toast({
          title: `Mark "${areaName}"`,
          description: "Click and drag in the 3D view to define this area",
        });
      }
    };

    // Interface for AreaProgressList props
    interface AreaProgressListProps {
      keyAreas: (string | AreaItem)[];
      markedAreas: MarkedArea[];
      onSelectArea: (area: string | AreaItem) => void;
    }

    // New component for area progress list
    const AreaProgressList = ({ keyAreas, markedAreas, onSelectArea }: AreaProgressListProps) => {
      // Get marked area names for comparison
      const markedAreaNames = markedAreas.map((area) =>
        area.name.toLowerCase(),
      );

      return (
        <div className="border rounded-lg p-4">
          <h3 className="text-md font-medium mb-3 flex items-center justify-between">
            <span>Areas to Mark</span>
            <Badge className="bg-emerald-100 text-emerald-800">
              {markedAreas.length}/{keyAreas.length}
            </Badge>
          </h3>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {keyAreas.map((area, index) => {
              // Now using the name directly from the area object
              const areaName = 
                typeof area === "string" 
                ? area 
                : area.name || `area-${index + 1}`;
              const isMarked = markedAreaNames.includes(areaName.toLowerCase());

              return (
                <div
                  key={typeof area === "string" ? area : area.id || index}
                  onClick={() => !isMarked && onSelectArea(area)}
                  className={`
                    flex items-center px-3 py-2 rounded-lg cursor-pointer transition-all
                    ${
                      isMarked
                        ? "bg-emerald-50 border border-emerald-200"
                        : "border hover:border-blue-300 hover:bg-blue-50/50"
                    }
                  `}
                >
                  <div className="mr-3 flex-shrink-0">
                    {isMarked ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500">
                        {index + 1}
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <p
                      className={`text-sm font-medium ${isMarked ? "text-emerald-700" : ""}`}
                    >
                      {areaName}
                    </p>
                  </div>

                  {!isMarked && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectArea(area);
                      }}
                    >
                      <CirclePlay className="h-4 w-4 text-blue-600" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    // Automatically transition to sidebar mode after step 2
    useEffect(() => {
      if (onboardingStep > 2 && onboardingMode === "fullscreen") {
        setOnboardingMode("sidebar");
        // Make sure the 3D view is active when transitioning to sidebar
        setViewMode("3D");
      }
    }, [onboardingStep, onboardingMode]);

    // Render the onboarding content based on mode
    const renderOnboardingContent = () => {
      if (showFeatureConfig) {
        return <FeatureConfigurationPanel />;
      }

      // Helper to determine if we should show sidebar mode - EXISTING CODE
      const shouldShowSidebar = onboardingMode === "sidebar";

      // Automatically transition to sidebar mode after step 2 - EXISTING CODE
      useEffect(() => {
        if (onboardingStep > 2 && onboardingMode === "fullscreen") {
          setOnboardingMode("sidebar");
          // Make sure the 3D view is active when transitioning to sidebar
          setViewMode("3D");
        }
      }, [onboardingStep, onboardingMode]);

      if (shouldShowSidebar) {
        return (
          <div className="fixed top-0 right-0 bottom-0 w-96 bg-white z-40 border-l shadow-lg overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 border-b py-3 px-4 bg-white flex justify-between items-center">
              <div className="flex items-center">
                <Landmark className="h-5 w-5 text-indigo-500 mr-1.5" />
                <span className="font-semibold">Blueprint Setup</span>
              </div>
              <Badge className="bg-indigo-100 text-indigo-800">
                Step {onboardingStep} of 5
              </Badge>
            </div>

            {/* Sidebar content */}
            <div className="p-4 pb-32">
              <AnimatePresence mode="wait">
                {/* Step 3: Key Areas Identification - Sidebar Version */}
                // AFTER: Improved Step 3 Implementation
                {onboardingStep === 3 && (
                  <motion.div
                    key="step3-sidebar"
                    initial={{ opacity: 0.9 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0.9 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-5"
                  >
                    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-lg border border-indigo-100">
                      <h2 className="text-xl font-semibold mb-2 text-indigo-800">
                        Mark Key Areas
                      </h2>
                      <div className="flex items-center gap-2 mb-3">
                        <Badge className="bg-indigo-100 text-indigo-800">
                          Step 3 of 5
                        </Badge>
                        <Badge className="bg-emerald-100 text-emerald-800">
                          {getNavigationMarkedAreas().length}/
                          {onboardingData.keyAreas.length > 0
                            ? onboardingData.keyAreas.length
                            : 1}{" "}
                          Areas Marked
                        </Badge>
                      </div>
                      <p className="text-sm text-indigo-700">
                        Mark each area on your 3D model to help visitors
                        navigate your space.
                      </p>
                    </div>

                    <div className="relative bg-blue-50 border border-blue-100 p-4 rounded-lg">
                      <h3 className="text-md font-medium text-blue-800 mb-3 flex items-center">
                        <MapPin className="h-4 w-4 mr-1.5" />
                        Current Task
                      </h3>

                      {!checkAllAreasMarked() ? (
                        <>
                          <p className="text-sm font-medium text-blue-700 mb-2">
                            Mark area:{" "}
                            <span className="text-blue-900">
                              {getNextAreaToMark()}
                            </span>
                          </p>
                          <ol className="bg-white rounded-md p-3 text-sm space-y-2.5 mb-3">
                            <li className="flex items-center gap-2">
                              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">
                                1
                              </div>
                              <span>
                                Click the{" "}
                                <span className="px-1.5 py-0.5 bg-gray-100 rounded font-mono text-xs">
                                  Mark Area
                                </span>{" "}
                                button in the toolbar below
                              </span>
                            </li>
                            <li className="flex items-center gap-2">
                              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">
                                2
                              </div>
                              <span>
                                Click and drag on the 3D model to define the
                                area
                              </span>
                            </li>
                            <li className="flex items-center gap-2">
                              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">
                                3
                              </div>
                              <span>Enter the area name and save</span>
                            </li>
                          </ol>

                          <Button
                            variant={isMarkingArea ? "default" : "outline"}
                            size="sm"
                            className="w-full relative overflow-hidden group"
                            onClick={() => {
                              setIsMarkingArea(!isMarkingArea);
                              if (!isMarkingArea) {
                                // Show guidance toast
                                toast({
                                  title: "Mark Area Mode Activated",
                                  description:
                                    "Click and drag in the 3D view to define your area",
                                });
                              } else {
                                corner1Ref.current = null;
                              }
                            }}
                          >
                            {isMarkingArea ? (
                              <>
                                <X className="h-4 w-4 mr-1.5" />
                                Stop Marking
                              </>
                            ) : (
                              <>
                                <Square className="h-4 w-4 mr-1.5" />
                                {markedAreas.length === 0
                                  ? "Start Marking First Area"
                                  : "Mark Next Area"}
                              </>
                            )}
                            {!isMarkingArea && (
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20"
                                initial={{ x: "-100%" }}
                                animate={{ x: "200%" }}
                                transition={{
                                  repeat: Infinity,
                                  duration: 1.5,
                                  ease: "easeInOut",
                                }}
                              />
                            )}
                          </Button>
                        </>
                      ) : (
                        <div className="text-center py-3">
                          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
                          <p className="font-medium text-emerald-700">
                            All areas marked successfully!
                          </p>
                          <p className="text-sm text-emerald-600 mb-3">
                            You can now continue to the next step
                          </p>
                          <Button
                            onClick={nextOnboardingStep}
                            className="w-full"
                          >
                            Continue to Next Step
                          </Button>
                        </div>
                      )}
                    </div>

                    <AreaProgressList
                      keyAreas={onboardingData.keyAreas}
                      markedAreas={markedAreas}
                      onSelectArea={(area) => prepareAreaForMarking(area)}
                    />
                  </motion.div>
                )}
                {/* Step 4: Visual Style and Features - Sidebar Version */}
                {onboardingStep === 4 && (
                  <motion.div
                    key="step4-sidebar"
                    initial={{ opacity: 0.9 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0.9 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-6"
                  >
                    <div>
                      <h2 className="text-xl font-semibold mb-2">
                        Customize Experience
                      </h2>
                      <p className="text-gray-600 text-sm">
                        Configure how your Blueprint will look and function
                      </p>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-medium">Visual Style</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          {
                            value: "professional",
                            label: "Professional",
                            color: "bg-blue-700",
                          },
                          {
                            value: "playful",
                            label: "Playful",
                            color: "bg-pink-500",
                          },
                          {
                            value: "minimalist",
                            label: "Minimalist",
                            color: "bg-gray-700",
                          },
                        ].map((style) => (
                          <div
                            key={style.value}
                            onClick={() =>
                              updateOnboardingData(
                                "preferredStyle",
                                style.value,
                              )
                            }
                            className={`
                              overflow-hidden rounded-lg border transition-all cursor-pointer
                              ${
                                onboardingData.preferredStyle === style.value
                                  ? "border-indigo-500 ring-1 ring-indigo-500"
                                  : "border-gray-200 hover:border-indigo-300"
                              }
                            `}
                          >
                            <div
                              className={`h-16 ${style.color} flex items-center justify-center`}
                            >
                              <span className="text-white text-xs font-medium">
                                {style.label}
                              </span>
                            </div>
                            <div className="p-1 text-center text-xs font-medium">
                              {style.label}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Special Features</h3>
                      <p className="text-xs text-gray-600">
                        Select the features you want to include
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        {[
                          {
                            value: "audioGuide",
                            label: "Audio Guide",
                            icon: <Volume2 className="h-4 w-4" />,
                          },
                          {
                            value: "virtualTour",
                            label: "Virtual Tour",
                            icon: <Map className="h-4 w-4" />,
                          },
                          {
                            value: "socialSharing",
                            label: "Social Sharing",
                            icon: <Share2 className="h-4 w-4" />,
                          },
                          {
                            value: "analytics",
                            label: "Visitor Analytics",
                            icon: <BarChart2 className="h-4 w-4" />,
                          },
                          {
                            value: "customQr",
                            label: "Custom QR Codes",
                            icon: <QrCode className="h-4 w-4" />,
                          },
                          {
                            value: "realTimeUpdates",
                            label: "Real-Time Updates",
                            icon: <RefreshCw className="h-4 w-4" />,
                          },
                        ].map((feature) => (
                          <div
                            key={feature.value}
                            onClick={() => {
                              updateOnboardingData(
                                "specialFeatures",
                                onboardingData.specialFeatures.includes(
                                  feature.value,
                                )
                                  ? onboardingData.specialFeatures.filter(
                                      (f) => f !== feature.value,
                                    )
                                  : [
                                      ...onboardingData.specialFeatures,
                                      feature.value,
                                    ],
                              );
                            }}
                            className={`
                              flex items-center p-2 border rounded-lg cursor-pointer transition-all
                              ${
                                onboardingData.specialFeatures.includes(
                                  feature.value,
                                )
                                  ? "border-indigo-500 bg-indigo-50"
                                  : "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50"
                              }
                            `}
                          >
                            <div
                              className={`w-4 h-4 flex items-center justify-center border rounded-md mr-2 ${
                                onboardingData.specialFeatures.includes(
                                  feature.value,
                                )
                                  ? "border-indigo-500 bg-indigo-500"
                                  : "border-gray-300"
                              }`}
                            >
                              {onboardingData.specialFeatures.includes(
                                feature.value,
                              ) && <Check className="h-2.5 w-2.5 text-white" />}
                            </div>
                            <div className="flex items-center">
                              {feature.icon}
                              <span className="ml-1.5 text-sm">
                                {feature.label}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Preview of active style on the 3D model */}
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-700 flex items-center gap-1.5">
                        <Info className="h-4 w-4" />
                        Your style changes are being previewed in the 3D view
                      </p>
                    </div>
                  </motion.div>
                )}
                {/* Step 5: Summary and Confirmation - Sidebar Version */}
                {onboardingStep === 5 && (
                  <motion.div
                    key="step5-sidebar"
                    initial={{ opacity: 0.9 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0.9 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-6"
                  >
                    <div>
                      <h2 className="text-xl font-semibold mb-2">
                        Ready to Launch!
                      </h2>
                      <p className="text-gray-600 text-sm">
                        Your Blueprint setup is complete
                      </p>
                    </div>

                    <div className="bg-indigo-50 rounded-lg p-4">
                      <h3 className="text-base font-medium mb-3 text-indigo-700">
                        Blueprint Summary
                      </h3>

                      <div className="space-y-3">
                        <div>
                          <h4 className="text-xs font-medium text-gray-500">
                            Business
                          </h4>
                          <p className="text-sm">{prefillData.businessName}</p>
                        </div>

                        <div>
                          <h4 className="text-xs font-medium text-gray-500">
                            Main Goal
                          </h4>
                          <p className="text-sm">
                            {getGoalLabel(onboardingData.goal)}
                          </p>
                        </div>

                        <div>
                          <h4 className="text-xs font-medium text-gray-500">
                            Use Cases
                          </h4>
                          <div className="flex flex-wrap gap-1.5 mt-0.5">
                            {onboardingData.useCases.length > 0 ? (
                              onboardingData.useCases.map((useCase) => (
                                <Badge
                                  key={useCase}
                                  className="bg-white py-0.5 px-1.5 text-xs"
                                >
                                  {getUseCaseLabel([useCase])}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm text-gray-500">
                                None selected
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-xs font-medium text-gray-500">
                            Key Areas
                          </h4>
                          <div className="flex flex-wrap gap-1.5 mt-0.5">
                            {onboardingData.keyAreas.map((area, index) => (
                              <Badge
                                key={index} // Using index as a fallback key
                                className="bg-white py-0.5 px-1.5 text-xs"
                              >
                                {getAreaLabel(area, prefillData.industry)}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-xs font-medium text-gray-500">
                            Features
                          </h4>
                          <div className="flex flex-wrap gap-1.5 mt-0.5">
                            {onboardingData.specialFeatures.length > 0 ? (
                              onboardingData.specialFeatures.map((feature) => (
                                <Badge
                                  key={feature}
                                  className="bg-white py-0.5 px-1.5 text-xs"
                                >
                                  {getFeatureLabel(feature)}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm text-gray-500">
                                None selected
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-xs font-medium text-gray-500">
                            Visual Style
                          </h4>
                          <p className="text-sm capitalize">
                            {onboardingData.preferredStyle}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="text-center">
                      <p className="text-sm font-medium mb-1">
                        Ready to activate your Blueprint?
                      </p>
                      <p className="text-xs text-gray-600 mb-3">
                        You can continue customizing after activation
                      </p>
                    </div>

                    <Button
                      className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white"
                      onClick={completeOnboarding}
                    >
                      <Zap className="h-4 w-4 mr-1.5" />
                      Activate Blueprint
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer navigation - fixed at bottom */}
            <div className="fixed bottom-0 right-0 w-96 border-t p-4 flex justify-between items-center bg-white">
              <Button
                variant="outline"
                size="sm"
                onClick={prevOnboardingStep}
                disabled={onboardingStep === 1}
              >
                Back
              </Button>

              {/* Progress indicator in the middle */}
              <div className="flex items-center space-x-1.5">
                {[1, 2, 3, 4, 5].map((step) => (
                  <div
                    key={step}
                    className={`w-2 h-2 rounded-full transition-all ${
                      step < onboardingStep
                        ? "bg-indigo-600"
                        : step === onboardingStep
                          ? "bg-indigo-500 ring-1 ring-indigo-200"
                          : "bg-gray-300"
                    }`}
                  />
                ))}
              </div>

              <Button
                size="sm"
                onClick={nextOnboardingStep}
                disabled={
                  (onboardingStep === 1 && !onboardingData.goal) ||
                  (onboardingStep === 2 &&
                    (onboardingData.useCases.length === 0 ||
                      !onboardingData.audienceType)) ||
                  (onboardingStep === 3 &&
                    onboardingData.keyAreas.length === 0) ||
                  (onboardingStep === 3 && markedAreas.length === 0) // Require at least one marked area
                }
              >
                Next
              </Button>
            </div>
          </div>
        );
      } else {
        // Full-screen mode (steps 1-2)
        return (
          <div className="fixed inset-0 bg-white z-50 flex flex-col">
            {/* Header */}
            <div className="border-b py-4 px-6 flex justify-between items-center bg-white">
              <div className="flex items-center">
                <Landmark className="h-6 w-6 text-indigo-500 mr-2" />
                <span className="font-semibold text-xl">Blueprint</span>
              </div>
              <Badge className="bg-indigo-100 text-indigo-800">
                Step {onboardingStep} of 5
              </Badge>
            </div>

            {/* Main content with scrolling */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-5xl mx-auto w-full">
              <AnimatePresence mode="wait">
                {/* Step 1: Goal Selection - Same as original */}
                {onboardingStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0.9 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0.9 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-8"
                  >
                    <div className="text-center mb-6">
                      <h1 className="text-3xl font-bold mb-3">
                        Welcome to Blueprint
                      </h1>
                      <p className="text-xl text-gray-600">
                        Let's bring {prefillData.businessName} to life in AR
                      </p>
                    </div>

                    <div className="mb-6 p-4 bg-indigo-50 rounded-lg">
                      <p className="text-gray-700">
                        Based on our research, we'll be mapping a{" "}
                        {prefillData.industry} business with approximately{" "}
                        {prefillData.employeeCount || "10-50"} employees.
                      </p>
                    </div>

                    <div>
                      <h2 className="text-2xl font-semibold mb-6">
                        What's your main goal with Blueprint?
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {[
                          {
                            value: "customerEngagement",
                            label: "Drive Customer Engagement & Sales",
                            icon: (
                              <Users className="h-10 w-10 text-indigo-500 mb-3" />
                            ),
                            description:
                              "Create interactive AR experiences for your visitors",
                            isRecommended: true,
                            exampleOutcome: (
                              <div className="bg-gray-50 rounded-md overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-24 relative">
                                  <div className="absolute bottom-2 left-2 bg-white rounded-md px-2 py-1 text-xs font-medium shadow-sm flex items-center gap-1.5">
                                    <QrCode className="h-3 w-3" />
                                    <span>Scan for specials</span>
                                  </div>
                                  <div className="absolute top-2 right-2 text-white text-xs bg-black/30 rounded px-1.5 py-0.5">
                                    Customer View
                                  </div>
                                </div>
                                <div className="p-2 flex justify-between items-center">
                                  <div className="text-xs">
                                    <div className="font-medium">
                                      30% More Sales
                                    </div>
                                    <div className="text-gray-500">
                                      Interactive Product Info
                                    </div>
                                  </div>
                                  <div className="text-xs flex items-center gap-1">
                                    <Smartphone className="h-3 w-3" />
                                    <Tag className="h-3 w-3" />
                                    <ShoppingCart className="h-3 w-3" />
                                  </div>
                                </div>
                              </div>
                            ),
                          },
                          {
                            value: "staffTraining",
                            label: "Empower Your Team",
                            icon: (
                              <GraduationCap className="h-10 w-10 text-indigo-500 mb-3" />
                            ),
                            description:
                              "Improve your crew's experience and effectiveness",
                            exampleOutcome: (
                              <div className="bg-gray-50 rounded-md overflow-hidden">
                                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 h-24 relative">
                                  <div className="absolute bottom-2 left-2 bg-white rounded-md px-2 py-1 text-xs font-medium shadow-sm flex items-center gap-1.5">
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>Training complete</span>
                                  </div>
                                  <div className="absolute top-2 right-2 text-white text-xs bg-black/30 rounded px-1.5 py-0.5">
                                    Staff View
                                  </div>
                                </div>
                                <div className="p-2 flex justify-between items-center">
                                  <div className="text-xs">
                                    <div className="font-medium">
                                      50% Faster Training
                                    </div>
                                    <div className="text-gray-500">
                                      Interactive Guides
                                    </div>
                                  </div>
                                  <div className="text-xs flex items-center gap-1">
                                    <GraduationCap className="h-3 w-3" />
                                    <Briefcase className="h-3 w-3" />
                                    <Users className="h-3 w-3" />
                                  </div>
                                </div>
                              </div>
                            ),
                          },
                        ].map((option) => (
                          <div
                            key={option.value}
                            onClick={() =>
                              updateOnboardingData("goal", option.value)
                            }
                            className={`
                              flex flex-col p-6 border-2 rounded-2xl cursor-pointer transition-all relative
                              ${option.isRecommended ? "shadow-md" : ""}
                              ${
                                onboardingData.goal === option.value
                                  ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200 ring-offset-2"
                                  : "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50"
                              }
                            `}
                          >
                            {option.isRecommended && (
                              <div className="absolute -top-2 -right-2 bg-indigo-500 text-white text-xs font-medium px-2 py-0.5 rounded-full shadow-sm">
                                Recommended
                              </div>
                            )}

                            <div className="flex flex-col items-center text-center mb-5">
                              {option.icon}
                              <h4
                                className={`text-lg font-medium mb-2 ${option.isRecommended ? "text-indigo-700" : ""}`}
                              >
                                {option.label}
                              </h4>
                              <p className="text-gray-600">
                                {option.description}
                              </p>
                            </div>

                            <div className="mt-auto w-full">
                              <h5 className="text-sm font-medium text-gray-700 mb-2">
                                Example Outcome:
                              </h5>
                              {option.exampleOutcome}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Use Case Selection - Same as your updated version */}
                {onboardingStep === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0.9 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0.9 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-8"
                  >
                    <div className="text-center mb-6">
                      <h1 className="text-3xl font-bold mb-3">
                        How will people interact with your Blueprint?
                      </h1>
                      <p className="text-lg text-gray-600">
                        Based on your{" "}
                        {onboardingData.goal === "customerEngagement"
                          ? "customer engagement"
                          : "staff training"}{" "}
                        goal
                      </p>
                    </div>

                    <div>
                      <h2 className="text-2xl font-semibold mb-6">Use Cases</h2>
                      <p className="text-gray-600 mb-4">
                        Select all the ways{" "}
                        {onboardingData.goal === "customerEngagement"
                          ? "customers"
                          : "staff"}{" "}
                        will use your Blueprint
                        {prefillData?.industry &&
                          prefillData.industry !== "retail" && (
                            <span> in your {prefillData.industry} space</span>
                          )}
                      </p>

                      {/* Set audience type automatically based on goal */}
                      <AudienceTypeEffect 
                        goal={onboardingData.goal}
                        audienceType={onboardingData.audienceType}
                        updateOnboardingData={updateOnboardingData}
                      />

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {getUseCasesByIndustry(
                          prefillData?.industry || "retail",
                        )
                          .filter((option) => {
                            // Filter use cases by the selected goal
                            if (onboardingData.goal === "staffTraining") {
                              return [
                                "workspace",
                                "facilities",
                                "visitor",
                                "education",
                                "navigation",
                                "audioTours",
                              ].includes(option.value);
                            }
                            return true; // Show all for customer engagement
                          })
                          .map((option) => (
                            <div
                              key={option.value}
                              className={`flex flex-col items-center text-center p-4 border-2 rounded-2xl cursor-pointer transition-all ${
                                onboardingData.useCases.includes(option.value)
                                  ? "border-indigo-500 bg-indigo-50"
                                  : "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50"
                              }`}
                              onClick={() => {
                                // Toggle selection in the array
                                updateOnboardingData(
                                  "useCases",
                                  onboardingData.useCases.includes(option.value)
                                    ? onboardingData.useCases.filter(
                                        (item) => item !== option.value,
                                      )
                                    : [
                                        ...onboardingData.useCases,
                                        option.value,
                                      ],
                                );
                              }}
                            >
                              <div
                                className={`w-6 h-6 flex items-center justify-center border rounded-md mb-2 ${
                                  onboardingData.useCases.includes(option.value)
                                    ? "border-indigo-500 bg-indigo-500"
                                    : "border-gray-300"
                                }`}
                              >
                                {onboardingData.useCases.includes(
                                  option.value,
                                ) && <Check className="h-4 w-4 text-white" />}
                              </div>
                              <div>{option.icon}</div>
                              <h4 className="font-medium">{option.label}</h4>
                              <p className="text-xs text-gray-600 mt-1">
                                {option.description}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Feature configuration transition messaging */}
                    {onboardingData.useCases.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-5 border border-indigo-100 mt-8"
                      >
                        <h3 className="text-lg font-medium text-indigo-800 mb-2 flex items-center">
                          <Zap className="h-5 w-5 mr-2 text-indigo-500" />
                          Next: Feature Configuration
                        </h3>
                        <p className="text-sm text-indigo-700 mb-3">
                          After selecting your use cases, you'll configure each
                          feature for your specific needs.
                        </p>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="bg-white rounded-lg p-3 border border-indigo-100 flex items-center gap-2">
                            <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center">
                              <Settings className="h-4 w-4 text-indigo-600" />
                            </div>
                            <div>
                              <div className="text-xs font-medium">
                                Customize Features
                              </div>
                              <div className="text-[10px] text-gray-500">
                                Adapt to your needs
                              </div>
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-indigo-100 flex items-center gap-2">
                            <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center">
                              <MapPin className="h-4 w-4 text-indigo-600" />
                            </div>
                            <div>
                              <div className="text-xs font-medium">
                                Mark Areas
                              </div>
                              <div className="text-[10px] text-gray-500">
                                Define space in 3D
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-indigo-600">
                          You can always adjust these settings later in your
                          Blueprint.
                        </p>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom navigation bar */}
            <div className="border-t p-6 flex justify-between items-center bg-white">
              <Button
                variant="outline"
                onClick={prevOnboardingStep}
                disabled={onboardingStep === 1}
                className="px-6"
              >
                Back
              </Button>

              {/* Progress indicator in the middle */}
              <div className="hidden sm:flex items-center space-x-2">
                {[1, 2, 3, 4, 5].map((step) => (
                  <div
                    key={step}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      step < onboardingStep
                        ? "bg-indigo-600"
                        : step === onboardingStep
                          ? "bg-indigo-500 ring-2 ring-indigo-200"
                          : "bg-gray-300"
                    }`}
                  />
                ))}
              </div>

              <Button
                onClick={() => {
                  if (onboardingStep === 2) {
                    // When leaving step 2, update UI to show we're transitioning to 3D editor
                    toast({
                      title: "Setting up 3D environment",
                      description: "You'll now mark areas directly in 3D",
                    });
                  }
                  nextOnboardingStep();
                }}
                disabled={
                  (onboardingStep === 1 && !onboardingData.goal) ||
                  (onboardingStep === 2 &&
                    (onboardingData.useCases.length === 0 ||
                      !onboardingData.audienceType))
                }
                className="px-6"
              >
                {onboardingStep === 2 ? (
                  <>
                    Start Configurations
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </>
                ) : (
                  "Next"
                )}
              </Button>
            </div>
          </div>
        );
      }
    };

    // Add these interactive guidance components to help users
    const Step3AreaGuidance = () => {
      if (
        onboardingStep !== 3 ||
        onboardingMode !== "sidebar" ||
        !onboardingData.keyAreas.length ||
        markedAreas.length > 0
      ) {
        return null;
      }

      return (
        <motion.div
          className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 bg-blue-600 text-white px-5 py-3 rounded-lg shadow-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.3 }}
        >
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-1.5 rounded-full">
              <Square className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">Click "Mark Area" to begin</p>
              <p className="text-sm opacity-90">
                Then draw the area on your 3D model
              </p>
            </div>
          </div>
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-solid border-transparent border-t-blue-600"></div>
        </motion.div>
      );
    };

    return (
      <>
        {/* Main onboarding container */}
        {renderOnboardingContent()}

        {/* Interactive guidance elements */}
        <Step3AreaGuidance />

        {isMarkingArea && onboardingStep === 3 && (
          <div className="absolute inset-0 pointer-events-none z-40">
            {!corner1Ref.current ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/90 rounded-lg shadow-lg p-4 max-w-xs text-center"
              >
                <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-blue-100 flex items-center justify-center">
                  <MousePointer className="h-8 w-8 text-blue-600" />
                </div>
                <p className="font-medium text-blue-900">
                  Click anywhere to start marking
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  Then drag to define the area
                </p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute right-6 top-1/2 transform -translate-y-1/2 bg-white/90 rounded-lg shadow-lg p-4 max-w-xs"
              >
                <p className="font-medium text-blue-900 flex items-center gap-2">
                  <Move className="h-5 w-5 text-blue-600" />
                  Now drag to define the area size
                </p>
              </motion.div>
            )}
          </div>
        )}

        {/* Overlay when in area marking mode */}
        {isMarkingArea && onboardingMode === "sidebar" && (
          <div className="fixed inset-0 bg-black/10 pointer-events-none z-30">
            <div className="absolute right-96 top-1/2 transform -translate-y-1/2 bg-white p-4 rounded-lg shadow-xl mr-6 max-w-sm">
              <h3 className="font-medium text-lg mb-2 flex items-center">
                <Square className="text-indigo-500 mr-2 h-5 w-5" />
                Area Marking Mode
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Click and drag in the 3D view to define your area. This will
                help visitors navigate and interact with specific sections.
              </p>
              <ol className="text-sm space-y-1.5 ml-5 list-decimal text-gray-600">
                <li>Click to set the first corner</li>
                <li>Drag to define the area size</li>
                <li>Release to complete the area</li>
              </ol>
            </div>
          </div>
        )}
      </>
    );
  };

  const completeOnboarding = async () => {
    try {
      if (blueprintId) {
        // Show a loading state
        toast({
          title: "Activating Blueprint...",
          description: "Saving your configuration",
        });

        // Update blueprint with onboarding data and set as active
        await updateDoc(doc(db, "blueprints", blueprintId), {
          onboardingCompleted: true,
          onboardingData: onboardingData,
          status: "active", // Set active immediately
          activatedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (Object.keys(featureConfigData).length > 0) {
          await updateDoc(doc(db, "blueprints", blueprintId), {
            featureConfigurations: featureConfigData,
          });
        }

        // Update local state
        setBlueprintStatus("active");
      }

      // Add a success toast with a proper delay
      setTimeout(() => {
        toast({
          title: "Blueprint Activated!",
          description: "Your Blueprint is now live and ready to use.",
          variant: "default",
        });

        // Finally set the state to hide the onboarding after animation finishes
        setShowOnboarding(false);

        // Start QR generation flow if that feature was selected
        if (onboardingData.specialFeatures.includes("customQr")) {
          setTimeout(() => {
            setQrGenerationActive(true);
            setQrGenerationStep(0);
            toast({
              title: "QR Code Setup",
              description: "Let's set up QR codes for your space",
            });
          }, 1000);
        }
      }, 1000);
    } catch (error) {
      console.error("Error completing onboarding:", error);
      toast({
        title: "Error",
        description: "Failed to complete setup. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getFeatureConfiguration = async (featureType) => {
    if (!blueprintId) return null;

    try {
      // Try to get from the dedicated feature collection first
      const featureConfigRef = doc(db, "blueprintFeatures", blueprintId);
      const featureConfigSnap = await getDoc(featureConfigRef);

      if (featureConfigSnap.exists() && featureConfigSnap.data()[featureType]) {
        return featureConfigSnap.data()[featureType];
      }

      // Fallback to checking the blueprint document
      const blueprintRef = doc(db, "blueprints", blueprintId);
      const blueprintSnap = await getDoc(blueprintRef);

      if (
        blueprintSnap.exists() &&
        blueprintSnap.data().featureConfigurations &&
        blueprintSnap.data().featureConfigurations[featureType]
      ) {
        return blueprintSnap.data().featureConfigurations[featureType];
      }

      return null;
    } catch (error) {
      console.error("Error retrieving feature configuration:", error);
      return null;
    }
  };

  // Example of how to use the feature configuration
  useEffect(() => {
    const loadFeedbackConfig = async () => {
      const feedbackConfig = await getFeatureConfiguration("feedback");
      if (feedbackConfig) {
        // Initialize your feedback system with the stored configuration
        console.log("Feedback configuration loaded:", feedbackConfig);

        // Set up your feedback component with the config
        if (feedbackConfig.isEnabled) {
          // Initialize feedback components based on feedbackConfig
          if (feedbackConfig.feedbackMethod === "popup") {
            // Set up popup feedback
          } else if (feedbackConfig.feedbackMethod === "survey") {
            // Set up survey email links
          }
        }
      }
    };

    loadFeedbackConfig();
  }, [blueprintId]);

  // Onboarding step handlers
  const nextOnboardingStep = () => {
    if (onboardingStep === 5) {
      completeOnboarding();
    } else if (onboardingStep === 2) {
      // When moving from step 2, check if user selected any features that need configuration
      if (onboardingData.useCases && onboardingData.useCases.length > 0) {
        // Show the feature configuration panel
        setShowFeatureConfig(true);

        toast({
          title: "Let's configure your features",
          description: "Customize how each feature will work in your space",
          duration: 3000,
        });

        // Don't advance the step yet - we'll do that after feature configuration
        return; // ADD THIS LINE - important to prevent step advancement
      } else {
        // No features selected, proceed to step 3 as normal
        setOnboardingStep(3);
        setViewMode("3D");
      }
    } else {
      // Normal step progression
      setOnboardingStep((prev) => prev + 1);

      // Provide contextual help based on the step we're moving to
      if (onboardingStep === 3) {
        // Moving to step 4 (Customize Experience)
        setTimeout(() => {
          toast({
            title: "Customize Experience",
            description: "Choose visual style and special features",
            duration: 3000,
          });
        }, 500);
      }
    }
  };

  const prevOnboardingStep = () => {
    setOnboardingStep((prev) => prev - 1);
  };

  // Type-safe function for updating onboarding data
  const updateOnboardingData = (key: keyof OnboardingData, value: any) => {
    // Save current scroll position
    const scrollPosition = window.scrollY;

    // Update state
    setOnboardingData((prev) => ({
      ...prev,
      [key]: value,
    }));

    // Restore scroll position after state update
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollPosition);
    });
  };

  useEffect(() => {
    // When the searchQuery changes, search through all models
    if (searchQuery.trim() === "") {
      // If empty, show the default featured models
      fetchFeaturedModels();
    } else {
      performModelSearch(searchQuery);
    }
  }, [searchQuery]);

  // Add this function near the top of your file, with your other utility functions
  async function getThumbnailUrl(thumbnailName) {
    if (!thumbnailName) return "";

    const baseUrl = "https://f005.backblazeb2.com/file/contentThumbnails-dev";

    // Automatically convert .jpeg extension to .jpg
    if (thumbnailName.toLowerCase().endsWith(".jpeg")) {
      thumbnailName = thumbnailName.slice(0, -5) + ".jpg";
    }

    return `${baseUrl}/${thumbnailName}`;
  }

  const performModelSearch = async (query) => {
    if (query.trim() === "") {
      // If query is empty, revert to featured models
      fetchFeaturedModels();
      return;
    }
    try {
      // Get all models from the "models" collection
      const modelsSnapshot = await getDocs(collection(db, "models"));
      // Map over all documents to build an array of models with thumbnails resolved
      const modelsWithThumbnails = await Promise.all(
        modelsSnapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const modelId = data.id || docSnap.id;
          const name = data.name || "Untitled";
          const description = data.description || "";
          const thumbnailName = data.thumbnail || "";
          const thumbnail = thumbnailName
            ? await getThumbnailUrl(thumbnailName)
            : "";
          return { id: modelId, name, description, thumbnail };
        }),
      );
      // Filter models based on query (checking name and description)
      const lowerQuery = query.toLowerCase();
      const filteredModels = modelsWithThumbnails.filter(
        (model) =>
          model.name.toLowerCase().includes(lowerQuery) ||
          model.description.toLowerCase().includes(lowerQuery),
      );
      setFeaturedModels(filteredModels);
    } catch (error) {
      console.error("Error performing model search:", error);
    }
  };

  // NEW: Handler for file anchors
  const handleFileAnchorClicked = async (anchorId: string, anchorData: any) => {
    console.log(`File anchor clicked in editor: ${anchorId}`, anchorData);

    // 1. Open your “uploads” (media) panel
    setActiveSection("uploads");

    // 2. Highlight which anchor we're editing
    setEditingFileAnchorId(anchorId);

    // 3. Populate the right-hand info card
    if (anchorData) {
      setSelectedAnchorData({ id: anchorId, ...anchorData });
    } else {
      // Fallback: fetch from Firestore if not passed
      try {
        const refDoc = doc(db, "anchors", anchorId);
        const snap = await getDoc(refDoc);
        if (snap.exists()) {
          setSelectedAnchorData({ id: anchorId, ...snap.data() });
        } else {
          setSelectedAnchorData(null);
        }
      } catch (err) {
        console.error("Error fetching file anchor data:", err);
        setSelectedAnchorData(null);
      }
    }
  };

  const handleWebpageAnchorClicked = async (
    anchorId: string,
    anchorUrl: string,
  ) => {
    console.log(
      `Webpage anchor clicked in editor: ${anchorId}, URL: "${anchorUrl}"`,
    );

    // 1. Open the 'webpages' panel
    setActiveSection("webpages");

    // 2. Set the URL in the input field
    setExternalUrl(anchorUrl); // Use the existing state for the input

    // 3. Set the ID for editing/saving
    setEditingWebpageAnchorId(anchorId);

    // 4. Fetch anchor data for the settings card (reuse/adapt existing logic)
    try {
      const anchorRef = doc(db, "anchors", anchorId);
      const anchorSnap = await getDoc(anchorRef);
      if (anchorSnap.exists()) {
        // Set selectedAnchorData to show the settings card
        setSelectedAnchorData({ id: anchorId, ...anchorSnap.data() }); // Ensure ID is included
      } else {
        console.warn("Webpage anchor not found in Firestore:", anchorId);
        setSelectedAnchorData(null); // Clear if not found
      }
    } catch (error) {
      console.error("Error fetching webpage anchor data:", error);
      setSelectedAnchorData(null); // Clear on error
    }
  };

  // Handler for when a text anchor is clicked in ThreeViewer
  const handleTextAnchorClicked = async (
    anchorId: string,
    currentText: string,
  ) => {
    console.log(
      `Text anchor clicked in editor: ${anchorId}, Text: "${currentText}"`,
    );

    // Keep your existing logic:
    setActiveSection("text");
    setTextContent(currentText);
    setEditingTextAnchorId(anchorId);

    // 2) Fetch anchor data from Firestore and store in state:
    try {
      const anchorRef = doc(db, "anchors", anchorId);
      const anchorSnap = await getDoc(anchorRef);
      if (anchorSnap.exists()) {
        setSelectedAnchorData(anchorSnap.data());
      } else {
        console.warn("Anchor not found in Firestore:", anchorId);
        setSelectedAnchorData(null);
      }
    } catch (error) {
      console.error("Error fetching anchor data:", error);
      setSelectedAnchorData(null);
    }
  };

  const updateWebpageAnchorUrl = async (anchorId: string, newUrl: string) => {
    if (!anchorId || !newUrl.trim().startsWith("http")) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL starting with http(s)://",
        variant: "destructive",
      });
      return;
    }

    // 1. Update local state (optional, for immediate feedback if needed)
    setWebpageAnchors((prevAnchors) =>
      prevAnchors.map((anchor) =>
        anchor.id === anchorId ? { ...anchor, webpageUrl: newUrl } : anchor,
      ),
    );

    // 2. Update Firebase
    try {
      const anchorRef = doc(db, "anchors", anchorId);
      await updateDoc(anchorRef, {
        webpageUrl: newUrl,
        updatedAt: serverTimestamp(), // Optional: track updates
      });
      console.log(`Successfully updated URL for webpage anchor ${anchorId}`);
      toast({ title: "Webpage URL Updated", variant: "default" });

      // Clear editing state after successful update
      setEditingWebpageAnchorId(null);
      setSelectedAnchorData(null); // Clear settings card
      // Optionally clear the input field or leave it showing the new URL
      // setExternalUrl("");
    } catch (error) {
      console.error("Error updating webpage anchor URL:", error);
      toast({
        title: "Update Error",
        description: "Failed to save URL changes.",
        variant: "destructive",
      });
      // Optional: Revert local state if needed by re-fetching
    }
  };

  // Function to update text anchor content in state and Firebase
  const updateTextAnchorContent = async (anchorId: string, newText: string) => {
    if (!anchorId) return;

    // 1. Update local state immediately for responsiveness
    setTextAnchors((prevAnchors) =>
      prevAnchors.map((anchor) =>
        anchor.id === anchorId ? { ...anchor, textContent: newText } : anchor,
      ),
    );

    // 2. Update Firebase (debouncing recommended for production)
    try {
      const anchorRef = doc(db, "anchors", anchorId);
      await updateDoc(anchorRef, {
        textContent: newText,
        updatedAt: serverTimestamp(), // Optional: track updates
      });
      console.log(
        `Successfully updated text for anchor ${anchorId} in Firestore.`,
      );
    } catch (error) {
      console.error("Error updating text anchor in Firestore:", error);
      toast({
        title: "Update Error",
        description: "Failed to save text changes.",
        variant: "destructive",
      });
      // Optional: Revert local state if Firebase update fails
      // You might need to fetch the original text again here
    }
  };

  // Modify the text area onChange to call the update function
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setTextContent(newText);
    // Remove the call to updateTextAnchorContent here
  };

  // Modify the toggleSection function to clear editing state when closing text panel
  const toggleSection = (sectionId: string) => {
    setActiveSection((prev) => {
      const nextSection = prev === sectionId ? null : sectionId;

      // Clear state when closing or switching away from TEXT panel
      if (prev === "text" && nextSection !== "text") {
        setEditingTextAnchorId(null);
        setSelectedAnchorData(null);
        // Optionally clear textContent: setTextContent("");
      }
      // Clear state when closing or switching away from WEBPAGES panel
      if (prev === "webpages" && nextSection !== "webpages") {
        setEditingWebpageAnchorId(null);
        setSelectedAnchorData(null);
        // Optionally clear externalUrl: setExternalUrl("");
      }

      // Clear state when opening a panel *without* clicking an anchor first
      if (nextSection === "text" && prev !== "text") {
        setEditingTextAnchorId(null);
        setTextContent(""); // Start fresh
        setSelectedAnchorData(null);
      }
      if (nextSection === "webpages" && prev !== "webpages") {
        setEditingWebpageAnchorId(null);
        setExternalUrl(""); // Start fresh
        setSelectedAnchorData(null);
      }

      return nextSection;
    });
  };

  // Load blueprint anchors
  const loadBlueprintAnchors = async (blueprintId) => {
    try {
      const blueprintRef = doc(db, "blueprints", blueprintId);
      const blueprintSnap = await getDoc(blueprintRef);

      if (!blueprintSnap.exists()) return;

      const data = blueprintSnap.data();
      const anchorIDs = data.anchorIDs || [];

      if (anchorIDs.length === 0) return;

      const anchors = await Promise.all(
        anchorIDs.map(async (anchorId) => {
          const anchorRef = doc(db, "anchors", anchorId);
          const anchorSnap = await getDoc(anchorRef);
          if (!anchorSnap.exists()) return null;
          const anchorData = anchorSnap.data();
          anchorData.id = anchorId; // Ensure ID is attached
          return anchorData;
        }),
      );

      const validAnchors = anchors.filter((anchor) => anchor !== null);

      const models = validAnchors.filter(
        (anchor) => anchor.contentType === "model",
      );
      const webpages = validAnchors.filter(
        (anchor) => anchor.contentType === "webpage",
      );
      const texts = validAnchors.filter(
        (anchor) => anchor.contentType === "text",
      );
      const files = validAnchors.filter(
        (anchor) => anchor.contentType === "file",
      );
      const qrCodes = validAnchors.filter(
        // <<< ADD THIS FILTER
        (anchor) => anchor.contentType === "qrCode",
      );
      const elementsData = validAnchors.filter((anchor) =>
        ["infoCard", "marker", "media", "interactive"].includes(
          anchor.contentType,
        ),
      );

      setModelAnchors(models);
      setWebpageAnchors(webpages);
      setTextAnchors(texts as TextAnchor[]); // Cast to TextAnchor[]
      setFileAnchors(files);
      setQrCodeAnchors(qrCodes);
      setElements(elementsData.map(convertAnchorToElement));
    } catch (error) {
      console.error("Error loading anchors:", error);
    }
  };

  // Convert Firebase anchor to element
  const convertAnchorToElement = (anchorData) => {
    return {
      id: anchorData.contentID || `element-${Date.now()}`,
      anchorId: anchorData.id,
      type: anchorData.contentType,
      position: {
        x: anchorData.x || 0,
        y: anchorData.y || 0,
        z: anchorData.z || 0,
      },
      content: {
        title: anchorData.title || "Untitled Element",
        description: anchorData.description || "",
        trigger: anchorData.trigger || "click",
        mediaUrl: anchorData.mediaUrl || undefined,
        mediaType: anchorData.mediaType || undefined,
        textContent: anchorData.textContent || undefined,
      },
    };
  };

  // Fetch featured models
  async function fetchFeaturedModels() {
    try {
      // Query for models with category "artwork" (or change to your criteria)
      const q = query(
        collection(db, "models"),
        where("category", "==", "artwork"),
      );
      const snapshot = await getDocs(q);

      // Define type for model items
      interface FeaturedModel {
        id: string;
        name: string;
        thumbnail: string;
        description: string;
      }

      const tempModels: FeaturedModel[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();

        const modelId = data.id || docSnap.id;
        const name = data.name || "Untitled";
        const description = data.description || "";

        // Get the thumbnail URL from the name
        const thumbnailName = data.thumbnail || "";
        const thumbnailUrl = await getThumbnailUrl(thumbnailName);

        tempModels.push({
          id: modelId,
          name,
          thumbnail: thumbnailUrl, // Now we store the actual download URL
          description,
        });
      }

      setFeaturedModels(tempModels);
    } catch (error) {
      console.error("Error fetching featured models:", error);
    }
  }

  // ========================
  // ELEMENT MANAGEMENT
  // ========================

  // Add new element
  const addElement = async (type, mediaProps = null) => {
    try {
      if (!blueprintId) {
        toast({
          title: "Error",
          description: "Blueprint ID is missing. Cannot add element.",
          variant: "destructive",
        });
        return;
      }

      // Create new element
      const newElement = {
        id: `element-${Date.now()}`,
        type,
        position: { x: 0, y: 0, z: 0 },
        content: {
          title: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
          description: "Add description here",
          trigger: "click",
          // Add media properties if provided
          ...(mediaProps ? mediaProps : {}),
        },
      };

      // Rest of the function remains the same...
    } catch (error) {
      console.error("Error adding element:", error);
      toast({
        title: "Error",
        description: "Failed to add element. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Update element content
  const updateElementContent = async (id, content) => {
    try {
      const element = elements.find((el) => el.id === id);
      if (!element) return;

      const newContent = { ...element.content, ...content };

      // Update local state
      setElements((prev) =>
        prev.map((el) => (el.id === id ? { ...el, content: newContent } : el)),
      );

      // If selected, update selected element
      if (selectedElement?.id === id) {
        setSelectedElement((prev) => ({ ...prev, content: newContent }));
      }

      // Update in Firestore
      if (element.anchorId && blueprintId) {
        await updateDoc(doc(db, "anchors", element.anchorId), {
          ...content,
          updatedDate: new Date(),
        });
      }
    } catch (error) {
      console.error("Error updating element content:", error);
      toast({
        title: "Error",
        description: "Failed to update element. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Update element position
  const updateElementPosition = async (id, position) => {
    try {
      const element = elements.find((el) => el.id === id);
      if (!element) return;

      // Update local state
      setElements((prev) =>
        prev.map((el) => (el.id === id ? { ...el, position } : el)),
      );

      // If selected, update selected element
      if (selectedElement?.id === id) {
        setSelectedElement((prev) => ({ ...prev, position }));
      }

      // Update in Firestore if we have origin point
      if (element.anchorId && blueprintId && originPoint) {
        // Calculate real-world coordinates
        const offset = {
          x: position.x - originPoint.x,
          y: position.y - originPoint.y,
          z: position.z - originPoint.z,
        };

        const realWorldPos = {
          x: offset.x * 45.64,
          y: offset.y * 45.64,
          z: offset.z * 45.64,
        };

        await updateDoc(doc(db, "anchors", element.anchorId), {
          x: realWorldPos.x,
          y: realWorldPos.y,
          z: realWorldPos.z,
          updatedDate: new Date(),
        });
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

  // Delete element
  const deleteElement = async (id) => {
    try {
      const element = elements.find((el) => el.id === id);
      if (!element) return;

      // Update local state
      setElements((prev) => prev.filter((el) => el.id !== id));

      // If selected, clear selection
      if (selectedElement?.id === id) {
        setSelectedElement(null);
      }

      // Remove from Firestore
      if (element.anchorId && blueprintId) {
        // Remove from anchors collection
        await deleteDoc(doc(db, "anchors", element.anchorId));

        // Remove from blueprint's anchorIDs array
        await updateDoc(doc(db, "blueprints", blueprintId), {
          anchorIDs: arrayRemove(element.anchorId),
        });
      }

      toast({
        title: "Element Deleted",
        description: "The element has been removed from your blueprint.",
      });
    } catch (error) {
      console.error("Error deleting element:", error);
      toast({
        title: "Error",
        description: "Failed to delete element. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Duplicate element
  const duplicateElement = async (id) => {
    try {
      const element = elements.find((el) => el.id === id);
      if (!element) return;

      // Create copy with new ID
      const newElement = {
        ...element,
        id: `element-${Date.now()}`,
        position: {
          x: element.position.x + 0.1,
          y: element.position.y + 0.1,
          z: element.position.z,
        },
      };

      // Create new anchor in Firestore
      const newAnchorId = `anchor-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      await setDoc(doc(db, "anchors", newAnchorId), {
        id: newAnchorId,
        blueprintID: blueprintId,
        contentID: newElement.id,
        contentType: element.type,
        x: newElement.position.x,
        y: newElement.position.y,
        z: newElement.position.z,
        title: element.content.title + " (Copy)",
        description: element.content.description,
        trigger: element.content.trigger,
        mediaUrl: element.content.mediaUrl,
        mediaType: element.content.mediaType,
        createdDate: new Date(),
      });

      // Add anchor ID to blueprint
      if (!blueprintId) {
        console.error("Missing blueprintId when adding anchor to blueprint");
        return;
      }
      
      await updateDoc(doc(db, "blueprints", blueprintId), {
        anchorIDs: arrayUnion(newAnchorId),
      });

      // Update element with anchor ID
      newElement.anchorId = newAnchorId;

      // Add to local state
      setElements((prev) => [...prev, newElement]);
      setSelectedElement(newElement);

      toast({
        title: "Element Duplicated",
        description: "A copy of the element has been created.",
      });
    } catch (error) {
      console.error("Error duplicating element:", error);
      toast({
        title: "Error",
        description: "Failed to duplicate element. Please try again.",
        variant: "destructive",
      });
    }
  };

  // ========================
  // FILE ANCHOR HANDLING (NEW)
  // ========================
  const handleFileAnchorPlaced = async (
    fileInfo: any,
    realWorldCoords: { x: number; y: number; z: number },
  ) => {
    console.log(
      "[BlueprintEditor] handleFileAnchorPlaced triggered with:",
      fileInfo,
      realWorldCoords,
    );

    if (!blueprintId || !currentUser || !originPoint) {
      console.warn(
        "[BlueprintEditor] Missing blueprintId, currentUser, or originPoint - cannot create anchor",
      );
      return;
    }

    // if (!blueprintId || !currentUser || !originPoint) {
    //   // Added originPoint check
    //   toast({
    //     title: "Error Placing File",
    //     description:
    //       "Cannot save file anchor. Missing blueprint, user info, or origin point.",
    //     variant: "destructive",
    //   });
    //   return;
    // }

    console.log(
      "[BlueprintEditor] handleFileAnchorPlaced called with:",
      fileInfo,
      realWorldCoords,
    );

    // 1. Generate unique IDs
    const newAnchorId = `anchor-file-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const newContentId = `file-${Date.now()}`; // Use a consistent prefix

    // 2. Determine file type for the anchor
    const fileTypeStr = getSimpleFileType(fileInfo);

    // 3. Create the new anchor object for local state
    const newAnchor = {
      id: newAnchorId,
      contentType: "file",
      fileType: fileTypeStr,
      fileName: fileInfo.name || "File",
      fileUrl: fileInfo.url,
      x: realWorldCoords.x,
      y: realWorldCoords.y,
      z: realWorldCoords.z,
      contentID: newContentId,
      createdDate: new Date(),
      blueprintID: blueprintId,
      // Add default rotation/scale if needed, or get from ThreeViewer if you implement transform later
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      width: fileInfo.width || 1, // Default width if not provided
      height: fileInfo.height || 1, // Default height if not provided
    };

    // 4. Update local state IMMEDIATELY
    setFileAnchors((prev) => [...prev, newAnchor]);
    console.log(
      "[BlueprintEditor] Updated local fileAnchors state:",
      newAnchor,
    );

    // 5. Save to Firestore (asynchronously)
    try {
      await setDoc(doc(db, "anchors", newAnchorId), {
        id: newAnchorId,
        createdDate: newAnchor.createdDate,
        contentID: newAnchor.contentID,
        contentType: "file",
        fileType: newAnchor.fileType,
        fileName: newAnchor.fileName,
        fileUrl: newAnchor.fileUrl,
        blueprintID: blueprintId,
        x: newAnchor.x,
        y: newAnchor.y,
        z: newAnchor.z,
        rotationX: newAnchor.rotationX,
        rotationY: newAnchor.rotationY,
        rotationZ: newAnchor.rotationZ,
        scaleX: newAnchor.scaleX,
        scaleY: newAnchor.scaleY,
        scaleZ: newAnchor.scaleZ,
        width: newAnchor.width,
        height: newAnchor.height,
        host: currentUser.uid,
        isPrivate: false,
      });

      await updateDoc(doc(db, "blueprints", blueprintId), {
        anchorIDs: arrayUnion(newAnchorId),
      });
      console.log(
        "[BlueprintEditor] Creating new file anchor in Firestore for:",
        fileInfo.name,
      );

      toast({
        title: "File Placed",
        description: `${newAnchor.fileName} added to your blueprint.`,
        variant: "default",
      });
      console.log(
        "[BlueprintEditor] Successfully saved file anchor to Firestore:",
        newAnchorId,
      );
    } catch (error) {
      console.error("Error saving file anchor to Firestore:", error);
      toast({
        title: "Save Error",
        description: "Failed to save file anchor to the database.",
        variant: "destructive",
      });
      // Optional: Rollback local state update if Firestore save fails
      // setFileAnchors((prev) => prev.filter(anchor => anchor.id !== newAnchorId));
    }
  };

  // ========================
  // TEXT LABEL HANDLING (NEW HANDLER)
  // ========================
  const handleTextAnchorPlaced = async (
    text: string,
    realWorldCoords: { x: number; y: number; z: number },
  ) => {
    if (!blueprintId || !currentUser) {
      toast({
        title: "Error",
        description: "Cannot save text anchor. Missing blueprint or user info.",
        variant: "destructive",
      });
      return;
    }

    console.log(
      "[BlueprintEditor] handleTextAnchorPlaced called with:",
      text,
      realWorldCoords,
    );

    // 1. Generate a unique ID locally
    const newAnchorId = `anchor-text-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const newElementId = `element-${Date.now()}`; // Also create an element ID if needed

    // 2. Create the new anchor object for local state
    const newAnchor = {
      id: newAnchorId,
      textContent: text,
      x: realWorldCoords.x,
      y: realWorldCoords.y,
      z: realWorldCoords.z,
      contentType: "text", // Ensure contentType is set
      contentID: newElementId, // Link to element if applicable
      createdDate: new Date(), // Add creation date
      blueprintID: blueprintId, // Add blueprint ID
    };

    // 3. Update local state IMMEDIATELY
    setTextAnchors((prev) => [...prev, newAnchor]);
    console.log(
      "[BlueprintEditor] Updated local textAnchors state:",
      newAnchor,
    );

    // 4. Save to Firestore (asynchronously)
    try {
      await setDoc(doc(db, "anchors", newAnchorId), {
        id: newAnchorId,
        createdDate: newAnchor.createdDate,
        contentID: newAnchor.contentID,
        contentType: "text",
        textContent: text,
        blueprintID: blueprintId,
        x: realWorldCoords.x,
        y: realWorldCoords.y,
        z: realWorldCoords.z,
        host: currentUser.uid, // Store who created it
        isPrivate: false, // Default privacy
      });

      await updateDoc(doc(db, "blueprints", blueprintId), {
        anchorIDs: arrayUnion(newAnchorId),
      });

      toast({
        title: "Text Label Placed",
        description: `"${text}" added to your blueprint.`,
        variant: "default",
      });
      console.log(
        "[BlueprintEditor] Successfully saved text anchor to Firestore:",
        newAnchorId,
      );
    } catch (error) {
      console.error("Error saving text anchor to Firestore:", error);
      toast({
        title: "Save Error",
        description: "Failed to save text label to the database.",
        variant: "destructive",
      });
      // Optional: Rollback local state update if Firestore save fails
      // setTextAnchors((prev) => prev.filter(anchor => anchor.id !== newAnchorId));
    }
  };

  // ========================
  // AREA MARKING & REFERENCE POINTS
  // ========================

  // Handle area marking
  const handleAreaMarked = (areaBounds) => {
    setPendingArea(areaBounds);

    if (remarkingAreaId) {
      // If we're re-marking an existing area, pre-fill with its name
      const area = markedAreas.find((a) => a.id === remarkingAreaId);
      if (area) {
        setAreaName(area.name);
      } else {
        setAreaName("");
      }
    } else if (onboardingStep === 3 && onboardingData.keyAreas.length > 0) {
      // Find an unmarked area from the selection to suggest
      const markedAreaNames = markedAreas.map((area) =>
        area.name.toLowerCase(),
      );

      // Find first unassigned area
      const unusedArea = onboardingData.keyAreas.find((areaKey) => {
        const areaLabel = getAreaLabel(
          areaKey,
          prefillData.industry,
        ).toLowerCase();
        return !markedAreaNames.includes(areaLabel);
      });

      if (unusedArea) {
        setAreaName(getAreaLabel(unusedArea, prefillData.industry));
      } else {
        setAreaName(
          getAreaLabel(onboardingData.keyAreas[0], prefillData.industry),
        );
      }
    } else {
      setAreaName("");
    }

    setAreaNameDialogOpen(true);

    // Reset corner1Ref after successful area marking
    corner1Ref.current = null;

    // If in onboarding, also show a success toast
    if (onboardingStep === 3) {
      toast({
        title: "Area Defined!",
        description: "Now give it a name to save it.",
        variant: "default",
      });
    }
  };

  // Save marked area
  const saveMarkedArea = async () => {
    if (!pendingArea || !blueprintId) return;

    try {
      if (remarkingAreaId) {
        // Update existing area
        const existingArea = markedAreas.find((a) => a.id === remarkingAreaId);

        if (!existingArea) {
          toast({
            title: "Error",
            description: "Could not find the area to update.",
            variant: "destructive",
          });
          return;
        }

        const updatedArea = {
          ...existingArea,
          min: pendingArea.min,
          max: pendingArea.max,
          updatedAt: new Date(),
        };

        // First remove the old area from Firestore
        await updateDoc(doc(db, "blueprints", blueprintId), {
          markedAreas: arrayRemove(existingArea),
        });

        // Then add the updated area
        await updateDoc(doc(db, "blueprints", blueprintId), {
          markedAreas: arrayUnion(updatedArea),
        });

        // Update local state - replace the old area with the updated one
        setMarkedAreas((prev) =>
          prev.map((a) => (a.id === remarkingAreaId ? updatedArea : a)),
        );

        toast({
          title: "Area Updated",
          description: `"${updatedArea.name}" area has been updated.`,
        });
      } else {
        // Create new area
        const newArea = {
          id: `area-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          name: areaName.trim() || "Unnamed Area",
          min: pendingArea.min,
          max: pendingArea.max,
          color: "#" + Math.floor(Math.random() * 16777215).toString(16), // Random color
          createdAt: new Date(),
        };

        // Add to local state
        setMarkedAreas((prev) => [...prev, newArea]);

        // Save to Firestore
        await updateDoc(doc(db, "blueprints", blueprintId), {
          markedAreas: arrayUnion(newArea),
        });

        toast({
          title: "Area Marked",
          description: `"${newArea.name}" area has been saved.`,
        });
      }

      // Reset states
      setAreaName("");
      setPendingArea(null);
      setAreaNameDialogOpen(false);
      setIsMarkingArea(false);
      setRemarkingAreaId(null);
      corner1Ref.current = null;
    } catch (error) {
      console.error("Error saving area:", error);
      toast({
        title: "Error",
        description: "Failed to save area. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Delete marked area
  const deleteMarkedArea = async (areaId) => {
    try {
      // Find the area
      const area = markedAreas.find((a) => a.id === areaId);
      if (!area || !blueprintId) return;

      // Remove from local state
      setMarkedAreas((prev) => prev.filter((a) => a.id !== areaId));

      // Remove from Firestore
      const blueprintRef = doc(db, "blueprints", blueprintId);
      const blueprintSnap = await getDoc(blueprintRef);

      if (blueprintSnap.exists()) {
        const data = blueprintSnap.data();
        const areas = data.markedAreas || [];
        const updatedAreas = areas.filter((a) => a.id !== areaId);

        await updateDoc(blueprintRef, {
          markedAreas: updatedAreas,
        });
      }

      toast({
        title: "Area Deleted",
        description: "The marked area has been removed.",
      });
    } catch (error) {
      console.error("Error deleting area:", error);
      toast({
        title: "Error",
        description: "Failed to delete area. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Re-mark an existing area
  const handleRemarkArea = (areaId, e) => {
    // Prevent the area from being selected when clicking re-mark button
    if (e) e.stopPropagation();

    // Find the area being re-marked
    const area = markedAreas.find((a) => a.id === areaId);
    if (!area) return;

    // Set up for re-marking
    setIsMarkingArea(true);
    setRemarkingAreaId(areaId);

    // Switch to 3D view if not already there
    if (viewMode !== "3D") {
      setViewMode("3D");
    }

    // Show guidance toast
    toast({
      title: "Re-mark Area",
      description: `Click and drag to redefine the boundaries for "${area.name}"`,
      duration: 5000,
    });
  };

  // Compute alignment between 2D and 3D
  const computeAlignment = () => {
    if (referencePoints2D.length < 2 || referencePoints3D.length < 2) {
      toast({
        title: "Insufficient Reference Points",
        description:
          "Please set at least 2 reference points in both 2D and 3D views.",
        variant: "destructive",
      });
      return;
    }

    // If exact 2 points, do direct 2-point alignment
    if (referencePoints2D.length === 2 && referencePoints3D.length === 2) {
      setShowDistanceDialog(true);
    } else {
      // For 3+ points, implement more sophisticated alignment algorithm
      // This would involve calculating a best-fit transformation matrix
      toast({
        title: "Advanced Alignment",
        description: "Multi-point alignment is being calculated.",
      });

      // Implement your alignment algorithm here
    }
  };

  // Compute scale from two points and real-world distance
  const computeTwoPointScale = async () => {
    if (referencePoints3D.length < 2 || realDistance <= 0) {
      toast({
        title: "Invalid Data",
        description: "Need 2 points in 3D and a valid distance.",
        variant: "destructive",
      });
      return;
    }

    // Calculate 3D distance between points
    const [ptA, ptB] = referencePoints3D;
    const dx = (ptB.x3D || 0) - (ptA.x3D || 0);
    const dy = (ptB.y3D || 0) - (ptA.y3D || 0);
    const dz = (ptB.z3D || 0) - (ptA.z3D || 0);

    const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist3D === 0) {
      toast({
        title: "Invalid Distance",
        description: "3D distance between points is zero.",
        variant: "destructive",
      });
      return;
    }

    // Calculate scale factor
    const scale = realDistance / dist3D;
    setScaleFactor(scale);

    // Save to Firestore
    try {
      if (blueprintId) {
        await updateDoc(doc(db, "blueprints", blueprintId), {
          scale: scale,
        });

        toast({
          title: "Scale Set",
          description: `Scale factor of ${scale.toFixed(2)} has been set.`,
        });
      }
    } catch (error) {
      console.error("Error saving scale factor:", error);
    }

    // Close dialogs
    setShowDistanceDialog(false);
    setShowAlignmentWizard(false);

    // Switch to 3D view and initiate origin setting
    setTimeout(() => {
      setViewMode("3D");
      setIsChoosingOrigin(true);
    }, 300);
  };

  // ========================
  // QR CODE MANAGEMENT
  // ========================

  // Handle QR code placement
  const handlePlaceQRCode = async (point) => {
    if (!originPoint || !blueprintId) return;

    try {
      // Calculate offset from origin
      const offset = new THREE.Vector3().subVectors(point, originPoint);

      // Create anchor ID
      const newAnchorId = `anchor-qr-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      // Save to Firestore
      await setDoc(doc(db, "anchors", newAnchorId), {
        id: newAnchorId,
        blueprintID: blueprintId,
        contentType: "qrCode",
        x: offset.x * 45.64,
        y: offset.y * 45.64,
        z: offset.z * 45.64,
        locationName: `Location ${currentPlacingIndex + 1}`,
        createdDate: new Date(),
      });

      // Add to blueprint
      await updateDoc(doc(db, "blueprints", blueprintId), {
        anchorIDs: arrayUnion(newAnchorId),
      });

      // Build QR code data
      const dataStr = `blueprintId=${blueprintId}&anchorId=${newAnchorId}&x=${offset.x.toFixed(2)}&y=${offset.y.toFixed(2)}&z=${offset.z.toFixed(2)}`;

      // <<< --- ADD THIS SECTION --- >>>
      // Create the data object for the new anchor to update local state
      const newAnchorData = {
        id: newAnchorId,
        contentType: "qrCode",
        x: offset.x * 45.64, // Use the saved real-world coordinates
        y: offset.y * 45.64,
        z: offset.z * 45.64,
        locationName: `Location ${currentPlacingIndex + 1}`, // Include other relevant data if needed
        createdDate: new Date(),
      };

      // Update the local state immediately
      setQrCodeAnchors((prevAnchors) => [...prevAnchors, newAnchorData]);
      console.log(
        "[BlueprintEditor] Updated local qrCodeAnchors state:",
        newAnchorData,
      );
      // <<< --- END ADDED SECTION --- >>>
      // Update state
      setQrLocations((prev) => [...prev, point]);
      setQrAnchorIds((prev) => [...prev, newAnchorId]);
      setQrCodeStrings((prev) => [...prev, dataStr]);

      // Move to next placement or show QR code
      if (qrGenerationActive) {
        // Update current placing index
        setCurrentPlacingIndex((prev) => prev + 1);

        // Show toast
        toast({
          title: `QR Code ${currentPlacingIndex + 1} Placed`,
          description: "Location saved successfully!",
        });

        // Check if we've placed enough QR codes
        if (currentPlacingIndex + 1 >= 3) {
          toast({
            title: "Minimum QR Codes Placed",
            description:
              "You've placed the minimum required QR codes. Click 'Finish' when ready.",
            variant: "default",
            duration: 5000,
          });
        }

        if (currentPlacingIndex + 1 >= 6) {
          toast({
            title: "Maximum QR Codes Reached",
            description:
              "You've reached the maximum of 6 QR codes. Click 'Finish' to continue.",
            variant: "default",
            duration: 5000,
          });
        }
      } else {
        // Show QR code dialog for individual placement
        setQrCodeValue(dataStr);
        setQrCodeModalOpen(true);
      }
    } catch (error) {
      console.error("Error placing QR code:", error);
      toast({
        title: "Error",
        description: "Failed to place QR code. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Complete QR generation process
  const completeQRGeneration = () => {
    setQrGenerationActive(false);
    setQrGenerationStep(0);
    setQrPlacementMode(false);
    setCurrentPlacingIndex(0);

    // Show invite dialog
    setShowInviteModal(true);
  };

  // ========================
  // BLUEPRINT ACTIVATION & COLLABORATION
  // ========================

  // Activate blueprint
  const handleActivateBlueprint = async () => {
    if (!blueprintId) return;

    try {
      setIsActivating(true);

      // Update blueprint status
      await updateDoc(doc(db, "blueprints", blueprintId), {
        status: "active",
        activatedAt: new Date(),
      });

      // Update local state
      setBlueprintStatus("active");

      // Show success toast
      toast({
        title: "Blueprint Activated",
        description: "Your blueprint is now live and ready to use!",
        variant: "default",
      });

      // Start QR generation flow
      setQrGenerationActive(true);
      setQrGenerationStep(0);
    } catch (error) {
      console.error("Error activating blueprint:", error);
      toast({
        title: "Activation Failed",
        description: "Failed to activate blueprint. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsActivating(false);
    }
  };

  // Invite team member
  const handleInviteTeamMember = async () => {
    if (!inviteEmail.trim() || !currentUser || !blueprintId) return;

    setIsInviting(true);

    try {
      // Handle multiple emails
      const emails = inviteEmail
        .split(",")
        .map((email) => email.trim())
        .filter((email) => email);

      // Process each email
      for (const email of emails) {
        // Create invitation in Firestore
        await addDoc(collection(db, "teams", currentUser.uid, "invitations"), {
          email,
          blueprintId,
          invitedBy: currentUser.uid,
          blueprintName: blueprintTitle,
          status: "pending",
          createdAt: new Date(),
        });
      }

      // Reset and show success
      setInviteEmail("");
      setInviteSuccess(true);

      // Hide success after delay
      setTimeout(() => {
        setInviteSuccess(false);
      }, 3000);
    } catch (error) {
      console.error("Error inviting team member:", error);
      toast({
        title: "Invitation Failed",
        description: "Failed to send invitation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsInviting(false);
    }
  };

  // ========================
  // FILE & MODEL HANDLING
  // ========================

  // Handle file upload
  const handleFileUpload = async (file, type = "standard") => {
    if (!file || !blueprintId) return;

    // Use the state variable defined at the component level
    setUploadLoading(true);

    try {
      const fileType = file.type.toLowerCase();

      // Handle image uploads for floor plans
      if (
        type === "floorplan" &&
        (fileType.includes("image") || fileType.includes("pdf"))
      ) {
        // Floor plan upload logic (unchanged)...
        // Upload to Firebase Storage
        const storageRef = ref(storage, `blueprints/${blueprintId}/floorplan`);
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);

        // Update Firestore
        await updateDoc(doc(db, "blueprints", blueprintId), {
          floorPlanUrl: downloadURL,
        });

        // Update local state
        setFloorPlanImage(downloadURL);

        toast({
          title: "Floor Plan Uploaded",
          description: "Your floor plan has been uploaded successfully.",
        });
      }
      // Handle 3D model uploads
      else if (
        type === "3dmodel" &&
        (fileType.includes("gltf") ||
          fileType.includes("glb") ||
          file.name.endsWith(".glb") ||
          file.name.endsWith(".gltf"))
      ) {
        // 3D model upload logic (unchanged)...
        // Upload to Firebase Storage
        const modelPath = `blueprints/${blueprintId}/3d/${file.name}`;
        const storageRef = ref(storage, modelPath);

        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);

        // Update Firestore
        await updateDoc(doc(db, "blueprints", blueprintId), {
          floorPlan3DUrl: modelPath,
        });

        // Update local state
        setModel3DPath(modelPath);

        toast({
          title: "3D Model Uploaded",
          description: "Your 3D model has been uploaded successfully.",
        });
      }
      // Handle regular file uploads
      else {
        // Determine file type category for better organization
        let fileCategory = "misc";
        if (fileType.includes("image")) fileCategory = "images";
        else if (fileType.includes("video")) fileCategory = "videos";
        else if (fileType.includes("audio")) fileCategory = "audio";
        else if (fileType.includes("pdf")) fileCategory = "documents";

        // Create unique filename to prevent collisions
        const uniqueFilename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

        // Create storage reference with organized path
        const storageRef = ref(
          storage,
          `uploads/${blueprintId}/${fileCategory}/${uniqueFilename}`,
        );

        // Show immediate toast for feedback
        toast({
          title: "Uploading File...",
          description: `Preparing ${file.name}`,
          variant: "default",
          duration: 2000, // Auto-dismiss after 2 seconds
        });

        // Upload with progress tracking
        const uploadTask = uploadBytes(storageRef, file);

        // After upload completes
        const snapshot = await uploadTask;
        const downloadURL = await getDownloadURL(snapshot.ref);

        // Show a success toast
        toast({
          title: "Upload Complete",
          description: `${file.name} has been uploaded successfully.`,
          variant: "default",
        });

        const simpleType = getSimpleFileType(fileType); // <—

        const newFile = {
          id: Date.now().toString(),
          name: file.name,
          url: downloadURL,
          mimeType: file.type, // keep the raw MIME
          fileType: simpleType, // add the simplified label
          uploadDate: new Date(),
          fileSize: file.size,
          fileCategory,
          thumbnailUrl: simpleType === "image" ? downloadURL : null,
          storageLocation: snapshot.ref.fullPath,
        };

        // Create more detailed file document in separate collection
        await setDoc(doc(db, "files", newFile.id), {
          id: newFile.id,
          name: file.name,
          fileType: file.type,
          fileCategory: fileCategory,
          url: downloadURL,
          storageLocation: snapshot.ref.fullPath,
          blueprintId: blueprintId,
          uploadDate: new Date(),
          uploadedBy: currentUser?.uid || "anonymous",
          fileSize: file.size,
          mimeType: file.type,
          metadata: {
            originalFilename: file.name,
            contentType: file.type,
            ...(file.lastModified
              ? { lastModified: new Date(file.lastModified) }
              : {}),
          },
        });

        setUploadedFiles((prev) => {
          // Check if this file already exists in the array (by URL or id)
          const exists = prev.some(
            (f) => f.id === newFile.id || f.url === newFile.url,
          );
          if (exists) return prev;

          // Add new file at the beginning of the array (newest first)
          return [newFile, ...prev];
        });

        // Get current uploadedFiles array, then update it properly
        try {
          const blueprintRef = doc(db, "blueprints", blueprintId);
          const blueprintSnap = await getDoc(blueprintRef);

          if (blueprintSnap.exists()) {
            // Get current array or initialize empty array
            const currentFiles = blueprintSnap.data().uploadedFiles || [];

            // Check if file already exists
            const fileExists = currentFiles.some(
              (f) => f.id === newFile.id || f.url === newFile.url,
            );

            if (!fileExists) {
              // Add new file to array
              const updatedFiles = [newFile, ...currentFiles];

              // Update Firestore with complete array
              await updateDoc(blueprintRef, {
                uploadedFiles: updatedFiles,
              });

              console.log(
                "Upload successfully added to Firestore uploadedFiles array",
              );
            }
          }
        } catch (error) {
          console.error("Error updating uploadedFiles in Firestore:", error);
        }

        // Success toast
        toast({
          title: "File Uploaded Successfully",
          description: `${file.name} is ready to use in your blueprint.`,
          variant: "default",
          duration: 4000,
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Set placement mode to simplify adding
                setViewMode("3D");
                setPlacementMode({
                  type: fileType.includes("image")
                    ? "file"
                    : fileType.includes("video")
                      ? "file"
                      : "file",
                  data: {
                    file: newFile,
                    fileType: fileType.includes("image")
                      ? "image"
                      : fileType.includes("video")
                        ? "video"
                        : "document",
                    url: downloadURL,
                    name: file.name,
                  },
                });

                toast({
                  title: "Ready to Place",
                  description: "Click in the 3D view to place your file",
                  duration: 5000,
                });
              }}
            >
              Place Now
            </Button>
          ),
        });
      }
    } catch (error) {
      console.error("File upload error:", error);
      toast({
        title: "Upload Failed",
        description: `Could not upload ${file.name}. ${error instanceof Error ? error.message : "Please try again."}`,
        variant: "destructive",
      });
    } finally {
      setUploadLoading(false);
    }
  };

  // Add this new function to refresh files from Firestore
  const refreshUploadedFiles = async () => {
    if (!blueprintId) {
      console.error("Missing blueprintId for refreshUploadedFiles");
      return;
    }
    
    try {
      const blueprintRef = doc(db, "blueprints", blueprintId);
      const blueprintSnap = await getDoc(blueprintRef);

      if (blueprintSnap.exists()) {
        const data = blueprintSnap.data();
        // Load uploaded files
        if (data.uploadedFiles && Array.isArray(data.uploadedFiles)) {
          // Sort by upload date (newest first) before setting state
          const sortedFiles = [...data.uploadedFiles].sort((a, b) => {
            // Convert string dates to Date objects if needed
            const dateA =
              a.uploadDate instanceof Date
                ? a.uploadDate
                : new Date(a.uploadDate);
            const dateB =
              b.uploadDate instanceof Date
                ? b.uploadDate
                : new Date(b.uploadDate);
            return dateB.getTime() - dateA.getTime();
          });
          setUploadedFiles(sortedFiles);
        }
      }
    } catch (error) {
      console.error("Error refreshing files:", error);
    }
  };

  // Handle model click/placement
  const handleFeaturedModelClick = async (model) => {
    // Check if the origin point has been set
    if (!originPoint) {
      toast({
        title: "Error",
        description: "Origin point is not set. Please set the origin first.",
        variant: "destructive",
      });
      return;
    }
    try {
      // Create a unique anchor ID
      const newAnchorId = `anchor-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)}`;

      // Create the document in Firestore
      await setDoc(doc(db, "anchors", newAnchorId), {
        id: newAnchorId,
        createdDate: new Date(),
        contentID: `element-${Date.now()}`,
        contentType: "model",
        modelName: model.name,
        host: currentUser?.uid || "anonymous", // Use your auth context
        blueprintID: blueprintId,
        x: 0, // Default offset (origin)
        y: 0,
        z: 0,
        isPrivate: false,
      });

      // Add the anchor ID to the blueprint
      if (!blueprintId) {
        console.error("Missing blueprintId for anchor addition");
        return;
      }
      
      await updateDoc(doc(db, "blueprints", blueprintId), {
        anchorIDs: arrayUnion(newAnchorId),
      });

      setPlacementMode({ type: "model", data: model });
      toast({
        title: "Placement Mode",
        description: `Click somewhere in the 3D view to place the model: ${model.name}`,
      });
    } catch (error) {
      console.error("Error adding featured model:", error);
      toast({
        title: "Error",
        description: "Failed to add the model. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleViewerBackgroundClick = () => {
    setActiveSection(null); // close left panel
    setSelectedAnchorData(null); // hide right card
    setEditingTextAnchorId(null); // clear any per‑type editing state
    setEditingFileAnchorId(null);
    setEditingWebpageAnchorId(null);
  };

  // BlueprintEditor.tsx

  const handleLoadExternalLink = async () => {
    if (!externalUrl.trim().startsWith("http")) {
      toast({
        title: "Invalid URL",
        description: "Please include https:// in the link",
        variant: "destructive",
      });
      return;
    }

    // Ensure origin point is set, as it's needed for eventual coordinate calculation
    if (!originPoint || !blueprintId) {
      toast({
        title: "Origin Not Set",
        description: "Please set the origin point first before placing links.",
        variant: "destructive",
      });
      return;
    }

    // Enter placement mode with only the URL. Anchor creation is deferred.
    setPlacementMode({
      type: "link",
      data: { url: externalUrl }, // No anchorId here for new links
    });

    toast({
      title: "Webpage Placement Mode",
      description: "Click in the 3D view to place your link anchor.",
    });

    // Reset input field
    setExternalUrl("");
  };

  // Handle external link
  // const handleLoadExternalLink = async () => {
  //   if (!externalUrl.trim().startsWith("http")) {
  //     toast({
  //       title: "Invalid URL",
  //       description: "Please include https:// in the link",
  //       variant: "destructive",
  //     });
  //     return;
  //   }

  //   if (!originPoint || !blueprintId) {
  //     toast({
  //       title: "Origin Not Set",
  //       description: "Please set the origin point first.",
  //       variant: "destructive",
  //     });
  //     return;
  //   }

  //   try {
  //     // Create anchor ID
  //     const newAnchorId = `anchor-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  //     // Create anchor in Firestore
  //     await setDoc(doc(db, "anchors", newAnchorId), {
  //       id: newAnchorId,
  //       createdDate: new Date(),
  //       contentID: `element-${Date.now()}`,
  //       contentType: "webpage",
  //       webpageUrl: externalUrl,
  //       host: currentUser?.uid || "anonymous",
  //       blueprintID: blueprintId,
  //       x: 0,
  //       y: 0,
  //       z: 0, // Default position at origin
  //       isPrivate: false,
  //     });

  //     // Add to blueprint
  //     await updateDoc(doc(db, "blueprints", blueprintId), {
  //       anchorIDs: arrayUnion(newAnchorId),
  //     });

  //     // Add to local state
  //     setWebpageAnchors((prev) => [
  //       ...prev,
  //       {
  //         id: newAnchorId,
  //         webpageUrl: externalUrl,
  //         x: 0,
  //         y: 0,
  //         z: 0,
  //         contentType: "webpage",
  //       },
  //     ]);

  //     // Enter placement mode
  //     setPlacementMode({
  //       type: "link",
  //       data: { url: externalUrl, anchorId: newAnchorId }, // Pass anchorId here
  //     });

  //     toast({
  //       title: "Placement Mode",
  //       description: "Click in the 3D view to place your link anchor.",
  //     });

  //     // Reset input
  //     setExternalUrl("");
  //   } catch (error) {
  //     console.error("Error adding link:", error);
  //     toast({
  //       title: "Error",
  //       description: "Failed to add link. Please try again.",
  //       variant: "destructive",
  //     });
  //   }
  // };

  // BlueprintEditor.tsx

  const handlePlacementComplete = async (
    position: THREE.Vector3,
    anchorId: string | null
  ) => {
    // We'll use the current placement mode from state instead of receiving it as param
    const activePlacementMode = placementMode;
    const anchorIdToUpdate = anchorId;
    console.log(
      "[BlueprintEditor handlePlacementComplete] Checking prerequisites:",
    );
    console.log("  originPoint:", !!originPoint);
    console.log("  activePlacementMode:", activePlacementMode); // Log the received mode
    console.log("  blueprintId:", !!blueprintId);
    console.log("  currentUser:", !!currentUser);

    if (!originPoint || !activePlacementMode || !blueprintId || !currentUser) {
      console.warn(
        "Placement incomplete: One or more prerequisites are missing. See logs above.",
      );
      // setPlacementMode(null) is already called in finally/catch, so no need here if it returns.
      return;
    }
    try {
      const offset = new THREE.Vector3().subVectors(position, originPoint);
      const scaledOffset = {
        x: offset.x * 45.64, // Assuming 45.64 is your scale factor
        y: offset.y * 45.64,
        z: offset.z * 45.64,
      };

      if (activePlacementMode.type === "model" && anchorIdToUpdate) {
        // Existing logic for updating a model anchor's position
        await updateDoc(doc(db, "anchors", anchorIdToUpdate), {
          x: scaledOffset.x,
          y: scaledOffset.y,
          z: scaledOffset.z,
        });
        setModelAnchors((prev) =>
          prev.map((anchor) =>
            anchor.id === anchorIdToUpdate
              ? {
                  ...anchor,
                  x: scaledOffset.x,
                  y: scaledOffset.y,
                  z: scaledOffset.z,
                }
              : anchor,
          ),
        );
        toast({
          title: "Model Placed",
          description: "The model has been placed successfully.",
        });
      } else if (
        activePlacementMode.type === "link" &&
        activePlacementMode.data.url &&
        !anchorIdToUpdate
      ) {
        // Logic for CREATING a NEW webpage anchor
        const urlToPlace = activePlacementMode.data.url;
        const newAnchorId = `anchor-webpage-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        await setDoc(doc(db, "anchors", newAnchorId), {
          id: newAnchorId,
          createdDate: new Date(),
          contentID: `element-webpage-${Date.now()}`, // Or a more specific contentID
          contentType: "webpage",
          webpageUrl: urlToPlace,
          host: currentUser?.uid || "anonymous",
          blueprintID: blueprintId,
          x: scaledOffset.x,
          y: scaledOffset.y,
          z: scaledOffset.z,
          isPrivate: false,
          // Add default rotation/scale if needed by ThreeViewer's webpage rendering
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          scaleX: 1,
          scaleY: 1,
          scaleZ: 1,
        });

        if (!blueprintId) {
          console.error("Missing blueprintId when adding webpage anchor");
          return;
        }
        
        await updateDoc(doc(db, "blueprints", blueprintId), {
          anchorIDs: arrayUnion(newAnchorId),
        });

        const newWebpageAnchor = {
          id: newAnchorId,
          webpageUrl: urlToPlace,
          x: scaledOffset.x,
          y: scaledOffset.y,
          z: scaledOffset.z,
          contentType: "webpage",
          // Include rotation/scale if your ThreeViewer effect uses them
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          scaleX: 1,
          scaleY: 1,
          scaleZ: 1,
        };

        setWebpageAnchors((prev) => [...prev, newWebpageAnchor as any]); // Cast to any if type mismatch temp

        toast({
          title: "Webpage Link Placed",
          description: `Link to ${urlToPlace} added successfully.`,
        });
      } else if (
        activePlacementMode.type === "file" &&
        activePlacementMode.data &&
        !anchorIdToUpdate
      ) {
        // This case should ideally be handled by `handleFileAnchorPlaced` or similar.
        // If `onPlacementComplete` is also used for new files, the logic would be similar to new links.
        // For now, assuming `handleFileAnchorPlaced` handles new files.
        console.log(
          "File placement completion via onPlacementComplete - review if this is intended path for NEW files.",
        );
      }
      // Add other element type handling if necessary

      setPlacementMode(null); // Reset placement mode AFTER successful operation
    } catch (error) {
      console.error("Error completing placement:", error);
      toast({
        title: "Error",
        description: "Failed to complete placement. Please try again.",
        variant: "destructive",
      });
      setPlacementMode(null); // Also reset on error
    }
  };

  // Handle placement completion
  // const handlePlacementComplete = async (position, anchorId) => {
  //   if (!originPoint || !placementMode || !blueprintId) return;

  //   try {
  //     // Calculate offset from origin
  //     const offset = new THREE.Vector3().subVectors(position, originPoint);
  //     const scaledOffset = {
  //       x: offset.x * 45.64,
  //       y: offset.y * 45.64,
  //       z: offset.z * 45.64,
  //     };

  //     if (placementMode.type === "model" && anchorId) {
  //       // Update model anchor
  //       await updateDoc(doc(db, "anchors", anchorId), {
  //         x: scaledOffset.x,
  //         y: scaledOffset.y,
  //         z: scaledOffset.z,
  //       });

  //       // Update local state
  //       setModelAnchors((prev) =>
  //         prev.map((anchor) =>
  //           anchor.id === anchorId
  //             ? {
  //                 ...anchor,
  //                 x: scaledOffset.x,
  //                 y: scaledOffset.y,
  //                 z: scaledOffset.z,
  //               }
  //             : anchor,
  //         ),
  //       );
  //     } else if (placementMode.type === "link" && placementMode.data) {
  //       // Find the anchor to update (most recently added)
  //       const anchor = webpageAnchors[webpageAnchors.length - 1];

  //       if (anchor && anchor.id) {
  //         // Update webpage anchor
  //         await updateDoc(doc(db, "anchors", anchor.id), {
  //           x: scaledOffset.x,
  //           y: scaledOffset.y,
  //           z: scaledOffset.z,
  //         });

  //         // Update local state
  //         setWebpageAnchors((prev) =>
  //           prev.map((a) =>
  //             a.id === anchor.id
  //               ? {
  //                   ...a,
  //                   x: scaledOffset.x,
  //                   y: scaledOffset.y,
  //                   z: scaledOffset.z,
  //                 }
  //               : a,
  //           ),
  //         );
  //       }
  //     } else if (placementMode.type === "element" && placementMode.data) {
  //       const element = placementMode.data;

  //       // Update element position in Firestore
  //       if (element.anchorId) {
  //         await updateDoc(doc(db, "anchors", element.anchorId), {
  //           x: scaledOffset.x,
  //           y: scaledOffset.y,
  //           z: scaledOffset.z,
  //         });
  //       }

  //       // Update local state
  //       updateElementPosition(element.id, {
  //         x: position.x,
  //         y: position.y,
  //         z: position.z,
  //       });
  //     } else if (placementMode.type === "file" && placementMode.data) {
  //       // Handle file placement
  //       const fileData = placementMode.data;

  //       // Create a unique anchor ID for the file
  //       const newAnchorId = `anchor-file-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  //       // Create the file anchor in Firestore
  //       await setDoc(doc(db, "anchors", newAnchorId), {
  //         id: newAnchorId,
  //         createdDate: new Date(),
  //         contentID: `file-${Date.now()}`,
  //         contentType: "file",
  //         fileType: fileData.fileType,
  //         fileName: fileData.name,
  //         fileUrl: fileData.url,
  //         host: currentUser?.uid || "anonymous",
  //         blueprintID: blueprintId,
  //         x: scaledOffset.x,
  //         y: scaledOffset.y,
  //         z: scaledOffset.z,
  //         isPrivate: false,
  //       });

  //       // Add anchor ID to blueprint
  //       await updateDoc(doc(db, "blueprints", blueprintId), {
  //         anchorIDs: arrayUnion(newAnchorId),
  //       });

  //       // Add to local state (assuming you'd want a fileAnchors state)
  //       // If you don't have this state yet, you may need to create it
  //       // or you can add it to an existing anchor array based on your implementation

  //       // For now, we'll add it to modelAnchors to make it visible
  //       // (You might want to create a dedicated fileAnchors state in a real implementation)
  //       setModelAnchors((prev) => [
  //         ...prev,
  //         {
  //           id: newAnchorId,
  //           contentType: "file",
  //           fileType: fileData.fileType,
  //           fileName: fileData.name,
  //           x: scaledOffset.x,
  //           y: scaledOffset.y,
  //           z: scaledOffset.z,
  //         },
  //       ]);
  //     }

  //     // Reset placement mode
  //     setPlacementMode(null);

  //     toast({
  //       title: "Placement Complete",
  //       description: "The item has been placed successfully.",
  //     });
  //   } catch (error) {
  //     console.error("Error completing placement:", error);
  //     toast({
  //       title: "Error",
  //       description: "Failed to complete placement. Please try again.",
  //       variant: "destructive",
  //     });
  //   }
  // };

  // ========================
  // TEXT LABEL HANDLING
  // ========================

  // Place text label
  const handleAddTextLabel = () => {
    if (!textContent.trim()) {
      toast({
        title: "Empty Text",
        description: "Please enter some text for the label.",
        variant: "destructive",
      });
      return;
    }

    // Store text in ref for ThreeViewer
    pendingLabelTextRef.current = textContent;

    // Activate text placement mode
    showTextBoxInputRef.current = true;

    toast({
      title: "Text Placement Mode",
      description: "Click in the 3D view to place your text label.",
    });

    // Switch to Elements panel after initiating placement
    setActivePanel("elements");
  };

  // ========================
  // UI EVENT HANDLERS
  // ========================

  // Handle sidebar resize
  const handleSidebarResize = (e) => {
    if (!isDragging) return;

    const newWidth = e.clientX;

    // Limit width between min and max values
    if (newWidth >= 280 && newWidth <= 600) {
      setSidebarWidth(newWidth);
    }
  };

  // Start sidebar resize
  const startSidebarResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // End sidebar resize
  const endSidebarResize = () => {
    setIsDragging(false);
  };

  // Add document-level event listeners for mouse movement during resize
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleSidebarResize);
      document.addEventListener("mouseup", endSidebarResize);
    }

    return () => {
      document.removeEventListener("mousemove", handleSidebarResize);
      document.removeEventListener("mouseup", endSidebarResize);
    };
  }, [isDragging]);

  // Get filtered elements based on search and category
  const getFilteredElements = () => {
    return elements.filter((element) => {
      const matchesSearch =
        element.content.title
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        element.content.description
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === "all" || element.type === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  };

  // ========================
  // RENDER FUNCTIONS
  // ========================

  // Render the main editor UI
  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Top navigation bar */}
      <header className="h-14 border-b flex items-center justify-between px-4 z-10">
        <div className="flex items-center space-x-4">
          {/* Add onClick and cursor-pointer to this div */}
          <div
            className="flex items-center space-x-2 cursor-pointer group" // Added cursor-pointer and group
            onClick={navigateToDashboard} // Added onClick handler
            role="button" // Added role for accessibility
            tabIndex={0} // Added tabIndex for keyboard navigation
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") navigateToDashboard();
            }} // Added keyboard handler
          >
            <Landmark className="h-5 w-5 text-indigo-500 group-hover:text-indigo-600 transition-colors" />{" "}
            {/* Added hover effect */}
            <span className="font-semibold text-lg group-hover:text-indigo-700 transition-colors">
              Blueprint
            </span>{" "}
            {/* Added hover effect */}
          </div>

          <span className="text-muted-foreground text-sm truncate max-w-md">
            {blueprintTitle || "Untitled Blueprint"}
          </span>
        </div>

        <div className="flex items-center space-x-4">
          {/* Blueprint status badge */}
          <div
            className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
              blueprintStatus === "active"
                ? "bg-green-100 text-green-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                blueprintStatus === "active" ? "bg-green-500" : "bg-amber-500"
              }`}
            />
            {blueprintStatus === "active" ? "Active" : "Pending"}
          </div>

          {/* Save changes button */}
          <Button variant="ghost" size="sm" className="gap-1.5">
            <Save className="h-4 w-4" />
            <span>Save</span>
          </Button>

          {/* Share button */}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowShareDialog(true)}
          >
            <Share2 className="h-4 w-4" />
            <span>Share</span>
          </Button>

          {/* Activation button */}
          {blueprintStatus !== "active" && (
            <Button
              size="sm"
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white"
              onClick={handleActivateBlueprint}
              disabled={isActivating}
            >
              {isActivating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-1.5" />
                  Activate Blueprint
                </>
              )}
            </Button>
          )}
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* NEW: Vertical Icon Bar */}
        <div className="w-20 bg-neutral-100 border-r flex flex-col items-center py-4 space-y-1 z-20 flex-shrink-0">
          {sections.map((section) =>
            section.type === "separator" ? (
              <Separator key="separator" className="my-2 bg-neutral-300" />
            ) : (
              <TooltipProvider key={section.id} delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={
                        activeSection === section.id ? "secondary" : "ghost"
                      }
                      size="lg" // Make button larger for easier clicking
                      className={`w-16 h-16 flex flex-col items-center justify-center rounded-lg group transition-colors duration-150 ${
                        activeSection === section.id
                          ? "bg-indigo-100 text-indigo-700"
                          : "text-neutral-600 hover:bg-neutral-200 hover:text-neutral-800"
                      }`}
                      onClick={() => toggleSection(section.id)}
                    >
                      <div className="mb-1">{section.icon}</div>
                      <span className="text-[10px] font-medium leading-tight text-center">
                        {section.name}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{section.name}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ),
          )}
        </div>

        {/* NEW: Sliding Panel Container */}
        <div className="relative z-10">
          {" "}
          {/* Container for the animated panel */}
          <AnimatePresence>
            {isPanelOpen && ( // <<< New visibility logic
              <motion.div
                // ref={sidebarRef} // Keep ref if resizing is needed
                initial={{ x: "-100%", opacity: 0 }} // <<< New animation
                animate={{ x: 0, opacity: 1 }} // <<< New animation
                exit={{ x: "-100%", opacity: 0 }} // <<< New animation
                transition={{ type: "spring", bounce: 0.1, duration: 0.4 }}
                className="h-full bg-background border-r shadow-lg flex flex-col absolute top-0 left-0" // Use absolute positioning
                style={{ width: panelWidth }} // Use new panelWidth state
              >
                {/* Panel Header (Optional but good UX) */}
                <div className="p-3 border-b flex items-center justify-between h-14">
                  <h2 className="font-semibold text-lg">
                    {sections.find((s) => s.id === activeSection)?.name ||
                      "Panel"}
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setActiveSection(null)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Panel content (NEW conditional rendering) */}
                <ScrollArea className="flex-1">
                  {" "}
                  {/* Wrap content in ScrollArea */}
                  <div className="p-4">
                    {" "}
                    {/* Add padding around content */}
                    {/* Text Panel */}
                    {activeSection === "text" && (
                      <div className="space-y-4">
                        {/* --- PASTE Text Label Section JSX HERE --- */}
                        {/* (From old activePanel === 'elements' -> Text Label Section) */}
                        <div className="bg-gray-50 rounded-lg p-4 border">
                          <h3 className="text-sm font-medium mb-2 flex items-center text-gray-700">
                            <Type className="h-4 w-4 mr-1.5" />
                            {editingTextAnchorId
                              ? "Edit Text Label"
                              : "Add Text Label"}
                          </h3>
                          <Textarea
                            placeholder={
                              editingTextAnchorId
                                ? "Edit the label text..."
                                : "Enter text for new label..."
                            }
                            className="resize-none mb-3 bg-white"
                            rows={3}
                            value={textContent}
                            onChange={handleTextChange} // Use the new handler
                          />
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              if (editingTextAnchorId) {
                                // User is editing an existing anchor:
                                updateTextAnchorContent(
                                  editingTextAnchorId,
                                  textContent,
                                );
                                toast({
                                  title: "Text Updated",
                                  description:
                                    "Your label text has been saved to Firebase.",
                                });
                              } else {
                                // User is creating a new label:
                                handleAddTextLabel();
                              }
                            }}
                            // Only disable if the text field is empty:
                            disabled={!textContent.trim()}
                            className="w-full"
                          >
                            <Type className="h-4 w-4 mr-1.5" />
                            {editingTextAnchorId
                              ? "Update Label"
                              : "Place New Text Label"}
                          </Button>
                          {editingTextAnchorId && (
                            <p className="text-xs text-gray-500 mt-2">
                              Editing anchor:{" "}
                              <code className="bg-gray-200 px-1 rounded">
                                {editingTextAnchorId.substring(0, 12)}...
                              </code>
                              . Changes saved automatically.
                            </p>
                          )}
                        </div>
                        {/* --- END PASTE --- */}
                      </div>
                    )}
                    {/* Media Panel */}
                    {activeSection === "media" && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold mb-3">
                          Media (Images & Videos)
                        </h3>
                        {/* --- PASTE Media Upload Section JSX HERE --- */}
                        {/* (From old activePanel === 'elements' -> Media Upload Section) */}
                        {/* You might want to adjust the 'accept' prop based on this combined section */}
                        <div className="bg-gray-50 rounded-lg p-4 border">
                          <h3 className="text-sm font-medium mb-2 flex items-center text-gray-700">
                            <ImageIcon className="h-4 w-4 mr-1.5" /> /{" "}
                            <Video className="h-4 w-4 ml-1 mr-1.5" /> Upload
                            Media
                          </h3>
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-white mb-3">
                            <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm font-medium mb-1">
                              Drag & drop images/videos here
                            </p>
                            <p className="text-xs text-gray-500 mb-3">
                              Or click to browse
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mx-auto"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadLoading}
                            >
                              {uploadLoading ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                                  Choose Files
                                </>
                              )}
                            </Button>
                          </div>
                          <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*,video/*" // Accept both
                            multiple // Allow multiple file selection
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                Array.from(e.target.files).forEach((file) => {
                                  // Handle each file upload
                                  handleFileUpload(file);
                                });
                                e.target.value = ""; // Clear input
                              }
                            }}
                          />
                        </div>
                        {/* --- END PASTE --- */}
                        {/* You might also want to list existing Image/Video elements/anchors here */}
                        <div>
                          <h3 className="text-sm font-medium text-gray-700 mb-3">
                            Uploaded Media
                          </h3>
                          {/* Filter and display uploadedFiles that are images or videos */}
                          <div className="grid grid-cols-2 gap-2">
                            {uploadedFiles
                              .filter(
                                (f) =>
                                  f.type?.startsWith("image/") ||
                                  f.type?.startsWith("video/"),
                              )
                              .slice(0, 8)
                              .map((file) => (
                                <div
                                  key={file.id}
                                  className="border rounded-lg overflow-hidden bg-white"
                                  draggable
                                  onDragStart={(e) => {
                                    // Attach file metadata to the drag event
                                    e.dataTransfer.setData(
                                      "application/file",
                                      JSON.stringify(file),
                                    );
                                  }}
                                >
                                  <div className="w-full aspect-square bg-gray-50 relative flex items-center justify-center">
                                    {file.type?.includes("image") ? (
                                      <img
                                        src={file.url}
                                        alt={file.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : file.type?.includes("video") ? (
                                      <Video className="h-10 w-10 text-orange-500" />
                                    ) : (
                                      <File className="h-10 w-10 text-gray-400" />
                                    )}
                                  </div>
                                  <div className="p-2">
                                    <p className="text-xs font-medium truncate">
                                      {file.name}
                                    </p>
                                    <p className="text-[10px] text-gray-500">
                                      {file.type?.split("/")[0] || "File"}
                                    </p>
                                  </div>
                                </div>
                              ))}
                          </div>
                          {uploadedFiles.filter(
                            (f) =>
                              f.type?.startsWith("image/") ||
                              f.type?.startsWith("video/"),
                          ).length > 8 && (
                            <Button variant="link" size="sm" className="mt-2">
                              View All Media
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                    {/* 3D Content Panel */}
                    {activeSection === "3d" && (
                      <div className="space-y-4">
                        {/* --- PASTE 3D Models Panel JSX HERE --- */}
                        {/* (From old activePanel === 'models') */}
                        <div className="h-full flex flex-col">
                          <div className="p-0">
                            {" "}
                            {/* Removed padding and border */}
                            <h2 className="font-semibold text-lg mb-3 flex items-center">
                              <Box className="h-5 w-5 text-indigo-500 mr-2" />
                              3D Models
                            </h2>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="relative flex-1">
                                <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                                <Input
                                  placeholder="Search models..."
                                  className="pl-9"
                                  value={searchQuery}
                                  onChange={(e) =>
                                    setSearchQuery(e.target.value)
                                  }
                                />
                              </div>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                  modelFileInputRef.current?.click()
                                }
                              >
                                <Upload className="h-4 w-4" />
                              </Button>
                              <input
                                type="file"
                                ref={modelFileInputRef}
                                accept=".glb,.gltf"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    handleFileUpload(
                                      e.target.files[0],
                                      "3dmodel",
                                    );
                                  }
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex-1">
                            {" "}
                            {/* Removed ScrollArea */}
                            <div className="space-y-4">
                              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                                {searchQuery.trim()
                                  ? "Search Results"
                                  : "Featured Models"}
                              </h3>
                              <div className="grid grid-cols-2 gap-2">
                                {featuredModels.map((model) => (
                                  // Reuse the existing model card component structure
                                  <div
                                    key={model.id}
                                    className="border rounded-lg overflow-hidden hover:border-primary cursor-pointer transition-all relative group"
                                    onClick={() =>
                                      handleFeaturedModelClick(model)
                                    }
                                    draggable
                                  >
                                    {/* ... model card JSX ... */}
                                    <div className="w-full aspect-video bg-muted relative">
                                      {model.thumbnail ? (
                                        <img
                                          src={model.thumbnail}
                                          alt={model.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <Box className="h-8 w-8 text-muted-foreground opacity-50" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="p-2">
                                      <div className="font-medium text-sm truncate">
                                        {model.name}
                                      </div>
                                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                                        {model.description || "3D Model"}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {featuredModels.length === 0 && (
                                <div className="text-center py-10">
                                  <p className="text-gray-500">
                                    No models found
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* --- END PASTE --- */}
                      </div>
                    )}
                    {/* Uploads Panel */}
                    {activeSection === "uploads" && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold mb-3">Uploads</h3>
                        {/* --- PASTE General Upload Area JSX HERE --- */}
                        {/* (From old activePanel === 'elements' -> Quick Actions / Upload Files) */}
                        <div className="bg-gray-50 rounded-lg p-4 border">
                          <h3 className="text-sm font-medium mb-2 flex items-center text-gray-700">
                            <Upload className="h-4 w-4 mr-1.5" /> Upload Any
                            File
                          </h3>
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-white mb-3">
                            <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm font-medium mb-1">
                              Drag & drop files here
                            </p>
                            <p className="text-xs text-gray-500 mb-3">
                              Or click to browse
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mx-auto"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadLoading}
                            >
                              {uploadLoading ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                                  Choose Files
                                </>
                              )}
                            </Button>
                          </div>
                          <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="*" // Accept any file type
                            multiple
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                Array.from(e.target.files).forEach((file) => {
                                  handleFileUpload(file);
                                });
                                e.target.value = "";
                              }
                            }}
                          />
                        </div>
                        {/* --- END PASTE --- */}

                        {/* --- PASTE Recent Uploads List JSX HERE --- */}
                        {/* (From old activePanel === 'elements' -> Recent Uploads Section) */}
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-medium text-gray-700 flex items-center">
                              <File className="h-4 w-4 mr-1.5 text-indigo-500" />
                              Recent Uploads
                            </h3>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={refreshUploadedFiles}
                              title="Refresh uploads"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          {uploadedFiles.length === 0 ? (
                            <div className="py-6 text-center bg-gray-50 rounded-lg border border-gray-200">
                              <p className="text-sm text-gray-600">
                                No files uploaded yet
                              </p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {uploadedFiles.slice(0, 10).map(
                                (
                                  file, // Show more uploads here
                                ) => (
                                  // Reuse the existing file display card component structure
                                  <div
                                    key={file.id}
                                    className="border rounded-lg overflow-hidden bg-white"
                                    // ADDED: Make it draggable
                                    draggable
                                    // ADDED: On drag start, attach the file data to dataTransfer
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData(
                                        "application/file",
                                        JSON.stringify(file),
                                      );
                                      console.log(
                                        "[BlueprintEditor] onDragStart - setting file data:",
                                        file,
                                      );
                                    }}
                                  >
                                    {/* ... file card JSX ... */}
                                    <div className="w-full aspect-square bg-gray-50 relative flex items-center justify-center">
                                      {/* ... image/video/file preview ... */}
                                      {file.type?.includes("image") ? (
                                        <img
                                          src={file.url}
                                          alt={file.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : file.type?.includes("video") ? (
                                        <Video className="h-10 w-10 text-orange-500" />
                                      ) : (
                                        <File className="h-10 w-10 text-gray-400" />
                                      )}
                                      {/* ... place button ... */}
                                    </div>
                                    <div className="p-2">
                                      <p className="text-xs font-medium truncate">
                                        {file.name}
                                      </p>
                                      <p className="text-[10px] text-gray-500">
                                        {file.type?.split("/")[0] || "File"}
                                      </p>
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          )}
                          {uploadedFiles.length > 10 && (
                            <Button variant="link" size="sm" className="mt-2">
                              View All Uploads
                            </Button>
                          )}
                        </div>
                        {/* --- END PASTE --- */}
                      </div>
                    )}
                    {/* Webpages Panel */}
                    {activeSection === "webpages" && (
                      <div className="space-y-4">
                        {/* Webpage Link Input/Update Section */}
                        <div className="bg-gray-50 rounded-lg p-4 border">
                          <h3 className="text-sm font-medium mb-2 flex items-center text-gray-700">
                            <Link className="h-4 w-4 mr-1.5" /> Webpage Link
                          </h3>
                          <div className="flex mb-3">
                            <Input
                              placeholder="Enter webpage URL (https://example.com)"
                              className="flex-1 bg-white"
                              value={externalUrl}
                              onChange={(e) => setExternalUrl(e.target.value)}
                            />
                          </div>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              if (editingWebpageAnchorId) {
                                updateWebpageAnchorUrl(
                                  editingWebpageAnchorId,
                                  externalUrl,
                                );
                              } else {
                                handleLoadExternalLink();
                              }
                            }}
                            disabled={
                              !externalUrl.trim() ||
                              !externalUrl.startsWith("http")
                            }
                            className="w-full"
                          >
                            <Link className="h-4 w-4 mr-1.5" />
                            {editingWebpageAnchorId
                              ? "Update Webpage URL"
                              : "Place Webpage Link"}
                          </Button>

                          {editingWebpageAnchorId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingWebpageAnchorId(null);
                                setExternalUrl("");
                                setSelectedAnchorData(null);
                              }}
                              className="w-full mt-2"
                            >
                              Cancel Edit
                            </Button>
                          )}

                          <p className="text-xs text-gray-500 mt-2">
                            Links will be displayed as interactive elements in
                            your 3D space
                          </p>
                        </div>{" "}
                        {/* Correct closing tag for the input/button section */}
                        {/* List of Placed Webpages Section (Starts directly after the above div) */}
                        {webpageAnchors.length > 0 && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-3">
                              Placed Webpages
                            </h3>
                            <div className="space-y-2">
                              {webpageAnchors.map((anchor) => (
                                <div
                                  key={anchor.id}
                                  className={`border rounded-lg p-2 flex items-center justify-between hover:bg-gray-50 cursor-pointer ${
                                    editingWebpageAnchorId === anchor.id
                                      ? "ring-2 ring-indigo-500 bg-indigo-50"
                                      : ""
                                  }`}
                                  onClick={() =>
                                    handleWebpageAnchorClicked(
                                      anchor.id,
                                      anchor.webpageUrl,
                                    )
                                  }
                                >
                                  <span className="text-sm truncate">
                                    {anchor.webpageUrl}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-red-500 hover:bg-red-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      console.log(
                                        "Delete clicked for:",
                                        anchor.id,
                                      );
                                      // Add delete logic here if desired
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* No extra <p> or </div> here */}
                      </div>
                    )}
                    {/* Areas Panel */}
                    {activeSection === "areas" && (
                      <div className="space-y-4">
                        {/* --- PASTE Areas Panel JSX HERE --- */}
                        {/* (From old activePanel === 'areas') */}
                        <div className="h-full flex flex-col">
                          <div className="p-0">
                            {" "}
                            {/* Removed padding and border */}
                            <h2 className="font-semibold text-lg mb-3 flex items-center">
                              <Square className="h-5 w-5 text-indigo-500 mr-2" />
                              Marked Areas
                            </h2>
                            <Button
                              variant={isMarkingArea ? "default" : "outline"}
                              size="sm"
                              className="w-full flex items-center justify-center gap-1.5"
                              onClick={() => setIsMarkingArea(!isMarkingArea)}
                            >
                              {isMarkingArea ? (
                                <>
                                  <X className="h-4 w-4 mr-1.5" />
                                  Stop Marking
                                </>
                              ) : (
                                <>
                                  <Square className="h-4 w-4 mr-1.5" />
                                  Mark New Area
                                </>
                              )}
                            </Button>
                            {isMarkingArea && (
                              <div className="mt-2 p-3 bg-blue-50 rounded-md border border-blue-100">
                                <h4 className="text-sm font-medium text-blue-800 mb-1">
                                  How to mark:
                                </h4>
                                <ol className="text-xs text-blue-700 ml-4 space-y-1 list-decimal">
                                  <li>Click to start</li>
                                  <li>Drag to define size</li>
                                  <li>Release to complete</li>
                                </ol>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 mt-4">
                            {" "}
                            {/* Removed ScrollArea */}
                            <div className="space-y-4">
                              <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center justify-between">
                                <span>Your Areas</span>
                                <Badge variant="outline" className="bg-gray-50">
                                  {markedAreas.length} areas
                                </Badge>
                              </h3>
                              {markedAreas.length === 0 ? (
                                <div className="py-6 text-center bg-gray-50 rounded-lg border border-gray-200">
                                  <p className="text-sm text-gray-600">
                                    No areas marked yet
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-2 pb-6">
                                  {markedAreas.map((area) => (
                                    // Reuse the existing area card component structure
                                    <div
                                      key={area.id}
                                      className={`border rounded-lg overflow-hidden cursor-pointer transition-all relative group ${selectedArea === area.id ? "border-indigo-500 bg-indigo-50" : "hover:border-primary"}`}
                                      onClick={() =>
                                        setSelectedArea(
                                          area.id === selectedArea
                                            ? null
                                            : area.id,
                                        )
                                      }
                                    >
                                      {/* ... area card JSX ... */}
                                      <div className="p-3 flex items-center gap-3">
                                        <div
                                          className="w-10 h-10 rounded flex items-center justify-center shrink-0"
                                          style={{
                                            backgroundColor:
                                              area.color || "#3B82F6",
                                          }}
                                        >
                                          <Square className="h-5 w-5 text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium text-sm truncate">
                                            {area.name}
                                          </div>
                                          {/* ... size badge ... */}
                                        </div>
                                        <div className="flex gap-2">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                                            onClick={(e) =>
                                              handleRemarkArea(area.id, e)
                                            }
                                            title="Re-mark Area"
                                          >
                                            <PenTool className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              deleteMarkedArea(area.id);
                                            }}
                                            title="Delete Area"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* --- END PASTE --- */}
                      </div>
                    )}
                    {/* Settings Panel */}
                    {activeSection === "settings" && (
                      <div className="space-y-4">
                        {/* --- PASTE Settings Panel JSX HERE --- */}
                        {/* (From old activePanel === 'settings') */}
                        <div className="h-full flex flex-col">
                          <div className="p-0">
                            {" "}
                            {/* Removed padding and border */}
                            <h2 className="font-semibold text-lg mb-3 flex items-center">
                              <Settings className="h-5 w-5 text-indigo-500 mr-2" />
                              Blueprint Settings
                            </h2>
                          </div>
                          <div className="flex-1">
                            {" "}
                            {/* Removed ScrollArea */}
                            <div className="space-y-4">
                              <Accordion
                                type="single"
                                collapsible
                                className="w-full"
                              >
                                {/* Paste AccordionItem sections here */}
                                <AccordionItem value="blueprint">
                                  <AccordionTrigger className="text-sm">
                                    Blueprint Properties
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    {/* ... content ... */}
                                  </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="3dsettings">
                                  <AccordionTrigger className="text-sm">
                                    3D View Settings
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    {/* ... content ... */}
                                  </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="qrcodes">
                                  <AccordionTrigger className="text-sm">
                                    QR Codes
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    {/* ... content ... */}
                                  </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="team">
                                  <AccordionTrigger className="text-sm">
                                    Team & Collaboration
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    {/* ... content ... */}
                                  </AccordionContent>
                                </AccordionItem>
                              </Accordion>
                            </div>
                          </div>
                        </div>
                        {/* --- END PASTE --- */}
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Resize handle (Optional: Add if panel resizing is desired) */}
                {/* <div className="absolute top-0 right-0 w-2 h-full cursor-col-resize group z-50" onMouseDown={startSidebarResize}> ... </div> */}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Main viewer area */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden bg-neutral-100"
          //onMouseUp={endSidebarResize}
        >
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <p className="text-lg font-medium">Loading Blueprint...</p>
            </div>
          )}

          {/* Origin point indicator */}
          {originPoint && viewMode === "3D" && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-100 text-green-800 px-3 py-1.5 rounded-full text-sm font-medium z-40 flex items-center gap-1.5 shadow-md">
              <Target className="h-4 w-4" />
              Origin set at: X: {originPoint.x.toFixed(2)}, Y:{" "}
              {originPoint.y.toFixed(2)}, Z: {originPoint.z.toFixed(2)}
            </div>
          )}

          {/* Mode indicator */}
          {(isChoosingOrigin ||
            qrPlacementMode ||
            showTextBoxInputRef.current ||
            awaiting3D ||
            isMarkingArea) && (
            <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium z-40 flex items-center gap-2 shadow-md">
              {isChoosingOrigin && (
                <>
                  <Target className="h-4 w-4" />
                  Click to Set Origin Point
                </>
              )}
              {qrPlacementMode && (
                <>
                  <QrCode className="h-4 w-4" />
                  Click to Place QR Code
                </>
              )}
              {showTextBoxInputRef.current && (
                <>
                  <Type className="h-4 w-4" />
                  Click to Place Text Label
                </>
              )}
              {awaiting3D && (
                <>
                  <MapPin className="h-4 w-4" />
                  Click to Set Reference Point {activeLabel}
                </>
              )}
              {isMarkingArea && (
                <>
                  <Square className="h-4 w-4" />
                  {corner1Ref.current
                    ? "Click to Set Second Corner"
                    : "Click & Drag to Select the Surface of the Area"}
                </>
              )}
            </div>
          )}

          {/* Content based on view mode */}
          {viewMode === "WORKFLOW" ? (
            //     <WorkflowEditor blueprintId={blueprintId} />
            <div className="w-full h-full flex items-center justify-center">
              {floorPlanImage ? (
                <img
                  src={floorPlanImage}
                  alt="Floor Plan"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Map className="h-10 w-10 text-muted-foreground opacity-60" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No Floor Plan</h3>
                  <p className="text-muted-foreground mb-4 max-w-md">
                    Upload a floor plan image to get started with your blueprint
                    design.
                  </p>
                  <Button onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Floor Plan
                  </Button>
                </div>
              )}
            </div>
          ) : viewMode === "2D" ? (
            <div className="w-full h-full flex items-center justify-center">
              {floorPlanImage ? (
                <img
                  src={floorPlanImage}
                  alt="Floor Plan"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Map className="h-10 w-10 text-muted-foreground opacity-60" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No Floor Plan</h3>
                  <p className="text-muted-foreground mb-4 max-w-md">
                    Upload a floor plan image to get started with your blueprint
                    design.
                  </p>
                  <Button onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Floor Plan
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <ThreeViewer
              modelPath={model3DPath}
              ref={threeViewerRef}
              originPoint={originPoint}
              qrCodeAnchors={qrCodeAnchors}
              textAnchors={textAnchors}
              fileAnchors={fileAnchors}
              webpageAnchors={webpageAnchors}
              modelAnchors={modelAnchors}
              // Pass visibility states as props
              showQrCodes={showQrCodes}
              showTextAnchors={showTextAnchors}
              showFileAnchors={showFileAnchors}
              showWebpageAnchors={showWebpageAnchors}
              showModelAnchors={showModelAnchors}
              onOriginSet={(point) => {
                setOriginPoint(point);
                setIsChoosingOrigin(false);

                // Save origin to Firestore
                if (blueprintId) {
                  updateDoc(doc(db, "blueprints", blueprintId), {
                    origin: { x: point.x, y: point.y, z: point.z },
                  }).catch((error) => {
                    console.error("Error saving origin:", error);
                  });
                }

                toast({
                  title: "Origin Set",
                  description: "Origin point has been set successfully.",
                  variant: "default",
                });
              }}
              onLoad={() => {
                setIsLoading(false);
              }}
              onError={(error) => {
                setIsLoading(false);
                toast({
                  title: "Error",
                  description: error,
                  variant: "destructive",
                });
              }}
              isChoosingOrigin={isChoosingOrigin}
              setIsChoosingOrigin={setIsChoosingOrigin}
              qrPlacementMode={qrPlacementMode}
              onQRPlaced={handlePlaceQRCode}
              selectedArea={selectedArea}
              pendingLabelTextRef={pendingLabelTextRef}
              showTextBoxInputRef={showTextBoxInputRef}
              onTextBoxSubmit={handleTextAnchorPlaced}
              onModelDropped={async (model, position) => {
                // Check if we have a valid origin point
                if (!originPoint || !blueprintId) {
                  toast({
                    title: "Origin Not Set",
                    description: "Please set the origin point first.",
                    variant: "destructive",
                  });
                  return;
                }

                try {
                  // Create a unique anchor ID
                  const newAnchorId = `anchor-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

                  // Calculate offset from origin (important for correct positioning)
                  const offset = new THREE.Vector3().subVectors(
                    position,
                    originPoint,
                  );
                  const scaledOffset = {
                    x: offset.x * 45.64,
                    y: offset.y * 45.64,
                    z: offset.z * 45.64,
                  };

                  // Create the document in Firestore
                  await setDoc(doc(db, "anchors", newAnchorId), {
                    id: newAnchorId,
                    createdDate: new Date(),
                    contentID: `element-${Date.now()}`,
                    contentType: "model",
                    modelName: model.name,
                    model: model, // Store the model data
                    host: currentUser?.uid || "anonymous",
                    blueprintID: blueprintId,
                    x: scaledOffset.x,
                    y: scaledOffset.y,
                    z: scaledOffset.z,
                    isPrivate: false,
                  });

                  // Add the anchor ID to the blueprint
                  await updateDoc(doc(db, "blueprints", blueprintId), {
                    anchorIDs: arrayUnion(newAnchorId),
                  });

                  // Add to local state
                  setModelAnchors((prev) => [
                    ...prev,
                    {
                      id: newAnchorId,
                      modelName: model.name,
                      x: scaledOffset.x,
                      y: scaledOffset.y,
                      z: scaledOffset.z,
                      contentType: "model",
                    },
                  ]);

                  toast({
                    title: "Model Placed",
                    description: `${model.name} has been added to your scene.`,
                  });
                } catch (error) {
                  console.error("Error adding model anchor:", error);
                  toast({
                    title: "Error",
                    description:
                      "Failed to add model to scene. Please try again.",
                    variant: "destructive",
                  });
                }
              }}
              isMarkingArea={isMarkingArea}
              onAreaMarked={handleAreaMarked}
              markedAreas={markedAreas}
              activeLabel={activeLabel}
              awaiting3D={awaiting3D}
              placementMode={placementMode}
              /*onLinkPlaced={(position) => {
                // Store the external URL that was submitted
                const url = externalUrl;
                // Reset state immediately to avoid duplicate placements
                setPlacementMode(null);
                setExternalUrl("");

                // Handle the placement
                handleLoadExternalLink(url, position);
              }}*/
              onPlacementComplete={handlePlacementComplete}
              setReferencePoints3D={setReferencePoints3D}
              setAwaiting3D={setAwaiting3D}
              setActiveLabel={setActiveLabel}
              scaleFactor={scaleFactor}
              onFileDropped={handleFileAnchorPlaced}
              onTextAnchorClick={handleTextAnchorClicked}
              onWebpageAnchorClick={handleWebpageAnchorClicked}
              onBackgroundClick={handleViewerBackgroundClick}
              onFileAnchorClick={handleFileAnchorClicked}
            />
          )}

          {/* Action bar - bottom center */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40">
            <div className="bg-background/90 backdrop-blur-sm px-4 py-2 rounded-xl shadow-lg border flex items-center gap-6">
              {/* View Controls */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    // Call zoomOut on the ThreeViewer ref
                    threeViewerRef.current?.zoomOut(); // <<< ADD THIS
                  }}
                  title="Zoom Out" // Optional: Add title for accessibility
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    // Call zoomIn on the ThreeViewer ref
                    threeViewerRef.current?.zoomIn(); // <<< ADD THIS
                  }}
                  title="Zoom In" // Optional: Add title for accessibility
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>

              {/* Separator */}
              <Separator orientation="vertical" className="h-8" />

              {/* Origin Point */}
              <Button
                variant={isChoosingOrigin ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setIsChoosingOrigin(!isChoosingOrigin)}
                className="h-8 p-0"
              >
                <Target className="h-4 w-4 mr-1.5" />
                Choose Origin
              </Button>

              {/* Separator */}
              <Separator orientation="vertical" className="h-8" />

              {/* Alignment Tool */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAlignmentWizard(true);
                  setActiveLabel("A");
                  setAwaiting3D(false);
                  setReferencePoints2D([]);
                  setReferencePoints3D([]);
                }}
              >
                <Ruler className="h-4 w-4 mr-1.5" />
                Align 2D & 3D
              </Button>

              {/* Area Marking */}
              <Button
                variant={isMarkingArea ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setIsMarkingArea(!isMarkingArea)}
              >
                <Square className="h-4 w-4 mr-1.5" />
                {isMarkingArea ? "Stop Marking" : "Mark Area"}
              </Button>

              {/* QR Code */}
              <Button
                variant={qrPlacementMode ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setQrPlacementMode(!qrPlacementMode)}
              >
                <QrCode className="h-4 w-4 mr-1.5" />
                {qrPlacementMode ? "Cancel QR" : "Place QR"}
              </Button>
            </div>
          </div>

          {/* Toggle QR Button - bottom right */}

          <div className="absolute bottom-4 right-4 z-40 flex flex-col items-end gap-1">
            {/* --- Text Anchors Toggle --- */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTextAnchors(!showTextAnchors)}
              className="gap-1.5 bg-background/80 backdrop-blur-sm hover:bg-muted/90 px-2 py-1 h-auto rounded-md shadow"
              title={
                showTextAnchors ? "Hide Text Anchors" : "Show Text Anchors"
              }
            >
              {showTextAnchors ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              <Type className="h-4 w-4" />
            </Button>

            {/* --- File Anchors Toggle (incl. Images/Videos) --- */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFileAnchors(!showFileAnchors)}
              className="gap-1.5 bg-background/80 backdrop-blur-sm hover:bg-muted/90 px-2 py-1 h-auto rounded-md shadow"
              title={
                showFileAnchors ? "Hide File Anchors" : "Show File Anchors"
              }
            >
              {showFileAnchors ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              <File className="h-4 w-4" /> {/* Using File icon */}
            </Button>

            {/* --- Webpage Anchors Toggle --- */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowWebpageAnchors(!showWebpageAnchors)}
              className="gap-1.5 bg-background/80 backdrop-blur-sm hover:bg-muted/90 px-2 py-1 h-auto rounded-md shadow"
              title={
                showWebpageAnchors
                  ? "Hide Webpage Anchors"
                  : "Show Webpage Anchors"
              }
            >
              {showWebpageAnchors ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              <Link className="h-4 w-4" />
            </Button>

            {/* --- 3D Model Anchors Toggle --- */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowModelAnchors(!showModelAnchors)}
              className="gap-1.5 bg-background/80 backdrop-blur-sm hover:bg-muted/90 px-2 py-1 h-auto rounded-md shadow"
              title={
                showModelAnchors
                  ? "Hide 3D Model Anchors"
                  : "Show 3D Model Anchors"
              }
            >
              {showModelAnchors ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              <Box className="h-4 w-4" />
            </Button>

            {/* --- QR Code Anchors Toggle (Existing) --- */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowQrCodes(!showQrCodes)}
              className="gap-1.5 bg-background/80 backdrop-blur-sm hover:bg-muted/90 px-2 py-1 h-auto rounded-md shadow"
              title={
                showQrCodes ? "Hide QR Code Anchors" : "Show QR Code Anchors"
              }
            >
              {showQrCodes ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              <QrCode className="h-4 w-4" />
            </Button>
          </div>

          {/* Properties panel - right side for selected element */}
          <AnimatePresence>
            {selectedElement && (
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                className="absolute top-0 right-0 bottom-0 w-72 bg-background border-l shadow-lg z-20"
              >
                <div className="h-full flex flex-col">
                  <div className="p-3 border-b flex items-center justify-between">
                    <h3 className="font-semibold">Properties</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setSelectedElement(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                      {/* Element type & title */}
                      <div className="flex items-center gap-2 mb-1">
                        {selectedElement.type === "infoCard" && (
                          <StickyNote className="h-5 w-5 text-blue-500" />
                        )}
                        {selectedElement.type === "marker" && (
                          <MapPin className="h-5 w-5 text-red-500" />
                        )}
                        {selectedElement.type === "text" && (
                          <Type className="h-5 w-5 text-green-500" />
                        )}
                        {selectedElement.type === "media" &&
                          (selectedElement.content.mediaType === "video" ? (
                            <Video className="h-5 w-5 text-orange-500" />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-purple-500" />
                          ))}
                        <Badge variant="outline" className="text-xs py-0">
                          {selectedElement.type}
                        </Badge>
                      </div>

                      {/* Title */}
                      <div className="space-y-1.5">
                        <Label htmlFor="element-title">Title</Label>
                        <Input
                          id="element-title"
                          value={selectedElement.content.title}
                          onChange={(e) =>
                            updateElementContent(selectedElement.id, {
                              title: e.target.value,
                            })
                          }
                        />
                      </div>

                      {/* Description */}
                      <div className="space-y-1.5">
                        <Label htmlFor="element-description">Description</Label>
                        <Textarea
                          id="element-description"
                          value={selectedElement.content.description}
                          onChange={(e) =>
                            updateElementContent(selectedElement.id, {
                              description: e.target.value,
                            })
                          }
                          rows={3}
                          className="resize-none"
                        />
                      </div>

                      {/* Trigger */}
                      <div className="space-y-1.5">
                        <Label htmlFor="element-trigger">Trigger</Label>
                        <Select
                          value={selectedElement.content.trigger}
                          onValueChange={(value) =>
                            updateElementContent(selectedElement.id, {
                              trigger: value,
                            })
                          }
                        >
                          <SelectTrigger id="element-trigger">
                            <SelectValue placeholder="Select trigger" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="click">Click</SelectItem>
                            <SelectItem value="proximity">Proximity</SelectItem>
                            <SelectItem value="always">
                              Always Visible
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Media upload for media type */}
                      {selectedElement.type === "media" && (
                        <div className="space-y-1.5">
                          <Label>Media</Label>
                          {selectedElement.content.mediaUrl ? (
                            <div className="border rounded-md overflow-hidden">
                              {selectedElement.content.mediaType === "image" ? (
                                <img
                                  src={selectedElement.content.mediaUrl}
                                  alt="Element media"
                                  className="w-full h-auto"
                                />
                              ) : (
                                <video
                                  src={selectedElement.content.mediaUrl}
                                  controls
                                  className="w-full h-auto"
                                />
                              )}

                              <div className="p-2 flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => {
                                    // Handle replace
                                    fileInputRef.current?.click();
                                  }}
                                >
                                  Replace
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 text-red-500 hover:text-red-600 hover:bg-red-50"
                                  onClick={() =>
                                    updateElementContent(selectedElement.id, {
                                      mediaUrl: undefined,
                                      mediaType: undefined,
                                    })
                                  }
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="border border-dashed rounded-md p-6 text-center">
                              <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
                                <Upload className="h-6 w-6 text-muted-foreground" />
                              </div>
                              <p className="text-sm text-muted-foreground mb-3">
                                Drag & drop a file or click to browse
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                              >
                                Select File
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Position controls */}
                      <div className="space-y-1.5">
                        <Label>Position</Label>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">X</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={selectedElement.position.x.toFixed(2)}
                              onChange={(e) =>
                                updateElementPosition(selectedElement.id, {
                                  ...selectedElement.position,
                                  x: parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Y</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={selectedElement.position.y.toFixed(2)}
                              onChange={(e) =>
                                updateElementPosition(selectedElement.id, {
                                  ...selectedElement.position,
                                  y: parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Z</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={selectedElement.position.z.toFixed(2)}
                              onChange={(e) =>
                                updateElementPosition(selectedElement.id, {
                                  ...selectedElement.position,
                                  z: parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </ScrollArea>

                  <div className="p-3 border-t">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => duplicateElement(selectedElement.id)}
                      >
                        Duplicate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => deleteElement(selectedElement.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {/* ===== MODALS AND DIALOGS ===== */}
      {/* Alignment Wizard */}
      <Dialog
        open={showAlignmentWizard}
        onOpenChange={setShowAlignmentWizard}
        modal={false}
      >
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <div className="flex h-[80vh]">
            {/* Left side - 2D floor plan */}
            <div className="w-1/2 border-r flex flex-col">
              <DialogHeader className="px-4 py-2 border-b">
                <DialogTitle className="text-lg">2D Floor Plan</DialogTitle>
                <DialogDescription>
                  Click to set reference points (A, B, C)
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 relative overflow-auto">
                {floorPlanImage ? (
                  <div className="relative">
                    <img
                      src={floorPlanImage}
                      alt="Floor Plan"
                      className="max-w-full max-h-full object-contain"
                      onClick={(e) => {
                        // Handle 2D point selection
                        if (activeLabel && !awaiting3D) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const y = e.clientY - rect.top;

                          setReferencePoints2D((prev) => [
                            ...prev,
                            { label: activeLabel, x, y },
                          ]);

                          setAwaiting3D(true);
                        }
                      }}
                    />

                    {/* Render 2D points */}
                    {referencePoints2D.map((point) => (
                      <div
                        key={point.label}
                        className="absolute flex items-center justify-center font-bold text-white text-xs"
                        style={{
                          left: point.x,
                          top: point.y,
                          width: "24px",
                          height: "24px",
                          backgroundColor:
                            point.label === "A"
                              ? "#EF4444"
                              : point.label === "B"
                                ? "#3B82F6"
                                : "#10B981",
                          borderRadius: "50%",
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        {point.label}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">
                      No floor plan image available
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right side - 3D model */}
            <div className="w-1/2 flex flex-col">
              <DialogHeader className="px-4 py-2 border-b">
                <DialogTitle className="text-lg">3D Model</DialogTitle>
                <DialogDescription>
                  {awaiting3D
                    ? `Click to set point ${activeLabel} in 3D`
                    : "Select 2D points first"}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 relative">
                {model3DPath ? (
                  <div className="w-full h-full">
                    <ThreeViewer
                      modelPath={model3DPath}
                      ref={threeViewerRef}
                      originPoint={originPoint}
                      activeLabel={activeLabel}
                      awaiting3D={awaiting3D}
                      setReferencePoints3D={setReferencePoints3D}
                      isMarkingArea={isMarkingArea}
                      onAreaMarked={handleAreaMarked}
                      markedAreas={markedAreas}
                      fileAnchors={fileAnchors}
                      setAwaiting3D={setAwaiting3D}
                      setActiveLabel={setActiveLabel}
                      selectedArea={selectedArea}
                      placementMode={null}
                      webpageAnchors={[]}
                      textAnchors={[]}
                      modelAnchors={[]}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">
                      No 3D model available
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="px-4 py-3 bg-muted border-t flex justify-between items-center">
            <div className="flex gap-4">
              <div>
                <p className="text-sm font-medium mb-1">2D Points</p>
                <div className="flex gap-1.5">
                  {["A", "B", "C"].map((label) => (
                    <Badge
                      key={label}
                      variant={
                        referencePoints2D.some((p) => p.label === label)
                          ? "default"
                          : "outline"
                      }
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">3D Points</p>
                <div className="flex gap-1.5">
                  {["A", "B", "C"].map((label) => (
                    <Badge
                      key={label}
                      variant={
                        referencePoints3D.some((p) => p.label === label)
                          ? "default"
                          : "outline"
                      }
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAlignmentWizard(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={computeAlignment}
                disabled={
                  referencePoints2D.length < 2 || referencePoints3D.length < 2
                }
              >
                Compute Alignment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Distance Dialog */}
      <Dialog
        open={areaNameDialogOpen}
        onOpenChange={(open) => {
          if (!open && pendingArea) {
            setAreaNameDialogOpen(false);
            setPendingArea(null);
          } else {
            setAreaNameDialogOpen(open);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Name Your Area
            </DialogTitle>
            <DialogDescription>
              {onboardingStep === 3
                ? `This area will help visitors navigate your ${prefillData?.industry || "space"}`
                : `Give a name to the area you just marked.`}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="area-name" className="mb-1.5 block">
              Area Name
            </Label>
            <Input
              id="area-name"
              value={areaName}
              onChange={(e) => setAreaName(e.target.value)}
              placeholder={
                onboardingStep === 3 && onboardingData.keyAreas.length > 0
                  ? `e.g. ${
                      typeof onboardingData.keyAreas[0] === "string"
                        ? getAreaLabel(
                            onboardingData.keyAreas[0],
                            prefillData.industry,
                          )
                        : (onboardingData.keyAreas[0] as AreaItem)?.name || "Area Name"
                    }`
                  : "e.g. Kitchen, Living Room, Office"
              }
              autoFocus
              className="mb-2"
            />

            {onboardingStep === 3 && (
              <div className="mt-3 bg-blue-50 p-3 rounded-lg border border-blue-100">
                <h4 className="text-sm font-medium mb-1.5 text-blue-800">
                  Suggested Names:
                </h4>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {onboardingData.keyAreas
                    .filter((area) => {
                      // Only suggest unmarked areas
                      let areaLabel;
                      if (typeof area === "string") {
                        areaLabel = getAreaLabel(
                          area,
                          prefillData.industry,
                        ).toLowerCase();
                      } else if (area && typeof area === "object") {
                        areaLabel = ((area as AreaItem).name || "").toLowerCase();
                      } else {
                        return false; // Skip invalid areas
                      }

                      const markedAreaNames = markedAreas.map((a) =>
                        a.name.toLowerCase(),
                      );
                      return !markedAreaNames.includes(areaLabel);
                    })
                    .map((area, index) => {
                      let areaName;
                      let areaId;

                      if (typeof area === "string") {
                        areaName = getAreaLabel(area, prefillData.industry);
                        areaId = area;
                      } else if (area && typeof area === "object") {
                        areaName = (area as AreaItem).name || "";
                        areaId = (area as AreaItem).id || `area-${index}`;
                      } else {
                        return null; // Skip invalid areas
                      }

                      return (
                        <Badge
                          key={areaId}
                          className="bg-white border border-blue-200 text-blue-800 cursor-pointer hover:bg-blue-100"
                          onClick={() => setAreaName(areaName)}
                        >
                          {areaName}
                        </Badge>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAreaNameDialogOpen(false);
                setPendingArea(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                saveMarkedArea();
                // Show success animation in the background
                // (This would need to be implemented in the 3D view)
                showAreaMarkedSuccess(areaName);
              }}
              disabled={!pendingArea || !areaName.trim()}
            >
              <Check className="h-4 w-4 mr-1.5" />
              Save Area
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* QR Code Modal */}
      <Dialog open={qrCodeModalOpen} onOpenChange={setQrCodeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Blueprint QR Code</DialogTitle>
            <DialogDescription>
              Scan this QR code to access the blueprint at this location.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center py-6">
            <QRCodeCanvas
              value={qrCodeValue}
              size={256}
              includeMargin
              className="border p-2 rounded-md bg-white"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              Print
            </Button>
            <Button onClick={() => setQrCodeModalOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* QR Generation Flow */}
      {qrGenerationActive && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-background rounded-xl shadow-2xl w-[800px] max-w-[90vw] overflow-hidden">
            {/* Progress bar */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-1.5">
              <div
                className="bg-gradient-to-r from-emerald-400 to-teal-500 h-full transition-all duration-500"
                style={{ width: `${(qrGenerationStep / 2) * 100}%` }}
              ></div>
            </div>

            {/* Step 0: Introduction */}
            {qrGenerationStep === 0 && (
              <div className="p-6">
                <div className="mb-6 flex justify-between items-start gap-8">
                  <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 mb-2">
                      Let's Place Your QR Codes
                    </h2>
                    <p className="text-muted-foreground">
                      Make your Blueprint accessible to everyone in your space
                    </p>
                  </div>

                  <div className="w-28 h-28 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                    <QRCodeCanvas
                      value={blueprintId || "example"}
                      size={80}
                      className="rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
                    <h3 className="text-lg font-semibold text-blue-800 mb-3">
                      Why QR Codes Matter
                    </h3>
                    <ul className="space-y-2">
                      <li className="flex items-start">
                        <div className="mt-1 bg-blue-500 rounded-full p-0.5 text-white mr-2">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-sm">
                          Instantly onboard visitors to your AR experience
                        </p>
                      </li>
                      <li className="flex items-start">
                        <div className="mt-1 bg-blue-500 rounded-full p-0.5 text-white mr-2">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-sm">
                          Place at key entry points and high-traffic areas
                        </p>
                      </li>
                      <li className="flex items-start">
                        <div className="mt-1 bg-blue-500 rounded-full p-0.5 text-white mr-2">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-sm">
                          Automated alignment makes the experience seamless
                        </p>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-purple-50 rounded-xl p-5 border border-purple-100">
                    <h3 className="text-lg font-semibold text-purple-800 mb-3">
                      How It Works
                    </h3>
                    <ol className="list-decimal ml-5 space-y-2 text-sm">
                      <li>
                        We'll guide you to place 3-6 QR codes in your space
                      </li>
                      <li>
                        Each code will align visitors to that exact location
                      </li>
                      <li>Print all your QR codes with one click</li>
                      <li>Place them in optimal locations at your venue</li>
                    </ol>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={completeQRGeneration}>
                    Skip For Now
                  </Button>
                  <Button
                    onClick={() => {
                      setQrGenerationStep(1);
                      setViewMode("3D");
                      setQrPlacementMode(true);
                    }}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                  >
                    Start Placing QR Codes
                  </Button>
                </div>
              </div>
            )}

            {/* Step 1: Preview & Print */}
            {qrGenerationStep === 1 && (
              <div className="p-6">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 mb-2">
                  Your QR Codes Are Ready!
                </h2>
                <p className="text-muted-foreground mb-6">
                  Print and place these QR codes at the matching locations in
                  your space
                </p>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  {qrCodeStrings.map((codeValue, index) => (
                    <div
                      key={index}
                      className="bg-white rounded-xl border shadow-sm p-4 flex flex-col items-center"
                    >
                      <div className="mb-2 font-medium text-center">
                        Location {index + 1}
                      </div>
                      <QRCodeCanvas
                        value={codeValue}
                        size={128}
                        className="mb-3"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          // Create a temporary print window
                          const printWindow = window.open("", "_blank");
                          if (!printWindow) return;

                          printWindow.document.write(`
                            <html>
                              <head>
                                <title>Blueprint QR Code ${index + 1}</title>
                                <style>
                                  body { display: flex; justify-content: center; align-items: center; height: 100vh; }
                                  .qr-container { text-align: center; }
                                  .qr-label { font-family: Arial; margin-bottom: 20px; font-size: 24px; }
                                </style>
                              </head>
                              <body>
                                <div class="qr-container">
                                  <div class="qr-label">Blueprint QR Code - Location ${index + 1}</div>
                                  <div id="qrcode"></div>
                                </div>
                                <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.0/build/qrcode.min.js"></script>
                                <script>
                                  QRCode.toCanvas(document.getElementById('qrcode'), "${codeValue}", { width: 400 }, function (error) {
                                    if (error) console.error(error);
                                    setTimeout(() => { window.print(); window.close(); }, 500);
                                  });
                                </script>
                              </body>
                            </html>
                          `);
                          printWindow.document.close();
                        }}
                      >
                        Print Individual
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-5 border border-purple-100 mb-6">
                  <h3 className="text-lg font-semibold text-purple-800 mb-3">
                    Next Steps
                  </h3>
                  <ol className="list-decimal ml-5 space-y-1.5 text-sm">
                    <li>Print all QR codes and cut them out</li>
                    <li>Place each QR code at its corresponding location</li>
                    <li>Mount at eye level for optimal scanning</li>
                    <li>Ensure adequate lighting for QR visibility</li>
                  </ol>
                </div>

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQrGenerationStep(0);
                      setCurrentPlacingIndex(qrLocations.length);
                      setQrPlacementMode(true);
                    }}
                  >
                    Add More QR Codes
                  </Button>

                  <div className="flex gap-3">
                    <Button
                      variant="default"
                      className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
                      onClick={() => {
                        setIsBatchPrinting(true);

                        // Create a batch print page
                        const printWindow = window.open("", "_blank");
                        if (!printWindow) return;

                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>Blueprint QR Codes</title>
                              <style>
                                body { font-family: Arial; padding: 40px; }
                                .header { text-align: center; margin-bottom: 30px; }
                                .header h1 { color: #4338CA; margin-bottom: 5px; }
                                .header p { color: #6B7280; }
                                .qr-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 40px; }
                                .qr-card { border: 1px solid #E5E7EB; border-radius: 12px; padding: 20px; text-align: center; }
                                .qr-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; }
                                .instructions { margin-top: 40px; padding: 20px; background: #F3F4F6; border-radius: 8px; }
                                .instructions h2 { margin-top: 0; color: #4338CA; }
                                @media print {
                                  .instructions { page-break-after: always; }
                                }
                              </style>
                            </head>
                            <body>
                              <div class="header">
                                <h1>Blueprint QR Codes</h1>
                                <p>Print, cut out, and place at the matching locations in your space</p>
                              </div>

                              <div class="instructions">
                                <h2>Placement Instructions</h2>
                                <ol>
                                  <li>Cut out each QR code along the border</li>
                                  <li>Place each code at its numbered location in your space</li>
                                  <li>Mount codes at eye level (around 5ft high) for easy scanning</li>
                                  <li>Ensure codes are well-lit and not obscured</li>
                                </ol>
                              </div>

                              <div class="qr-grid" id="qr-container">
                                ${qrCodeStrings
                                  .map(
                                    (code, i) => `
                                  <div class="qr-card">
                                    <div class="qr-title">Location ${i + 1}</div>
                                    <div id="qrcode-${i}"></div>
                                  </div>
                                `,
                                  )
                                  .join("")}
                              </div>

                              <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.0/build/qrcode.min.js"></script>
                              <script>
                                // Generate all QR codes
                                Promise.all([
                                  ${qrCodeStrings
                                    .map(
                                      (code, i) => `
                                    QRCode.toCanvas(document.getElementById('qrcode-${i}'), "${code}", { width: 200 })
                                  `,
                                    )
                                    .join(",")}
                                ]).then(() => {
                                  // Print after a short delay to ensure rendering
                                  setTimeout(() => { window.print(); }, 500);
                                });
                              </script>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();

                        setTimeout(() => {
                          setIsBatchPrinting(false);
                        }, 2000);
                      }}
                    >
                      {isBatchPrinting ? (
                        <span className="flex items-center">
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Printing...
                        </span>
                      ) : (
                        <span>Print All QR Codes</span>
                      )}
                    </Button>

                    <Button
                      onClick={completeQRGeneration}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                    >
                      Continue to Next Step
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Invite Team Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Members</DialogTitle>
            <DialogDescription>
              Add collaborators to your blueprint project.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {blueprintStatus === "active" && (
              <div className="bg-green-50 p-4 rounded-lg mb-4">
                <p className="text-green-800 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Your blueprint is now active! 🎉
                </p>
                <p className="text-sm text-gray-700 mt-1.5">
                  Invite your team members so they can:
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    Access this blueprint without additional costs
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    Collaborate on designs and modifications
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    Share and view AR experiences
                  </li>
                </ul>
              </div>
            )}

            <Label htmlFor="invite-email" className="mb-1.5 block">
              Email Address
            </Label>
            <div className="flex gap-2">
              <Input
                id="invite-email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="flex-1"
              />
              <Button
                onClick={handleInviteTeamMember}
                disabled={isInviting || !inviteEmail.trim()}
                className="gap-1.5"
              >
                {isInviting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Invite
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Enter multiple emails separated by commas to invite several people
              at once.
            </p>

            {inviteSuccess && (
              <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Invitation sent successfully!
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {showOnboarding && <InteractiveOnboarding />}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share This Blueprint</DialogTitle>
            <DialogDescription>
              Invite others to view this Blueprint or copy the link below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Label className="text-sm">Public Share Link</Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={window.location.origin + "/public/" + blueprintId}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(
                    window.location.origin + "/public/" + blueprintId,
                  );
                  toast({
                    title: "Link Copied",
                    description: "Share link has been copied to your clipboard",
                  });
                }}
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone with this link can view the Blueprint.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedAnchorData && (
        <div className="absolute top-20 right-4 w-80 p-6 bg-white rounded-lg border border-gray-100 shadow-xl z-50 transition-all duration-200 ease-in-out">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-800 text-base">
              Selected Anchor Info
            </h3>
            <button
              onClick={() => setSelectedAnchorData(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div className="space-y-3">
            <div className="bg-gray-50 p-2 rounded-md">
              <p className="text-xs text-gray-500 mb-1">Anchor ID</p>
              <p className="text-sm font-mono text-gray-700 break-all">
                {selectedAnchorData.id || "N/A"}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">Text Content</p>
              <p className="text-sm text-gray-700 max-h-24 overflow-y-auto pr-1">
                {selectedAnchorData.textContent || "N/A"}
              </p>
            </div>

            <div className="bg-gray-50 p-2 rounded-md">
              <p className="text-xs text-gray-500 mb-1">Blueprint ID</p>
              <p className="text-sm font-mono text-gray-700 break-all">
                {selectedAnchorData.blueprintID || "N/A"}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">Created</p>
              <p className="text-sm text-gray-700">
                {selectedAnchorData.createdDate
                  ? new Date(
                      selectedAnchorData.createdDate.seconds * 1000,
                    ).toLocaleString()
                  : "N/A"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {/* Close Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedAnchorData(null)}
              className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-md py-1.5 transition-colors"
            >
              Close
            </Button>

            {/* 3) Our new Delete button */}
            <Button
              variant="destructive"
              size="sm"
              className="w-full text-white bg-red-500 hover:bg-red-600"
              onClick={() =>
                handleDeleteAnchor(
                  selectedAnchorData.id,
                  selectedAnchorData.blueprintID,
                )
              }
            >
              {/* Example: using a Trash icon plus “Delete” */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 
                  2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V5a2 
                  2 0 00-2-2H9a2 2 0 00-2 2v2H5m14 0H5"
                />
              </svg>
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
