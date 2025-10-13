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
import { getAuth, updateProfile } from "firebase/auth";
import { collection, doc, serverTimestamp, setDoc, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getGoogleMapsApiKey } from "@/lib/client-env";
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  Compass,
  Map,
  Navigation2,
  Radar,
  Sparkles,
  SquareStack,
} from "lucide-react";

const ONBOARDING_FEE = 499.99;
const INCLUDED_WEEKLY_HOURS = 40;
const EXTRA_HOURLY_RATE = 1.25;
const MAPPING_ADD_ON_PRICE = 99;

const CHECKOUT_STORAGE_KEY = "blueprintCheckoutContext";
const DEFAULT_MONTHLY_RATE = 99;

type PlanTier = {
  id: string;
  name: string;
  monthlyPrice: number;
  mauLabel: string;
  description: string;
  recommended?: boolean;
};

const PLAN_TIERS: PlanTier[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 99,
    mauLabel: "Supports up to 100 monthly active users",
    description: "Best for a single location or flagship launch.",
    recommended: true,
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 149,
    mauLabel: "Supports up to 250 monthly active users",
    description: "Multi-location teams and higher traffic venues.",
  },
];

type KitOption = {
  id: string;
  name: string;
  includedKitQuantity: number;
  oneTimePrice: number;
  description: string;
  recommendedFor: string;
};

const QR_KITS: KitOption[] = [
  {
    id: "starter",
    name: "Starter kit",
    includedKitQuantity: 4,
    oneTimePrice: 0,
    description: "Launch-ready placements for your first blueprint zones.",
    recommendedFor: "Boutiques, cafes, and first location pilots.",
  },
  {
    id: "growth",
    name: "Growth kit",
    includedKitQuantity: 8,
    oneTimePrice: 15,
    description: "Double coverage so multiple rooms or entrances stay activated.",
    recommendedFor: "Museums, hotels, and multi-wing experiences.",
  },
  {
    id: "enterprise",
    name: "Enterprise kit",
    includedKitQuantity: 16,
    oneTimePrice: 45,
    description: "Full campus or arena coverage with redundancy for events.",
    recommendedFor: "Large-format venues, stadiums, and campuses.",
  },
];

const DEFAULT_PLAN = PLAN_TIERS[0];

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

const MAPPING_BENEFITS = [
  {
    icon: Navigation2,
    title: "Guests can ask where anything is",
    description:
      "Blueprint answers questions like “Where is the merch desk?” with precise turn-by-turn guidance.",
  },
  {
    icon: Map,
    title: "Guided indoor navigation",
    description: "Deliver a visual map that orients visitors and staff in seconds.",
  },
  {
    icon: Sparkles,
    title: "Contextual nudges",
    description: "Trigger promos, safety reminders, or concierge tips at the right zone.",
  },
  {
    icon: Radar,
    title: "Movement intelligence",
    description: "See hot zones, dwell time, and peak flows to improve staffing.",
  },
  {
    icon: Compass,
    title: "Niantic VPS localization",
    description: "Lightship-ready anchors help devices instantly understand where they are.",
  },
  {
    icon: SquareStack,
    title: "Future-proof for AR launches",
    description: "Use the same spatial map for upcoming wearable and heads-up experiences.",
  },
];

