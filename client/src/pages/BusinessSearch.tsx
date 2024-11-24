'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import { Building2, Search, MapPin, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Nav from "@/components/Nav"
import Footer from "@/components/Footer"

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export default function BusinessSearch() {
  const [searchQuery, setSearchQuery] = useState('')
  const [predictions, setPredictions] = useState<PlacePrediction[]>([])
  const [autocomplete, setAutocomplete] = useState<google.maps.places.AutocompleteService | null>(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initGooglePlaces = async () => {
      setInitializing(true)
      try {
        const loader = new Loader({
          apiKey: process.env.GOOGLE_PLACES_API_KEY!,
          version: "weekly",
          libraries: ["places"]
        })

        await loader.load()
        const autocompleteService = new google.maps.places.AutocompleteService()
        setAutocomplete(autocompleteService)
        setError(null)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
        setError(`Failed to initialize Google Places API: ${errorMessage}`)
        console.error('Error initializing Google Places:', err)
      } finally {
        setInitializing(false)
      }
    }

    initGooglePlaces()
  }, [])

  const handleSearch = useCallback(async (input: string) => {
    if (!autocomplete) {
      setError('Places service not initialized')
      return
    }
    
    if (input.length < 3) {
      setPredictions([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const request: google.maps.places.AutocompletionRequest = {
        input,
        types: ['establishment'],
        componentRestrictions: { country: 'us' }
      }

      const response = await autocomplete.getPlacePredictions(request)
      
      if (!response) {
        throw new Error('No response from Places API')
      }

      setPredictions(response.predictions.map(prediction => ({
        place_id: prediction.place_id,
        description: prediction.description,
        structured_formatting: {
          main_text: prediction.structured_formatting?.main_text || '',
          secondary_text: prediction.structured_formatting?.secondary_text || ''
        }
      })))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('Error fetching predictions:', error)
      setError(`Failed to fetch business suggestions: ${errorMessage}`)
      setPredictions([])
    } finally {
      setLoading(false)
    }
  }, [autocomplete])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, handleSearch])

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
              <CardTitle className="flex items-center">
                <Building2 className="w-6 h-6 mr-2" />
                Business Search
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
                    {initializing ? (
                      <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    ) : loading ? (
                      <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                    ) : (
                      <Search className="w-5 h-5 text-gray-400" />
                    )}
                    <Input
                      type="text"
                      placeholder={initializing ? "Initializing Places API..." : "Search for your business..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1"
                      disabled={initializing || loading}
                    />
                  </div>

                  {predictions.length > 0 && !loading && (
                    <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg">
                      <ul className="py-1">
                        {predictions.map((prediction) => (
                          <li
                            key={prediction.place_id}
                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-start"
                            onClick={() => {
                              setSearchQuery(prediction.description)
                              setPredictions([])
                            }}
                          >
                            <MapPin className="w-5 h-5 mr-2 mt-1 flex-shrink-0 text-gray-400" />
                            <div>
                              <div className="font-medium">{prediction.structured_formatting.main_text}</div>
                              <div className="text-sm text-gray-500">{prediction.structured_formatting.secondary_text}</div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  )
}
