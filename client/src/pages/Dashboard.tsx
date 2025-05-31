// This file defines the Dashboard page component, which serves as the main interface for users after they log in.
// It displays an overview of their "Blueprints" (3D spaces), analytics, and provides navigation to other sections.
// The dashboard also includes an onboarding flow for new users and a waiting screen for users whose 3D mapping is pending.

"use client";

import { useState, useEffect } from "react";
import GeminiChat from "@/components/GeminiChat";
import GeminiMultimodal from "@/components/GeminiMultimodal";
import { motion, AnimatePresence } from "framer-motion";
import DarkModeToggle from "@/components/DarkModeToggle";
import { LiveAPIProvider } from "@/contexts/LiveAPIContext";
import BlueprintImage from "@/components/BlueprintImage";
import { useToast } from "@/hooks/use-toast";
import {
  Home,
  Building2,
  Users,
  ShoppingBag,
  Star,
  Plus,
  BarChart,
  ChevronRight,
  Calendar,
  Activity,
  Clock,
  TrendingUp,
  Zap,
  MapPin,
  Filter,
  Search,
  Settings,
  Bell,
  HelpCircle,
  ExternalLink,
  ArrowUpRight,
  ChevronDown,
  User,
  Edit,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardOnboarding } from "@/hooks/useDashboardOnboarding";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { Spotlight } from "@/components/onboarding/Spotlight";
import { OnboardingTooltip } from "@/components/onboarding/OnboardingTooltip";
import { ProgressBadge } from "@/components/onboarding/ProgressBadge";
import confetti from "canvas-confetti";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "wouter";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import ScreenShareButton from "@/components/ScreenShareButton";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

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

