"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getGoogleMapsApiKey } from "@/lib/client-env";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MapPin,
  Users,
  Building2,
  ArrowRight,
  Glasses,
  Network,
  Globe,
  CheckCircle2,
  Loader2,
  Search,
  X,
  Navigation,
  ChevronRight,
  Sparkles,
  Upload,
  FileText,
  AlertCircle,
} from "lucide-react";

// Types
interface MappedLocation {
  id: string;
  businessName: string;
  name?: string;
  address: string;
  city?: string;
  state?: string;
  locationType: string;
  status?: string;
  scanCompleted?: boolean;
  latitude?: number;
  longitude?: number;
  createdDate?: string;
}

interface LocationRequest {
  businessName: string;
  address: string;
  locationType: string;
  description: string;
  contactEmail: string;
  contactName: string;
  isOwner: boolean;
  hasPermission: boolean;
  permissionProofFile: File | null;
}

// Location types
const locationTypes = [
  { value: "restaurant", label: "Restaurant" },
  { value: "retail", label: "Retail Store" },
  { value: "warehouse", label: "Warehouse" },
  { value: "healthcare", label: "Healthcare" },
  { value: "hotel", label: "Hotel" },
  { value: "campus", label: "Campus" },
  { value: "office", label: "Office" },
  { value: "other", label: "Other" },
];

// How it works steps
const howItWorksSteps = [
  {
    icon: <Glasses className="h-6 w-6" />,
    title: "Wearers with Smart Glasses",
    description: "People with AR glasses or scanning devices sign up as capture providers in their area.",
  },
  {
    icon: <Building2 className="h-6 w-6" />,
    title: "Locations Request Capture",
    description: "Businesses or clients submit locations they need digitally mapped for robotics or AR applications.",
  },
  {
    icon: <Navigation className="h-6 w-6" />,
    title: "On-Demand Matching",
    description: "We match nearby wearers with capture requests, like a GrubHub for spatial data.",
  },
  {
    icon: <Globe className="h-6 w-6" />,
    title: "SimReady Output",
    description: "Video walk-throughs become 3D reconstructions + egocentric training data for your models.",
  },
];

// Why it matters points
const whyItMatters = [
  {
    title: "Location-Specific Training",
    description: "Train robots on the exact environment they'll deploy in—not generic datasets.",
  },
  {
    title: "Scalable Collection",
    description: "Build a network effect: more wearers means faster turnaround and better coverage.",
  },
  {
    title: "Digital Twin Library",
    description: "Every capture adds to the world's largest collection of simulation-ready spaces.",
  },
];

// Visual helper
function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-zinc-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid-pattern-capture"
          width={40}
          height={40}
          x="50%"
          y={-1}
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 40V.5H40" fill="none" />
        </pattern>
      </defs>
      <rect
        width="100%"
        height="100%"
        strokeWidth={0}
        fill="url(#grid-pattern-capture)"
      />
    </svg>
  );
}

// Helper to map Google place types to our location types
function mapPlaceTypeToLocationType(types: string[]): string {
  const typeMapping: Record<string, string> = {
    restaurant: "restaurant",
    food: "restaurant",
    cafe: "restaurant",
    bar: "restaurant",
    store: "retail",
    shopping_mall: "retail",
    supermarket: "retail",
    clothing_store: "retail",
    warehouse: "warehouse",
    storage: "warehouse",
    hospital: "healthcare",
    doctor: "healthcare",
    pharmacy: "healthcare",
    health: "healthcare",
    lodging: "hotel",
    hotel: "hotel",
    university: "campus",
    school: "campus",
    secondary_school: "campus",
    primary_school: "campus",
    office: "office",
    corporate_office: "office",
  };

  for (const type of types) {
    if (typeMapping[type]) {
      return typeMapping[type];
    }
  }
  return "";
}

