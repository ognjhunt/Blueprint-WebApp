import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import CustomerExperienceDesigner from "@/components/CustomerExperienceDesigner";
import {
  Check,
  ChevronRight,
  Store,
  User,
  Mail,
  Phone,
  Globe,
  Shield,
  Search,
  Building2,
  AlertCircle,
  Loader2,
  QrCode,
  Download
} from "lucide-react";
import { CodeEntryModal } from "@/components/CodeEntryModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader } from "@googlemaps/js-api-loader";

interface FormData {
  businessName: string;
  address: string;
  phone: string;
  website: string;
  email: string;
  verificationMethod: string;
  verificationCode: string;
  customizations: {
    loyaltyProgram: boolean;
    specialPromotions: boolean;
    virtualTour: boolean;
  };
  qrCode: {
    size: string;
    logo: boolean;
    color: string;
  };
}

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

const steps = [
  { id: "search", title: "Find Business", icon: Search },
  { id: "verify", title: "Verify Business", icon: Shield },
  { id: "review", title: "Review Information", icon: Store },
  { id: "customize", title: "Customize Blueprint", icon: User },
  { id: "qr-setup", title: "QR Code Setup", icon: QrCode },
  { id: "confirm", title: "Confirm & Submit", icon: Check },
];

type LoaderStatus = "idle" | "loading" | "error" | "success";

