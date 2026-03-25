"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronLeft,
  Lock,
  Mail,
  MapPin,
  Route,
  Shield,
  Target,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { UserData } from "@/lib/firebase";
import {
  REQUESTED_LANE_DESCRIPTIONS,
  REQUESTED_LANE_LABELS,
  REQUESTED_LANES as SHARED_REQUESTED_LANES,
} from "@/lib/requestTaxonomy";

type RequestedLane = (typeof SHARED_REQUESTED_LANES)[number];

const REQUESTED_LANES: Array<{
  value: RequestedLane;
  label: string;
  description: string;
}> = SHARED_REQUESTED_LANES.map((value) => ({
  value,
  label: REQUESTED_LANE_LABELS[value],
  description: REQUESTED_LANE_DESCRIPTIONS[value],
}));

const BUYER_TYPES = [
  {
    value: "site_operator",
    label: "Site operator",
    description: "I own the site, workflow, or deployment decision.",
  },
  {
    value: "robot_team",
    label: "Robot team",
    description: "I already have a target site and need a cleaner qualification read.",
  },
] as const;

const COMPANY_SIZE_OPTIONS = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;
const BUDGET_RANGE_OPTIONS = [
  "<$50K",
  "$50K-$300K",
  "$300K-$1M",
  ">$1M",
  "Undecided/Unsure",
] as const;
const REFERRAL_SOURCE_OPTIONS = [
  { value: "google", label: "Search" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitter", label: "Twitter/X" },
  { value: "referral", label: "Referral" },
  { value: "event", label: "Event" },
  { value: "other", label: "Other" },
] as const;

type BuyerType = typeof BUYER_TYPES[number]["value"];
type CompanySize = typeof COMPANY_SIZE_OPTIONS[number];
type BudgetRange = typeof BUDGET_RANGE_OPTIONS[number];
type ReferralSource = typeof REFERRAL_SOURCE_OPTIONS[number]["value"];
type LegacyPrimaryNeed =
  | "benchmark-packs"
  | "scene-library"
  | "dataset-packs"
  | "custom-capture"
  | "other";

const LEGACY_PRIMARY_NEED_BY_LANE: Record<RequestedLane, LegacyPrimaryNeed> = {
  qualification: "benchmark-packs",
  preview_simulation: "scene-library",
  deeper_evaluation: "dataset-packs",
  managed_tuning: "scene-library",
  data_licensing: "dataset-packs",
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  if (!value.trim()) return true;
  return value.replace(/\D/g, "").length >= 10;
}

function StepIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div className="mb-6 flex items-center gap-2">
      {Array.from({ length: totalSteps }, (_, index) => index + 1).map((stepNumber) => (
        <React.Fragment key={stepNumber}>
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              stepNumber < currentStep
                ? "bg-emerald-500 text-white"
                : stepNumber === currentStep
                ? "bg-emerald-500 text-white ring-4 ring-emerald-500/15"
                : "bg-zinc-100 text-zinc-400"
            }`}
          >
            {stepNumber < currentStep ? <CheckCircle2 className="h-4 w-4" /> : stepNumber}
          </div>
          {stepNumber < totalSteps ? (
            <div
              className={`h-0.5 flex-1 ${
                stepNumber < currentStep ? "bg-emerald-500" : "bg-zinc-200"
              }`}
            />
          ) : null}
        </React.Fragment>
      ))}
      <span className="ml-2 text-sm text-zinc-500">
        Step {currentStep} of {totalSteps}
      </span>
    </div>
  );
}

export default function BusinessSignUpFlow() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [contactName, setContactName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [buyerType, setBuyerType] = useState<BuyerType>("site_operator");
  const [requestedLanes, setRequestedLanes] = useState<RequestedLane[]>(["qualification"]);
  const [companySize, setCompanySize] = useState<CompanySize | "">("");

  const [siteName, setSiteName] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [taskStatement, setTaskStatement] = useState("");
  const [workflowContext, setWorkflowContext] = useState("");
  const [operatingConstraints, setOperatingConstraints] = useState("");
  const [privacySecurityConstraints, setPrivacySecurityConstraints] = useState("");
  const [knownBlockers, setKnownBlockers] = useState("");
  const [targetRobotTeam, setTargetRobotTeam] = useState("");
  const [budgetRange, setBudgetRange] = useState<BudgetRange | "">("");
  const [referralSource, setReferralSource] = useState<ReferralSource | "">("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("role") === "capturer") {
      setLocation("/capture-app");
    }
  }, [setLocation]);

  const step1Valid = useMemo(
    () =>
      organizationName.trim().length > 0 &&
      isValidEmail(email) &&
      password.length >= 8 &&
      password === confirmPassword,
    [organizationName, email, password, confirmPassword]
  );

  const step2Valid = useMemo(
    () =>
      contactName.trim().length > 0 &&
      isValidPhone(phoneNumber) &&
      requestedLanes.length > 0 &&
      companySize !== "",
    [contactName, phoneNumber, requestedLanes, companySize]
  );

  const step3Valid = useMemo(
    () =>
      siteName.trim().length > 0 &&
      siteLocation.trim().length > 0 &&
      taskStatement.trim().length > 0 &&
      budgetRange !== "" &&
      referralSource !== "",
    [siteName, siteLocation, taskStatement, budgetRange, referralSource]
  );

  const handleNext = useCallback(() => {
    setErrorMessage("");

    if (step === 1 && !step1Valid) {
      if (!organizationName.trim()) setErrorMessage("Please enter your organization name.");
      else if (!isValidEmail(email)) setErrorMessage("Please enter a valid work email.");
      else if (password.length < 8) setErrorMessage("Password must be at least 8 characters.");
      else setErrorMessage("Passwords do not match.");
      return;
    }

    if (step === 2 && !step2Valid) {
      if (!contactName.trim()) setErrorMessage("Please enter your name.");
      else if (!isValidPhone(phoneNumber)) setErrorMessage("Please enter a valid phone number.");
      else if (requestedLanes.length === 0) setErrorMessage("Select at least one next step.");
      else setErrorMessage("Please select your company size.");
      return;
    }

    setStep((current) => Math.min(current + 1, 3));
  }, [step, step1Valid, step2Valid, organizationName, email, password, contactName, phoneNumber, requestedLanes]);

  const handleBack = useCallback(() => {
    setErrorMessage("");
    setStep((current) => Math.max(current - 1, 1));
  }, []);

  const toggleLane = useCallback((value: RequestedLane) => {
    setRequestedLanes((current) =>
      current.includes(value) ? current.filter((lane) => lane !== value) : [...current, value]
    );
  }, []);

  const handleGoogleSignUp = useCallback(async () => {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const { signInWithGoogle } = await import("@/lib/firebase");
      const user = await signInWithGoogle();

      sessionStorage.setItem(
        "googleAuthUser",
        JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        })
      );

      if (user.displayName) setContactName(user.displayName);
      if (user.email) setEmail(user.email);

      setStep(2);
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to sign up with Google.");
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!step3Valid) {
      if (!siteName.trim()) setErrorMessage("Please enter the site name.");
      else if (!siteLocation.trim()) setErrorMessage("Please enter the site location.");
      else if (!taskStatement.trim()) setErrorMessage("Please enter the task statement.");
      else if (!budgetRange) setErrorMessage("Please select a budget range.");
      else setErrorMessage("Please tell us how you heard about Blueprint.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const auth = getAuth();
      const { db } = await import("@/lib/firebase");
      const timestamp = serverTimestamp();

      let uid: string;
      let userEmail: string;
      let displayName = contactName;
      let photoURL = "";

      const googleAuthUser = sessionStorage.getItem("googleAuthUser");
      if (googleAuthUser) {
        const parsed = JSON.parse(googleAuthUser);
        uid = parsed.uid;
        userEmail = parsed.email;
        displayName = parsed.displayName || contactName;
        photoURL = parsed.photoURL || "";
        sessionStorage.removeItem("googleAuthUser");
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        uid = userCredential.user.uid;
        userEmail = email;
      }

      const primaryNeeds = requestedLanes.map((lane) => LEGACY_PRIMARY_NEED_BY_LANE[lane]);
      const username = contactName.toLowerCase().replace(/\s+/g, "_");

      const newUserData: any = {
        uid,
        email: userEmail,
        name: contactName,
        displayName,
        photoURL,
        username,
        organizationName,
        jobTitle: jobTitle || undefined,
        phoneNumber: phoneNumber || undefined,
        buyerType,
        requestedLanes,
        siteName,
        siteLocation,
        taskStatement,
        workflowContext: workflowContext || undefined,
        operatingConstraints: operatingConstraints || undefined,
        privacySecurityConstraints: privacySecurityConstraints || undefined,
        knownBlockers: knownBlockers || undefined,
        targetRobotTeam: targetRobotTeam || undefined,
        primaryNeeds,
        companySize: companySize as CompanySize,
        projectDescription: workflowContext || undefined,
        budgetRange: budgetRange as BudgetRange,
        referralSource: referralSource as ReferralSource,
        createdDate: timestamp,
        lastLoginAt: timestamp,
        lastSessionDate: timestamp,
        numSessions: 1,
        uploadedContentCount: 0,
        collectedContentCount: 0,
        planType: "free",
        credits: 0,
        finishedOnboarding: false,
        onboardingStep: "welcome",
        onboardingProgress: {
          profileComplete: true,
          defineSiteSubmission: true,
          completeIntakeReview: false,
          reviewQualifiedOpportunities: false,
          inviteTeam: false,
        },
        deviceToken: "",
        referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
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
      };

      await setDoc(doc(db, "users", uid), newUserData);
      setLocation("/onboarding");
    } catch (error: any) {
      if (error.code === "auth/email-already-in-use") {
        setErrorMessage("An account with this email already exists.");
      } else {
        setErrorMessage(error.message || "Failed to create account.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    budgetRange,
    buyerType,
    companySize,
    contactName,
    email,
    jobTitle,
    knownBlockers,
    operatingConstraints,
    organizationName,
    password,
    phoneNumber,
    privacySecurityConstraints,
    referralSource,
    requestedLanes,
    setLocation,
    siteLocation,
    siteName,
    step3Valid,
    targetRobotTeam,
    taskStatement,
    workflowContext,
  ]);

  const slideVariants = {
    enter: { opacity: 0, x: 36 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -36 },
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">Create your Blueprint account</h1>
          <p className="mt-2 text-zinc-600">
            Start with a site submission, not a marketplace browse.
          </p>
        </div>

        <StepIndicator currentStep={step} totalSteps={3} />

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step-1"
                initial="enter"
                animate="center"
                exit="exit"
                variants={slideVariants}
                transition={{ duration: 0.2 }}
              >
                <h2 className="mb-4 text-lg font-medium text-zinc-900">Account basics</h2>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="organizationName">Organization name</Label>
                    <div className="relative mt-1">
                      <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        id="organizationName"
                        className="pl-10"
                        placeholder="Acme Operations"
                        value={organizationName}
                        onChange={(event) => setOrganizationName(event.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email">Work email</Label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        id="email"
                        type="email"
                        className="pl-10"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        className="pl-10"
                        placeholder="At least 8 characters"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="mt-2 text-sm text-zinc-500 hover:text-zinc-700"
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? "Hide password" : "Show password"}
                    </button>
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">Confirm password</Label>
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      className="mt-1"
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-sm text-zinc-600">
                      Prefer Google? Authenticate now, then finish the intake details on the next
                      step.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3"
                      onClick={handleGoogleSignUp}
                      disabled={isSubmitting}
                    >
                      Continue with Google
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : null}

            {step === 2 ? (
              <motion.div
                key="step-2"
                initial="enter"
                animate="center"
                exit="exit"
                variants={slideVariants}
                transition={{ duration: 0.2 }}
              >
                <h2 className="mb-4 text-lg font-medium text-zinc-900">Who is submitting and why</h2>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="contactName">Your name</Label>
                    <div className="relative mt-1">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        id="contactName"
                        className="pl-10"
                        placeholder="Ada Lovelace"
                        value={contactName}
                        onChange={(event) => setContactName(event.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="jobTitle">Title</Label>
                    <Input
                      id="jobTitle"
                      className="mt-1"
                      placeholder="Operations Lead"
                      value={jobTitle}
                      onChange={(event) => setJobTitle(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phoneNumber">Phone</Label>
                    <Input
                      id="phoneNumber"
                      className="mt-1"
                      placeholder="(555) 555-5555"
                      value={phoneNumber}
                      onChange={(event) => setPhoneNumber(event.target.value)}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Buyer type</Label>
                    <RadioGroup value={buyerType} onValueChange={(value) => setBuyerType(value as BuyerType)}>
                      {BUYER_TYPES.map((option) => (
                        <label
                          key={option.value}
                          className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-4"
                        >
                          <RadioGroupItem value={option.value} />
                          <div>
                            <div className="font-medium text-zinc-900">{option.label}</div>
                            <p className="text-sm text-zinc-500">{option.description}</p>
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="space-y-3">
                    <Label>What do you need first?</Label>
                    {REQUESTED_LANES.map((lane) => (
                      <label
                        key={lane.value}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-4"
                      >
                        <Checkbox
                          checked={requestedLanes.includes(lane.value)}
                          onCheckedChange={() => toggleLane(lane.value)}
                        />
                        <div>
                          <div className="font-medium text-zinc-900">{lane.label}</div>
                          <p className="text-sm text-zinc-500">{lane.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div>
                    <Label htmlFor="companySize">Company size</Label>
                    <select
                      id="companySize"
                      className="mt-1 flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"
                      value={companySize}
                      onChange={(event) => setCompanySize(event.target.value as CompanySize)}
                    >
                      <option value="">Select company size</option>
                      {COMPANY_SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            ) : null}

            {step === 3 ? (
              <motion.div
                key="step-3"
                initial="enter"
                animate="center"
                exit="exit"
                variants={slideVariants}
                transition={{ duration: 0.2 }}
              >
                <h2 className="mb-4 text-lg font-medium text-zinc-900">Site submission details</h2>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="siteName">Site name</Label>
                    <div className="relative mt-1">
                      <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        id="siteName"
                        className="pl-10"
                        placeholder="Durham fulfillment center"
                        value={siteName}
                        onChange={(event) => setSiteName(event.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="siteLocation">Site location</Label>
                    <div className="relative mt-1">
                      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        id="siteLocation"
                        className="pl-10"
                        placeholder="Durham, NC"
                        value={siteLocation}
                        onChange={(event) => setSiteLocation(event.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="taskStatement">Task statement</Label>
                    <div className="relative mt-1">
                      <Target className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                      <Textarea
                        id="taskStatement"
                        className="min-h-24 pl-10"
                        placeholder="What exact workflow should Blueprint qualify?"
                        value={taskStatement}
                        onChange={(event) => setTaskStatement(event.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="workflowContext">Workflow context</Label>
                    <div className="relative mt-1">
                      <Route className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                      <Textarea
                        id="workflowContext"
                        className="min-h-24 pl-10"
                        placeholder="Describe handoffs, adjacent workflow, or zone boundaries."
                        value={workflowContext}
                        onChange={(event) => setWorkflowContext(event.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="operatingConstraints">Operating constraints</Label>
                    <Textarea
                      id="operatingConstraints"
                      className="mt-1 min-h-20"
                      placeholder="Hours, access windows, safety rules, bottlenecks."
                      value={operatingConstraints}
                      onChange={(event) => setOperatingConstraints(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="privacySecurityConstraints">Privacy and security constraints</Label>
                    <Textarea
                      id="privacySecurityConstraints"
                      className="mt-1 min-h-20"
                      placeholder="Restricted zones, camera restrictions, masked areas."
                      value={privacySecurityConstraints}
                      onChange={(event) => setPrivacySecurityConstraints(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="knownBlockers">Known blockers</Label>
                    <Textarea
                      id="knownBlockers"
                      className="mt-1 min-h-20"
                      placeholder="Call out obvious blockers or open questions."
                      value={knownBlockers}
                      onChange={(event) => setKnownBlockers(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="targetRobotTeam">Target robot team or embodiment</Label>
                    <div className="relative mt-1">
                      <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        id="targetRobotTeam"
                        className="pl-10"
                        placeholder="Optional"
                        value={targetRobotTeam}
                        onChange={(event) => setTargetRobotTeam(event.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="budgetRange">Budget range</Label>
                    <select
                      id="budgetRange"
                      className="mt-1 flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"
                      value={budgetRange}
                      onChange={(event) => setBudgetRange(event.target.value as BudgetRange)}
                    >
                      <option value="">Select budget range</option>
                      {BUDGET_RANGE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="referralSource">How did you hear about Blueprint?</Label>
                    <select
                      id="referralSource"
                      className="mt-1 flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"
                      value={referralSource}
                      onChange={(event) => setReferralSource(event.target.value as ReferralSource)}
                    >
                      <option value="">Select one</option>
                      {REFERRAL_SOURCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                    <div className="flex items-center gap-2 font-medium">
                      <Shield className="h-4 w-4" />
                      What happens after signup
                    </div>
                    <p className="mt-2">
                      Blueprint routes you into the intake review hub, where you can confirm the
                      submission and move the site toward qualification.
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {errorMessage ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}

          <div className="mt-6 flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={handleBack} disabled={step === 1 || isSubmitting}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>

            {step < 3 ? (
              <Button type="button" onClick={handleNext} disabled={isSubmitting}>
                Continue
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Creating account..." : "Create account"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
