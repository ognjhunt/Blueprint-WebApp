"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { storage } from "@/lib/firebase"; // Assuming storage is exported from here
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import {
  Settings,
  User,
  Bell,
  Moon,
  Sun,
  Lock,
  Download,
  Copy,
  Calendar,
  Clock,
  Trash2,
  Zap,
  Users,
  CreditCard,
  Code,
  Save,
  FileText,
  Terminal,
  Globe,
  Palette,
  Upload,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  BarChart3,
  LogOut,
  Shield,
  PlugZap,
  Smartphone,
  Key,
  RefreshCw,
  Webhook,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
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

const settingsSections = [
  { id: "profile", label: "Profile", icon: <User className="h-5 w-5" /> },
  { id: "account", label: "Account", icon: <Lock className="h-5 w-5" /> },
  { id: "billing", label: "Billing", icon: <CreditCard className="h-5 w-5" /> },
  {
    id: "team",
    label: "Teams & Permissions",
    icon: <Users className="h-5 w-5" />,
  },
  {
    id: "api",
    label: "API & Integrations",
    icon: <PlugZap className="h-5 w-5" />,
  },
];

export default function SettingsPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState("profile");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // User profile settings
  const [profileSettings, setProfileSettings] = useState({
    displayName: "",
    email: "",
    photoURL: "",
    bio: "",
    jobTitle: "",
    company: "",
    timeZone: "UTC",
    language: "en",
    phoneNumber: "",
  });

  // Account settings
  const [accountSettings, setAccountSettings] = useState({
    email2FA: false,
    sms2FA: false,
    securityAlerts: true,
    loginAttempts: true,
  });

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    blueprintChanges: true,
    teamUpdates: true,
    usageAlerts: true,
    marketingEmails: false,
    weeklyDigest: true,
    securityNotifications: true,
  });

  // Appearance settings
  const [appearanceSettings, setAppearanceSettings] = useState({
    theme: "system",
    compactMode: false,
    animationsEnabled: true,
    highContrastMode: false,
    fontSize: "medium",
    colorScheme: "default",
  });

  // Initialize with empty arrays instead of mock data
  const [apiKeys, setApiKeys] = useState([]);
  const [integrations, setIntegrations] = useState([]);

  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const fetchUserSettings = async () => {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          let userData = userSnap.data();

          // Default values for missing fields
          // Default values for missing fields
          const requiredFields = {
            displayName: userData.displayName || currentUser.displayName || "",
            email: currentUser.email || "",
            photoURL: userData.photoURL || currentUser.photoURL || "",
            bio: userData.bio || "",
            jobTitle: userData.jobTitle || "",
            company: userData.company || userData.organizationName || "",
            timeZone: userData.timeZone || "UTC",
            language: userData.language || "en",
            phoneNumber: userData.phoneNumber || "",
            planType: userData.planType || "free",
            planUsage: userData.planUsage || 0,
            planExpiryDate: userData.planExpiryDate || null,
            activeBlueprintsPercentage:
              userData.activeBlueprintsPercentage || 0,
            accountSettings: userData.accountSettings || {
              email2FA: false,
              sms2FA: false,
              securityAlerts: true,
              loginAttempts: true,
            },
            notificationSettings: userData.notificationSettings || {
              emailNotifications: true,
              pushNotifications: true,
              blueprintChanges: true,
              teamUpdates: true,
              usageAlerts: true,
              marketingEmails: false,
              weeklyDigest: true,
              securityNotifications: true,
            },
            apiKeys: userData.apiKeys || [],
            integrations: userData.integrations || [],
            teamMembers: userData.teamMembers || { count: 0, pending: 0 },
            blueprintsShared: userData.blueprintsShared || {
              count: 0,
              sharedWith: 0,
            },
            billingHistory: userData.billingHistory || [],
            paymentMethods: userData.paymentMethods || [],
            teamRoles: userData.teamRoles || { count: 0, roles: [] },
          };

          if (userData.apiKeys) {
            setApiKeys(userData.apiKeys);
          }

          // Set integrations
          if (userData.integrations) {
            setIntegrations(userData.integrations);
          }

          // Check if any fields are missing and need to be added to the database
          let needsUpdate = false;
          for (const [key, value] of Object.entries(requiredFields)) {
            if (userData[key] === undefined) {
              userData[key] = value;
              needsUpdate = true;
            }
          }

          // Update Firebase if any fields were missing
          if (needsUpdate) {
            try {
              await updateDoc(userRef, userData);
              console.log("Added missing fields to user document");
            } catch (err) {
              console.error("Error updating user with missing fields:", err);
            }
          }

          // Update state with user data
          setUserData(userData);

          // Update other state variables
          setProfileSettings({
            displayName: userData.displayName,
            email: userData.email,
            photoURL: userData.photoURL,
            bio: userData.bio,
            jobTitle: userData.jobTitle,
            company: userData.company,
            timeZone: userData.timeZone,
            language: userData.language,
            phoneNumber: userData.phoneNumber,
          });

          // Set account settings
          if (userData.accountSettings) {
            setAccountSettings(userData.accountSettings);
          }

          // Set notification settings
          if (userData.notificationSettings) {
            setNotificationSettings(userData.notificationSettings);
          }
        }
      } catch (error) {
        console.error("Error fetching user settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserSettings();
  }, [currentUser]);

  const handleSaveSettings = async () => {
    if (!currentUser) return;

    setIsSaving(true);
    try {
      const userRef = doc(db, "users", currentUser.uid);

      // Combine all settings into one object for saving
      const settings = {
        ...profileSettings,
        accountSettings,
        notificationSettings,
        apiKeys,
        integrations,
        updatedAt: new Date(),
      };

      // Remove any sensitive or unnecessary fields
      delete settings.email; // Don't update email this way

      await updateDoc(userRef, settings);

      // Update the local userData state to reflect changes
      setUserData((prev) => ({
        ...prev,
        ...settings,
      }));

      // Show success toast
      toast({
        title: "Settings updated",
        description: "Your settings have been saved successfully.",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error saving settings",
        description:
          "There was a problem saving your settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // Optional: for progress display

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;

    // Basic validation (optional: add size limits)
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File Type",
        description: "Please select an image file (e.g., JPG, PNG, GIF).",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const storagePath = `profileImages/${currentUser.uid}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
        console.log("Upload is " + progress + "% done");
      },
      (error) => {
        console.error("Upload failed:", error);
        toast({
          title: "Upload Failed",
          description:
            "Could not upload profile picture. Please try again. " +
            error.message,
          variant: "destructive",
        });
        setIsUploading(false);
        setUploadProgress(0);
        // Reset file input value if needed
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      },
      async () => {
        // Upload completed successfully, now get the download URL
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          console.log("File available at", downloadURL);

          // Update Firestore user document
          const userRef = doc(db, "users", currentUser.uid);
          await updateDoc(userRef, {
            photoURL: downloadURL,
          });

          // Update local state for immediate UI feedback
          setProfileSettings((prev) => ({ ...prev, photoURL: downloadURL }));
          // Also update userData if it's used elsewhere directly for display
          setUserData((prev) => ({ ...prev, photoURL: downloadURL }));

          toast({
            title: "Profile Picture Updated",
            description: "Your new profile picture has been saved.",
          });
        } catch (error) {
          console.error("Error updating profile picture URL:", error);
          toast({
            title: "Update Failed",
            description:
              "Could not save the new profile picture URL. " + error.message,
            variant: "destructive",
          });
        } finally {
          setIsUploading(false);
          setUploadProgress(0);
          // Reset file input value
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      },
    );
  };

  // Function to handle form changes for different settings
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleAccountToggle = (name, value) => {
    setAccountSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleNotificationToggle = (name, value) => {
    setNotificationSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleAppearanceChange = (name, value) => {
    setAppearanceSettings((prev) => ({ ...prev, [name]: value }));
  };

  // Function to generate new API key (simulated)
  const handleGenerateApiKey = (keyName) => {
    // In a real app, this would make an API call to generate a key
    const newKey = {
      id: `key_${apiKeys.length + 1}`,
      name: keyName,
      key: `bp_${Math.random().toString(36).substring(2, 15)}`,
      created: new Date().toISOString().split("T")[0],
      lastUsed: new Date().toISOString().split("T")[0],
    };

    setApiKeys([...apiKeys, newKey]);

    toast({
      title: "API Key generated",
      description: `New API key '${keyName}' has been created.`,
    });
  };

  // Function to revoke API key (simulated)
  const handleRevokeApiKey = (keyId) => {
    setApiKeys(apiKeys.filter((key) => key.id !== keyId));

    toast({
      title: "API Key revoked",
      description: "The API key has been revoked and is no longer valid.",
    });
  };

  // Function to connect integration (simulated)
  const handleConnectIntegration = (integrationId) => {
    setIntegrations(
      integrations.map((integration) =>
        integration.id === integrationId
          ? {
              ...integration,
              status: "connected",
              connectedAt: new Date().toISOString().split("T")[0],
            }
          : integration,
      ),
    );

    toast({
      title: "Integration connected",
      description: "Your integration has been successfully connected.",
    });
  };

  // Function to disconnect integration (simulated)
  const handleDisconnectIntegration = (integrationId) => {
    setIntegrations(
      integrations.map((integration) =>
        integration.id === integrationId
          ? { ...integration, status: "not_connected", connectedAt: null }
          : integration,
      ),
    );

    toast({
      title: "Integration disconnected",
      description: "Your integration has been disconnected.",
    });
  };

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50/30 pt-20 pb-16">
        {/* Background elements for visual appeal */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-gradient-to-br from-indigo-200/20 to-violet-200/20 rounded-full blur-3xl"></div>
          <div className="absolute top-1/3 right-0 w-72 h-72 bg-gradient-to-br from-blue-200/20 to-indigo-200/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-gradient-to-br from-purple-200/20 to-pink-200/20 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Header Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              Settings
            </h1>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Customize your Blueprint experience and manage your account
              preferences.
            </p>
          </motion.div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Sidebar Navigation */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="lg:w-64 space-y-2"
              >
                <Card className="sticky top-24 border-0 shadow-md overflow-hidden bg-white/80 backdrop-blur-sm">
                  <CardContent className="p-3">
                    {settingsSections.map((section) => (
                      <motion.button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full flex items-center py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                          activeSection === section.id
                            ? "bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-700"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                        whileHover={{ x: activeSection === section.id ? 0 : 5 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <span
                          className={`mr-3 ${
                            activeSection === section.id
                              ? "text-indigo-600"
                              : "text-gray-400"
                          }`}
                        >
                          {section.icon}
                        </span>
                        {section.label}
                        {activeSection === section.id && (
                          <motion.div
                            className="ml-auto w-1.5 h-5 rounded-full bg-indigo-600"
                            layoutId="activeSection"
                          />
                        )}
                      </motion.button>
                    ))}
                  </CardContent>
                </Card>

                {/* Subscription Card */}
                {userData && (
                  <Card className="border-0 shadow-md overflow-hidden">
                    <div
                      className={`p-4 text-white ${userData.planType === "pro" ? "bg-gradient-to-br from-indigo-500 to-violet-600" : "bg-gradient-to-br from-blue-400 to-blue-500"}`}
                    >
                      <h3 className="font-semibold">
                        {userData.planType === "pro"
                          ? "Pro Subscription"
                          : "Free Tier"}
                      </h3>
                      <p className="text-xs text-indigo-100 mt-1 mb-3">
                        {userData.planType === "pro" && userData.planExpiryDate
                          ? `Valid until ${new Date(userData.planExpiryDate.toDate()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                          : userData.planType === "free"
                            ? "Upgrade to unlock more features"
                            : "N/A"}
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium">
                          Usage: {userData.planUsage || "0"}%
                        </span>
                        <span className="text-xs">
                          {userData.activeBlueprintsPercentage || "0"}% active
                        </span>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-1.5 mt-1 mb-3">
                        <div
                          className="bg-white rounded-full h-1.5"
                          style={{ width: `${userData.planUsage || 0}%` }}
                        ></div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full bg-white/10 hover:bg-white/20 text-white border-0"
                        onClick={() => (window.location.href = "/pricing")}
                      >
                        {userData.planType === "plus"
                          ? "Manage Plan"
                          : "Upgrade to Plus"}
                      </Button>
                    </div>
                  </Card>
                )}
              </motion.div>

              {/* Main Content */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex-1"
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSection}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Profile Settings */}
                    {activeSection === "profile" && (
                      <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="space-y-6"
                      >
                        <Card className="border-0 shadow-md">
                          <CardHeader>
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                              <div>
                                <CardTitle className="text-xl font-bold text-gray-800 flex items-center">
                                  <User className="mr-2 h-5 w-5 text-indigo-500" />
                                  Profile Information
                                </CardTitle>
                                <CardDescription>
                                  Manage your personal information and profile
                                  settings
                                </CardDescription>
                              </div>
                              <Button
                                onClick={handleSaveSettings}
                                disabled={isSaving || isUploading} // Disable save if uploading too
                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                              >
                                {isSaving ? (
                                  <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Changes
                                  </>
                                )}
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            {/* Profile Photo Upload */}
                            <motion.div
                              variants={itemVariants}
                              className="flex flex-col items-center sm:flex-row sm:items-start gap-6"
                            >
                              <div className="relative">
                                <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
                                  <AvatarImage
                                    src={
                                      profileSettings.photoURL ||
                                      "/avatars/01.png"
                                    } // Use state value
                                    alt={
                                      profileSettings.displayName ||
                                      "User Avatar"
                                    }
                                  />
                                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-xl font-bold text-white">
                                    {isUploading ? (
                                      <RefreshCw className="h-6 w-6 animate-spin" /> // Show spinner during upload
                                    ) : profileSettings.displayName ? (
                                      profileSettings.displayName
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")
                                        .toUpperCase()
                                    ) : (
                                      "U"
                                    )}
                                  </AvatarFallback>
                                </Avatar>
                                {/* Hidden File Input */}
                                <input
                                  type="file"
                                  ref={fileInputRef}
                                  onChange={handleFileChange}
                                  accept="image/*"
                                  style={{ display: "none" }}
                                  disabled={isUploading}
                                />
                                {/* Visible Upload Button */}
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="absolute -bottom-2 -right-2 rounded-full w-8 h-8 p-0 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
                                  onClick={handleUploadClick}
                                  disabled={isUploading}
                                  aria-label="Upload profile picture"
                                >
                                  {isUploading ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Upload className="h-4 w-4" />
                                  )}
                                </Button>
                                {/* Optional: Progress Indicator */}
                                {isUploading && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
                                    <span className="text-white text-xs font-bold">
                                      {Math.round(uploadProgress)}%
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 space-y-4 w-full sm:w-auto">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="displayName">
                                      Full Name
                                    </Label>
                                    <Input
                                      id="displayName"
                                      name="displayName"
                                      value={profileSettings.displayName}
                                      onChange={handleProfileChange}
                                      placeholder="Your full name"
                                      disabled={isSaving || isUploading}
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                      id="email"
                                      name="email"
                                      type="email"
                                      value={profileSettings.email}
                                      disabled // Email usually not changed here
                                      className="bg-gray-100 cursor-not-allowed"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="bio">Bio</Label>
                                  <Textarea
                                    id="bio"
                                    name="bio"
                                    value={profileSettings.bio}
                                    onChange={handleProfileChange}
                                    placeholder="Tell us a bit about yourself"
                                    className="min-h-[100px]"
                                    disabled={isSaving || isUploading}
                                  />
                                </div>
                              </div>
                            </motion.div>

                            <Separator />

                            {/* Professional Information */}
                            <motion.div variants={itemVariants}>
                              <h3 className="text-lg font-medium text-gray-800 mb-4">
                                Professional Information
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="jobTitle">Job Title</Label>
                                  <Input
                                    id="jobTitle"
                                    name="jobTitle"
                                    value={profileSettings.jobTitle}
                                    onChange={handleProfileChange}
                                    placeholder="Your job title"
                                    disabled={isSaving || isUploading}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="company">Company</Label>
                                  <Input
                                    id="company"
                                    name="company"
                                    value={profileSettings.company} // Directly use profileSettings state
                                    onChange={handleProfileChange}
                                    placeholder="Your company"
                                    disabled={isSaving || isUploading}
                                  />
                                </div>
                              </div>
                            </motion.div>

                            <Separator />

                            {/* Location and Contact */}
                            <motion.div variants={itemVariants}>
                              <h3 className="text-lg font-medium text-gray-800 mb-4">
                                Location & Contact
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="timeZone">Time Zone</Label>
                                  <Select
                                    value={profileSettings.timeZone}
                                    onValueChange={(value) =>
                                      setProfileSettings({
                                        ...profileSettings,
                                        timeZone: value,
                                      })
                                    }
                                    disabled={isSaving || isUploading}
                                  >
                                    <SelectTrigger id="timeZone">
                                      <SelectValue placeholder="Select a timezone" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="UTC">
                                        UTC (Coordinated Universal Time)
                                      </SelectItem>
                                      <SelectItem value="America/New_York">
                                        Eastern Time (ET)
                                      </SelectItem>
                                      <SelectItem value="America/Chicago">
                                        Central Time (CT)
                                      </SelectItem>
                                      <SelectItem value="America/Denver">
                                        Mountain Time (MT)
                                      </SelectItem>
                                      <SelectItem value="America/Los_Angeles">
                                        Pacific Time (PT)
                                      </SelectItem>
                                      <SelectItem value="Europe/London">
                                        London (GMT)
                                      </SelectItem>
                                      <SelectItem value="Europe/Paris">
                                        Central European Time (CET)
                                      </SelectItem>
                                      <SelectItem value="Asia/Tokyo">
                                        Japan Standard Time (JST)
                                      </SelectItem>
                                      {/* Add more timezones as needed */}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="language">Language</Label>
                                  <Select
                                    value={profileSettings.language}
                                    onValueChange={(value) =>
                                      setProfileSettings({
                                        ...profileSettings,
                                        language: value,
                                      })
                                    }
                                    disabled={isSaving || isUploading}
                                  >
                                    <SelectTrigger id="language">
                                      <SelectValue placeholder="Select a language" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="en">
                                        English
                                      </SelectItem>
                                      <SelectItem value="es">
                                        Spanish
                                      </SelectItem>
                                      <SelectItem value="fr">French</SelectItem>
                                      <SelectItem value="de">German</SelectItem>
                                      <SelectItem value="ja">
                                        Japanese
                                      </SelectItem>
                                      <SelectItem value="zh">
                                        Chinese
                                      </SelectItem>
                                      {/* Add more languages as needed */}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                  {" "}
                                  {/* Span phone number across */}
                                  <Label htmlFor="phoneNumber">
                                    Phone Number
                                  </Label>
                                  <Input
                                    id="phoneNumber"
                                    name="phoneNumber"
                                    type="tel" // Use tel type for phone numbers
                                    value={profileSettings.phoneNumber}
                                    onChange={handleProfileChange}
                                    placeholder="Your phone number (e.g., +1 555-123-4567)"
                                    disabled={isSaving || isUploading}
                                  />
                                </div>
                              </div>
                            </motion.div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}

                    {/* Account Settings */}
                    {activeSection === "account" && (
                      <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="space-y-6"
                      >
                        <Card className="border-0 shadow-md">
                          <CardHeader>
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                              <div>
                                <CardTitle className="text-xl font-bold text-gray-800 flex items-center">
                                  <Lock className="mr-2 h-5 w-5 text-indigo-500" />
                                  Account Security
                                </CardTitle>
                                <CardDescription>
                                  Manage your account security and
                                  authentication settings
                                </CardDescription>
                              </div>
                              <Button
                                onClick={handleSaveSettings}
                                disabled={isSaving}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                              >
                                {isSaving ? (
                                  <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Changes
                                  </>
                                )}
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            {/* Password Change */}
                            <motion.div
                              variants={itemVariants}
                              className="space-y-4"
                            >
                              <h3 className="text-lg font-medium text-gray-800">
                                Password
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="currentPassword">
                                    Current Password
                                  </Label>
                                  <Input
                                    id="currentPassword"
                                    type="password"
                                    placeholder="Enter your current password"
                                  />
                                </div>
                                <div className="col-span-1 md:col-span-2 flex gap-4">
                                  <div className="flex-1 space-y-2">
                                    <Label htmlFor="newPassword">
                                      New Password
                                    </Label>
                                    <Input
                                      id="newPassword"
                                      type="password"
                                      placeholder="Enter new password"
                                    />
                                  </div>
                                  <div className="flex-1 space-y-2">
                                    <Label htmlFor="confirmPassword">
                                      Confirm New Password
                                    </Label>
                                    <Input
                                      id="confirmPassword"
                                      type="password"
                                      placeholder="Confirm new password"
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="pt-2">
                                <Button variant="outline">
                                  Change Password
                                </Button>
                              </div>
                            </motion.div>

                            <Separator />

                            {/* Two-Factor Authentication */}
                            <motion.div
                              variants={itemVariants}
                              className="space-y-4"
                            >
                              <h3 className="text-lg font-medium text-gray-800">
                                Two-Factor Authentication
                              </h3>
                              <p className="text-sm text-gray-500">
                                Add an extra layer of security to your account
                                by enabling two-factor authentication.
                              </p>

                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <div className="space-y-0.5">
                                    <div className="text-sm font-medium">
                                      Email Authentication
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      Receive authentication codes via email
                                    </div>
                                  </div>
                                  <Switch
                                    checked={accountSettings.email2FA}
                                    onCheckedChange={(value) =>
                                      handleAccountToggle("email2FA", value)
                                    }
                                  />
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="space-y-0.5">
                                    <div className="text-sm font-medium">
                                      SMS Authentication
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      Receive authentication codes via SMS
                                    </div>
                                  </div>
                                  <Switch
                                    checked={accountSettings.sms2FA}
                                    onCheckedChange={(value) =>
                                      handleAccountToggle("sms2FA", value)
                                    }
                                  />
                                </div>
                              </div>
                            </motion.div>

                            <Separator />

                            {/* Security Alerts */}
                            <motion.div
                              variants={itemVariants}
                              className="space-y-4"
                            >
                              <h3 className="text-lg font-medium text-gray-800">
                                Security Alerts
                              </h3>

                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <div className="space-y-0.5">
                                    <div className="text-sm font-medium">
                                      Login Alerts
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      Receive alerts for new login attempts
                                    </div>
                                  </div>
                                  <Switch
                                    checked={accountSettings.loginAttempts}
                                    onCheckedChange={(value) =>
                                      handleAccountToggle(
                                        "loginAttempts",
                                        value,
                                      )
                                    }
                                  />
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="space-y-0.5">
                                    <div className="text-sm font-medium">
                                      Security Notifications
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      Get notified about important security
                                      events
                                    </div>
                                  </div>
                                  <Switch
                                    checked={accountSettings.securityAlerts}
                                    onCheckedChange={(value) =>
                                      handleAccountToggle(
                                        "securityAlerts",
                                        value,
                                      )
                                    }
                                  />
                                </div>
                              </div>
                            </motion.div>

                            <Separator />

                            {/* Danger Zone */}
                            <motion.div variants={itemVariants}>
                              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                                <h3 className="text-lg font-medium text-red-800 mb-2">
                                  Danger Zone
                                </h3>
                                <p className="text-sm text-red-600 mb-4">
                                  Irreversible and destructive actions for your
                                  account.
                                </p>
                                <div className="space-y-4">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-lg bg-white border border-red-100">
                                    <div>
                                      <h4 className="font-medium text-gray-900">
                                        Delete Account
                                      </h4>
                                      <p className="text-sm text-gray-500">
                                        Permanently delete your account and all
                                        associated data.
                                      </p>
                                    </div>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="destructive">
                                          Delete Account
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>
                                            Are you absolutely sure?
                                          </AlertDialogTitle>
                                          <AlertDialogDescription>
                                            This action cannot be undone. This
                                            will permanently delete your account
                                            and remove all of your data from our
                                            servers.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>
                                            Cancel
                                          </AlertDialogCancel>
                                          <AlertDialogAction className="bg-red-600 hover:bg-red-700">
                                            Delete Account
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>

                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-lg bg-white border border-red-100">
                                    <div>
                                      <h4 className="font-medium text-gray-900">
                                        Log Out Everywhere
                                      </h4>
                                      <p className="text-sm text-gray-500">
                                        Sign out from all devices where you're
                                        currently logged in.
                                      </p>
                                    </div>
                                    <Button
                                      variant="outline"
                                      className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    >
                                      <LogOut className="mr-2 h-4 w-4" />
                                      Log Out Everywhere
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}

                    {/* Notification Settings */}
                    {activeSection === "notifications" && (
                      <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="space-y-6"
                      >
                        <Card className="border-0 shadow-md">
                          <CardHeader>
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                              <div>
                                <CardTitle className="text-xl font-bold text-gray-800 flex items-center">
                                  <Bell className="mr-2 h-5 w-5 text-indigo-500" />
                                  Notification Preferences
                                </CardTitle>
                                <CardDescription>
                                  Control how and when Blueprint notifies you
                                </CardDescription>
                              </div>
                              <Button
                                onClick={handleSaveSettings}
                                disabled={isSaving}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                              >
                                {isSaving ? (
                                  <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Changes
                                  </>
                                )}
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <Tabs defaultValue="channels" className="w-full">
                              <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="channels">
                                  Notification Channels
                                </TabsTrigger>
                                <TabsTrigger value="types">
                                  Notification Types
                                </TabsTrigger>
                              </TabsList>
                              <TabsContent
                                value="channels"
                                className="space-y-6 pt-4"
                              >
                                <motion.div
                                  variants={itemVariants}
                                  className="space-y-4"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                      <div className="text-sm font-medium">
                                        Email Notifications
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        Receive notifications via email
                                      </div>
                                    </div>
                                    <Switch
                                      checked={
                                        notificationSettings.emailNotifications
                                      }
                                      onCheckedChange={(value) =>
                                        handleNotificationToggle(
                                          "emailNotifications",
                                          value,
                                        )
                                      }
                                    />
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                      <div className="text-sm font-medium">
                                        Push Notifications
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        Receive notifications in your browser
                                      </div>
                                    </div>
                                    <Switch
                                      checked={
                                        notificationSettings.pushNotifications
                                      }
                                      onCheckedChange={(value) =>
                                        handleNotificationToggle(
                                          "pushNotifications",
                                          value,
                                        )
                                      }
                                    />
                                  </div>

                                  <Separator />

                                  <div className="pt-2">
                                    <h3 className="text-sm font-medium text-gray-800 mb-2">
                                      Email Frequency
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="radio"
                                          id="realtime"
                                          name="emailFrequency"
                                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                          defaultChecked
                                        />
                                        <Label htmlFor="realtime">
                                          Real-time
                                        </Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="radio"
                                          id="daily"
                                          name="emailFrequency"
                                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                        />
                                        <Label htmlFor="daily">
                                          Daily digest
                                        </Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="radio"
                                          id="weekly"
                                          name="emailFrequency"
                                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                        />
                                        <Label htmlFor="weekly">
                                          Weekly digest
                                        </Label>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              </TabsContent>

                              <TabsContent
                                value="types"
                                className="space-y-6 pt-4"
                              >
                                <motion.div
                                  variants={itemVariants}
                                  className="space-y-4"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                      <div className="text-sm font-medium">
                                        Blueprint Changes
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        Notifications about changes to your
                                        blueprints
                                      </div>
                                    </div>
                                    <Switch
                                      checked={
                                        notificationSettings.blueprintChanges
                                      }
                                      onCheckedChange={(value) =>
                                        handleNotificationToggle(
                                          "blueprintChanges",
                                          value,
                                        )
                                      }
                                    />
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                      <div className="text-sm font-medium">
                                        Team Updates
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        Notifications about team activity and
                                        members
                                      </div>
                                    </div>
                                    <Switch
                                      checked={notificationSettings.teamUpdates}
                                      onCheckedChange={(value) =>
                                        handleNotificationToggle(
                                          "teamUpdates",
                                          value,
                                        )
                                      }
                                    />
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                      <div className="text-sm font-medium">
                                        Usage Alerts
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        Notifications about your plan usage and
                                        limits
                                      </div>
                                    </div>
                                    <Switch
                                      checked={notificationSettings.usageAlerts}
                                      onCheckedChange={(value) =>
                                        handleNotificationToggle(
                                          "usageAlerts",
                                          value,
                                        )
                                      }
                                    />
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                      <div className="text-sm font-medium">
                                        Security Notifications
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        Important alerts related to your account
                                        security
                                      </div>
                                    </div>
                                    <Switch
                                      checked={
                                        notificationSettings.securityNotifications
                                      }
                                      onCheckedChange={(value) =>
                                        handleNotificationToggle(
                                          "securityNotifications",
                                          value,
                                        )
                                      }
                                    />
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                      <div className="text-sm font-medium">
                                        Weekly Digest
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        Weekly summary of activity and metrics
                                      </div>
                                    </div>
                                    <Switch
                                      checked={
                                        notificationSettings.weeklyDigest
                                      }
                                      onCheckedChange={(value) =>
                                        handleNotificationToggle(
                                          "weeklyDigest",
                                          value,
                                        )
                                      }
                                    />
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                      <div className="text-sm font-medium">
                                        Marketing Emails
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        Promotional emails and product updates
                                      </div>
                                    </div>
                                    <Switch
                                      checked={
                                        notificationSettings.marketingEmails
                                      }
                                      onCheckedChange={(value) =>
                                        handleNotificationToggle(
                                          "marketingEmails",
                                          value,
                                        )
                                      }
                                    />
                                  </div>
                                </motion.div>
                              </TabsContent>
                            </Tabs>

                            <div className="mt-6 pt-6 border-t border-gray-100">
                              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start">
                                <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" />
                                <div>
                                  <h4 className="text-sm font-medium text-amber-800">
                                    Important Note
                                  </h4>
                                  <p className="text-xs text-amber-700 mt-1">
                                    Some security-related notifications cannot
                                    be disabled as they are essential for your
                                    account's safety.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}

                    {/* Appearance Settings */}
                    {activeSection === "appearance" && (
                      <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="space-y-6"
                      >
                        <Card className="border-0 shadow-md">
                          <CardHeader>
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                              <div>
                                <CardTitle className="text-xl font-bold text-gray-800 flex items-center">
                                  <Palette className="mr-2 h-5 w-5 text-indigo-500" />
                                  Appearance Settings
                                </CardTitle>
                                <CardDescription>
                                  Customize how Blueprint looks and feels
                                </CardDescription>
                              </div>
                              <Button
                                onClick={handleSaveSettings}
                                disabled={isSaving}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                              >
                                {isSaving ? (
                                  <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Changes
                                  </>
                                )}
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            {/* Theme Selection */}
                            <motion.div
                              variants={itemVariants}
                              className="space-y-4"
                            >
                              <h3 className="text-lg font-medium text-gray-800">
                                Theme
                              </h3>
                              <div className="grid grid-cols-3 gap-4">
                                <div
                                  className={`cursor-pointer rounded-lg border p-4 flex flex-col items-center ${
                                    appearanceSettings.theme === "light"
                                      ? "border-indigo-500 bg-indigo-50"
                                      : "border-gray-200 hover:border-indigo-200 hover:bg-gray-50"
                                  }`}
                                  onClick={() =>
                                    handleAppearanceChange("theme", "light")
                                  }
                                >
                                  <div className="h-14 w-14 bg-white border border-gray-200 rounded-full flex items-center justify-center mb-2">
                                    <Sun className="h-6 w-6 text-amber-500" />
                                  </div>
                                  <span className="text-sm font-medium">
                                    Light
                                  </span>
                                </div>

                                <div
                                  className={`cursor-pointer rounded-lg border p-4 flex flex-col items-center ${
                                    appearanceSettings.theme === "dark"
                                      ? "border-indigo-500 bg-indigo-50"
                                      : "border-gray-200 hover:border-indigo-200 hover:bg-gray-50"
                                  }`}
                                  onClick={() =>
                                    handleAppearanceChange("theme", "dark")
                                  }
                                >
                                  <div className="h-14 w-14 bg-gray-900 border border-gray-700 rounded-full flex items-center justify-center mb-2">
                                    <Moon className="h-6 w-6 text-gray-400" />
                                  </div>
                                  <span className="text-sm font-medium">
                                    Dark
                                  </span>
                                </div>

                                <div
                                  className={`cursor-pointer rounded-lg border p-4 flex flex-col items-center ${
                                    appearanceSettings.theme === "system"
                                      ? "border-indigo-500 bg-indigo-50"
                                      : "border-gray-200 hover:border-indigo-200 hover:bg-gray-50"
                                  }`}
                                  onClick={() =>
                                    handleAppearanceChange("theme", "system")
                                  }
                                >
                                  <div className="h-14 w-14 bg-gradient-to-br from-white to-gray-900 border border-gray-200 rounded-full flex items-center justify-center mb-2">
                                    <div className="h-6 w-6 bg-white rounded-l-full border-t border-l border-b border-gray-300"></div>
                                    <div className="h-6 w-6 bg-gray-900 rounded-r-full border-t border-r border-b border-gray-700"></div>
                                  </div>
                                  <span className="text-sm font-medium">
                                    System
                                  </span>
                                </div>
                              </div>
                            </motion.div>

                            <Separator />

                            {/* Visual Preferences */}
                            <motion.div
                              variants={itemVariants}
                              className="space-y-4"
                            >
                              <h3 className="text-lg font-medium text-gray-800">
                                Visual Preferences
                              </h3>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                      <div className="text-sm font-medium">
                                        Animations
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        Enable UI animations and transitions
                                      </div>
                                    </div>
                                    <Switch
                                      checked={
                                        appearanceSettings.animationsEnabled
                                      }
                                      onCheckedChange={(value) =>
                                        handleAppearanceChange(
                                          "animationsEnabled",
                                          value,
                                        )
                                      }
                                    />
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                      <div className="text-sm font-medium">
                                        Compact Mode
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        Reduce spacing to fit more content
                                      </div>
                                    </div>
                                    <Switch
                                      checked={appearanceSettings.compactMode}
                                      onCheckedChange={(value) =>
                                        handleAppearanceChange(
                                          "compactMode",
                                          value,
                                        )
                                      }
                                    />
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                      <div className="text-sm font-medium">
                                        High Contrast
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        Increase contrast for better visibility
                                      </div>
                                    </div>
                                    <Switch
                                      checked={
                                        appearanceSettings.highContrastMode
                                      }
                                      onCheckedChange={(value) =>
                                        handleAppearanceChange(
                                          "highContrastMode",
                                          value,
                                        )
                                      }
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor="fontSize">Font Size</Label>
                                    <Select
                                      value={appearanceSettings.fontSize}
                                      onValueChange={(value) =>
                                        handleAppearanceChange(
                                          "fontSize",
                                          value,
                                        )
                                      }
                                    >
                                      <SelectTrigger id="fontSize">
                                        <SelectValue placeholder="Select font size" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="small">
                                          Small
                                        </SelectItem>
                                        <SelectItem value="medium">
                                          Medium
                                        </SelectItem>
                                        <SelectItem value="large">
                                          Large
                                        </SelectItem>
                                        <SelectItem value="x-large">
                                          Extra Large
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            </motion.div>

                            <Separator />

                            {/* Color Schemes */}
                            <motion.div
                              variants={itemVariants}
                              className="space-y-4"
                            >
                              <h3 className="text-lg font-medium text-gray-800">
                                Color Scheme
                              </h3>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                <div
                                  className={`cursor-pointer rounded-lg border p-4 flex flex-col items-center ${
                                    appearanceSettings.colorScheme === "default"
                                      ? "border-indigo-500 bg-indigo-50"
                                      : "border-gray-200 hover:border-indigo-200 hover:bg-gray-50"
                                  }`}
                                  onClick={() =>
                                    handleAppearanceChange(
                                      "colorScheme",
                                      "default",
                                    )
                                  }
                                >
                                  <div className="h-10 w-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg mb-2"></div>
                                  <span className="text-sm font-medium">
                                    Default
                                  </span>
                                </div>

                                <div
                                  className={`cursor-pointer rounded-lg border p-4 flex flex-col items-center ${
                                    appearanceSettings.colorScheme === "blue"
                                      ? "border-indigo-500 bg-indigo-50"
                                      : "border-gray-200 hover:border-indigo-200 hover:bg-gray-50"
                                  }`}
                                  onClick={() =>
                                    handleAppearanceChange(
                                      "colorScheme",
                                      "blue",
                                    )
                                  }
                                >
                                  <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg mb-2"></div>
                                  <span className="text-sm font-medium">
                                    Ocean
                                  </span>
                                </div>

                                <div
                                  className={`cursor-pointer rounded-lg border p-4 flex flex-col items-center ${
                                    appearanceSettings.colorScheme === "green"
                                      ? "border-indigo-500 bg-indigo-50"
                                      : "border-gray-200 hover:border-indigo-200 hover:bg-gray-50"
                                  }`}
                                  onClick={() =>
                                    handleAppearanceChange(
                                      "colorScheme",
                                      "green",
                                    )
                                  }
                                >
                                  <div className="h-10 w-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg mb-2"></div>
                                  <span className="text-sm font-medium">
                                    Forest
                                  </span>
                                </div>

                                <div
                                  className={`cursor-pointer rounded-lg border p-4 flex flex-col items-center ${
                                    appearanceSettings.colorScheme === "purple"
                                      ? "border-indigo-500 bg-indigo-50"
                                      : "border-gray-200 hover:border-indigo-200 hover:bg-gray-50"
                                  }`}
                                  onClick={() =>
                                    handleAppearanceChange(
                                      "colorScheme",
                                      "purple",
                                    )
                                  }
                                >
                                  <div className="h-10 w-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg mb-2"></div>
                                  <span className="text-sm font-medium">
                                    Royal
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}

                    {/* Billing Settings */}
                    {activeSection === "billing" && (
                      <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="space-y-6"
                      >
                        <Card className="border-0 shadow-md">
                          <CardHeader>
                            <CardTitle className="text-xl font-bold text-gray-800 flex items-center">
                              <CreditCard className="mr-2 h-5 w-5 text-indigo-500" />
                              Billing & Subscription
                            </CardTitle>
                            <CardDescription>
                              Manage your billing information and subscription
                              details
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            {/* Current Plan */}
                            <motion.div
                              variants={itemVariants}
                              className="space-y-4"
                            >
                              <h3 className="text-lg font-medium text-gray-800">
                                Current Plan
                              </h3>
                              <div
                                className={`rounded-lg border p-4 ${userData?.planType === "pro" ? "border-indigo-100 bg-indigo-50" : "border-blue-100 bg-blue-50"}`}
                              >
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4
                                        className={`text-lg font-semibold ${userData?.planType === "pro" ? "text-indigo-700" : "text-blue-700"}`}
                                      >
                                        {userData?.planType === "pro"
                                          ? "Pro Subscription"
                                          : "Free Tier"}
                                      </h4>
                                      <Badge
                                        className={`${userData?.planType === "pro" ? "bg-indigo-100 text-indigo-800 hover:bg-indigo-100" : "bg-blue-100 text-blue-800 hover:bg-blue-100"}`}
                                      >
                                        Active
                                      </Badge>
                                    </div>
                                    <p
                                      className={`text-sm mt-1 ${userData?.planType === "pro" ? "text-indigo-600" : "text-blue-600"}`}
                                    >
                                      {userData?.planType === "pro"
                                        ? `$${userData.planCost || "50"}/month · Renews on ${userData.planExpiryDate ? new Date(userData.planExpiryDate.toDate()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}`
                                        : "Free plan with basic features"}
                                    </p>
                                  </div>
                                  <Button
                                    className={`bg-white border hover:bg-opacity-50 ${userData?.planType === "pro" ? "text-indigo-600 border-indigo-200 hover:bg-indigo-50" : "text-blue-600 border-blue-200 hover:bg-blue-50"}`}
                                    onClick={() =>
                                      (window.location.href = "/pricing")
                                    }
                                  >
                                    {userData?.planType === "plus"
                                      ? "Manage Plan"
                                      : "Upgrade to Plus"}
                                  </Button>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label className="text-sm text-gray-500">
                                  Usage this billing cycle
                                </Label>
                                <Progress
                                  value={userData?.planUsage || 0}
                                  className="h-2 bg-gray-100"
                                />
                                <div className="flex justify-between text-xs text-gray-500">
                                  <span>
                                    {userData?.currentMonthHours || 0} hours
                                    used
                                  </span>
                                  <span>
                                    {userData?.planType === "pro"
                                      ? userData?.planHours || "Unlimited"
                                      : "100"}{" "}
                                    hours included
                                  </span>
                                </div>
                              </div>
                            </motion.div>

                            <Separator />

                            {/* Payment Method */}
                            <motion.div
                              variants={itemVariants}
                              className="space-y-4"
                            >
                              <div className="flex justify-between items-center">
                                <h3 className="text-lg font-medium text-gray-800">
                                  Payment Method
                                </h3>
                                <Button variant="outline" size="sm">
                                  Add Payment Method
                                </Button>
                              </div>

                              <div className="rounded-lg border border-gray-200 p-4">
                                <div className="flex items-center justify-between">
                                  {userData?.paymentMethods &&
                                  userData.paymentMethods.length > 0 ? (
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-6 bg-gradient-to-r from-blue-600 to-blue-400 rounded"></div>
                                      <div>
                                        <p className="text-sm font-medium">
                                          {userData.paymentMethods[0]
                                            .maskedNumber ||
                                            "•••• •••• •••• ••••"}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {userData.paymentMethods[0].expiryDate
                                            ? `Expires ${userData.paymentMethods[0].expiryDate}`
                                            : "No expiry information"}
                                        </p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-sm text-gray-500">
                                      No payment method on file
                                    </div>
                                  )}
                                  <Badge>Default</Badge>
                                </div>
                              </div>
                            </motion.div>

                            <Separator />

                            {/* Billing History */}
                            <motion.div
                              variants={itemVariants}
                              className="space-y-4"
                            >
                              <div className="flex justify-between items-center">
                                <h3 className="text-lg font-medium text-gray-800">
                                  Billing History
                                </h3>
                                <Button variant="outline" size="sm">
                                  Download All
                                </Button>
                              </div>

                              <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                                {userData?.billingHistory &&
                                userData.billingHistory.length > 0 ? (
                                  userData.billingHistory.map((invoice, i) => (
                                    <div
                                      key={i}
                                      className="flex items-center justify-between p-4 hover:bg-gray-50"
                                    >
                                      <div className="flex items-center gap-3">
                                        <FileText className="h-5 w-5 text-gray-400" />
                                        <div>
                                          <p className="text-sm font-medium">
                                            Invoice #{invoice.id || `INV-${i}`}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            {invoice.date}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <span className="text-sm">
                                          {invoice.amount}
                                        </span>
                                        <Badge
                                          className={`${invoice.status === "Paid" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"} hover:bg-opacity-90`}
                                        >
                                          {invoice.status}
                                        </Badge>
                                        <Button variant="ghost" size="sm">
                                          <Download className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-8 text-center text-gray-500">
                                    <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                                    <p>No billing history available</p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}

                    {/* Teams & Permissions */}
                    {activeSection === "team" && (
                      <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="space-y-6"
                      >
                        <Card className="border-0 shadow-md">
                          <CardHeader>
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                              <div>
                                <CardTitle className="text-xl font-bold text-gray-800 flex items-center">
                                  <Users className="mr-2 h-5 w-5 text-indigo-500" />
                                  Teams & Permissions
                                </CardTitle>
                                <CardDescription>
                                  Manage team members and their access
                                  permissions
                                </CardDescription>
                              </div>
                              <Button
                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                onClick={() =>
                                  (window.location.href = "/team-members")
                                }
                              >
                                <Users className="mr-2 h-4 w-4" />
                                Manage Team Members
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            {/* Team Overview Card */}
                            <motion.div variants={itemVariants}>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Team Members */}
                                <div className="border border-gray-200 rounded-lg p-4">
                                  <div className="text-sm text-gray-500 mb-1">
                                    Team Members
                                  </div>
                                  <div className="text-2xl font-bold">
                                    {userData?.teamMembers?.count || 0}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {userData?.teamMembers?.pending
                                      ? `+${userData.teamMembers.pending} pending invitations`
                                      : "No pending invitations"}
                                  </div>
                                </div>

                                {/* Blueprints Shared */}
                                <div className="border border-gray-200 rounded-lg p-4">
                                  <div className="text-sm text-gray-500 mb-1">
                                    Blueprints Shared
                                  </div>
                                  <div className="text-2xl font-bold">
                                    {userData?.blueprintsShared?.count || 0}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {userData?.blueprintsShared?.sharedWith > 0
                                      ? `Across ${userData.blueprintsShared.sharedWith} team member${userData.blueprintsShared.sharedWith !== 1 ? "s" : ""}`
                                      : "Not shared yet"}
                                  </div>
                                </div>

                                {/* Roles */}
                                <div className="border border-gray-200 rounded-lg p-4">
                                  <div className="text-sm text-gray-500 mb-1">
                                    Roles
                                  </div>
                                  <div className="text-2xl font-bold">3</div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    Admin, Editor, Viewer
                                  </div>
                                </div>
                              </div>
                            </motion.div>

                            <Separator />

                            {/* Team Roles */}
                            <motion.div
                              variants={itemVariants}
                              className="space-y-4"
                            >
                              <div className="flex justify-between items-center">
                                <h3 className="text-lg font-medium text-gray-800">
                                  Team Roles
                                </h3>
                                <Button variant="outline" size="sm">
                                  Customize Roles
                                </Button>
                              </div>

                              <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                                {[
                                  {
                                    name: "Admin",
                                    description:
                                      "Full access to all blueprints and settings",
                                    permissions: [
                                      "Create/Delete Blueprints",
                                      "Invite Members",
                                      "Billing Access",
                                    ],
                                  },
                                  {
                                    name: "Editor",
                                    description:
                                      "Can edit blueprints but cannot access billing",
                                    permissions: [
                                      "Create/Edit Blueprints",
                                      "Limited Settings",
                                      "No Billing Access",
                                    ],
                                  },
                                  {
                                    name: "Viewer",
                                    description:
                                      "Read-only access to shared blueprints",
                                    permissions: [
                                      "View Blueprints",
                                      "No Edit Rights",
                                      "No Settings Access",
                                    ],
                                  },
                                ].map((role, i) => (
                                  <div key={i} className="p-4 hover:bg-gray-50">
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                      <div>
                                        <div className="flex items-center">
                                          <h4 className="text-base font-medium text-gray-900">
                                            {role.name}
                                          </h4>
                                          {role.name === "Admin" && (
                                            <Badge className="ml-2 bg-indigo-100 text-indigo-800">
                                              Your Role
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">
                                          {role.description}
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {role.permissions.map((perm, j) => (
                                          <span
                                            key={j}
                                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                                          >
                                            {perm}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>

                            <Separator />

                            {/* Default Access Levels */}
                            <motion.div
                              variants={itemVariants}
                              className="space-y-4"
                            >
                              <h3 className="text-lg font-medium text-gray-800">
                                Default Access Settings
                              </h3>

                              <div className="space-y-4">
                                <div className="rounded-lg border border-gray-200 p-4">
                                  <div className="flex items-center justify-between mb-4">
                                    <div>
                                      <h4 className="text-base font-medium text-gray-900">
                                        New Blueprint Visibility
                                      </h4>
                                      <p className="text-sm text-gray-500">
                                        Default sharing settings for new
                                        blueprints
                                      </p>
                                    </div>
                                    <Select defaultValue="private">
                                      <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Visibility" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="private">
                                          Private
                                        </SelectItem>
                                        <SelectItem value="team">
                                          Team
                                        </SelectItem>
                                        <SelectItem value="public">
                                          Public
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <div>
                                      <h4 className="text-base font-medium text-gray-900">
                                        New Team Member Role
                                      </h4>
                                      <p className="text-sm text-gray-500">
                                        Default role for new team members
                                      </p>
                                    </div>
                                    <Select defaultValue="viewer">
                                      <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Role" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="admin">
                                          Admin
                                        </SelectItem>
                                        <SelectItem value="editor">
                                          Editor
                                        </SelectItem>
                                        <SelectItem value="viewer">
                                          Viewer
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}

                    {/* API & Integrations Settings */}
                    {activeSection === "api" && (
                      <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="space-y-6"
                      >
                        <Card className="border-0 shadow-md">
                          <CardHeader>
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                              <div>
                                <CardTitle className="text-xl font-bold text-gray-800 flex items-center">
                                  <PlugZap className="mr-2 h-5 w-5 text-indigo-500" />
                                  API & Integrations
                                </CardTitle>
                                <CardDescription>
                                  Manage API keys and third-party integrations
                                </CardDescription>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    window.open(
                                      "https://docs.example.com/api",
                                      "_blank",
                                    )
                                  }
                                >
                                  <FileText className="mr-2 h-4 w-4" />
                                  API Documentation
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            {/* API Keys */}
                            <motion.div
                              variants={itemVariants}
                              className="space-y-4"
                            >
                              <div className="flex justify-between items-center">
                                <h3 className="text-lg font-medium text-gray-800">
                                  API Keys
                                </h3>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <Key className="mr-2 h-4 w-4" />
                                      Generate New Key
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        Generate New API Key
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        <div className="space-y-4">
                                          <p>
                                            API keys provide full access to your
                                            account. Keep them secure!
                                          </p>
                                          <div className="space-y-2">
                                            <Label htmlFor="keyName">
                                              Key Name
                                            </Label>
                                            <Input
                                              id="keyName"
                                              placeholder="e.g. Production API Key"
                                            />
                                          </div>
                                        </div>
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>
                                        Cancel
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-indigo-600 hover:bg-indigo-700"
                                        onClick={() =>
                                          handleGenerateApiKey("New API Key")
                                        }
                                      >
                                        Generate Key
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>

                              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                                <div className="flex items-start">
                                  <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" />
                                  <p>
                                    API keys provide full access to your
                                    account. Never share them publicly or in
                                    client-side code.
                                  </p>
                                </div>
                              </div>

                              <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                                {apiKeys.map((apiKey, i) => (
                                  <div key={i} className="p-4 hover:bg-gray-50">
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                      <div>
                                        <h4 className="text-base font-medium text-gray-900">
                                          {apiKey.name}
                                        </h4>
                                        <div className="mt-1 flex items-center">
                                          <code className="text-sm bg-gray-100 px-2 py-0.5 rounded font-mono">
                                            {apiKey.key.substring(0, 8)}
                                            ••••••••••••••
                                          </code>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 ml-2"
                                          >
                                            <Copy className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <div className="flex items-center">
                                          <Calendar className="h-4 w-4 mr-1" />
                                          <span>Created: {apiKey.created}</span>
                                        </div>
                                        <div className="flex items-center ml-4">
                                          <Clock className="h-4 w-4 mr-1" />
                                          <span>
                                            Last used: {apiKey.lastUsed}
                                          </span>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-4"
                                          onClick={() =>
                                            handleRevokeApiKey(apiKey.id)
                                          }
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>

                            <Separator />

                            {/* Integrations */}
                            <motion.div
                              variants={itemVariants}
                              className="space-y-4"
                            >
                              <h3 className="text-lg font-medium text-gray-800">
                                Integrations
                              </h3>

                              <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                                {integrations.map((integration, i) => (
                                  <div key={i} className="p-4 hover:bg-gray-50">
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                      <div className="flex items-center">
                                        <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center mr-3">
                                          <Webhook className="h-5 w-5 text-gray-500" />
                                        </div>
                                        <div>
                                          <h4 className="text-base font-medium text-gray-900">
                                            {integration.name}
                                          </h4>
                                          {integration.status ===
                                          "connected" ? (
                                            <p className="text-sm text-gray-500">
                                              Connected on{" "}
                                              {integration.connectedAt}
                                            </p>
                                          ) : (
                                            <p className="text-sm text-gray-500">
                                              Not connected
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      <div>
                                        {integration.status === "connected" ? (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                            onClick={() =>
                                              handleDisconnectIntegration(
                                                integration.id,
                                              )
                                            }
                                          >
                                            Disconnect
                                          </Button>
                                        ) : (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              handleConnectIntegration(
                                                integration.id,
                                              )
                                            }
                                          >
                                            Connect
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-6 text-center">
                                <p className="text-sm text-gray-500 mb-4">
                                  Looking for other integrations?
                                </p>
                                <Button variant="outline">
                                  Browse Integration Directory
                                </Button>
                              </div>
                            </motion.div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}

                    {/* Developer Settings */}
                    {activeSection === "developer" && (
                      <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="space-y-6"
                      >
                        <Card className="border-0 shadow-md">
                          <CardHeader>
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                              <div>
                                <CardTitle className="text-xl font-bold text-gray-800 flex items-center">
                                  <Code className="mr-2 h-5 w-5 text-indigo-500" />
                                  Developer Settings
                                </CardTitle>
                                <CardDescription>
                                  Advanced settings for developers
                                </CardDescription>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    window.open(
                                      "https://docs.example.com",
                                      "_blank",
                                    )
                                  }
                                >
                                  <FileText className="mr-2 h-4 w-4" />
                                  Documentation
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            {/* Webhook Settings */}
                            <motion.div
                              variants={itemVariants}
                              className="space-y-4"
                            >
                              <div className="flex justify-between items-center">
                                <h3 className="text-lg font-medium text-gray-800">
                                  Webhooks
                                </h3>
                                <Button variant="outline" size="sm">
                                  <Webhook className="mr-2 h-4 w-4" />
                                  Add Webhook
                                </Button>
                              </div>

                              <div className="rounded-lg border border-gray-200 p-4">
                                <div className="text-center py-6">
                                  <Terminal className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                                  <h4 className="text-base font-medium text-gray-900">
                                    No webhooks configured
                                  </h4>
                                  <p className="text-sm text-gray-500 mt-1 mb-4 max-w-md mx-auto">
                                    Webhooks allow you to receive real-time HTTP
                                    notifications when certain events occur in
                                    your account.
                                  </p>
                                  <Button variant="outline">
                                    <Webhook className="mr-2 h-4 w-4" />
                                    Configure Webhook
                                  </Button>
                                </div>
                              </div>
                            </motion.div>

                            <Separator />

                            {/* Environment Settings */}
                            <motion.div
                              variants={itemVariants}
                              className="space-y-4"
                            >
                              <h3 className="text-lg font-medium text-gray-800">
                                Environment
                              </h3>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="rounded-lg border border-gray-200 p-4">
                                  <h4 className="text-base font-medium text-gray-900 mb-3">
                                    Development Mode
                                  </h4>
                                  <p className="text-sm text-gray-500 mb-4">
                                    Enable development mode to access additional
                                    debugging tools and features.
                                  </p>
                                  <div className="flex items-center space-x-2">
                                    <Switch id="devMode" />
                                    <Label htmlFor="devMode">
                                      Enable Dev Mode
                                    </Label>
                                  </div>
                                </div>

                                <div className="rounded-lg border border-gray-200 p-4">
                                  <h4 className="text-base font-medium text-gray-900 mb-3">
                                    Sandbox Environment
                                  </h4>
                                  <p className="text-sm text-gray-500 mb-4">
                                    Test features in a sandbox environment
                                    without affecting production data.
                                  </p>
                                  <Select defaultValue="production">
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select environment" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="production">
                                        Production
                                      </SelectItem>
                                      <SelectItem value="sandbox">
                                        Sandbox
                                      </SelectItem>
                                      <SelectItem value="development">
                                        Development
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </motion.div>

                            <Separator />

                            {/* Debug Logs */}
                            <motion.div
                              variants={itemVariants}
                              className="space-y-4"
                            >
                              <div className="flex justify-between items-center">
                                <h3 className="text-lg font-medium text-gray-800">
                                  Debug Logs
                                </h3>
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm">
                                    Download Logs
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                  >
                                    Clear Logs
                                  </Button>
                                </div>
                              </div>

                              <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                                <div className="font-mono text-xs text-gray-600 h-48 overflow-y-auto p-2">
                                  <div className="text-green-600">
                                    [2024-10-25 15:42:23] INFO: Application
                                    started
                                  </div>
                                  <div className="text-gray-600">
                                    [2024-10-25 15:42:24] DEBUG: Loading user
                                    configuration
                                  </div>
                                  <div className="text-gray-600">
                                    [2024-10-25 15:42:25] DEBUG: User
                                    authenticated
                                  </div>
                                  <div className="text-blue-600">
                                    [2024-10-25 15:42:26] NOTICE: Blueprint
                                    loaded successfully
                                  </div>
                                  <div className="text-yellow-600">
                                    [2024-10-25 15:42:30] WARNING: Slow response
                                    time detected
                                  </div>
                                  <div className="text-gray-600">
                                    [2024-10-25 15:42:35] DEBUG: API request
                                    processed
                                  </div>
                                  <div className="text-gray-600">
                                    [2024-10-25 15:43:01] DEBUG: Data saved to
                                    database
                                  </div>
                                  <div className="text-blue-600">
                                    [2024-10-25 15:43:15] NOTICE: New blueprint
                                    created
                                  </div>
                                  <div className="text-gray-600">
                                    [2024-10-25 15:44:22] DEBUG: Cache refreshed
                                  </div>
                                  <div className="text-gray-600">
                                    [2024-10-25 15:45:07] DEBUG: Session
                                    extended
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between">
                                <div className="text-sm font-medium text-gray-800">
                                  Log Level
                                </div>
                                <Select defaultValue="info">
                                  <SelectTrigger className="w-40">
                                    <SelectValue placeholder="Select log level" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="debug">Debug</SelectItem>
                                    <SelectItem value="info">Info</SelectItem>
                                    <SelectItem value="warning">
                                      Warning
                                    </SelectItem>
                                    <SelectItem value="error">Error</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </motion.div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
