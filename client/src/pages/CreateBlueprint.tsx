"use client";

import { doc, setDoc, updateDoc, arrayUnion } from "firebase/firestore"; // Add updateDoc and arrayUnion here
import { serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase"; // ensure this is the correct path to your Firestore instance
import { useAuth } from "@/contexts/AuthContext"; // to access currentUser
import { useState, useEffect, useCallback, ChangeEvent } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import {
  ChevronRight,
  ChevronLeft,
  Building2,
  MapPin,
  Phone,
  Palette,
  Cog,
  Check,
  Search,
  MapPin as MapPinIcon,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

type FeatureDetail = {
  crm?: string;
  tourUrl?: string;
  programDetails?: string;
  arModelUrls?: string;
};

interface BaseFeatureDetail {
  enabled: boolean;
  details: FeatureDetail;
}

type FeatureDetails = {
  [key: string]: BaseFeatureDetail;
};

type FormData = {
  businessName: string;
  locationType: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  aiProvider: string;
  apiKey: string;
  features: FeatureDetails;
};

const locationTypes = [
  { value: "restaurant", label: "Restaurant" },
  { value: "retail", label: "Retail Store" },
  { value: "service", label: "Service Business" },
  { value: "healthcare", label: "Healthcare" },
  { value: "education", label: "Education" },
  { value: "entertainment", label: "Entertainment" },
  { value: "other", label: "Other" },
];

const countries = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "MX", label: "Mexico" },
];

const states = {
  US: [
    { value: "AL", label: "Alabama" },
    { value: "AK", label: "Alaska" },
    { value: "AZ", label: "Arizona" },
    { value: "AR", label: "Arkansas" },
    { value: "CA", label: "California" },
    { value: "CO", label: "Colorado" },
    { value: "CT", label: "Connecticut" },
    { value: "DE", label: "Delaware" },
    { value: "FL", label: "Florida" },
    { value: "GA", label: "Georgia" },
    { value: "HI", label: "Hawaii" },
    { value: "ID", label: "Idaho" },
    { value: "IL", label: "Illinois" },
    { value: "IN", label: "Indiana" },
    { value: "IA", label: "Iowa" },
    { value: "KS", label: "Kansas" },
    { value: "KY", label: "Kentucky" },
    { value: "LA", label: "Louisiana" },
    { value: "ME", label: "Maine" },
    { value: "MD", label: "Maryland" },
    { value: "MA", label: "Massachusetts" },
    { value: "MI", label: "Michigan" },
    { value: "MN", label: "Minnesota" },
    { value: "MS", label: "Mississippi" },
    { value: "MO", label: "Missouri" },
    { value: "MT", label: "Montana" },
    { value: "NE", label: "Nebraska" },
    { value: "NV", label: "Nevada" },
    { value: "NH", label: "New Hampshire" },
    { value: "NJ", label: "New Jersey" },
    { value: "NM", label: "New Mexico" },
    { value: "NY", label: "New York" },
    { value: "NC", label: "North Carolina" },
    { value: "ND", label: "North Dakota" },
    { value: "OH", label: "Ohio" },
    { value: "OK", label: "Oklahoma" },
    { value: "OR", label: "Oregon" },
    { value: "PA", label: "Pennsylvania" },
    { value: "RI", label: "Rhode Island" },
    { value: "SC", label: "South Carolina" },
    { value: "SD", label: "South Dakota" },
    { value: "TN", label: "Tennessee" },
    { value: "TX", label: "Texas" },
    { value: "UT", label: "Utah" },
    { value: "VT", label: "Vermont" },
    { value: "VA", label: "Virginia" },
    { value: "WA", label: "Washington" },
    { value: "WV", label: "West Virginia" },
    { value: "WI", label: "Wisconsin" },
    { value: "WY", label: "Wyoming" },
  ],
  CA: [
    { value: "AB", label: "Alberta" },
    { value: "BC", label: "British Columbia" },
    { value: "MB", label: "Manitoba" },
    { value: "NB", label: "New Brunswick" },
    { value: "NL", label: "Newfoundland and Labrador" },
    { value: "NS", label: "Nova Scotia" },
    { value: "ON", label: "Ontario" },
    { value: "PE", label: "Prince Edward Island" },
    { value: "QC", label: "Quebec" },
    { value: "SK", label: "Saskatchewan" },
  ],
  MX: [
    { value: "AGU", label: "Aguascalientes" },
    { value: "BCN", label: "Baja California" },
    { value: "BCS", label: "Baja California Sur" },
    { value: "CAM", label: "Campeche" },
    { value: "CHP", label: "Chiapas" },
    { value: "CHH", label: "Chihuahua" },
    { value: "CMX", label: "Ciudad de México" },
    { value: "COA", label: "Coahuila" },
    { value: "COL", label: "Colima" },
    { value: "DUR", label: "Durango" },
  ],
};

