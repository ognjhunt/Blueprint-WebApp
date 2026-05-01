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
import { SEO } from "@/components/SEO";
import {
  SurfaceBrowserFrame,
  SurfaceMiniLabel,
  SurfacePage,
  SurfaceSection,
  SurfaceTopBar,
} from "@/components/site/privateSurface";
import {
  PlaceAutocompleteInput,
  resolvePlaceLocationMetadata,
} from "@/components/site/PlaceAutocompleteInput";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { analyticsEvents, getSafeErrorType } from "@/lib/analytics";
import { withCsrfHeader } from "@/lib/csrf";
import {
  getDemandAttributionFromSearchParams,
  hasDemandAttribution,
  overlaySelfReportedBuyerChannelSource,
} from "@/lib/demandAttribution";
import { evaluateStructuredIntake } from "@/lib/structuredIntake";
import type { PlaceLocationMetadata, ProofPathPreference } from "@/types/inbound-request";
import {
  REQUESTED_LANE_DESCRIPTIONS,
  REQUESTED_LANE_LABELS,
  REQUESTED_LANES as SHARED_REQUESTED_LANES,
} from "@/lib/requestTaxonomy";
import { privateGeneratedAssets } from "@/lib/privateGeneratedAssets";

type RequestedLane = (typeof SHARED_REQUESTED_LANES)[number];

const REQUESTED_LANES: Array<{
  value: RequestedLane;
  label: string;
  description: string;
}> = [...SHARED_REQUESTED_LANES]
  .sort((left, right) => {
    const priority: Record<RequestedLane, number> = {
      deeper_evaluation: 0,
      preview_simulation: 1,
      data_licensing: 2,
      managed_tuning: 3,
      qualification: 4,
    };

    return priority[left] - priority[right];
  })
  .map((value) => ({
    value,
    label: REQUESTED_LANE_LABELS[value],
    description: REQUESTED_LANE_DESCRIPTIONS[value],
  }));

