"use client";

import { doc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  SetStateAction,
} from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { ScanningSetup } from "@/components/ScanningSetup";
import ScreenShareButton from "@/components/ScreenShareButton";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  ChevronRight,
  ChevronLeft,
  Building2,
  MapPin,
  Phone,
  Calendar,
  Check,
  Search,
  MapPinIcon,
  AlertCircle,
  Loader2,
  ArrowRight,
  Store,
  Clock,
  X,
  Calendar as CalendarIcon,
  Info,
  Sparkles,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type FormData = {
  businessName: string;
  locationType: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  scheduling: {
    appointmentDate?: string;
    appointmentTime?: string;
    status: "scheduled" | "pending" | "completed";
  };
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

const states = [
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
];

// Simplified step structure
const steps = [
  {
    id: "location",
    title: "Location Details",
    icon: Building2,
    color: "from-indigo-600 to-blue-600",
  },
  {
    id: "contact",
    title: "Contact Information",
    icon: Phone,
    color: "from-blue-600 to-cyan-600",
  },
  {
    id: "scheduling",
    title: "Schedule Mapping",
    icon: Calendar,
    color: "from-violet-600 to-indigo-600",
  },
  {
    id: "review",
    title: "Review & Submit",
    icon: Check,
    color: "from-indigo-600 to-violet-600",
  },
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
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]); // Specify the type here
  const [isTimeSlotsLoading, setIsTimeSlotsLoading] = useState(false);

  const [formData, setFormData] = useState<FormData & { blueprintId?: string }>(
    {
      businessName: "",
      locationType: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "US",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      scheduling: {
        appointmentDate: "",
        appointmentTime: "",
        status: "pending",
      },
    },
  );

  // Google Places API related states
  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.AutocompleteService | null>(null);
  const [placesService, setPlacesService] =
    useState<google.maps.places.PlacesService | null>(null);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [addressPredictions, setAddressPredictions] = useState<
    PlacePrediction[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  // Schedule date state
  const [scheduleDate, setScheduleDate] = useState<Date>(new Date());
  const [scheduleTime, setScheduleTime] = useState<string | null>(null);

  // Initialize Google Places API
  useEffect(() => {
    const initGooglePlaces = async () => {
      try {
        const apiKey = "AIzaSyBgxzzgcT_9nyhz1D_JtfG7gevRUKQ5Vbs";

        const loader = new Loader({
          apiKey,
          version: "weekly",
          libraries: ["places"],
        });

        await loader.load();

        const autocompleteService =
          new google.maps.places.AutocompleteService();
        setAutocomplete(autocompleteService);

        // Create a dummy div for PlacesService
        const placesDiv = document.createElement("div");
        const service = new google.maps.places.PlacesService(placesDiv);
        setPlacesService(service);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An unexpected error occurred";
        console.error("Error initializing Google Places API:", errorMessage);

        toast({
          title: "Error",
          description: `Failed to initialize Google Places API. Please try again.`,
          variant: "destructive",
        });
      }
    };

    initGooglePlaces();
  }, [toast]);

  // Handle form field changes
  const handleInputChange = (
    e:
      | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      | { target: { name: string; value: string } },
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear any errors when the user types
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }

    // Handle business name search via Google Places
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
          }
        },
      );
    } else if (name === "address" && autocomplete && value.length >= 3) {
      setLoading(true);
      autocomplete.getPlacePredictions(
        {
          input: value,
          types: ["address"],
          componentRestrictions: { country: "us" },
        },
        (predictions, status) => {
          setLoading(false);
          if (
            status === google.maps.places.PlacesServiceStatus.OK &&
            predictions
          ) {
            setAddressPredictions(
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
            setAddressPredictions([]);
          }
        },
      );
    }
  };

  // Handle selecting a business from predictions
  const handleBusinessSelect = async (prediction: PlacePrediction) => {
    setPredictions([]);
    setLoading(true);

    try {
      if (!placesService) throw new Error("Places service not initialized");

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

      // Update form data with business details
      setFormData((prev) => ({
        ...prev,
        businessName: result.name || prediction.structured_formatting.main_text,
        locationType,
        address:
          result.formatted_address ||
          prediction.structured_formatting.secondary_text,
        contactPhone: result.formatted_phone_number || "",
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

  // Handle selecting an address from predictions
  const handleAddressSelect = async (prediction: PlacePrediction) => {
    setAddressPredictions([]);
    setLoading(true);

    try {
      if (!placesService) throw new Error("Places service not initialized");

      const result = await new Promise<google.maps.places.PlaceResult>(
        (resolve, reject) => {
          placesService.getDetails(
            {
              placeId: prediction.place_id,
              fields: ["address_components", "formatted_address"],
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

      setFormData((prev) => ({
        ...prev,
        address: result.formatted_address || prediction.description,
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
      console.error("Error fetching address details:", error);
    } finally {
      setLoading(false);
    }
  };

  // Field validation
  const validateField = (name: string, value: string): string => {
    switch (name) {
      case "businessName":
        return value.trim().length === 0 ? "Business name is required" : "";
      case "locationType":
        return value.trim().length === 0 ? "Business type is required" : "";
      case "address":
        return value.trim().length === 0 ? "Address is required" : "";
      case "city":
        return value.trim().length === 0 ? "City is required" : "";
      case "state":
        return value.trim().length === 0 ? "State is required" : "";
      case "zipCode":
        return value.trim().length === 0 ? "ZIP code is required" : "";
      case "contactName":
        return value.trim().length === 0 ? "Contact name is required" : "";
      case "contactPhone":
        const phoneRegex = /^\+?\d{10,}$/;
        return !phoneRegex.test(value.replace(/\D/g, ""))
          ? "Please enter a valid phone number"
          : "";
      case "contactEmail":
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return !emailRegex.test(value)
          ? "Please enter a valid email address"
          : "";
      default:
        return "";
    }
  };

  // Validate an entire step
  const validateStep = (stepIndex: number): boolean => {
    let isValid = true;
    const newErrors: { [key: string]: string } = {};

    if (stepIndex === 0) {
      // Location Details step
      for (const field of [
        "businessName",
        "locationType",
        "address",
        "city",
        "state",
        "zipCode",
      ]) {
        const error = validateField(
          field,
          formData[field as keyof FormData] as string,
        );
        if (error) {
          newErrors[field] = error;
          isValid = false;
        }
      }
    } else if (stepIndex === 1) {
      // Contact Information step
      for (const field of ["contactName", "contactPhone", "contactEmail"]) {
        const error = validateField(
          field,
          formData[field as keyof FormData] as string,
        );
        if (error) {
          newErrors[field] = error;
          isValid = false;
        }
      }
    } else if (stepIndex === 2) {
      // Scheduling step
      isValid = scheduleDate !== null && scheduleTime !== null;
    }

    setFieldErrors(newErrors);
    return isValid;
  };

  // Handle next step
  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep === 2) {
        // Update the formData with the selected date and time
        setFormData((prev) => ({
          ...prev,
          scheduling: {
            appointmentDate: scheduleDate ? scheduleDate.toISOString() : "",
            appointmentTime: scheduleTime || "",
            status: "scheduled",
          },
        }));
      }
      setCurrentStep((prev) => prev + 1);
    } else {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields correctly.",
        variant: "destructive",
      });
    }
  };

  // Handle previous step
  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  // Generate claim code for the blueprint
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

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (currentStep !== steps.length - 1) {
      handleNext();
      return;
    }

    setIsLoading(true);
    try {
      const blueprintId = crypto.randomUUID();
      const claimCode = generateClaimCode();
      const now = new Date();

      // Format the date
      const formattedDate = now.toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
        hour12: true,
      });

      const blueprintData = {
        id: blueprintId,
        ...formData,
        host: currentUser?.uid || "",
        createdDate: formattedDate,
        updatedAt: formattedDate,
        claimCode: claimCode,
      };

      // Store blueprint data in Firestore
      await setDoc(doc(db, "blueprints", blueprintId), blueprintData);

      // Update the current user's createdBlueprintIDs array
      if (currentUser?.uid) {
        await updateDoc(doc(db, "users", currentUser.uid), {
          createdBlueprintIDs: arrayUnion(blueprintId),
        });
      }

      // Record the booking in the bookings collection
      if (scheduleDate && scheduleTime) {
        const bookingDate = scheduleDate.toISOString().split("T")[0];
        await setDoc(doc(db, "bookings", `${bookingDate}_${scheduleTime}`), {
          date: bookingDate,
          time: scheduleTime,
          userId: currentUser?.uid,
          blueprintId: blueprintId,
          businessName: formData.businessName,
          createdAt: serverTimestamp(),
        });
      }

      toast({
        title: "Blueprint Created Successfully!",
        description: "You can now customize your Blueprint in the editor.",
      });

      setFormData((prev) => ({ ...prev, blueprintId }));
    } catch (error) {
      console.error("Error creating blueprint:", error);
      toast({
        title: "Error",
        description: "Failed to create Blueprint. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch booked times for the selected date
  useEffect(() => {
    const fetchBookedTimes = async () => {
      if (!scheduleDate) return;

      setIsTimeSlotsLoading(true);
      try {
        const bookingDate = scheduleDate.toISOString().split("T")[0];
        const { collection, query, where, getDocs } = await import(
          "firebase/firestore"
        );

        // Get all bookings for the selected date
        const bookingsRef = collection(db, "bookings");
        const q = query(bookingsRef, where("date", "==", bookingDate));
        const querySnapshot = await getDocs(q);

        // Extract the booked times
        const times: string[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.time && typeof data.time === "string") {
            // Added a type check for robustness
            times.push(data.time);
          }
        });

        setBookedTimes(times);
      } catch (error) {
        console.error("Error fetching booked times:", error);
        toast({
          title: "Error",
          description: "Could not load availability. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsTimeSlotsLoading(false);
      }
    };

    fetchBookedTimes();
  }, [scheduleDate, db, toast]);

  // Generate time slots for the selected date
  const generateTimeSlots = useCallback(() => {
    const slots: string[] = []; // Explicitly type as string[]
    // Generate time slots from 8 AM to 8 PM in 30-minute increments
    for (let hour = 8; hour < 20; hour++) {
      slots.push(`${hour.toString().padStart(2, "0")}:00`);
      slots.push(`${hour.toString().padStart(2, "0")}:30`);
    }
    slots.push("20:00"); // Add 8 PM

    const isToday = (date: Date): boolean => {
      const now = new Date();
      return (
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    };

    // Check if a slot should be unavailable (booked or within 1 hour after a booking)
    const isSlotUnavailable = (slot: string): boolean => {
      // If the slot itself is booked
      if (bookedTimes.includes(slot)) return true;

      // Check if slot is within one hour after any booked time
      for (const bookedTime of bookedTimes) {
        const [bookedHour, bookedMinute] = bookedTime.split(":").map(Number);
        const [slotHour, slotMinute] = slot.split(":").map(Number);

        // Convert both times to minutes for easier comparison
        const bookedTimeInMinutes = bookedHour * 60 + bookedMinute;
        const slotTimeInMinutes = slotHour * 60 + slotMinute;

        // Check if slot is within 60 minutes after a booked time
        const timeDifference = slotTimeInMinutes - bookedTimeInMinutes;
        if (timeDifference > 0 && timeDifference <= 60) {
          return true;
        }
      }

      return false;
    };

    if (isToday(scheduleDate)) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      // Filter out times that are less than 1 hour from now or unavailable due to bookings
      return slots.filter((slot) => {
        const [hh, mm] = slot.split(":");
        const slotMinutes = parseInt(hh, 10) * 60 + parseInt(mm, 10);
        return slotMinutes >= currentMinutes + 60 && !isSlotUnavailable(slot);
      });
    }

    // For future dates, only filter based on bookings
    return slots.filter((slot) => !isSlotUnavailable(slot));
  }, [scheduleDate, bookedTimes]);

  // Format time slot for display (convert 24h to 12h format)
  const formatTimeSlot = (time: string): string => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Maximum selectable date (1 month from now)
  const maxDate = useCallback(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date;
  }, []);

  // Get available time slots
  const availableTimeSlots = generateTimeSlots();

  // Step content based on current step
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Location Details
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-0 shadow-md overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b pb-3">
                  <CardTitle className="flex items-center gap-2 text-gray-800">
                    <Store className="h-5 w-5 text-indigo-600" />
                    Business Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="businessName">Business Name</Label>
                    <div className="relative">
                      <Input
                        id="businessName"
                        name="businessName"
                        value={formData.businessName}
                        onChange={handleInputChange}
                        placeholder="Enter your business name"
                        className={cn(
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
                                className="px-4 py-2 hover:bg-indigo-50 cursor-pointer transition-colors"
                                onClick={() => handleBusinessSelect(prediction)}
                              >
                                <div className="font-medium text-gray-800">
                                  {prediction.structured_formatting.main_text}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {
                                    prediction.structured_formatting
                                      .secondary_text
                                  }
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="locationType">Business Type</Label>
                    <Select
                      name="locationType"
                      value={formData.locationType}
                      onValueChange={(value) =>
                        handleInputChange({
                          target: { name: "locationType", value },
                        })
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
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b pb-3">
                  <CardTitle className="flex items-center gap-2 text-gray-800">
                    <MapPin className="h-5 w-5 text-indigo-600" />
                    Location Address
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="address">Street Address</Label>
                    <div className="relative">
                      <Input
                        id="address"
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        placeholder="Enter street address"
                        className={cn(
                          fieldErrors.address &&
                            "border-red-500 focus-visible:ring-red-500",
                        )}
                      />
                      {fieldErrors.address && (
                        <p className="text-sm text-red-500 mt-1">
                          {fieldErrors.address}
                        </p>
                      )}
                      {addressPredictions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white rounded-md border shadow-lg max-h-60 overflow-auto">
                          <ul className="py-1">
                            {addressPredictions.map((prediction) => (
                              <li
                                key={prediction.place_id}
                                className="px-4 py-2 hover:bg-indigo-50 cursor-pointer transition-colors"
                                onClick={() => handleAddressSelect(prediction)}
                              >
                                <div className="text-sm">
                                  {prediction.description}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        placeholder="City"
                        className={cn(
                          fieldErrors.city &&
                            "border-red-500 focus-visible:ring-red-500",
                        )}
                      />
                      {fieldErrors.city && (
                        <p className="text-sm text-red-500 mt-1">
                          {fieldErrors.city}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="state">State</Label>
                      <Select
                        name="state"
                        value={formData.state}
                        onValueChange={(value) =>
                          handleInputChange({
                            target: { name: "state", value },
                          })
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            fieldErrors.state &&
                              "border-red-500 focus-visible:ring-red-500",
                          )}
                        >
                          <SelectValue placeholder="State" />
                        </SelectTrigger>
                        <SelectContent>
                          {states.map((state) => (
                            <SelectItem key={state.value} value={state.value}>
                              {state.label}
                            </SelectItem>
                          ))}
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
                    <div className="space-y-1.5">
                      <Label htmlFor="zipCode">ZIP Code</Label>
                      <Input
                        id="zipCode"
                        name="zipCode"
                        value={formData.zipCode}
                        onChange={handleInputChange}
                        placeholder="ZIP Code"
                        className={cn(
                          fieldErrors.zipCode &&
                            "border-red-500 focus-visible:ring-red-500",
                        )}
                      />
                      {fieldErrors.zipCode && (
                        <p className="text-sm text-red-500 mt-1">
                          {fieldErrors.zipCode}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        name="country"
                        value="United States"
                        disabled
                        className="bg-gray-50"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 1: // Contact Information
        return (
          <div className="space-y-6">
            <Card className="border-0 shadow-md overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b pb-3">
                <CardTitle className="flex items-center gap-2 text-gray-800">
                  <Phone className="h-5 w-5 text-blue-600" />
                  Contact Information
                </CardTitle>
                <CardDescription>
                  Who should we contact about this location?
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="contactName">Contact Name</Label>
                  <Input
                    id="contactName"
                    name="contactName"
                    value={formData.contactName}
                    onChange={handleInputChange}
                    placeholder="Who should we contact about this location?"
                    className={cn(
                      fieldErrors.contactName &&
                        "border-red-500 focus-visible:ring-red-500",
                    )}
                  />
                  {fieldErrors.contactName && (
                    <p className="text-sm text-red-500 mt-1">
                      {fieldErrors.contactName}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contactPhone">Phone Number</Label>
                  <Input
                    id="contactPhone"
                    name="contactPhone"
                    value={formData.contactPhone}
                    onChange={handleInputChange}
                    placeholder="Contact phone number"
                    className={cn(
                      fieldErrors.contactPhone &&
                        "border-red-500 focus-visible:ring-red-500",
                    )}
                  />
                  {fieldErrors.contactPhone && (
                    <p className="text-sm text-red-500 mt-1">
                      {fieldErrors.contactPhone}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contactEmail">Email Address</Label>
                  <Input
                    id="contactEmail"
                    name="contactEmail"
                    value={formData.contactEmail}
                    onChange={handleInputChange}
                    placeholder="Contact email address"
                    className={cn(
                      fieldErrors.contactEmail &&
                        "border-red-500 focus-visible:ring-red-500",
                    )}
                  />
                  {fieldErrors.contactEmail && (
                    <p className="text-sm text-red-500 mt-1">
                      {fieldErrors.contactEmail}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 2: // Schedule Mapping
        return (
          <div className="space-y-6">
            <Card className="border-0 shadow-md overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-violet-50 to-indigo-50 border-b pb-3">
                <CardTitle className="flex items-center gap-2 text-gray-800">
                  <Calendar className="h-5 w-5 text-violet-600" />
                  Schedule 3D Mapping
                </CardTitle>
                <CardDescription>
                  Pick a date and time for our specialist to visit and scan your
                  location.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Calendar Section */}
                  <div className="bg-white rounded-lg p-4 border">
                    <div className="mb-4 flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5 text-indigo-600" />
                      <Label className="font-medium">Select Date</Label>
                    </div>
                    <DatePicker
                      selected={scheduleDate}
                      onChange={(date: Date | null) => {
                        // Define the handler explicitly
                        if (date) {
                          // Only update if date is not null
                          setScheduleDate(date);
                        }
                        // If you need to handle the case where date is null (e.g., clear the date),
                        // you would need to change your scheduleDate state to allow null:
                        // const [scheduleDate, setScheduleDate] = useState<Date | null>(new Date());
                        // And then you could do: setScheduleDate(date);
                      }}
                      inline
                      minDate={new Date()}
                      maxDate={maxDate()}
                      dropdownMode="select"
                      calendarClassName="!border-0 !shadow-none scale-[1.1] origin-top-left"
                      wrapperClassName="!block w-full"
                      dayClassName={(date) =>
                        date.toDateString() === scheduleDate?.toDateString()
                          ? "!bg-indigo-600 !text-white hover:!bg-indigo-700"
                          : "hover:!bg-indigo-50"
                      }
                    />
                  </div>

                  {/* Time Selection */}
                  <div className="bg-white rounded-lg p-4 border">
                    <div className="mb-4">
                      <Label className="font-medium">Select Time</Label>
                      <p className="text-sm text-gray-500 mt-1">
                        Available time slots
                      </p>
                    </div>

                    {isTimeSlotsLoading ? (
                      <div className="flex justify-center py-6">
                        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : availableTimeSlots.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2">
                        {availableTimeSlots.map((slot) => (
                          <button
                            key={slot}
                            onClick={() => setScheduleTime(slot)}
                            className={`p-2 text-sm rounded-md transition-colors
                              ${
                                scheduleTime === slot
                                  ? "bg-indigo-600 text-white"
                                  : "bg-gray-50 hover:bg-indigo-50"
                              }
                            `}
                          >
                            {formatTimeSlot(slot)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-red-600 text-sm p-4 bg-red-50 rounded-md">
                        No available times left for this date. Please pick
                        another date.
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 3: // Review & Submit
        return (
          <div className="space-y-6">
            <Card className="border-0 shadow-md overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-violet-50 border-b pb-3">
                <CardTitle className="flex items-center gap-2 text-gray-800">
                  <Check className="h-5 w-5 text-indigo-600" />
                  Review Your Blueprint
                </CardTitle>
                <CardDescription>
                  Please review your details before submitting.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">
                        Business Information
                      </h3>
                      <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Business Name:</span>
                          <span className="font-medium">
                            {formData.businessName}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Business Type:</span>
                          <span className="font-medium">
                            {locationTypes.find(
                              (t) => t.value === formData.locationType,
                            )?.label || formData.locationType}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">
                        Contact Information
                      </h3>
                      <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Contact Name:</span>
                          <span className="font-medium">
                            {formData.contactName}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Phone:</span>
                          <span className="font-medium">
                            {formData.contactPhone}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Email:</span>
                          <span className="font-medium">
                            {formData.contactEmail}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">
                        Location Address
                      </h3>
                      <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Address:</span>
                          <span className="font-medium">
                            {formData.address}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">City:</span>
                          <span className="font-medium">{formData.city}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">State:</span>
                          <span className="font-medium">{formData.state}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">ZIP Code:</span>
                          <span className="font-medium">
                            {formData.zipCode}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">
                        Scheduled Mapping
                      </h3>
                      <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Date:</span>
                          <span className="font-medium">
                            {scheduleDate?.toLocaleDateString("en-US", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Time:</span>
                          <span className="font-medium">
                            {scheduleTime
                              ? formatTimeSlot(scheduleTime)
                              : "Not selected"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Alert className="bg-blue-50 border-blue-200 mt-4">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-700">
                    We'll send a confirmation email with these details. You can
                    modify this Blueprint later.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  // Success screen shown after blueprint creation
  const SuccessScreen = () => (
    <div className="text-center max-w-xl mx-auto py-8">
      <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-100 mb-6">
        <Sparkles className="h-10 w-10 text-green-600" />
      </div>
      <h1 className="text-3xl font-bold mb-4 text-gray-900">
        Blueprint Created!
      </h1>
      <p className="text-lg text-gray-600 mb-8">
        Your Blueprint has been successfully created. Our mapping specialist
        will visit your location at the scheduled time.
      </p>
      <div className="flex flex-col md:flex-row gap-4 justify-center">
        <Button
          onClick={() => (window.location.href = "/dashboard")}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700"
        >
          Go to Dashboard
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            (window.location.href = `/blueprint-editor/${formData.blueprintId}`)
          }
          className="px-6 py-2"
        >
          Customize Blueprint
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50/30">
      <Nav />

      <main className="pt-24 pb-16 px-4 sm:px-6 md:px-8">
        <div className="max-w-6xl mx-auto">
          {formData.blueprintId ? (
            <SuccessScreen />
          ) : (
            <>
              <div className="mb-8 text-center">
                <motion.h1
                  className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  Create New Blueprint
                </motion.h1>
                <motion.p
                  className="text-lg text-gray-600 max-w-2xl mx-auto"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  Add another location to your Blueprint account
                </motion.p>
              </div>

              {/* Step indicators */}
              <div className="mb-10">
                <div className="flex items-center justify-center md:justify-between mt-10 px-4 md:px-10">
                  {steps.map((step, index) => (
                    <div
                      key={step.id}
                      className={`flex flex-col items-center ${
                        index <= currentStep
                          ? "text-indigo-600"
                          : "text-gray-400"
                      }`}
                    >
                      <div
                        className={`relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-colors ${
                          index < currentStep
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : index === currentStep
                              ? "bg-white border-indigo-600 text-indigo-600"
                              : "bg-white border-gray-200 text-gray-400"
                        }`}
                      >
                        {index < currentStep ? (
                          <Check className="w-6 h-6" />
                        ) : (
                          <step.icon className="w-6 h-6" />
                        )}

                        {/* Progress connector line */}
                        {index < steps.length - 1 && (
                          <div className="absolute left-full w-full h-0.5 transform translate-x-1 lg:translate-x-2">
                            <div
                              className={`h-full transition-colors ${
                                index < currentStep
                                  ? "bg-indigo-600"
                                  : "bg-gray-200"
                              }`}
                              style={{ width: "calc(100% - 12px)" }}
                            ></div>
                          </div>
                        )}
                      </div>
                      <span className="mt-2 text-xs font-medium hidden sm:block">
                        {step.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="max-w-5xl mx-auto"
                >
                  {renderStepContent()}
                </motion.div>

                <div className="mt-10 flex justify-between max-w-5xl mx-auto">
                  <Button
                    type="button"
                    onClick={handlePrevious}
                    disabled={currentStep === 0}
                    variant="outline"
                    className="px-6"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>

                  {currentStep < steps.length - 1 ? (
                    <Button
                      type="button"
                      onClick={handleNext}
                      className="px-6 bg-indigo-600 hover:bg-indigo-700"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="px-6 bg-indigo-600 hover:bg-indigo-700"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          Create Blueprint
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </form>
            </>
          )}
        </div>
      </main>

      <Footer />
      <ScreenShareButton />
    </div>
  );
}
