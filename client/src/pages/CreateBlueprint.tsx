"use client";

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
  businessType: string;
  locationName: string;
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

  type FormDataWithId = FormData & { blueprintId?: string };

  const [formData, setFormData] = useState<FormDataWithId>({
    businessName: "",
    businessType: "",
    locationName: "",
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
      | ChangeEvent<HTMLInputElement>
      | { target: { name: string; value: string } },
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

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
  const handleBusinessSelect = (prediction: PlacePrediction) => {
    setFormData((prev) => ({
      ...prev,
      businessName: prediction.structured_formatting.main_text,
      address: prediction.structured_formatting.secondary_text,
    }));
    setPredictions([]);
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

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (currentStep === steps.length - 1) {
      setIsLoading(true);
      try {
        const blueprintId = Date.now().toString();
        const blueprintData = {
          id: blueprintId,
          ...formData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Store blueprint data in localStorage
        const existingBlueprints = JSON.parse(
          localStorage.getItem("blueprints") || "[]",
        );
        localStorage.setItem(
          "blueprints",
          JSON.stringify([...existingBlueprints, blueprintData]),
        );

        toast({
          title: "Blueprint Created Successfully!",
          description: "You can now customize your Blueprint in the editor.",
        });

        // Store blueprintId in state for navigation
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

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="businessName">Business Name</Label>
              <div className="relative">
                <Input
                  id="businessName"
                  name="businessName"
                  value={formData.businessName}
                  onChange={handleInputChange}
                  placeholder="Enter your business name"
                  disabled={loaderStatus !== "success"}
                />
                {loading && (
                  <Loader2 className="absolute right-2 top-2 w-5 h-5 text-blue-500 animate-spin" />
                )}
                {predictions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg">
                    <ul className="py-1">
                      {predictions.map((prediction) => (
                        <li
                          key={prediction.place_id}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-start"
                          onClick={() => handleBusinessSelect(prediction)}
                        >
                          <MapPinIcon className="w-5 h-5 mr-2 mt-1 flex-shrink-0 text-gray-400" />
                          <div>
                            <div className="font-medium">
                              {prediction.structured_formatting.main_text}
                            </div>
                            <div className="text-sm text-gray-500">
                              {prediction.structured_formatting.secondary_text}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {error && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
            <div>
              <Label htmlFor="businessType">Business Type</Label>
              <Select
                name="businessType"
                onValueChange={(value) =>
                  handleInputChange({ target: { name: "businessType", value } })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                  <SelectItem value="retail">Retail Store</SelectItem>
                  <SelectItem value="museum">Museum</SelectItem>
                  <SelectItem value="hotel">Hotel</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="locationName">Location Name</Label>
              <Input
                id="locationName"
                name="locationName"
                value={formData.locationName}
                onChange={handleInputChange}
                placeholder="Enter location name"
              />
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Enter street address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  placeholder="Enter city"
                />
              </div>
              <div>
                <Label htmlFor="state">State/Province</Label>
                <Input
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  placeholder="Enter state/province"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="zipCode">ZIP/Postal Code</Label>
                <Input
                  id="zipCode"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleInputChange}
                  placeholder="Enter ZIP/postal code"
                />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  name="country"
                  value={formData.country}
                  onChange={handleInputChange}
                  placeholder="Enter country"
                />
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="Enter phone number"
              />
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter email address"
              />
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                value={formData.website}
                onChange={handleInputChange}
                placeholder="Enter website URL"
              />
            </div>
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
                <SelectTrigger>
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
            </div>
            <div>
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                name="apiKey"
                type="password"
                value={formData.apiKey}
                onChange={handleInputChange}
                placeholder="Enter your AI provider API key OR Allow us to create one for you (takes ~1 min)"
              />
            </div>
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
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto py-8 px-4">
      <div className="space-y-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    index <= currentStep
                      ? "border-primary bg-primary text-white"
                      : "border-gray-300 text-gray-300"
                  }`}
                >
                  <StepIcon className="w-5 h-5" />
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-full h-1 mx-2 ${
                      index < currentStep ? "bg-primary" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Form Content */}
        <div className="bg-white shadow-sm rounded-lg border p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            type="button"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            variant="outline"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>Loading...</>
            ) : currentStep === steps.length - 1 ? (
              "Complete Setup"
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