/**
 * The Dashboard component is the main interface for users after they log in.
 * It displays an overview of their "Blueprints" (3D spaces), analytics, and provides navigation to other sections.
 * The dashboard also includes an onboarding flow for new users and a waiting screen for users whose 3D mapping is pending.
 *
 * @returns {JSX.Element} The rendered Dashboard page.
 */
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentUser } = useAuth();
  const [totalBlueprints, setTotalBlueprints] = useState(0);
  const [blueprints, setBlueprints] = useState<any[]>([]);
  const [blueprintsLastMonth, setBlueprintsLastMonth] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isWaitingForMapping, setIsWaitingForMapping] = useState(false);
  const [mappingDate, setMappingDate] = useState(null);
  const [mappingTime, setMappingTime] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTimeRange, setSelectedTimeRange] = useState("lastWeek");
  const [activeBlueprintsPercentage, setActiveBlueprintsPercentage] =
    useState(65);
  const [notificationCount, setNotificationCount] = useState(3);

  // Filtered blueprints based on search query
  const filteredBlueprints = blueprints.filter(
    (blueprint) =>
      (blueprint?.name?.toLowerCase() || "").includes(
        searchQuery.toLowerCase(),
      ) ||
      (blueprint?.type?.toLowerCase() || "").includes(
        searchQuery.toLowerCase(),
      ),
  );

  const apiKey = "AIzaSyCyyCfGsXRnIRC9HSVVuCMN5grzPkyTtkY";
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
  });

  const generationConfig = {
    temperature: 0.3,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
  };

  /**
   * Initializes a chat session with the Gemini model and sends an initial message.
   * This function is likely used for an AI chat feature within the dashboard.
   */
  async function run() {
    const chatSession = model.startChat({
      generationConfig,
      history: [],
    });

    const result = await chatSession.sendMessage(
      "Tell the user to try out Multimodal (Share screen) w/ AI Studio and then ask it about the editor.",
    );
    console.log(result.response.text());
  }

  const {
    onboardingCompleted,
    onboardingStep,
    showWelcomeModal,
    activeTab: onboardingActiveTab,
    isOnboardingActive,
    overviewTabRef,
    statsCardRef,
    blueprintsTabRef,
    blueprintItemRef,
    createBlueprintRef,
    setActiveTab: setOnboardingActiveTab,
    startOnboarding,
    skipOnboarding,
    nextStep,
    prevStep,
    completeOnboarding,
  } = useDashboardOnboarding();

  const [showCompletionNotification, setShowCompletionNotification] =
    useState(false);

  // Sync onboarding tab with actual tab
  useEffect(() => {
    if (isOnboardingActive) {
      setActiveTab(onboardingActiveTab);
    }
  }, [onboardingActiveTab, isOnboardingActive]);

  // Show confetti effect when onboarding completes
  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  // Define type for Firestore timestamp that may have a toDate() method
  interface FirestoreTimestamp {
    toDate(): Date;
  }
  
  // Define the activity interface with all needed properties
  interface Activity {
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: Date | FirestoreTimestamp;
    icon?: string;
    event?: string;
    time?: string;
    blueprintName?: string;
  }
  
  // Define the user data interface
  interface UserData {
    averageRating?: number;
    totalReviews?: number;
    recentActivities?: Activity[];
    mappingScheduleDate?: Date | FirestoreTimestamp;
    mappingScheduleTime?: string;
    finishedOnboarding?: boolean;
    createdBlueprintIDs?: string[];
    planType?: string;
    planExpiryDate?: Date | FirestoreTimestamp | null;
    planUsage?: number;
    activeBlueprintsPercentage?: number;
    totalCustomers?: number;
    customerGrowth?: number;
    newCustomersThisMonth?: number;
    numSessions?: number;
    sessionGrowth?: number;
    newSessionsThisMonth?: number;
    ratingGrowth?: number;
    [key: string]: any; // Allow for additional properties
  }

  const [userData, setUserData] = useState<UserData | null>(null);

  /**
   * Formats a given date into a "time ago" string (e.g., "2 hours ago", "3 days ago").
   * @param {Date} date - The date to format.
   * @returns {string} The formatted "time ago" string.
   */
  const formatTimeAgo = (date: Date): string => {
    if (!date) return "Recently";

    const now = new Date();
    const dateObj = date instanceof Date ? date : new Date(date);
    const seconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) {
      return interval === 1 ? "1 year ago" : `${interval} years ago`;
    }

    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) {
      return interval === 1 ? "1 month ago" : `${interval} months ago`;
    }

    interval = Math.floor(seconds / 86400);
    if (interval >= 1) {
      return interval === 1 ? "1 day ago" : `${interval} days ago`;
    }

    interval = Math.floor(seconds / 3600);
    if (interval >= 1) {
      return interval === 1 ? "1 hour ago" : `${interval} hours ago`;
    }

    interval = Math.floor(seconds / 60);
    if (interval >= 1) {
      return interval === 1 ? "1 minute ago" : `${interval} minutes ago`;
    }

    return seconds < 10 ? "just now" : `${Math.floor(seconds)} seconds ago`;
  };

  useEffect(() => {
    const fetchBlueprintsData = async () => {
      if (currentUser) {
        const showWaitingDashboard =
          localStorage.getItem("showWaitingDashboard") === "true";
        if (showWaitingDashboard) {
          localStorage.removeItem("showWaitingDashboard");
          console.log(
            "Dashboard - Redirected from signup flow, enforcing waiting screen view",
          );
        }

        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();

          // Ensure all needed fields exist with defaults
          const updatedUserData = {
            ...userData,
            planType: userData.planType || "free",
            planExpiryDate: userData.planExpiryDate || null,
            planUsage: userData.planUsage || 0,
            activeBlueprintsPercentage:
              userData.activeBlueprintsPercentage || 0,
            totalCustomers: userData.totalCustomers || 0,
            customerGrowth: userData.customerGrowth || 0,
            newCustomersThisMonth: userData.newCustomersThisMonth || 0,
            numSessions: userData.numSessions || 0,
            sessionGrowth: userData.sessionGrowth || 0,
            newSessionsThisMonth: userData.newSessionsThisMonth || 0,
            averageRating: userData.averageRating || 0,
            ratingGrowth: userData.ratingGrowth || 0,
            totalReviews: userData.totalReviews || 0,
            recentActivities: userData.recentActivities || [],
          };

          // If fields were missing, update the document in Firestore
          if (
            Object.keys(updatedUserData).length > Object.keys(userData).length
          ) {
            try {
              await updateDoc(userRef, updatedUserData);
              console.log("Added missing fields to user document");
            } catch (error) {
              console.error(
                "Error updating user document with missing fields:",
                error,
              );
            }
          }

          setUserData(userData);

          // First, check if any blueprints have scanCompleted = true
          let hasCompletedBlueprint = false;
          const createdBlueprintIDs = userData.createdBlueprintIDs || [];

          // Only check Firestore if we don't already have localStorage confirmation
          const scanCompletedFromLocalStorage =
            localStorage.getItem("scanCompleted") === "true";

          if (
            !scanCompletedFromLocalStorage &&
            createdBlueprintIDs.length > 0
          ) {
            // Check Firestore for completed blueprints
            for (const blueprintID of createdBlueprintIDs) {
              const blueprintRef = doc(db, "blueprints", blueprintID);
              const blueprintSnap = await getDoc(blueprintRef);

              if (
                blueprintSnap.exists() &&
                blueprintSnap.data().scanCompleted === true
              ) {
                // Found a completed blueprint, set localStorage for future reference
                hasCompletedBlueprint = true;
                localStorage.setItem("scanCompleted", "true");

                // Flag this as a new scan completion to trigger onboarding
                localStorage.setItem("newScanCompletion", "true");
                break;
              }
            }
          }

          // Check if user should see the waiting screen
          console.log("Dashboard - checking waiting screen conditions:", {
            hasMapping: Boolean(
              userData.mappingScheduleDate && userData.mappingScheduleTime,
            ),
            finishedOnboarding: userData.finishedOnboarding,
            scanCompletedFromLocalStorage,
            hasCompletedBlueprint,
            createdBlueprintIDs: userData.createdBlueprintIDs || [],
          });

          // Handle date format properly regardless of how it's stored
          let scheduleDate = null;
          if (userData.mappingScheduleDate) {
            try {
              scheduleDate =
                userData.mappingScheduleDate instanceof Date
                  ? userData.mappingScheduleDate
                  : userData.mappingScheduleDate.toDate
                    ? userData.mappingScheduleDate.toDate()
                    : new Date(userData.mappingScheduleDate);
            } catch (e) {
              console.error("Error parsing mapping date:", e);
            }
          }

          if (
            scheduleDate &&
            userData.mappingScheduleTime &&
            userData.finishedOnboarding !== true &&
            !scanCompletedFromLocalStorage &&
            !hasCompletedBlueprint
          ) {
            // Show waiting screen
            console.log("Dashboard - showing waiting screen");
            setIsWaitingForMapping(true);
            setMappingDate(scheduleDate);
            setMappingTime(userData.mappingScheduleTime);
          } else {
            console.log(
              "Dashboard - not showing waiting screen, showing regular dashboard",
            );
            setIsWaitingForMapping(false);

            // Check if this is a new scan completion
            const isNewScanCompletion =
              localStorage.getItem("newScanCompletion") === "true";
            if (isNewScanCompletion && !userData.finishedOnboarding) {
              // Remove the flag so we don't trigger again
              localStorage.removeItem("newScanCompletion");

              // Important: Add a small delay to ensure the dashboard renders first
              setTimeout(() => {
                console.log(
                  "Triggering dashboard onboarding after scan completion",
                );
                startOnboarding();
              }, 1000);
            }
          }

          setTotalBlueprints(createdBlueprintIDs.length);

          const oneMonthAgo = new Date();
          oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          let createdWithinLastMonth = 0;

          // Process blueprints in parallel for better performance
          const blueprintsPromises = createdBlueprintIDs.map(
            async (blueprintID) => {
              try {
                const blueprintRef = doc(db, "blueprints", blueprintID);
                const blueprintSnap = await getDoc(blueprintRef);

                if (blueprintSnap.exists()) {
                  const blueprintData = blueprintSnap.data();

                  // Check if blueprint's createdDate is within last month
                  if (blueprintData.createdDate) {
                    const createdDate = blueprintData.createdDate.toDate
                      ? blueprintData.createdDate.toDate()
                      : new Date(blueprintData.createdDate);

                    if (createdDate >= oneMonthAgo) {
                      createdWithinLastMonth++;
                    }
                  }

                  // --- Caching Logic ---
                  let imageUrl: string | null = null;
                  const fallbackImage = `/images/${blueprintData.locationType?.toLowerCase() || "retail"}.jpeg`;
                  let needsFirestoreUpdate = false; // Flag to update Firestore later

                  // 1. Check if a cached URL exists in Firestore
                  if (blueprintData.streetViewImageUrl) {
                    console.log(
                      `Using cached Street View URL for ${blueprintID}`,
                    );
                    imageUrl = blueprintData.streetViewImageUrl;
                  }
                  // 2. If no cached URL and address exists, try fetching a new one
                  else if (blueprintData.address) {
                    console.log(
                      `No cached URL for ${blueprintID}, attempting fetch.`,
                    );
                    try {
                      const newImageUrl = await getLocationImageUrl(
                        blueprintData.address,
                        blueprintData.businessName,
                      );

                      if (newImageUrl) {
                        imageUrl = newImageUrl;
                        // Mark this blueprint for Firestore update *after* the loop
                        needsFirestoreUpdate = true;
                        console.log(
                          `Fetched new Street View URL for ${blueprintID}`,
                        );
                      } else {
                        // API call failed or returned null, use fallback for this session
                        console.log(
                          `Failed to fetch new Street View URL for ${blueprintID}, using fallback.`,
                        );
                        imageUrl = fallbackImage;
                      }
                    } catch (error) {
                      console.error(
                        `Error fetching image for ${blueprintData.businessName || blueprintData.address}:`,
                        error,
                      );
                      // Error during fetch, use fallback for this session
                      imageUrl = fallbackImage;
                    }
                  }
                  // 3. If no address, use fallback
                  else {
                    imageUrl = fallbackImage;
                  }
                  // --- End Caching Logic ---

                  // Add random engagement metrics for demo purposes
                  const randomEngagement =
                    Math.floor(Math.random() * 1000) + 500;
                  const randomGrowth = (Math.random() * 30 - 10).toFixed(1);
                  const randomHours = Math.floor(Math.random() * 400) + 100;

                  // Format the last updated date
                  const lastUpdated = blueprintData.updatedAt
                    ? blueprintData.updatedAt.toDate
                      ? blueprintData.updatedAt.toDate().toLocaleDateString()
                      : new Date(blueprintData.updatedAt).toLocaleDateString()
                    : blueprintData.createdDate
                      ? blueprintData.createdDate.toDate
                        ? blueprintData.createdDate
                            .toDate()
                            .toLocaleDateString()
                        : new Date(
                            blueprintData.createdDate,
                          ).toLocaleDateString()
                      : "N/A";

                  return {
                    id: blueprintID,
                    name:
                      blueprintData.businessName ||
                      blueprintData.address ||
                      "Unnamed Location",
                    type: blueprintData.locationType || "retail",
                    status: blueprintData.status || "Pending",
                    lastUpdated: lastUpdated,
                    hoursOfUse: randomHours,
                    engagement: randomEngagement,
                    growth: randomGrowth,
                    visitors: Math.floor(Math.random() * 400) + 100,
                    address: blueprintData.address || null,
                    image: imageUrl, // Use the determined imageUrl (cached, new, or fallback)
                    fallbackImage: fallbackImage,
                    // --- Include the flag for potential update ---
                    _needsStreetViewUpdate: needsFirestoreUpdate
                      ? imageUrl
                      : null, // Store the URL to update if needed
                  };
                } else {
                  console.error(`Blueprint with ID ${blueprintID} not found.`);
                  return null;
                }
              } catch (error) {
                console.error(
                  `Error processing blueprint ${blueprintID}:`,
                  error,
                );
                return null;
              }
            },
          );

          // Wait for all blueprint processing to complete
          const blueprintsResults = await Promise.all(blueprintsPromises);
          const blueprintsData = blueprintsResults.filter(Boolean); // Remove any nulls

          setBlueprints(blueprintsData);
          setBlueprintsLastMonth(createdWithinLastMonth);
          setActiveBlueprintsPercentage(Math.floor(Math.random() * 30) + 60);

          // --- Perform Firestore Updates Asynchronously After Setting State ---
          // This prevents blocking the UI rendering
          const updatePromises = blueprintsData
            .filter((bp) => bp._needsStreetViewUpdate) // Filter blueprints that need update
            .map((bp) => {
              console.log(
                `Updating Firestore for ${bp.id} with new Street View URL.`,
              );
              const blueprintRef = doc(db, "blueprints", bp.id);
              return updateDoc(blueprintRef, {
                streetViewImageUrl: bp._needsStreetViewUpdate, // Use the stored URL
              }).catch((err) => {
                // Log error but don't block other updates
                console.error(`Failed to update Firestore for ${bp.id}:`, err);
              });
            });
        } else {
          console.error("No such user document!");
          setTotalBlueprints(0);
          setBlueprints([]);
          setIsWaitingForMapping(false);
        }

        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    };

    fetchBlueprintsData();
    run();
  }, [currentUser]);

  /**
   * Constructs a Google Street View Static API URL for a given address and business name.
   * @param {string} address - The address of the location.
   * @param {string} businessName - The name of the business.
   * @returns {Promise<string | null>} A promise that resolves with the Street View image URL or null if an error occurs or no address is provided.
   */
  const getLocationImageUrl = async (address, businessName) => {
    // Ensure you have an address to work with
    if (!address) {
      console.log("No address provided for image lookup.");
      return null;
    }

    // --- IMPORTANT: Replace this with secure loading of your API key ---
    // Example using environment variables in Next.js:
    const GOOGLE_MAPS_API_KEY = "AIzaSyCV9o30LkToSWZwoyz_65iQ3WOOMaCHeEI";
    // --- Make sure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set in your .env.local file ---

    if (!GOOGLE_MAPS_API_KEY) {
      console.error(
        "Google Maps API Key is not configured. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.",
      );
      return null; // Cannot fetch image without API key
    }

    // Construct the Google Street View Static API URL
    // You can adjust size, fov (field of view), heading, pitch as needed
    // Using the address directly often works well for Street View.
    // Adding the business name might sometimes help, but address is primary.
    const encodedAddress = encodeURIComponent(address);
    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${encodedAddress}&fov=80&heading=0&pitch=0&key=${GOOGLE_MAPS_API_KEY}`;

    // We don't need to 'fetch' this URL here in the backend/server-side logic.
    // We just need to return the constructed URL string.
    // The <img> tag in the BlueprintImage component will handle the actual fetching.
    // We can add a check to see if an image exists at the location, but it adds complexity (requires Places API).
    // For simplicity, we'll return the URL and let the <img> tag's onError handle cases where Street View isn't available.
    console.log(`Constructed Street View URL for ${address}: ${streetViewUrl}`);
    return streetViewUrl;
  };

  // Modified blueprint initialization to use the new image fetching logic
  /**
   * Initializes a blueprint object with data, including fetching a location image URL.
   * @param {any} blueprintData - The raw blueprint data.
   * @returns {Promise<object>} A promise that resolves with the initialized blueprint object.
   */
  const initializeBlueprint = async (blueprintData) => {
    // Get image URL with fallbacks
    let imageUrl: string | null = null;

    try {
      imageUrl = await getLocationImageUrl(
        blueprintData.address,
        blueprintData.businessName,
      );
    } catch (e) {
      console.error("Error getting location image:", e);
    }

    // Fallback to type-based generic image if needed
    const fallbackImage = `/images/${blueprintData.locationType?.toLowerCase() || "retail"}.jpeg`;

    // Format the last updated date
    const lastUpdated = formatDate(
      blueprintData.updatedAt || blueprintData.createdDate,
    );

    return {
      id: blueprintData.id,
      name:
        blueprintData.businessName ||
        blueprintData.address ||
        "Unnamed Location",
      type: blueprintData.locationType || "retail",
      status: blueprintData.status || "Pending",
      lastUpdated: lastUpdated,
      hoursOfUse: blueprintData.hoursOfUse || 0,
      engagement: blueprintData.engagement || 0,
      growth: blueprintData.growth ? blueprintData.growth.toFixed(1) : "0.0",
      visitors: blueprintData.visitors || 0,
      address: blueprintData.address || null,
      // Use the fetched image URL or fall back to the default image
      image: imageUrl || fallbackImage,
      fallbackImage: fallbackImage,
    };
  };

  /**
   * Formats a date field (which can be a Firestore Timestamp or a string) into a localized date string.
   * @param {any} dateField - The date field to format.
   * @returns {string} The formatted date string or "N/A" if formatting fails.
   */
  const formatDate = (dateField) => {
    if (!dateField) return "N/A";

    try {
      // Handle Firestore timestamps or string dates
      const date = dateField.toDate ? dateField.toDate() : new Date(dateField);
      return date.toLocaleDateString();
    } catch (e) {
      console.error("Error formatting date:", e);
      return "N/A";
    }
  };

  // Use this component for blueprint cards to handle async image loading with fallbacks

  // Generate data for the chart
  // Generate data for the chart based on user data or defaults
  interface ChartDataItem {
    month: string;
    visitors: number;
    engagement: number;
  }
  
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);

  useEffect(() => {
    const generateRealChartData = async () => {
      // Default months
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
      ];

      if (currentUser) {
        try {
          const userRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();

            // Check if user has saved usage history
            if (userData.usageHistory && userData.usageHistory.length > 0) {
              // Use real usage history
              setChartData(userData.usageHistory);
              return;
            }
          }
        } catch (error) {
          console.error("Error fetching chart data:", error);
        }
      }

      // Fallback to empty data
      const emptyData = months.map((month) => ({
        month,
        visitors: 0,
        engagement: 0,
      }));
      setChartData(emptyData);
    };

    generateRealChartData();
  }, [currentUser]);

  /**
   * A component that displays a countdown timer to a specific target date and time.
   * @param {object} props - The component's props.
   * @param {Date} props.targetDate - The target date for the countdown.
   * @param {string} props.targetTime - The target time for the countdown (format: "HH:MM").
   * @param {Function} props.onTimerEnd - Callback function to execute when the timer ends.
   * @returns {JSX.Element} The rendered CountdownTimer component.
   */
  const CountdownTimer = ({ targetDate, targetTime, onTimerEnd }) => {
    const [timeRemaining, setTimeRemaining] = useState({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });

    useEffect(() => {
      if (!targetDate || !targetTime) return;

      // Parse the target time (format: "HH:MM")
      const [hours, minutes] = targetTime.split(":").map(Number);

      // Create a new date object for the target date
      const targetDateTime = new Date(targetDate);
      targetDateTime.setHours(hours, minutes, 0, 0);

      const calculateTimeRemaining = () => {
        const now = new Date();
        const difference = targetDateTime.getTime() - now.getTime();

        // If the date has passed, don't show negative numbers
        if (difference <= 0) {
          setTimeRemaining({
            days: 0,
            hours: 0,
            minutes: 0,
            seconds: 0,
          });
          // Call the callback function when timer reaches zero
          if (onTimerEnd) onTimerEnd();
          // But don't automatically remove the waiting screen -
          // we need the scanner to complete the process
          return;
        }

        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);

        setTimeRemaining({ days, hours, minutes, seconds });
      };

      // Initial calculation
      calculateTimeRemaining();

      // Update the countdown timer every second
      const interval = setInterval(calculateTimeRemaining, 1000);

      // Clear the interval on cleanup
      return () => clearInterval(interval);
    }, [targetDate, targetTime, onTimerEnd]);

    // Helper function to format time with leading zeros
    const formatTime = (time) => {
      return time.toString().padStart(2, "0");
    };

    const formatDate = (date) => {
      if (!date) return "";
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    const formatTimeDisplay = (timeString) => {
      if (!timeString) return "";
      const [hours, minutes] = timeString.split(":");
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? "PM" : "AM";
      const formattedHour = hour % 12 || 12;
      return `${formattedHour}:${minutes} ${ampm}`;
    };

    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="flex flex-col items-center justify-center mb-8">
          <h2 className="text-2xl font-medium text-gray-700 mb-2">
            Your 3D mapping session is scheduled for
          </h2>
          <h3 className="text-xl text-gray-600 mb-6">
            {formatDate(targetDate)} at {formatTimeDisplay(targetTime)}
          </h3>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Days", value: timeRemaining.days },
            { label: "Hours", value: timeRemaining.hours },
            { label: "Minutes", value: timeRemaining.minutes },
            { label: "Seconds", value: timeRemaining.seconds },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg transform transition-all duration-500 hover:scale-105">
                  <span className="text-4xl font-bold text-white">
                    {formatTime(item.value)}
                  </span>
                </div>
                <div className="absolute -right-2 -top-2 w-5 h-5 rounded-full bg-blue-200 animate-ping"></div>
              </div>
              <span className="mt-2 text-gray-600 font-medium">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /**
   * A component displayed when the user is waiting for their 3D mapping session to be completed.
   * It shows a countdown timer and information about the mapping process.
   * Allows the user to manually check if the mapping is complete.
   *
   * @param {object} props - The component's props.
   * @param {Date} props.mappingDate - The scheduled date for the mapping session.
   * @param {string} props.mappingTime - The scheduled time for the mapping session.
   * @returns {JSX.Element} The rendered WaitingForMappingDashboard component.
   */
  const WaitingForMappingDashboard = ({ mappingDate, mappingTime }) => {
    const [timerEnded, setTimerEnded] = useState(false);
    const [checkingCompletion, setCheckingCompletion] = useState(false);
    const [mapperName] = useState("Nijel"); // Default mapper name
    const { currentUser } = useAuth();
    const { toast } = useToast();

    // FAQs from Help page (simplified version)
    const faqs = [
      {
        question: "What happens during the 3D mapping session?",
        answer:
          "Our specialist will use advanced scanning technology to create a detailed 3D model of your space, typically taking 30-60 minutes depending on the size.",
      },
      {
        question: "How long does it take to get my Blueprint after scanning?",
        answer:
          "Processing typically takes 1-2 hours after your mapping session. You'll receive an email notification when your Blueprint is ready.",
      },
    ];

    const handleTimerEnd = () => {
      setTimerEnded(true);
    };

    const checkMappingCompletion = async () => {
      if (!currentUser) return;

      setCheckingCompletion(true);
      try {
        // Get user document to find blueprintIDs
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          const blueprintIDs = userData.createdBlueprintIDs || [];

          console.log("Checking completion for user:", currentUser.uid);
          console.log("Blueprint IDs to check:", blueprintIDs);

          // Check if any blueprint has scanCompleted = true
          for (const blueprintID of blueprintIDs) {
            const blueprintRef = doc(db, "blueprints", blueprintID);
            const blueprintSnap = await getDoc(blueprintRef);

            if (blueprintSnap.exists()) {
              const blueprintData = blueprintSnap.data();
              console.log(
                `Blueprint ${blueprintID} scanCompleted:`,
                blueprintData.scanCompleted,
              );

              if (blueprintData.scanCompleted === true) {
                // Found a completed scan - show success message and redirect to dashboard
                toast({
                  title: "Blueprint Ready!",
                  description:
                    "Your 3D mapping has been completed. Redirecting to dashboard...",
                  variant: "default",
                });

                // Store scan completion status in localStorage so we can show the regular dashboard
                localStorage.setItem("scanCompleted", "true");

                // Short delay to show the success message before refreshing
                setTimeout(() => {
                  // Set flag to trigger onboarding on reload
                  localStorage.setItem("newScanCompletion", "true");
                  window.location.reload();
                }, 1500);

                return;
              }
            }
          }

          // If we get here, no completed scans were found
          toast({
            title: "Scan not yet completed",
            description:
              "The 3D mapping hasn't been processed yet. Please check back later.",
            variant: "default",
          });
        }
      } catch (error) {
        console.error("Error checking mapping completion:", error);
        toast({
          title: "Error",
          description: "Could not check mapping status. Please try again.",
          variant: "destructive",
        });
      } finally {
        setCheckingCompletion(false);
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="w-full py-8"
      >
        {!timerEnded ? (
          // Original countdown UI
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-none shadow-xl overflow-hidden">
            <CardHeader className="pb-2">
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                <CardTitle className="text-center text-3xl font-bold text-blue-800">
                  Welcome to Blueprint!
                </CardTitle>
                <CardDescription className="text-center text-gray-600 text-lg mt-2">
                  We're excited to begin your 3D mapping journey
                </CardDescription>
              </motion.div>
            </CardHeader>

            <CardContent className="pt-6">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="bg-white rounded-xl p-8 shadow-md mb-8"
              >
                <CountdownTimer
                  targetDate={mappingDate}
                  targetTime={mappingTime}
                  onTimerEnd={handleTimerEnd}
                />
              </motion.div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.5 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-white border-none shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                        <Calendar className="w-6 h-6 text-blue-600" />
                      </div>
                      <CardTitle className="text-lg">
                        Before Your Session
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-gray-600">
                        <li className="flex items-start">
                          <div className="mr-2 mt-1 text-green-500">✓</div>
                          <span>Clear walkways for easy access</span>
                        </li>
                        <li className="flex items-start">
                          <div className="mr-2 mt-1 text-green-500">✓</div>
                          <span>Ensure good lighting conditions</span>
                        </li>
                        <li className="flex items-start">
                          <div className="mr-2 mt-1 text-green-500">✓</div>
                          <span>Tidy up the space being mapped</span>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-none shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-4">
                        <Users className="w-6 h-6 text-purple-600" />
                      </div>
                      <CardTitle className="text-lg">
                        During Your Session
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-gray-600">
                        <li className="flex items-start">
                          <div className="mr-2 mt-1 text-green-500">✓</div>
                          <span>
                            Our specialist will guide you through the process
                          </span>
                        </li>
                        <li className="flex items-start">
                          <div className="mr-2 mt-1 text-green-500">✓</div>
                          <span>Session typically takes 30-60 minutes</span>
                        </li>
                        <li className="flex items-start">
                          <div className="mr-2 mt-1 text-green-500">✓</div>
                          <span>Be available to answer any questions</span>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-none shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
                        <Building2 className="w-6 h-6 text-green-600" />
                      </div>
                      <CardTitle className="text-lg">
                        After Your Session
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-gray-600">
                        <li className="flex items-start">
                          <div className="mr-2 mt-1 text-green-500">✓</div>
                          <span>
                            Processing takes approximately 1-2 hours
                          </span>
                        </li>
                        <li className="flex items-start">
                          <div className="mr-2 mt-1 text-green-500">✓</div>
                          <span>
                            You'll receive an email when your Blueprint is ready
                          </span>
                        </li>
                        <li className="flex items-start">
                          <div className="mr-2 mt-1 text-green-500">✓</div>
                          <span>Access your 3D space from this dashboard</span>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex justify-center mt-8">
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1"
                    onClick={() => (window.location.href = "/help")}
                  >
                    Need to reschedule? Contact support
                  </Button>
                </div>
              </motion.div>
            </CardContent>
          </Card>
        ) : (
          // New UI when timer has ended
          <Card className="bg-white border-none shadow-xl overflow-hidden">
            <CardContent className="p-8 md:p-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center max-w-3xl mx-auto mb-10"
              >
                <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-6">
                  <User className="w-10 h-10 text-indigo-600" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  Your mapper should be with you soon
                </h1>
                <p className="text-xl text-gray-600">
                  {mapperName} will be arriving shortly to scan your location
                </p>

                <div className="mt-8">
                  <Button
                    size="lg"
                    onClick={checkMappingCompletion}
                    disabled={checkingCompletion}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all"
                  >
                    {checkingCompletion ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <RefreshCcw className="mr-2 h-5 w-5" />
                        Refresh After Mapping
                      </>
                    )}
                  </Button>
                  <p className="text-sm text-gray-500 mt-3">
                    Click this button after your mapping session is complete
                  </p>
                </div>
              </motion.div>

              {/* FAQ Section */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mt-12 bg-gray-50 rounded-xl p-6"
              >
                <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                  <HelpCircle className="w-5 h-5 mr-2 text-indigo-500" />
                  Frequently Asked Questions
                </h2>

                <div className="space-y-4">
                  {faqs.map((faq, index) => (
                    <div
                      key={index}
                      className="bg-white rounded-lg p-4 shadow-sm"
                    >
                      <h3 className="font-medium text-gray-900 mb-2">
                        {faq.question}
                      </h3>
                      <p className="text-gray-600 text-sm">{faq.answer}</p>
                    </div>
                  ))}

                  <div className="mt-4 text-center">
                    <Button
                      variant="outline"
                      onClick={() => (window.location.href = "/help")}
                      className="border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                    >
                      View All FAQs
                    </Button>
                  </div>
                </div>
              </motion.div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    );
  };

  // If user is waiting for mapping session, we'd show the WaitingForMappingDashboard component
  // But we're focusing on the main dashboard here

  return (
    <LiveAPIProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50/20">
        <Nav />

        {isLoading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 relative">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-200 opacity-25"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-indigo-600 animate-spin"></div>
              </div>
              <p className="mt-4 text-gray-600 font-medium">
                Loading your dashboard...
              </p>
            </div>
          </div>
        ) : isWaitingForMapping ? (
          <div className="pt-24 px-6 pb-12">
            <WaitingForMappingDashboard
              mappingDate={mappingDate}
              mappingTime={mappingTime}
            />
          </div>
        ) : (
          <div className="pt-20 pb-12">
            {/* Dashboard Header */}
            <div className="bg-gradient-to-r from-gray-50 to-indigo-50/30">
              <div className="max-w-full px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center py-4">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      Dashboard
                    </h1>
                    <p className="text-gray-500">Welcome back to Blueprint</p>
                  </div>

                  <div className="flex items-center space-x-4">
                    <Link href="/create-blueprint">
                      <Button
                        className="hidden md:flex items-center text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 shadow-md hover:shadow-indigo-200/50 transition-all"
                        ref={createBlueprintRef}
                      >
                        <Plus className="mr-2 h-4 w-4" /> Create Blueprint
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Dashboard Content */}
            <div className="max-w-full px-4 sm:px-6 lg:px-16 pt-8">
              <div className="flex flex-col md:flex-row gap-8">
                {/* Left Sidebar */}
                <div className="md:w-72 flex-shrink-0 md:pl-0">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden sticky top-24">
                    <div className="p-4">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
                        Main Menu
                      </p>
                      <nav className="space-y-1">
                        <button
                          className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                            activeTab === "overview"
                              ? "bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-700"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                          onClick={() => setActiveTab("overview")}
                          ref={overviewTabRef}
                        >
                          <Home
                            className={`mr-3 h-5 w-5 ${activeTab === "overview" ? "text-indigo-600" : "text-gray-400"}`}
                          />
                          Overview
                          {activeTab === "overview" && (
                            <div className="ml-auto w-1.5 h-5 rounded-full bg-indigo-500" />
                          )}
                        </button>

                        <button
                          className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                            activeTab === "blueprints"
                              ? "bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-700"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                          onClick={() => setActiveTab("blueprints")}
                          ref={blueprintsTabRef}
                        >
                          <Building2
                            className={`mr-3 h-5 w-5 ${activeTab === "blueprints" ? "text-indigo-600" : "text-gray-400"}`}
                          />
                          My Blueprints
                          {activeTab === "blueprints" && (
                            <div className="ml-auto w-1.5 h-5 rounded-full bg-indigo-500" />
                          )}
                        </button>

                        <button
                          className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                            activeTab === "analytics"
                              ? "bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-700"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                          onClick={() => setActiveTab("analytics")}
                        >
                          <BarChart
                            className={`mr-3 h-5 w-5 ${activeTab === "analytics" ? "text-indigo-600" : "text-gray-400"}`}
                          />
                          Analytics
                          {activeTab === "analytics" && (
                            <div className="ml-auto w-1.5 h-5 rounded-full bg-indigo-500" />
                          )}
                        </button>
                      </nav>
                    </div>

                    <div className="border-t border-gray-100 p-4">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
                        Workspace
                      </p>
                      <nav className="space-y-1">
                        <Link href="/team-members">
                          <div className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer">
                            <Users className="mr-3 h-5 w-5 text-gray-400" />
                            Team Members
                          </div>
                        </Link>
                        <Link href="/settings">
                          <div className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer">
                            <Settings className="mr-3 h-5 w-5 text-gray-400" />
                            Settings
                          </div>
                        </Link>
                      </nav>
                    </div>

                    {/* Subscription Status */}
                    <div className="border-t border-gray-100 p-4">
                      {userData?.planType === "pro" ? (
                        <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg p-4 text-white">
                          <h3 className="font-semibold">Pro Subscription</h3>
                          <p className="text-xs text-indigo-100 mt-1 mb-3">
                            Valid until{" "}
                            {userData?.planExpiryDate
                              ? ('toDate' in userData.planExpiryDate)
                                ? new Date(
                                    userData.planExpiryDate.toDate()
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : new Date(userData.planExpiryDate).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                              : "N/A"}
                          </p>
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-medium">
                              Usage: {userData?.planUsage || "0"}%
                            </span>
                            <span className="text-xs">
                              {userData?.activeBlueprintsPercentage || "0"}%
                              active
                            </span>
                          </div>
                          <div className="w-full bg-white/20 rounded-full h-1.5 mt-1 mb-3">
                            <div
                              className="bg-white rounded-full h-1.5"
                              style={{
                                width: `${userData?.activeBlueprintsPercentage || 0}%`,
                              }}
                            ></div>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full bg-white/10 hover:bg-white/20 text-white border-0"
                            onClick={() =>
                              (window.location.href = "/manage-plan")
                            }
                          >
                            Manage Plan
                          </Button>
                        </div>
                      ) : (
                        <div className="bg-gradient-to-br from-blue-400 to-blue-500 rounded-lg p-4 text-white">
                          <h3 className="font-semibold">Free Tier</h3>
                          <p className="text-xs text-blue-100 mt-1 mb-3">
                            Unlock more features with Pro
                          </p>
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-medium">
                              {totalBlueprints} / 3 Blueprints
                            </span>
                            <span className="text-xs">Limited features</span>
                          </div>
                          <div className="w-full bg-white/20 rounded-full h-1.5 mt-1 mb-3">
                            <div
                              className="bg-white rounded-full h-1.5"
                              style={{
                                width: `${Math.min((totalBlueprints / 3) * 100, 100)}%`,
                              }}
                            ></div>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full bg-white/10 hover:bg-white/20 text-white border-0"
                            onClick={() => (window.location.href = "/pricing")}
                          >
                            Upgrade to Plus
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 max-w-6xl">
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-6"
                  >
                    {/* Mobile Create Button */}
                    <div className="md:hidden flex justify-center mb-4">
                      <Link href="/create-blueprint">
                        <Button className="w-full flex items-center justify-center text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 shadow-md">
                          <Plus className="mr-2 h-4 w-4" /> Create Blueprint
                        </Button>
                      </Link>
                    </div>

                    {/* Overview Tab Content */}
                    {activeTab === "overview" && (
                      <>
                        {/* Stats Cards */}
                        {/* Stats Cards */}
                        <motion.div
                          variants={itemVariants}
                          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
                        >
                          <Card
                            className="border-0 shadow-md hover:shadow-lg transition-all overflow-hidden"
                            ref={statsCardRef}
                          >
                            <CardHeader className="pb-2 relative">
                              <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-full bg-indigo-50 flex items-end justify-end">
                                <Building2 className="mb-2 mr-2 h-6 w-6 text-indigo-400" />
                              </div>
                              <CardTitle className="text-sm font-medium text-gray-500">
                                Total Blueprints
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-baseline">
                                <div className="text-3xl font-bold text-gray-900">
                                  {totalBlueprints}
                                </div>
                                {blueprintsLastMonth > 0 && (
                                  <div className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-800">
                                    +{blueprintsLastMonth} new
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                {blueprintsLastMonth > 0
                                  ? `Added ${blueprintsLastMonth} blueprint${blueprintsLastMonth > 1 ? "s" : ""} this month`
                                  : "No new blueprints this month"}
                              </p>
                            </CardContent>
                          </Card>

                          <Card className="border-0 shadow-md hover:shadow-lg transition-all overflow-hidden">
                            <CardHeader className="pb-2 relative">
                              <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-full bg-blue-50 flex items-end justify-end">
                                <Users className="mb-2 mr-2 h-6 w-6 text-blue-400" />
                              </div>
                              <CardTitle className="text-sm font-medium text-gray-500">
                                Total Customers
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-baseline">
                                <div className="text-3xl font-bold text-gray-900">
                                  {userData?.totalCustomers || 0}
                                </div>
                                {userData?.customerGrowth && userData.customerGrowth > 0 && (
                                  <div className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-800">
                                    +{userData.customerGrowth}%
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                {userData?.newCustomersThisMonth
                                  ? `${userData.newCustomersThisMonth} new customers this month`
                                  : "No new customers this month"}
                              </p>
                            </CardContent>
                          </Card>

                          <Card className="border-0 shadow-md hover:shadow-lg transition-all overflow-hidden">
                            <CardHeader className="pb-2 relative">
                              <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-full bg-purple-50 flex items-end justify-end">
                                <ShoppingBag className="mb-2 mr-2 h-6 w-6 text-purple-400" />
                              </div>
                              <CardTitle className="text-sm font-medium text-gray-500">
                                Total Sessions
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-baseline">
                                <div className="text-3xl font-bold text-gray-900">
                                  {userData?.numSessions || 0}
                                </div>
                                {userData?.sessionGrowth && userData.sessionGrowth > 0 && (
                                  <div className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-800">
                                    +{userData.sessionGrowth}%
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                {userData?.newSessionsThisMonth
                                  ? `${userData.newSessionsThisMonth} more sessions than last month`
                                  : "No new sessions this month"}
                              </p>
                            </CardContent>
                          </Card>

                          <Card className="border-0 shadow-md hover:shadow-lg transition-all overflow-hidden">
                            <CardHeader className="pb-2 relative">
                              <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-full bg-amber-50 flex items-end justify-end">
                                <Star className="mb-2 mr-2 h-6 w-6 text-amber-400" />
                              </div>
                              <CardTitle className="text-sm font-medium text-gray-500">
                                Average Rating
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-baseline">
                                <div className="text-3xl font-bold text-gray-900">
                                  {userData?.averageRating?.toFixed(1) || "N/A"}
                                </div>
                                {userData?.ratingGrowth !== undefined && userData.ratingGrowth > 0 && (
                                  <div className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-800">
                                    +{userData.ratingGrowth.toFixed(1)}
                                  </div>
                                )}
                              </div>
                              {userData?.averageRating && (
                                <div className="flex items-center mt-2">
                                  {[1, 2, 3, 4, 5].map((rating) => (
                                    <Star
                                      key={rating}
                                      className={`h-3 w-3 ${
                                        rating <=
                                        Math.round(userData.averageRating || 0)
                                          ? "text-amber-400 fill-amber-400"
                                          : "text-gray-300"
                                      }`}
                                    />
                                  ))}
                                  <span className="text-xs text-gray-500 ml-2">
                                    {userData.totalReviews
                                      ? `from ${userData.totalReviews} reviews`
                                      : "No reviews yet"}
                                  </span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </motion.div>

                        {/* Top Performing Blueprints */}
                        <motion.div variants={itemVariants}>
                          <Card className="border-0 shadow-md overflow-hidden">
                            <CardHeader className="pb-3">
                              <div className="flex justify-between items-center">
                                <div>
                                  <CardTitle className="text-xl font-bold text-gray-800">
                                    Top Performing Blueprints
                                  </CardTitle>
                                  <CardDescription className="text-sm text-gray-500">
                                    Your best performing blueprints by
                                    engagement
                                  </CardDescription>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-gray-500">
                                    Sort by:
                                  </span>
                                  <select className="text-xs border-0 bg-gray-50 rounded-md p-1 focus:ring-0">
                                    <option>Engagement</option>
                                    <option>Views</option>
                                    <option>Growth</option>
                                  </select>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="p-0">
                              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                                {blueprints
                                  .slice(0, 3)
                                  .map((blueprint, index) => (
                                    <div
                                      key={blueprint.id}
                                      className="p-4 flex flex-col"
                                    >
                                      <div className="relative h-40 rounded-lg overflow-hidden mb-3">
                                        <BlueprintImage blueprint={blueprint} />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                        <div className="absolute bottom-0 left-0 right-0 p-3">
                                          <div className="flex items-center justify-between">
                                            <h3 className="font-medium text-white truncate">
                                              {blueprint.name}
                                            </h3>
                                            <Badge
                                              className={`
                                                  ${
                                                    blueprint.status ===
                                                    "Active"
                                                      ? "bg-green-100 text-green-800 hover:bg-green-100"
                                                      : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                                                  }
                                                `}
                                            >
                                              {blueprint.status}
                                            </Badge>
                                          </div>
                                          <p className="text-xs text-gray-200">
                                            {blueprint.type}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex justify-between items-baseline mb-2">
                                        <div className="text-sm font-medium text-gray-900">
                                          Visitors
                                        </div>
                                        <div className="text-sm text-gray-700">
                                          {blueprint.visitors}
                                        </div>
                                      </div>
                                      <div className="flex justify-between items-baseline mb-2">
                                        <div className="text-sm font-medium text-gray-900">
                                          Engagement
                                        </div>
                                        <div className="text-sm text-gray-700">
                                          {blueprint.engagement}
                                        </div>
                                      </div>
                                      <div className="flex justify-between items-baseline mb-2">
                                        <div className="text-sm font-medium text-gray-900">
                                          Growth
                                        </div>
                                        <div
                                          className={`text-sm font-medium ${
                                            Number(blueprint.growth) > 0
                                              ? "text-green-600"
                                              : "text-red-600"
                                          }`}
                                        >
                                          {Number(blueprint.growth) > 0
                                            ? "+"
                                            : ""}
                                          {blueprint.growth}%
                                        </div>
                                      </div>
                                      <div className="mt-auto pt-3">
                                        <Link
                                          href={`/blueprint-editor/${blueprint.id}`}
                                        >
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                                          >
                                            View Details
                                          </Button>
                                        </Link>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>

                        {/* Recent Activity */}
                        <motion.div variants={itemVariants}>
                          <Card className="border-0 shadow-md">
                            <CardHeader>
                              <div className="flex justify-between items-center">
                                <div>
                                  <CardTitle className="text-xl font-bold text-gray-800">
                                    Recent Activity
                                  </CardTitle>
                                  <CardDescription className="text-sm text-gray-500">
                                    Your latest Blueprint interactions and
                                    updates
                                  </CardDescription>
                                </div>
                                {Array.isArray(userData?.recentActivities) && userData.recentActivities.length > 0 && (
                                  <Link href="#">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                    >
                                      View All{" "}
                                      <ChevronRight className="w-4 h-4 ml-1" />
                                    </Button>
                                  </Link>
                                )}
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-4">
                                {Array.isArray(userData?.recentActivities) && 
                                userData.recentActivities.length > 0 ? (
                                  userData.recentActivities
                                    .slice(0, 3)
                                    .map((activity, index) => (
                                      <div
                                        key={index}
                                        className="flex items-start"
                                      >
                                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center mr-3 flex-shrink-0">
                                          {activity.type === "customer" ? (
                                            <Users className="h-4 w-4 text-blue-500" />
                                          ) : activity.type === "update" ? (
                                            <Edit className="h-4 w-4 text-indigo-500" />
                                          ) : activity.type === "review" ? (
                                            <Star className="h-4 w-4 text-yellow-500" />
                                          ) : (
                                            <Activity className="h-4 w-4 text-gray-500" />
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex justify-between items-baseline">
                                            <h4 className="text-sm font-medium text-gray-900 truncate">
                                              {activity.event}
                                            </h4>
                                            <span className="text-xs text-gray-500">
                                              {activity.timestamp && 'toDate' in activity.timestamp
                                                ? formatTimeAgo(activity.timestamp.toDate())
                                                : activity.timestamp 
                                                  ? formatTimeAgo(activity.timestamp as Date)
                                                  : activity.time || "Recently"}
                                            </span>
                                          </div>
                                          <p className="text-sm text-gray-500 truncate">
                                            {activity.blueprintName}
                                          </p>
                                        </div>
                                      </div>
                                    ))
                                ) : (
                                  <div className="text-center py-6 text-gray-500">
                                    No recent activity to display
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      </>
                    )}

                    {/* Blueprints Tab Content */}
                    {activeTab === "blueprints" && (
                      <>
                        <motion.div
                          variants={itemVariants}
                          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6"
                        >
                          <Card className="border-0 shadow-md">
                            <CardContent className="p-6">
                              <div className="flex items-start">
                                <div className="rounded-full bg-indigo-100 p-3 mr-4">
                                  <Building2 className="h-6 w-6 text-indigo-600" />
                                </div>
                                <div>
                                  <h3 className="text-lg font-semibold text-gray-900">
                                    {totalBlueprints} Total Blueprints
                                  </h3>
                                  <p className="text-gray-500 text-sm">
                                    {
                                      blueprints.filter(
                                        (b) => b.status === "Active",
                                      ).length
                                    }{" "}
                                    active,{" "}
                                    {
                                      blueprints.filter(
                                        (b) => b.status === "Pending",
                                      ).length
                                    }{" "}
                                    pending
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="border-0 shadow-md">
                            <CardContent className="p-6">
                              <div className="flex justify-between items-center">
                                <div className="w-full">
                                  <h3 className="text-sm font-medium text-gray-500 mb-1">
                                    Storage Usage
                                  </h3>
                                  <div className="flex justify-between items-center text-xs mb-1">
                                    <span className="font-medium text-gray-700">
                                      4.2GB / 10GB
                                    </span>
                                    <span className="text-gray-500">
                                      42% used
                                    </span>
                                  </div>
                                  <Progress
                                    value={42}
                                    className="h-2 bg-gray-100"
                                  />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>

                        <motion.div variants={itemVariants}>
                          <Card className="border-0 shadow-md overflow-hidden">
                            <CardHeader className="border-b border-gray-100 bg-gray-50">
                              <div className="flex flex-col md:flex-row justify-between md:items-center space-y-3 md:space-y-0">
                                <div>
                                  <CardTitle className="text-xl font-bold text-gray-800">
                                    My Blueprints
                                  </CardTitle>
                                  <CardDescription className="text-sm text-gray-500">
                                    Manage and monitor your Blueprint locations
                                  </CardDescription>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                  <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                                    <Input
                                      placeholder="Search blueprints..."
                                      value={searchQuery}
                                      onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                      }
                                      className="pl-9 bg-white text-sm focus-visible:ring-indigo-500"
                                    />
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="bg-white"
                                      >
                                        <Filter className="h-3.5 w-3.5 mr-1" />{" "}
                                        Filter
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      className="w-48"
                                    >
                                      <DropdownMenuLabel>
                                        Status
                                      </DropdownMenuLabel>
                                      <DropdownMenuItem>
                                        Active
                                      </DropdownMenuItem>
                                      <DropdownMenuItem>
                                        Pending
                                      </DropdownMenuItem>
                                      <DropdownMenuItem>Draft</DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuLabel>
                                        Type
                                      </DropdownMenuLabel>
                                      <DropdownMenuItem>
                                        Retail
                                      </DropdownMenuItem>
                                      <DropdownMenuItem>
                                        Restaurant
                                      </DropdownMenuItem>
                                      <DropdownMenuItem>Hotel</DropdownMenuItem>
                                      <DropdownMenuItem>
                                        Museum
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="p-0">
                              <Table>
                                <TableHeader className="bg-gray-50/80">
                                  <TableRow>
                                    <TableHead className="py-3">Name</TableHead>
                                    <TableHead className="py-3">Type</TableHead>
                                    <TableHead className="py-3">
                                      Status
                                    </TableHead>
                                    <TableHead className="py-3">
                                      Last Updated
                                    </TableHead>
                                    <TableHead className="py-3">
                                      Hours of Use
                                    </TableHead>
                                    <TableHead className="py-3">
                                      Actions
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {filteredBlueprints.length === 0 ? (
                                    <TableRow>
                                      <TableCell
                                        colSpan={6}
                                        className="text-center py-8 text-gray-500"
                                      >
                                        No blueprints found. Try adjusting your
                                        search.
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    filteredBlueprints.map(
                                      (blueprint, index) => (
                                        <TableRow
                                          key={blueprint.id}
                                          className="cursor-pointer hover:bg-gray-50 transition-colors"
                                          onClick={() =>
                                            (window.location.href = `/blueprint-editor/${blueprint.id}`)
                                          }
                                          ref={
                                            index === 0
                                              ? blueprintItemRef
                                              : null
                                          }
                                        >
                                          <TableCell className="font-medium max-w-[200px] truncate">
                                            {blueprint.name}
                                          </TableCell>
                                          <TableCell>
                                            {blueprint.type}
                                          </TableCell>
                                          <TableCell>
                                            <span
                                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                blueprint.status === "Active"
                                                  ? "bg-green-100 text-green-800"
                                                  : blueprint.status ===
                                                      "Pending"
                                                    ? "bg-yellow-100 text-yellow-800"
                                                    : "bg-gray-100 text-gray-800"
                                              }`}
                                            >
                                              {blueprint.status}
                                            </span>
                                          </TableCell>
                                          <TableCell>
                                            {blueprint.lastUpdated}
                                          </TableCell>
                                          <TableCell>
                                            {blueprint.hoursOfUse}
                                          </TableCell>
                                          <TableCell>
                                            <div className="flex space-x-2">
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  window.location.href = `/blueprint-editor/${blueprint.id}`;
                                                }}
                                              >
                                                Edit
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-gray-500 hover:text-gray-700"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  // Open preview logic here
                                                }}
                                              >
                                                <ExternalLink className="h-4 w-4" />
                                              </Button>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      ),
                                    )
                                  )}
                                </TableBody>
                              </Table>
                            </CardContent>
                            {filteredBlueprints.length > 0 && (
                              <CardFooter className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center text-sm text-gray-500">
                                <div>
                                  Showing {filteredBlueprints.length} of{" "}
                                  {blueprints.length} blueprints
                                </div>
                                <div className="flex space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    disabled
                                  >
                                    &lt;
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-white bg-indigo-600 border-indigo-600"
                                  >
                                    1
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                  >
                                    &gt;
                                  </Button>
                                </div>
                              </CardFooter>
                            )}
                          </Card>
                        </motion.div>
                      </>
                    )}

                    {/* Analytics Tab Content */}
                    {activeTab === "analytics" && (
                      <>
                        <motion.div
                          variants={itemVariants}
                          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6"
                        >
                          <Card className="border-0 shadow-md p-6">
                            <div className="flex items-start">
                              <div className="rounded-full bg-blue-100 p-3 mr-4">
                                <Users className="h-6 w-6 text-blue-600" />
                              </div>
                              <div>
                                <p className="text-sm text-gray-500 mb-1">
                                  Monthly Active Users
                                </p>
                                <div className="flex items-baseline">
                                  <h3 className="text-2xl font-bold text-gray-900 mr-2">
                                    2,300
                                  </h3>
                                  <span className="text-xs text-green-600 font-medium">
                                    +15%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </Card>

                          <Card className="border-0 shadow-md p-6">
                            <div className="flex items-start">
                              <div className="rounded-full bg-indigo-100 p-3 mr-4">
                                <Clock className="h-6 w-6 text-indigo-600" />
                              </div>
                              <div>
                                <p className="text-sm text-gray-500 mb-1">
                                  Avg. Session Time
                                </p>
                                <div className="flex items-baseline">
                                  <h3 className="text-2xl font-bold text-gray-900 mr-2">
                                    28 min
                                  </h3>
                                  <span className="text-xs text-green-600 font-medium">
                                    +3 min
                                  </span>
                                </div>
                              </div>
                            </div>
                          </Card>

                          <Card className="border-0 shadow-md p-6">
                            <div className="flex items-start">
                              <div className="rounded-full bg-amber-100 p-3 mr-4">
                                <Activity className="h-6 w-6 text-amber-600" />
                              </div>
                              <div>
                                <p className="text-sm text-gray-500 mb-1">
                                  Total Hour Usage
                                </p>
                                <div className="flex items-baseline">
                                  <h3 className="text-2xl font-bold text-gray-900 mr-2">
                                    980 hrs
                                  </h3>
                                  <span className="text-xs text-red-600 font-medium">
                                    -5%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </Card>
                        </motion.div>

                        <motion.div variants={itemVariants} className="mb-6">
                          <Card className="border-0 shadow-md">
                            <CardHeader>
                              <div className="flex justify-between items-center">
                                <div>
                                  <CardTitle className="text-xl font-bold text-gray-800">
                                    Visitor Analytics
                                  </CardTitle>
                                  <CardDescription className="text-sm text-gray-500">
                                    Overview of your blueprint engagement
                                  </CardDescription>
                                </div>
                                <div className="flex space-x-2">
                                  <select
                                    className="text-sm border border-gray-200 rounded-md px-2 py-1 focus:ring-0 focus:border-indigo-500"
                                    value={selectedTimeRange}
                                    onChange={(e) =>
                                      setSelectedTimeRange(e.target.value)
                                    }
                                  >
                                    <option value="lastWeek">
                                      Last 7 days
                                    </option>
                                    <option value="lastMonth">
                                      Last 30 days
                                    </option>
                                    <option value="lastQuarter">
                                      Last 90 days
                                    </option>
                                    <option value="lastYear">Last year</option>
                                  </select>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pb-6">
                              <div className="h-80 bg-white flex items-center justify-center">
                                {/* Here you would render a real chart */}
                                <div className="w-full h-full flex flex-col">
                                  {/* Simple chart mockup */}
                                  <div className="flex justify-between mb-2 text-xs text-gray-500">
                                    <div>Visitors</div>
                                    <div>Engagement</div>
                                  </div>
                                  <div className="flex-1 relative">
                                    <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gray-200"></div>
                                    <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-gray-200"></div>

                                    {/* X-axis labels */}
                                    <div className="absolute bottom-[-20px] left-0 right-0 flex justify-between text-xs text-gray-500">
                                      {chartData.map((item) => (
                                        <div
                                          key={item.month}
                                          className="text-center"
                                        >
                                          {item.month}
                                        </div>
                                      ))}
                                    </div>

                                    {/* Visitor bars */}
                                    <div className="absolute bottom-0 left-0 right-0 h-[80%] flex justify-between items-end">
                                      {chartData.map((item, index) => (
                                        <div
                                          key={`${item.month}-visitors`}
                                          className="w-6 mx-2 bg-indigo-200 rounded-t-sm"
                                          style={{
                                            height: `${(item.visitors / 500) * 100}%`,
                                          }}
                                        ></div>
                                      ))}
                                    </div>

                                    {/* Engagement line */}
                                    <svg
                                      className="absolute inset-0 h-full w-full"
                                      preserveAspectRatio="none"
                                    >
                                      <polyline
                                        points={chartData
                                          .map((item, index) => {
                                            const x =
                                              (index / (chartData.length - 1)) *
                                              100;
                                            const y =
                                              100 -
                                              (item.engagement / 300) * 100;
                                            return `${x},${y}`;
                                          })
                                          .join(" ")}
                                        fill="none"
                                        stroke="#4f46e5"
                                        strokeWidth="2"
                                      />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>

                        <motion.div variants={itemVariants}>
                          <Card className="border-0 shadow-md">
                            <CardHeader>
                              <CardTitle className="text-xl font-bold text-gray-800">
                                Top Performing Blueprints
                              </CardTitle>
                              <CardDescription className="text-sm text-gray-500">
                                Blueprints with the highest engagement rates
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Blueprint</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Views</TableHead>
                                    <TableHead>Avg. Time</TableHead>
                                    <TableHead>Conv. Rate</TableHead>
                                    <TableHead>Growth</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {blueprints
                                    .slice(0, 3)
                                    .map((blueprint, index) => (
                                      <TableRow
                                        key={blueprint.id}
                                        className="hover:bg-gray-50"
                                      >
                                        <TableCell className="font-medium">
                                          {blueprint.name}
                                        </TableCell>
                                        <TableCell>{blueprint.type}</TableCell>
                                        <TableCell>
                                          {blueprint.visitors}
                                        </TableCell>
                                        <TableCell>
                                          {Math.floor(Math.random() * 35) + 10}{" "}
                                          min
                                        </TableCell>
                                        <TableCell>
                                          {Math.floor(Math.random() * 15) + 5}%
                                        </TableCell>
                                        <TableCell>
                                          <span
                                            className={
                                              Number(blueprint.growth) > 0
                                                ? "text-green-600"
                                                : "text-red-600"
                                            }
                                          >
                                            {Number(blueprint.growth) > 0
                                              ? "+"
                                              : ""}
                                            {blueprint.growth}%
                                          </span>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>
                            </CardContent>
                          </Card>
                        </motion.div>
                      </>
                    )}
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        )}
        <Footer />
      </div>

      {/* Onboarding Components */}
      <WelcomeModal
        show={showWelcomeModal}
        onStart={startOnboarding}
        onSkip={skipOnboarding}
      />

      {isOnboardingActive && (
        <>
          <ProgressBadge currentStep={onboardingStep} totalSteps={6} />

          {/* Step 0: Overview Tab Spotlight */}
          <Spotlight
            targetRef={overviewTabRef}
            show={isOnboardingActive && onboardingStep === 0}
          >
            <OnboardingTooltip
              title="Dashboard Overview"
              description="This is your main dashboard where you can see all your Blueprint metrics and performance at a glance."
              onNext={nextStep}
              onSkip={skipOnboarding}
              currentStep={onboardingStep}
              totalSteps={6}
              isFirstStep={true}
              isLastStep={false}
            />
          </Spotlight>

          {/* Step 1: Stats Cards Spotlight */}
          <Spotlight
            targetRef={statsCardRef}
            show={isOnboardingActive && onboardingStep === 1}
          >
            <OnboardingTooltip
              title="Key Performance Metrics"
              description="Monitor your Blueprint's performance with these key metrics. Track your total blueprints, customers, and sessions."
              onNext={nextStep}
              onPrev={prevStep}
              onSkip={skipOnboarding}
              currentStep={onboardingStep}
              totalSteps={6}
              isFirstStep={false}
              isLastStep={false}
            />
          </Spotlight>

          {/* Step 2: Blueprints Tab Spotlight */}
          <Spotlight
            targetRef={blueprintsTabRef}
            show={isOnboardingActive && onboardingStep === 2}
          >
            <OnboardingTooltip
              title="My Blueprints"
              description="Switch to the Blueprints tab to view all your 3D spaces and manage them in one place."
              onNext={nextStep}
              onPrev={prevStep}
              onSkip={skipOnboarding}
              currentStep={onboardingStep}
              totalSteps={6}
              isFirstStep={false}
              isLastStep={false}
            />
          </Spotlight>

          {/* Step 3: Blueprint Item Spotlight */}
          <Spotlight
            targetRef={blueprintItemRef}
            show={isOnboardingActive && onboardingStep === 3}
            onComplete={() => {
              if (onboardingStep === 5) {
                triggerConfetti();
              }
            }}
          >
            <OnboardingTooltip
              title="Your Blueprint"
              description="This is your 3D space that was just created. Click on it to view details or edit it."
              onNext={nextStep}
              onPrev={prevStep}
              onSkip={skipOnboarding}
              currentStep={onboardingStep}
              totalSteps={6}
              isFirstStep={false}
              isLastStep={false}
            />
          </Spotlight>

          {/* Step 4: Create Blueprint Button Spotlight */}
          <Spotlight
            targetRef={createBlueprintRef}
            show={isOnboardingActive && onboardingStep === 4}
            contentClassName="left-auto right-4" // Add this line to force right alignment
          >
            <OnboardingTooltip
              title="Create New Blueprints"
              description="Want to create more 3D spaces? Use this button to start the process for additional locations."
              onNext={nextStep}
              onPrev={prevStep}
              onSkip={skipOnboarding}
              currentStep={onboardingStep}
              totalSteps={6}
              isFirstStep={false}
              isLastStep={false}
            />
          </Spotlight>

          {/* Step 5: Final Step - Editor Introduction */}
          <Spotlight
            show={isOnboardingActive && onboardingStep === 5}
            targetRef={blueprintItemRef}
          >
            <OnboardingTooltip
              title="Let's Edit Your Blueprint"
              description="Now let's explore the Blueprint Editor where you can customize your 3D space and add interactive elements."
              onNext={() => {
                triggerConfetti();
                completeOnboarding();
                // Navigate to editor after a slight delay
                setTimeout(() => {
                  if (blueprints.length > 0) {
                    window.location.href = `/blueprint-editor/${blueprints[0].id}`;
                  }
                }, 1500);
              }}
              onPrev={prevStep}
              onSkip={skipOnboarding}
              currentStep={onboardingStep}
              totalSteps={6}
              isFirstStep={false}
              isLastStep={true}
            />
          </Spotlight>
        </>
      )}
    </LiveAPIProvider>
  );
}
