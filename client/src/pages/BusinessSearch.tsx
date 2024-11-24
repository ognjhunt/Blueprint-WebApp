'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import { Building2, Search, MapPin } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Nav from "@/components/Nav"
import Footer from "@/components/Footer"

export default function BusinessSearch() {
  const [searchQuery, setSearchQuery] = useState('')
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([])
  const [autocomplete, setAutocomplete] = useState<google.maps.places.AutocompleteService | null>(null)

  useEffect(() => {
    const loader = new Loader({
      apiKey: import.meta.env.VITE_GOOGLE_PLACES_API_KEY!,
      version: "weekly",
      libraries: ["places"]
    })

    loader.load().then(() => {
      setAutocomplete(new google.maps.places.AutocompleteService())
    })
  }, [])

  const handleSearch = useCallback(async (input: string) => {
    if (!autocomplete || input.length < 3) {
      setPredictions([])
      return
    }

    try {
      const response = await autocomplete.getPlacePredictions({
        input,
        types: ['establishment'],
        componentRestrictions: { country: 'us' }
      })
      setPredictions(response?.predictions || [])
    } catch (error) {
      console.error('Error fetching predictions:', error)
      setPredictions([])
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
              <div className="relative">
                <div className="flex items-center space-x-2">
                  <Search className="w-5 h-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search for your business..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                </div>

                {predictions.length > 0 && (
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
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  )
}
