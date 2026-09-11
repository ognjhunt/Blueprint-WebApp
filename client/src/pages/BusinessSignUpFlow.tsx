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
import { MinimalAccountLayout } from "@/components/site/MinimalAccountLayout";
import {
  PlaceAutocompleteInput,
  resolvePlaceLocationMetadata,
} from "@/components/site/PlaceAutocompleteInput";
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
import {
  PRIVACY_URL,
  PRIVACY_VERSION,
  TERMS_URL,
  TERMS_VERSION,
} from "@/lib/legalAcceptance";
import type { PlaceLocationMetadata, ProofPathPreference } from "@/types/inbound-request";
import {
  REQUESTED_LANE_DESCRIPTIONS,
  REQUESTED_LANE_LABELS,
  REQUESTED_LANES as SHARED_REQUESTED_LANES,
} from "@/lib/requestTaxonomy";
import { PilotOpportunityFields } from "@/components/site/PilotOpportunityFields";
import type {
  PilotOpportunityVisibility,
  PilotPermissionDisposition,
} from "@/types/inbound-request";

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
    description: "I need an exact-site package, a policy evaluation set, or delivery path for a real facility.",
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
const DEFAULT_BUYER_TYPE: BuyerType = "robot_team";
const DEFAULT_REQUESTED_LANE: RequestedLane = "deeper_evaluation";
const BUYER_STEP_LABELS = ["Organization", "Role", "Site & Workflow"] as const;
const PROOF_PATH_OPTIONS: Array<{ value: ProofPathPreference; label: string }> = [
  { value: "need_guidance", label: "Need guidance" },
  { value: "exact_site_required", label: "Exact site required" },
  { value: "adjacent_site_acceptable", label: "Adjacent site acceptable" },
];
const COMMERCIALIZATION_BOUNDARY_OPTIONS = [
  "Private review only",
  "Anonymized opportunity visibility",
  "Ask before each robot-team use",
  "Revenue-share review",
  "Not sure yet",
] as const;

type CommercializationBoundary = typeof COMMERCIALIZATION_BOUNDARY_OPTIONS[number];

const FIELD_LABEL_CLASS = "ms-eyebrow mb-2 block";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  if (!value.trim()) return true;
  return value.replace(/\D/g, "").length >= 10;
}

function readInitialBuyerType(): BuyerType {
  if (typeof window === "undefined") {
    return DEFAULT_BUYER_TYPE;
  }

  const params = new URLSearchParams(window.location.search);
  const rawValue = (params.get("buyerType") || params.get("persona") || "").trim();
  if (rawValue === "site_operator" || rawValue === "site-operator") {
    return "site_operator";
  }
  if (rawValue === "robot_team" || rawValue === "robot-team") {
    return "robot_team";
  }
  return DEFAULT_BUYER_TYPE;
}

function readInitialPilotOpportunityIntent(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const intent = String(params.get("intent") || params.get("interest") || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  return intent === "pilot-opportunity" || intent === "prepare-pilot-opportunity";
}

function defaultRequestedLanesForBuyerType(buyerType: BuyerType): RequestedLane[] {
  return buyerType === "site_operator" ? ["qualification"] : [DEFAULT_REQUESTED_LANE];
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
    <div className="ms-signup-steps" aria-label={`Step ${currentStep} of ${totalSteps}`}>
      <ol>
        {Array.from({ length: totalSteps }, (_, index) => index + 1).map((stepNumber) => {
          const isComplete = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          return (
            <li
              key={stepNumber}
              aria-current={isActive ? "step" : undefined}
              data-state={isActive ? "active" : isComplete ? "complete" : "upcoming"}
            >
              <span className="ms-signup-step-number">
                {isComplete ? <CheckCircle2 size={17} aria-hidden="true" /> : `0${stepNumber}`}
              </span>
              <span>{BUYER_STEP_LABELS[stepNumber - 1]}</span>
            </li>
          );
        })}
      </ol>
      <p className="ms-progress">
        Step {currentStep} of {totalSteps}
        <span className="ms-progress-track">
          <span className="ms-progress-fill" style={{ width: `${(currentStep / totalSteps) * 100}%` }} />
        </span>
      </p>
    </div>
  );
}

