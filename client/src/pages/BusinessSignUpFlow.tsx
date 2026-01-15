// BusinessSignUpFlow — Multi-step business signup with context gathering
// Based on SIGNUP_ONBOARDING_SPEC.md
//
// 3-step flow:
// Step 1: Account Basics (organization name, email, password, OAuth)
// Step 2: Business Context (name, title, phone, primary need, company size)
// Step 3: Project Details (description, volume, referral source)

"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Mail,
  Lock,
  Building2,
  User,
  Phone,
  Briefcase,
  ArrowRight,
  ChevronLeft,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  Target,
  Users,
  FileText,
  BarChart3,
  Search,
} from "lucide-react";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, signInWithGoogle } from "@/lib/firebase";
import type { UserData } from "@/lib/firebase";

// Primary need options
const PRIMARY_NEED_OPTIONS = [
  { value: "training-data", label: "Training data for AI models" },
  { value: "labeling", label: "Data labeling & annotation" },
  { value: "rlhf", label: "RLHF & preference data" },
  { value: "collection", label: "Custom data collection" },
  { value: "marketplace", label: "Dataset marketplace access" },
  { value: "other", label: "Other" },
] as const;

// Company size options
const COMPANY_SIZE_OPTIONS = [
  { value: "1-10", label: "1-10" },
  { value: "11-50", label: "11-50" },
  { value: "51-200", label: "51-200" },
  { value: "201-1000", label: "201-1000" },
  { value: "1000+", label: "1000+" },
] as const;

// Expected volume options
const EXPECTED_VOLUME_OPTIONS = [
  { value: "exploring", label: "Just exploring" },
  { value: "small", label: "Small (< 1,000 annotations)" },
  { value: "medium", label: "Medium (1K - 10K)" },
  { value: "large", label: "Large (10K - 100K)" },
  { value: "enterprise", label: "Enterprise (100K+)" },
] as const;

