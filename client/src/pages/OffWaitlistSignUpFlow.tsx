// OffWaitlistSignUpFlow - Revamped UI in Blueprint's emerald/cyan dark theme
// Keeps all existing functionality (token validation, Firebase auth, Firestore writes,
// Places Autocomplete, mapping + demo scheduling, webhook call, confirmation redirect).
//
// UX upgrades:
// - Dark themed, glassy surfaces, ambient brand glows
// - Persuasive left rail tailored for Durham/Triangle pilot
// - Sticky live Summary (desktop) + collapsible mobile summary
// - Snappy gradient stepper with statuses
// - Friendlier dark calendar + grouped Morning/Afternoon/Evening time chips
// - Clear microcopy + inline errors
//
// Requires existing components: Nav, Footer, shadcn/ui Button/Input/Label

"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import DatePicker from "react-datepicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadStripe } from "@stripe/stripe-js";
import { withCsrfHeader } from "@/lib/csrf";
import {
  Calendar,
  Mail,
  Lock,
  Building2,
  MapPin,
  Phone,
  Ruler,
  Shield,
  Sparkles,
  Users,
  ArrowRight,
  ChevronLeft,
  CheckCircle2,
  Loader2,
  Globe,
  CreditCard,
  DollarSign,
  BadgeCheck,
  Clock3,
} from "lucide-react";
import "react-datepicker/dist/react-datepicker.css";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import {
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  arrayUnion,
} from "firebase/firestore";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { db } from "@/lib/firebase";
import { getStorage, ref, uploadBytes } from "firebase/storage";
import {
  triggerLindyWebhook,
  type LindyWebhookPayload,
} from "@/utils/lindyWebhook";
import { triggerPostSignupWorkflowsDetached } from "@/utils/postSignupWorkflows";
import { getGoogleMapsApiKey } from "@/lib/client-env";

const ONBOARDING_FEE = 0;
const MONTHLY_RATE = 49.99;
const INCLUDED_WEEKLY_HOURS = 40;
const EXTRA_HOURLY_RATE = 1.25;

type PlacesAutocompleteSuggestion = {
  placeId: string;
  description: string;
};

type PlacesAutocompleteResponse = {
  suggestions?: {
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }[];
};

type PlaceDetailsResponse = {
  formattedAddress?: string;
  websiteUri?: string;
};

type CheckoutSessionResponse = {
  sessionId?: string;
  sessionUrl?: string | null;
  error?: string;
};