const BUYER_TYPES = [
  {
    value: "robot_team",
    label: "Robot team",
    description: "I need an exact-site package, hosted evaluation, or delivery path for a real facility.",
  },
  {
    value: "site_operator",
    label: "Site operator",
    description: "I manage the facility, permissions, or governance around a site.",
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
  { value: "texas_robotics", label: "Texas Robotics" },
  { value: "founder_intro", label: "Founder intro" },
  { value: "university", label: "University contact" },
  { value: "industrial_partner", label: "Industrial partner" },
  { value: "bara_matchmaking", label: "BARA / buyer matchmaking" },
  { value: "proof_led_event", label: "Proof-led event" },
  { value: "partner_referral", label: "Partner referral" },
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

const DEFAULT_BUYER_TYPE: BuyerType = "robot_team";
const DEFAULT_REQUESTED_LANE: RequestedLane = "deeper_evaluation";
const BUYER_STEP_LABELS = ["Organization", "Team", "Site & Workflow"] as const;
const PROOF_PATH_OPTIONS: Array<{ value: ProofPathPreference; label: string }> = [
  { value: "need_guidance", label: "Need guidance" },
  { value: "exact_site_required", label: "Exact site required" },
  { value: "adjacent_site_acceptable", label: "Adjacent site acceptable" },
];

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

function generateRequestId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `business-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function splitName(value: string): { firstName: string; lastName: string } {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "Unknown",
    lastName: parts.slice(1).join(" ") || "Contact",
  };
}

function StepIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div className="mb-8 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: totalSteps }, (_, index) => index + 1).map((stepNumber) => {
          const isComplete = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          return (
            <div
              key={stepNumber}
              className={`rounded-[1.2rem] border px-4 py-3 ${
                isActive
                  ? "border-black/20 bg-white text-[#111110]"
                  : isComplete
                    ? "border-black/10 bg-[#f6f1e8] text-[#111110]"
                    : "border-black/10 bg-[#faf6ef] text-black/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold ${
                    isActive
                      ? "border-black bg-black text-white"
                      : isComplete
                        ? "border-black/20 bg-[#111110] text-white"
                        : "border-black/10 bg-white text-black/50"
                  }`}
                >
                  {isComplete ? <CheckCircle2 className="h-4 w-4" /> : stepNumber}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/40">
                    Step {stepNumber}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{BUYER_STEP_LABELS[stepNumber - 1]}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-sm text-black/50">Step {currentStep} of {totalSteps}</p>
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
  const [buyerType, setBuyerType] = useState<BuyerType>(DEFAULT_BUYER_TYPE);
  const [requestedLanes, setRequestedLanes] = useState<RequestedLane[]>([
    DEFAULT_REQUESTED_LANE,
  ]);
  const [companySize, setCompanySize] = useState<CompanySize | "">("");

  const [siteName, setSiteName] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [siteLocationMetadata, setSiteLocationMetadata] =
    useState<PlaceLocationMetadata | null>(null);
  const [targetSiteType, setTargetSiteType] = useState("");
  const [taskStatement, setTaskStatement] = useState("");
  const [workflowContext, setWorkflowContext] = useState("");
  const [operatingConstraints, setOperatingConstraints] = useState("");
  const [privacySecurityConstraints, setPrivacySecurityConstraints] = useState("");
  const [knownBlockers, setKnownBlockers] = useState("");
  const [targetRobotTeam, setTargetRobotTeam] = useState("");
  const [proofPathPreference, setProofPathPreference] =
    useState<ProofPathPreference>("need_guidance");
  const [timeline, setTimeline] = useState("");
  const [budgetRange, setBudgetRange] = useState<BudgetRange | "">("");
  const [referralSource, setReferralSource] = useState<ReferralSource | "">("");
  const searchDemandAttribution = useMemo(() => {
    if (typeof window === "undefined") {
      return getDemandAttributionFromSearchParams(new URLSearchParams());
    }

    return getDemandAttributionFromSearchParams(
      new URLSearchParams(window.location.search),
    );
  }, []);
  const signupDemandAttribution = useMemo(
    () =>
      overlaySelfReportedBuyerChannelSource(
        searchDemandAttribution,
        referralSource || null,
      ),
    [referralSource, searchDemandAttribution],
  );
  const searchAnalyticsAttribution = hasDemandAttribution(searchDemandAttribution)
    ? searchDemandAttribution
    : undefined;
  const signupAnalyticsAttribution = hasDemandAttribution(signupDemandAttribution)
    ? signupDemandAttribution
    : undefined;

  useEffect(() => {
    analyticsEvents.businessSignupStarted({
      defaultRequestedLane: requestedLanes[0] || "none",
      requestedLaneCount: requestedLanes.length,
      ...(searchAnalyticsAttribution
        ? { demandAttribution: searchAnalyticsAttribution }
        : {}),
    });
    // We only want the baseline start event once per page visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      (siteName.trim().length > 0 || (buyerType === "robot_team" && targetSiteType.trim().length > 0)) &&
      siteLocation.trim().length > 0 &&
      taskStatement.trim().length > 0 &&
      (buyerType !== "site_operator" || operatingConstraints.trim().length > 0) &&
      budgetRange !== "" &&
      referralSource !== "",
    [buyerType, operatingConstraints, siteName, siteLocation, targetSiteType, taskStatement, budgetRange, referralSource]
  );

  const handleNext = useCallback(() => {
    setErrorMessage("");

    if (step === 1 && !step1Valid) {
      let validationError = "password_mismatch";
      if (!organizationName.trim()) {
        validationError = "missing_organization_name";
        setErrorMessage("Please enter your organization name.");
      } else if (!isValidEmail(email)) {
        validationError = "invalid_email";
        setErrorMessage("Please enter a valid work email.");
      } else if (password.length < 8) {
        validationError = "weak_password";
        setErrorMessage("Password must be at least 8 characters.");
      } else {
        setErrorMessage("Passwords do not match.");
      }
      analyticsEvents.businessSignupFailed({
        stage: "step_validation",
        stepNumber: 1,
        errorType: validationError,
        buyerType,
        requestedLaneCount: requestedLanes.length,
        ...(searchAnalyticsAttribution
          ? { demandAttribution: searchAnalyticsAttribution }
          : {}),
      });
      return;
    }

    if (step === 2 && !step2Valid) {
      let validationError = "missing_contact_name";
      if (!contactName.trim()) {
        setErrorMessage("Please enter your name.");
      } else if (!isValidPhone(phoneNumber)) {
        validationError = "invalid_phone";
        setErrorMessage("Please enter a valid phone number.");
      } else if (requestedLanes.length === 0) {
        validationError = "missing_requested_lane";
        setErrorMessage("Select at least one requested lane.");
      } else {
        validationError = "missing_company_size";
        setErrorMessage("Please select your company size.");
      }
      analyticsEvents.businessSignupFailed({
        stage: "step_validation",
        stepNumber: 2,
        errorType: validationError,
        buyerType,
        requestedLaneCount: requestedLanes.length,
        ...(searchAnalyticsAttribution
          ? { demandAttribution: searchAnalyticsAttribution }
          : {}),
      });
      return;
    }

    setStep((current) => Math.min(current + 1, 3));
  }, [
    step,
    step1Valid,
    step2Valid,
    organizationName,
    email,
    password,
    contactName,
    phoneNumber,
    requestedLanes,
    buyerType,
    searchAnalyticsAttribution,
  ]);

  const handleBack = useCallback(() => {
    setErrorMessage("");
    setStep((current) => Math.max(current - 1, 1));
  }, []);

  const toggleLane = useCallback((value: RequestedLane) => {
    setRequestedLanes((current) =>
      current.includes(value) ? current.filter((lane) => lane !== value) : [...current, value]
    );
  }, []);

  const handleBuyerTypeChange = useCallback((value: string) => {
    const nextBuyerType = value as BuyerType;
    setBuyerType(nextBuyerType);
    setRequestedLanes(nextBuyerType === "site_operator" ? ["qualification"] : [DEFAULT_REQUESTED_LANE]);
    if (nextBuyerType === "site_operator") {
      setProofPathPreference("need_guidance");
    }
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
      analyticsEvents.businessSignupFailed({
        stage: "google_continue",
        stepNumber: 1,
        errorType: getSafeErrorType(error),
        buyerType,
        requestedLaneCount: requestedLanes.length,
        ...(searchAnalyticsAttribution
          ? { demandAttribution: searchAnalyticsAttribution }
          : {}),
      });
      setErrorMessage(error.message || "Failed to sign up with Google.");
    } finally {
      setIsSubmitting(false);
    }
  }, [buyerType, requestedLanes, searchAnalyticsAttribution]);

  const handleSubmit = useCallback(async () => {
    if (!step3Valid) {
      if (!siteName.trim() && !(buyerType === "robot_team" && targetSiteType.trim())) setErrorMessage("Please enter the site name or target site class.");
      else if (!siteLocation.trim()) setErrorMessage("Please enter the site location.");
      else if (!taskStatement.trim()) setErrorMessage("Please enter the task statement.");
      else if (buyerType === "site_operator" && !operatingConstraints.trim()) setErrorMessage("Please enter the access rules.");
      else if (!budgetRange) setErrorMessage("Please select a budget range.");
      else setErrorMessage("Please tell us how you heard about Blueprint.");
      analyticsEvents.businessSignupFailed({
        stage: "step_validation",
        stepNumber: 3,
        errorType:
          !siteName.trim() && !(buyerType === "robot_team" && targetSiteType.trim())
            ? "missing_site_name_or_type"
            : !siteLocation.trim()
              ? "missing_site_location"
              : !taskStatement.trim()
                ? "missing_task_statement"
                : buyerType === "site_operator" && !operatingConstraints.trim()
                  ? "missing_access_rules"
                  : !budgetRange
                    ? "missing_budget_range"
                    : "missing_referral_source",
        buyerType,
        requestedLaneCount: requestedLanes.length,
        ...(signupAnalyticsAttribution
          ? { demandAttribution: signupAnalyticsAttribution }
          : {}),
      });
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    analyticsEvents.businessSignupSubmitted({
      buyerType,
      requestedLaneCount: requestedLanes.length,
      includesQualificationLane: requestedLanes.includes("qualification"),
      companySize,
      budgetRange,
      referralSource,
      hasPhoneNumber: Boolean(phoneNumber.trim()),
      hasWorkflowContext: Boolean(workflowContext.trim()),
      hasOperatingConstraints: Boolean(operatingConstraints.trim()),
      hasPrivacySecurityConstraints: Boolean(privacySecurityConstraints.trim()),
      hasKnownBlockers: Boolean(knownBlockers.trim()),
      hasTargetRobotTeam: Boolean(targetRobotTeam.trim()),
      ...(signupAnalyticsAttribution
        ? { demandAttribution: signupAnalyticsAttribution }
        : {}),
    });

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
      const structuredIntakeRequestId = generateRequestId();
      const structuredIntakeDecision = evaluateStructuredIntake({
        buyerType,
        requestedLanes,
        budgetBucket: budgetRange,
        siteName,
        siteLocation,
        targetSiteType,
        taskStatement,
        proofPathPreference,
        roleTitle: jobTitle,
        workflowContext,
        operatingConstraints,
        privacySecurityConstraints,
        knownBlockers,
        targetRobotTeam,
        details: timeline ? `Timeline: ${timeline}` : null,
      });

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
        structuredIntakeRequestId,
        structuredIntakeRecommendedPath: structuredIntakeDecision.recommendedPath,
        calendarDisposition: structuredIntakeDecision.calendarDisposition,
        calendarReasons: structuredIntakeDecision.calendarReasons,
        proofReadyOutcome: structuredIntakeDecision.proofReadyOutcome,
        proofPathOutcome: structuredIntakeDecision.proofPathOutcome,
        proofReadinessScore: structuredIntakeDecision.proofReadinessScore,
        proofReadyCriteria: structuredIntakeDecision.proofReadyCriteria,
        missingProofReadyFields: structuredIntakeDecision.missingProofReadyFields,
        siteOperatorClaimOutcome: structuredIntakeDecision.siteOperatorClaimOutcome,
        accessBoundaryOutcome: structuredIntakeDecision.accessBoundaryOutcome,
        siteClaimReadinessScore: structuredIntakeDecision.siteClaimReadinessScore,
        siteClaimCriteria: structuredIntakeDecision.siteClaimCriteria,
        missingSiteClaimFields: structuredIntakeDecision.missingSiteClaimFields,
        siteName,
        siteLocation,
        siteLocationMetadata: resolvePlaceLocationMetadata(siteLocation, siteLocationMetadata),
        targetSiteType: targetSiteType || undefined,
        taskStatement,
        proofPathPreference,
        workflowContext: workflowContext || undefined,
        operatingConstraints: operatingConstraints || undefined,
        privacySecurityConstraints: privacySecurityConstraints || undefined,
        knownBlockers: knownBlockers || undefined,
        targetRobotTeam: targetRobotTeam || undefined,
        timeline: timeline || undefined,
        primaryNeeds,
        companySize: companySize as CompanySize,
        projectDescription: workflowContext || undefined,
        budgetRange: budgetRange as BudgetRange,
        referralSource: referralSource as ReferralSource,
        demandAttribution: signupAnalyticsAttribution || null,
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
          buyerWorkflowConfirmed: buyerType === "robot_team",
          packageOrHostedPathSelected: buyerType === "robot_team" && requestedLanes.length > 0,
          proofReadyIntake: structuredIntakeDecision.proofReadyOutcome === "proof_ready_intake",
          procurementReviewed: false,
          reviewSessionScoped: structuredIntakeDecision.calendarDisposition === "not_needed_yet",
          siteClaimConfirmed:
            buyerType === "site_operator"
            && structuredIntakeDecision.siteOperatorClaimOutcome !== "site_claim_needs_detail",
          accessBoundariesDefined:
            buyerType === "site_operator"
            && structuredIntakeDecision.accessBoundaryOutcome === "access_boundary_defined",
          privacyRulesConfirmed:
            buyerType === "site_operator"
            && structuredIntakeDecision.siteClaimCriteria.includes("privacy_security_boundary"),
          commercializationPreferenceSet: false,
          teamContactConfirmed: false,
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
      const { firstName, lastName } = splitName(contactName);
      const inboundResponse = await fetch("/api/inbound-request", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          requestId: structuredIntakeRequestId,
          firstName,
          lastName,
          company: organizationName,
          roleTitle: jobTitle || (buyerType === "site_operator" ? "Site operator" : "Robot team contact"),
          email: userEmail.toLowerCase(),
          budgetBucket: budgetRange,
          requestedLanes,
          buyerType,
          siteName,
          siteLocation,
          siteLocationMetadata: resolvePlaceLocationMetadata(siteLocation, siteLocationMetadata),
          taskStatement: buyerType === "site_operator" ? taskStatement || "Operator site claim" : taskStatement,
          targetSiteType: targetSiteType || siteName,
          proofPathPreference,
          workflowContext: workflowContext || undefined,
          operatingConstraints: operatingConstraints || undefined,
          privacySecurityConstraints: privacySecurityConstraints || undefined,
          knownBlockers: knownBlockers || undefined,
          targetRobotTeam: targetRobotTeam || undefined,
          details: timeline ? `Timeline: ${timeline}` : undefined,
          context: {
            sourcePageUrl: typeof window !== "undefined" ? window.location.href : "/signup/business",
            referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
            demandCity: signupDemandAttribution?.demandCity ?? null,
            buyerChannelSource: signupDemandAttribution?.buyerChannelSource ?? null,
            buyerChannelSourceCaptureMode:
              signupDemandAttribution?.buyerChannelSourceCaptureMode ?? "unknown",
            buyerChannelSourceRaw: signupDemandAttribution?.buyerChannelSourceRaw ?? null,
            utm: signupDemandAttribution?.utm ?? {},
            timezoneOffset: new Date().getTimezoneOffset(),
            locale: typeof navigator !== "undefined" ? navigator.language : undefined,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          },
        }),
      });

      if (!inboundResponse.ok) {
        const responseBody = (await inboundResponse.json().catch(() => ({}))) as { message?: string };
        throw new Error(responseBody.message || "Account was created, but intake routing failed.");
      }
      analyticsEvents.businessSignupCompleted({
        buyerType,
        requestedLaneCount: requestedLanes.length,
        includesQualificationLane: requestedLanes.includes("qualification"),
        companySize,
        budgetRange,
        referralSource,
        ...(signupAnalyticsAttribution
          ? { demandAttribution: signupAnalyticsAttribution }
          : {}),
      });
      setLocation("/onboarding");
    } catch (error: any) {
      analyticsEvents.businessSignupFailed({
        stage: "account_creation",
        stepNumber: 3,
        errorType: getSafeErrorType(error),
        buyerType,
        requestedLaneCount: requestedLanes.length,
        ...(signupAnalyticsAttribution
          ? { demandAttribution: signupAnalyticsAttribution }
          : {}),
      });
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
    proofPathPreference,
    privacySecurityConstraints,
    referralSource,
    requestedLanes,
    setLocation,
    siteLocation,
    siteLocationMetadata,
    siteName,
    step3Valid,
    targetSiteType,
    targetRobotTeam,
    taskStatement,
    timeline,
    workflowContext,
    searchAnalyticsAttribution,
    signupAnalyticsAttribution,
  ]);

  const slideVariants = {
    enter: { opacity: 0, x: 36 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -36 },
  };

  return (
    <>
      <SEO
        title="Buyer Access Request | Blueprint"
        description="Request buyer access for exact-site packages and hosted evaluation."
        canonical="/signup/business"
        noIndex
      />

      <SurfacePage>
        <SurfaceTopBar eyebrow="Secure Intake" rightLabel="Buyer Access Request" />
        <SurfaceSection className="py-8">
          <SurfaceBrowserFrame>
            <div className="grid xl:grid-cols-[0.64fr_0.36fr]">
              <div className="bg-[#fbf7f0] p-8 lg:p-10">
                <div className="mx-auto max-w-[42rem]">
                  <SurfaceMiniLabel>Buyer Access Request</SurfaceMiniLabel>
                  <h1 className="mt-4 text-[clamp(2.8rem,4vw,4.5rem)] font-semibold tracking-[-0.08em] leading-[0.92] text-[#111110]">
                    {step === 1
                      ? "Organization details"
                      : step === 2
                        ? "Team and requested lane"
                        : "Site and workflow intake"}
                  </h1>
                  <p className="mt-3 max-w-[34rem] text-sm leading-7 text-black/60">
                    {step === 1
                      ? "Request exact-site packages or hosted evaluation through a private, context-rich intake instead of a generic marketplace signup."
                      : step === 2
                        ? "Tell Blueprint who is evaluating the site and which lane should open first."
                        : "Ground the request in one real facility, one workflow, and one commercial path."}
                  </p>

                  <div className="mt-6 rounded-[1.5rem] border border-black/10 bg-white px-5 py-4 text-sm leading-7 text-black/60">
                    Existing portal users should use sign in instead of creating a second path. If
                    the exact facility and workflow are already known, you can also{" "}
                    <a href="/book-exact-site-review" className="font-semibold text-[#111110] underline-offset-4 hover:underline">
                      book a scoping call
                    </a>
                    .
                  </div>

                  <div className="mt-8">
                    <StepIndicator currentStep={step} totalSteps={3} />
                  </div>

                  <div className="rounded-[1.9rem] border border-black/10 bg-white p-6 shadow-[0_20px_70px_rgba(17,17,16,0.06)] sm:p-7">
                    <AnimatePresence mode="wait">
                      {step === 1 ? (
                        <motion.div
                          key="step-1"
                          initial="enter"
                          animate="center"
                          exit="exit"
                          variants={slideVariants}
                          transition={{ duration: 0.2 }}
                          className="space-y-5"
                        >
                          <div className="grid gap-5 md:grid-cols-2">
                            <div className="md:col-span-2">
                              <Label htmlFor="organizationName" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                                Organization name
                              </Label>
                              <div className="relative mt-2">
                                <Building2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
                                <Input
                                  id="organizationName"
                                  className="h-12 rounded-[1rem] border-black/10 bg-white pl-11"
                                  placeholder="Acme Operations"
                                  value={organizationName}
                                  onChange={(event) => setOrganizationName(event.target.value)}
                                />
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <Label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                                Work email
                              </Label>
                              <div className="relative mt-2">
                                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
                                <Input
                                  id="email"
                                  type="email"
                                  className="h-12 rounded-[1rem] border-black/10 bg-white pl-11"
                                  placeholder="you@company.com"
                                  value={email}
                                  onChange={(event) => setEmail(event.target.value)}
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="password" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                                Password
                              </Label>
                              <div className="relative mt-2">
                                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
                                <Input
                                  id="password"
                                  type={showPassword ? "text" : "password"}
                                  className="h-12 rounded-[1rem] border-black/10 bg-white pl-11"
                                  placeholder="At least 8 characters"
                                  value={password}
                                  onChange={(event) => setPassword(event.target.value)}
                                />
                              </div>
                              <button
                                type="button"
                                className="mt-2 text-sm text-black/45 transition hover:text-black"
                                onClick={() => setShowPassword((current) => !current)}
                              >
                                {showPassword ? "Hide password" : "Show password"}
                              </button>
                            </div>
                            <div>
                              <Label htmlFor="confirmPassword" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                                Confirm password
                              </Label>
                              <Input
                                id="confirmPassword"
                                type={showPassword ? "text" : "password"}
                                className="mt-2 h-12 rounded-[1rem] border-black/10 bg-white"
                                placeholder="Repeat password"
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                              />
                            </div>
                          </div>

                          <div className="rounded-[1.35rem] border border-black/10 bg-[#faf6ef] p-5">
                            <p className="text-sm leading-7 text-black/60">
                              Prefer Google? Authenticate now, then finish the intake details on
                              the next step.
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              className="mt-4 h-11 rounded-full border-black/10 bg-white px-5 text-[#111110] hover:bg-[#f3efe8]"
                              onClick={handleGoogleSignUp}
                              disabled={isSubmitting}
                            >
                              Continue with Google
                            </Button>
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
                          className="space-y-5"
                        >
                          <div className="grid gap-5 md:grid-cols-2">
                            <div>
                              <Label htmlFor="contactName" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                                Your name
                              </Label>
                              <div className="relative mt-2">
                                <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
                                <Input
                                  id="contactName"
                                  className="h-12 rounded-[1rem] border-black/10 bg-white pl-11"
                                  placeholder="Ada Lovelace"
                                  value={contactName}
                                  onChange={(event) => setContactName(event.target.value)}
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="jobTitle" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                                Title
                              </Label>
                              <Input
                                id="jobTitle"
                                className="mt-2 h-12 rounded-[1rem] border-black/10 bg-white"
                                placeholder="Operations Lead"
                                value={jobTitle}
                                onChange={(event) => setJobTitle(event.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="phoneNumber" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                                Phone
                              </Label>
                              <Input
                                id="phoneNumber"
                                className="mt-2 h-12 rounded-[1rem] border-black/10 bg-white"
                                placeholder="(555) 555-5555"
                                value={phoneNumber}
                                onChange={(event) => setPhoneNumber(event.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="companySize" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                                Company size
                              </Label>
                              <select
                                id="companySize"
                                className="mt-2 flex h-12 w-full rounded-[1rem] border border-black/10 bg-white px-4 text-sm text-[#111110]"
                                value={companySize}
                                onChange={(event) => setCompanySize(event.target.value as CompanySize)}
                              >
                                <option value="">Select size</option>
                                {COMPANY_SIZE_OPTIONS.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <Label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                              Buyer type
                            </Label>
                            <RadioGroup value={buyerType} onValueChange={handleBuyerTypeChange} className="grid gap-3">
                              {BUYER_TYPES.map((option) => (
                                <label
                                  key={option.value}
                                  className="flex cursor-pointer items-start gap-4 rounded-[1.25rem] border border-black/10 bg-[#faf6ef] p-4 transition hover:border-black/15"
                                >
                                  <RadioGroupItem value={option.value} />
                                  <div>
                                    <div className="font-semibold text-[#111110]">{option.label}</div>
                                    <p className="mt-1 text-sm leading-6 text-black/55">{option.description}</p>
                                  </div>
                                </label>
                              ))}
                            </RadioGroup>
                          </div>

                          <div className="space-y-3">
                            <Label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                              Requested lane
                            </Label>
                            <div className="grid gap-3">
                              {REQUESTED_LANES.map((lane) => (
                                <label
                                  key={lane.value}
                                  className="flex cursor-pointer items-start gap-4 rounded-[1.25rem] border border-black/10 bg-white p-4 transition hover:border-black/15"
                                >
                                  <Checkbox
                                    checked={requestedLanes.includes(lane.value)}
                                    onCheckedChange={() => toggleLane(lane.value)}
                                  />
                                  <div>
                                    <div className="font-semibold text-[#111110]">{lane.label}</div>
                                    <p className="mt-1 text-sm leading-6 text-black/55">{lane.description}</p>
                                  </div>
                                </label>
                              ))}
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
                          className="space-y-5"
                        >
                          <div className="grid gap-5 md:grid-cols-2">
                            <div>
                              <Label htmlFor="siteName" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                                {buyerType === "site_operator" ? "Facility name" : "Site name"}
                              </Label>
                              <div className="relative mt-2">
                                <Building2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
                                <Input
                                  id="siteName"
                                  className="h-12 rounded-[1rem] border-black/10 bg-white pl-11"
                                  placeholder={buyerType === "site_operator" ? "Brightleaf Books" : "Durham fulfillment center"}
                                  value={siteName}
                                  onChange={(event) => setSiteName(event.target.value)}
                                />
                              </div>
                            </div>
                            <PlaceAutocompleteInput
                              id="siteLocation"
                              label="Site location"
                              labelClassName="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45"
                              inputWrapperClassName="relative mt-2"
                              inputClassName="flex h-12 w-full rounded-[1rem] border border-black/10 bg-white px-3 py-2 pl-11 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              icon={<MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />}
                              placeholder="Durham, NC"
                              value={siteLocation}
                              onChange={setSiteLocation}
                              onPlaceSelect={setSiteLocationMetadata}
                            />
                            {buyerType === "robot_team" ? (
                              <div className="md:col-span-2">
                                <Label htmlFor="targetSiteType" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                                  Target site class
                                </Label>
                                <Input
                                  id="targetSiteType"
                                  className="mt-2 h-12 rounded-[1rem] border-black/10 bg-white"
                                  placeholder="Warehouse, hotel, grocery backroom, hospital corridor"
                                  value={targetSiteType}
                                  onChange={(event) => setTargetSiteType(event.target.value)}
                                />
                              </div>
                            ) : null}
                            <div className="md:col-span-2">
                              <Label htmlFor="taskStatement" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                                {buyerType === "site_operator" ? "Operator intent" : "Task statement"}
                              </Label>
                              <div className="relative mt-2">
                                <Target className="absolute left-4 top-4 h-4 w-4 text-black/30" />
                                <Textarea
                                  id="taskStatement"
                                  className="min-h-28 rounded-[1rem] border-black/10 bg-white pl-11"
                                  placeholder={buyerType === "site_operator" ? "What site are you submitting or claiming, and what kind of robot evaluation would you consider?" : "What exact site and technical question should Blueprint help with?"}
                                  value={taskStatement}
                                  onChange={(event) => setTaskStatement(event.target.value)}
                                />
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <Label htmlFor="workflowContext" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                                Workflow context
                              </Label>
                              <div className="relative mt-2">
                                <Route className="absolute left-4 top-4 h-4 w-4 text-black/30" />
                                <Textarea
                                  id="workflowContext"
                                  className="min-h-24 rounded-[1rem] border-black/10 bg-white pl-11"
                                  placeholder="Describe handoffs, adjacent workflow, or zone boundaries."
                                  value={workflowContext}
                                  onChange={(event) => setWorkflowContext(event.target.value)}
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="operatingConstraints" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                                {buyerType === "site_operator" ? "Access rules" : "Operating constraints"}
                              </Label>
                              <Textarea
                                id="operatingConstraints"
                                className="mt-2 min-h-24 rounded-[1rem] border-black/10 bg-white"
                                placeholder={buyerType === "site_operator" ? "Hours, access windows, escort needs, restricted areas." : "Hours, access windows, safety rules, bottlenecks."}
                                value={operatingConstraints}
                                onChange={(event) => setOperatingConstraints(event.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="privacySecurityConstraints" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                                Privacy and security constraints
                              </Label>
                              <Textarea
                                id="privacySecurityConstraints"
                                className="mt-2 min-h-24 rounded-[1rem] border-black/10 bg-white"
                                placeholder="Restricted zones, camera restrictions, masked areas."
                                value={privacySecurityConstraints}
                                onChange={(event) => setPrivacySecurityConstraints(event.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="knownBlockers" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                                Known blockers
                              </Label>
                              <Textarea
                                id="knownBlockers"
                                className="mt-2 min-h-24 rounded-[1rem] border-black/10 bg-white"
                                placeholder="Call out obvious blockers or open questions."
                                value={knownBlockers}
                                onChange={(event) => setKnownBlockers(event.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="targetRobotTeam" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                                {buyerType === "site_operator" ? "Relevant robot teams" : "Target robot team or embodiment"}
                              </Label>
                              <div className="relative mt-2">
                                <Users className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
                                <Input
                                  id="targetRobotTeam"
                                  className="h-12 rounded-[1rem] border-black/10 bg-white pl-11"
                                  placeholder={buyerType === "site_operator" ? "Optional buyer category or robot use case" : "Optional"}
                                  value={targetRobotTeam}
                                  onChange={(event) => setTargetRobotTeam(event.target.value)}
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="proofPathPreference" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                                Proof path
                              </Label>
                              <select
                                id="proofPathPreference"
                                className="mt-2 flex h-12 w-full rounded-[1rem] border border-black/10 bg-white px-4 text-sm text-[#111110]"
                                value={proofPathPreference}
                                onChange={(event) => setProofPathPreference(event.target.value as ProofPathPreference)}
                              >
                                {PROOF_PATH_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <Label htmlFor="timeline" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                                Timing
                              </Label>
                              <Input
                                id="timeline"
                                className="mt-2 h-12 rounded-[1rem] border-black/10 bg-white"
                                placeholder="This month, this quarter, exploring"
                                value={timeline}
                                onChange={(event) => setTimeline(event.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="budgetRange" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                                Budget range
                              </Label>
                              <select
                                id="budgetRange"
                                className="mt-2 flex h-12 w-full rounded-[1rem] border border-black/10 bg-white px-4 text-sm text-[#111110]"
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
                            <div className="md:col-span-2">
                              <Label htmlFor="referralSource" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
                                How did you hear about Blueprint?
                              </Label>
                              <select
                                id="referralSource"
                                className="mt-2 flex h-12 w-full rounded-[1rem] border border-black/10 bg-white px-4 text-sm text-[#111110]"
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
                          </div>

                          <div className="rounded-[1.35rem] border border-black/10 bg-[#faf6ef] p-5 text-sm text-black/60">
                            <div className="flex items-center gap-2 font-semibold text-[#111110]">
                              <Shield className="h-4 w-4" />
                              What happens after signup
                            </div>
                            <p className="mt-3 leading-7">
                              Blueprint routes the request into the intake review hub so the team
                              can confirm the site, workflow, commercial lane, and whether a
                              scoping call is actually needed before opening a hosted review or
                              package path.
                            </p>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    {errorMessage ? (
                      <div className="mt-5 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {errorMessage}
                      </div>
                    ) : null}

                    <div className="mt-6 flex flex-col gap-3 border-t border-black/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleBack}
                        disabled={step === 1 || isSubmitting}
                        className="justify-start rounded-full px-0 text-black/55 hover:bg-transparent hover:text-[#111110]"
                      >
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back
                      </Button>

                      {step < 3 ? (
                        <Button
                          type="button"
                          onClick={handleNext}
                          disabled={isSubmitting}
                          className="h-12 rounded-full bg-[#111110] px-6 text-white hover:bg-black"
                        >
                          Continue
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          onClick={handleSubmit}
                          disabled={isSubmitting}
                          className="h-12 rounded-full bg-[#111110] px-6 text-white hover:bg-black"
                        >
                          {isSubmitting ? "Creating account..." : "Submit request"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <aside className="border-t border-black/10 bg-[#f5f0e7] p-8 lg:p-10 xl:border-l xl:border-t-0">
                <SurfaceMiniLabel>Why Exact-Site Context Matters</SurfaceMiniLabel>
                <div className="mt-5 overflow-hidden rounded-[1.75rem] border border-black/10 bg-white">
                  <img
                    src={privateGeneratedAssets.facilityPlanBoard}
                    alt="Blueprint site plan board"
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="mt-6 space-y-5">
                  <div className="rounded-[1.35rem] border border-black/10 bg-white p-5">
                    <p className="text-sm font-semibold text-[#111110]">Robots perform in the real world.</p>
                    <p className="mt-2 text-sm leading-7 text-black/60">
                      Site-specific scans reveal the nuance that drives access, route design, and
                      buyer trust.
                    </p>
                  </div>
                  <div className="rounded-[1.35rem] border border-black/10 bg-white p-5">
                    <p className="text-sm font-semibold text-[#111110]">Better data. Fewer unknowns.</p>
                    <p className="mt-2 text-sm leading-7 text-black/60">
                      Exact-site packages reduce rework and de-risk evaluations before travel or
                      deployment.
                    </p>
                  </div>
                  <div className="rounded-[1.35rem] border border-black/10 bg-white p-5">
                    <p className="text-sm font-semibold text-[#111110]">Private by default.</p>
                    <p className="mt-2 text-sm leading-7 text-black/60">
                      Every access request is reviewed to maintain truthful product routing,
                      entitlement boundaries, and buyer-side privacy expectations.
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-[1.35rem] border border-black/10 bg-[#111110] p-5 text-white">
                  <SurfaceMiniLabel className="text-white/50">Current Path</SurfaceMiniLabel>
                  <p className="mt-4 text-2xl font-semibold tracking-[-0.05em]">
                    {step === 1 ? "Organization" : step === 2 ? "Team" : "Site & workflow"}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-white/70">
                    {step === 1
                      ? "Open the request with company and account details."
                      : step === 2
                        ? "Define who is evaluating the site and which lane should open first."
                        : "Anchor the request in one real facility and one workflow question."}
                  </p>
                </div>
              </aside>
            </div>
          </SurfaceBrowserFrame>
        </SurfaceSection>
      </SurfacePage>
    </>
  );
}
