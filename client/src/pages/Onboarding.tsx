"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "wouter";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { loadStripe } from "@stripe/stripe-js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getGoogleMapsApiKey } from "@/lib/client-env";

const ONBOARDING_FEE = 499.99;
const INCLUDED_WEEKLY_HOURS = 40;
const EXTRA_HOURLY_RATE = 1.25;

const CHECKOUT_STORAGE_KEY = "blueprintCheckoutContext";

type PlanDefinition = {
  id: string;
  name: string;
  monthlyPrice: number;
  includedKitQuantity: number;
  upgradeSurcharge: number;
};

const PLANS: PlanDefinition[] = [
  {
    id: "starter",
    name: "Blueprint Care Starter",
    monthlyPrice: 49.99,
    includedKitQuantity: 4,
    upgradeSurcharge: 0,
  },
  {
    id: "growth",
    name: "Blueprint Care + 8 kits",
    monthlyPrice: 64.99,
    includedKitQuantity: 8,
    upgradeSurcharge: 15,
  },
  {
    id: "enterprise",
    name: "Blueprint Care + 16 kits",
    monthlyPrice: 94.99,
    includedKitQuantity: 16,
    upgradeSurcharge: 45,
  },
];

const DEFAULT_CARE_PLAN = {
  id: "blueprint-care",
  name: "Blueprint Care",
  monthlyPrice: MONTHLY_RATE,
} as const;

const KIT_UPGRADE_SURCHARGES: Record<(typeof QR_KITS)[number]["id"], number> = {
  starter: 0,
  growth: 15,
  enterprise: 45,
};

const MAPPING_RECOMMENDED_TYPES = new Set([
  "museum",
  "art_gallery",
  "lodging",
  "hotel",
  "point_of_interest",
  "tourist_attraction",
  "grocery_or_supermarket",
  "restaurant",
  "shopping_mall",
  "department_store",
  "clothing_store",
  "store",
  "supermarket",
  "food",
  "cafe",
]);

type StepKey =
  | "account"
  | "mapping"
  | "contact"
  | "schedule"
  | "qr"
  | "payment";

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
  types?: string[];
  displayName?: {
    text?: string;
  };
};

