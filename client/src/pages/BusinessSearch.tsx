"use client";

import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Loader } from "@googlemaps/js-api-loader";
import {
  Building2,
  Search,
  MapPin,
  AlertCircle,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { getGoogleMapsApiKey } from "@/lib/client-env";

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface BusinessDetails {
  hasBlueprint: boolean;
  name: string;
  address: string;
}

type LoaderStatus = "idle" | "loading" | "error" | "success";

export default function BusinessSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.AutocompleteService | null>(null);
  const [placesService, setPlacesService] =
    useState<google.maps.places.PlacesService | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaderStatus, setLoaderStatus] = useState<LoaderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedBusiness, setSelectedBusiness] =
    useState<BusinessDetails | null>(null);
  const { toast } = useToast();

  const initGooglePlaces = useCallback(async () => {
    setLoaderStatus("loading");
    setError(null);

    try {
      // Load API key from configuration
      const apiKey = getGoogleMapsApiKey();
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
      if (!autocompleteService) {
        throw new Error("Failed to initialize Places Autocomplete service");
      }

      // Initialize PlacesService with a dummy div (required by Google Maps)
      const placesDiv = document.createElement("div");
      const placesService = new google.maps.places.PlacesService(placesDiv);
      if (!placesService) {
        throw new Error("Failed to initialize Places service");
      }

      setAutocomplete(autocompleteService);
      setPlacesService(placesService);
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

  const handleSearch = useCallback(
    async (input: string) => {
      if (!autocomplete) {
        setError("Places service not initialized");
        return;
      }

      if (input.length < 3) {
        setPredictions([]);
        return;
      }

      setLoading(true);
      setError(null);
      // remove setSelectedBusiness(null);

      try {
        const request: google.maps.places.AutocompletionRequest = {
          input,
          componentRestrictions: { country: "us" },
        };

        const response = await new Promise<
          google.maps.places.AutocompletePrediction[]
        >((resolve, reject) => {
          autocomplete.getPlacePredictions(request, (predictions, status) => {
            if (
              status !== google.maps.places.PlacesServiceStatus.OK ||
              !predictions
            ) {
              reject(new Error(`Places API error: ${status}`));
              return;
            }
            resolve(predictions);
          });
        });

        setPredictions(
          response.map((prediction) => ({
            place_id: prediction.place_id,
            description: prediction.description,
            structured_formatting: {
              main_text: prediction.structured_formatting?.main_text || "",
              secondary_text:
                prediction.structured_formatting?.secondary_text || "",
            },
          })),
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        console.error("Error fetching predictions:", error);
        setError(`Failed to fetch business suggestions: ${errorMessage}`);
        setPredictions([]);

        toast({
          title: "Error",
          description:
            "Failed to fetch business suggestions. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [autocomplete, toast],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleSelectBusiness = useCallback(
    async (prediction: PlacePrediction) => {
      if (!placesService) return;

      setLoading(true);
      setError(null);

      try {
        const result = await new Promise<google.maps.places.PlaceResult>(
          (resolve, reject) => {
            placesService.getDetails(
              {
                placeId: prediction.place_id,
                fields: ["name", "formatted_address"],
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

        const address = result.formatted_address || "";
        // Query Firestore to see if a blueprint exists for this address
        const q = query(
          collection(db, "blueprints"),
          where("address", "==", address),
        );
        const querySnapshot = await getDocs(q);
        const hasBlueprint = !querySnapshot.empty;

        // Now we can setSelectedBusiness using the actual Firestore result instead of a simulated value
        setSelectedBusiness({
          name: result.name || "",
          address,
          hasBlueprint,
        });

        setSearchQuery(result.name || prediction.description);
        setPredictions([]);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        console.error("Error fetching business details:", error);
        setError(`Failed to fetch business details: ${errorMessage}`);

        toast({
          title: "Error",
          description: "Failed to fetch business details. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [placesService, toast],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-white">
      <Nav />
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900">
              Find Your Business
            </h1>
            <p className="mt-4 text-xl text-gray-500">
              Search for your business to claim or create a Blueprint
            </p>
          </div>

          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Building2 className="w-6 h-6 mr-2" />
                  Business Search
                </div>
                {loaderStatus === "error" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => initGooglePlaces()}
                    className="flex items-center space-x-2"
                  >
                    <RefreshCcw className="w-4 h-4 mr-1" />
                    Retry
                  </Button>
                )}
              </CardTitle>
              <CardDescription>
                Enter your business name or address to get started
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="relative">
                  <div className="flex items-center space-x-2">
                    {loaderStatus === "loading" ? (
                      <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    ) : loading ? (
                      <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                    ) : (
                      <Search className="w-5 h-5 text-gray-400" />
                    )}
                    <Input
                      type="text"
                      placeholder={
                        loaderStatus === "loading"
                          ? "Initializing Places API..."
                          : "Search for your business..."
                      }
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1"
                      disabled={loaderStatus !== "success"} // Removed '|| loading' here
                    />
                  </div>

                  {predictions.length > 0 && !loading && (
                    <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg">
                      <ul className="py-1">
                        {predictions.map((prediction) => (
                          <li
                            key={prediction.place_id}
                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-start"
                            onClick={() => handleSelectBusiness(prediction)}
                          >
                            <MapPin className="w-5 h-5 mr-2 mt-1 flex-shrink-0 text-gray-400" />
                            <div>
                              <div className="font-medium">
                                {prediction.structured_formatting.main_text}
                              </div>
                              <div className="text-sm text-gray-500">
                                {
                                  prediction.structured_formatting
                                    .secondary_text
                                }
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {selectedBusiness && (
                  <Card className="mt-4">
                    <CardContent className="pt-6">
                      <h3 className="text-lg font-semibold mb-2">
                        {selectedBusiness.name}
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">
                        {selectedBusiness.address}
                      </p>
                      {selectedBusiness.hasBlueprint ? (
                        <div className="flex flex-col space-y-4">
                          <Alert>
                            <AlertDescription className="flex items-center">
                              <span className="text-green-600 font-medium">
                                Blueprint Found!
                              </span>
                            </AlertDescription>
                          </Alert>
                          <Link
                            href={`/claim-blueprint?data=${encodeURIComponent(
                              JSON.stringify({
                                name: selectedBusiness.name,
                                address: selectedBusiness.address,
                              }),
                            )}`}
                          >
                            <Button className="w-full">
                              Claim Existing Blueprint
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        <div className="flex flex-col space-y-4">
                          <Alert>
                            <AlertDescription>
                              No Blueprint found for this business.
                            </AlertDescription>
                          </Alert>
                          <Link
                            href={`/create-blueprint?data=${encodeURIComponent(
                              JSON.stringify({
                                name: selectedBusiness.name,
                                address: selectedBusiness.address,
                              }),
                            )}`}
                          >
                            <Button className="w-full">
                              Create New Blueprint
                            </Button>
                          </Link>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
}
