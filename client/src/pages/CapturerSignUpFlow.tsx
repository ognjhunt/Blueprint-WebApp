"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  ArrowRight,
  Copy,
  ChevronLeft,
  CircleCheckBig,
  Compass,
  ExternalLink,
  Mail,
  MapPin,
  QrCode,
  Shield,
  Smartphone,
  Sparkles,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SEO } from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { analyticsEvents, getSafeErrorType } from "@/lib/analytics";
import { getCaptureAppPlaceholderUrl } from "@/lib/client-env";

const EQUIPMENT_OPTIONS = [
  { value: "iphone", label: "iPhone", detail: "Best fit for mobile indoor capture." },
  { value: "ipad", label: "iPad", detail: "Useful when you already work from a tablet." },
  { value: "smart_glasses", label: "Smart glasses", detail: "Good fit for repeat walkthroughs." },
] as const;

const AVAILABILITY_OPTIONS = [
  { value: "weekdays", label: "Weekdays" },
  { value: "evenings", label: "Evenings" },
  { value: "weekends", label: "Weekends" },
  { value: "flexible", label: "Flexible" },
] as const;

const REFERRAL_OPTIONS = [
  { value: "invite_or_access_code", label: "Invite or access code" },
  { value: "friend", label: "Referral" },
  { value: "event", label: "Event" },
  { value: "search", label: "Search" },
  { value: "other", label: "Other" },
] as const;

type EquipmentValue = (typeof EQUIPMENT_OPTIONS)[number]["value"];
type AvailabilityValue = (typeof AVAILABILITY_OPTIONS)[number]["value"];
type ReferralValue = (typeof REFERRAL_OPTIONS)[number]["value"];

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  return value.replace(/\D/g, "").length >= 10;
}

function buildUsername(name: string, fallbackEmail: string) {
  const source = name.trim() || fallbackEmail.split("@")[0] || "capturer";
  return source.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "capturer";
}