export default function BusinessSignUpFlow() {
  const [, setLocation] = useLocation();
  const initialBuyerType = useMemo(() => readInitialBuyerType(), []);
  const initialPilotOpportunityIntent = useMemo(
    () => readInitialPilotOpportunityIntent(),
    [],
  );
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
  const [buyerType, setBuyerType] = useState<BuyerType>(initialBuyerType);
  const [requestedLanes, setRequestedLanes] = useState<RequestedLane[]>(
    () => defaultRequestedLanesForBuyerType(initialBuyerType),
  );
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
  const [commercializationPreference, setCommercializationPreference] =
    useState<CommercializationBoundary | "">("");
  const [knownBlockers, setKnownBlockers] = useState("");
  const [targetRobotTeam, setTargetRobotTeam] = useState("");
  const [pilotOpportunityRequested, setPilotOpportunityRequested] = useState(
    initialBuyerType === "site_operator" && initialPilotOpportunityIntent,
  );
  const [pilotOpportunityVisibility, setPilotOpportunityVisibility] =
    useState<PilotOpportunityVisibility>("private");
  const [approvedRobotTeamEmails, setApprovedRobotTeamEmails] = useState("");
  const [anonymizedOpportunitySummary, setAnonymizedOpportunitySummary] = useState("");
  const [pilotBenchmarkProfile, setPilotBenchmarkProfile] = useState("");
  const [pilotObjectProfile, setPilotObjectProfile] = useState("");
  const [pilotOperationalProfile, setPilotOperationalProfile] = useState("");
  const [pilotIntegrationEnvironment, setPilotIntegrationEnvironment] = useState("");
  const [pilotRolloutReadiness, setPilotRolloutReadiness] = useState("");
  const [siteSpecificAdaptation, setSiteSpecificAdaptation] =
    useState<PilotPermissionDisposition>("not_granted");
  const [retainImprovements, setRetainImprovements] =
    useState<PilotPermissionDisposition>("not_granted");
  const [generalModelTraining, setGeneralModelTraining] =
    useState<PilotPermissionDisposition>("not_granted");
  const [proofPathPreference, setProofPathPreference] =
    useState<ProofPathPreference>("need_guidance");
  const [timeline, setTimeline] = useState("");
  const [budgetRange, setBudgetRange] = useState<BudgetRange | "">(
    initialBuyerType === "site_operator" ? "Undecided/Unsure" : "",
  );
  const [referralSource, setReferralSource] = useState<ReferralSource | "">("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
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
  const pilotOpportunity = useMemo(
    () => ({
      requested: buyerType === "site_operator" && pilotOpportunityRequested,
      visibility: pilotOpportunityVisibility,
      approvedRobotTeamEmails: approvedRobotTeamEmails
        .split(/[\n,;]+/)
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
      anonymizedSummary: anonymizedOpportunitySummary.trim() || null,
      benchmarkProfile: pilotBenchmarkProfile.trim() || null,
      objectProfile: pilotObjectProfile.trim() || null,
      operationalProfile: pilotOperationalProfile.trim() || null,
      integrationEnvironment: pilotIntegrationEnvironment.trim() || null,
      rolloutReadiness: pilotRolloutReadiness.trim() || null,
      dataUsePermissions: {
        evaluateExistingPolicy: "granted" as const,
        siteSpecificAdaptation,
        retainImprovements,
        generalModelTraining,
      },
    }),
    [
      anonymizedOpportunitySummary,
      approvedRobotTeamEmails,
      buyerType,
      pilotIntegrationEnvironment,
      pilotBenchmarkProfile,
      pilotObjectProfile,
      pilotOperationalProfile,
      pilotOpportunityRequested,
      pilotOpportunityVisibility,
      pilotRolloutReadiness,
      siteSpecificAdaptation,
      retainImprovements,
      generalModelTraining,
    ],
  );

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
      (buyerType !== "site_operator" || commercializationPreference.trim().length > 0) &&
      (!pilotOpportunity.requested ||
        (pilotOpportunity.objectProfile &&
          pilotOpportunity.benchmarkProfile &&
          pilotOpportunity.operationalProfile &&
          pilotOpportunity.integrationEnvironment &&
          pilotOpportunity.rolloutReadiness &&
          (pilotOpportunity.visibility !== "anonymized" || pilotOpportunity.anonymizedSummary) &&
          (pilotOpportunity.visibility !== "approved_robot_teams" ||
            pilotOpportunity.approvedRobotTeamEmails.length > 0))) &&
      (buyerType === "site_operator" || budgetRange !== "") &&
      referralSource !== "" &&
      acceptedLegal,
    [
      acceptedLegal,
      budgetRange,
      buyerType,
      commercializationPreference,
      operatingConstraints,
      pilotOpportunity,
      referralSource,
      siteLocation,
      siteName,
      targetSiteType,
      taskStatement,
    ]
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
    setRequestedLanes(defaultRequestedLanesForBuyerType(nextBuyerType));
    if (nextBuyerType === "site_operator") {
      setProofPathPreference("need_guidance");
      setBudgetRange("Undecided/Unsure");
    } else {
      setPilotOpportunityRequested(false);
      setCommercializationPreference("");
      setBudgetRange((current) => (current === "Undecided/Unsure" ? "" : current));
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
      else if (buyerType === "site_operator" && !commercializationPreference.trim()) setErrorMessage("Please select the commercialization boundary.");
      else if (pilotOpportunity.requested && !pilotOpportunity.objectProfile) setErrorMessage("Please describe the objects and normal variability.");
      else if (pilotOpportunity.requested && !pilotOpportunity.benchmarkProfile) setErrorMessage("Please define the standardized benchmark without confidential facility details.");
      else if (pilotOpportunity.requested && !pilotOpportunity.operationalProfile) setErrorMessage("Please enter the workflow's cycle time, volume, shifts, exceptions, and downtime tolerance.");
      else if (pilotOpportunity.requested && !pilotOpportunity.integrationEnvironment) setErrorMessage("Please describe the software, network, and security integration environment.");
      else if (pilotOpportunity.requested && !pilotOpportunity.rolloutReadiness) setErrorMessage("Please name the internal owner, timing, and rollout scale.");
      else if (pilotOpportunity.requested && pilotOpportunity.visibility === "anonymized" && !pilotOpportunity.anonymizedSummary) setErrorMessage("Please provide the anonymized summary robot teams may see.");
      else if (pilotOpportunity.requested && pilotOpportunity.visibility === "approved_robot_teams" && pilotOpportunity.approvedRobotTeamEmails.length === 0) setErrorMessage("Please provide at least one approved robot-team work email.");
      else if (buyerType === "robot_team" && !budgetRange) setErrorMessage("Please select a budget range.");
      else if (!referralSource) setErrorMessage("Please tell us how you heard about Blueprint.");
      else setErrorMessage("Please accept the Terms of Service and Privacy Policy to continue.");
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
                  : buyerType === "site_operator" && !commercializationPreference.trim()
                    ? "missing_commercialization_boundary"
                    : pilotOpportunity.requested && !pilotOpportunity.objectProfile
                      ? "missing_pilot_object_profile"
                      : pilotOpportunity.requested && !pilotOpportunity.benchmarkProfile
                        ? "missing_pilot_benchmark_profile"
                      : pilotOpportunity.requested && !pilotOpportunity.operationalProfile
                        ? "missing_pilot_operational_profile"
                        : pilotOpportunity.requested && !pilotOpportunity.integrationEnvironment
                          ? "missing_pilot_integration_environment"
                          : pilotOpportunity.requested && !pilotOpportunity.rolloutReadiness
                            ? "missing_pilot_rollout_readiness"
                            : pilotOpportunity.requested && pilotOpportunity.visibility === "anonymized" && !pilotOpportunity.anonymizedSummary
                              ? "missing_pilot_anonymized_summary"
                              : pilotOpportunity.requested && pilotOpportunity.visibility === "approved_robot_teams" && pilotOpportunity.approvedRobotTeamEmails.length === 0
                                ? "missing_approved_robot_team_emails"
                    : buyerType === "robot_team" && !budgetRange
                      ? "missing_budget_range"
                      : !referralSource
                        ? "missing_referral_source"
                        : "missing_terms_acceptance",
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
      hasCommercializationPreference: Boolean(commercializationPreference.trim()),
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

      const username = contactName.toLowerCase().replace(/\s+/g, "_");
      const structuredIntakeRequestId = generateRequestId();
      const structuredDetails =
        [
          timeline ? `Timeline: ${timeline}` : null,
          workflowContext ? `Workflow context: ${workflowContext}` : null,
          operatingConstraints ? `Operating constraints: ${operatingConstraints}` : null,
          privacySecurityConstraints ? `Privacy/security constraints: ${privacySecurityConstraints}` : null,
          knownBlockers ? `Known blockers: ${knownBlockers}` : null,
        ]
          .filter(Boolean)
          .join("\n") || null;
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
        derivedScenePermission: commercializationPreference || null,
        pilotOpportunity,
        details: structuredDetails,
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
        pilotOpportunityOutcome: structuredIntakeDecision.pilotOpportunityOutcome,
        pilotOpportunityGateCriteria: structuredIntakeDecision.pilotOpportunityGateCriteria,
        missingPilotOpportunityFields: structuredIntakeDecision.missingPilotOpportunityFields,
        siteName,
        siteLocation,
        siteLocationMetadata: resolvePlaceLocationMetadata(siteLocation, siteLocationMetadata),
        targetSiteType: targetSiteType || undefined,
        taskStatement,
        proofPathPreference,
        workflowContext: workflowContext || undefined,
        operatingConstraints: operatingConstraints || undefined,
        privacySecurityConstraints: privacySecurityConstraints || undefined,
        derivedScenePermission: commercializationPreference || undefined,
        knownBlockers: knownBlockers || undefined,
        targetRobotTeam: targetRobotTeam || undefined,
        pilotOpportunityRequested: pilotOpportunity.requested,
        pilotOpportunityVisibility: pilotOpportunity.requested
          ? pilotOpportunity.visibility
          : undefined,
        timeline: timeline || undefined,
        demandAttribution: signupAnalyticsAttribution || null,
        // R047: record Terms of Service + Privacy Policy acceptance on the profile.
        acceptedTerms: true,
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        termsAcceptance: {
          accepted_terms: true,
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
          terms_url: TERMS_URL,
          privacy_url: PRIVACY_URL,
          accepted_at: timestamp,
        },
        createdDate: timestamp,
        lastLoginAt: timestamp,
        lastSessionDate: timestamp,
        numSessions: 1,
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
          commercializationPreferenceSet:
            buyerType === "site_operator" && Boolean(commercializationPreference.trim()),
          pilotOpportunityDossierSubmitted:
            pilotOpportunity.requested &&
            structuredIntakeDecision.missingPilotOpportunityFields.length === 0,
          teamContactConfirmed: false,
          completeIntakeReview: false,
          reviewQualifiedOpportunities: false,
          inviteTeam: false,
        },
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
          accountSignup: true,
          acceptedTerms: true,
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
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
          derivedScenePermission: commercializationPreference || undefined,
          knownBlockers: knownBlockers || undefined,
          targetRobotTeam: targetRobotTeam || undefined,
          pilotOpportunity: pilotOpportunity.requested ? pilotOpportunity : undefined,
          details: structuredDetails || undefined,
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
    acceptedLegal,
    budgetRange,
    buyerType,
    companySize,
    commercializationPreference,
    contactName,
    email,
    jobTitle,
    knownBlockers,
    operatingConstraints,
    organizationName,
    password,
    pilotOpportunity,
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

  const isSiteOperatorSignup = buyerType === "site_operator";
  const accessLabel = isSiteOperatorSignup
    ? "Site Operator Access Request"
    : "Robot Team Access Request";
  const stepTitle =
    step === 1
      ? "Organization details"
      : step === 2
        ? isSiteOperatorSignup
          ? "Role and site lane"
          : "Team and requested lane"
        : isSiteOperatorSignup
          ? "Site boundary intake"
          : "Site and workflow intake";
  const stepLead =
    step === 1
      ? isSiteOperatorSignup
        ? "Submit one workflow for the task discovery, site recreation, and robot-fit work that happens before onsite deployment."
        : "Join to discover captured workflows and test robot fit before committing deployment engineers or hardware."
      : step === 2
        ? isSiteOperatorSignup
          ? "Tell Blueprint who owns the facility context and whether the first path is private review, listing, or robot-team access review."
          : "Tell Blueprint who is evaluating the site and which lane should open first."
        : isSiteOperatorSignup
          ? "Describe one real workflow, its operating numbers, and the access boundary you control."
          : "Describe the robot, the target workflow, and what the onsite proof of concept would need to settle.";
  const visibleRequestedLanes = isSiteOperatorSignup
    ? REQUESTED_LANES.filter((lane) => lane.value === "qualification")
    : REQUESTED_LANES;

  return (
    <>
      <SEO
        title={`${accessLabel} | Blueprint`}
        description={
          isSiteOperatorSignup
            ? "Create a site-operator account to submit one workflow, control access, and review robot-team fit before onsite work."
            : "Create a robot-team account to discover captured workflows and run permissioned pre-deployment evaluations."
        }
        canonical="/signup/business"
        noIndex
      />

      <MinimalAccountLayout action={{ href: "/sign-in", label: "Sign in" }}>
        <section className="ms-signup ms-container">
              <div className="ms-signup-main">
                <div className="ms-signup-head">
                  <p className="ms-eyebrow">{accessLabel}</p>
                  <h1>{stepTitle}</h1>
                  <p>{stepLead}</p>

                  <p className="ms-signup-note">
                    Already have an account? <a href="/sign-in">Sign in</a> instead of starting a
                    second path. If the facility and the task are already settled, you can{" "}
                    <a
                      href={
                        isSiteOperatorSignup
                          ? "/contact/site-operator?source=signup-business"
                          : "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=signup-business"
                      }
                    >
                      {isSiteOperatorSignup ? "submit the site first" : "request a site review"}
                    </a>{" "}
                    or read <a href="/how-it-works">how the evaluation works</a>.
                  </p>
                </div>

                <div className="ms-signup-body">
                  <StepIndicator currentStep={step} totalSteps={3} />

                  <div className="ms-signup-card">
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
                              <Label htmlFor="organizationName" className={FIELD_LABEL_CLASS}>
                                Organization name
                              </Label>
                              <div className="relative mt-2">
                                <Building2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-runway-faint" />
                                <Input
                                  id="organizationName"
                                  className="h-12 pl-11"
                                  placeholder="Acme Operations"
                                  value={organizationName}
                                  onChange={(event) => setOrganizationName(event.target.value)}
                                />
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <Label htmlFor="email" className={FIELD_LABEL_CLASS}>
                                Work email
                              </Label>
                              <div className="relative mt-2">
                                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-runway-faint" />
                                <Input
                                  id="email"
                                  type="email"
                                  className="h-12 pl-11"
                                  placeholder="you@company.com"
                                  value={email}
                                  onChange={(event) => setEmail(event.target.value)}
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="password" className={FIELD_LABEL_CLASS}>
                                Password
                              </Label>
                              <div className="relative mt-2">
                                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-runway-faint" />
                                <Input
                                  id="password"
                                  type={showPassword ? "text" : "password"}
                                  className="h-12 pl-11"
                                  placeholder="At least 8 characters"
                                  value={password}
                                  onChange={(event) => setPassword(event.target.value)}
                                />
                              </div>
                              <button
                                type="button"
                                className="mt-2 text-sm text-runway-mute transition hover:text-runway-text"
                                onClick={() => setShowPassword((current) => !current)}
                              >
                                {showPassword ? "Hide password" : "Show password"}
                              </button>
                            </div>
                            <div>
                              <Label htmlFor="confirmPassword" className={FIELD_LABEL_CLASS}>
                                Confirm password
                              </Label>
                              <Input
                                id="confirmPassword"
                                type={showPassword ? "text" : "password"}
                                className="mt-2 h-12"
                                placeholder="Repeat password"
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                              />
                            </div>
                          </div>

                          <div className="border border-runway-line bg-runway-deep p-5">
                            <p className="text-sm leading-7 text-runway-mute">
                              Prefer Google? Authenticate now, then finish the intake details on
                              the next step.
                            </p>
                            <button
                              type="button"
                              className="runway-cta-ghost mt-4 disabled:opacity-50"
                              onClick={handleGoogleSignUp}
                              disabled={isSubmitting}
                            >
                              Continue with Google
                            </button>
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
                              <Label htmlFor="contactName" className={FIELD_LABEL_CLASS}>
                                Your name
                              </Label>
                              <div className="relative mt-2">
                                <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-runway-faint" />
                                <Input
                                  id="contactName"
                                  className="h-12 pl-11"
                                  placeholder="Ada Lovelace"
                                  value={contactName}
                                  onChange={(event) => setContactName(event.target.value)}
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="jobTitle" className={FIELD_LABEL_CLASS}>
                                Title
                              </Label>
                              <Input
                                id="jobTitle"
                                className="mt-2 h-12"
                                placeholder="Operations Lead"
                                value={jobTitle}
                                onChange={(event) => setJobTitle(event.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="phoneNumber" className={FIELD_LABEL_CLASS}>
                                Phone number
                              </Label>
                              <Input
                                id="phoneNumber"
                                className="mt-2 h-12"
                                placeholder="(555) 555-5555"
                                value={phoneNumber}
                                onChange={(event) => setPhoneNumber(event.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="companySize" className={FIELD_LABEL_CLASS}>
                                Company size
                              </Label>
                              <select
                                id="companySize"
                                className="runway-input mt-2 h-12 px-4"
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
                            <Label className={FIELD_LABEL_CLASS}>
                              Account path
                            </Label>
                            <RadioGroup value={buyerType} onValueChange={handleBuyerTypeChange} className="grid gap-3">
                              {BUYER_TYPES.map((option) => (
                                <label
                                  key={option.value}
                                  className="flex cursor-pointer items-start gap-4 border border-runway-line bg-runway-deep p-4 transition hover:border-runway-signal"
                                >
                                  <RadioGroupItem value={option.value} />
                                  <div>
                                    <div className="font-semibold text-runway-text">{option.label}</div>
                                    <p className="mt-1 text-sm leading-6 text-runway-mute">{option.description}</p>
                                  </div>
                                </label>
                              ))}
                            </RadioGroup>
                          </div>

                          <div className="space-y-3">
                            <Label className={FIELD_LABEL_CLASS}>
                              {isSiteOperatorSignup ? "Site review lane" : "Requested lane"}
                            </Label>
                            <div className="grid gap-3">
                              {visibleRequestedLanes.map((lane) => (
                                <label
                                  key={lane.value}
                                  className="flex cursor-pointer items-start gap-4 border border-runway-line bg-runway-deep p-4 transition hover:border-runway-signal"
                                >
                                  <Checkbox
                                    checked={requestedLanes.includes(lane.value)}
                                    onCheckedChange={() => toggleLane(lane.value)}
                                  />
                                  <div>
                                    <div className="font-semibold text-runway-text">{lane.label}</div>
                                    <p className="mt-1 text-sm leading-6 text-runway-mute">{lane.description}</p>
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
                              <Label htmlFor="siteName" className={FIELD_LABEL_CLASS}>
                                {buyerType === "site_operator" ? "Facility name" : "Site name"}
                              </Label>
                              <div className="relative mt-2">
                                <Building2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-runway-faint" />
                                <Input
                                  id="siteName"
                                  className="h-12 pl-11"
                                  placeholder={buyerType === "site_operator" ? "Brightleaf Books" : "Durham fulfillment center"}
                                  value={siteName}
                                  onChange={(event) => setSiteName(event.target.value)}
                                />
                              </div>
                            </div>
                            <PlaceAutocompleteInput
                              id="siteLocation"
                              label="Site location"
                              labelClassName={FIELD_LABEL_CLASS}
                              inputWrapperClassName="relative mt-2"
                              inputClassName="runway-input h-12 pl-11"
                              icon={<MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-runway-faint" />}
                              placeholder="Durham, NC"
                              value={siteLocation}
                              onChange={setSiteLocation}
                              onPlaceSelect={setSiteLocationMetadata}
                            />
                            {buyerType === "robot_team" ? (
                              <div className="md:col-span-2">
                                <Label htmlFor="targetSiteType" className={FIELD_LABEL_CLASS}>
                                  Target site class
                                </Label>
                                <Input
                                  id="targetSiteType"
                                  className="mt-2 h-12"
                                  placeholder="Warehouse, hotel, grocery backroom, hospital corridor"
                                  value={targetSiteType}
                                  onChange={(event) => setTargetSiteType(event.target.value)}
                                />
                              </div>
                            ) : null}
                            <div className="md:col-span-2">
                              <Label htmlFor="taskStatement" className={FIELD_LABEL_CLASS}>
                                {buyerType === "site_operator" ? "Operator intent" : "Task statement"}
                              </Label>
                              <div className="relative mt-2">
                                <Target className="absolute left-4 top-4 h-4 w-4 text-runway-faint" />
                                <Textarea
                                  id="taskStatement"
                                  className="min-h-28 pl-11"
                                  placeholder={buyerType === "site_operator" ? "What moves from where to where, how often, and what must never go wrong?" : "Which robot and workflow should Blueprint test before an onsite visit?"}
                                  value={taskStatement}
                                  onChange={(event) => setTaskStatement(event.target.value)}
                                />
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <Label htmlFor="workflowContext" className={FIELD_LABEL_CLASS}>
                                Workflow context
                              </Label>
                              <div className="relative mt-2">
                                <Route className="absolute left-4 top-4 h-4 w-4 text-runway-faint" />
                                <Textarea
                                  id="workflowContext"
                                  className="min-h-24 pl-11"
                                  placeholder="Describe start and end points, handoffs, objects, timing, exceptions, traffic, and zone boundaries."
                                  value={workflowContext}
                                  onChange={(event) => setWorkflowContext(event.target.value)}
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="operatingConstraints" className={FIELD_LABEL_CLASS}>
                                {buyerType === "site_operator" ? "Access rules" : "Operating constraints"}
                              </Label>
                              <Textarea
                                id="operatingConstraints"
                                className="mt-2 min-h-24"
                                placeholder={buyerType === "site_operator" ? "Hours, access windows, escort needs, restricted areas." : "Hours, access windows, safety rules, bottlenecks."}
                                value={operatingConstraints}
                                onChange={(event) => setOperatingConstraints(event.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="privacySecurityConstraints" className={FIELD_LABEL_CLASS}>
                                Privacy and security constraints
                              </Label>
                              <Textarea
                                id="privacySecurityConstraints"
                                className="mt-2 min-h-24"
                                placeholder="Restricted zones, camera restrictions, masked areas."
                                value={privacySecurityConstraints}
                                onChange={(event) => setPrivacySecurityConstraints(event.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="knownBlockers" className={FIELD_LABEL_CLASS}>
                                Known blockers
                              </Label>
                              <Textarea
                                id="knownBlockers"
                                className="mt-2 min-h-24"
                                placeholder="Call out obvious blockers or open questions."
                                value={knownBlockers}
                                onChange={(event) => setKnownBlockers(event.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="targetRobotTeam" className={FIELD_LABEL_CLASS}>
                                {buyerType === "site_operator" ? "Relevant robot teams" : "Target robot team or embodiment"}
                              </Label>
                              <div className="relative mt-2">
                                <Users className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-runway-faint" />
                                <Input
                                  id="targetRobotTeam"
                                  className="h-12 pl-11"
                                  placeholder={buyerType === "site_operator" ? "Optional buyer category or robot use case" : "Optional"}
                                  value={targetRobotTeam}
                                  onChange={(event) => setTargetRobotTeam(event.target.value)}
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="proofPathPreference" className={FIELD_LABEL_CLASS}>
                                Proof path
                              </Label>
                              <select
                                id="proofPathPreference"
                                className="runway-input mt-2 h-12 px-4"
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
                              <Label htmlFor="timeline" className={FIELD_LABEL_CLASS}>
                                Timing
                              </Label>
                              <Input
                                id="timeline"
                                className="mt-2 h-12"
                                placeholder="This month, this quarter, exploring"
                                value={timeline}
                                onChange={(event) => setTimeline(event.target.value)}
                              />
                            </div>
                            {isSiteOperatorSignup ? (
                              <PilotOpportunityFields
                                requested={pilotOpportunityRequested}
                                onRequestedChange={setPilotOpportunityRequested}
                                visibility={pilotOpportunityVisibility}
                                onVisibilityChange={setPilotOpportunityVisibility}
                                approvedRobotTeamEmails={approvedRobotTeamEmails}
                                onApprovedRobotTeamEmailsChange={setApprovedRobotTeamEmails}
                                anonymizedSummary={anonymizedOpportunitySummary}
                                onAnonymizedSummaryChange={setAnonymizedOpportunitySummary}
                                benchmarkProfile={pilotBenchmarkProfile}
                                onBenchmarkProfileChange={setPilotBenchmarkProfile}
                                objectProfile={pilotObjectProfile}
                                onObjectProfileChange={setPilotObjectProfile}
                                operationalProfile={pilotOperationalProfile}
                                onOperationalProfileChange={setPilotOperationalProfile}
                                integrationEnvironment={pilotIntegrationEnvironment}
                                onIntegrationEnvironmentChange={setPilotIntegrationEnvironment}
                                rolloutReadiness={pilotRolloutReadiness}
                                onRolloutReadinessChange={setPilotRolloutReadiness}
                                siteSpecificAdaptation={siteSpecificAdaptation}
                                onSiteSpecificAdaptationChange={setSiteSpecificAdaptation}
                                retainImprovements={retainImprovements}
                                onRetainImprovementsChange={setRetainImprovements}
                                generalModelTraining={generalModelTraining}
                                onGeneralModelTrainingChange={setGeneralModelTraining}
                              />
                            ) : null}
                            {isSiteOperatorSignup ? (
                              <>
                                <div>
                                  <Label htmlFor="commercializationPreference" className={FIELD_LABEL_CLASS}>
                                    Commercialization boundary
                                  </Label>
                                  <select
                                    id="commercializationPreference"
                                    className="runway-input mt-2 h-12 px-4"
                                    value={commercializationPreference}
                                    onChange={(event) =>
                                      setCommercializationPreference(event.target.value as CommercializationBoundary)
                                    }
                                  >
                                    <option value="">Select boundary</option>
                                    {COMMERCIALIZATION_BOUNDARY_OPTIONS.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="border border-runway-line bg-runway-deep p-4 text-sm leading-6 text-runway-mute">
                                  <p className="font-semibold text-runway-text">Site submission is free.</p>
                                  <p className="mt-2">
                                    Blueprint reviews access, privacy, and commercialization boundaries
                                    before changing public listing or robot-team access.
                                  </p>
                                </div>
                              </>
                            ) : (
                              <div>
                                <Label htmlFor="budgetRange" className={FIELD_LABEL_CLASS}>
                                  Budget range
                                </Label>
                                <select
                                  id="budgetRange"
                                  className="runway-input mt-2 h-12 px-4"
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
                            )}
                            <div className="md:col-span-2">
                              <Label htmlFor="referralSource" className={FIELD_LABEL_CLASS}>
                                How did you hear about Blueprint?
                              </Label>
                              <select
                                id="referralSource"
                                className="runway-input mt-2 h-12 px-4"
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

                          <div className="border border-runway-line bg-runway-deep p-5 text-sm text-runway-mute">
                            <div className="flex items-center gap-2 font-semibold text-runway-text">
                              <Shield className="h-4 w-4" />
                              What happens after signup
                            </div>
                            <p className="mt-3 leading-7">
                              Blueprint routes the request into the intake review hub so the team
                              can confirm the site, task, requested decision, constraints, and whether a
                              scoping call is needed before authorizing a Task Evaluation Run.
                            </p>
                          </div>

                          <div className="border border-runway-line bg-runway-deep p-5">
                            <label className="flex items-start gap-3">
                              <Checkbox
                                checked={acceptedLegal}
                                onCheckedChange={(checked) => setAcceptedLegal(Boolean(checked))}
                                className="mt-1"
                                aria-label="Accept the Terms of Service and Privacy Policy"
                              />
                              <span className="text-sm leading-6 text-runway-mute">
                                I agree to Blueprint&apos;s{" "}
                                <a
                                  href={TERMS_URL}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-semibold text-runway-text underline-offset-4 hover:underline"
                                >
                                  Terms of Service
                                </a>{" "}
                                and{" "}
                                <a
                                  href={PRIVACY_URL}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-semibold text-runway-text underline-offset-4 hover:underline"
                                >
                                  Privacy Policy
                                </a>
                                , and I am authorized to create this account on behalf of my
                                organization.
                              </span>
                            </label>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    {errorMessage ? (
                      <div className="mt-5 border border-runway-red-dim bg-runway-raised px-4 py-3 text-sm text-runway-red">
                        {errorMessage}
                      </div>
                    ) : null}

                    <div className="mt-6 flex flex-col gap-3 border-t border-runway-line pt-6 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        onClick={handleBack}
                        disabled={step === 1 || isSubmitting}
                        className="inline-flex items-center justify-start text-sm font-medium text-runway-mute transition hover:text-runway-text disabled:opacity-50"
                      >
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back
                      </button>

                      {step < 3 ? (
                        <button
                          type="button"
                          onClick={handleNext}
                          disabled={isSubmitting}
                          className="runway-cta disabled:opacity-50"
                        >
                          Continue
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSubmit}
                          disabled={isSubmitting}
                          className="runway-cta disabled:opacity-50"
                        >
                          {isSubmitting ? "Creating account..." : "Submit request"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <aside className="ms-signup-rail" aria-label="Why exact-site context matters">
                <p className="ms-eyebrow">Why exact-site context matters</p>
                <div>
                  <h2>Robots perform in the real world.</h2>
                  <p>
                    A capture of the actual workcell carries the clearances, clutter, lighting, and
                    reach that a generic scene cannot.
                  </p>
                </div>
                <div>
                  <h2>Fewer unknowns before travel.</h2>
                  <p>
                    Comparing candidates on your real task is what tells you which one is worth the
                    cost of a physical pilot.
                  </p>
                </div>
                <div>
                  <h2>Private by default.</h2>
                  <p>
                    Every access request is reviewed. Captures, runs, and results stay scoped to
                    your team unless you decide otherwise.
                  </p>
                </div>
                <div>
                  <p className="ms-eyebrow">Current step</p>
                  <h2>{step === 1 ? "Organization" : step === 2 ? "Team" : "Site & task"}</h2>
                  <p>
                    {step === 1
                      ? "Open the request with company and account details."
                      : step === 2
                        ? isSiteOperatorSignup
                          ? "Confirm the site-owner lane before Blueprint reviews access."
                          : "Define who is evaluating the site and which lane should open first."
                        : isSiteOperatorSignup
                          ? "Anchor the free submission in one facility and a clear access boundary."
                          : "Anchor the request in one real facility and one task question."}
                  </p>
                </div>
              </aside>
        </section>
      </MinimalAccountLayout>
    </>
  );
}