const steps = [
  { id: "business-info", title: "Business Information", icon: Building2 },
  { id: "location-details", title: "Location Details", icon: MapPin },
  { id: "contact-info", title: "Contact Information", icon: Phone },
  { id: "customization", title: "AI Assistant", icon: Palette },
  { id: "features", title: "Blueprint Features", icon: Cog },
  { id: "review", title: "Review & Submit", icon: Check },
];

const aiProviders = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google AI" },
  { value: "microsoft", label: "Microsoft Azure AI" },
  { value: "ibm", label: "IBM Watson" },
  { value: "amazon", label: "Amazon Lex" },
];

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export default function CreateBlueprint() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { currentUser } = useAuth(); // get currently signed in user

  type FormDataWithId = FormData & { blueprintId?: string };

  const [formData, setFormData] = useState<FormDataWithId>({
    businessName: "",
    locationType: "",
    name: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    phone: "",
    email: "",
    website: "",
    aiProvider: "",
    apiKey: "",
    features: {
      personalizedRecommendations: { enabled: false, details: { crm: "" } },
      virtualTours: { enabled: false, details: { tourUrl: "" } },
      loyaltyProgram: { enabled: false, details: { programDetails: "" } },
      arVisualizations: { enabled: false, details: { arModelUrls: "" } },
    },
  });

  // Business search state variables
  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.AutocompleteService | null>(null);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaderStatus, setLoaderStatus] = useState<LoaderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  type LoaderStatus = "idle" | "loading" | "error" | "success";

  // Initialize Google Places API
  const initGooglePlaces = useCallback(async () => {
    setLoaderStatus("loading");
    setError(null);

    try {
      const apiKey = "AIzaSyBgxzzgcT_9nyhz1D_JtfG7gevRUKQ5Vbs"; // Replace with your actual API key
      if (!apiKey) {
        throw new Error("Google Places API key is not configured");
      }
      console.log("API Key loaded successfully");

      const loader = new Loader({
        apiKey,
        version: "weekly",
        libraries: ["places"],
      });

      await loader.load();

      if (typeof google === "undefined") {
        throw new Error("Google Maps JavaScript API not loaded");
      }

      const autocompleteService = new google.maps.places.AutocompleteService();
      if (!autocompleteService) {
        throw new Error("Failed to initialize Places Autocomplete service");
      }

      setAutocomplete(autocompleteService);
      setLoaderStatus("success");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      console.error("Error details:", err);
      setError(`Failed to initialize Google Places API: ${errorMessage}`);
      setLoaderStatus("error");

      toast({
        title: "Error",
        description: `Failed to initialize Google Places API: ${errorMessage}. Please try again.`,
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    initGooglePlaces();
  }, [initGooglePlaces]);

  // Handle business name input change and autocomplete
  const handleInputChange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | { target: { name: string; value: string } },
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Validate the field and update errors
    const error = validateField(name, value);
    setFieldErrors((prev) => ({ ...prev, [name]: error }));

    if (name === "businessName" && autocomplete && value.length >= 3) {
      setLoading(true);
      autocomplete.getPlacePredictions(
        {
          input: value,
          types: ["establishment"],
          componentRestrictions: { country: "us" },
        },
        (predictions, status) => {
          setLoading(false);
          if (
            status === google.maps.places.PlacesServiceStatus.OK &&
            predictions
          ) {
            setPredictions(
              predictions.map((prediction) => ({
                place_id: prediction.place_id,
                description: prediction.description,
                structured_formatting: {
                  main_text: prediction.structured_formatting.main_text,
                  secondary_text:
                    prediction.structured_formatting.secondary_text,
                },
              })),
            );
          } else {
            setPredictions([]);
            if (
              status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS
            ) {
              setError(`Error fetching predictions: ${status}`);
            }
          }
        },
      );
    } else {
      setPredictions([]);
    }
  };

  // Handle selecting a business from predictions
  const handleBusinessSelect = async (prediction: PlacePrediction) => {
    setPredictions([]);
    setLoading(true);
    setError(null);

    try {
      // Create a dummy div for PlacesService (required by Google Maps)
      const placesDiv = document.createElement("div");
      const placesService = new google.maps.places.PlacesService(placesDiv);

      const result = await new Promise<google.maps.places.PlaceResult>(
        (resolve, reject) => {
          placesService.getDetails(
            {
              placeId: prediction.place_id,
              fields: [
                "name",
                "formatted_address",
                "formatted_phone_number",
                "website",
                "type",
                "address_components",
              ],
            },
            (place, status) => {
              if (
                status !== google.maps.places.PlacesServiceStatus.OK ||
                !place
              ) {
                reject(new Error(`Places API error: ${status}`));
                return;
              }
              resolve(place);
            },
          );
        },
      );

      // Determine business type from place types
      let locationType = "other";
      if (result.types) {
        if (result.types.includes("restaurant")) locationType = "restaurant";
        else if (result.types.includes("store")) locationType = "retail";
        else if (result.types.includes("school")) locationType = "education";
        else if (result.types.includes("hospital")) locationType = "healthcare";
      }

      setFormData((prev) => ({
        ...prev,
        businessName: result.name || prediction.structured_formatting.main_text,
        locationType,
        name: result.name || prediction.structured_formatting.main_text,
        address:
          result.formatted_address ||
          prediction.structured_formatting.secondary_text,
        phone: result.formatted_phone_number || "",
        website: result.website || "",
      }));

      // Extract and set address components
      result.address_components?.forEach((component) => {
        const types = component.types;
        if (types.includes("locality")) {
          setFormData((prev) => ({ ...prev, city: component.long_name }));
        } else if (types.includes("administrative_area_level_1")) {
          setFormData((prev) => ({ ...prev, state: component.short_name }));
        } else if (types.includes("postal_code")) {
          setFormData((prev) => ({ ...prev, zipCode: component.long_name }));
        } else if (types.includes("country")) {
          setFormData((prev) => ({ ...prev, country: component.short_name }));
        }
      });
    } catch (error) {
      console.error("Error fetching business details:", error);
      setError(
        "Failed to fetch business details. Please try entering information manually.",
      );
      toast({
        title: "Error",
        description:
          "Failed to fetch business details. Please try entering information manually.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFeatureToggle = (feature: keyof FeatureDetails) => {
    setFormData((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: {
          ...prev.features[feature],
          enabled: !prev.features[feature].enabled,
        },
      },
    }));
  };

  const handleFeatureDetailChange = (
    feature: string,
    field: keyof FeatureDetail,
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: {
          ...prev.features[feature],
          details: {
            ...prev.features[feature].details,
            [field]: value,
          },
        },
      },
    }));
  };

  const validateField = (name: string, value: string): string => {
    switch (name) {
      case "businessName":
        return value.trim().length === 0 ? "Business name is required" : "";
      case "locationType":
        return value.trim().length === 0 ? "Business type is required" : "";
      case "name":
        return value.trim().length === 0 ? "Location name is required" : "";
      case "address":
        return value.trim().length === 0 ? "Address is required" : "";
      case "city":
        return value.trim().length === 0 ? "City is required" : "";
      case "state":
        return value.trim().length === 0 ? "State is required" : "";
      case "zipCode":
        return value.trim().length === 0 ? "ZIP code is required" : "";
      case "country":
        return value.trim().length === 0 ? "Country is required" : "";
      case "phone":
        const phoneRegex = /^\+?\d{10,}$/;
        return !phoneRegex.test(value.replace(/\D/g, ""))
          ? "Please enter a valid phone number"
          : "";
      case "email":
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return !emailRegex.test(value)
          ? "Please enter a valid email address"
          : "";
      case "website":
        if (!value) return "";
        const websiteRegex =
          /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/;
        return !websiteRegex.test(value)
          ? "Please enter a valid website URL"
          : "";
      case "aiProvider":
        return value.trim().length === 0 ? "Please select an AI provider" : "";
      default:
        return "";
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 0:
        return (
          !validateField("businessName", formData.businessName) &&
          !validateField("locationType", formData.locationType)
        );
      case 1:
        return (
          !validateField("name", formData.name) &&
          !validateField("address", formData.address)
        );
      case 2:
        return (
          !validateField("phone", formData.phone) &&
          !validateField("email", formData.email) &&
          !validateField("website", formData.website)
        );
      case 3:
        return !validateField("aiProvider", formData.aiProvider);
      case 4:
        return true; // Features are optional
      case 5:
        return true; // Review step is always valid
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1 && isStepValid()) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  function generateClaimCode(length: number = 6): string {
    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
    }
    return result;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (currentStep === steps.length - 1) {
      setIsLoading(true);
      try {
        const blueprintId = crypto.randomUUID();
        const claimCode = generateClaimCode();
        const blueprintData = {
          id: blueprintId,
          ...formData,
          host: currentUser?.uid || "", // set the host field to currently signed in user ID
          createdDate: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          claimCode: claimCode, // add this line
        };

        // Store blueprint data locally as before
        const existingBlueprints = JSON.parse(
          localStorage.getItem("blueprints") || "[]",
        );
        localStorage.setItem(
          "blueprints",
          JSON.stringify([...existingBlueprints, blueprintData]),
        );

        // Write blueprint data to Firestore
        await setDoc(doc(db, "blueprints", blueprintId), blueprintData);

        // ADD THIS: Update the current user's 'createdBlueprintIDs' array
        if (currentUser?.uid) {
          await updateDoc(doc(db, "users", currentUser.uid), {
            createdBlueprintIDs: arrayUnion(blueprintId),
          });
        }

        toast({
          title: "Blueprint Created Successfully!",
          description: "You can now customize your Blueprint in the editor.",
        });

        setFormData((prev) => ({ ...prev, blueprintId }));
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to create Blueprint. Please try again.",
          variant: "destructive",
        });
        console.error("Error creating blueprint:", error);
      } finally {
        setIsLoading(false);
      }
    } else {
      handleNext();
    }
  };

  const renderInputField = (
    name: string,
    label: string,
    type: string = "text",
    placeholder: string = "",
  ) => (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        value={formData[name as keyof FormData]}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={cn(
          "w-full",
          fieldErrors[name] && "border-red-500 focus-visible:ring-red-500",
        )}
      />
      {fieldErrors[name] && (
        <p className="text-sm text-red-500 mt-1">{fieldErrors[name]}</p>
      )}
    </div>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name</Label>
              <div className="relative">
                <Input
                  id="businessName"
                  name="businessName"
                  value={formData.businessName}
                  onChange={handleInputChange}
                  placeholder="Enter your business name"
                  className={cn(
                    "w-full",
                    fieldErrors.businessName &&
                      "border-red-500 focus-visible:ring-red-500",
                  )}
                />
                {fieldErrors.businessName && (
                  <p className="text-sm text-red-500 mt-1">
                    {fieldErrors.businessName}
                  </p>
                )}
                {predictions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white rounded-md border shadow-lg max-h-60 overflow-auto">
                    <ul className="py-1">
                      {predictions.map((prediction) => (
                        <li
                          key={prediction.place_id}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => handleBusinessSelect(prediction)}
                        >
                          <div className="font-medium">
                            {prediction.structured_formatting.main_text}
                          </div>
                          <div className="text-sm text-gray-500">
                            {prediction.structured_formatting.secondary_text}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationType">Business Type</Label>
              <Select
                name="locationType"
                value={formData.locationType}
                onValueChange={(value) =>
                  handleInputChange({ target: { name: "locationType", value } })
                }
              >
                <SelectTrigger
                  className={cn(
                    fieldErrors.locationType &&
                      "border-red-500 focus-visible:ring-red-500",
                  )}
                >
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent>
                  {locationTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.locationType && (
                <p className="text-sm text-red-500 mt-1">
                  {fieldErrors.locationType}
                </p>
              )}
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            {renderInputField(
              "name",
              "Location Name",
              "text",
              "Enter location name",
            )}
            {renderInputField(
              "address",
              "Address",
              "text",
              "Enter street address",
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select
                  name="country"
                  value={formData.country}
                  onValueChange={(value) => {
                    handleInputChange({ target: { name: "country", value } });
                    handleInputChange({ target: { name: "state", value: "" } });
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      fieldErrors.country &&
                        "border-red-500 focus-visible:ring-red-500",
                    )}
                  >
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country.value} value={country.value}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.country && (
                  <p className="text-sm text-red-500 mt-1">
                    {fieldErrors.country}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State/Province</Label>
                <Select
                  name="state"
                  value={formData.state}
                  onValueChange={(value) =>
                    handleInputChange({ target: { name: "state", value } })
                  }
                  disabled={!formData.country}
                >
                  <SelectTrigger
                    className={cn(
                      fieldErrors.state &&
                        "border-red-500 focus-visible:ring-red-500",
                    )}
                  >
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.country &&
                      states[formData.country as keyof typeof states]?.map(
                        (state) => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.label}
                          </SelectItem>
                        ),
                      )}
                  </SelectContent>
                </Select>
                {fieldErrors.state && (
                  <p className="text-sm text-red-500 mt-1">
                    {fieldErrors.state}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {renderInputField("zipCode", "ZIP/Postal Code")}
              {renderInputField("country", "Country")}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            {renderInputField("phone", "Phone Number")}
            {renderInputField("email", "Email Address", "email")}
            {renderInputField("website", "Website", "url")}
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="aiProvider">AI Assistant Provider</Label>
              <Select
                name="aiProvider"
                onValueChange={(value) =>
                  handleInputChange({ target: { name: "aiProvider", value } })
                }
              >
                <SelectTrigger
                  className={cn(
                    fieldErrors.aiProvider &&
                      "border-red-500 focus-visible:ring-red-500",
                  )}
                >
                  <SelectValue placeholder="Select AI provider" />
                </SelectTrigger>
                <SelectContent>
                  {aiProviders.map((provider) => (
                    <SelectItem key={provider.value} value={provider.value}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.aiProvider && (
                <p className="text-sm text-red-500 mt-1">
                  {fieldErrors.aiProvider}
                </p>
              )}
            </div>
            {renderInputField(
              "apiKey",
              "API Key",
              "password",
              "Enter your AI provider API key OR Allow us to create one for you (takes ~1 min)",
            )}
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <Label>Select Blueprint Features</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(formData.features).map(
                ([feature, { enabled }]) => (
                  <div key={feature} className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={feature}
                        checked={enabled}
                        onChange={() => handleFeatureToggle(feature)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <Label htmlFor={feature} className="select-none">
                        {feature.split(/(?=[A-Z])/).join(" ")}
                      </Label>
                    </div>
                    {enabled && (
                      <div className="ml-6 space-y-2">
                        {feature === "personalizedRecommendations" && (
                          <div>
                            <Label htmlFor={`${feature}-crm`}>
                              Provide Blueprint / Floor Plan OR Scan
                            </Label>
                            <Input
                              id={`${feature}-crm`}
                              value={
                                formData.features[feature].details.crm || ""
                              }
                              onChange={(e) =>
                                handleFeatureDetailChange(
                                  feature,
                                  "crm",
                                  e.target.value,
                                )
                              }
                              placeholder="Upload Blueprint / Floor Plan OR Scan Your Location"
                            />
                          </div>
                        )}
                        {feature === "virtualTours" && (
                          <div>
                            <Label htmlFor={`${feature}-tourUrl`}>
                              Virtual Tour URL
                            </Label>
                            <Input
                              id={`${feature}-tourUrl`}
                              value={
                                formData.features[feature].details.tourUrl || ""
                              }
                              onChange={(e) =>
                                handleFeatureDetailChange(
                                  feature,
                                  "tourUrl",
                                  e.target.value,
                                )
                              }
                              placeholder="Provide virtual tour URL"
                            />
                          </div>
                        )}
                        {feature === "loyaltyProgram" && (
                          <div>
                            <Label htmlFor={`${feature}-programDetails`}>
                              Loyalty Program Details
                            </Label>
                            <Textarea
                              id={`${feature}-programDetails`}
                              value={
                                formData.features[feature].details
                                  .programDetails || ""
                              }
                              onChange={(e) =>
                                handleFeatureDetailChange(
                                  feature,
                                  "programDetails",
                                  e.target.value,
                                )
                              }
                              placeholder="Enter loyalty program details"
                            />
                          </div>
                        )}
                        {feature === "arVisualizations" && (
                          <div>
                            <Label htmlFor={`${feature}-arModelUrls`}>
                              AR Model URLs
                            </Label>
                            <Textarea
                              id={`${feature}-arModelUrls`}
                              value={
                                formData.features[feature].details
                                  .arModelUrls || ""
                              }
                              onChange={(e) =>
                                handleFeatureDetailChange(
                                  feature,
                                  "arModelUrls",
                                  e.target.value,
                                )
                              }
                              placeholder="Enter AR model URLs (one per line)"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Review Your Blueprint</h3>
            <div className="bg-gray-100 p-4 rounded-lg">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(formData, null, 2)}
              </pre>
            </div>
            <p className="text-sm text-gray-600">
              Please review your Blueprint details above. If everything looks
              correct, click 'Complete Setup' to submit.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-blue-900 mb-8">
          Create Your Blueprint
        </h1>
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="p-6">
            <div className="flex justify-between items-center mb-8">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex flex-col items-center ${
                    index <= currentStep ? "text-blue-600" : "text-gray-400"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      index <= currentStep
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200"
                    }`}
                  >
                    {index < currentStep ? (
                      <Check className="w-6 h-6" />
                    ) : (
                      <step.icon className="w-6 h-6" />
                    )}
                  </div>
                  <span className="text-xs mt-2">{step.title}</span>
                </div>
              ))}
            </div>
            <form onSubmit={handleSubmit}>
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {renderStep()}
              </motion.div>
              <div className="mt-8 flex justify-between">
                <Button
                  type="button"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  variant="outline"
                >
                  Previous
                </Button>
                {currentStep < steps.length - 1 ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={!isStepValid()}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : formData.blueprintId ? (
                  <Button
                    type="button"
                    onClick={() => (window.location.href = "/dashboard")}
                  >
                    Go to Dashboard
                  </Button>
                ) : (
                  <Button type="submit" disabled={!isStepValid()}>
                    Create Blueprint
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