function StepDots({ currentStep }: { currentStep: 1 | 2 }) {
  return (
    <div className="flex items-center gap-3 text-sm text-[color:var(--ink-soft)]">
      {[1, 2].map((step) => (
        <React.Fragment key={step}>
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition ${
              step <= currentStep
                ? "border-[color:var(--leaf)] bg-[color:var(--leaf)] text-white"
                : "border-[color:var(--line-strong)] bg-white text-[color:var(--ink-muted)]"
            }`}
          >
            {step}
          </div>
          {step < 2 ? (
            <div
              className={`h-px w-12 ${
                step < currentStep ? "bg-[color:var(--leaf)]" : "bg-[color:var(--line)]"
              }`}
            />
          ) : null}
        </React.Fragment>
      ))}
      <span>Step {currentStep} of 2</span>
    </div>
  );
}

export default function CapturerSignUpFlow() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [authMethod, setAuthMethod] = useState<"password" | "google">("password");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [phoneNumber, setPhoneNumber] = useState("");
  const [market, setMarket] = useState("");
  const [availability, setAvailability] = useState<AvailabilityValue>("flexible");
  const [equipment, setEquipment] = useState<EquipmentValue[]>(["iphone"]);
  const [accessCode, setAccessCode] = useState("");
  const [referralSource, setReferralSource] = useState<ReferralValue | "">("search");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [successSummary, setSuccessSummary] = useState<{ name: string; market: string } | null>(
    null,
  );
  const [captureAppQrCode, setCaptureAppQrCode] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const captureAppUrl = useMemo(() => getCaptureAppPlaceholderUrl(), []);

  const step1Valid = useMemo(
    () =>
      fullName.trim().length > 1 &&
      isValidEmail(email) &&
      password.length >= 8 &&
      password === confirmPassword,
    [confirmPassword, email, fullName, password],
  );

  const step2Valid = useMemo(
    () =>
      market.trim().length > 2 &&
      isValidPhone(phoneNumber) &&
      equipment.length > 0 &&
      referralSource !== "" &&
      agreedToTerms,
    [agreedToTerms, equipment.length, market, phoneNumber, referralSource],
  );

  const toggleEquipment = useCallback((value: EquipmentValue) => {
    setEquipment((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }, []);

  useEffect(() => {
    analyticsEvents.capturerSignupStarted();
  }, []);

  useEffect(() => {
    analyticsEvents.capturerSignupStepViewed(
      step,
      step === 1 ? "account_basics" : "market_fit",
    );
  }, [step]);

  useEffect(() => {
    let active = true;

    async function generateQrCode() {
      try {
        const qrcode = await import("qrcode");
        const dataUrl = await qrcode.toDataURL(captureAppUrl, {
          width: 320,
          margin: 1,
          color: {
            dark: "#2f2a23",
            light: "#fffdf8",
          },
        });
        if (active) {
          setCaptureAppQrCode(dataUrl);
        }
      } catch (error) {
        console.error("Failed to generate capture app QR code:", error);
      }
    }

    void generateQrCode();

    return () => {
      active = false;
    };
  }, [captureAppUrl]);

  const handleGoogleSignUp = useCallback(async () => {
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const { signInWithGoogle } = await import("@/lib/firebase");
      const user = await signInWithGoogle();

      sessionStorage.setItem(
        "capturerGoogleAuthUser",
        JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        }),
      );

      if (user.displayName) setFullName(user.displayName);
      if (user.email) setEmail(user.email);
      setAuthMethod("google");
      analyticsEvents.capturerSignupStepCompleted(1, "account_basics", "google");
      setStep(2);
    } catch (error: any) {
      analyticsEvents.capturerSignupFailed({
        stage: "google_continue",
        stepNumber: 1,
        errorType: getSafeErrorType(error),
      });
      setErrorMessage(error.message || "Failed to continue with Google.");
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const handleContinue = useCallback(() => {
    setErrorMessage("");

    if (!step1Valid) {
      let validationError = "password_mismatch";
      if (!fullName.trim()) {
        validationError = "missing_full_name";
        setErrorMessage("Enter your full name.");
      } else if (!isValidEmail(email)) {
        validationError = "invalid_email";
        setErrorMessage("Enter a valid email address.");
      } else if (password.length < 8) {
        validationError = "weak_password";
        setErrorMessage("Password must be at least 8 characters.");
      } else {
        setErrorMessage("Passwords do not match.");
      }
      analyticsEvents.capturerSignupFailed({
        stage: "step_validation",
        stepNumber: 1,
        errorType: validationError,
      });
      return;
    }

    analyticsEvents.capturerSignupStepCompleted(1, "account_basics", authMethod);
    setStep(2);
  }, [authMethod, email, fullName, password, step1Valid]);

  const handleSubmit = useCallback(async () => {
    setErrorMessage("");

    if (!step2Valid) {
      let validationError = "missing_market";
      if (!market.trim()) {
        setErrorMessage("Tell us your home market.");
      } else if (!isValidPhone(phoneNumber)) {
        validationError = "invalid_phone";
        setErrorMessage("Enter a valid phone number.");
      } else if (equipment.length === 0) {
        validationError = "missing_equipment";
        setErrorMessage("Select at least one capture device.");
      } else if (!referralSource) {
        validationError = "missing_referral_source";
        setErrorMessage("Tell us how you got access.");
      } else {
        validationError = "missing_terms_acceptance";
        setErrorMessage("You need to accept the terms to apply.");
      }
      analyticsEvents.capturerSignupFailed({
        stage: "step_validation",
        stepNumber: 2,
        errorType: validationError,
      });
      return;
    }

    setIsSubmitting(true);
    analyticsEvents.capturerSignupSubmitted({
      authMethod,
      equipmentCount: equipment.length,
      availability,
      referralSource,
    });

    try {
      const { db } = await import("@/lib/firebase");
      const timestamp = serverTimestamp();

      let uid: string;
      let userEmail: string;
      let displayName = fullName.trim();
      let photoURL = "";

      const googleAuthUser = sessionStorage.getItem("capturerGoogleAuthUser");
      if (googleAuthUser) {
        const parsed = JSON.parse(googleAuthUser) as {
          uid: string;
          email: string;
          displayName?: string;
          photoURL?: string;
        };
        uid = parsed.uid;
        userEmail = parsed.email;
        displayName = parsed.displayName?.trim() || displayName;
        photoURL = parsed.photoURL || "";
        sessionStorage.removeItem("capturerGoogleAuthUser");
      } else {
        const auth = getAuth();
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        uid = userCredential.user.uid;
        userEmail = email;
      }

      const normalizedName = displayName || fullName.trim();
      const username = buildUsername(normalizedName, userEmail);

      await setDoc(doc(db, "users", uid), {
        uid,
        email: userEmail,
        name: normalizedName,
        displayName: normalizedName,
        photoURL,
        username,
        phoneNumber,
        role: "capturer",
        roles: ["capturer"],
        planType: "capturer",
        capturerApplicationStatus: "pending_review",
        capturerMarket: market.trim(),
        capturerEquipment: equipment,
        capturerAvailability: availability,
        capturerReferralSource: (accessCode.trim() ? "invite_or_access_code" : referralSource) as ReferralValue,
        capturerAccessCode: accessCode.trim() || null,
        createdDate: timestamp,
        lastLoginAt: timestamp,
        lastSessionDate: timestamp,
        numSessions: 1,
        uploadedContentCount: 0,
        collectedContentCount: 0,
        credits: 0,
        finishedOnboarding: true,
        onboardingStep: "completed",
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
        mostFrequentLocation: market.trim(),
        deviceTypes: equipment,
        billingHistory: [],
        paymentMethods: [],
      });

      analyticsEvents.capturerCohortEntered({
        market: market.trim(),
        cohortSource: referralSource,
        accessPath: accessCode.trim() ? "invite_or_access_code" : referralSource,
        hasAccessCode: Boolean(accessCode.trim()),
        equipmentCount: equipment.length,
        availability,
        applicationStatus: "pending_review",
      });

      setSuccessSummary({
        name: normalizedName.split(" ")[0] || normalizedName,
        market: market.trim(),
      });
      analyticsEvents.capturerSignupCompleted({
        authMethod,
        equipmentCount: equipment.length,
        availability,
        referralSource,
      });
      setIsComplete(true);
    } catch (error: any) {
      analyticsEvents.capturerSignupFailed({
        stage: "account_creation",
        stepNumber: 2,
        errorType: getSafeErrorType(error),
      });
      if (error.code === "auth/email-already-in-use") {
        setErrorMessage("An account with this email already exists.");
      } else {
        setErrorMessage(error.message || "Failed to create your capturer account.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    accessCode,
    authMethod,
    availability,
    email,
    equipment,
    fullName,
    market,
    password,
    phoneNumber,
    referralSource,
    step2Valid,
  ]);

  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(captureAppUrl);
      setCopyState("copied");
    } catch (error) {
      console.error("Failed to copy capture app URL:", error);
      setCopyState("failed");
    } finally {
      window.setTimeout(() => setCopyState("idle"), 1800);
    }
  }, [captureAppUrl]);

  return (
    <>
      <SEO
        title="Capturer Access | Blueprint"
        description="Apply for capturer access and complete the Blueprint mobile capture handoff."
        canonical="/signup/capturer"
        noIndex={true}
      />
      <main
        className="min-h-screen bg-[color:var(--paper)] px-4 py-10 text-[color:var(--ink)]"
        style={
          {
            "--paper": "oklch(0.985 0.012 95)",
            "--paper-strong": "oklch(0.962 0.024 95)",
            "--panel": "oklch(0.995 0.008 95)",
            "--ink": "oklch(0.23 0.03 80)",
            "--ink-soft": "oklch(0.4 0.024 80)",
            "--ink-muted": "oklch(0.56 0.018 80)",
            "--line": "oklch(0.9 0.02 90)",
            "--line-strong": "oklch(0.83 0.03 88)",
            "--leaf": "oklch(0.63 0.16 149)",
            "--leaf-deep": "oklch(0.51 0.12 149)",
            "--amber": "oklch(0.78 0.13 82)",
            "--rose": "oklch(0.64 0.19 26)",
          } as React.CSSProperties
        }
      >
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="relative overflow-hidden rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--paper-strong)] p-7 sm:p-8">
          <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top_left,_rgba(55,145,86,0.18),_transparent_62%)]" />
          <div className="relative space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line-strong)] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--leaf-deep)]">
              <Compass className="h-3.5 w-3.5" />
              Capturer access application
            </div>

            <div className="space-y-4">
              <h1 className="max-w-md text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                Apply on web. Capture in the Blueprint app.
              </h1>
              <p className="max-w-lg text-base leading-7 text-[color:var(--ink-soft)]">
                Capturer access is invite- and code-gated. This page is for account creation and application review. Actual capture work happens in Blueprint Capture, not the operator dashboard.
              </p>
              <p className="max-w-lg text-sm leading-6 text-[color:var(--ink-soft)]">
                Robot teams and site operators should use the{" "}
                <a className="font-semibold text-[color:var(--leaf-deep)] underline-offset-4 hover:underline" href="/signup/business">
                  Buyer access request
                </a>
                {" "}or the{" "}
                <a className="font-semibold text-[color:var(--leaf-deep)] underline-offset-4 hover:underline" href="/book-exact-site-review">
                  exact-site scoping call
                </a>
                {" "}instead of this capturer path.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[color:var(--line)] bg-white/85 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
                  Session length
                </p>
                <p className="mt-3 text-2xl font-semibold">15-30 min</p>
                <p className="mt-1 text-sm text-[color:var(--ink-soft)]">Short, repeatable site walks.</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--line)] bg-white/85 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
                  Gear
                </p>
                <p className="mt-3 text-2xl font-semibold">Phone first</p>
                <p className="mt-1 text-sm text-[color:var(--ink-soft)]">Smart glasses supported when available.</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--line)] bg-white/85 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
                  Web role
                </p>
                <p className="mt-3 text-2xl font-semibold">Apply + status</p>
                <p className="mt-1 text-sm text-[color:var(--ink-soft)]">Not the primary work surface.</p>
              </div>
            </div>

              <div className="rounded-[1.6rem] border border-[color:var(--line-strong)] bg-[color:var(--panel)] p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
                  What happens next
                </p>
                <ol className="mt-4 space-y-4 text-sm leading-6 text-[color:var(--ink-soft)]">
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--leaf)] text-xs font-semibold text-white">
                      1
                    </span>
                    Create your account and tell us where you can capture. If you have an access or invite code, include it so your application routes correctly.
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--amber)] text-xs font-semibold text-white">
                      2
                    </span>
                    Your application enters review. We confirm market fit, device availability, and cohort capacity before approval.
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--leaf)] text-xs font-semibold text-white">
                      3
                    </span>
                    Approved capturers receive mobile access instructions and complete sessions in Blueprint Capture.
                  </li>
                </ol>
              </div>

            <div className="rounded-2xl border border-dashed border-[color:var(--line-strong)] px-4 py-3 text-sm text-[color:var(--ink-soft)]">
              For site operators or robot teams, use{" "}
              <a className="font-semibold text-[color:var(--leaf-deep)] underline-offset-4 hover:underline" href="/signup/business">
                business signup
              </a>
              .
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--panel)] p-6 shadow-[0_24px_80px_rgba(76,68,46,0.08)] sm:p-8">
          <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[radial-gradient(circle,_rgba(232,171,58,0.28),_transparent_70%)]" />
          {!isComplete ? (
            <motion.div
              key={`step-${step}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="relative"
            >
              <div className="flex flex-col gap-4 border-b border-[color:var(--line)] pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[color:var(--leaf-deep)]">Capturer application</p>
              <h2 className="mt-1 text-3xl font-semibold tracking-[-0.04em]">
                {step === 1 ? "Create your account" : "Tell us where you can work"}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--ink-soft)]">
                {step === 1
                  ? "Keep the web form short. We only need enough to open your account and move you into the right market."
                  : "This should feel more like a worker application than a site intake. No organization fields, no buyer workflow questions. Access is invite- and code-gated."}
                  </p>
                </div>
                <StepDots currentStep={step} />
              </div>

              <div className="mt-8 space-y-7">
                {step === 1 ? (
                  <>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Label htmlFor="fullName" className="text-[color:var(--ink)]">
                          Full name
                        </Label>
                        <div className="relative mt-2">
                          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-muted)]" />
                          <Input
                            id="fullName"
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                            placeholder="Jordan Lee"
                            className="h-12 rounded-2xl border-[color:var(--line-strong)] pl-10"
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <Label htmlFor="email" className="text-[color:var(--ink)]">
                          Email
                        </Label>
                        <div className="relative mt-2">
                          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-muted)]" />
                          <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="you@example.com"
                            className="h-12 rounded-2xl border-[color:var(--line-strong)] pl-10"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="password" className="text-[color:var(--ink)]">
                          Password
                        </Label>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="At least 8 characters"
                          className="mt-2 h-12 rounded-2xl border-[color:var(--line-strong)]"
                        />
                      </div>

                      <div>
                        <Label htmlFor="confirmPassword" className="text-[color:var(--ink)]">
                          Confirm password
                        </Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          placeholder="Repeat password"
                          className="mt-2 h-12 rounded-2xl border-[color:var(--line-strong)]"
                        />
                      </div>
                    </div>

                    <div className="rounded-[1.6rem] border border-[color:var(--line)] bg-[color:var(--paper)] p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--ink)]">
                            Prefer Google?
                          </p>
                          <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
                            Use Google to skip retyping your name and email, then finish your market details here.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleGoogleSignUp}
                          disabled={isSubmitting}
                          className="rounded-full border-[color:var(--line-strong)]"
                        >
                          Continue with Google
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Label htmlFor="market" className="text-[color:var(--ink)]">
                          Home market
                        </Label>
                        <div className="relative mt-2">
                          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-muted)]" />
                          <Input
                            id="market"
                            value={market}
                            onChange={(event) => setMarket(event.target.value)}
                            placeholder="Raleigh-Durham, NC"
                            className="h-12 rounded-2xl border-[color:var(--line-strong)] pl-10"
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <Label htmlFor="phoneNumber" className="text-[color:var(--ink)]">
                          Phone number
                        </Label>
                        <Input
                          id="phoneNumber"
                          value={phoneNumber}
                          onChange={(event) => setPhoneNumber(event.target.value)}
                          placeholder="(555) 555-5555"
                          className="mt-2 h-12 rounded-2xl border-[color:var(--line-strong)]"
                        />
                      </div>
                    </div>

                    <div className="rounded-[1.6rem] border border-[color:var(--amber)]/30 bg-[color:var(--amber)]/8 p-5">
                      <div className="flex items-start gap-3">
                        <Shield className="mt-0.5 h-5 w-5 text-[color:var(--amber)]" />
                        <div>
                          <p className="font-semibold text-[color:var(--ink)]">Gated access and approval</p>
                          <p className="mt-1 text-sm leading-6 text-[color:var(--ink-soft)]">
                            Blueprint capturer access is invite- and code-gated. Submitting this application does not guarantee approval. We review each submission for market fit and device availability before sending capture onboarding instructions.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <Label htmlFor="accessCode" className="text-[color:var(--ink)]">
                        Access or invite code <span className="text-[color:var(--ink-muted)]">(if you have one)</span>
                      </Label>
                      <div className="relative mt-2">
                        <Shield className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-muted)]" />
                        <Input
                          id="accessCode"
                          value={accessCode}
                          onChange={(event) => setAccessCode(event.target.value)}
                          placeholder="Enter your access or invite code"
                          className="h-12 rounded-2xl border-[color:var(--line-strong)] pl-10"
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-[color:var(--ink-muted)]">
                        If someone gave you a code, enter it here. It helps us route your application faster.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--ink)]">What can you capture with?</p>
                        <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
                          Select the devices you can reliably use for indoor walkthroughs.
                        </p>
                      </div>
                      <div className="grid gap-3">
                        {EQUIPMENT_OPTIONS.map((option) => {
                          const checked = equipment.includes(option.value);
                          return (
                            <label
                              key={option.value}
                              className={`flex cursor-pointer items-start gap-4 rounded-[1.4rem] border p-4 transition ${
                                checked
                                  ? "border-[color:var(--leaf)] bg-[color:var(--paper)]"
                                  : "border-[color:var(--line)] bg-white"
                              }`}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleEquipment(option.value)}
                                className="mt-0.5"
                              />
                              <div>
                                <p className="font-semibold text-[color:var(--ink)]">{option.label}</p>
                                <p className="mt-1 text-sm text-[color:var(--ink-soft)]">{option.detail}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--ink)]">Availability</p>
                        <RadioGroup
                          value={availability}
                          onValueChange={(value) => setAvailability(value as AvailabilityValue)}
                          className="mt-3 grid gap-2"
                        >
                          {AVAILABILITY_OPTIONS.map((option) => (
                            <label
                              key={option.value}
                              className="flex items-center gap-3 rounded-2xl border border-[color:var(--line)] px-4 py-3"
                            >
                              <RadioGroupItem value={option.value} id={option.value} />
                              <span className="text-sm text-[color:var(--ink)]">{option.label}</span>
                            </label>
                          ))}
                        </RadioGroup>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-[color:var(--ink)]">How did you get access?</p>
                        <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
                          If you were invited or given an access code, select that here so we can route review correctly.
                        </p>
                        <RadioGroup
                          value={referralSource}
                          onValueChange={(value) => setReferralSource(value as ReferralValue)}
                          className="mt-3 grid gap-2"
                        >
                          {REFERRAL_OPTIONS.map((option) => (
                            <label
                              key={option.value}
                              className="flex items-center gap-3 rounded-2xl border border-[color:var(--line)] px-4 py-3"
                            >
                              <RadioGroupItem value={option.value} id={`ref-${option.value}`} />
                              <span className="text-sm text-[color:var(--ink)]">{option.label}</span>
                            </label>
                          ))}
                        </RadioGroup>
                      </div>
                    </div>

                    <div className="rounded-[1.6rem] border border-[color:var(--line)] bg-[color:var(--paper)] p-5">
                      <label className="flex items-start gap-3">
                        <Checkbox
                          checked={agreedToTerms}
                          onCheckedChange={(checked) => setAgreedToTerms(Boolean(checked))}
                          className="mt-1"
                        />
                        <span className="text-sm leading-6 text-[color:var(--ink-soft)]">
                          I understand this is an application for capturer access, not an open
                          signup. Approval is not guaranteed — Blueprint reviews each submission for
                          market fit and device availability before granting capture access. Actual
                          capture sessions, verification, and payout setup happen in Blueprint
                          Capture. I agree to Blueprint&apos;s{" "}
                          <a href="/terms" className="font-semibold text-[color:var(--leaf-deep)] underline-offset-4 hover:underline">
                            Terms
                          </a>{" "}
                          and{" "}
                          <a href="/privacy" className="font-semibold text-[color:var(--leaf-deep)] underline-offset-4 hover:underline">
                            Privacy Policy
                          </a>
                          .
                        </span>
                      </label>
                    </div>
                  </>
                )}

                {errorMessage ? (
                  <div className="rounded-2xl border border-[color:var(--rose)]/30 bg-[color:var(--rose)]/8 px-4 py-3 text-sm text-[color:var(--rose)]">
                    {errorMessage}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 border-t border-[color:var(--line)] pt-6 sm:flex-row sm:items-center sm:justify-between">
                  {step === 2 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep(1)}
                      className="justify-start rounded-full px-0 text-[color:var(--ink-soft)] hover:bg-transparent hover:text-[color:var(--ink)]"
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                  ) : (
                    <a
                      href="/capture"
                      className="inline-flex items-center text-sm font-medium text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back to capture overview
                    </a>
                  )}

                  <Button
                    type="button"
                    onClick={step === 1 ? handleContinue : handleSubmit}
                    disabled={isSubmitting}
                    className="rounded-full bg-[color:var(--ink)] px-6 text-white hover:bg-[color:var(--leaf-deep)]"
                  >
                    {isSubmitting ? "Submitting..." : step === 1 ? "Continue" : "Create capturer account"}
                    {!isSubmitting ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="capturer-success"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="relative flex h-full flex-col justify-between"
            >
              <div>
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--leaf)] text-white">
                  <CircleCheckBig className="h-7 w-7" />
                </div>
                <h2 className="mt-6 text-3xl font-semibold tracking-[-0.04em]">
                  Application submitted.
                </h2>
                <p className="mt-3 max-w-xl text-base leading-7 text-[color:var(--ink-soft)]">
                  {successSummary
                    ? `${successSummary.name}, your capturer application for ${successSummary.market} has been submitted.`
                    : "Your capturer application has been submitted."} This is not an approval — it is the first step. We review every application before granting capture access.
                </p>
              </div>

              <div className="mt-8 grid gap-4">
                <div className="rounded-[1.6rem] border border-[color:var(--line)] bg-[color:var(--paper)] p-5">
                  <div className="flex items-start gap-4">
                    <Smartphone className="mt-1 h-5 w-5 text-[color:var(--leaf-deep)]" />
                    <div>
                      <p className="font-semibold text-[color:var(--ink)]">Application under review</p>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--ink-soft)]">
                        Your submission is in the capturer queue. We will reach out via email with access instructions once your application is approved. In the meantime, the Blueprint Capture app is where actual capture sessions, review steps, and payout setup live.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-[color:var(--line)] bg-white p-5">
                  <div className="flex items-start gap-4">
                    <QrCode className="mt-1 h-5 w-5 text-[color:var(--leaf-deep)]" />
                    <div className="w-full">
                      <p className="font-semibold text-[color:var(--ink)]">Mobile access link and QR</p>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--ink-soft)]">
                        This stays stable even if the downstream mobile destination changes, so
                        signup does not need to be reworked when the app access path is updated.
                      </p>

                      <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-center">
                        <div className="flex h-40 w-40 items-center justify-center rounded-[1.5rem] border border-[color:var(--line)] bg-[color:var(--paper)] p-3">
                          {captureAppQrCode ? (
                            <img
                              src={captureAppQrCode}
                              alt="QR code for the Blueprint Capture placeholder link"
                              className="h-full w-full rounded-xl"
                            />
                          ) : (
                            <div className="text-xs text-[color:var(--ink-muted)]">Generating QR...</div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] px-4 py-3 text-sm text-[color:var(--ink)]">
                            <span className="break-all">{captureAppUrl}</span>
                          </div>
                          <div className="flex flex-col gap-3 sm:flex-row">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleCopyUrl}
                              className="rounded-full border-[color:var(--line-strong)]"
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              {copyState === "copied"
                                ? "Copied"
                                : copyState === "failed"
                                  ? "Copy failed"
                                  : "Copy link"}
                            </Button>
                            <Button
                              asChild
                              type="button"
                              variant="outline"
                              className="rounded-full border-[color:var(--line-strong)]"
                            >
                              <a href={captureAppUrl} target="_blank" rel="noreferrer">
                                Open access link
                                <ExternalLink className="ml-2 h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-[color:var(--line)] bg-white p-5">
                  <div className="flex items-start gap-4">
                    <Sparkles className="mt-1 h-5 w-5 text-[color:var(--amber)]" />
                    <div>
                      <p className="font-semibold text-[color:var(--ink)]">Recommended next steps</p>
                      <ul className="mt-2 space-y-2 text-sm leading-6 text-[color:var(--ink-soft)]">
                        <li>Watch for approval or access instructions.</li>
                        <li>Complete identity and payout setup in the capture workflow when prompted.</li>
                        <li>Return to the capture overview if you want to review pay, device fit, or process details.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-[color:var(--line)] bg-white p-5">
                  <div className="flex items-start gap-4">
                    <Shield className="mt-1 h-5 w-5 text-[color:var(--leaf-deep)]" />
                    <div>
                      <p className="font-semibold text-[color:var(--ink)]">Need a business account instead?</p>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--ink-soft)]">
                        Site operators and robot teams should stay on the business route so they get the right intake, not the worker flow.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  onClick={() => setLocation("/capture")}
                  className="rounded-full bg-[color:var(--ink)] text-white hover:bg-[color:var(--leaf-deep)]"
                >
                  Back to capture overview
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/signup/business")}
                  className="rounded-full border-[color:var(--line-strong)]"
                >
                  Business signup
                </Button>
              </div>
            </motion.div>
          )}
        </section>
      </div>
      </main>
    </>
  );
}
