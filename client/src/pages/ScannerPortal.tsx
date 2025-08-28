"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addMonths } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import axios from "axios";

// Add pdfjsLib interface to Window
declare global {
  interface Window {
    pdfjsLib: any;
  }
}
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  serverTimestamp,
  orderBy,
  addDoc,
  arrayUnion, // Add this import
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import LindyChat from "@/components/LindyChat";
import ThreeViewer from "@/components/ThreeViewer"; // Add this import

import {
  Search,
  Calendar,
  CalendarDays,
  MapPin,
  Check,
  Upload,
  UploadCloud,
  Clock,
  RefreshCcw,
  ChevronDown,
  ChevronRight,
  User,
  Building,
  Phone,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  Filter,
  Box,
  Loader2,
  ExternalLink,
  ClipboardList,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

const pdfjs = {
  workerSrc:
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js",
  lib: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js",
};

// Types
interface Booking {
  id: string;
  date: string;
  time: string;
  userId: string;
  blueprintId?: string;
  businessName: string;
  createdAt: any;
  status: "pending" | "completed" | "cancelled";
  address?: string;
  contactName?: string;
  contactPhone?: string;
}

interface User {
  uid: string;
  email: string;
  organizationName: string;
  company?: string;
  mappingContactName?: string;
  mappingContactPhoneNumber?: string;
  address?: string;
}

interface UploadData {
  customerId: string;
  blueprintId?: string;
  customerName: string;
  scanDate: string;
  modelUrl?: string;
  floorplanUrl?: string;
  notes?: string;
  status: "processing" | "ready" | "failed";
  createdAt: any;
  uploadedBy: string;
}

// Filter and search options
type FilterOption = "all" | "today" | "week" | "upcoming" | "completed";

// Main component
export default function ScannerPortal() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [uploads, setUploads] = useState<UploadData[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterOption>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [customerData, setCustomerData] = useState<User | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const bookingsByDate = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    bookings.forEach((b) => {
      map[b.date] = map[b.date] ? [...map[b.date], b] : [b];
    });
    return map;
  }, [bookings]);

  const bookedDates = useMemo(() => Object.keys(bookingsByDate).map((d) => new Date(d)), [bookingsByDate]);

  const bookingsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    return bookingsByDate[key] || [];
  }, [selectedDate, bookingsByDate]);
  // Alignment wizard states
  const [showAlignmentWizard, setShowAlignmentWizard] = useState(false);
  const [referencePoints2D, setReferencePoints2D] = useState<
    Array<{ label: string; x: number; y: number }>
  >([]);
  interface ReferencePoint {
    id: string;
    x: number;
    y: number;
    z: number;
    x3D?: number;
    y3D?: number;
    z3D?: number;
    label: "A" | "B" | "C";
  }

  const [referencePoints3D, setReferencePoints3D] = useState<ReferencePoint[]>(
    [],
  );
  const [activeLabel, setActiveLabel] = useState<"A" | "B" | "C" | null>(null);
  const [awaiting3D, setAwaiting3D] = useState(false);
  const [realDistance, setRealDistance] = useState<number>(10); // Default in feet
  const [showDistanceDialog, setShowDistanceDialog] = useState(false);
  const [alignmentTransform, setAlignmentTransform] = useState<{
    scale: number;
    rotation: number;
    translateX: number;
    translateY: number;
  } | null>(null);
  const [model3DPath, setModel3DPath] = useState<string>("");
  const [modelLoaded, setModelLoaded] = useState(false);
  // Refs for file uploads
  const modelFileRef = useRef<HTMLInputElement>(null);
  const floorplanFileRef = useRef<HTMLInputElement>(null);
  const threeDContainerRef = useRef<HTMLDivElement>(null);

  // Upload form state
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [floorplanFile, setFloorplanFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [uploadProgress, setUploadProgress] = useState({
    model: 0,
    floorplan: 0,
  });

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
      },
    },
  };

  // Load and render PDF using PDF.js
  const loadPdf = async (canvas, file) => {
    if (!canvas || !file) return;

    try {
      // Create a URL for the file
      const fileUrl = URL.createObjectURL(file);

      // Load the PDF
      const loadingTask = window.pdfjsLib.getDocument(fileUrl);
      const pdf = await loadingTask.promise;

      // Get the first page
      const page = await pdf.getPage(1);

      // Prepare canvas for rendering
      const context = canvas.getContext("2d");
      const viewport = page.getViewport({ scale: 1.5 });

      // Set canvas dimensions to match the page
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Render the PDF page
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      // Clean up
      URL.revokeObjectURL(fileUrl);
    } catch (error) {
      console.error("Error rendering PDF:", error);
      toast({
        title: "PDF Rendering Error",
        description:
          "Could not render the PDF. You can still view it in a new window.",
        variant: "destructive",
      });
    }
  };

  const isPdfFile = (file: File): boolean => {
    // Check by file extension and MIME type for maximum reliability
    const isPdfByExtension = file.name.toLowerCase().endsWith(".pdf");
    const isPdfByType = file.type === "application/pdf";
    return isPdfByExtension || isPdfByType;
  };

  // Generate a fallback for PDF files that can't be displayed
  const renderPdfFallback = (file: File) => {
    const objectUrl = URL.createObjectURL(file);

    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gray-50">
        <FileText className="w-16 h-16 text-purple-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-800 mb-2">
          PDF Floor Plan
        </h3>
        <p className="text-gray-600 text-center mb-4">
          This PDF can be used for alignment, but we need to view it in a
          separate window first.
        </p>
        <a
          href={objectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md flex items-center"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Open PDF
        </a>
        <p className="mt-4 text-sm text-gray-500">
          Return to this window to mark points on the floor plan after viewing
          the PDF
        </p>
      </div>
    );
  };

  // Helper for 2D distance:
  function distance2D(x1: number, y1: number, x2: number, y2: number) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  // Helper for angle in XY plane:
  function angle2D(x1: number, y1: number, x2: number, y2: number) {
    return Math.atan2(y2 - y1, x2 - x1);
  }

  // Compute alignment between 2D and 3D points
  const computeAlignment = useCallback(() => {
    if (referencePoints2D.length < 2 || referencePoints3D.length < 2) {
      console.log("Need at least 2 reference points in each dimension.");
      return;
    }

    // If user only placed exactly two pairs, do direct 2-point alignment:
    if (referencePoints2D.length === 2 && referencePoints3D.length === 2) {
      const pt2A = referencePoints2D[0];
      const pt2B = referencePoints2D[1];
      const pt3A = referencePoints3D[0];
      const pt3B = referencePoints3D[1];

      const dist2D = distance2D(pt2A.x, pt2A.y, pt2B.x, pt2B.y);
      const dist3D = distance2D(
        pt3A.x3D || 0,
        pt3A.y3D || 0,
        pt3B.x3D || 0,
        pt3B.y3D || 0,
      );
      const scale = dist2D / dist3D;

      const angle2 = angle2D(pt2A.x, pt2A.y, pt2B.x, pt2B.y);
      const angle3 = angle2D(
        pt3A.x3D || 0,
        pt3A.y3D || 0,
        pt3B.x3D || 0,
        pt3B.y3D || 0,
      );
      const rotation = angle2 - angle3;

      const xA3Scaled = (pt3A.x3D || 0) * scale;
      const yA3Scaled = (pt3A.y3D || 0) * scale;
      const rotatedX =
        xA3Scaled * Math.cos(rotation) - yA3Scaled * Math.sin(rotation);
      const rotatedY =
        xA3Scaled * Math.sin(rotation) + yA3Scaled * Math.cos(rotation);
      const translateX = pt2A.x - rotatedX;
      const translateY = pt2A.y - rotatedY;

      setAlignmentTransform({ scale, rotation, translateX, translateY });
      console.log("2-point alignment:", {
        scale,
        rotation,
        translateX,
        translateY,
      });
      return;
    }

    // More complex logic for 3+ points can be added here
  }, [referencePoints2D, referencePoints3D]);

  // Function to finalize the alignment and mark scan as completed
  const finalizeAlignment = async () => {
    if (
      !alignmentTransform ||
      !selectedBooking ||
      !selectedBooking.blueprintId
    ) {
      toast({
        title: "Error",
        description: "Cannot finalize alignment. Missing required data.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update the blueprint with scale factor
      await updateDoc(doc(db, "blueprints", selectedBooking.blueprintId), {
        scale: alignmentTransform.scale,
        scanCompleted: true,
        scanCompletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: "Active", // Now set status to active
      });

      // Also update the booking to completed
      await updateDoc(doc(db, "bookings", selectedBooking.id), {
        status: "completed",
      });

      // Update local booking state
      setBookings((prev) =>
        prev.map((booking) =>
          booking.id === selectedBooking.id
            ? { ...booking, status: "completed" }
            : booking,
        ),
      );

      // Show confirmation
      toast({
        title: "Success",
        description: "Alignment completed and blueprint is now active.",
      });

      // Close the alignment wizard
      setShowAlignmentWizard(false);
    } catch (error) {
      console.error("Error finalizing alignment:", error);
      toast({
        title: "Error",
        description: "Failed to save alignment data. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Function to compute scale based on real-world distance
  const computeTwoPointScale = async () => {
    if (referencePoints3D.length < 2 || realDistance <= 0) {
      toast({
        title: "Error",
        description: "Need 2 points in 3D and a valid distance",
        variant: "destructive",
      });
      return;
    }

    // We only care about the first two points
    const [ptA, ptB] = referencePoints3D;

    const dx = (ptB.x3D ?? 0) - (ptA.x3D ?? 0);
    const dy = (ptB.y3D ?? 0) - (ptA.y3D ?? 0);
    const dz = (ptB.z3D ?? 0) - (ptA.z3D ?? 0);

    const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist3D === 0) {
      toast({
        title: "Error",
        description: "Zero distance between 3D points",
        variant: "destructive",
      });
      return;
    }

    const scaleFactor = realDistance / dist3D;
    console.log("Scale factor:", scaleFactor);

    try {
      if (selectedBooking?.blueprintId) {
        await updateDoc(doc(db, "blueprints", selectedBooking.blueprintId), {
          scale: scaleFactor,
        });
        let companyName = selectedBooking.businessName || "";
        try {
          const blueprintSnap = await getDoc(
            doc(db, "blueprints", selectedBooking.blueprintId),
          );
          if (blueprintSnap.exists()) {
            const data = blueprintSnap.data();
            companyName =
              data.locationName ||
              data.businessName ||
              data.name ||
              companyName;
          }
        } catch (err) {
          console.error("Error fetching blueprint info for webhook:", err);
        }
        try {
          await fetch(
            "https://public.lindy.ai/api/v1/webhooks/lindy/0a0433bc-9930-4a1e-9734-5912316f4a6c",
            {
              method: "POST",
              headers: {
                Authorization:
                  "Bearer 1b1338d68dff4f009bbfaee1166cb9fc48b5fefa6dddbea797264674e2ee0150",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                blueprint_id: selectedBooking.blueprintId,
                scale: scaleFactor,
                company_name: companyName,
                location_name: companyName,
              }),
            },
          );
        } catch (err) {
          console.error("Error triggering Lindy webhook:", err);
        }
        console.log("Scale factor saved to Firestore:", scaleFactor);
      }

      setAlignmentTransform((prev) => ({
        ...prev,
        scale: scaleFactor,
        rotation: 0,
        translateX: 0,
        translateY: 0,
      }));

      // Close dialog and continue to final confirmation
      setShowDistanceDialog(false);

      // Set up for origin point selection or complete the process
      toast({
        title: "Scale Set",
        description: `Scale factor of ${scaleFactor.toFixed(2)} has been saved`,
      });
    } catch (err) {
      console.error("Error saving scale factor:", err);
      toast({
        title: "Error",
        description: "Failed to save scale factor",
        variant: "destructive",
      });
    }
  };

  // Load bookings on component mount
  useEffect(() => {
    const fetchBookings = async () => {
      if (!currentUser) return;

      setLoading(true);
      try {
        // Get all bookings, not just from today (we'll filter with UI controls)
        const bookingsRef = collection(db, "bookings");

        // Use composite index for efficient querying
        // Note: You may need to create this composite index in Firebase
        const q = query(
          bookingsRef,
          orderBy("date", "desc"),
          orderBy("time", "asc"),
        );

        const querySnapshot = await getDocs(q);
        const fetchedBookings: Booking[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data() as Omit<Booking, "id">;

          // Make sure we have all required fields with fallbacks
          fetchedBookings.push({
            id: doc.id,
            ...data,
            date: data.date || "",
            time: data.time || "",
            userId: data.userId || "",
            businessName: data.businessName || "Unknown Business",
            status: data.status || "pending",
            address: data.address || "",
            contactName: data.contactName || "",
            contactPhone: data.contactPhone || "",
            blueprintId: data.blueprintId || undefined,
          });
        });

        console.log("Fetched bookings:", fetchedBookings.length);
        setBookings(fetchedBookings);
        setFilteredBookings(fetchedBookings);
      } catch (error) {
        console.error("Error fetching bookings:", error);
        toast({
          title: "Error",
          description:
            "Failed to load scheduled appointments: " +
            (error instanceof Error ? error.message : "Unknown error"),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    const fetchUploads = async () => {
      if (!currentUser) return;

      try {
        const uploadsRef = collection(db, "scanUploads");
        const q = query(uploadsRef, orderBy("createdAt", "desc"));

        const querySnapshot = await getDocs(q);
        const fetchedUploads: UploadData[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data() as Omit<UploadData, "id">;
          fetchedUploads.push({
            ...data,
          });
        });

        setUploads(fetchedUploads);
      } catch (error) {
        console.error("Error fetching uploads:", error);
      }
    };

    fetchBookings();
    fetchUploads();
  }, [currentUser, toast]);

  // // Set up THREE.js scene when the alignment wizard is opened
  // useEffect(() => {
  //   if (!showAlignmentWizard || !threeDContainerRef.current || !modelFile)
  //     return;

  //   // Initialize scene, camera, renderer
  //   const scene = new THREE.Scene();
  //   scene.background = new THREE.Color(0xf0f0f0);
  //   sceneRef.current = scene;

  //   const container = threeDContainerRef.current;
  //   const width = container.clientWidth;
  //   const height = container.clientHeight;

  //   const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  //   camera.position.set(0.5, 0.5, 0.5);
  //   cameraRef.current = camera;

  //   const renderer = new THREE.WebGLRenderer({ antialias: true });
  //   renderer.setSize(width, height);
  //   container.appendChild(renderer.domElement);
  //   rendererRef.current = renderer;

  //   // Add lights
  //   const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  //   scene.add(ambientLight);

  //   const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  //   directionalLight.position.set(5, 5, 5);
  //   scene.add(directionalLight);

  //   // Set up orbit controls
  //   const controls = new OrbitControls(camera, renderer.domElement);
  //   controls.enableDamping = true;
  //   controlsRef.current = controls;

  //   // Load the 3D model
  //   const modelUrl = URL.createObjectURL(modelFile);

  //   const loader = new GLTFLoader();
  //   loader.load(
  //     modelUrl,
  //     (gltf) => {
  //       const model = gltf.scene;
  //       modelRef.current = model;

  //       // Scale and center the model
  //       const box = new THREE.Box3().setFromObject(model);
  //       const center = box.getCenter(new THREE.Vector3());
  //       const size = box.getSize(new THREE.Vector3());
  //       const maxDim = Math.max(size.x, size.y, size.z);
  //       const scale = 1 / maxDim;

  //       model.scale.multiplyScalar(scale);
  //       model.position.copy(center).multiplyScalar(-scale);

  //       scene.add(model);
  //       setModelLoaded(true);
  //     },
  //     undefined,
  //     (error) => {
  //       console.error("Error loading model:", error);
  //       toast({
  //         title: "Error",
  //         description:
  //           "Failed to load 3D model for alignment. Please try again.",
  //         variant: "destructive",
  //       });
  //     },
  //   );

  //   // Animation loop
  //   const animate = () => {
  //     animationFrameRef.current = requestAnimationFrame(animate);
  //     controls.update();
  //     renderer.render(scene, camera);
  //   };

  //   animate();

  //   // Clean up when the component unmounts
  //   return () => {
  //     cancelAnimationFrame(animationFrameRef.current);
  //     if (
  //       rendererRef.current &&
  //       container.contains(rendererRef.current.domElement)
  //     ) {
  //       container.removeChild(rendererRef.current.domElement);
  //     }
  //     URL.revokeObjectURL(modelUrl);
  //   };
  // }, [showAlignmentWizard, modelFile, toast]);

  // Apply filters to bookings
  useEffect(() => {
    if (loading) return;

    let filtered = [...bookings];

    // Apply status/date filters
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStr = today.toISOString().split("T")[0];

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split("T")[0];

    switch (activeFilter) {
      case "today":
        filtered = filtered.filter((booking) => booking.date === todayStr);
        break;
      case "week":
        filtered = filtered.filter(
          (booking) => booking.date >= todayStr && booking.date <= nextWeekStr,
        );
        break;
      case "upcoming":
        filtered = filtered.filter((booking) => booking.status === "pending");
        break;
      case "completed":
        filtered = filtered.filter((booking) => booking.status === "completed");
        break;
      default:
        // 'all' - no additional filtering
        break;
    }

    // Apply search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (booking) =>
          booking.businessName?.toLowerCase().includes(term) ||
          booking.address?.toLowerCase().includes(term) ||
          booking.contactName?.toLowerCase().includes(term),
      );
    }

    setFilteredBookings(filtered);
  }, [activeFilter, searchTerm, bookings, loading]);

  // Fetch customer data for a selected booking
  const fetchCustomerData = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, "users", userId));

      if (userDoc.exists()) {
        return userDoc.data() as User;
      }
      return null;
    } catch (error) {
      console.error("Error fetching customer data:", error);
      return null;
    }
  };

  // Handle booking selection and open upload dialog
  const handleBookingSelect = async (booking: Booking) => {
    setSelectedBooking(booking);

    // Fetch customer details
    const customer = await fetchCustomerData(booking.userId);
    setCustomerData(customer);

    // Fetch blueprint data if available
    if (booking.blueprintId) {
      await fetchBlueprintData(booking.blueprintId);
    }

    // Reset upload form
    setModelFile(null);
    setFloorplanFile(null);
    setNotes("");
    setUploadProgress({ model: 0, floorplan: 0 });

    // Open upload dialog
    setIsUploadDialogOpen(true);
  };

  // Add these state/refs for THREE.js integration
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const modelRef = useRef<THREE.Object3D | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameRef = useRef<number>(0);

  // Handle file selection
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "model" | "floorplan",
  ) => {
    if (e.target.files && e.target.files[0]) {
      if (type === "model") {
        setModelFile(e.target.files[0]);
      } else {
        setFloorplanFile(e.target.files[0]);
      }
    }
  };

  // Add this state for storing the blueprint's 3D model URL
  const [blueprint3DModelUrl, setBlueprint3DModelUrl] = useState<string>("");
  const [loadingBlueprintData, setLoadingBlueprintData] = useState(false);

  // Add this function to fetch blueprint data
  const fetchBlueprintData = async (blueprintId: string) => {
    setLoadingBlueprintData(true);
    try {
      const blueprintDoc = await getDoc(doc(db, "blueprints", blueprintId));
      if (blueprintDoc.exists()) {
        const data = blueprintDoc.data();
        if (data.floorPlan3DUrl) {
          setBlueprint3DModelUrl(data.floorPlan3DUrl);
          console.log(
            "Loaded floorPlan3DUrl from blueprint:",
            data.floorPlan3DUrl,
          );
        }
      }
    } catch (error) {
      console.error("Error fetching blueprint data:", error);
    } finally {
      setLoadingBlueprintData(false);
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (!selectedBooking || !customerData) {
      toast({
        title: "Error",
        description: "Missing customer information.",
        variant: "destructive",
      });
      return;
    }

    if (!modelFile && !floorplanFile) {
      toast({
        title: "Error",
        description: "Please select at least one file to upload.",
        variant: "destructive",
      });
      return;
    }

    setUploadLoading(true);
    let modelUrl = "";
    let floorplanUrl = "";

    try {
      // Upload model file to Backblaze B2 if selected
      if (modelFile) {
        const formData = new FormData();
        formData.append("file", modelFile);

        const response = await axios.post("/api/upload-to-b2", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (event) => {
            if (event.total) {
              const progress = (event.loaded / event.total) * 100;
              setUploadProgress((prev) => ({ ...prev, model: progress }));
            }
          },
        });

        modelUrl = response.data.url;
      }

      // Upload floorplan file if selected
      if (floorplanFile) {
        const floorplanStorageRef = ref(
          storage,
          `floorplans/${selectedBooking.userId}/${Date.now()}_${floorplanFile.name}`,
        );

        const floorplanUploadTask = uploadBytesResumable(
          floorplanStorageRef,
          floorplanFile,
        );

        // Track upload progress
        floorplanUploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress =
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress((prev) => ({ ...prev, floorplan: progress }));
          },
          (error) => {
            throw error;
          },
        );

        // Wait for upload to complete
        await floorplanUploadTask;
        floorplanUrl = await getDownloadURL(floorplanStorageRef);
      }

      // Save upload record in Firestore
      const uploadData: Omit<UploadData, "id"> = {
        customerId: selectedBooking.userId,
        blueprintId: selectedBooking.blueprintId,
        customerName:
          customerData.organizationName || customerData.company || "Unknown",
        scanDate: selectedBooking.date,
        modelUrl,
        floorplanUrl,
        notes: notes.trim(),
        status: "ready",
        createdAt: serverTimestamp(),
        uploadedBy: currentUser?.uid || "",
      };

      await addDoc(collection(db, "scanUploads"), uploadData);

      // Update booking status to completed
      await updateDoc(doc(db, "bookings", selectedBooking.id), {
        status: "processing",
      });

      // Declare blueprintId variable to be used in both branches
      let blueprintId: string | undefined;

      // Update blueprints collection if a blueprintId exists
      if (selectedBooking.blueprintId) {
        blueprintId = selectedBooking.blueprintId;
        await updateDoc(doc(db, "blueprints", selectedBooking.blueprintId), {
          floorPlan3DUrl: modelUrl,
          floorPlanUrl: floorplanUrl,
          scanCompleted: false, // Not completed until alignment is done
          updatedAt: serverTimestamp(),
        });

        // Store the URLs for later use in alignment
        if (modelUrl) {
          setModel3DPath(modelUrl);
          console.log("Setting model3DPath to:", modelUrl); // Add this debug log
        }

        // Show the alignment wizard next
        setIsUploadDialogOpen(false);
        setShowAlignmentWizard(true);
        setActiveLabel("A");
        setModelLoaded(false);

        // Add the blueprint to the user's createdBlueprintIDs array if not already there
        await updateDoc(doc(db, "users", selectedBooking.userId), {
          createdBlueprintIDs: arrayUnion(selectedBooking.blueprintId),
        });

        // Also store the files in the uploadedFiles array of the blueprint
        if (modelFile || floorplanFile) {
          const filesArray: Array<{
            id: string;
            type: string;
            name: string;
            url: string;
            uploadedAt: number;
          }> = [];

          // When creating filesArray for arrayUnion
          if (modelFile) {
            filesArray.push({
              id: Date.now().toString(),
              type: "3dModel",
              name: modelFile.name,
              url: modelUrl,
              uploadedAt: Date.now(), // Using JavaScript timestamp instead
            });
          }

          if (floorplanFile) {
            filesArray.push({
              id: (Date.now() + 1).toString(),
              type: "floorplan",
              name: floorplanFile.name,
              url: floorplanUrl,
              uploadedAt: Date.now(), // Using JavaScript timestamp instead
            });
          }

          // Update the blueprint with the uploaded files
          await updateDoc(doc(db, "blueprints", selectedBooking.blueprintId), {
            uploadedFiles: arrayUnion(...filesArray),
          });
        }
      } else {
        // If no blueprintId exists, create a new blueprint document
        blueprintId = crypto.randomUUID();
        const businessName =
          customerData.organizationName || customerData.company || "Unknown";
        const address = customerData.address || selectedBooking.address || "";
        await setDoc(doc(db, "blueprints", blueprintId), {
          id: blueprintId,
          businessName: businessName,
          name: businessName, // Add name field that matches businessName for backward compatibility
          address: address,
          host: selectedBooking.userId,
          locationType: "retail", // Default to retail for consistency
          floorPlan3DUrl: modelUrl,
          floorPlanUrl: floorplanUrl,
          scanCompleted: true,
          scanCompletedAt: serverTimestamp(),
          createdDate: serverTimestamp(),
          updatedAt: serverTimestamp(),
          status: "Active", // Set status to active after scan is completed
          email: customerData.email || "",
          phone: selectedBooking.contactPhone || "",
          uploadedFiles: [
            ...(modelUrl
              ? [
                  {
                    id: Date.now().toString(),
                    type: "3dModel",
                    name: modelFile?.name || "3D Model",
                    url: modelUrl,
                    uploadedAt: serverTimestamp(),
                  },
                ]
              : []),
            ...(floorplanUrl
              ? [
                  {
                    id: (Date.now() + 1).toString(),
                    type: "floorplan",
                    name: floorplanFile?.name || "Floor Plan",
                    url: floorplanUrl,
                    uploadedAt: serverTimestamp(),
                  },
                ]
              : []),
          ],
        });

        // Update the booking with the new blueprintId
        await updateDoc(doc(db, "bookings", selectedBooking.id), {
          blueprintId: blueprintId,
        });

        // Add the blueprint to the user's createdBlueprintIDs array
        await updateDoc(doc(db, "users", selectedBooking.userId), {
          createdBlueprintIDs: arrayUnion(blueprintId),
        });
      }

      // Initialize a variable to store the blueprint ID
      const finalBlueprintId = selectedBooking.blueprintId || blueprintId || "";

      try {
        await fetch(
          "https://public.lindy.ai/api/v1/webhooks/lindy/d4154987-467d-4387-b80c-3adf9b064b9f",
          {
            method: "POST",
            headers: {
              Authorization:
                "Bearer 1b1338d68dff4f009bbfaee1166cb9fc48b5fefa6dddbea797264674e2ee0150",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              booking_id: selectedBooking.id,
              blueprint_id: finalBlueprintId,
              model_url: modelUrl || null,
              floorplan_url: floorplanUrl || null,
            }),
          },
        );
      } catch (err) {
        console.error("Lindy webhook error:", err);
      }

      // Show success message
      toast({
        title: "Upload Complete",
        description: "Files have been successfully uploaded.",
      });

      // Update local state to reflect changes
      setBookings((prev) =>
        prev.map((booking) =>
          booking.id === selectedBooking.id
            ? { ...booking, status: "completed" }
            : booking,
        ),
      );

      // After successful upload, fetch the updated blueprint data
      if (selectedBooking?.blueprintId) {
        await fetchBlueprintData(selectedBooking.blueprintId);
      }

      // Show the alignment wizard
      setIsUploadDialogOpen(false);
      setShowAlignmentWizard(true);
      setActiveLabel("A");
      setModelLoaded(false);
    } catch (error) {
      console.error("Error uploading files:", error);
      toast({
        title: "Upload Failed",
        description:
          "There was an error uploading your files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadLoading(false);
    }
  };

  // Format time for display (convert from 24h to 12h format)
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "EEEE, MMMM d, yyyy");
    } catch (e) {
      return dateString;
    }
  };

  // Status badges
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-600 border-blue-200"
          >
            Pending
          </Badge>
        );
      case "completed":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-600 border-green-200"
          >
            Completed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-600 border-red-200"
          >
            Cancelled
          </Badge>
        );
      case "processing":
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-600 border-amber-200"
          >
            Processing
          </Badge>
        );
      case "ready":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-600 border-green-200"
          >
            Ready
          </Badge>
        );
      case "failed":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-600 border-red-200"
          >
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get today's date formatted
  const getTodayFormatted = () => {
    return format(new Date(), "EEEE, MMMM d, yyyy");
  };

  // Reset filters
  const resetFilters = () => {
    setActiveFilter("all");
    setSearchTerm("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <Nav />

      <main className="container mx-auto px-4 pt-24 pb-16">
        <motion.div
          className="max-w-7xl mx-auto"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          {/* Header Section */}
          <motion.div
            className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
            variants={itemVariants}
          >
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Scanner Team Portal
              </h1>
              <p className="text-gray-600 mt-1">
                Today is {getTodayFormatted()}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full md:w-auto">
              <Button
                className="bg-purple-600 hover:bg-purple-700"
                onClick={() => window.location.reload()}
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                Refresh Data
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex-1 sm:flex-none">
                    <Filter className="w-4 h-4 mr-2" />
                    Filter
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setActiveFilter("all")}>
                    All Appointments
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveFilter("today")}>
                    Today Only
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveFilter("week")}>
                    This Week
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveFilter("upcoming")}>
                    Upcoming (Pending)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setActiveFilter("completed")}
                  >
                    Completed
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </motion.div>

          {/* Search & Filters */}
          <motion.div
            className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100"
            variants={itemVariants}
          >
            <div className="flex items-center w-full max-w-md">
              <Search className="w-5 h-5 text-gray-400 mr-2" />
              <Input
                type="text"
                placeholder="Search by business name or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchTerm("")}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="flex gap-2 flex-wrap justify-center sm:justify-end">
              <Button
                variant={activeFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("all")}
                className={
                  activeFilter === "all"
                    ? "bg-purple-600 hover:bg-purple-700"
                    : ""
                }
              >
                All
              </Button>
              <Button
                variant={activeFilter === "today" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("today")}
                className={
                  activeFilter === "today"
                    ? "bg-purple-600 hover:bg-purple-700"
                    : ""
                }
              >
                Today
              </Button>
              <Button
                variant={activeFilter === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("week")}
                className={
                  activeFilter === "week"
                    ? "bg-purple-600 hover:bg-purple-700"
                    : ""
                }
              >
                This Week
              </Button>
              <Button
                variant={activeFilter === "upcoming" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("upcoming")}
                className={
                  activeFilter === "upcoming"
                    ? "bg-purple-600 hover:bg-purple-700"
                    : ""
                }
              >
                Pending
              </Button>
              <Button
                variant={activeFilter === "completed" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("completed")}
                className={
                  activeFilter === "completed"
                    ? "bg-purple-600 hover:bg-purple-700"
                    : ""
                }
              >
                Completed
              </Button>
            </div>
          </motion.div>

          {/* Tabs */}
          <motion.div variants={itemVariants}>
            <Tabs defaultValue="appointments" className="w-full">
              <TabsList className="w-full max-w-md mb-6">
                <TabsTrigger value="appointments" className="flex-1">
                  <Calendar className="w-4 h-4 mr-2" />
                  Appointments
                </TabsTrigger>
                <TabsTrigger value="calendar" className="flex-1">
                  <CalendarDays className="w-4 h-4 mr-2" />
                  Calendar
                </TabsTrigger>
                <TabsTrigger value="uploads" className="flex-1">
                  <UploadCloud className="w-4 h-4 mr-2" />
                  Recent Uploads
                </TabsTrigger>
              </TabsList>

              {/* Appointments Tab */}
              <TabsContent value="appointments" className="mt-0">
                <AnimatePresence>
                  {loading ? (
                    <motion.div
                      className="flex justify-center items-center py-12"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
                    </motion.div>
                  ) : filteredBookings.length === 0 ? (
                    <motion.div
                      className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <ClipboardList className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                      <h3 className="text-xl font-medium text-gray-700">
                        No appointments found
                      </h3>
                      <p className="text-gray-500 mt-2 max-w-md mx-auto">
                        {searchTerm || activeFilter !== "all"
                          ? "Try changing your search or filters"
                          : "There are no upcoming appointments scheduled at the moment."}
                      </p>
                      {(searchTerm || activeFilter !== "all") && (
                        <Button
                          variant="outline"
                          onClick={resetFilters}
                          className="mt-4"
                        >
                          Reset Filters
                        </Button>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {filteredBookings.map((booking) => (
                        <motion.div key={booking.id} variants={itemVariants}>
                          <Card className="h-full border-0 shadow-md hover:shadow-lg transition-shadow overflow-hidden">
                            <CardHeader
                              className={cn(
                                "pb-3 border-b",
                                booking.status === "completed"
                                  ? "bg-gradient-to-r from-green-50 to-emerald-50"
                                  : "bg-gradient-to-r from-purple-50 to-indigo-50",
                              )}
                            >
                              <div className="flex justify-between items-start">
                                <CardTitle className="text-xl text-gray-800 truncate">
                                  {booking.businessName}
                                </CardTitle>
                                {getStatusBadge(booking.status)}
                              </div>
                              <CardDescription className="flex items-center mt-1">
                                <Calendar className="w-4 h-4 mr-1 text-gray-500" />
                                {formatDate(booking.date)} at{" "}
                                {formatTime(booking.time)}
                              </CardDescription>
                            </CardHeader>

                            <CardContent className="pt-4 pb-2">
                              {booking.address && (
                                <div className="flex items-start gap-2 mb-3">
                                  <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                  <span className="text-sm text-gray-600">
                                    {booking.address}
                                  </span>
                                </div>
                              )}

                              {booking.contactName && (
                                <div className="flex items-center gap-2 mb-3">
                                  <User className="w-4 h-4 text-gray-500" />
                                  <span className="text-sm text-gray-600">
                                    {booking.contactName}
                                  </span>
                                </div>
                              )}

                              {booking.contactPhone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4 text-gray-500" />
                                  <span className="text-sm text-gray-600">
                                    {booking.contactPhone}
                                  </span>
                                </div>
                              )}
                            </CardContent>

                            <CardFooter className="border-t pt-3 pb-3 bg-gray-50">
                              <Button
                                className={cn(
                                  "w-full gap-2",
                                  booking.status === "completed"
                                    ? "bg-green-600 hover:bg-green-700"
                                    : "bg-purple-600 hover:bg-purple-700",
                                )}
                                onClick={() => handleBookingSelect(booking)}
                              >
                                {booking.status === "completed" ? (
                                  <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    View Details
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-4 h-4" />
                                    Upload Scan Files
                                  </>
                                )}
                              </Button>
                            </CardFooter>
                          </Card>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </TabsContent>

              {/* Calendar Tab */}
              <TabsContent value="calendar" className="mt-0">
                <div className="flex flex-col md:flex-row gap-6">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    numberOfMonths={2}
                    disabled={{ before: new Date() }}
                    fromMonth={new Date()}
                    toMonth={addMonths(new Date(), 1)}
                    modifiers={{ booked: bookedDates }}
                    modifiersClassNames={{
                      booked: "bg-purple-200 text-purple-900",
                    }}
                  />
                  <div className="flex-1 space-y-4">
                    {bookingsForSelectedDate.length > 0 ? (
                      bookingsForSelectedDate.map((booking) => (
                        <Card
                          key={booking.id}
                          className="overflow-hidden border-0 shadow-md"
                        >
                          <CardHeader className="bg-gray-50">
                            <CardTitle className="text-lg">
                              {booking.businessName}
                            </CardTitle>
                            <CardDescription>
                              {formatDate(booking.date)} at {formatTime(booking.time)}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-4 space-y-2">
                            {booking.address && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <MapPin className="w-4 h-4 text-gray-500" />
                                {booking.address}
                              </div>
                            )}
                            {booking.contactName && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <User className="w-4 h-4 text-gray-500" />
                                {booking.contactName}
                              </div>
                            )}
                            {booking.contactPhone && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Phone className="w-4 h-4 text-gray-500" />
                                {booking.contactPhone}
                              </div>
                            )}
                          </CardContent>
                          <CardFooter className="border-t bg-gray-50">
                            <Button
                              className={cn(
                                "w-full gap-2",
                                booking.status === "completed"
                                  ? "bg-green-600 hover:bg-green-700"
                                  : "bg-purple-600 hover:bg-purple-700",
                              )}
                              onClick={() => handleBookingSelect(booking)}
                            >
                              {booking.status === "completed" ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4" />
                                  View Details
                                </>
                              ) : (
                                <>
                                  <Upload className="w-4 h-4" />
                                  Upload Scan Files
                                </>
                              )}
                            </Button>
                          </CardFooter>
                        </Card>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">
                        No bookings for this day.
                      </p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Recent Uploads Tab */}
              <TabsContent value="uploads" className="mt-0">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b bg-gray-50">
                    <h3 className="text-lg font-medium text-gray-800">
                      Recent Uploads
                    </h3>
                  </div>

                  {uploads.length === 0 ? (
                    <div className="p-8 text-center">
                      <UploadCloud className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No uploads found</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {uploads.map((upload, index) => (
                        <div
                          key={index}
                          className="p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-medium text-gray-800">
                                {upload.customerName}
                              </h4>
                              <p className="text-sm text-gray-500">
                                {formatDate(upload.scanDate)}
                              </p>
                            </div>
                            {getStatusBadge(upload.status)}
                          </div>

                          <div className="flex flex-wrap gap-4 mt-3">
                            {upload.modelUrl && (
                              <a
                                href={upload.modelUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-sm text-purple-600 hover:text-purple-800"
                              >
                                <Box className="w-4 h-4 mr-1" />
                                View 3D Model
                              </a>
                            )}

                            {upload.floorplanUrl && (
                              <a
                                href={upload.floorplanUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-sm text-purple-600 hover:text-purple-800"
                              >
                                <FileText className="w-4 h-4 mr-1" />
                                View Floor Plan
                              </a>
                            )}
                          </div>

                          {upload.notes && (
                            <div className="mt-2 text-sm text-gray-600">
                              <p className="italic">{upload.notes}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        </motion.div>
      </main>

      {/* Upload Dialog */}
      {isUploadDialogOpen && (
        <Dialog open={true} onOpenChange={setIsUploadDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl">Upload Scan Files</DialogTitle>
              <DialogDescription>
                Upload the 3D model and floor plan for the customer location.
              </DialogDescription>
            </DialogHeader>

            {selectedBooking && customerData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
                {/* Customer Information */}
                <div className="space-y-4">
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                    <h3 className="text-lg font-medium text-purple-800 mb-2 flex items-center">
                      <Building className="w-5 h-5 mr-2 text-purple-600" />
                      Customer Information
                    </h3>

                    <div className="space-y-3">
                      <div>
                        <Label className="text-purple-700">Business Name</Label>
                        <p className="font-medium">
                          {customerData.organizationName ||
                            customerData.company}
                        </p>
                      </div>

                      <div>
                        <Label className="text-purple-700">Contact Name</Label>
                        <p>
                          {customerData.mappingContactName || "Not provided"}
                        </p>
                      </div>

                      <div>
                        <Label className="text-purple-700">Contact Phone</Label>
                        <p>
                          {customerData.mappingContactPhoneNumber ||
                            "Not provided"}
                        </p>
                      </div>

                      <div>
                        <Label className="text-purple-700">Address</Label>
                        <p>
                          {customerData.address ||
                            selectedBooking.address ||
                            "Not provided"}
                        </p>
                      </div>

                      <div>
                        <Label className="text-purple-700">Appointment</Label>
                        <p>
                          {formatDate(selectedBooking.date)} at{" "}
                          {formatTime(selectedBooking.time)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upload Form */}
                <div className="space-y-4">
                  <div className="space-y-3">
                    <Label htmlFor="modelFile" className="text-gray-700">
                      3D Model File (GLB)
                    </Label>
                    <div
                      className={cn(
                        "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                        modelFile
                          ? "border-green-300 bg-green-50"
                          : "border-gray-300 hover:border-purple-300 hover:bg-purple-50",
                      )}
                      onClick={() => modelFileRef.current?.click()}
                    >
                      {modelFile ? (
                        <div className="flex flex-col items-center">
                          <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
                          <p className="font-medium text-green-600">
                            {modelFile.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {(modelFile.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModelFile(null);
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center py-4">
                          <UploadCloud className="w-10 h-10 text-gray-400 mb-2" />
                          <p className="font-medium text-gray-700">
                            Drop your 3D model here
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            or click to browse files
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            Supports GLB format
                          </p>
                        </div>
                      )}
                      <input
                        type="file"
                        id="modelFile"
                        ref={modelFileRef}
                        className="hidden"
                        accept=".glb"
                        onChange={(e) => handleFileChange(e, "model")}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="floorplanFile" className="text-gray-700">
                      Floor Plan (PDF, PNG, JPG)
                    </Label>
                    <div
                      className={cn(
                        "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                        floorplanFile
                          ? "border-green-300 bg-green-50"
                          : "border-gray-300 hover:border-purple-300 hover:bg-purple-50",
                      )}
                      onClick={() => floorplanFileRef.current?.click()}
                    >
                      {floorplanFile ? (
                        <div className="flex flex-col items-center">
                          <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
                          <p className="font-medium text-green-600">
                            {floorplanFile.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {(floorplanFile.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFloorplanFile(null);
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center py-4">
                          <FileText className="w-10 h-10 text-gray-400 mb-2" />
                          <p className="font-medium text-gray-700">
                            Drop your floor plan here
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            or click to browse files
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            Supports PDF, PNG, and JPG formats
                          </p>
                        </div>
                      )}
                      <input
                        type="file"
                        id="floorplanFile"
                        ref={floorplanFileRef}
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => handleFileChange(e, "floorplan")}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="notes" className="text-gray-700">
                      Notes (Optional)
                    </Label>
                    <Input
                      id="notes"
                      placeholder="Add any notes about the scan..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsUploadDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleUpload}
                disabled={uploadLoading || (!modelFile && !floorplanFile)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {uploadLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4 mr-2" />
                    Upload Files
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <Footer />
      <LindyChat />

      {/* Distance Dialog */}
      {showDistanceDialog && (
        <Dialog open={showDistanceDialog} onOpenChange={setShowDistanceDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Real Distance</DialogTitle>
              <DialogDescription>
                Enter the real distance between your two 3D points, in feet.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2 mt-4">
              <Label className="whitespace-nowrap">Distance (ft):</Label>
              <Input
                type="number"
                step="0.01"
                value={realDistance}
                onChange={(e) =>
                  setRealDistance(parseFloat(e.target.value) || 0)
                }
                className="flex-1"
              />
            </div>

            <Button
              variant="default"
              className="mt-4"
              onClick={computeTwoPointScale}
            >
              Apply
            </Button>
          </DialogContent>
        </Dialog>
      )}

      {/* Alignment Wizard */}
      {showAlignmentWizard && (
        <Dialog open={true} onOpenChange={setShowAlignmentWizard}>
          <DialogContent className="max-w-6xl h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Align 2D & 3D Views</DialogTitle>
              <DialogDescription>
                Match your 2D floor plan with the 3D model for accurate
                placement. Mark at least 2 points on both views.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-hidden grid grid-cols-2 gap-4">
              {/* Left half: 2D floor plan */}
              <div
                className="border rounded-md relative overflow-auto"
                style={{ height: "500px" }}
              >
                {/* Content container */}
                <div className="relative">
                  {/* PDF or Image display */}
                  {floorplanFile && (
                    <div className="w-full h-full">
                      {isPdfFile(floorplanFile) ? (
                        <div className="w-full h-full relative">
                          {/* Canvas for PDF rendering */}
                          <canvas
                            id="pdf-canvas"
                            className="w-full h-full"
                            ref={(canvas) => {
                              if (canvas && floorplanFile) {
                                // Load PDF.js script dynamically if not already loaded
                                if (!window.pdfjsLib) {
                                  const script =
                                    document.createElement("script");
                                  script.src = pdfjs.lib;
                                  script.onload = () => {
                                    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                                      pdfjs.workerSrc;
                                    loadPdf(canvas, floorplanFile);
                                  };
                                  document.head.appendChild(script);
                                } else {
                                  loadPdf(canvas, floorplanFile);
                                }
                              }
                            }}
                          />
                          <div className="absolute top-2 right-2 z-30">
                            <a
                              href={URL.createObjectURL(floorplanFile)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-md flex items-center text-sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              View PDF
                            </a>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={URL.createObjectURL(floorplanFile)}
                          alt="Floor Plan"
                          className="w-auto h-auto"
                          style={{ minWidth: "100%" }}
                        />
                      )}
                    </div>
                  )}

                  {/* Transparent overlay to capture clicks */}
                  <div
                    className="absolute inset-0 z-20"
                    onClick={(e) => {
                      if (!activeLabel || awaiting3D) return;

                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const y = e.clientY - rect.top;

                      const label = String.fromCharCode(
                        65 + referencePoints2D.length,
                      ); // A, B, C

                      setReferencePoints2D([
                        ...referencePoints2D,
                        { label, x, y },
                      ]);
                      setAwaiting3D(true);
                      setActiveLabel(label as "A" | "B" | "C");
                    }}
                  />

                  {/* Render reference points */}
                  {referencePoints2D.map((pt) => (
                    <div
                      key={pt.label}
                      className="absolute w-6 h-6 flex items-center justify-center text-white font-bold rounded-full transform -translate-x-1/2 -translate-y-1/2 cursor-move z-30"
                      style={{
                        backgroundColor:
                          pt.label === "A"
                            ? "#ff0000"
                            : pt.label === "B"
                              ? "#00ff00"
                              : "#0000ff",
                        left: pt.x,
                        top: pt.y,
                      }}
                    >
                      {pt.label}
                    </div>
                  ))}

                  {/* Points info panel */}
                  <div className="absolute bottom-2 left-2 bg-white/80 p-2 rounded shadow z-30">
                    <h4 className="font-medium mb-1">2D Points</h4>
                    {referencePoints2D.map((pt, i) => (
                      <div key={i}>
                        {pt.label}: ({pt.x.toFixed(1)}, {pt.y.toFixed(1)})
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right half: 3D Model */}
              <div className="border rounded-md relative bg-gray-100 overflow-hidden">
                <ThreeViewer
                  //modelPath={model3DPath}
                  modelPath={blueprint3DModelUrl}
                  activeLabel={activeLabel}
                  awaiting3D={awaiting3D}
                  setReferencePoints3D={setReferencePoints3D}
                  setAwaiting3D={setAwaiting3D}
                  setActiveLabel={setActiveLabel}
                  onLoad={() => setModelLoaded(true)}
                  onError={(error) => {
                    console.error("Error loading 3D model:", error);
                    toast({
                      title: "Error",
                      description:
                        "Failed to load 3D model for alignment. Please try again.",
                      variant: "destructive",
                    });
                  }}
                />
                <div className="absolute bottom-2 left-2 bg-white/80 p-2 rounded shadow z-10">
                  <h4 className="font-medium mb-1">3D Points</h4>
                  {referencePoints3D.map((pt, i) => (
                    <div key={i}>
                      {pt.label}: ({pt.x3D?.toFixed(2)}, {pt.y3D?.toFixed(2)},{" "}
                      {pt.z3D?.toFixed(2)})
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">
                  {awaiting3D
                    ? `Click on the corresponding point in the 3D view for point ${activeLabel}`
                    : activeLabel
                      ? `Select point ${activeLabel} on the 2D floor plan`
                      : `Click Reset Points to start again or Compute Scale when you've placed at least 2 points`}
                </p>
              </div>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setReferencePoints2D([]);
                    setReferencePoints3D([]);
                    setActiveLabel("A");
                    setAwaiting3D(false);
                  }}
                >
                  Reset Points
                </Button>
                <Button
                  variant="default"
                  disabled={
                    referencePoints2D.length < 2 || referencePoints3D.length < 2
                  }
                  onClick={() => {
                    // For the simplified version, we'll just show the distance dialog
                    setShowDistanceDialog(true);
                  }}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Compute Scale
                </Button>
                <Button
                  variant="default"
                  disabled={!alignmentTransform}
                  onClick={finalizeAlignment}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Finalize & Complete
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
