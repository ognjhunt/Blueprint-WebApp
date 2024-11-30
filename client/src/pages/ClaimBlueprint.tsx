import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import CustomerExperienceDesigner from "@/components/CustomerExperienceDesigner";
import { QRCodeSetup } from "@/components/QRCodeSetup";
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
  Download,
  MapPin
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
  shippingAddress: string;
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
    shippingAddress: ""
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
        shippingAddress: place.formatted_address || prediction.structured_formatting.secondary_text,
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
        shippingAddress: parsedData.address,
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

            <CustomerExperienceDesigner />

            <div className="space-y-4 mt-8">
              <h3 className="text-lg font-semibold">Additional Features</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Loyalty Program</Label>
                    <p className="text-sm text-muted-foreground">
                      Reward returning customers
                    </p>
                  </div>
                  <Button
                    variant={
                      formData.customizations.loyaltyProgram
                        ? "default"
                        : "outline"
                    }
                    onClick={() => handleCustomizationToggle("loyaltyProgram")}
                  >
                    {formData.customizations.loyaltyProgram ? "Enabled" : "Add"}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Special Promotions</Label>
                    <p className="text-sm text-muted-foreground">
                      Highlight deals and offers
                    </p>
                  </div>
                  <Button
                    variant={
                      formData.customizations.specialPromotions
                        ? "default"
                        : "outline"
                    }
                    onClick={() => handleCustomizationToggle("specialPromotions")}
                  >
                    {formData.customizations.specialPromotions
                      ? "Enabled"
                      : "Add"}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Virtual Tour</Label>
                    <p className="text-sm text-muted-foreground">
                      Show your space in 3D
                    </p>
                  </div>
                  <Button
                    variant={
                      formData.customizations.virtualTour ? "default" : "outline"
                    }
                    onClick={() => handleCustomizationToggle("virtualTour")}
                  >
                    {formData.customizations.virtualTour ? "Enabled" : "Add"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <QRCodeSetup
            businessName={formData.businessName}
            blueprintId="temp-id-1" // This will be replaced with actual Blueprint ID once created
          />
        );
      case 5:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Review & Submit</h2>
            <p className="text-muted-foreground">
              Please review your Blueprint details before submitting.
            </p>

            <div className="space-y-4">
              <div className="border rounded-lg p-6 space-y-4">
                <div>
                  <h3 className="font-semibold">Business Information</h3>
                  <p>{formData.businessName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formData.address}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold">Contact Details</h3>
                  <p>{formData.phone}</p>
                  <p>{formData.email}</p>
                  <p>{formData.website}</p>
                </div>

                <div>
                  <h3 className="font-semibold">Shipping Address</h3>
                  <p>{formData.shippingAddress}</p>
                </div>

                <div>
                  <h3 className="font-semibold">Selected Features</h3>
                  <ul className="list-disc list-inside">
                    {formData.customizations.loyaltyProgram && (
                      <li>Loyalty Program</li>
                    )}
                    {formData.customizations.specialPromotions && (
                      <li>Special Promotions</li>
                    )}
                    {formData.customizations.virtualTour && <li>Virtual Tour</li>}
                  </ul>
                </div>
              </div>

              <Alert>
                <AlertDescription>
                  By submitting, you confirm that you are authorized to claim this
                  business and agree to Blueprint's terms of service.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-center">
              Claim Your Blueprint
            </h1>
          </div>

          <div className="mb-8">
            <nav aria-label="Progress">
              <ol className="flex items-center justify-center space-x-2">
                {steps.map((step, index) => (
                  <li
                    key={step.id}
                    className={`relative ${
                      index !== steps.length - 1 ? "flex-1" : ""
                    }`}
                  >
                    <div className="flex items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          currentStep === index
                            ? "bg-blue-600 text-white"
                            : index < currentStep
                            ? "bg-green-500 text-white"
                            : "bg-gray-200"
                        }`}
                      >
                        <step.icon className="w-4 h-4" />
                      </div>
                      {index !== steps.length - 1 && (
                        <div
                          className={`h-0.5 flex-1 mx-2 ${
                            index < currentStep ? "bg-green-500" : "bg-gray-200"
                          }`}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </nav>
          </div>

          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-8">
                {renderStep()}

                <div
                  className={`flex ${
                    currentStep === 0 ? "justify-end" : "justify-between"
                  } pt-4`}
                >
                  {currentStep > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePrevious}
                    >
                      Previous
                    </Button>
                  )}
                  <Button
                    type={currentStep === steps.length - 1 ? "submit" : "button"}
                    onClick={
                      currentStep === steps.length - 1 ? undefined : handleNext
                    }
                  >
                    {currentStep === steps.length - 1 ? "Submit" : "Next"}
                    {currentStep !== steps.length - 1 && (
                      <ChevronRight className="w-4 h-4 ml-2" />
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
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