const MAPPING_REQUIREMENTS = [
  {
    icon: Clock,
    title: "30–60 minute visit",
    description: "A Blueprint Mapper captures LiDAR on-site at a scheduled time.",
  },
  {
    icon: BadgeCheck,
    title: "One-time $99 add-on",
    description: "Charged at the end of onboarding alongside your QR kits.",
  },
  {
    icon: Sparkles,
    title: "Content planning session",
    description: "We plan zones and journeys before your first visitors arrive.",
  },
];

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
  const [isSavingOrganization, setIsSavingOrganization] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const [organizationName, setOrganizationName] = useState(
    () => currentUser?.displayName ?? "",
  );
  const [activeSearchContext, setActiveSearchContext] = useState<
    "account" | "mapping" | null
  >(null);

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

  const [selectedPlanId, setSelectedPlanId] = useState<string>(DEFAULT_PLAN.id);
  const [selectedPlanName, setSelectedPlanName] = useState<string>(
    DEFAULT_PLAN.name,
  );
  const [planMonthlyPrice, setPlanMonthlyPrice] = useState<number>(
    DEFAULT_PLAN.monthlyPrice,
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
    if (!placeQuery && organizationName) {
      setPlaceQuery(organizationName);
    }
  }, [organizationName, placeQuery]);

  useEffect(() => {
    if (mappingOptIn === false) {
      setUseContactForShipping(false);
    }
  }, [mappingOptIn]);

  const selectedPlan = useMemo(
    () => PLAN_TIERS.find((plan) => plan.id === selectedPlanId) ?? DEFAULT_PLAN,
    [selectedPlanId],
  );

  const selectedKit = useMemo(
    () => QR_KITS.find((kit) => kit.id === selectedKitId) ?? QR_KITS[0],
    [selectedKitId],
  );

  const kitUpgradeOneTime = selectedKit.oneTimePrice;

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
        const matchingPlan = PLAN_TIERS.find(
          (plan) => plan.id === parsed.selectedPlanId,
        );
        if (matchingPlan) {
          setSelectedPlanId(matchingPlan.id);
          setSelectedPlanName(parsed.selectedPlanName ?? matchingPlan.name);
          setPlanMonthlyPrice(
            typeof parsed.planMonthlyPrice === "number" &&
              Number.isFinite(parsed.planMonthlyPrice)
              ? parsed.planMonthlyPrice
              : matchingPlan.monthlyPrice,
          );
        }
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

  const totalDueToday = useMemo(
    () => ONBOARDING_FEE + kitUpgradeOneTime,
    [kitUpgradeOneTime],
  );

  const inputClasses =
    "border-white/10 bg-slate-900/60 text-white placeholder:text-slate-500 focus-visible:border-emerald-400 focus-visible:ring-emerald-400/40";

  const handleSelectPrediction = async (
    prediction: PlacesAutocompleteSuggestion,
  ) => {
    setPlaceQuery(prediction.description);
    setOrganizationName(prediction.description);
    setPlacePredictions([]);
    setActiveSearchContext(null);
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
    const trimmedName = organizationName.trim();
    if (!trimmedName) {
      setAccountError("Add your organization name to continue.");
      return false;
    }

    if (!currentUser) {
      setAccountError("Please sign in before continuing.");
      return false;
    }

    if (currentUser.displayName === trimmedName) {
      setAccountError(null);
      return true;
    }

    setIsSavingOrganization(true);
    setAccountError(null);
    try {
      await updateProfile(currentUser, { displayName: trimmedName });
      setCurrentUser(auth.currentUser);
      return true;
    } catch (error) {
      console.error("Unable to update organization name", error);
      setAccountError(
        "We couldn't save your organization. Try again in a moment.",
      );
      return false;
    } finally {
      setIsSavingOrganization(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === "account") {
      const saved = await completeAccountCreation();
      if (!saved) {
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
            email: currentUser.email ?? "",
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
            mappingOptIn,
            contactName,
            contactPhone,
            locationAddress,
            squareFootage,
            mappingDate,
            mappingTime,
            selectedPlanId,
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
          monthlyPrice: planMonthlyPrice,
          includedHours: INCLUDED_WEEKLY_HOURS,
          extraHourlyRate: EXTRA_HOURLY_RATE,
          planId: selectedPlanId,
          planName: selectedPlanName,
          kitUpgradeSurcharge: kitUpgradeOneTime,
          organizationName: organizationName.trim(),
          contactName: mappingOptIn ? contactName.trim() : "",
          contactEmail: currentUser?.email ?? "",
          mappingDateTime: mappingDateTimeIso,
          mappingOptIn: mappingOptIn === true,
          plan: {
            id: selectedPlan.id,
            name: `${selectedPlan.name} plan`,
            monthlyPrice: planMonthlyPrice,
            includedKitQuantity: selectedKit.includedKitQuantity,
            upgradeSurcharge: 0,
          },
          qrKit: {
            id: selectedKit.id,
            name: `${selectedKit.name} (${selectedKit.includedKitQuantity} QR kits)`,
            price: selectedKit.oneTimePrice,
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
    const showAccountPredictions =
      activeSearchContext === "account" &&
      !loadingPlaces &&
      placePredictions.length > 0;

    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-emerald-300/80">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-[0.4em]">
              Blueprint profile
            </span>
          </div>
          <h2 className="text-3xl font-semibold text-white">
            Who are we onboarding?
          </h2>
          <p className="text-sm text-slate-300">
            We’ll reference this organization in your assistant, billing, and kit artwork.
          </p>
        </div>
        <div className="space-y-3">
          <Label htmlFor="organization" className="text-slate-200">
            Organization name
          </Label>
          <div className="relative">
            <Input
              id="organization"
              value={organizationName}
              onChange={(event) => {
                const value = event.target.value;
                setOrganizationName(value);
                setPlaceQuery(value);
                setPlaceDetails(null);
                setAccountError(null);
                setActiveSearchContext("account");
              }}
              onFocus={() => setActiveSearchContext("account")}
              onBlur={() => {
                setTimeout(() => {
                  setActiveSearchContext((context) =>
                    context === "account" ? null : context,
                  );
                }, 120);
              }}
              placeholder="Start typing your business name"
              autoComplete="organization"
              className={`${inputClasses} pr-10`}
            />
            {loadingPlaces && activeSearchContext === "account" && (
              <p className="absolute right-0 top-full mt-2 text-xs text-slate-400">
                Looking for matches…
              </p>
            )}
            {showAccountPredictions && (
              <div className="absolute z-30 mt-3 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 shadow-xl backdrop-blur">
                <ul className="divide-y divide-white/5">
                  {placePredictions.map((prediction) => (
                    <li key={prediction.placeId}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-emerald-500/10"
                        onClick={() => handleSelectPrediction(prediction)}
                      >
                        <span>{prediction.description}</span>
                        <ArrowRight className="h-4 w-4 text-emerald-300" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {!placesEnabled && (
            <p className="text-xs text-amber-300/80">
              Google Places isn’t configured in this environment. Continue and enter your venue details manually.
            </p>
          )}
          <p className="text-xs text-slate-400">
            Selecting a result keeps your address and website synced across Blueprint.
          </p>
          {accountError && (
            <p className="text-sm text-rose-400" role="alert">
              {accountError}
            </p>
          )}
        </div>
        <div className="flex justify-end">
          <Button onClick={handleNext} disabled={isSavingOrganization}>
            {isSavingOrganization ? "Saving…" : "Continue"}
          </Button>
        </div>
      </div>
    );
  };

  const renderMappingStep = () => {
    const showMappingPredictions =
      activeSearchContext === "mapping" &&
      !loadingPlaces &&
      placePredictions.length > 0;

    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-emerald-300/80">
            <Radar className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-[0.4em]">
              Spatial mapping
            </span>
          </div>
          <h2 className="text-3xl font-semibold text-white">
            Would you like Blueprint to map your space?
          </h2>
          <p className="text-sm text-slate-300">
            Mapping unlocks AR navigation, in-store journeys, and post-visit retargeting.
          </p>
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100 shadow-[0_0_25px_rgba(16,185,129,0.25)]">
            <p className="font-semibold">
              Add Blueprint mapping — {formatUsd(MAPPING_ADD_ON_PRICE)} one-time
            </p>
            <p className="mt-1 text-emerald-100/80">
              Includes on-site LiDAR capture, a content planning session, and your spatial blueprint generation.
            </p>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          <div className="space-y-5">
            <div className="space-y-3">
              <Label htmlFor="place-search" className="text-slate-200">
                Search for your venue
              </Label>
              <div className="relative">
                <Input
                  id="place-search"
                  value={placeQuery}
                  onChange={(event) => {
                    const value = event.target.value;
                    setPlaceQuery(value);
                    setPlaceDetails(null);
                    setActiveSearchContext("mapping");
                    setPlaceError(null);
                  }}
                  onFocus={() => setActiveSearchContext("mapping")}
                  onBlur={() => {
                    setTimeout(() => {
                      setActiveSearchContext((context) =>
                        context === "mapping" ? null : context,
                      );
                    }, 120);
                  }}
                  placeholder="Start typing your business name"
                  className={`${inputClasses} pr-10`}
                  disabled={!placesEnabled}
                />
                {loadingPlaces && activeSearchContext === "mapping" && (
                  <p className="absolute right-0 top-full mt-2 text-xs text-slate-400">
                    Looking for matches…
                  </p>
                )}
                {showMappingPredictions && (
                  <div className="absolute z-30 mt-3 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 shadow-xl backdrop-blur">
                    <ul className="divide-y divide-white/5">
                      {placePredictions.map((prediction) => (
                        <li key={prediction.placeId}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-emerald-500/10"
                            onClick={() => handleSelectPrediction(prediction)}
                          >
                            <span>{prediction.description}</span>
                            <ArrowRight className="h-4 w-4 text-emerald-300" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {!placesEnabled && (
                <p className="text-xs text-amber-300/80">
                  Google Places isn’t configured in this environment. You can continue and enter your address on the next step.
                </p>
              )}
              {loadingPlaceDetails && (
                <p className="text-xs text-slate-400">Loading place details…</p>
              )}
              {placeDetails?.formattedAddress && (
                <p className="text-sm text-slate-300">
                  We’ll map: {placeDetails.formattedAddress}
                </p>
              )}
              {recommendedMapping !== null && (
                <div
                  className={`rounded-2xl border p-4 text-sm ${
                    recommendedMapping
                      ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                      : "border-white/10 bg-white/5 text-slate-200"
                  }`}
                >
                  {recommendedMapping ? (
                    <>
                      Based on Google data we recommend mapping this venue. Museums, hotels, and multi-room retail see the biggest lift.
                    </>
                  ) : (
                    <>
                      Mapping is optional for tighter spaces, but you can still enable it if you want the guided experience.
                    </>
                  )}
                </div>
              )}
              <p className="text-xs text-slate-400">
                We currently recommend mapping for museums, hotels, multi-level retail, campuses, and attractions—but any location can opt in.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  value: true,
                  title: "Yes, map our location",
                  description:
                    "Unlock navigation, contextual nudges, and location analytics from day one.",
                  icon: Navigation2,
                  highlight: recommendedMapping === true,
                },
                {
                  value: false,
                  title: "Not right now",
                  description:
                    "Skip the visit today—you can request mapping later from your dashboard.",
                  icon: Clock,
                },
              ].map((option) => {
                const Icon = option.icon;
                const isSelected = mappingOptIn === option.value;
                return (
                  <button
                    key={option.title}
                    type="button"
                    onClick={() => {
                      setMappingOptIn(option.value);
                      setPlaceError(null);
                    }}
                    className={`rounded-2xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400/60 ${
                      isSelected
                        ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.25)]"
                        : "border-white/10 bg-slate-900/50 text-slate-200 hover:border-emerald-400/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-2 text-emerald-200">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white">{option.title}</p>
                          {option.highlight && (
                            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300">{option.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {placeError && (
              <p className="text-sm text-rose-400" role="alert">
                {placeError}
              </p>
            )}
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-6">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-300">
                What you unlock
              </h3>
              <ul className="mt-4 space-y-3">
                {MAPPING_BENEFITS.map((benefit) => {
                  const Icon = benefit.icon;
                  return (
                    <li key={benefit.title} className="flex items-start gap-3">
                      <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-2 text-emerald-200">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{benefit.title}</p>
                        <p className="text-xs text-slate-300">{benefit.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-6">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-300">
                What we need from you
              </h3>
              <ul className="mt-4 space-y-3">
                {MAPPING_REQUIREMENTS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.title} className="flex items-start gap-3">
                      <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-2 text-emerald-200">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{item.title}</p>
                        <p className="text-xs text-slate-300">{item.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
        <div className="flex justify-between">
          <Button variant="ghost" onClick={handleBack}>
            Back
          </Button>
          <Button onClick={handleNext}>Continue</Button>
        </div>
      </div>
    );
  };

  const renderContactStep = () => (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 text-emerald-300/80">
          <BadgeCheck className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-[0.4em]">
            On-site contact
          </span>
        </div>
        <h2 className="text-3xl font-semibold text-white">
          Who should we meet on-site?
        </h2>
        <p className="text-sm text-slate-300">
          We’ll confirm by email and SMS before your mapping appointment.
        </p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="contact-name" className="text-slate-200">
              Primary contact
            </Label>
            <Input
              id="contact-name"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              placeholder="Jordan Smith"
              className={inputClasses}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-phone" className="text-slate-200">
              Mobile number
            </Label>
            <Input
              id="contact-phone"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
              placeholder="(555) 555-5555"
              className={inputClasses}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="square-footage" className="text-slate-200">
              Approximate square footage
            </Label>
            <Input
              id="square-footage"
              type="number"
              min={0}
              value={squareFootage}
              onChange={(event) => setSquareFootage(event.target.value)}
              placeholder="5000"
              className={inputClasses}
            />
            <p className="text-xs text-slate-400">
              Rough estimates help us plan the right capture path.
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="location-address" className="text-slate-200">
              Location address
            </Label>
            <Input
              id="location-address"
              value={locationAddress}
              onChange={(event) => setLocationAddress(event.target.value)}
              placeholder="123 Main Street, Durham, NC"
              className={inputClasses}
            />
          </div>
        </div>
      </div>
      {placeError && (
        <p className="text-sm text-rose-400" role="alert">
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
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 text-emerald-300/80">
          <Clock className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-[0.4em]">
            Mapping visit
          </span>
        </div>
        <h2 className="text-3xl font-semibold text-white">
          Schedule your mapping day (optional)
        </h2>
        <p className="text-sm text-slate-300">
          Pick a slot now or skip and our team will coordinate with your contact later.
        </p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="font-medium text-white">Schedule now</p>
            <p className="text-sm text-slate-300">
              We’ll send confirmations and reminders before the visit.
            </p>
          </div>
          <Switch
            checked={wantsSchedule}
            onCheckedChange={(checked) => setWantsSchedule(checked)}
          />
        </div>
        {wantsSchedule && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mapping-date" className="text-slate-200">
                Preferred date
              </Label>
              <Input
                id="mapping-date"
                type="date"
                value={mappingDate}
                onChange={(event) => setMappingDate(event.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className={inputClasses}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mapping-time" className="text-slate-200">
                Preferred start time
              </Label>
              <Input
                id="mapping-time"
                type="time"
                value={mappingTime}
                onChange={(event) => setMappingTime(event.target.value)}
                className={inputClasses}
              />
            </div>
          </div>
        )}
      </div>
      {placeError && (
        <p className="text-sm text-rose-400" role="alert">
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
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 text-emerald-300/80">
          <SquareStack className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-[0.4em]">
            Plan & kits
          </span>
        </div>
        <h2 className="text-3xl font-semibold text-white">
          Choose your Blueprint Care plan & QR kit
        </h2>
        <p className="text-sm text-slate-300">
          Monthly pricing stays the same across kit sizes—upgrades are a one-time print and fulfillment cost.
        </p>
      </div>
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-300">
          Plan tiers
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {PLAN_TIERS.map((plan) => {
            const isSelected = selectedPlanId === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => {
                  setSelectedPlanId(plan.id);
                  setSelectedPlanName(plan.name);
                  setPlanMonthlyPrice(plan.monthlyPrice);
                  setPlaceError(null);
                }}
                className={`rounded-2xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400/60 ${
                  isSelected
                    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.25)]"
                    : "border-white/10 bg-slate-900/50 text-slate-200 hover:border-emerald-400/30"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-white">{plan.name}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/80">
                      {plan.mauLabel}
                    </p>
                    <p className="text-sm text-slate-300">{plan.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-semibold text-white">
                      {formatUsd(plan.monthlyPrice)}
                      <span className="ml-1 text-sm text-slate-300">/mo</span>
                    </p>
                    {plan.recommended && (
                      <span className="mt-2 inline-flex rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-100">
                        Popular
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400">
          Billing begins after your kits are activated.
        </p>
      </div>
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-300">
          QR kit size
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          {QR_KITS.map((kit) => {
            const isSelected = selectedKitId === kit.id;
            return (
              <button
                key={kit.id}
                type="button"
                onClick={() => {
                  setSelectedKitId(kit.id);
                  setPlaceError(null);
                }}
                className={`rounded-2xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400/60 ${
                  isSelected
                    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.25)]"
                    : "border-white/10 bg-slate-900/50 text-slate-200 hover:border-emerald-400/30"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-white">
                      {kit.includedKitQuantity} QR kits
                    </p>
                    <p className="text-sm text-slate-300">{kit.description}</p>
                    <p className="text-xs text-slate-400">{kit.recommendedFor}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-white">
                      {kit.oneTimePrice === 0
                        ? "Included"
                        : `${formatUsd(kit.oneTimePrice)} one-time`}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-white">Ship kits to mapping location</p>
            <p className="text-sm text-slate-300">
              Toggle off to enter a different shipping address.
            </p>
          </div>
          <Switch
            checked={useContactForShipping}
            onCheckedChange={(checked) => setUseContactForShipping(checked)}
            disabled={!mappingOptIn}
          />
        </div>
        {!useContactForShipping && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="shipping-name" className="text-slate-200">
                Recipient name
              </Label>
              <Input
                id="shipping-name"
                value={shippingName}
                onChange={(event) => setShippingName(event.target.value)}
                className={inputClasses}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="shipping-line1" className="text-slate-200">
                Street address
              </Label>
              <Input
                id="shipping-line1"
                value={shippingLine1}
                onChange={(event) => setShippingLine1(event.target.value)}
                className={inputClasses}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="shipping-line2" className="text-slate-200">
                Apartment, suite, etc. (optional)
              </Label>
              <Input
                id="shipping-line2"
                value={shippingLine2}
                onChange={(event) => setShippingLine2(event.target.value)}
                className={inputClasses}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="shipping-city" className="text-slate-200">
                City
              </Label>
              <Input
                id="shipping-city"
                value={shippingCity}
                onChange={(event) => setShippingCity(event.target.value)}
                className={inputClasses}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="shipping-state" className="text-slate-200">
                State / Province
              </Label>
              <Input
                id="shipping-state"
                value={shippingState}
                onChange={(event) => setShippingState(event.target.value)}
                className={inputClasses}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="shipping-postal" className="text-slate-200">
                Postal code
              </Label>
              <Input
                id="shipping-postal"
                value={shippingPostalCode}
                onChange={(event) => setShippingPostalCode(event.target.value)}
                className={inputClasses}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="shipping-country" className="text-slate-200">
                Country
              </Label>
              <Input
                id="shipping-country"
                value={shippingCountry}
                onChange={(event) => setShippingCountry(event.target.value)}
                className={inputClasses}
              />
            </div>
          </div>
        )}
      </div>
      {placeError && (
        <p className="text-sm text-rose-400" role="alert">
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
    const dueTodayItems = [
      {
        label: "Blueprint onboarding experience",
        amount: ONBOARDING_FEE,
      },
    ];

    if (kitUpgradeOneTime > 0) {
      dueTodayItems.push({
        label: `${selectedKit.name} upgrade (${selectedKit.includedKitQuantity} kits)`,
        amount: kitUpgradeOneTime,
      });
    }

    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-emerald-300/80">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-[0.4em]">
              Checkout
            </span>
          </div>
          <h2 className="text-3xl font-semibold text-white">Review and confirm</h2>
          <p className="text-sm text-slate-300">
            You’ll pay today for onboarding and any kit upgrades. Monthly billing starts after activation.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-300">
              Subscription summary
            </h3>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3 text-base text-white">
                <span>{selectedPlanName} plan</span>
                <span>{formatUsd(planMonthlyPrice)}/mo</span>
              </div>
              <p className="text-xs text-slate-400">
                Monthly pricing stays the same across kit sizes. Billing begins once your kits are activated.
              </p>
              <div className="flex items-start justify-between gap-3 pt-2">
                <div>
                  <p className="font-medium text-white">{selectedKit.name}</p>
                  <p className="text-xs text-slate-300">
                    {selectedKit.includedKitQuantity} QR kits — {selectedKit.description}
                  </p>
                </div>
                <span className="text-sm text-slate-200">
                  {kitUpgradeOneTime === 0
                    ? "Included"
                    : `${formatUsd(kitUpgradeOneTime)} one-time`}
                </span>
              </div>
              {mappingOptIn && (
                <div className="flex items-start justify-between gap-3 pt-2">
                  <div>
                    <p className="font-medium text-white">Blueprint mapping add-on</p>
                    <p className="text-xs text-slate-300">
                      {MAPPING_BENEFITS[0].title}, LiDAR capture, and zone planning.
                    </p>
                  </div>
                  <span className="text-sm text-slate-200">
                    {formatUsd(MAPPING_ADD_ON_PRICE)} billed after visit
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-300">
              Due today
            </h3>
            <div className="space-y-3 text-sm text-slate-300">
              {dueTodayItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3"
                >
                  <span>{item.label}</span>
                  <span className="font-semibold text-white">
                    {formatUsd(item.amount)}
                  </span>
                </div>
              ))}
              <div className="mt-4 border-t border-white/10 pt-4">
                <div className="flex items-center justify-between gap-3 text-base">
                  <span className="font-semibold text-white">Total today</span>
                  <span className="text-lg font-semibold text-white">
                    {formatUsd(totalDueToday)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  We’ll redirect you to Stripe to complete payment securely.
                </p>
              </div>
            </div>
            {shippingAddress?.line1 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                <p className="font-medium text-white">Shipping to</p>
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
          </div>
        </div>
        {paymentError && (
          <p className="text-sm text-rose-400" role="alert">
            {paymentError}
          </p>
        )}
        {paymentStatus === "canceled" && (
          <p className="text-sm text-amber-300/80">
            Checkout was canceled. You can resume whenever you’re ready.
          </p>
        )}
        {paymentStatus === "success" && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
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
    account: "Organization",
    mapping: "Mapping",
    contact: "Contact",
    schedule: "Schedule",
    qr: "Plan & kits",
    payment: "Checkout",
  };

  const stepColumnsClass =
    stepOrder.length === 6
      ? "grid-cols-6"
      : stepOrder.length === 5
      ? "grid-cols-5"
      : "grid-cols-4";

  return (
    <div className="relative flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(13,148,136,0.18),_transparent_55%)]" />
      </div>
      <Nav hideAuthenticatedFeatures={true} />
      <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-[0_0_60px_rgba(16,185,129,0.12)] backdrop-blur">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-[0.45em] text-emerald-300/80">
                Blueprint onboarding
              </span>
              <p className="text-sm text-slate-300">
                Guided setup so your assistant, QR kits, and optional mapping are ready to deploy.
              </p>
            </div>
            <div className={`grid ${stepColumnsClass} gap-2 text-xs font-semibold`}>
              {stepOrder.map((step, index) => {
                const isActive = index === stepIndex;
                const isComplete = index < stepIndex;
                return (
                  <div
                    key={step}
                    className={`rounded-full px-3 py-2 text-center transition ${
                      isActive
                        ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/40"
                        : isComplete
                        ? "bg-emerald-500/10 text-emerald-200/90"
                        : "bg-white/5 text-slate-400"
                    }`}
                  >
                    {stepNames[step]}
                  </div>
                );
              })}
            </div>
          </div>
          {renderStep()}
        </div>
      </main>
      <Footer />
    </div>
  );
}