// Referral source options
const REFERRAL_SOURCE_OPTIONS = [
  { value: "google", label: "Search (Google, etc.)" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitter", label: "Twitter/X" },
  { value: "referral", label: "Referral" },
  { value: "event", label: "Event/Conference" },
  { value: "other", label: "Other" },
] as const;

type PrimaryNeed = typeof PRIMARY_NEED_OPTIONS[number]["value"];
type CompanySize = typeof COMPANY_SIZE_OPTIONS[number]["value"];
type ExpectedVolume = typeof EXPECTED_VOLUME_OPTIONS[number]["value"];
type ReferralSource = typeof REFERRAL_SOURCE_OPTIONS[number]["value"];

// Step indicator component
function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((stepNum) => (
        <React.Fragment key={stepNum}>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
              stepNum < currentStep
                ? "bg-emerald-500 text-white"
                : stepNum === currentStep
                ? "bg-emerald-500 text-white ring-4 ring-emerald-500/20"
                : "bg-zinc-100 text-zinc-400"
            }`}
          >
            {stepNum < currentStep ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              stepNum
            )}
          </div>
          {stepNum < totalSteps && (
            <div
              className={`flex-1 h-0.5 ${
                stepNum < currentStep ? "bg-emerald-500" : "bg-zinc-200"
              }`}
            />
          )}
        </React.Fragment>
      ))}
      <span className="ml-2 text-sm text-zinc-500">
        Step {currentStep} of {totalSteps}
      </span>
    </div>
  );
}

// Validation helpers
function isValidEmail(val: string) {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(val);
}

function isValidPhone(phone: string) {
  if (!phone) return true; // Optional field
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10;
}

export default function BusinessSignUpFlow() {
  const [, setLocation] = useLocation();

  // Step machine
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 1: Account Basics
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2: Business Context
  const [contactName, setContactName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [primaryNeeds, setPrimaryNeeds] = useState<PrimaryNeed[]>([]);
  const [companySize, setCompanySize] = useState<CompanySize | "">("");

  // Step 3: Project Details
  const [projectDescription, setProjectDescription] = useState("");
  const [expectedVolume, setExpectedVolume] = useState<ExpectedVolume | "">("");
  const [referralSource, setReferralSource] = useState<ReferralSource | "">("");

  // Step validations
  const step1Valid =
    organizationName.trim() !== "" &&
    isValidEmail(email) &&
    password.length >= 8 &&
    password === confirmPassword;

  const step2Valid =
    contactName.trim() !== "" &&
    isValidPhone(phoneNumber) &&
    primaryNeeds.length > 0 &&
    companySize !== "";

  const step3Valid =
    expectedVolume !== "" &&
    referralSource !== "";

  const handleNext = useCallback(() => {
    setErrorMessage("");
    if (step === 1 && !step1Valid) {
      if (!organizationName.trim()) {
        setErrorMessage("Please enter your organization name.");
      } else if (!isValidEmail(email)) {
        setErrorMessage("Please enter a valid email address.");
      } else if (password.length < 8) {
        setErrorMessage("Password must be at least 8 characters.");
      } else if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match.");
      }
      return;
    }
    if (step === 2 && !step2Valid) {
      if (!contactName.trim()) {
        setErrorMessage("Please enter your name.");
      } else if (!isValidPhone(phoneNumber)) {
        setErrorMessage("Please enter a valid phone number.");
      } else if (primaryNeeds.length === 0) {
        setErrorMessage("Please select at least one primary need.");
      } else if (!companySize) {
        setErrorMessage("Please select your company size.");
      }
      return;
    }
    setStep((s) => Math.min(s + 1, 3));
  }, [step, step1Valid, step2Valid, organizationName, email, password, confirmPassword, contactName, phoneNumber, primaryNeeds, companySize]);

  const handleBack = useCallback(() => {
    setErrorMessage("");
    setStep((s) => Math.max(s - 1, 1));
  }, []);

  const handleGoogleSignUp = useCallback(async () => {
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const user = await signInWithGoogle();

      // Pre-fill name from Google profile
      if (user.displayName) {
        setContactName(user.displayName);
      }
      if (user.email) {
        setEmail(user.email);
      }

      // For Google OAuth, we skip password but still need org name
      // Store the user for later completion
      sessionStorage.setItem("googleAuthUser", JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      }));

      // Move to step 2 for business context
      setStep(2);
    } catch (error: any) {
      console.error("Google sign up error:", error);
      setErrorMessage(error.message || "Failed to sign up with Google. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!step3Valid) {
      if (!expectedVolume) {
        setErrorMessage("Please select your expected volume.");
      } else if (!referralSource) {
        setErrorMessage("Please tell us how you heard about us.");
      }
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const auth = getAuth();
      let uid: string;
      let userEmail: string;
      let displayName: string = contactName;
      let photoURL: string = "";

      // Check if we have a Google auth user stored
      const googleAuthUserStr = sessionStorage.getItem("googleAuthUser");
      if (googleAuthUserStr) {
        const googleAuthUser = JSON.parse(googleAuthUserStr);
        uid = googleAuthUser.uid;
        userEmail = googleAuthUser.email;
        displayName = googleAuthUser.displayName || contactName;
        photoURL = googleAuthUser.photoURL || "";
        sessionStorage.removeItem("googleAuthUser");
      } else {
        // Create Firebase user with email/password
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        uid = userCredential.user.uid;
        userEmail = email;
      }

      const username = contactName.toLowerCase().replace(/\s+/g, "_");
      const timestamp = serverTimestamp();

      // Create comprehensive user document with all signup data
      const newUserData: Partial<UserData> & { createdDate: any; lastLoginAt: any; lastSessionDate: any } = {
        uid,
        email: userEmail,
        name: contactName,
        displayName,
        photoURL,
        username,
        organizationName,
        jobTitle: jobTitle || undefined,
        phoneNumber: phoneNumber || undefined,
        deviceToken: "",
        referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        createdDate: timestamp as any,
        lastLoginAt: timestamp as any,
        lastSessionDate: timestamp as any,
        numSessions: 1,
        uploadedContentCount: 0,
        collectedContentCount: 0,
        planType: "free",
        credits: 0,
        finishedOnboarding: false,
        hasEnteredNotes: false,
        hasEnteredInventory: false,
        hasEnteredCameraRoll: false,
        amountEarned: 0,
        connectedBlueprintIds: [],
        createdBlueprintIds: [],
        collectedObjectIds: [],
        collectedPortalIds: [],
        uploadedFileIds: [],
        createdPhotoIds: [],
        createdNoteIds: [],
        createdReportIds: [],
        createdSuggestionIds: [],
        createdContentIds: [],
        modelInteractions: {},
        blueprintInteractions: {},
        portalInteractions: {},
        categoryPreferences: {},
        averageSessionDuration: 0,
        peakUsageHours: [],
        featureUsageCount: {},
        mostUsedFeatures: [],
        collaborationScore: 0,
        sharedContentCount: 0,
        preferredModelScales: [],
        preferredRoomTypes: [],
        preferredColors: [],
        dailyActiveStreak: 1,
        weeklyEngagementScore: 0,
        completedTutorials: [],
        skillLevels: {},
        mostFrequentLocation: "",
        deviceTypes: [],
        billingHistory: [],
        paymentMethods: [],

        // Business signup fields
        primaryNeeds: primaryNeeds as PrimaryNeed[],
        companySize: companySize as CompanySize,
        projectDescription: projectDescription || undefined,
        expectedVolume: expectedVolume as ExpectedVolume,
        referralSource: referralSource as ReferralSource,

        // Onboarding state
        onboardingStep: "welcome",
        onboardingProgress: {
          profileComplete: true,
          exploreMarketplace: false,
          createFirstOrder: false,
          inviteTeam: false,
        },

        // Personalization metadata
        recommendedCategories: [],
        personalizedWelcomeShown: false,
      };

      // Write to Firestore
      await setDoc(doc(db, "users", uid), newUserData);

      console.log("[BusinessSignUp] User created successfully:", uid);

      // Redirect to onboarding
      setLocation("/onboarding");
    } catch (error: any) {
      console.error("Signup error:", error);
      if (error.code === "auth/email-already-in-use") {
        setErrorMessage("An account with this email already exists. Please sign in instead.");
      } else if (error.code === "auth/weak-password") {
        setErrorMessage("Password is too weak. Please use a stronger password.");
      } else {
        setErrorMessage(error.message || "Failed to create account. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    step3Valid,
    expectedVolume,
    referralSource,
    email,
    password,
    organizationName,
    contactName,
    jobTitle,
    phoneNumber,
    primaryNeeds,
    companySize,
    projectDescription,
    setLocation,
  ]);

  // Animation variants
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 100 : -100,
      opacity: 0,
    }),
  };

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white py-12 px-4">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-zinc-900">
              Welcome to Blueprint
            </h1>
            <p className="text-zinc-600 mt-2">
              Create your business account
            </p>
          </div>

          {/* Step Indicator */}
          <StepIndicator currentStep={step} totalSteps={3} />

          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
            <AnimatePresence mode="wait" custom={step}>
              {/* Step 1: Account Basics */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  custom={1}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="text-lg font-medium text-zinc-900 mb-4">
                    Account Basics
                  </h2>

                  <div className="space-y-4">
                    {/* Organization Name */}
                    <div>
                      <Label htmlFor="organizationName" className="text-sm font-medium text-zinc-700">
                        Organization Name <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative mt-1">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                          id="organizationName"
                          type="text"
                          placeholder="Acme Corp"
                          value={organizationName}
                          onChange={(e) => setOrganizationName(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {/* Work Email */}
                    <div>
                      <Label htmlFor="email" className="text-sm font-medium text-zinc-700">
                        Work Email <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative mt-1">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <Label htmlFor="password" className="text-sm font-medium text-zinc-700">
                        Password <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative mt-1">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Min. 8 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {password && password.length < 8 && (
                        <p className="text-xs text-amber-600 mt-1">
                          Password must be at least 8 characters
                        </p>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <Label htmlFor="confirmPassword" className="text-sm font-medium text-zinc-700">
                        Confirm Password <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative mt-1">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm your password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-10 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {confirmPassword && password !== confirmPassword && (
                        <p className="text-xs text-red-500 mt-1">
                          Passwords do not match
                        </p>
                      )}
                    </div>
                  </div>

                  {/* OAuth Divider */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-zinc-200" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-zinc-500">Or sign up with</span>
                    </div>
                  </div>

                  {/* Google OAuth */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGoogleSignUp}
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </Button>

                  {/* Continue Button */}
                  <Button
                    onClick={handleNext}
                    disabled={!step1Valid}
                    className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 text-white"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>

                  {/* Sign In Link */}
                  <p className="text-center text-sm text-zinc-500 mt-4">
                    Already have an account?{" "}
                    <a href="/login" className="text-emerald-600 hover:text-emerald-700 font-medium">
                      Sign in
                    </a>
                  </p>
                </motion.div>
              )}

              {/* Step 2: Business Context */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  custom={1}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="text-lg font-medium text-zinc-900 mb-4">
                    Tell us about your business
                  </h2>

                  <div className="space-y-4">
                    {/* Your Name */}
                    <div>
                      <Label htmlFor="contactName" className="text-sm font-medium text-zinc-700">
                        Your Name <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative mt-1">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                          id="contactName"
                          type="text"
                          placeholder="John Smith"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {/* Job Title */}
                    <div>
                      <Label htmlFor="jobTitle" className="text-sm font-medium text-zinc-700">
                        Job Title
                      </Label>
                      <div className="relative mt-1">
                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                          id="jobTitle"
                          type="text"
                          placeholder="ML Engineer"
                          value={jobTitle}
                          onChange={(e) => setJobTitle(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {/* Phone Number */}
                    <div>
                      <Label htmlFor="phoneNumber" className="text-sm font-medium text-zinc-700">
                        Phone Number
                      </Label>
                      <div className="relative mt-1">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                          id="phoneNumber"
                          type="tel"
                          placeholder="(555) 123-4567"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {/* Primary Need - Multi-choice */}
                    <div>
                      <Label className="text-sm font-medium text-zinc-700 mb-2 block">
                        What are your primary needs? <span className="text-red-500">*</span>
                      </Label>
                      <div className="space-y-2">
                        {PRIMARY_NEED_OPTIONS.map((option) => (
                          <div key={option.value} className="flex items-center gap-3">
                            <Checkbox
                              id={`need-${option.value}`}
                              checked={primaryNeeds.includes(option.value)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setPrimaryNeeds([...primaryNeeds, option.value]);
                                } else {
                                  setPrimaryNeeds(primaryNeeds.filter((n) => n !== option.value));
                                }
                              }}
                              className="h-4 w-4"
                            />
                            <Label
                              htmlFor={`need-${option.value}`}
                              className="font-normal cursor-pointer text-sm text-zinc-700"
                            >
                              {option.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Company Size */}
                    <div>
                      <Label className="text-sm font-medium text-zinc-700 mb-2 block">
                        Company size <span className="text-red-500">*</span>
                      </Label>
                      <RadioGroup
                        value={companySize}
                        onValueChange={(v) => setCompanySize(v as CompanySize)}
                        className="flex flex-wrap gap-2"
                      >
                        {COMPANY_SIZE_OPTIONS.map((option) => (
                          <div key={option.value} className="flex items-center">
                            <RadioGroupItem
                              value={option.value}
                              id={`size-${option.value}`}
                              className="peer sr-only"
                            />
                            <Label
                              htmlFor={`size-${option.value}`}
                              className="px-3 py-2 rounded-lg border border-zinc-200 text-sm cursor-pointer transition-all peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-50 peer-data-[state=checked]:text-emerald-700 hover:border-zinc-300"
                            >
                              {option.label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  </div>

                  {/* Navigation */}
                  <div className="flex gap-3 mt-6">
                    <Button
                      variant="outline"
                      onClick={handleBack}
                      className="flex-1"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Back
                    </Button>
                    <Button
                      onClick={handleNext}
                      disabled={!step2Valid}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                    >
                      Continue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Project Details */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  custom={1}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="text-lg font-medium text-zinc-900 mb-4">
                    Help us personalize your experience
                  </h2>

                  <div className="space-y-4">
                    {/* Project Description */}
                    <div>
                      <Label htmlFor="projectDescription" className="text-sm font-medium text-zinc-700">
                        What brings you to Blueprint?
                      </Label>
                      <div className="relative mt-1">
                        <FileText className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                        <Textarea
                          id="projectDescription"
                          placeholder="Tell us about your project or use case..."
                          value={projectDescription}
                          onChange={(e) => setProjectDescription(e.target.value)}
                          className="pl-10 min-h-[80px] resize-none"
                          rows={3}
                        />
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">
                        Optional, but helps us show you relevant datasets
                      </p>
                    </div>

                    {/* Expected Volume */}
                    <div>
                      <Label htmlFor="expectedVolume" className="text-sm font-medium text-zinc-700">
                        Expected monthly volume <span className="text-red-500">*</span>
                      </Label>
                      <Select value={expectedVolume} onValueChange={(v) => setExpectedVolume(v as ExpectedVolume)}>
                        <SelectTrigger className="mt-1">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-zinc-400" />
                            <SelectValue placeholder="Select expected volume" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {EXPECTED_VOLUME_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Referral Source */}
                    <div>
                      <Label htmlFor="referralSource" className="text-sm font-medium text-zinc-700">
                        How did you hear about us? <span className="text-red-500">*</span>
                      </Label>
                      <Select value={referralSource} onValueChange={(v) => setReferralSource(v as ReferralSource)}>
                        <SelectTrigger className="mt-1">
                          <div className="flex items-center gap-2">
                            <Search className="h-4 w-4 text-zinc-400" />
                            <SelectValue placeholder="Select how you found us" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {REFERRAL_SOURCE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Navigation */}
                  <div className="flex gap-3 mt-6">
                    <Button
                      variant="outline"
                      onClick={handleBack}
                      className="flex-1"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Back
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={!step3Valid || isSubmitting}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        <>
                          Complete Signup
                          <CheckCircle2 className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Message */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
              >
                {errorMessage}
              </motion.div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