// Request Location Dialog Component
function RequestLocationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [formData, setFormData] = useState<LocationRequest>({
    businessName: "",
    address: "",
    locationType: "",
    description: "",
    contactEmail: "",
    contactName: "",
    isOwner: false,
    hasPermission: false,
    permissionProofFile: null,
  });

  // Refs for autocomplete inputs
  const businessNameInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const businessAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const addressAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Google Maps API when dialog opens
  useEffect(() => {
    if (!open) return;

    const loadMaps = async () => {
      const apiKey = getGoogleMapsApiKey();
      if (!apiKey) {
        console.error("Google Maps API key not configured");
        return;
      }

      // Check if already loaded
      if (window.google?.maps?.places) {
        setMapsLoaded(true);
        return;
      }

      try {
        const { Loader } = await import("@googlemaps/js-api-loader");
        const loader = new Loader({
          apiKey,
          version: "weekly",
          libraries: ["places"],
        });
        await loader.load();
        setMapsLoaded(true);
      } catch (error) {
        console.error("Error loading Google Maps:", error);
      }
    };

    loadMaps();
  }, [open]);

  // Initialize autocomplete for business name
  useEffect(() => {
    if (!mapsLoaded || !businessNameInputRef.current || businessAutocompleteRef.current) return;

    try {
      const autocomplete = new google.maps.places.Autocomplete(businessNameInputRef.current, {
        types: ["establishment"],
        fields: ["name", "formatted_address", "address_components", "types", "geometry"],
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (place) {
          const updates: Partial<LocationRequest> = {};

          if (place.name) {
            updates.businessName = place.name;
          }
          if (place.formatted_address) {
            updates.address = place.formatted_address;
          }
          if (place.types) {
            const mappedType = mapPlaceTypeToLocationType(place.types);
            if (mappedType) {
              updates.locationType = mappedType;
            }
          }

          setFormData(prev => ({ ...prev, ...updates }));
        }
      });

      businessAutocompleteRef.current = autocomplete;
    } catch (error) {
      console.error("Error initializing business autocomplete:", error);
    }
  }, [mapsLoaded]);

  // Initialize autocomplete for address
  useEffect(() => {
    if (!mapsLoaded || !addressInputRef.current || addressAutocompleteRef.current) return;

    try {
      const autocomplete = new google.maps.places.Autocomplete(addressInputRef.current, {
        types: ["geocode", "establishment"],
        fields: ["name", "formatted_address", "address_components", "types", "geometry"],
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (place) {
          const updates: Partial<LocationRequest> = {};

          if (place.formatted_address) {
            updates.address = place.formatted_address;
          }
          // If it's an establishment and we don't have a business name yet, use it
          if (place.name && place.types?.includes("establishment") && !formData.businessName) {
            updates.businessName = place.name;
          }
          if (place.types && !formData.locationType) {
            const mappedType = mapPlaceTypeToLocationType(place.types);
            if (mappedType) {
              updates.locationType = mappedType;
            }
          }

          setFormData(prev => ({ ...prev, ...updates }));
        }
      });

      addressAutocompleteRef.current = autocomplete;
    } catch (error) {
      console.error("Error initializing address autocomplete:", error);
    }
  }, [mapsLoaded, formData.businessName, formData.locationType]);

  // Cleanup autocomplete refs when dialog closes
  useEffect(() => {
    if (!open) {
      businessAutocompleteRef.current = null;
      addressAutocompleteRef.current = null;
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData(prev => ({ ...prev, permissionProofFile: file }));
  };

  const removeFile = () => {
    setFormData(prev => ({ ...prev, permissionProofFile: null }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.businessName || !formData.address || !formData.contactEmail) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Validate permission requirements
    if (!formData.isOwner && !formData.hasPermission) {
      toast({
        title: "Permission Required",
        description: "Please confirm you either own this location or have permission to capture it.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    // Simulate submission delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    toast({
      title: "Request Submitted",
      description: "We'll review your request and get back to you soon.",
    });

    setFormData({
      businessName: "",
      address: "",
      locationType: "",
      description: "",
      contactEmail: "",
      contactName: "",
      isOwner: false,
      hasPermission: false,
      permissionProofFile: null,
    });
    onOpenChange(false);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-indigo-600" />
            Request a Location Capture
          </DialogTitle>
          <DialogDescription>
            Tell us about the location you need mapped. We'll match it with a capture provider in your area.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="contactName">Your Name</Label>
              <Input
                id="contactName"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactEmail">Email *</Label>
              <Input
                id="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                placeholder="john@company.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="businessName">Location/Business Name *</Label>
            <Input
              ref={businessNameInputRef}
              id="businessName"
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              placeholder="Start typing to search businesses..."
              required
            />
            <p className="text-xs text-zinc-500">Type to search for businesses with autocomplete</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">Address *</Label>
            <Input
              ref={addressInputRef}
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Start typing to search addresses..."
              required
            />
            <p className="text-xs text-zinc-500">Type to search with autocomplete</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="locationType">Location Type</Label>
            <Select
              value={formData.locationType}
              onValueChange={(value) => setFormData({ ...formData, locationType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {locationTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location Ownership/Permission Section */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-zinc-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-zinc-600">
                Please confirm your relationship to this location
              </p>
            </div>

            <div className="space-y-3">
              {/* Owner checkbox */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="isOwner"
                  checked={formData.isOwner}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      isOwner: checked === true,
                      // If they are the owner, they don't need separate permission
                      hasPermission: checked === true ? false : formData.hasPermission,
                      permissionProofFile: checked === true ? null : formData.permissionProofFile
                    })
                  }
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="isOwner" className="text-sm font-medium cursor-pointer">
                    I own or operate this location
                  </Label>
                  <p className="text-xs text-zinc-500">
                    You are the owner, manager, or authorized representative of this location
                  </p>
                </div>
              </div>

              {/* Permission checkbox - only show if not owner */}
              {!formData.isOwner && (
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="hasPermission"
                    checked={formData.hasPermission}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        hasPermission: checked === true,
                        permissionProofFile: checked === true ? formData.permissionProofFile : null
                      })
                    }
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="hasPermission" className="text-sm font-medium cursor-pointer">
                      I have permission to capture/record this location
                    </Label>
                    <p className="text-xs text-zinc-500">
                      You have written authorization from the property owner or manager
                    </p>
                  </div>
                </div>
              )}

              {/* File upload for permission proof - only show if has permission but not owner */}
              {!formData.isOwner && formData.hasPermission && (
                <div className="ml-6 mt-2 space-y-2">
                  <Label className="text-sm text-zinc-700">
                    Upload proof of permission (optional but recommended)
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                      className="hidden"
                      id="permissionProof"
                    />
                    {!formData.permissionProofFile ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs"
                      >
                        <Upload className="h-3 w-3 mr-1.5" />
                        Upload Document
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 bg-white rounded-md border border-zinc-200 px-3 py-1.5">
                        <FileText className="h-4 w-4 text-indigo-600" />
                        <span className="text-sm text-zinc-700 max-w-[150px] truncate">
                          {formData.permissionProofFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={removeFile}
                          className="text-zinc-400 hover:text-zinc-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500">
                    Accepted formats: PDF, DOC, DOCX, JPG, PNG (max 10MB)
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Additional Details</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Tell us more about your use case (robotics training, AR experience, etc.)"
              rows={3}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Sample locations data for when Firebase is unavailable
const sampleLocations: MappedLocation[] = [
  {
    id: "sample-1",
    businessName: "Downtown Warehouse District",
    address: "123 Industrial Blvd",
    city: "Austin",
    state: "TX",
    locationType: "warehouse",
    status: "Completed",
    scanCompleted: true,
    latitude: 30.2672,
    longitude: -97.7431,
  },
  {
    id: "sample-2",
    businessName: "Tech Campus HQ",
    address: "456 Innovation Way",
    city: "San Francisco",
    state: "CA",
    locationType: "office",
    status: "Completed",
    scanCompleted: true,
    latitude: 37.7749,
    longitude: -122.4194,
  },
  {
    id: "sample-3",
    businessName: "Metro Healthcare Center",
    address: "789 Medical Park",
    city: "Boston",
    state: "MA",
    locationType: "healthcare",
    status: "In Progress",
    scanCompleted: false,
    latitude: 42.3601,
    longitude: -71.0589,
  },
  {
    id: "sample-4",
    businessName: "Retail Distribution Hub",
    address: "321 Commerce Dr",
    city: "Chicago",
    state: "IL",
    locationType: "warehouse",
    status: "Completed",
    scanCompleted: true,
    latitude: 41.8781,
    longitude: -87.6298,
  },
  {
    id: "sample-5",
    businessName: "University Research Lab",
    address: "555 Academic Circle",
    city: "Seattle",
    state: "WA",
    locationType: "campus",
    status: "In Progress",
    scanCompleted: false,
    latitude: 47.6062,
    longitude: -122.3321,
  },
];

// Interactive Map Component
function CaptureMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [locations] = useState<MappedLocation[]>(sampleLocations);
  const [selectedLocation, setSelectedLocation] = useState<MappedLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Initialize Google Maps
  useEffect(() => {
    const initMap = async () => {
      const apiKey = getGoogleMapsApiKey();
      if (!apiKey) {
        console.error("Google Maps API key not configured");
        setMapError("Map unavailable - API key not configured");
        setIsLoading(false);
        return;
      }

      try {
        // Dynamically import the Google Maps loader
        const { Loader } = await import("@googlemaps/js-api-loader");

        const loader = new Loader({
          apiKey,
          version: "weekly",
          libraries: ["places", "geocoding"],
        });

        await loader.load();

        if (mapRef.current && !mapInstanceRef.current) {
          const map = new google.maps.Map(mapRef.current, {
            center: { lat: 39.8283, lng: -98.5795 }, // Center of US
            zoom: 4,
            styles: [
              {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }],
              },
              {
                featureType: "transit",
                elementType: "labels",
                stylers: [{ visibility: "off" }],
              },
            ],
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          });

          mapInstanceRef.current = map;
          setMapLoaded(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error loading Google Maps:", error);
        setMapError("Failed to load map");
        setIsLoading(false);
      }
    };

    initMap();
  }, []);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (!mapLoaded || !searchInputRef.current || autocompleteRef.current) return;

    try {
      const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
        types: ["geocode", "establishment"],
        fields: ["geometry", "formatted_address", "name"],
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (place.geometry?.location && mapInstanceRef.current) {
          const map = mapInstanceRef.current;
          map.panTo(place.geometry.location);
          map.setZoom(14);

          // Update search query with selected place
          setSearchQuery(place.formatted_address || place.name || "");
        }
      });

      autocompleteRef.current = autocomplete;
    } catch (error) {
      console.error("Error initializing autocomplete:", error);
    }
  }, [mapLoaded]);

  // Geocode and add markers
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || locations.length === 0) return;

    const geocoder = new google.maps.Geocoder();
    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    // Filter locations
    const filteredLocations = locations.filter((loc) => {
      const matchesSearch =
        searchQuery === "" ||
        loc.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loc.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (loc.city && loc.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (loc.state && loc.state.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = filterType === "all" || loc.locationType === filterType;

      return matchesSearch && matchesType;
    });

    // Add markers for each location
    filteredLocations.forEach((location) => {
      if (location.latitude && location.longitude) {
        // Use existing coordinates
        addMarker(location, { lat: location.latitude, lng: location.longitude });
      } else if (location.address) {
        // Geocode the address
        geocoder.geocode({ address: location.address }, (results, status) => {
          if (status === "OK" && results && results[0]) {
            const position = results[0].geometry.location;
            addMarker(location, { lat: position.lat(), lng: position.lng() });
          }
        });
      }
    });

    function addMarker(location: MappedLocation, position: { lat: number; lng: number }) {
      const marker = new google.maps.Marker({
        position,
        map,
        title: location.businessName,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: location.scanCompleted ? "#10b981" : "#6366f1",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 10,
        },
      });

      marker.addListener("click", () => {
        setSelectedLocation(location);
        map.panTo(position);
        map.setZoom(12);
      });

      markersRef.current.push(marker);
    }
  }, [mapLoaded, locations, searchQuery, filterType]);

  // Get counts
  const completedCount = locations.filter((l) => l.scanCompleted).length;
  const pendingCount = locations.filter((l) => !l.scanCompleted).length;

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center">
          <p className="text-3xl font-bold text-indigo-600">{locations.length}</p>
          <p className="text-sm text-zinc-500">Total Locations</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center">
          <p className="text-3xl font-bold text-emerald-600">{completedCount}</p>
          <p className="text-sm text-zinc-500">Scans Completed</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center">
          <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
          <p className="text-sm text-zinc-500">In Progress</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 z-10" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search location..."
            defaultValue={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 pl-10 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                if (searchInputRef.current) {
                  searchInputRef.current.value = "";
                }
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10"
            >
              <X className="h-4 w-4 text-zinc-400 hover:text-zinc-600" />
            </button>
          )}
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {locationTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Map Container */}
      <div className="relative rounded-2xl border border-zinc-200 overflow-hidden bg-zinc-100">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        )}

        {mapError && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50 z-10">
            <MapPin className="h-12 w-12 text-zinc-300 mb-4" />
            <p className="text-zinc-500 text-sm">{mapError}</p>
            <p className="text-zinc-400 text-xs mt-1">Locations are listed below</p>
          </div>
        )}

        <div ref={mapRef} className="h-[500px] w-full" />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 rounded-xl bg-white/95 backdrop-blur-sm p-3 shadow-lg border border-zinc-200">
          <p className="text-xs font-semibold text-zinc-700 mb-2">Map Legend</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              <span className="text-xs text-zinc-600">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-indigo-500" />
              <span className="text-xs text-zinc-600">In Progress</span>
            </div>
          </div>
        </div>

        {/* Selected Location Info */}
        {selectedLocation && (
          <div className="absolute top-4 right-4 max-w-xs rounded-xl bg-white/95 backdrop-blur-sm p-4 shadow-lg border border-zinc-200">
            <button
              onClick={() => setSelectedLocation(null)}
              className="absolute top-2 right-2"
            >
              <X className="h-4 w-4 text-zinc-400 hover:text-zinc-600" />
            </button>
            <div className="pr-6">
              <h4 className="font-semibold text-zinc-900">{selectedLocation.businessName}</h4>
              <p className="text-sm text-zinc-500 mt-1">{selectedLocation.address}</p>
              {selectedLocation.city && selectedLocation.state && (
                <p className="text-sm text-zinc-500">
                  {selectedLocation.city}, {selectedLocation.state}
                </p>
              )}
              <div className="flex items-center gap-2 mt-3">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                    selectedLocation.scanCompleted
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {selectedLocation.scanCompleted ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      Completed
                    </>
                  ) : (
                    "In Progress"
                  )}
                </span>
                <span className="text-xs text-zinc-400 capitalize">
                  {selectedLocation.locationType}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Location List (Mobile-friendly) */}
      {locations.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50">
            <h3 className="font-semibold text-zinc-900">Recent Captures</h3>
          </div>
          <div className="divide-y divide-zinc-100 max-h-64 overflow-y-auto">
            {locations.slice(0, 10).map((location) => (
              <div
                key={location.id}
                className="px-4 py-3 flex items-center justify-between hover:bg-zinc-50 cursor-pointer transition-colors"
                onClick={() => setSelectedLocation(location)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      location.scanCompleted ? "bg-emerald-500" : "bg-indigo-500"
                    }`}
                  />
                  <div>
                    <p className="font-medium text-zinc-900 text-sm">{location.businessName}</p>
                    <p className="text-xs text-zinc-500">
                      {location.city && location.state
                        ? `${location.city}, ${location.state}`
                        : location.address.slice(0, 40)}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Main Page Component
export default function Capture() {
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-white font-sans text-zinc-900 selection:bg-zinc-100 selection:text-zinc-900">
      <DotPattern />

      <div className="mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <header className="mb-20">
          <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-zinc-600">
                  <Network className="h-3 w-3" />
                  BlueprintCapture
                </div>
                <h1 className="text-5xl font-bold tracking-tight text-zinc-950 sm:text-6xl">
                  On-demand capture <br />
                  for any location.
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-zinc-600">
                  A marketplace connecting <strong>people with smart glasses</strong> to{" "}
                  <strong>locations that need capture</strong>. We turn video walk-throughs into
                  simulation-ready 3D worlds and egocentric training data for robotics.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <Button
                  size="lg"
                  className="bg-zinc-900 hover:bg-zinc-800 text-white px-6"
                  onClick={() => setRequestDialogOpen(true)}
                >
                  Request a Location
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <a href="/contact">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-zinc-300 hover:bg-zinc-50 px-6 w-full sm:w-auto"
                  >
                    Become a Capture Provider
                  </Button>
                </a>
              </div>
            </div>

            {/* Value Prop Card */}
            <div className="relative rounded-3xl border border-zinc-200 bg-white p-8 shadow-lg">
              <div className="relative space-y-6">
                <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-900">
                      Why BlueprintCapture?
                    </h2>
                    <p className="text-xs text-zinc-500">The moat-building phase</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {whyItMatters.map((item) => (
                    <div key={item.title} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-zinc-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold text-zinc-900 text-sm">{item.title}</h3>
                        <p className="text-sm text-zinc-600">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* How It Works Section */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-md bg-zinc-100 px-2 py-1 text-xs font-bold uppercase tracking-wider text-zinc-700 mb-4">
              <Network className="h-3 w-3" /> How It Works
            </div>
            <h2 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
              GrubHub for spatial data.
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-zinc-600">
              We connect wearers with capture requests, creating a scalable pipeline for building the
              world's digital twin library.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {howItWorksSteps.map((step, index) => (
              <div
                key={step.title}
                className="relative rounded-2xl border border-zinc-200 bg-white p-6 transition-all hover:shadow-md hover:border-zinc-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                    {step.icon}
                  </div>
                  <span className="text-xs font-mono text-zinc-300">0{index + 1}</span>
                </div>
                <h3 className="mt-4 font-bold text-zinc-900">{step.title}</h3>
                <p className="mt-2 text-sm text-zinc-600">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Flywheel Section */}
        <section className="mb-20">
          <div className="rounded-3xl bg-zinc-900 p-8 sm:p-12 lg:p-16 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 -mt-20 -mr-20 h-80 w-80 rounded-full bg-zinc-700/30 blur-3xl" />

            <div className="relative z-10">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold sm:text-4xl text-white">The Network Effect</h2>
                <p className="mt-4 max-w-2xl mx-auto text-zinc-400">
                  Every capture strengthens the flywheel.
                </p>
              </div>

              <div className="grid gap-8 md:grid-cols-4 text-center">
                <div className="space-y-3">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-zinc-300">
                    <Users className="h-8 w-8" />
                  </div>
                  <h3 className="font-semibold text-white">More Buyers</h3>
                  <p className="text-sm text-zinc-400">Robotics teams need location-specific data</p>
                </div>
                <div className="space-y-3">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-zinc-300">
                    <Building2 className="h-8 w-8" />
                  </div>
                  <h3 className="font-semibold text-white">More Jobs</h3>
                  <p className="text-sm text-zinc-400">Capture requests drive demand</p>
                </div>
                <div className="space-y-3">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-zinc-300">
                    <Glasses className="h-8 w-8" />
                  </div>
                  <h3 className="font-semibold text-white">More Wearers</h3>
                  <p className="text-sm text-zinc-400">Earn by scanning in your area</p>
                </div>
                <div className="space-y-3">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-zinc-300">
                    <Globe className="h-8 w-8" />
                  </div>
                  <h3 className="font-semibold text-white">Better Coverage</h3>
                  <p className="text-sm text-zinc-400">Faster turnaround, more locations</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Map Section */}
        <section className="mb-20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md bg-zinc-100 px-2 py-1 text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">
                <MapPin className="h-3 w-3" /> Live Coverage
              </div>
              <h2 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
                Locations we've mapped.
              </h2>
              <p className="mt-2 text-zinc-600">
                Explore our growing library of SimReady locations across the US.
              </p>
            </div>
            <Button
              className="bg-zinc-900 hover:bg-zinc-800 text-white"
              onClick={() => setRequestDialogOpen(true)}
            >
              <MapPin className="mr-2 h-4 w-4" />
              Request Your Location
            </Button>
          </div>

          <CaptureMap />
        </section>

        {/* CTA Section */}
        <section className="rounded-3xl border border-zinc-200 bg-zinc-50 p-8 sm:p-12 lg:p-16 text-center">
          <h2 className="text-3xl font-bold text-zinc-900 sm:text-4xl mb-4">
            Need a specific location captured?
          </h2>
          <p className="text-lg text-zinc-600 max-w-2xl mx-auto mb-8">
            Whether it's a warehouse, retail floor, hospital, or campus—tell us what you need and
            we'll match you with a capture provider in your area.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-zinc-900 hover:bg-zinc-800 text-white px-8"
              onClick={() => setRequestDialogOpen(true)}
            >
              Request a Capture
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <a href="/contact">
              <Button
                size="lg"
                variant="outline"
                className="border-zinc-300 hover:bg-zinc-100 px-8 w-full sm:w-auto"
              >
                Talk to Sales
              </Button>
            </a>
          </div>
        </section>
      </div>

      {/* Request Location Dialog */}
      <RequestLocationDialog
        open={requestDialogOpen}
        onOpenChange={setRequestDialogOpen}
      />
    </div>
  );
}
