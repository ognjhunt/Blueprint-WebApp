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
import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getGoogleMapsApiKey } from "@/lib/client-env";
import KitArrivalCountdown, {
  DEFAULT_KIT_TRACKING_URL,
  KIT_DELIVERY_LEAD_TIME_BUSINESS_DAYS,
} from "@/components/KitArrivalCountdown";

const MAPPING_FEE = 99;
const INCLUDED_WEEKLY_HOURS = 40;
const EXTRA_HOURLY_RATE = 1.25;

const SUBSCRIPTION_TIERS = [
  {
    id: "starter",
    name: "Starter",
    price: 99,
    mauLimit: 100,
    description: "Supports up to 100 MAUs",
  },
  {
    id: "pro",
    name: "Pro",
    price: 149,
    mauLimit: 250,
    description: "Supports up to 250 MAUs",
  },
] as const;

const CHECKOUT_STORAGE_KEY = "blueprintCheckoutContext";

type KitOption = {
  id: string;
  name: string;
  includedKitQuantity: number;
  oneTimeUpgradeFee: number;
  highlight: string;
};

const KIT_OPTIONS: KitOption[] = [
  {
    id: "starter",
    name: "Starter kit (4 QR kits)",
    includedKitQuantity: 4,
    oneTimeUpgradeFee: 0,
    highlight: "Ideal for piloting in a single storefront or lobby.",
  },
  {
    id: "growth",
    name: "Growth kit (8 QR kits)",
    includedKitQuantity: 8,
    oneTimeUpgradeFee: 15,
    highlight: "Extra coverage for multi-room venues or dual entrances.",
  },
  {
    id: "enterprise",
    name: "Enterprise kit (16 QR kits)",
    includedKitQuantity: 16,
    oneTimeUpgradeFee: 45,
    highlight: "Great for campuses, arenas, and large-footprint deployments.",
  },
];

const DEFAULT_CARE_PLAN = {
  id: "starter",
  name: "Starter",
  monthlyPrice: SUBSCRIPTION_TIERS[0].price,
} as const;

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

const MAPPING_BENEFITS: string[] = [
  "Guests can ask conversationally where something is and get precise directions.",
  "Live indoor navigation guides visitors to any point of interest.",
  "Contextual nudges and updates trigger automatically in the right zone.",
  "Heatmaps and dwell analytics reveal hot zones and movement patterns.",
  "Supports Niantic Lightship/VPS localization so devices instantly know where they are.",
  "Ready for future AR experiences and spatial content drops with no extra work.",
  "Unlocks post-visit retargeting from privacy-safe engagement signals.",
];