export default function ClaimBlueprint() {
  const { currentUser } = useAuth();
  const [_, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [showOtherMethods, setShowOtherMethods] = useState(false);
  const { toast } = useToast();

  // Business search state
  const [searchQuery, setSearchQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.AutocompleteService | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaderStatus, setLoaderStatus] = useState<LoaderStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    businessName: "",
    address: "",
    phone: "",
    website: "",
    email: "",
    verificationMethod: "",
    verificationCode: "",
    customizations: {
      loyaltyProgram: false,
      specialPromotions: false,
      virtualTour: false,
    },
    qrCode: {
      size: "medium",
      logo: true,
      color: "#4F46E5"
    }
  });

  // Initialize Google Places API
  const initGooglePlaces = useCallback(async () => {
    setLoaderStatus("loading");
    setError(null);

    try {
      const apiKey = "AIzaSyBgxzzgcT_9nyhz1D_JtfG7gevRUKQ5Vbs";
      if (!apiKey) {
        throw new Error("Google Places API key is not configured");
      }

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
      setAutocomplete(autocompleteService);
      setLoaderStatus("success");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
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

  // Handle business search input
  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (value.length >= 3 && autocomplete) {
      setLoading(true);
      autocomplete.getPlacePredictions(
        {
          input: value,
          types: ["establishment"],
          componentRestrictions: { country: "us" },
        },
        (predictions, status) => {
          setLoading(false);
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            setPredictions(predictions.map(prediction => ({
              place_id: prediction.place_id,
              description: prediction.description,
              structured_formatting: {
                main_text: prediction.structured_formatting.main_text,
                secondary_text: prediction.structured_formatting.secondary_text,
              },
            })));
          } else {
            setPredictions([]);
          }
        }
      );
    } else {
      setPredictions([]);
    }
  };

  // Handle selecting a business from predictions
  const handleBusinessSelect = async (prediction: PlacePrediction) => {
    setPredictions([]);
    setLoading(true);

    try {
      const placesDiv = document.createElement("div");
      const placesService = new google.maps.places.PlacesService(placesDiv);

      const place = await new Promise<google.maps.places.PlaceResult>((resolve, reject) => {
        placesService.getDetails(
          {
            placeId: prediction.place_id,
            fields: ["name", "formatted_address", "formatted_phone_number", "website"],
          },
          (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place) {
              resolve(place);
            } else {
              reject(new Error(`Places API error: ${status}`));
            }
          }
        );
      });

      setFormData(prev => ({
        ...prev,
        businessName: place.name || prediction.structured_formatting.main_text,
        address: place.formatted_address || prediction.structured_formatting.secondary_text,
        phone: place.formatted_phone_number || "",
        website: place.website || "",
      }));

      setSearchQuery(prediction.description);
      handleNext();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch business details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleQRCodeChange = (field: keyof FormData['qrCode'], value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      qrCode: {
        ...prev.qrCode,
        [field]: value
      }
    }));
  };

  const handleCustomizationToggle = (feature: keyof FormData["customizations"]) => {
    setFormData((prev) => ({
      ...prev,
      customizations: {
        ...prev.customizations,
        [feature]: !prev.customizations[feature],
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser && currentStep === steps.length - 1) {
      localStorage.setItem('pendingBlueprintClaim', JSON.stringify(formData));
      setLocation('/sign-in?redirect=/claim-blueprint');
      return;
    }
    console.log("Blueprint claimed:", formData);
    toast({
      title: "Success",
      description: "Your Blueprint has been successfully claimed and customized!",
    });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const businessData = params.get('data');
    
    if (businessData) {
      const parsedData = JSON.parse(decodeURIComponent(businessData));
      setFormData(prev => ({
        ...prev,
        businessName: parsedData.name,
        address: parsedData.address,
      }));
      setCurrentStep(1); // Skip search step if data is provided
    } else {
      const pendingClaim = localStorage.getItem('pendingBlueprintClaim');
      if (pendingClaim && currentUser) {
        setFormData(JSON.parse(pendingClaim));
        localStorage.removeItem('pendingBlueprintClaim');
      }
    }
  }, [currentUser]);

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Find Your Business</h2>
            <p className="text-muted-foreground">
              Search for your business to claim or create a Blueprint
            </p>
            <div className="space-y-4">
              <div className="relative">
                <div className="flex items-center space-x-2">
                  {loading ? (
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  ) : (
                    <Search className="w-5 h-5 text-gray-400" />
                  )}
                  <Input
                    value={searchQuery}
                    onChange={handleSearchInput}
                    placeholder="Search for your business..."
                    className="flex-1"
                    disabled={loaderStatus !== "success"}
                  />
                </div>

                {predictions.length > 0 && !loading && (
                  <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg">
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
          </div>
        );
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Verify Your Business</h2>
            <p className="text-muted-foreground">
              Please verify ownership of your business to claim your Blueprint.
            </p>

            <div className="space-y-4">
              <Button
                size="lg"
                className="w-full py-6 text-lg"
                onClick={() => setIsCodeModalOpen(true)}
              >
                I have a verification code
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">
                    or
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowOtherMethods(!showOtherMethods)}
              >
                Verify another way
              </Button>

              {showOtherMethods && (
                <div className="mt-4 space-y-4 border rounded-lg p-4 bg-gray-50">
                  <RadioGroup
                    value={formData.verificationMethod}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        verificationMethod: value,
                      }))
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="phone" id="phone" />
                      <Label htmlFor="phone">Phone call verification</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="email" id="email" />
                      <Label htmlFor="email">Email verification</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="postcard" id="postcard" />
                      <Label htmlFor="postcard">Postcard by mail</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Review Your Business Information</h2>
            <p className="text-muted-foreground">
              Please review the information we've gathered about your business.
              You can make changes if needed.
            </p>
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                name="businessName"
                value={formData.businessName}
                onChange={handleInputChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                value={formData.website}
                onChange={handleInputChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your business email"
              />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Customize Your Blueprint</h2>
            <p className="text-muted-foreground">
              Design your customer experience flow and enhance your Blueprint
              with additional features.
            </p>

            {/* Customer Experience Designer */}
            <div className="bg-white rounded-lg shadow-sm border">
              <CustomerExperienceDesigner />
            </div>

            {/* Additional Features */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Additional Features</h3>
              <div className="space-y-2">
                {Object.entries(formData.customizations).map(([feature, enabled]) => (
                  <div key={feature} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={feature}
                      checked={enabled}
                      onChange={() =>
                        handleCustomizationToggle(
                          feature as keyof FormData["customizations"]
                        )
                      }
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor={feature}>
                      {feature
                        .replace(/([A-Z])/g, " $1")
                        .replace(/^./, (str) => str.toUpperCase())}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Blueprint QR Code</h2>
            <p className="text-muted-foreground">
              After submitting, a unique QR code will be generated for your Blueprint. You can:
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Check className="text-green-500" />
                <span>Print and display it at your business location</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="text-green-500" />
                <span>Include it in your marketing materials</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="text-green-500" />
                <span>Share it on social media to promote your AR experience</span>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>QR Code Preview</CardTitle>
                <CardDescription>
                  Customize how your QR code will look
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="w-full aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <QrCode className="w-32 h-32 mx-auto text-blue-600" />
                    <p className="text-sm text-gray-500">QR Code will be generated after submission</p>
                  </div>
                </div>

                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Size</Label>
                    <RadioGroup
                      value={formData.qrCode.size}
                      onValueChange={(value) => handleQRCodeChange('size', value)}
                      className="flex space-x-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="small" id="small" />
                        <Label htmlFor="small">Small</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="medium" id="medium" />
                        <Label htmlFor="medium">Medium</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="large" id="large" />
                        <Label htmlFor="large">Large</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="logo"
                      checked={formData.qrCode.logo}
                      onChange={(e) => handleQRCodeChange('logo', e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="logo">Include Business Logo</Label>
                  </div>

                  <div>
                    <Label htmlFor="qr-color">QR Code Color</Label>
                    <Input
                      type="color"
                      id="qr-color"
                      value={formData.qrCode.color}
                      onChange={(e) => handleQRCodeChange('color', e.target.value)}
                      className="h-10 w-20 p-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Alert>
              <AlertDescription className="text-blue-600">
                Note: The QR code will be generated automatically once you submit your Blueprint. You'll be able to download it in various formats and sizes.
              </AlertDescription>
            </Alert>
          </div>
        );
      case 5:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Review & Submit</h2>
            <p className="text-muted-foreground">
              Please review your Blueprint details before submitting.
            </p>

            <Card>
              <CardHeader>
                <CardTitle>Business Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Store className="w-4 h-4" />
                    <span className="font-medium">{formData.businessName}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4" />
                    <span>{formData.address}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4" />
                    <span>{formData.phone}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Globe className="w-4 h-4" />
                    <span>{formData.website}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4" />
                    <span>{formData.email}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customizations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {Object.entries(formData.customizations).map(
                    ([feature, enabled]) => (
                      <li
                        key={feature}
                        className="flex items-center space-x-2"
                      >
                        {enabled ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-gray-300" />
                        )}
                        <span
                          className={enabled ? "text-gray-900" : "text-gray-500"}
                        >
                          {feature
                            .replace(/([A-Z])/g, " $1")
                            .replace(/^./, (str) => str.toUpperCase())}
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Progress Indicator */}
        <nav className="mb-8">
          <ol className="flex items-center w-full">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              return (
                <li
                  key={step.id}
                  className={`flex items-center ${
                    index < steps.length - 1
                      ? "w-full"
                      : "flex-1"
                  }`}
                >
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full ${
                      currentStep >= index
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    <StepIcon className="w-5 h-5" />
                  </div>
                  {index < steps.length - 1 && (
                    <>
                      <div
                        className={`flex-1 h-px mx-4 ${
                          currentStep > index
                            ? "bg-blue-600"
                            : "bg-gray-200"
                        }`}
                      />
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Main Content */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <form onSubmit={handleSubmit}>{renderStep()}</form>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            Previous
          </Button>
          <Button
            type="button"
            onClick={currentStep === steps.length - 1 ? handleSubmit : handleNext}
          >
            {currentStep === steps.length - 1 ? "Submit" : "Next"}
          </Button>
        </div>
      </div>

      <CodeEntryModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
        onSubmit={(code) => {
          setFormData((prev) => ({ ...prev, verificationCode: code }));
          setIsCodeModalOpen(false);
          handleNext();
        }}
      />
    </div>
  );
}