type ShippingAddress = {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

function generateRandomPassword() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default function Onboarding() {
  const auth = useMemo(() => getAuth(), []);
  const [, setLocation] = useLocation();
  const [currentUser, setCurrentUser] = useState(() => auth.currentUser);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => setCurrentUser(user));
    return () => unsubscribe();
  }, [auth]);

  const googleApiKey = useMemo(() => getGoogleMapsApiKey(), []);
  const placesEnabled = Boolean(googleApiKey);

  const [stepIndex, setStepIndex] = useState(0);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [accountCreated, setAccountCreated] = useState(false);

  const [placeQuery, setPlaceQuery] = useState("");
  const [placePredictions, setPlacePredictions] = useState<
    PlacesAutocompleteSuggestion[]
  >([]);
  const [placeDetails, setPlaceDetails] = useState<PlaceDetailsResponse | null>(
    null,
  );
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [loadingPlaceDetails, setLoadingPlaceDetails] = useState(false);
  const [mappingOptIn, setMappingOptIn] = useState<boolean | null>(null);
  const [recommendedMapping, setRecommendedMapping] =
    useState<boolean | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [squareFootage, setSquareFootage] = useState("");

  const [wantsSchedule, setWantsSchedule] = useState(false);
  const [mappingDate, setMappingDate] = useState("");
  const [mappingTime, setMappingTime] = useState("");

  const [selectedPlanId, setSelectedPlanId] = useState<string>(PLANS[0].id);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    DEFAULT_CARE_PLAN.id,
  );
  const [selectedPlanName, setSelectedPlanName] = useState<string>(
    DEFAULT_CARE_PLAN.name,
  );
  const [planMonthlyPrice, setPlanMonthlyPrice] = useState<number>(
    DEFAULT_CARE_PLAN.monthlyPrice,
  );
  const [selectedKitId, setSelectedKitId] = useState<string>(QR_KITS[0].id);
  const [useContactForShipping, setUseContactForShipping] = useState(true);
  const [shippingName, setShippingName] = useState("");
  const [shippingLine1, setShippingLine1] = useState("");
  const [shippingLine2, setShippingLine2] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingState, setShippingState] = useState("");
  const [shippingPostalCode, setShippingPostalCode] = useState("");
  const [shippingCountry, setShippingCountry] = useState("US");

  const [isRedirectingToStripe, setIsRedirectingToStripe] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "success" | "canceled" | "error"
  >("idle");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const orgSessionTokenRef = useRef<string | null>(null);

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
    ): Promise<PlacesAutocompleteSuggestion[]> => {
      if (!googleApiKey) {
        throw new Error("Google Maps API key is not configured.");
      }

      const sessionToken = ensureSessionToken(orgSessionTokenRef);
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
            "X-Goog-FieldMask": "formattedAddress,websiteUri,types,displayName",
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

  useEffect(() => {
    if (!placesEnabled) {
      setPlacePredictions([]);
      return;
    }

    if (!placeQuery || placeQuery.length < 3) {
      setPlacePredictions([]);
      return;
    }

    let cancelled = false;
    setLoadingPlaces(true);
    const handle = window.setTimeout(async () => {
      try {
        const results = await fetchAutocompleteSuggestions(placeQuery);
        if (!cancelled) {
          setPlacePredictions(results);
        }
      } catch (error) {
        console.error("Error fetching place suggestions", error);
        if (!cancelled) {
          setPlaceError("We couldn't fetch locations. Try again in a moment.");
        }
      } finally {
        if (!cancelled) {
          setLoadingPlaces(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [fetchAutocompleteSuggestions, placeQuery, placesEnabled]);

  const stepOrder = useMemo(() => {
    const steps: StepKey[] = ["account", "mapping"];
    if (mappingOptIn) {
      steps.push("contact", "schedule");
    }
    steps.push("qr", "payment");
    return steps;
  }, [mappingOptIn]);

  useEffect(() => {
    if (stepIndex > stepOrder.length - 1) {
      setStepIndex(stepOrder.length - 1);
    }
  }, [stepIndex, stepOrder.length]);

  useEffect(() => {
    if (recommendedMapping !== null && mappingOptIn === null) {
      setMappingOptIn(recommendedMapping);
    }
  }, [mappingOptIn, recommendedMapping]);

  useEffect(() => {
    if (mappingOptIn === false) {
      setUseContactForShipping(false);
    }
  }, [mappingOptIn]);

  const selectedPlan = useMemo(
    () => PLANS.find((plan) => plan.id === selectedPlanId) ?? PLANS[0],
    [selectedPlanId],
  );

  const kitUpgradeSurcharge = useMemo(
    () => KIT_UPGRADE_SURCHARGES[selectedKit.id] ?? 0,
    [selectedKit.id],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedContext = window.sessionStorage.getItem(CHECKOUT_STORAGE_KEY);
    if (!storedContext) {
      return;
    }

    try {
      const parsed = JSON.parse(storedContext) as Partial<{
        organizationName: string;
        email: string;
        mappingOptIn: boolean | null;
        contactName: string;
        contactPhone: string;
        locationAddress: string;
        squareFootage: string;
        mappingDate: string;
        mappingTime: string;
        selectedPlanId: string;
        selectedPlanName: string;
        planMonthlyPrice: number;
        selectedKitId: string;
        useContactForShipping: boolean;
        shippingName: string;
        shippingLine1: string;
        shippingLine2: string;
        shippingCity: string;
        shippingState: string;
        shippingPostalCode: string;
        shippingCountry: string;
        wantsSchedule: boolean;
      }>;

      if (typeof parsed.organizationName === "string") {
        setOrganizationName(parsed.organizationName);
      }
      if (typeof parsed.email === "string") {
        setEmail(parsed.email);
      }
      if (typeof parsed.mappingOptIn === "boolean") {
        setMappingOptIn(parsed.mappingOptIn);
      }
      if (typeof parsed.contactName === "string") {
        setContactName(parsed.contactName);
      }
      if (typeof parsed.contactPhone === "string") {
        setContactPhone(parsed.contactPhone);
      }
      if (typeof parsed.locationAddress === "string") {
        setLocationAddress(parsed.locationAddress);
      }
      if (typeof parsed.squareFootage === "string") {
        setSquareFootage(parsed.squareFootage);
      }
      if (typeof parsed.mappingDate === "string") {
        setMappingDate(parsed.mappingDate);
      }
      if (typeof parsed.mappingTime === "string") {
        setMappingTime(parsed.mappingTime);
      }
      if (typeof parsed.selectedPlanId === "string") {
        const planExists = PLANS.some((plan) => plan.id === parsed.selectedPlanId);
        if (planExists) {
          setSelectedPlanId(parsed.selectedPlanId);
        }
      } else if (typeof parsed.selectedKitId === "string") {
        const planExists = PLANS.some((plan) => plan.id === parsed.selectedKitId);
        if (planExists) {
          setSelectedPlanId(parsed.selectedKitId);
      if (typeof parsed.selectedPlanId === "string" && parsed.selectedPlanId) {
        setSelectedPlanId(parsed.selectedPlanId);
      }
      if (typeof parsed.selectedPlanName === "string" && parsed.selectedPlanName) {
        setSelectedPlanName(parsed.selectedPlanName);
      }
      if (
        typeof parsed.planMonthlyPrice === "number" &&
        Number.isFinite(parsed.planMonthlyPrice)
      ) {
        setPlanMonthlyPrice(parsed.planMonthlyPrice);
      }
      if (typeof parsed.selectedKitId === "string") {
        const kitExists = QR_KITS.some((kit) => kit.id === parsed.selectedKitId);
        if (kitExists) {
          setSelectedKitId(parsed.selectedKitId);
        }
      }
      if (typeof parsed.useContactForShipping === "boolean") {
        setUseContactForShipping(parsed.useContactForShipping);
      }
      if (typeof parsed.shippingName === "string") {
        setShippingName(parsed.shippingName);
      }
      if (typeof parsed.shippingLine1 === "string") {
        setShippingLine1(parsed.shippingLine1);
      }
      if (typeof parsed.shippingLine2 === "string") {
        setShippingLine2(parsed.shippingLine2);
      }
      if (typeof parsed.shippingCity === "string") {
        setShippingCity(parsed.shippingCity);
      }
      if (typeof parsed.shippingState === "string") {
        setShippingState(parsed.shippingState);
      }
      if (typeof parsed.shippingPostalCode === "string") {
        setShippingPostalCode(parsed.shippingPostalCode);
      }
      if (typeof parsed.shippingCountry === "string") {
        setShippingCountry(parsed.shippingCountry);
      }
      if (typeof parsed.wantsSchedule === "boolean") {
        setWantsSchedule(parsed.wantsSchedule);
      }
    } catch (error) {
      console.error("Unable to restore onboarding context", error);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const planParam = params.get("planId") ?? params.get("plan");
    const planNameParam = params.get("planName");
    const planPriceParam = params.get("planPrice") ?? params.get("price");

    if (planParam) {
      setSelectedPlanId(planParam);
      if (!planNameParam) {
        const derivedName = planParam
          .split(/[-_]/)
          .filter(Boolean)
          .map((segment) =>
            segment.length > 0
              ? segment.charAt(0).toUpperCase() + segment.slice(1)
              : segment,
          )
          .join(" ");
        if (derivedName) {
          setSelectedPlanName(derivedName);
        }
      }
    }

    if (planNameParam) {
      setSelectedPlanName(planNameParam);
    }

    if (planPriceParam) {
      const parsedPrice = Number.parseFloat(planPriceParam);
      if (Number.isFinite(parsedPrice) && parsedPrice >= 0) {
        setPlanMonthlyPrice(parsedPrice);
      }
    }

    const checkoutStatus = params.get("checkout");
    if (checkoutStatus === "success") {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(CHECKOUT_STORAGE_KEY);
      }
      setPaymentStatus("success");
      const timer = window.setTimeout(() => {
        setLocation("/dashboard");
      }, 2500);
      return () => window.clearTimeout(timer);
    }
    if (checkoutStatus === "canceled") {
      setPaymentStatus("canceled");
    }
  }, [setLocation]);

  const currentStep = stepOrder[stepIndex];

  const mappingDateTimeIso = useMemo(() => {
    if (!mappingOptIn || !wantsSchedule || !mappingDate || !mappingTime) {
      return undefined;
    }
    const localDateTime = new Date(`${mappingDate}T${mappingTime}`);
    if (Number.isNaN(localDateTime.getTime())) {
      return undefined;
    }
    return localDateTime.toISOString();
  }, [mappingDate, mappingOptIn, mappingTime, wantsSchedule]);

  const shippingAddress: ShippingAddress = useMemo(() => {
    if (useContactForShipping && mappingOptIn) {
      return {
        name: contactName || organizationName,
        line1: locationAddress,
        city: "",
        state: "",
        postalCode: "",
        country: "US",
      };
    }

    return {
      name: shippingName,
      line1: shippingLine1,
      line2: shippingLine2,
      city: shippingCity,
      state: shippingState,
      postalCode: shippingPostalCode,
      country: shippingCountry,
    };
  }, [
    contactName,
    locationAddress,
    mappingOptIn,
    organizationName,
    shippingCity,
    shippingCountry,
    shippingLine1,
    shippingLine2,
    shippingName,
    shippingPostalCode,
    shippingState,
    useContactForShipping,
  ]);

  const totalDueToday = useMemo(() => ONBOARDING_FEE, []);

  const handleSelectPrediction = async (
    prediction: PlacesAutocompleteSuggestion,
  ) => {
    setPlaceQuery(prediction.description);
    setPlacePredictions([]);
    setPlaceError(null);
    setLoadingPlaceDetails(true);
    try {
      const details = await fetchPlaceDetails(prediction.placeId);
      setPlaceDetails(details);
      if (details.formattedAddress) {
        setLocationAddress(details.formattedAddress);
      }
      const isRecommended = Boolean(
        details.types?.some((type) => MAPPING_RECOMMENDED_TYPES.has(type)),
      );
      setRecommendedMapping(isRecommended);
    } catch (error) {
      console.error("Error fetching place details", error);
      setPlaceError("We couldn't load details for that location.");
    } finally {
      setLoadingPlaceDetails(false);
    }
  };

  const completeAccountCreation = async () => {
    if (!email || !organizationName) {
      setAccountError("Enter your organization and email to continue.");
      return;
    }

    if (currentUser && !accountCreated) {
      try {
        await updateProfile(currentUser, {
          displayName: organizationName,
        });
      } catch (error) {
        console.error("Unable to update display name", error);
      }
      setAccountCreated(true);
      setAccountError(null);
      return;
    }

    if (accountCreated) {
      return;
    }

    setIsCreatingAccount(true);
    setAccountError(null);
    try {
      const password = generateRandomPassword();
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      await updateProfile(credential.user, {
        displayName: organizationName,
      });
      await sendPasswordResetEmail(auth, email.trim());
      setAccountCreated(true);
      setCurrentUser(credential.user);
    } catch (error) {
      console.error("Account creation failed", error);
      const message =
        error instanceof Error
          ? error.message
          : "We couldn't create your account. Try again.";
      setAccountError(message);
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === "account") {
      await completeAccountCreation();
      if (!accountCreated && !currentUser) {
        return;
      }
      setPlaceError(null);
      setStepIndex((index) => Math.min(index + 1, stepOrder.length - 1));
      return;
    }

    if (currentStep === "mapping") {
      if (mappingOptIn === null) {
        setPlaceError("Tell us if you'd like Blueprint mapping.");
        return;
      }
      setPlaceError(null);
      setStepIndex((index) => Math.min(index + 1, stepOrder.length - 1));
      return;
    }

    if (currentStep === "contact") {
      if (!contactName || !contactPhone || !locationAddress) {
        setPlaceError("Share contact, phone, and location details to continue.");
        return;
      }
      setPlaceError(null);
      setStepIndex((index) => Math.min(index + 1, stepOrder.length - 1));
      return;
    }

    if (currentStep === "schedule") {
      if (wantsSchedule) {
        if (!mappingDate || !mappingTime) {
          setPlaceError("Choose a date and time or skip scheduling for now.");
          return;
        }
      }
      setPlaceError(null);
      setStepIndex((index) => Math.min(index + 1, stepOrder.length - 1));
      return;
    }

    if (currentStep === "qr") {
      if (!selectedPlanId) {
        setPlaceError("Select a Blueprint Care plan to continue.");
        return;
      }
      if (!useContactForShipping) {
        if (
          !shippingName ||
          !shippingLine1 ||
          !shippingCity ||
          !shippingPostalCode
        ) {
          setPlaceError(
            "Fill out the shipping address so we know where to send kits.",
          );
          return;
        }
      }
      setPlaceError(null);
      setStepIndex((index) => Math.min(index + 1, stepOrder.length - 1));
      return;
    }
  };

  const handleBack = () => {
    setPlaceError(null);
    setStepIndex((index) => Math.max(0, index - 1));
  };

  const startStripeCheckout = async () => {
    try {
      setIsRedirectingToStripe(true);
      setPaymentError(null);

      if (currentUser && mappingOptIn) {
        await setDoc(
          doc(db, "onboardingProfiles", currentUser.uid),
          {
            organizationName: organizationName.trim(),
            email: email.trim(),
            mappingOptIn: true,
            recommendedMapping,
            updatedAt: serverTimestamp(),
            contactName: contactName.trim(),
            contactPhone: contactPhone.trim(),
            locationAddress: locationAddress.trim(),
            squareFootage: squareFootage ? Number(squareFootage) : null,
            mappingScheduledAt: mappingDateTimeIso || null,
          },
          { merge: true },
        );

        await addDoc(collection(db, "mappingRequests"), {
          userId: currentUser.uid,
          organizationName: organizationName.trim(),
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim(),
          locationAddress: locationAddress.trim(),
          squareFootage: squareFootage ? Number(squareFootage) : null,
          mappingScheduledAt: mappingDateTimeIso || null,
          createdAt: serverTimestamp(),
        });
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          CHECKOUT_STORAGE_KEY,
          JSON.stringify({
            organizationName,
            email,
            mappingOptIn,
            contactName,
            contactPhone,
            locationAddress,
            squareFootage,
            mappingDate,
            mappingTime,
            selectedPlanId,
            selectedKitId: selectedPlanId,
            selectedPlanName,
            planMonthlyPrice,
            selectedKitId,
            useContactForShipping,
            shippingName,
            shippingLine1,
            shippingLine2,
            shippingCity,
            shippingState,
            shippingPostalCode,
            shippingCountry,
            wantsSchedule,
          }),
        );
      }

      const currentSearch = window.location.search;
      const successPath = `/onboarding${
        currentSearch ? `${currentSearch}&checkout=success` : "?checkout=success"
      }`;
      const cancelPath = `/onboarding${
        currentSearch ? `${currentSearch}&checkout=canceled` : "?checkout=canceled"
      }`;

      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionType: "onboarding",
          onboardingFee: ONBOARDING_FEE,
          monthlyPrice: selectedPlan.monthlyPrice,
          includedHours: INCLUDED_WEEKLY_HOURS,
          extraHourlyRate: EXTRA_HOURLY_RATE,
          planId: selectedPlanId,
          planName: selectedPlanName,
          monthlyPrice: planMonthlyPrice,
          kitUpgradeSurcharge,
          organizationName: organizationName.trim(),
          contactName: mappingOptIn ? contactName.trim() : "",
          contactEmail: email.trim(),
          mappingDateTime: mappingDateTimeIso,
          mappingOptIn: mappingOptIn === true,
          plan: {
            id: selectedPlan.id,
            name: selectedPlan.name,
            monthlyPrice: selectedPlan.monthlyPrice,
            includedKitQuantity: selectedPlan.includedKitQuantity,
            upgradeSurcharge: selectedPlan.upgradeSurcharge,
          },
          qrKit: {
            name: `Starter kit (${selectedPlan.includedKitQuantity} QR kits)`,
            price: 0,
            id: selectedKit.id,
            name: selectedKit.name,
            price: selectedKit.price,
          },
          shippingAddress,
          successPath,
          cancelPath,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.sessionId) {
        throw new Error(
          data?.error || "We couldn't start checkout just yet. Please try again.",
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
        const result = await stripe.redirectToCheckout({ sessionId: data.sessionId });
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
        const newWindow = window.open(sessionUrl, "_blank", "noopener,noreferrer");
        if (!newWindow) {
          window.location.href = sessionUrl;
        }
        return;
      }

      throw new Error("We couldn't start checkout just yet. Please try again.");
    } catch (error) {
      console.error("Stripe checkout error", error);
      const message =
        error instanceof Error
          ? error.message
          : "We couldn't reach Stripe. Please try again.";
      sessionStorage.removeItem(CHECKOUT_STORAGE_KEY);
      setPaymentStatus("error");
      setPaymentError(message);
    } finally {
      setIsRedirectingToStripe(false);
    }
  };

  const renderAccountStep = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Let's set up your Blueprint account
          </h2>
          <p className="text-slate-500">
            We'll email you a link to set your password after you create your account.
          </p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="organization">Organization name</Label>
            <Input
              id="organization"
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              placeholder="Durham Museum of Science"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@organization.com"
            />
          </div>
          {accountError && (
            <p className="text-sm text-red-600" role="alert">
              {accountError}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={handleNext} disabled={isCreatingAccount}>
            {isCreatingAccount ? "Creating account…" : "Continue"}
          </Button>
        </div>
      </div>
    );
  };

  const renderMappingStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">
          Would you like Blueprint to map your space?
        </h2>
        <p className="text-slate-500">
          Mapping unlocks AR navigation, in-store journeys, and post-visit retargeting.
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="place-search">Search for your venue</Label>
          <Input
            id="place-search"
            value={placeQuery}
            onChange={(event) => {
              setPlaceQuery(event.target.value);
              setPlaceDetails(null);
            }}
            placeholder="Start typing your business name"
            disabled={!placesEnabled}
          />
          {!placesEnabled && (
            <p className="text-xs text-amber-600">
              Google Places isn't configured in this environment. You can still continue and provide your address in the next step.
            </p>
          )}
          {loadingPlaces && (
            <p className="text-xs text-slate-400">Looking for matches…</p>
          )}
          {!loadingPlaces && placePredictions.length > 0 && (
            <div className="rounded-md border border-slate-200 bg-white shadow-sm">
              <ul className="divide-y divide-slate-100">
                {placePredictions.map((prediction) => (
                  <li key={prediction.placeId}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-slate-50"
                      onClick={() => handleSelectPrediction(prediction)}
                    >
                      {prediction.description}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {loadingPlaceDetails && (
            <p className="text-xs text-slate-400">Loading place details…</p>
          )}
          {placeDetails?.formattedAddress && (
            <p className="text-sm text-slate-500">
              We'll map: {placeDetails.formattedAddress}
            </p>
          )}
          {recommendedMapping !== null && (
            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
              {recommendedMapping ? (
                <>
                  Based on Google Places data, Blueprint recommends mapping this location.
                  Venues like museums, hotels, and retail benefit from AR navigation.
                </>
              ) : (
                <>
                  Mapping is optional for this location, but you can still enable it if you want Blueprint to visit.
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
          <div>
            <p className="font-medium text-slate-900">Add Blueprint mapping</p>
            <p className="text-sm text-slate-500">
              Includes on-site LiDAR capture, content planning session, and blueprint generation.
            </p>
          </div>
          <Switch
            checked={Boolean(mappingOptIn)}
            onCheckedChange={(checked) => {
              setMappingOptIn(checked);
              setPlaceError(null);
            }}
          />
        </div>
        {placeError && (
          <p className="text-sm text-red-600" role="alert">
            {placeError}
          </p>
        )}
      </div>
      <div className="flex justify-between">
        <Button variant="ghost" onClick={handleBack}>
          Back
        </Button>
        <Button onClick={handleNext}>Continue</Button>
      </div>
    </div>
  );

  const renderContactStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">
          Who should we meet on-site?
        </h2>
        <p className="text-slate-500">
          We'll confirm by email and SMS before your mapping appointment.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="contact-name">Primary contact</Label>
          <Input
            id="contact-name"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            placeholder="Jordan Smith"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-phone">Mobile number</Label>
          <Input
            id="contact-phone"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            placeholder="(555) 555-5555"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="square-footage">Approximate square footage</Label>
          <Input
            id="square-footage"
            type="number"
            min={0}
            value={squareFootage}
            onChange={(event) => setSquareFootage(event.target.value)}
            placeholder="5000"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="location-address">Location address</Label>
          <Input
            id="location-address"
            value={locationAddress}
            onChange={(event) => setLocationAddress(event.target.value)}
            placeholder="123 Main Street, Durham, NC"
          />
        </div>
      </div>
      {placeError && (
        <p className="text-sm text-red-600" role="alert">
          {placeError}
        </p>
      )}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={handleBack}>
          Back
        </Button>
        <Button onClick={handleNext}>Continue</Button>
      </div>
    </div>
  );

  const renderScheduleStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">
          Schedule your mapping day (optional)
        </h2>
        <p className="text-slate-500">
          Pick a slot now or skip and our team will coordinate with your contact later.
        </p>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
        <div>
          <p className="font-medium text-slate-900">Schedule now</p>
          <p className="text-sm text-slate-500">
            We'll send confirmation and reminders before the visit.
          </p>
        </div>
        <Switch
          checked={wantsSchedule}
          onCheckedChange={(checked) => setWantsSchedule(checked)}
        />
      </div>
      {wantsSchedule && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mapping-date">Preferred date</Label>
            <Input
              id="mapping-date"
              type="date"
              value={mappingDate}
              onChange={(event) => setMappingDate(event.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mapping-time">Preferred start time</Label>
            <Input
              id="mapping-time"
              type="time"
              value={mappingTime}
              onChange={(event) => setMappingTime(event.target.value)}
            />
          </div>
        </div>
      )}
      {placeError && (
        <p className="text-sm text-red-600" role="alert">
          {placeError}
        </p>
      )}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={handleBack}>
          Back
        </Button>
        <Button onClick={handleNext}>Continue</Button>
      </div>
    </div>
  );

  const renderQrStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">
          Choose your Blueprint QR kit
        </h2>
        <p className="text-slate-500">
          Kits arrive ready to deploy with venue-specific copy and call-to-action.
        </p>
      </div>
      <div className="space-y-3">
        {PLANS.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          const isBasePlan = plan.id === PLANS[0].id;
          const upgradeCopy = isBasePlan
            ? "Included in the base Blueprint Care subscription."
            : `Adds ${formatUsd(plan.upgradeSurcharge)} / month for more kits.`;
          const description = plan.includedKitQuantity >= 16
            ? "Campus, arena, or large-format coverage."
            : plan.includedKitQuantity >= 8
            ? "Extra kits for multi-room venues or dual locations."
            : "Launch-ready coverage for your first location.";

          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => {
                setSelectedPlanId(plan.id);
                setPlaceError(null);
              }}
              className={`w-full rounded-lg border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 ${
                isSelected
                  ? "border-slate-900 bg-slate-900/5"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-900">
                    {plan.includedKitQuantity} QR kits
                  </p>
                  <p className="text-sm text-slate-500">{description}</p>
                  <p className="text-xs text-slate-500">{upgradeCopy}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">
                    {formatUsd(plan.monthlyPrice)} / month
                  </p>
                  {!isBasePlan && (
                    <p className="text-xs text-slate-500">
                      +{formatUsd(plan.upgradeSurcharge)} vs. starter
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-slate-500">
        We automatically share shipping progress and activation notifications so your
        team knows when every QR kit goes live.
      </p>
      <div className="space-y-3 rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900">Ship kits to mapping location</p>
            <p className="text-sm text-slate-500">Toggle off to enter a different shipping address.</p>
          </div>
          <Switch
            checked={useContactForShipping}
            onCheckedChange={(checked) => setUseContactForShipping(checked)}
            disabled={!mappingOptIn}
          />
        </div>
        {!useContactForShipping && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="shipping-name">Recipient name</Label>
              <Input
                id="shipping-name"
                value={shippingName}
                onChange={(event) => setShippingName(event.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="shipping-line1">Street address</Label>
              <Input
                id="shipping-line1"
                value={shippingLine1}
                onChange={(event) => setShippingLine1(event.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="shipping-line2">Apartment, suite, etc. (optional)</Label>
              <Input
                id="shipping-line2"
                value={shippingLine2}
                onChange={(event) => setShippingLine2(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="shipping-city">City</Label>
              <Input
                id="shipping-city"
                value={shippingCity}
                onChange={(event) => setShippingCity(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="shipping-state">State / Province</Label>
              <Input
                id="shipping-state"
                value={shippingState}
                onChange={(event) => setShippingState(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="shipping-postal">Postal code</Label>
              <Input
                id="shipping-postal"
                value={shippingPostalCode}
                onChange={(event) => setShippingPostalCode(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="shipping-country">Country</Label>
              <Input
                id="shipping-country"
                value={shippingCountry}
                onChange={(event) => setShippingCountry(event.target.value)}
              />
            </div>
          </div>
        )}
      </div>
      {placeError && (
        <p className="text-sm text-red-600" role="alert">
          {placeError}
        </p>
      )}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={handleBack}>
          Back
        </Button>
        <Button onClick={handleNext}>Continue</Button>
      </div>
    </div>
  );

  const renderPaymentStep = () => {
    const isBasePlan = selectedPlan.id === PLANS[0].id;
    const kitSummary = `Starter kit (${selectedPlan.includedKitQuantity} QR kits)`;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Plan & payment
          </h2>
          <p className="text-slate-500">
            Review your Blueprint Care plan details. Billing for the monthly subscription
            starts after your kits are activated.
          </p>
        </div>
        <div className="space-y-4 rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Onboarding experience</span>
            <span className="font-medium text-slate-900">{formatUsd(ONBOARDING_FEE)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">{kitSummary}</span>
            <span className="font-medium text-slate-900">Included</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
            <span>Total due today</span>
            <span>{formatUsd(totalDueToday)}</span>
          </div>
        </div>
        <div className="space-y-3 rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Blueprint Care plan</span>
            <span className="font-medium text-slate-900">
              {formatUsd(selectedPlan.monthlyPrice)} / month
            </span>
          </div>
          <p className="text-sm text-slate-500">
            {isBasePlan
              ? `Includes your starter kit with ${selectedPlan.includedKitQuantity} QR kits.`
              : `Includes ${selectedPlan.includedKitQuantity} QR kits and adds ${formatUsd(
                  selectedPlan.upgradeSurcharge,
                )} / month for additional coverage.`}
          </p>
          <p className="text-sm text-slate-500">
            Monthly billing only begins after your team activates the delivered kits.
          </p>
        </div>
      {shippingAddress?.line1 && (
        <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-900">Shipping to</p>
          <p>{shippingAddress.name}</p>
          <p>{shippingAddress.line1}</p>
          {shippingAddress.line2 && <p>{shippingAddress.line2}</p>}
          <p>
            {[shippingAddress.city, shippingAddress.state, shippingAddress.postalCode]
              .filter(Boolean)
              .join(", ")}
          </p>
          <p>{shippingAddress.country}</p>
        </div>
      )}
      {paymentError && (
        <p className="text-sm text-red-600" role="alert">
          {paymentError}
        </p>
      )}
      {paymentStatus === "canceled" && (
        <p className="text-sm text-amber-600">
          Checkout was canceled. You can resume whenever you're ready.
        </p>
      )}
      {paymentStatus === "success" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          Payment confirmed! Redirecting you to the dashboard…
        </div>
      )}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={handleBack} disabled={isRedirectingToStripe}>
          Back
        </Button>
        <Button onClick={startStripeCheckout} disabled={isRedirectingToStripe}>
          {isRedirectingToStripe ? "Redirecting…" : "Start checkout"}
        </Button>
      </div>
    </div>
  );
  };

  const renderStep = () => {
    switch (currentStep) {
      case "account":
        return renderAccountStep();
      case "mapping":
        return renderMappingStep();
      case "contact":
        return renderContactStep();
      case "schedule":
        return renderScheduleStep();
      case "qr":
        return renderQrStep();
      case "payment":
        return renderPaymentStep();
      default:
        return null;
    }
  };

  const stepNames: Record<StepKey, string> = {
    account: "Account",
    mapping: "Mapping",
    contact: "Contact",
    schedule: "Schedule",
    qr: "QR kit",
    payment: "Payment",
  };

  const stepColumnsClass =
    stepOrder.length === 6
      ? "grid-cols-6"
      : stepOrder.length === 5
      ? "grid-cols-5"
      : "grid-cols-4";

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-white via-slate-50 to-slate-100">
      <Nav hideAuthenticatedFeatures={true} />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-4 py-16">
        <div className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Blueprint onboarding
            </p>
            <div
              className={`grid ${stepColumnsClass} gap-2 text-xs font-medium text-slate-500`}
            >
              {stepOrder.map((step, index) => (
                <div
                  key={step}
                  className={`rounded-full px-3 py-2 text-center ${
                    index === stepIndex
                      ? "bg-slate-900 text-white"
                      : index < stepIndex
                      ? "bg-slate-200 text-slate-700"
                      : "bg-slate-100"
                  }`}
                >
                  {stepNames[step]}
                </div>
              ))}
            </div>
          </div>
          {renderStep()}
        </div>
      </main>
      <Footer />
    </div>
  );
}