const MAPPING_REQUIREMENTS: string[] = [
  "A Blueprint Mapper visits at your scheduled date and time.",
  "On-site LiDAR capture typically takes 30–60 minutes.",
  "One-time $99 mapping fee is added to your onboarding invoice.",
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

function addBusinessDays(start: Date, businessDays: number) {
  const result = new Date(start);
  let added = 0;

  while (added < businessDays) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      added += 1;
    }
  }

  return result;
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

  const [organizationName, setOrganizationName] = useState("");
  const [organizationSaved, setOrganizationSaved] = useState(false);
  const [isSavingOrganization, setIsSavingOrganization] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

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
  const [recommendedMapping, setRecommendedMapping] = useState<boolean | null>(
    null,
  );
  const [placeError, setPlaceError] = useState<string | null>(null);

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [squareFootage, setSquareFootage] = useState("");

  const [wantsSchedule, setWantsSchedule] = useState(false);
  const [mappingDate, setMappingDate] = useState("");
  const [mappingTime, setMappingTime] = useState("");

  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    DEFAULT_CARE_PLAN.id,
  );
  const [selectedPlanName, setSelectedPlanName] = useState<string>(
    DEFAULT_CARE_PLAN.name,
  );
  const [planMonthlyPrice, setPlanMonthlyPrice] = useState<number>(
    DEFAULT_CARE_PLAN.monthlyPrice,
  );

  const [selectedKitId, setSelectedKitId] = useState<string>(KIT_OPTIONS[0].id);
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
  const [shouldFinalizeAfterCheckout, setShouldFinalizeAfterCheckout] =
    useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const hasPersistedCompletionRef = useRef(false);
  const redirectTimerRef = useRef<number | null>(null);

  const orgSessionTokenRef = useRef<string | null>(null);

  const ensureSessionToken = useCallback(
    (ref: React.MutableRefObject<string | null>) => {
      if (!ref.current) {
        ref.current =
          typeof crypto !== "undefined" &&
          typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2);
      }
      return ref.current;
    },
    [],
  );

  const fetchAutocompleteSuggestions = useCallback(
    async (input: string): Promise<PlacesAutocompleteSuggestion[]> => {
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
        .filter((prediction): prediction is NonNullable<typeof prediction> =>
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

  useEffect(() => {
    setPlaceQuery(organizationName);
  }, [organizationName]);

  const selectedKit = useMemo(
    () => KIT_OPTIONS.find((kit) => kit.id === selectedKitId) ?? KIT_OPTIONS[0],
    [selectedKitId],
  );

  const kitUpgradeFee = useMemo(
    () => selectedKit.oneTimeUpgradeFee,
    [selectedKit],
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
        organizationSaved: boolean;
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
      if (typeof parsed.organizationSaved === "boolean") {
        setOrganizationSaved(parsed.organizationSaved);
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
        setSelectedPlanId(parsed.selectedPlanId);
      }
      if (typeof parsed.selectedPlanName === "string") {
        setSelectedPlanName(parsed.selectedPlanName);
      }
      if (
        typeof parsed.planMonthlyPrice === "number" &&
        Number.isFinite(parsed.planMonthlyPrice)
      ) {
        setPlanMonthlyPrice(parsed.planMonthlyPrice);
      }
      if (typeof parsed.selectedKitId === "string") {
        const exists = KIT_OPTIONS.some(
          (kit) => kit.id === parsed.selectedKitId,
        );
        if (exists) {
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
    if (typeof window === "undefined") {
      return;
    }

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
      setShouldFinalizeAfterCheckout(true);
    }
    if (checkoutStatus === "canceled") {
      setPaymentStatus("canceled");
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(CHECKOUT_STORAGE_KEY);
      }
    }
  }, [setLocation, setShouldFinalizeAfterCheckout]);

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

  const shippingAddress: ShippingAddress | undefined = useMemo(() => {
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

    if (
      !shippingName &&
      !shippingLine1 &&
      !shippingLine2 &&
      !shippingCity &&
      !shippingState &&
      !shippingPostalCode
    ) {
      return undefined;
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

  const kitDeliveryPreviewDate = useMemo(() => {
    if (mappingOptIn !== false) {
      return null;
    }

    return addBusinessDays(
      new Date(),
      KIT_DELIVERY_LEAD_TIME_BUSINESS_DAYS,
    );
  }, [mappingOptIn]);

  useEffect(() => {
    if (!shouldFinalizeAfterCheckout) {
      return;
    }

    const activeUser = currentUser ?? auth.currentUser;
    if (!activeUser) {
      return;
    }

    setIsRedirectingToStripe(true);

    let isCancelled = false;

    const finalizeAfterCheckout = async () => {
      try {
        await persistOnboardingCompletion();
      } catch (error) {
        console.error("Unable to finalize onboarding after checkout:", error);
        if (!isCancelled) {
          setPaymentError(
            error instanceof Error
              ? error.message
              : "We couldn't save your onboarding details. Please try again.",
          );
          setPaymentStatus("error");
          setIsRedirectingToStripe(false);
          setShouldFinalizeAfterCheckout(false);
        }
        return;
      }

      if (isCancelled) {
        return;
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(CHECKOUT_STORAGE_KEY);
      }
      setPaymentStatus("success");
      setIsRedirectingToStripe(false);
      setShouldFinalizeAfterCheckout(false);
      redirectTimerRef.current = window.setTimeout(() => {
        setLocation("/dashboard");
      }, 2500);
    };

    finalizeAfterCheckout();

    return () => {
      isCancelled = true;
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, [
    auth,
    currentUser,
    persistOnboardingCompletion,
    setLocation,
    setIsRedirectingToStripe,
    setPaymentError,
    setPaymentStatus,
    setShouldFinalizeAfterCheckout,
    shouldFinalizeAfterCheckout,
  ]);

  const mappingFeeDueToday = useMemo(
    () => (mappingOptIn ? MAPPING_FEE : 0),
    [mappingOptIn],
  );

  const totalDueToday = useMemo(
    () => kitUpgradeFee + mappingFeeDueToday,
    [kitUpgradeFee, mappingFeeDueToday],
  );

  const handleSelectPrediction = useCallback(
    async (prediction: PlacesAutocompleteSuggestion) => {
      setPlaceQuery(prediction.description);
      setPlacePredictions([]);
      setPlaceError(null);
      setLoadingPlaceDetails(true);
      try {
        const details = await fetchPlaceDetails(prediction.placeId);
        setPlaceDetails(details);
        const displayName = details.displayName?.text ?? prediction.description;
        setOrganizationName(displayName);
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
    },
    [fetchPlaceDetails],
  );

  const saveOrganization = useCallback(async () => {
    const trimmedName = organizationName.trim();
    if (!trimmedName) {
      setAccountError("Enter your organization name to continue.");
      return false;
    }
    if (!currentUser) {
      setAccountError("Please sign in to continue onboarding.");
      return false;
    }

    setIsSavingOrganization(true);
    setAccountError(null);
    try {
      await updateProfile(currentUser, {
        displayName: trimmedName,
      });
      await setDoc(
        doc(db, "onboardingProfiles", currentUser.uid),
        {
          organizationName: trimmedName,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setOrganizationSaved(true);
      return true;
    } catch (error) {
      console.error("Unable to save organization", error);
      const message =
        error instanceof Error
          ? error.message
          : "We couldn't save your organization. Try again.";
      setAccountError(message);
      return false;
    } finally {
      setIsSavingOrganization(false);
    }
  }, [currentUser, organizationName]);

  const handleNext = useCallback(async () => {
    if (currentStep === "account") {
      const saved = await saveOrganization();
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
        setPlaceError(
          "Share contact, phone, and location details to continue.",
        );
        return;
      }
      setPlaceError(null);
      setStepIndex((index) => Math.min(index + 1, stepOrder.length - 1));
      return;
    }

    if (currentStep === "schedule") {
      if (wantsSchedule && (!mappingDate || !mappingTime)) {
        setPlaceError("Choose a date and time or skip scheduling for now.");
        return;
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
    }
  }, [
    contactName,
    contactPhone,
    currentStep,
    mappingDate,
    mappingOptIn,
    mappingTime,
    saveOrganization,
    selectedPlanId,
    shippingCity,
    shippingLine1,
    shippingName,
    shippingPostalCode,
    stepOrder.length,
    useContactForShipping,
    wantsSchedule,
  ]);

  const persistOnboardingCompletion = useCallback(async () => {
    const user = currentUser ?? auth.currentUser;

    if (!user) {
      throw new Error(
        "Unable to finalize onboarding because no authenticated user was found.",
      );
    }

    if (hasPersistedCompletionRef.current) {
      return;
    }

    const kitDeliveryEstimate = mappingOptIn === false
      ? addBusinessDays(new Date(), KIT_DELIVERY_LEAD_TIME_BUSINESS_DAYS)
      : null;

    const onboardingPayload: Record<string, unknown> = {
      organizationName: organizationName.trim(),
      mappingOptIn: mappingOptIn === true,
      recommendedMapping,
      planId: selectedPlanId,
      planName: selectedPlanName,
      planMonthlyPrice,
      selectedKitId,
      updatedAt: serverTimestamp(),
      shippingAddress: shippingAddress ?? null,
    };

    if (mappingOptIn) {
      onboardingPayload.contactName = contactName.trim();
      onboardingPayload.contactPhone = contactPhone.trim();
      onboardingPayload.locationAddress = locationAddress.trim();
      onboardingPayload.squareFootage = squareFootage
        ? Number(squareFootage)
        : null;
      onboardingPayload.mappingScheduledAt = mappingDateTimeIso || null;
    } else {
      onboardingPayload.kitDeliveryEstimate = kitDeliveryEstimate;
      onboardingPayload.kitTrackingUrl = DEFAULT_KIT_TRACKING_URL;
      onboardingPayload.subscriptionStartEstimate = kitDeliveryEstimate;
    }

    try {
      await setDoc(doc(db, "onboardingProfiles", user.uid), onboardingPayload, {
        merge: true,
      });

      const userUpdate: Record<string, unknown> = {
        mappingOptIn: mappingOptIn === true,
      };

      if (mappingOptIn) {
        userUpdate.kitDeliveryEstimate = null;
        userUpdate.kitTrackingUrl = null;
        userUpdate.subscriptionStartEstimate = null;
      } else {
        userUpdate.kitDeliveryEstimate = kitDeliveryEstimate;
        userUpdate.kitTrackingUrl = DEFAULT_KIT_TRACKING_URL;
        userUpdate.subscriptionStartEstimate = kitDeliveryEstimate;
        userUpdate.finishedOnboarding = true;
      }

      await setDoc(doc(db, "users", user.uid), userUpdate, { merge: true });

      if (mappingOptIn) {
        await addDoc(collection(db, "mappingRequests"), {
          userId: user.uid,
          organizationName: organizationName.trim(),
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim(),
          locationAddress: locationAddress.trim(),
          squareFootage: squareFootage ? Number(squareFootage) : null,
          mappingScheduledAt: mappingDateTimeIso || null,
          createdAt: serverTimestamp(),
        });
      }

      hasPersistedCompletionRef.current = true;
    } catch (error) {
      console.error("Error finalizing onboarding:", error);
      throw error;
    }
  }, [
    auth,
    contactName,
    contactPhone,
    currentUser,
    locationAddress,
    mappingDateTimeIso,
    mappingOptIn,
    organizationName,
    recommendedMapping,
    selectedKitId,
    selectedPlanId,
    selectedPlanName,
    shippingAddress,
    squareFootage,
    planMonthlyPrice,
  ]);

  const handleBack = useCallback(() => {
    setPlaceError(null);
    setStepIndex((index) => Math.max(0, index - 1));
  }, []);

  const startStripeCheckout = useCallback(async () => {
    try {
      setIsRedirectingToStripe(true);
      setPaymentError(null);

      // If no charges today, skip Stripe and go directly to dashboard
      if (totalDueToday === 0) {
        await persistOnboardingCompletion();

        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(CHECKOUT_STORAGE_KEY);
        }

        setPaymentStatus("success");
        redirectTimerRef.current = window.setTimeout(() => {
          setLocation("/dashboard");
        }, 1500);
        return;
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          CHECKOUT_STORAGE_KEY,
          JSON.stringify({
            organizationName,
            organizationSaved,
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
        currentSearch
          ? `${currentSearch}&checkout=success`
          : "?checkout=success"
      }`;
      const cancelPath = `/onboarding${
        currentSearch
          ? `${currentSearch}&checkout=canceled`
          : "?checkout=canceled"
      }`;

      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionType: "onboarding",
          onboardingFee: 0,
          monthlyPrice: planMonthlyPrice,
          includedHours: INCLUDED_WEEKLY_HOURS,
          extraHourlyRate: EXTRA_HOURLY_RATE,
          planId: selectedPlanId,
          planName: selectedPlanName,
          kitUpgradeSurcharge: kitUpgradeFee + mappingFeeDueToday,
          mappingFee: mappingFeeDueToday,
          organizationName: organizationName.trim(),
          contactName: mappingOptIn ? contactName.trim() : "",
          contactEmail: currentUser?.email ?? "",
          mappingDateTime: mappingDateTimeIso,
          mappingOptIn: mappingOptIn === true,
          plan: {
            id: selectedPlanId,
            name: selectedPlanName,
            monthlyPrice: planMonthlyPrice,
            includedKitQuantity: selectedKit.includedKitQuantity,
            upgradeSurcharge: kitUpgradeFee,
          },
          qrKit: {
            id: selectedKit.id,
            name: selectedKit.name,
            price: kitUpgradeFee + mappingFeeDueToday,
          },
          shippingAddress,
          successPath,
          cancelPath,
        }),
      });

      const data = await response.json();
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
          return false;
        }
      };

      if (sessionUrl) {
        if (shouldBypassStripeRedirect()) {
          window.location.href = sessionUrl;
          return;
        }
        window.location.href = sessionUrl;
        return;
      }

      if (!stripe) {
        throw new Error("Stripe failed to initialize");
      }

      const result = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      });
      if (result.error) {
        throw result.error;
      }
    } catch (error) {
      console.error("Unable to start Stripe checkout", error);
      const message =
        error instanceof Error
          ? error.message
          : "We couldn't start checkout just yet. Please try again.";
      setPaymentError(message);
      setPaymentStatus("error");
    } finally {
      setIsRedirectingToStripe(false);
    }
  }, [
    contactName,
    contactPhone,
    currentUser,
    kitUpgradeFee,
    mappingDate,
    mappingDateTimeIso,
    mappingFeeDueToday,
    mappingOptIn,
    mappingTime,
    organizationName,
    organizationSaved,
    planMonthlyPrice,
    recommendedMapping,
    selectedKit,
    selectedKitId,
    selectedPlanId,
    selectedPlanName,
    shippingAddress,
    shippingCity,
    shippingCountry,
    shippingLine1,
    shippingLine2,
    shippingName,
    shippingPostalCode,
    shippingState,
    squareFootage,
    useContactForShipping,
    wantsSchedule,
    persistOnboardingCompletion,
  ]);

  const renderAccountStep = () => {
    const signedInEmail = currentUser?.email;

    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300/70">
            Step 1 · Organization
          </p>
          <h2 className="text-3xl font-semibold text-white">
            Who are we onboarding?
          </h2>
          <p className="text-sm text-slate-300">
            Search for your organization so we can preload location details and
            match any existing mapping or content.{" "}
            {signedInEmail ? (
              <span className="text-slate-400">
                Signed in as {signedInEmail}.
              </span>
            ) : (
              <span className="text-slate-400">
                You are signed in and ready to continue.
              </span>
            )}
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
                setOrganizationSaved(false);
                if (!value) {
                  setPlacePredictions([]);
                  setPlaceDetails(null);
                  setRecommendedMapping(null);
                }
              }}
              placeholder="Start typing your business name"
              className="border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500"
            />
            {loadingPlaces && (
              <p className="mt-2 text-xs text-slate-400">
                Looking for matches…
              </p>
            )}
            {!loadingPlaces && placePredictions.length > 0 && (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0E1624] shadow-2xl">
                <ul className="divide-y divide-white/5">
                  {placePredictions.map((prediction) => (
                    <li key={prediction.placeId}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-white/5"
                        onClick={() => handleSelectPrediction(prediction)}
                      >
                        <span>{prediction.description}</span>
                        <span className="text-xs uppercase tracking-wide text-sky-300/80">
                          Select
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {placeDetails?.formattedAddress && (
            <p className="text-xs text-slate-400">
              Primary location: {placeDetails.formattedAddress}
            </p>
          )}
          {!placesEnabled && (
            <p className="text-xs text-amber-400">
              Google Places isn't configured in this environment. Type your
              organization name manually.
            </p>
          )}
          {organizationSaved && (
            <p className="text-xs text-emerald-300">
              Organization saved for your account.
            </p>
          )}
          {accountError && (
            <p className="text-sm text-rose-300" role="alert">
              {accountError}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={handleNext} disabled={isSavingOrganization}>
            {isSavingOrganization ? "Saving…" : "Continue"}
          </Button>
        </div>
      </div>
    );
  };

  const renderMappingStep = () => (
    <div className="space-y-10">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300/70">
          Step 2 · Mapping
        </p>
        <h2 className="text-3xl font-semibold text-white">
          Would you like Blueprint to map your space?
        </h2>
        <p className="text-sm text-slate-300">
          Mapping unlocks AR navigation, in-store journeys, and post-visit
          retargeting.
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg">
          <Label htmlFor="place-search" className="text-slate-200">
            Search for your venue
          </Label>
          <div className="relative mt-2">
            <Input
              id="place-search"
              value={placeQuery || organizationName}
              onChange={(event) => {
                const value = event.target.value;
                setPlaceQuery(value);
                setOrganizationName(value);
                setOrganizationSaved(false);
                if (!value) {
                  setPlacePredictions([]);
                  setPlaceDetails(null);
                  setRecommendedMapping(null);
                }
              }}
              placeholder="Start typing your business name"
              disabled={!placesEnabled}
              className="border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500"
            />
            {loadingPlaces && (
              <p className="mt-2 text-xs text-slate-400">
                Looking for matches…
              </p>
            )}
            {!loadingPlaces && placePredictions.length > 0 && (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0E1624] shadow-2xl">
                <ul className="divide-y divide-white/5">
                  {placePredictions.map((prediction) => (
                    <li key={prediction.placeId}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-white/5"
                        onClick={() => handleSelectPrediction(prediction)}
                      >
                        <span>{prediction.description}</span>
                        <span className="text-xs uppercase tracking-wide text-sky-300/80">
                          Select
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {loadingPlaceDetails && (
            <p className="mt-3 text-xs text-slate-400">
              Fetching location details…
            </p>
          )}
          {placeDetails?.formattedAddress && (
            <p className="mt-3 text-xs text-slate-400">
              We will map: {placeDetails.formattedAddress}
            </p>
          )}
          {!placesEnabled && (
            <p className="mt-3 text-xs text-amber-400">
              Google Places is disabled here, so type your venue name and we'll
              confirm it manually.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-lg font-semibold text-white">
                Add Blueprint mapping
              </p>
              <p className="text-sm text-slate-300">
                Includes on-site LiDAR capture, a content planning session, and
                blueprint generation.
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
          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">
            {mappingOptIn ? (
              <>
                One-time <span className="font-semibold text-white">$99</span>{" "}
                mapping fee will be added at checkout. We'll coordinate a mapper
                visit after this flow.
              </>
            ) : (
              <>
                You can skip mapping now—ideal if you're piloting in a single
                room. Turn it on anytime from the dashboard.
              </>
            )}
          </div>
          {recommendedMapping !== null && (
            <p className="mt-3 text-xs font-medium text-sky-200">
              {recommendedMapping
                ? "Great fit: venues like museums, hotels, restaurants, and multi-room retail gain the most from mapping."
                : "Mapping is optional for this location, but you can enable it if you want Blueprint's team to visit."}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300/70">
            Benefits
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-200">
            {MAPPING_BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-sky-400" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300/70">
            What we need
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-200">
            {MAPPING_REQUIREMENTS.map((requirement) => (
              <li key={requirement} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-emerald-400" />
                <span>{requirement}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {placeError && (
        <p className="text-sm text-rose-300" role="alert">
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

  const renderContactStep = () => (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300/70">
          On-site contact
        </p>
        <h2 className="text-3xl font-semibold text-white">
          Who should we meet on-site?
        </h2>
        <p className="text-sm text-slate-300">
          We'll confirm by email and SMS before your mapping appointment so your
          team knows when we're arriving.
        </p>
      </div>
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
            className="border-white/10 bg-white/5 text-slate-100"
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
            className="border-white/10 bg-white/5 text-slate-100"
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
            className="border-white/10 bg-white/5 text-slate-100"
          />
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
            className="border-white/10 bg-white/5 text-slate-100"
          />
        </div>
      </div>
      {placeError && (
        <p className="text-sm text-rose-300" role="alert">
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
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300/70">
          Scheduling
        </p>
        <h2 className="text-3xl font-semibold text-white">
          Schedule your mapping day (optional)
        </h2>
        <p className="text-sm text-slate-300">
          Pick a slot now or skip and our team will coordinate with your contact
          later.
        </p>
      </div>
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg">
        <div className="space-y-1">
          <p className="font-medium text-white">Schedule now</p>
          <p className="text-sm text-slate-300">
            We'll send confirmations and reminders before the visit.
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
            <Label htmlFor="mapping-date" className="text-slate-200">
              Preferred date
            </Label>
            <Input
              id="mapping-date"
              type="date"
              value={mappingDate}
              onChange={(event) => setMappingDate(event.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="border-white/10 bg-white/5 text-slate-100"
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
              className="border-white/10 bg-white/5 text-slate-100"
            />
          </div>
        </div>
      )}
      {placeError && (
        <p className="text-sm text-rose-300" role="alert">
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
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300/70">
          QR Kits
        </p>
        <h2 className="text-3xl font-semibold text-white">
          Choose your Blueprint QR kit
        </h2>
        <p className="text-sm text-slate-300">
          {`Blueprint Care is ${formatUsd(planMonthlyPrice)} per month after activation. QR kit upgrades are a one-time cost today.`}
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
        <div className="mb-3">
          <p className="text-sm font-semibold text-sky-300/90">What you'll receive</p>
          <p className="mt-1 text-xs text-slate-400">
            Each QR kit includes a professionally designed poster with your venue branding
          </p>
        </div>
        <div className="flex justify-center">
          <div className="w-full max-w-sm overflow-hidden rounded-xl border border-white/10 bg-black/30">
            <img 
              src="/qr-kit-example.png" 
              alt="Example of Blueprint QR kit poster" 
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {KIT_OPTIONS.map((kit) => {
          const isSelected = selectedKitId === kit.id;
          const oneTimeFee = kit.oneTimeUpgradeFee;
          return (
            <button
              key={kit.id}
              type="button"
              onClick={() => {
                setSelectedKitId(kit.id);
                setPlaceError(null);
              }}
              className={`w-full rounded-2xl border px-5 py-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${
                isSelected
                  ? "border-sky-400/60 bg-sky-400/10 shadow-lg"
                  : "border-white/10 bg-white/5 hover:border-sky-400/30"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-white">{kit.name}</p>
                  <p className="text-sm text-slate-300">
                    Ships with {kit.includedKitQuantity} QR placements.
                  </p>
                  <p className="text-xs text-slate-400">{kit.highlight}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium text-slate-200">
                    {oneTimeFee > 0
                      ? `+${formatUsd(oneTimeFee)} today`
                      : "Included"}
                  </p>
                  <p className="text-xs text-slate-400">
                    Billed once during onboarding
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-sm text-slate-300">
        Kits arrive pre-labeled with venue copy and QR art. We notify your team
        as soon as shipping and activation milestones complete.
      </p>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="font-medium text-white">
              Ship kits to the mapping location
            </p>
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="shipping-name" className="text-slate-200">
                Recipient name
              </Label>
              <Input
                id="shipping-name"
                value={shippingName}
                onChange={(event) => setShippingName(event.target.value)}
                className="border-white/10 bg-white/5 text-slate-100"
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
                className="border-white/10 bg-white/5 text-slate-100"
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
                className="border-white/10 bg-white/5 text-slate-100"
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
                className="border-white/10 bg-white/5 text-slate-100"
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
                className="border-white/10 bg-white/5 text-slate-100"
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
                className="border-white/10 bg-white/5 text-slate-100"
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
                className="border-white/10 bg-white/5 text-slate-100"
              />
            </div>
          </div>
        )}
      </div>

      {placeError && (
        <p className="text-sm text-rose-300" role="alert">
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
    const kitSummary = `${selectedKit.name}`;

    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300/70">
            Review
          </p>
          <h2 className="text-3xl font-semibold text-white">Plan & payment</h2>
          <p className="text-sm text-slate-300">
            Monthly billing begins once your kits are delivered and activated. Today's checkout covers any kit upgrade you selected.
          </p>
        </div>

        {/* Subscription tier selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Choose your subscription tier</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {SUBSCRIPTION_TIERS.map((tier) => (
              <button
                key={tier.id}
                type="button"
                onClick={() => {
                  setSelectedPlanId(tier.id);
                  setSelectedPlanName(tier.name);
                  setPlanMonthlyPrice(tier.price);
                }}
                className={`rounded-2xl border p-5 text-left transition-all ${
                  selectedPlanId === tier.id
                    ? "border-emerald-400/60 bg-emerald-500/10 shadow-lg"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xl font-semibold text-white">{tier.name}</p>
                    <p className="text-sm text-slate-300">{tier.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">${tier.price}</p>
                    <p className="text-xs text-slate-400">/month</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Today's charges */}
        {totalDueToday > 0 && (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-white">Today's charges</h3>
            {kitUpgradeFee > 0 && (
              <div className="flex items-center justify-between text-sm text-slate-200">
                <span>{kitSummary} upgrade</span>
                <span className="font-medium text-white">
                  {formatUsd(kitUpgradeFee)}
                </span>
              </div>
            )}
            {mappingOptIn && (
              <div className="flex items-center justify-between text-sm text-slate-200">
                <span>Blueprint mapping visit</span>
                <span className="font-medium text-white">
                  {formatUsd(mappingFeeDueToday)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-white/10 pt-3 text-base font-semibold text-white">
              <span>Total due today</span>
              <span>{formatUsd(totalDueToday)}</span>
            </div>
          </div>
        )}

        {mappingOptIn === false && kitDeliveryPreviewDate && (
          <KitArrivalCountdown
            targetDate={kitDeliveryPreviewDate}
            trackingUrl={DEFAULT_KIT_TRACKING_URL}
            context="onboarding"
          />
        )}

        {totalDueToday === 0 && (
          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4">
            <p className="text-sm text-emerald-200">
              {selectedKit.name === "Starter kit (4 QR kits)"
                ? "Your Starter Kit is included at no charge! " 
                : "No charges today. "}
              Monthly billing begins once your kits are activated.
            </p>
          </div>
        )}

        {/* Monthly subscription summary */}
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg">
          <div className="flex items-center justify-between text-sm text-slate-200">
            <span>{selectedPlanName} subscription</span>
            <span className="font-medium text-white">
              {formatUsd(planMonthlyPrice)} / month
            </span>
          </div>
          <p className="text-sm text-slate-300">
            Monthly billing begins once your kits are delivered and activated.
            You'll get a heads-up before the first charge hits your card.
          </p>
        </div>

        {shippingAddress?.line1 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-200">
            <p className="font-medium text-white">Shipping to</p>
            <p>{shippingAddress.name}</p>
            <p>{shippingAddress.line1}</p>
            {shippingAddress.line2 && <p>{shippingAddress.line2}</p>}
            <p>
              {[
                shippingAddress.city,
                shippingAddress.state,
                shippingAddress.postalCode,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
            <p>{shippingAddress.country}</p>
          </div>
        )}

        {paymentError && (
          <p className="text-sm text-rose-300" role="alert">
            {paymentError}
          </p>
        )}
        {paymentStatus === "canceled" && (
          <p className="text-sm text-amber-300">
            Checkout was canceled. You can resume whenever you're ready.
          </p>
        )}
        {paymentStatus === "success" && (
          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-emerald-200">
            Payment confirmed! Redirecting you to the dashboard…
          </div>
        )}

        <div className="flex justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={isRedirectingToStripe}
          >
            Back
          </Button>
          <Button
            onClick={startStripeCheckout}
            disabled={isRedirectingToStripe}
          >
            {isRedirectingToStripe 
              ? (totalDueToday === 0 ? "Completing setup…" : "Redirecting…")
              : (totalDueToday === 0 ? "Complete setup" : "Start checkout")}
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

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col bg-[#050814] text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-32 h-72 w-72 rounded-full bg-sky-500/20 blur-[120px]" />
        <div className="absolute right-[-6rem] bottom-16 h-96 w-96 rounded-full bg-emerald-500/10 blur-[140px]" />
      </div>
      <Nav hideAuthenticatedFeatures={true} />
      <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-16">
        <div
          className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-white/10 via-transparent to-sky-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-8 rounded-3xl border border-white/10 bg-white/5 p-10 shadow-[0_40px_140px_-60px_rgba(59,130,246,0.6)] backdrop-blur-xl">
          <div className="flex flex-col gap-4">
            <p className="text-sm font-semibold uppercase tracking-[0.4em] text-sky-300/70">
              Blueprint onboarding
            </p>
            <div
              className={`grid ${stepColumnsClass} gap-2 text-xs font-medium text-slate-200`}
            >
              {stepOrder.map((step, index) => (
                <div
                  key={step}
                  className={`rounded-full px-3 py-2 text-center transition ${
                    index === stepIndex
                      ? "bg-sky-400 text-[#041021] shadow-lg"
                      : index < stepIndex
                        ? "bg-white/15 text-slate-100"
                        : "bg-white/5 text-slate-400"
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