export default function OffWaitlistSignUpFlow() {
  // ------------------------------
  // TOKEN VALIDATION
  // ------------------------------
  const [showStep2Errors, setShowStep2Errors] = useState(false);
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

type TokenData = {
  id: string;
  email?: string;
  businessName?: string;
  company?: string;
  status?: string;
  [key: string]: any;
};

type WaitlistValidationResponse = {
  valid?: boolean;
  error?: string;
  tokenData?: TokenData;
};

  const INTERNAL_TEST_TOKEN = "blueprint-internal-test-token-2025";
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [userCreated, setUserCreated] = useState(false);

  // ------------------------------
  // STEP STATE
  // ------------------------------
  const [step, setStep] = useState(1);
  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "success" | "canceled" | "error" | "skipped"
  >("idle");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isRedirectingToStripe, setIsRedirectingToStripe] = useState(false);

  // ------------------------------
  // FORM FIELDS
  // ------------------------------
  // Step 1
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2
  const [contactName, setContactName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [squareFootage, setSquareFootage] = useState<number | null>(null);

  // Step 3
  const [scheduleDate, setScheduleDate] = useState(new Date());
  const [scheduleTime, setScheduleTime] = useState("08:00");

  // Step 4
  const [demoDate, setDemoDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date;
  });
  const [demoTime, setDemoTime] = useState("11:00");

  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setDemoDate((prev) => {
      const nextDay = new Date(scheduleDate);
      nextDay.setDate(nextDay.getDate() + 1);
      return prev.toDateString() === nextDay.toDateString() ? prev : nextDay;
    });
  }, [scheduleDate]);

  // ------------------------------
  // Validation helpers
  // ------------------------------
  function isValidEmail(val: string) {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(val);
  }
  function isValidPhone(phone: string) {
    const digits = phone.replace(/\D/g, "");
    return digits.length === 10;
  }

  const initialOrgNameSet = useRef(false);
  const step2Valid =
    contactName.trim() !== "" &&
    isValidPhone(phoneNumber) &&
    address.trim() !== "" &&
    squareFootage !== null &&
    squareFootage > 0;

  // ------------------------------
  // GOOGLE PLACES AUTOCOMPLETE
  // ------------------------------
  const [companyWebsite, setCompanyWebsite] = useState("");
  const googleApiKey = getGoogleMapsApiKey();
  const orgSessionTokenRef = useRef<string | null>(null);
  const addressSessionTokenRef = useRef<string | null>(null);
  const [orgPredictions, setOrgPredictions] = useState<
    PlacesAutocompleteSuggestion[]
  >([]);
  const [loadingOrg, setLoadingOrg] = useState(false);

  const [addressPredictions, setAddressPredictions] = useState<
    PlacesAutocompleteSuggestion[]
  >([]);
  const [loadingAddress, setLoadingAddress] = useState(false);

  useEffect(() => {
    if (!googleApiKey) {
      console.error("Google Maps API key is not available");
      setErrorMessage("Google Maps API key is not configured.");
    }
  }, [googleApiKey]);

  const ensureSessionToken = useCallback(
    (ref: React.MutableRefObject<string | null>) => {
      if (!ref.current) {
        ref.current =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2);
      }
      return ref.current;
    },
    [],
  );

  const fetchAutocompleteSuggestions = useCallback(
    async (
      input: string,
      sessionTokenRef: React.MutableRefObject<string | null>,
      options?: { includedPrimaryTypes?: string[] },
    ): Promise<PlacesAutocompleteSuggestion[]> => {
      if (!googleApiKey) {
        throw new Error("Google Maps API key is not configured.");
      }

      const sessionToken = ensureSessionToken(sessionTokenRef);
      const response = await fetch(
        "https://places.googleapis.com/v1/places:autocomplete",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": googleApiKey,
            "X-Goog-FieldMask":
              "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
          },
          body: JSON.stringify({
            input,
            sessionToken,
            languageCode: "en",
            regionCode: "us",
            includeQueryPredictions: false,
            ...(options?.includedPrimaryTypes
              ? { includedPrimaryTypes: options.includedPrimaryTypes }
              : {}),
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Places API error: ${response.status} ${response.statusText} ${errorText}`,
        );
      }

      const data = (await response.json()) as PlacesAutocompleteResponse;
      const suggestions = data.suggestions ?? [];

      return suggestions
        .map((s) => s.placePrediction)
        .filter(
          (prediction): prediction is NonNullable<typeof prediction> =>
            Boolean(prediction && prediction.placeId),
        )
        .map((prediction) => {
          const description =
            prediction.text?.text ??
            [
              prediction.structuredFormat?.mainText?.text,
              prediction.structuredFormat?.secondaryText?.text,
            ]
              .filter(Boolean)
              .join(", ");

          return {
            placeId: prediction.placeId as string,
            description,
          };
        })
        .filter((suggestion) => Boolean(suggestion.description));
    },
    [ensureSessionToken, googleApiKey],
  );

  const fetchPlaceDetails = useCallback(
    async (placeId: string): Promise<PlaceDetailsResponse> => {
      if (!googleApiKey) {
        throw new Error("Google Maps API key is not configured.");
      }

      const response = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(
          placeId,
        )}?languageCode=en&regionCode=us`,
        {
          headers: {
            "X-Goog-Api-Key": googleApiKey,
            "X-Goog-FieldMask": "formattedAddress,websiteUri",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Place details error: ${response.status} ${response.statusText} ${errorText}`,
        );
      }

      return (await response.json()) as PlaceDetailsResponse;
    },
    [googleApiKey],
  );

  const handleOrgSearch = useCallback(
    async (input: string) => {
      if (input.length < 3) {
        setOrgPredictions([]);
        return;
      }
      setLoadingOrg(true);
      try {
        const suggestions = await fetchAutocompleteSuggestions(
          input,
          orgSessionTokenRef,
        );
        setOrgPredictions(suggestions);
      } catch (err) {
        console.error("Error fetching org predictions:", err);
        setErrorMessage("Failed to fetch organization suggestions.");
      } finally {
        setLoadingOrg(false);
      }
    },
    [fetchAutocompleteSuggestions],
  );

  const handleAddressSearch = useCallback(
    async (input: string) => {
      if (input.length < 3) {
        setAddressPredictions([]);
        return;
      }
      setLoadingAddress(true);
      try {
        const suggestions = await fetchAutocompleteSuggestions(
          input,
          addressSessionTokenRef,
          {
            includedPrimaryTypes: [
              "street_address",
              "premise",
              "subpremise",
              "route",
            ],
          },
        );
        setAddressPredictions(suggestions);
      } catch (err) {
        console.error("Error fetching address suggestions:", err);
        setErrorMessage("Failed to fetch address suggestions.");
      } finally {
        setLoadingAddress(false);
      }
    },
    [fetchAutocompleteSuggestions],
  );

  const handleOrgSelect = useCallback(
    async (prediction: PlacesAutocompleteSuggestion) => {
      setOrganizationName(prediction.description);
      setOrgPredictions([]);
      setAddressPredictions([]);

      try {
        setLoadingOrg(true);
        const details = await fetchPlaceDetails(prediction.placeId);
        setCompanyWebsite(details.websiteUri ?? "");
        if (details.formattedAddress) {
          setAddress(details.formattedAddress);
        }
      } catch (error) {
        console.error("Failed to fetch organization details", error);
        setErrorMessage("Failed to fetch organization details.");
      } finally {
        setLoadingOrg(false);
      }
    },
    [fetchPlaceDetails],
  );

  // ------------------------------
  // Token validation
  // ------------------------------
  useEffect(() => {
    const validateToken = async () => {
      setIsLoading(true);
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get("token");

      if (!token) {
        setErrorMessage("Invalid or missing access token");
        setIsLoading(false);
        setIsValidToken(false);
        return;
      }

      if (token === INTERNAL_TEST_TOKEN) {
        const mockTokenData: TokenData = {
          id: "internal-test-token",
          email: "test@blueprint.com",
          company: "Blueprint Test Company",
          status: "unused",
        };
        setOrganizationName("Blueprint Test Company");
        setEmail("test@blueprint.com");
        initialOrgNameSet.current = true;
        setTokenData(mockTokenData);
        setIsValidToken(true);
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/waitlist", {
          method: "POST",
          headers: await withCsrfHeader({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            action: "validate-offwaitlist-token",
            token,
          }),
        });
        const payload = (await response.json()) as WaitlistValidationResponse;

        if (!response.ok || !payload.valid || !payload.tokenData) {
          setErrorMessage(
            payload.error || "This signup link is invalid or has already been used",
          );
          setIsValidToken(false);
        } else {
          const data = payload.tokenData;
          if (data.company) {
            setOrganizationName(data.company);
            initialOrgNameSet.current = true;
          }
          if (data.email) setEmail(data.email);
          setTokenData(data);
          setIsValidToken(true);
        }
      } catch (error: unknown) {
        console.error("Error validating token:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        setErrorMessage("Error validating your access token: " + msg);
        setIsValidToken(false);
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get("checkout");
    if (!checkoutStatus) return;

    const storedContext = sessionStorage.getItem("blueprintCheckoutContext");
    if (storedContext) {
      try {
        const parsed = JSON.parse(storedContext);
        if (typeof parsed.organizationName === "string") {
          setOrganizationName(parsed.organizationName);
        }
        if (typeof parsed.email === "string") {
          setEmail(parsed.email);
        }
        if (typeof parsed.contactName === "string") {
          setContactName(parsed.contactName);
        }
        if (typeof parsed.phoneNumber === "string") {
          setPhoneNumber(parsed.phoneNumber);
        }
        if (typeof parsed.address === "string") {
          setAddress(parsed.address);
        }
        if (typeof parsed.squareFootage === "number") {
          setSquareFootage(parsed.squareFootage);
        }
        if (typeof parsed.scheduleDate === "string") {
          const restored = new Date(parsed.scheduleDate);
          if (!Number.isNaN(restored.getTime())) {
            setScheduleDate(restored);
          }
        }
        if (typeof parsed.scheduleTime === "string") {
          setScheduleTime(parsed.scheduleTime);
        }
        if (typeof parsed.demoDate === "string") {
          const restoredDemo = new Date(parsed.demoDate);
          if (!Number.isNaN(restoredDemo.getTime())) {
            setDemoDate(restoredDemo);
          }
        }
        if (typeof parsed.demoTime === "string") {
          setDemoTime(parsed.demoTime);
        }
      } catch (error) {
        console.error("Failed to restore checkout context", error);
      } finally {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("blueprintCheckoutContext");
        }
      }
    }

    if (checkoutStatus === "success") {
      setPaymentStatus("success");
      setStep(6);
    } else if (checkoutStatus === "canceled") {
      setPaymentStatus("canceled");
      setStep(5);
    }
    setPaymentError(null);

    params.delete("checkout");
    const newSearch = params.toString();
    const newUrl = `${window.location.pathname}${
      newSearch ? `?${newSearch}` : ""
    }`;
    window.history.replaceState({}, "", newUrl);
  }, []);

  // Prefill website/address for prefilled org
  useEffect(() => {
    const fetchWebsiteForPrefilledOrg = async () => {
      if (!organizationName || !tokenData || companyWebsite || !googleApiKey) {
        return;
      }

      try {
        const suggestions = await fetchAutocompleteSuggestions(
          organizationName,
          orgSessionTokenRef,
        );

        if (!suggestions.length) {
          return;
        }

        const details = await fetchPlaceDetails(suggestions[0].placeId);
        if (details.websiteUri) {
          setCompanyWebsite(details.websiteUri);
        }
        if (details.formattedAddress) {
          setAddress(details.formattedAddress);
        }
      } catch (error) {
        console.warn("Prefill lookup failed", error);
      }
    };

    void fetchWebsiteForPrefilledOrg();
  }, [
    organizationName,
    tokenData,
    companyWebsite,
    fetchAutocompleteSuggestions,
    fetchPlaceDetails,
    googleApiKey,
  ]);

  // Debounced autocomplete searches
  useEffect(() => {
    if (initialOrgNameSet.current) {
      initialOrgNameSet.current = false;
      return;
    }
    const t = setTimeout(() => {
      organizationName
        ? handleOrgSearch(organizationName)
        : setOrgPredictions([]);
    }, 300);
    return () => clearTimeout(t);
  }, [organizationName, handleOrgSearch]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (step === 2 && address) handleAddressSearch(address);
    }, 300);
    return () => clearTimeout(t);
  }, [address, step, handleAddressSearch]);

  // ------------------------------
  // Step navigation
  // ------------------------------
  async function handleNextStep() {
    if (step === 1) {
      if (!isValidToken || !tokenData) {
        setErrorMessage("Invalid or expired signup token");
        return;
      }
      if (password.trim().length < 8) {
        setErrorMessage("Your password must be at least 8 characters long.");
        return;
      }
      const auth = getAuth();
      try {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password.trim(),
        );
        const userId = userCredential.user.uid;
        await setDoc(doc(db, "users", userId), {
          uid: userId,
          email: email.trim(),
          organizationName: organizationName.trim(),
          company: organizationName.trim(),
          createdDate: serverTimestamp(),
          planType: "free",
          finishedOnboarding: false,
          waitlistTokenId: tokenData.id,
        });

        // Mark token used (except internal test)
        if (tokenData.id !== "internal-test-token") {
          const consumeResponse = await fetch("/api/waitlist", {
            method: "POST",
            headers: await withCsrfHeader({ "Content-Type": "application/json" }),
            body: JSON.stringify({
              action: "consume-offwaitlist-token",
              tokenId: tokenData.id,
              usedBy: userId,
            }),
          });
          if (!consumeResponse.ok) {
            const consumeError = (await consumeResponse.json().catch(() => ({}))) as {
              error?: string;
            };
            throw new Error(consumeError.error || "Failed to consume waitlist token");
          }
        }

        setUserCreated(true);
        setStep((p) => p + 1);
      } catch (error: unknown) {
        console.error("Error creating user:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        setErrorMessage("Error creating user: " + msg);
        return;
      }
    } else if (step === 2) {
      if (!step2Valid) {
        setShowStep2Errors(true);
        return;
      }
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setErrorMessage("No user found. Please sign up first.");
        return;
      }
      try {
        await updateDoc(doc(db, "users", user.uid), {
          mappingContactName: contactName.trim(),
          mappingContactPhoneNumber: phoneNumber.trim(),
          address: address.trim(),
          mappingAreaSqFt: squareFootage,
        });
        setStep((p) => p + 1);
      } catch (error: unknown) {
        console.error("Error updating contact info:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        setErrorMessage("Error updating contact info: " + msg);
        return;
      }
    } else if (step === 3) {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setErrorMessage("No user found. Please sign up first.");
        return;
      }
      try {
        await updateDoc(doc(db, "users", user.uid), {
          mappingScheduleDate: scheduleDate,
          mappingScheduleTime: scheduleTime,
        });
        setStep((p) => p + 1);
      } catch (error: unknown) {
        console.error("Error updating mapping schedule:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        setErrorMessage("Error updating mapping schedule: " + msg);
        return;
      }
    } else if (step === 4) {
      const expectedDemoDate = new Date(scheduleDate);
      expectedDemoDate.setHours(0, 0, 0, 0);
      expectedDemoDate.setDate(expectedDemoDate.getDate() + 1);

      const normalizedDemoDate = new Date(demoDate);
      normalizedDemoDate.setHours(0, 0, 0, 0);

      if (normalizedDemoDate.getTime() !== expectedDemoDate.getTime()) {
        setErrorMessage(
          "Demo must happen the day after mapping so we can deliver within 24 hours.",
        );
        return;
      }

      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setErrorMessage("No user found. Please sign up first.");
        return;
      }

      const bookingDate = scheduleDate.toISOString().split("T")[0];
      const bookingId = `${bookingDate}_${scheduleTime}`;
      const blueprintId = crypto.randomUUID();
      const demoBookingDate = demoDate.toISOString().split("T")[0];
      const demoBookingId = `demo_${demoBookingDate}_${demoTime}`;
      const estimatedSquareFootage = squareFootage ?? 0;
      const estimatedMappingPayout = parseFloat(
        (estimatedSquareFootage / 60).toFixed(2),
      );
      const estimatedMappingTime = parseFloat(
        (estimatedSquareFootage / 100 + 15).toFixed(2),
      );
      const estimatedDesignPayout = parseFloat(
        (estimatedSquareFootage / 80).toFixed(2),
      );

      try {
        await updateDoc(doc(db, "users", user.uid), {
          demoScheduleDate: demoDate,
          demoScheduleTime: demoTime,
        });

        await setDoc(doc(db, "bookings", bookingId), {
          id: bookingId,
          date: bookingDate,
          time: scheduleTime,
          userId: user.uid,
          businessName: organizationName.trim(),
          address: address.trim(),
          contactName: contactName.trim(),
          contactPhone: phoneNumber.trim(),
          email: email.trim(),
          status: "pending",
          blueprintId,
          demoScheduleDate: demoBookingDate,
          demoScheduleTime: demoTime,
          createdAt: serverTimestamp(),
          estimatedSquareFootage,
          estimatedMappingPayout,
          estimatedMappingTime,
          estimatedDesignPayout,
        });

        await setDoc(doc(db, "blueprints", blueprintId), {
          id: blueprintId,
          businessName: organizationName.trim(),
          address: address.trim(),
          name: organizationName.trim(),
          host: user.uid,
          locationType: "retail",
          createdDate: serverTimestamp(),
          updatedAt: serverTimestamp(),
          scanCompleted: false,
          status: "Pending",
          email: email.trim(),
          phone: phoneNumber.trim(),
        });

        const storage = getStorage();
        const placeholderRef = ref(
          storage,
          `blueprints/${blueprintId}/placeholder.txt`,
        );
        await uploadBytes(placeholderRef, new Uint8Array());

        await setDoc(doc(db, "demoBookings", demoBookingId), {
          id: demoBookingId,
          date: demoBookingDate,
          time: demoTime,
          userId: user.uid,
          businessName: organizationName.trim(),
          address: address.trim(),
          contactName: contactName.trim(),
          contactPhone: phoneNumber.trim(),
          email: email.trim(),
          status: "scheduled",
          type: "demo",
          blueprintId,
          mappingDate: bookingDate,
          mappingTime: scheduleTime,
          createdAt: serverTimestamp(),
        });

        await updateDoc(doc(db, "users", user.uid), {
          createdBlueprintIDs: arrayUnion(blueprintId),
        });
      } catch (error: unknown) {
        console.error("Error completing booking setup:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        setErrorMessage("Error completing booking setup: " + msg);
        return;
      }

      setStep((current) => (current >= 5 ? current : current + 1));
      setPaymentStatus("idle");
      setPaymentError(null);

      const lindyPayload: LindyWebhookPayload = {
        have_we_onboarded: "No",
        chosen_time_of_mapping: scheduleTime,
        chosen_date_of_mapping: bookingDate,
        have_user_chosen_date: "Yes",
        address: address.trim(),
        company_url: companyWebsite.trim() || "",
        company_name: organizationName.trim(),
        contact_name: contactName.trim(),
        contact_phone_number: phoneNumber.trim(),
        estimated_square_footage: squareFootage,
        contact_email: email.trim(),
        blueprint_id: blueprintId,
        chosen_date_of_demo: demoBookingDate,
        chosen_time_of_demo: demoTime,
      };

      try {
        triggerLindyWebhook(lindyPayload);
      } catch (err) {
        console.error("Lindy webhook invocation error:", err);
      }

      triggerPostSignupWorkflowsDetached({
        blueprintId,
        userId: user.uid,
        companyName: organizationName.trim(),
        address: address.trim(),
        companyUrl: companyWebsite.trim() || undefined,
        contactName: contactName.trim() || undefined,
        contactEmail: email.trim(),
        contactPhone: phoneNumber.trim() || undefined,
        locationType: "retail",
        squareFootage: squareFootage ?? null,
      });
    }
  }

  function handlePrevStep() {
    if (step === 2 && userCreated) return;
    setStep((p) => p - 1);
  }

  const [isSubmitting, setIsSubmitting] = useState(false);
  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      handleNextStep();
    } finally {
      setIsSubmitting(false);
    }
  }

  const step1Valid =
    organizationName.trim() !== "" &&
    isValidEmail(email.trim()) &&
    password.trim().length >= 8;

  function isToday(date: Date) {
    const now = new Date();
    return (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  }

  // ------------------------------
  // UI Helpers (autocomplete lists)
  // ------------------------------
  const OrgPredictionList = ({
    items,
  }: {
    items: PlacesAutocompleteSuggestion[];
  }) => {
    if (!items.length) return null;
    return (
      <div className="absolute z-20 w-full mt-2 rounded-xl border border-white/10 bg-[#0E172A] shadow-xl overflow-hidden">
        {items.map((p) => (
          <button
            key={p.placeId}
            onClick={() => {
              void handleOrgSelect(p);
            }}
            className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2 text-slate-200">
              <Building2 className="w-4 h-4 text-emerald-300" />
              <span className="text-sm">{p.description}</span>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const AddressPredictionList = ({
    items,
  }: {
    items: PlacesAutocompleteSuggestion[];
  }) => {
    if (!items.length) return null;
    return (
      <div className="absolute z-20 w-full mt-2 rounded-xl border border-white/10 bg-[#0E172A] shadow-xl overflow-hidden">
        {items.map((p) => (
          <button
            key={p.placeId}
            onClick={() => {
              setAddress(p.description);
              setAddressPredictions([]);
            }}
            className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2 text-slate-200">
              <MapPin className="w-4 h-4 text-cyan-300" />
              <span className="text-sm">{p.description}</span>
            </div>
          </button>
        ))}
      </div>
    );
  };

  // ------------------------------
  // STEP CONTENT
  // ------------------------------
  const Step1 = (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-white">
          Welcome off the waitlist
        </h2>
        <p className="text-slate-300 mt-2">
          Durham/Triangle pilot: set up your account to book mapping & demo.
          This takes ~2 minutes.
        </p>
      </div>

      <div className="grid gap-4">
        <div className="relative">
          <Label className="text-slate-200">Organization / Venue</Label>
          <div className="mt-1 relative">
            <Input
              placeholder="e.g., Brightleaf Books, Durham"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && step1Valid) handleNextStep();
              }}
              className="h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-400"
            />
            <OrgPredictionList items={orgPredictions} />
            {loadingOrg && (
              <div className="absolute right-2 top-[46px] text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            )}
          </div>
        </div>

        <div>
          <Label className="text-slate-200">Work Email</Label>
          <div className="mt-1 relative">
            <Mail className="absolute left-3 top-3.5 w-5 h-5 text-emerald-300/70" />
            <Input
              type="email"
              placeholder="you@business.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && step1Valid) handleNextStep();
              }}
              className="h-12 pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-400"
            />
          </div>
          {email && !isValidEmail(email) && (
            <p className="text-rose-400 text-xs mt-1">
              Please enter a valid email address.
            </p>
          )}
        </div>

        <div>
          <Label className="text-slate-200">Create Password</Label>
          <div className="mt-1 relative">
            <Lock className="absolute left-3 top-3.5 w-5 h-5 text-emerald-300/70" />
            <Input
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && step1Valid) handleNextStep();
              }}
              className="h-12 pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-400"
            />
          </div>
          {password && password.length < 8 && (
            <p className="text-rose-400 text-xs mt-1">
              Your password must be at least 8 characters long.
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-300" />
          Optional Stripe checkout in the final step. Invite valid for 14 days.
        </div>
        <Button
          onClick={handleNextStep}
          disabled={!step1Valid}
          className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700"
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const Step2 = (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-white">
          Contact & Location
        </h2>
        <p className="text-slate-300 mt-2">
          Who should we meet at your location? We’ll send confirmations and SMS
          reminders.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label className="text-slate-200">Primary Contact</Label>
          <Input
            placeholder="Full name"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && step2Valid) handleNextStep();
            }}
            className={`h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-400 ${
              showStep2Errors && !contactName.trim() ? "border-rose-400" : ""
            }`}
          />
          {showStep2Errors && !contactName.trim() && (
            <p className="text-rose-400 text-xs mt-1">
              Contact name is required.
            </p>
          )}
        </div>

        <div>
          <Label className="text-slate-200">Mobile Number</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-3.5 w-5 h-5 text-cyan-300/70" />
            <Input
              placeholder="(919) 555-0123"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && step2Valid) handleNextStep();
              }}
              className={`h-12 pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-400 ${
                showStep2Errors && !isValidPhone(phoneNumber)
                  ? "border-rose-400"
                  : ""
              }`}
            />
          </div>
          {showStep2Errors && !isValidPhone(phoneNumber) && (
            <p className="text-rose-400 text-xs mt-1">
              Please enter a valid 10-digit phone number.
            </p>
          )}
        </div>

        <div className="md:col-span-2 relative">
          <Label className="text-slate-200">
            Physical Address (mapping location)
          </Label>
          <div className="mt-1 relative">
            <MapPin className="absolute left-3 top-3.5 w-5 h-5 text-cyan-300/70" />
            <Input
              placeholder="Street, City, State"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onFocus={() => setIsAddressFocused(true)}
              onBlur={() => setTimeout(() => setIsAddressFocused(false), 200)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && step2Valid) handleNextStep();
              }}
              className={`h-12 pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-400 ${
                showStep2Errors && !address.trim() ? "border-rose-400" : ""
              }`}
            />
            {isAddressFocused && (
              <AddressPredictionList items={addressPredictions} />
            )}
            {loadingAddress && (
              <div className="absolute right-2 top-[10px] text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            )}
          </div>
          {showStep2Errors && !address.trim() && (
            <p className="text-rose-400 text-xs mt-1">Address is required.</p>
          )}
        </div>

        <div className="md:col-span-2">
          <Label className="text-slate-200">
            Estimated Square Footage to Map
          </Label>
          <div className="mt-1 relative">
            <Ruler className="absolute left-3 top-3.5 w-5 h-5 text-emerald-300/70" />
            <Input
              type="number"
              placeholder="e.g., 1500"
              value={squareFootage || ""} // avoid 0 display
              onChange={(e) => setSquareFootage(Number(e.target.value) || 0)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && step2Valid) handleNextStep();
              }}
              className={`h-12 pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-400 ${
                showStep2Errors &&
                (squareFootage === null || squareFootage <= 0)
                  ? "border-rose-400"
                  : ""
              }`}
            />
          </div>
          {showStep2Errors &&
            (squareFootage === null || squareFootage <= 0) && (
              <p className="text-rose-400 text-xs mt-1">
                Estimated square footage must be greater than zero.
              </p>
            )}
        </div>

        <div className="md:col-span-2">
          <p className="text-xs text-slate-400 leading-relaxed">
            ☑️ By providing your phone number, you consent to receive SMS
            messages from Blueprint about your mapping and demo. Message
            frequency varies; message & data rates may apply. Reply STOP to opt
            out, HELP for help.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        {!userCreated ? (
          <Button
            variant="outline"
            onClick={handlePrevStep}
            className="border-white/20 text-slate-200 hover:bg-white/10"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        ) : (
          <div />
        )}
        <Button
          onClick={handleNextStep}
          disabled={!step2Valid}
          className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700"
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const Step3 = () => {
    const [bookedTimes, setBookedTimes] = useState<string[]>([]);
    const [isLoadingSlots, setIsLoadingSlots] = useState(true);

    const maxDate = useCallback(() => {
      const date = new Date();
      date.setMonth(date.getMonth() + 1);
      return date;
    }, []);

    const formatSlot = (time: string) => {
      const [hh, mm] = time.split(":");
      let h = parseInt(hh, 10);
      const am = h < 12;
      const ampm = am ? "AM" : "PM";
      if (h === 0) h = 12;
      else if (h > 12) h -= 12;
      return `${h}:${mm} ${ampm}`;
    };

    useEffect(() => {
      const fetchBookedTimes = async () => {
        setIsLoadingSlots(true);
        try {
          const bookingDate = scheduleDate.toISOString().split("T")[0];
          const ref = collection(db, "bookings");
          const qy = query(ref, where("date", "==", bookingDate));
          const snap = await getDocs(qy);
          const times: string[] = [];
          snap.forEach((d) => {
            const data = d.data();
            if (data && data.time) times.push(data.time as string);
          });
          setBookedTimes(times);
        } catch (error) {
          console.error("Error fetching booked times:", error);
          setErrorMessage("Could not load availability. Please try again.");
        } finally {
          setIsLoadingSlots(false);
        }
      };
      fetchBookedTimes();
    }, [scheduleDate]);

    const isSlotUnavailable = useCallback(
      (slot: string) => {
        if (bookedTimes.includes(slot)) return true;
        for (const booked of bookedTimes) {
          const [bh, bm] = booked.split(":").map(Number);
          const [sh, sm] = slot.split(":").map(Number);
          const bMin = bh * 60 + bm;
          const sMin = sh * 60 + sm;
          const diff = sMin - bMin;
          if (diff > 0 && diff <= 60) return true;
        }
        return false;
      },
      [bookedTimes],
    );

    const generateTimeSlots = useCallback(() => {
      const slots: string[] = [];
      for (let hour = 8; hour < 20; hour++) {
        slots.push(`${hour.toString().padStart(2, "0")}:00`);
        slots.push(`${hour.toString().padStart(2, "0")}:30`);
      }
      slots.push("20:00");

      if (isToday(scheduleDate)) {
        const now = new Date();
        const curr = now.getHours() * 60 + now.getMinutes();
        return slots.filter((slot) => {
          const [hh, mm] = slot.split(":");
          const sMin = parseInt(hh, 10) * 60 + parseInt(mm, 10);
          const afterOneHour = sMin >= curr + 60;
          return afterOneHour && !isSlotUnavailable(slot);
        });
      }
      return slots.filter((slot) => !isSlotUnavailable(slot));
    }, [scheduleDate, isSlotUnavailable]);

    const slots = generateTimeSlots();
    const morning = slots.filter((s) => parseInt(s.split(":")[0]) < 12);
    const afternoon = slots.filter((s) => {
      const h = parseInt(s.split(":")[0]);
      return h >= 12 && h < 17;
    });
    const evening = slots.filter((s) => parseInt(s.split(":")[0]) >= 17);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Schedule 3D Mapping
          </h2>
          <p className="text-slate-300 mt-2">
            Pick a date and time for our specialist to scan your space. Most
            visits take ~30–60 minutes, and we’ll be back the very next day for
            your live demo.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Calendar */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center gap-2 text-slate-200">
              <Calendar className="w-5 h-5 text-emerald-300" />
              <Label className="font-medium text-slate-200">Select Date</Label>
            </div>
            <DatePicker
              selected={scheduleDate}
              onChange={(date: Date | null) => date && setScheduleDate(date)}
              inline
              minDate={new Date()}
              maxDate={maxDate()}
              calendarClassName="!bg-transparent !border-0 !shadow-none reactpicker-dark"
              wrapperClassName="!block w-full"
              dayClassName={(date) => {
                const base =
                  "rounded-md !w-9 !h-9 flex items-center justify-center";
                const isSel =
                  date.toDateString() === scheduleDate.toDateString();
                return isSel
                  ? `${base} !bg-gradient-to-r from-emerald-500 to-cyan-600 !text-white`
                  : `${base} hover:!bg-white/10 !text-slate-200`;
              }}
            />
          </div>

          {/* Time slots */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-1">
              <Label className="font-medium text-slate-200">Select Time</Label>
              <p className="text-xs text-slate-400 mt-1">
                Times in Eastern Time (ET)
              </p>
            </div>

            {isLoadingSlots ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-300" />
              </div>
            ) : slots.length ? (
              <div className="space-y-4">
                {morning.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Morning</p>
                    <div className="flex flex-wrap gap-2">
                      {morning.map((s) => (
                        <button
                          key={s}
                          onClick={() => setScheduleTime(s)}
                          className={`px-3 py-2 rounded-md text-sm transition-all border ${
                            scheduleTime === s
                              ? "bg-gradient-to-r from-emerald-500 to-cyan-600 text-white border-transparent"
                              : "bg-white/5 hover:bg-white/10 text-slate-200 border-white/10"
                          }`}
                        >
                          {formatSlot(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {afternoon.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Afternoon</p>
                    <div className="flex flex-wrap gap-2">
                      {afternoon.map((s) => (
                        <button
                          key={s}
                          onClick={() => setScheduleTime(s)}
                          className={`px-3 py-2 rounded-md text-sm transition-all border ${
                            scheduleTime === s
                              ? "bg-gradient-to-r from-emerald-500 to-cyan-600 text-white border-transparent"
                              : "bg-white/5 hover:bg-white/10 text-slate-200 border-white/10"
                          }`}
                        >
                          {formatSlot(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {evening.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Evening</p>
                    <div className="flex flex-wrap gap-2">
                      {evening.map((s) => (
                        <button
                          key={s}
                          onClick={() => setScheduleTime(s)}
                          className={`px-3 py-2 rounded-md text-sm transition-all border ${
                            scheduleTime === s
                              ? "bg-gradient-to-r from-emerald-500 to-cyan-600 text-white border-transparent"
                              : "bg-white/5 hover:bg-white/10 text-slate-200 border-white/10"
                          }`}
                        >
                          {formatSlot(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-amber-300/90 text-sm p-4 bg-amber-500/10 border border-amber-500/20 rounded-md">
                No available times for this date. Please pick another date.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={handlePrevStep}
            className="border-white/20 text-slate-200 hover:bg-white/10"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <Button
            onClick={handleNextStep}
            disabled={!scheduleTime || isLoadingSlots}
            className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  };

  const Step4 = () => {
    const [demoBookedTimes, setDemoBookedTimes] = useState<string[]>([]);
    const [isLoadingDemoSlots, setIsLoadingDemoSlots] = useState(true);

    const minDemoDate = useCallback(() => {
      const date = new Date(scheduleDate);
      date.setDate(date.getDate() + 1);
      return date;
    }, [scheduleDate]);

    const maxDemoDate = useCallback(() => {
      const date = new Date(scheduleDate);
      date.setDate(date.getDate() + 1);
      return date;
    }, [scheduleDate]);

    const formatSlot = (time: string) => {
      const [hh, mm] = time.split(":");
      let h = parseInt(hh, 10);
      const am = h < 12;
      const ampm = am ? "AM" : "PM";
      if (h === 0) h = 12;
      else if (h > 12) h -= 12;
      return `${h}:${mm} ${ampm}`;
    };

    useEffect(() => {
      const fetchDemoBookedTimes = async () => {
        setIsLoadingDemoSlots(true);
        try {
          const bookingDate = demoDate.toISOString().split("T")[0];
          const demoRef = collection(db, "demoBookings");
          const qy = query(demoRef, where("date", "==", bookingDate));
          const snap = await getDocs(qy);
          const times: string[] = [];
          snap.forEach((d) => {
            const data = d.data();
            if (data && data.time) times.push(data.time as string);
          });
          setDemoBookedTimes(times);
        } catch (error) {
          console.error("Error fetching demo booked times:", error);
          setErrorMessage(
            "Could not load demo availability. Please try again.",
          );
        } finally {
          setIsLoadingDemoSlots(false);
        }
      };
      fetchDemoBookedTimes();
    }, [demoDate]);

    const isDemoSlotUnavailable = useCallback(
      (slot: string) => demoBookedTimes.includes(slot),
      [demoBookedTimes],
    );

    const generateDemoTimeSlots = useCallback(() => {
      const slots: string[] = [];
      for (let hour = 9; hour < 18; hour++) {
        slots.push(`${hour.toString().padStart(2, "0")}:00`);
        slots.push(`${hour.toString().padStart(2, "0")}:30`);
      }
      slots.push("18:00");
      return slots.filter((s) => !isDemoSlotUnavailable(s));
    }, [isDemoSlotUnavailable]);

    const slots = generateDemoTimeSlots();
    const morning = slots.filter((s) => parseInt(s.split(":")[0]) < 12);
    const afternoon = slots.filter((s) => {
      const h = parseInt(s.split(":")[0]);
      return h >= 12 && h < 17;
    });
    const evening = slots.filter((s) => parseInt(s.split(":")[0]) >= 17);

    // NOTE: Next-Day Demo UI temporarily disabled. Preserve previous markup below for future restoration.
    return null;

    /*
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-white">
          Schedule Next-Day Demo
        </h2>
        <p className="text-slate-300 mt-2">
          We present your completed Blueprint within 24 hours. Choose the
          time for the follow-up visit the day after mapping.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        [Calendar UI]
        [Time slots UI]
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={handlePrevStep}
          className="border-white/20 text-slate-200 hover:bg-white/10"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Button
          onClick={handleNextStep}
          disabled={!demoTime || isLoadingDemoSlots}
          className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700"
        >
          Complete Setup
          <CheckCircle2 className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
    */
  };

  const PaymentStep = () => {
    const mappingDateTime = new Date(scheduleDate);
    if (scheduleTime) {
      const [hour, minute] = scheduleTime.split(":").map(Number);
      if (!Number.isNaN(hour) && !Number.isNaN(minute)) {
        mappingDateTime.setHours(hour, minute, 0, 0);
      }
    }
    const billingStart = new Date(
      mappingDateTime.getTime() + 24 * 60 * 60 * 1000,
    );

    const mappingDisplay = new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(mappingDateTime);
    const billingDisplay = new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(billingStart);

    const startStripeCheckout = async () => {
      try {
        setPaymentError(null);
        setPaymentStatus("idle");
        setIsRedirectingToStripe(true);

        if (typeof window !== "undefined") {
          sessionStorage.setItem(
            "blueprintCheckoutContext",
            JSON.stringify({
              organizationName,
              email,
              contactName,
              phoneNumber,
              address,
              squareFootage,
              scheduleDate: scheduleDate.toISOString(),
              scheduleTime,
              demoDate: demoDate.toISOString(),
              demoTime,
            }),
          );
        }

        const currentSearch = window.location.search;
        const successPath = `${window.location.pathname}${
          currentSearch
            ? `${currentSearch}&checkout=success`
            : "?checkout=success"
        }`;
        const cancelPath = `${window.location.pathname}${
          currentSearch
            ? `${currentSearch}&checkout=canceled`
            : "?checkout=canceled"
        }`;

        const response = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: await withCsrfHeader({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            sessionType: "onboarding",
            onboardingFee: ONBOARDING_FEE,
            monthlyPrice: MONTHLY_RATE,
            includedHours: INCLUDED_WEEKLY_HOURS,
            extraHourlyRate: EXTRA_HOURLY_RATE,
            organizationName: organizationName.trim(),
            contactName: contactName.trim(),
            contactEmail: email.trim(),
            mappingDateTime: mappingDateTime.toISOString(),
            successPath,
            cancelPath,
          }),
        });

        const data =
          (await response.json()) as CheckoutSessionResponse;
        if (!response.ok || !data?.sessionId) {
          throw new Error(
            data?.error ||
              "We couldn't start checkout just yet. Please try again.",
          );
        }

        const sessionUrl =
          typeof data.sessionUrl === "string" && data.sessionUrl.length > 0
            ? data.sessionUrl
            : undefined;

        const publishableKey =
          import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
          import.meta.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
          "pk_test_51ODuefLAUkK46LtZQ7o2si0POvd89pgNhE8pRcCCqMmmp9z534veOOiz81xMZcjZuEDK2CkdQnE9NhRy4WEoqWJG00ErDRTYlA";
        const stripe = await loadStripe(publishableKey);

        const shouldBypassStripeRedirect = () => {
          if (typeof window === "undefined") {
            return false;
          }
          try {
            return window.self !== window.top;
          } catch (error) {
            console.warn(
              "Unable to determine frame context, defaulting to bypass Stripe redirect.",
              error,
            );
            return true;
          }
        };

        if (stripe && !shouldBypassStripeRedirect()) {
          const result = await stripe.redirectToCheckout({
            sessionId: data.sessionId,
          });

          if (!result?.error) {
            return;
          }

          if (!sessionUrl) {
            throw new Error(result.error.message);
          }

          console.warn(
            "Stripe redirectToCheckout failed, falling back to direct session URL.",
            result.error,
          );
        }

        if (sessionUrl) {
          const newWindow = window.open(
            sessionUrl,
            "_blank",
            "noopener,noreferrer",
          );

          if (!newWindow) {
            window.location.href = sessionUrl;
          }

          return;
        }

        throw new Error(
          "We couldn't start checkout just yet. Please try again.",
        );
      } catch (err) {
        console.error("Stripe checkout error", err);
        const message =
          err instanceof Error
            ? err.message
            : "We couldn't reach Stripe. Please try again.";
        sessionStorage.removeItem("blueprintCheckoutContext");
        setPaymentStatus("error");
        setPaymentError(message);
      } finally {
        setIsRedirectingToStripe(false);
      }
    };

    const handleSkip = () => {
      setPaymentStatus("skipped");
      setPaymentError(null);
      setStep(6);
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Plan & Payment (Optional)
          </h2>
          <p className="text-slate-300 mt-2">
            Secure your onboarding with a one-time payment or skip for now. Your
            monthly plan only begins once Blueprint is live on-site.
          </p>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-cyan-500/10 to-slate-900/40 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-emerald-200" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-emerald-200/80">
                    One-time onboarding
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white">
                      ${ONBOARDING_FEE.toFixed(2)}
                    </span>
                    <span className="text-sm text-slate-300">due today</span>
                  </div>
                  <p className="text-sm text-slate-300 mt-2">
                    Covers our team on-site, LiDAR mapping kit, content prep,
                    and concierge rollout.
                  </p>
                </div>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-slate-200">
              <li className="flex items-start gap-2">
                <BadgeCheck className="w-4 h-4 text-emerald-300 mt-0.5" />
                Dedicated onboarding crew + day-of playbook.
              </li>
              <li className="flex items-start gap-2">
                <BadgeCheck className="w-4 h-4 text-emerald-300 mt-0.5" />
                Guaranteed slot on {mappingDisplay} so your team is ready.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-sky-500/10 to-slate-900/40 p-5">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-cyan-200" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-cyan-200/80">
                  Blueprint Care plan
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">
                    ${MONTHLY_RATE.toFixed(2)}
                  </span>
                  <span className="text-sm text-slate-300">per month</span>
                </div>
                <p className="text-sm text-slate-300 mt-2">
                  Starts {billingDisplay}, 24 hours after your onboarding
                  wraps.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
              <div className="flex items-start gap-2 text-emerald-200 text-sm">
                <BadgeCheck className="w-4 h-4 mt-0.5" />
                {INCLUDED_WEEKLY_HOURS} hours of Blueprint staff each week
                included.
              </div>
              <div className="flex items-start gap-2 text-slate-200 text-sm">
                <Clock3 className="w-4 h-4 text-cyan-200 mt-0.5" />
                Extra hours billed at ${EXTRA_HOURLY_RATE.toFixed(2)} / hr.
                Matches your Blueprint rate.
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex items-start gap-3">
            <Clock3 className="w-5 h-5 text-emerald-300 mt-1" />
            <div>
              <p className="text-sm text-slate-300">Onboarding is locked for</p>
              <p className="text-white font-semibold">{mappingDisplay}</p>
              <p className="text-xs text-slate-400 mt-1">
                Monthly billing begins {billingDisplay} so you never pay before
                Blueprint is live.
              </p>
            </div>
          </div>
        </div>

        {paymentStatus === "canceled" && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Checkout was canceled. You can try again below or skip for now. Your
            spot is still saved.
          </div>
        )}
        {paymentStatus === "error" && paymentError && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {paymentError}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
          <Button
            variant="outline"
            onClick={handlePrevStep}
            className="border-white/20 text-slate-200 hover:bg-white/10"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Demo
          </Button>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleSkip}
              className="border-white/20 text-slate-200 hover:bg-white/10"
            >
              Skip for now
            </Button>
            <Button
              onClick={startStripeCheckout}
              disabled={isRedirectingToStripe}
              className="flex-1 sm:flex-none rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700"
            >
              {isRedirectingToStripe ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Redirecting…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Pay ${ONBOARDING_FEE.toFixed(2)} now
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  function Confirmation() {
    return (
      <div className="flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-xl">
          <CheckCircle2 className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white">You’re all set!</h2>
        <p className="text-slate-300 max-w-md">
          We’ve scheduled your mapping and demo. You’ll get an email + SMS
          reminder before each visit.
        </p>
        {paymentStatus === "success" && (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 flex items-start gap-2">
            <BadgeCheck className="w-4 h-4 mt-0.5" />
            Onboarding payment confirmed. Your Blueprint Care plan will begin
            once we activate on site.
          </div>
        )}
        {paymentStatus === "skipped" && (
          <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            You can take care of the $499.99 onboarding invoice later. Your
            account access is fully unlocked in the meantime.
          </div>
        )}
        <p className="text-xs text-slate-400">
          Thanks for choosing Blueprint. We can't wait to bring your space to
          life.
        </p>
        <Button
          className="mt-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700"
          onClick={() => {
            localStorage.removeItem("scanCompleted");
            localStorage.setItem("showWaitingDashboard", "true");
            window.location.href = "/dashboard";
          }}
        >
          Go to Dashboard
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  // ------------------------------
  // Layout: stepper, left rail, summary, token gating
  // ------------------------------
  const stepsMeta = [
    { id: 1, label: "Account" },
    { id: 2, label: "Contact & Location" },
    { id: 3, label: "Mapping" },
    { id: 4, label: "Next-Day Demo" },
    { id: 5, label: "Plan & Payment" },
  ];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#0B1220] text-slate-100">
      {/* Ambient brand glows */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-32 -right-24 h-[45rem] w-[45rem] rounded-full blur-3xl opacity-40 bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-sky-500/10" />
        <div className="absolute -bottom-32 -left-24 h-[40rem] w-[40rem] rounded-full blur-3xl opacity-30 bg-gradient-to-tr from-cyan-500/10 via-emerald-500/10 to-amber-400/10" />
      </div>
      <div className="fixed inset-0 -z-10 opacity-[0.06] bg-[url('/images/grid-pattern.svg')] bg-repeat" />

      {errorMessage && (
        <div className="fixed top-24 right-5 z-[9999] bg-rose-600 text-white px-4 py-3 rounded-xl shadow-2xl border border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-sm">{errorMessage}</span>
            <button
              className="ml-2 text-white/80 hover:text-white"
              onClick={() => setErrorMessage("")}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <Nav hideAuthenticatedFeatures />

      <main className="flex-1">
        {/* Hero */}
        <section className="pt-20 md:pt-28 pb-6">
          <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
            <div className="flex items-start justify-between gap-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 mb-3">
                  <MapPin className="w-4 h-4" />
                  Durham & Triangle: Pilot Access
                </div>
                <h1 className="text-3xl md:text-4xl font-black leading-tight text-white">
                  Join the Blueprint Pilot
                </h1>
                <p className="text-slate-300 mt-2 max-w-2xl">
                  For local decision-makers (retail, museums, restaurants,
                  showrooms). Set up your account, add location details, and
                  book your mapping + demo in minutes.
                </p>
              </div>
              <div className="hidden md:flex items-center gap-3 text-slate-300">
                <Shield className="w-5 h-5 text-emerald-300" />
                <span className="text-sm">
                  Optional Stripe checkout • Cancel anytime
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Content gate on token */}
        <section className="pb-16">
          <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
            {isLoading ? (
              <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                <div className="flex flex-col items-center">
                  <Loader2 className="w-10 h-10 animate-spin text-emerald-300 mb-4" />
                  <p className="text-slate-200">Validating your access…</p>
                </div>
              </div>
            ) : !isValidToken ? (
              <div className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                <div className="text-5xl mb-3">⚠️</div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Invalid Access Link
                </h2>
                <p className="text-slate-300 mb-6">
                  This signup link is invalid or has already been used. If you
                  think this is a mistake, contact support.
                </p>
                <Button
                  onClick={() => (window.location.href = "/")}
                  className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700"
                >
                  Return to Homepage
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Rail */}
                <aside className="lg:col-span-1">
                  <div className="sticky top-28 space-y-6">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-emerald-300" />
                        </div>
                        <div>
                          <p className="text-sm text-slate-300">Why join</p>
                          <h3 className="text-lg font-bold text-white">
                            AI glasses that drive results
                          </h3>
                        </div>
                      </div>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-300 mt-0.5" />
                          <span>
                            Delight visitors with guided product & exhibit
                            moments on wearable AI
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-300 mt-0.5" />
                          <span>No app downloads, instant access via QR</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-300 mt-0.5" />
                          <span>
                            We handle mapping, content & analytics for you
                          </span>
                        </li>
                      </ul>
                      <div className="mt-4 text-xs text-slate-400">
                        Serving businesses within ~30 minutes of Durham, NC.
                      </div>
                    </div>

                    {/* Live summary */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="w-4 h-4 text-cyan-300" />
                        <h3 className="text-sm font-semibold text-white">
                          Your Summary
                        </h3>
                      </div>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-2">
                          <Building2 className="w-4 h-4 text-emerald-300 mt-0.5" />
                          <div>
                            <p className="text-slate-400">Organization</p>
                            <p className="text-white">
                              {organizationName || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Mail className="w-4 h-4 text-emerald-300 mt-0.5" />
                          <div>
                            <p className="text-slate-400">Email</p>
                            <p className="text-white break-all">
                              {email || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Phone className="w-4 h-4 text-emerald-300 mt-0.5" />
                          <div>
                            <p className="text-slate-400">Contact</p>
                            <p className="text-white">
                              {contactName || "N/A"}{" "}
                              {phoneNumber ? `• ${phoneNumber}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-emerald-300 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-slate-400">Address</p>
                            <p className="text-white break-words">
                              {address || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Ruler className="w-4 h-4 text-emerald-300 mt-0.5" />
                          <div>
                            <p className="text-slate-400">Sq Ft</p>
                            <p className="text-white">{squareFootage || "N/A"}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Calendar className="w-4 h-4 text-emerald-300 mt-0.5" />
                          <div>
                            <p className="text-slate-400">Mapping</p>
                            <p className="text-white">
                              {scheduleDate
                                ? scheduleDate.toLocaleDateString()
                                : "N/A"}{" "}
                              • {scheduleTime || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Calendar className="w-4 h-4 text-emerald-300 mt-0.5" />
                          <div>
                            <p className="text-slate-400">Next-Day Demo</p>
                            <p className="text-white">
                              {demoDate ? demoDate.toLocaleDateString() : "N/A"} •{" "}
                              {demoTime || "N/A"}
                            </p>
                          </div>
                        </div>
                        {companyWebsite && (
                          <div className="flex items-start gap-2">
                            <Globe className="w-4 h-4 text-emerald-300 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-slate-400">Website</p>
                              <p className="text-white break-all">
                                {companyWebsite}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </aside>

                {/* Main Column */}
                <div className="lg:col-span-2">
                  {/* Stepper */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2">
                      {stepsMeta.map((s, i) => (
                        <React.Fragment key={s.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                                step === s.id
                                  ? "bg-gradient-to-r from-emerald-500 to-cyan-600 text-white border-transparent"
                                  : step > s.id
                                    ? "bg-white text-slate-900 border-white"
                                    : "bg-white/5 text-slate-300 border-white/10"
                              }`}
                            >
                              {s.id}
                            </div>
                            <span
                              className={`hidden sm:inline text-sm ${
                                step >= s.id ? "text-white" : "text-slate-400"
                              }`}
                            >
                              {s.label}
                            </span>
                          </div>
                          {i < stepsMeta.length - 1 && (
                            <div
                              className={`flex-1 h-[2px] rounded-full ${
                                step > s.id
                                  ? "bg-gradient-to-r from-emerald-500 to-cyan-600"
                                  : "bg-white/10"
                              }`}
                            />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* Card */}
                  <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
                    <div className="p-5 sm:p-7">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={step}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -12 }}
                          transition={{ duration: 0.25 }}
                        >
                          {step === 1 && Step1}
                          {step === 2 && Step2}
                          {step === 3 && <Step3 />}
                          {step === 4 && <Step4 />}
                          {step === 5 && <PaymentStep />}
                          {step === 6 && <Confirmation />}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Mobile Summary */}
                  <details className="lg:hidden mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
                    <summary className="cursor-pointer text-sm text-slate-200">
                      Your Summary
                    </summary>
                    <div className="mt-3 text-sm text-slate-200 space-y-2">
                      <div>
                        Organization:{" "}
                        <span className="text-white">
                          {organizationName || "N/A"}
                        </span>
                      </div>
                      <div>
                        Email:{" "}
                        <span className="text-white break-all">
                          {email || "N/A"}
                        </span>
                      </div>
                      <div>
                        Contact:{" "}
                        <span className="text-white">
                          {contactName || "N/A"}{" "}
                          {phoneNumber ? `• ${phoneNumber}` : ""}
                        </span>
                      </div>
                      <div>
                        Address:{" "}
                        <span className="text-white break-words">
                          {address || "N/A"}
                        </span>
                      </div>
                      <div>
                        Sq Ft:{" "}
                        <span className="text-white">
                          {squareFootage || "N/A"}
                        </span>
                      </div>
                      <div>
                        Mapping:{" "}
                        <span className="text-white">
                          {scheduleDate?.toLocaleDateString() || "N/A"} •{" "}
                          {scheduleTime || "N/A"}
                        </span>
                      </div>
                      <div>
                        Next-Day Demo:{" "}
                        <span className="text-white">
                          {demoDate?.toLocaleDateString() || "N/A"} •{" "}
                          {demoTime || "N/A"}
                        </span>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
