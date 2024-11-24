'use client'

import { useState, ChangeEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type FeatureDetails = {
  personalizedRecommendations: { enabled: boolean; crm: string };
  virtualTours: { enabled: boolean; tourUrl: string };
  loyaltyProgram: { enabled: boolean; programDetails: string };
  arVisualizations: { enabled: boolean; arModelUrls: string };
}

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
}
import { ChevronRight, ChevronLeft, Check, Building2, MapPin, Phone, Mail, Globe, Users, Palette, Cog } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const steps = [
  { id: 'business-info', title: 'Business Information', icon: Building2 },
  { id: 'location-details', title: 'Location Details', icon: MapPin },
  { id: 'contact-info', title: 'Contact Information', icon: Phone },
  { id: 'customization', title: 'AI Assistant', icon: Palette },
  { id: 'features', title: 'Blueprint Features', icon: Cog },
  { id: 'review', title: 'Review & Submit', icon: Check },
]

const aiProviders = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google AI' },
  { value: 'microsoft', label: 'Microsoft Azure AI' },
  { value: 'ibm', label: 'IBM Watson' },
  { value: 'amazon', label: 'Amazon Lex' },
]

export default function CreateBlueprint() {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<FormData>({
    businessName: '',
    businessType: '',
    locationName: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    phone: '',
    email: '',
    website: '',
    aiProvider: '',
    apiKey: '',
    features: {
      personalizedRecommendations: { enabled: false, crm: '' },
      virtualTours: { enabled: false, tourUrl: '' },
      loyaltyProgram: { enabled: false, programDetails: '' },
      arVisualizations: { enabled: false, arModelUrls: '' },
    },
  })

  const handleInputChange = (e: ChangeEvent<HTMLInputElement> | { target: { name: string; value: string } }) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleFeatureToggle = (feature: keyof FeatureDetails) => {
    setFormData((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: { ...prev.features[feature], enabled: !prev.features[feature].enabled },
      },
    }))
  }

  const handleFeatureDetailChange = (
    feature: keyof FeatureDetails,
    field: string,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: { ...prev.features[feature], [field]: value },
      },
    }))
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      // Here you would typically make an API call to create the blueprint
      console.log('Form submitted:', formData)
      const blueprintId = Date.now() // This would come from your API response
      
      toast({
        title: "Blueprint Created Successfully!",
        description: "You can now customize your Blueprint in the editor.",
      })
      
      // Redirect to the editor
      window.location.href = `/blueprint-editor/${blueprintId}`
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create Blueprint. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                name="businessName"
                value={formData.businessName}
                onChange={handleInputChange}
                placeholder="Enter your business name"
              />
            </div>
            <div>
              <Label htmlFor="businessType">Business Type</Label>
              <Select name="businessType" onValueChange={(value) => handleInputChange({ target: { name: 'businessType', value } })}>
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
        )
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
        )
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
        )
      case 3:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="aiProvider">AI Assistant Provider</Label>
              <Select name="aiProvider" onValueChange={(value) => handleInputChange({ target: { name: 'aiProvider', value } })}>
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
        )
      case 4:
        return (
          <div className="space-y-4">
            <Label>Select Blueprint Features</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(formData.features).map(([feature, { enabled, ...details }]) => (
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
                      {feature.split(/(?=[A-Z])/).join(' ')}
                    </Label>
                  </div>
                  {enabled && (
                    <div className="ml-6 space-y-2">
                      {feature === 'personalizedRecommendations' && (
                        <div>
                          <Label htmlFor={`${feature}-crm`}>Provide Blueprint / Floor Plan OR Scan</Label>
                          <Input
                            id={`${feature}-crm`}
                            value={details.crm}
                            onChange={(e) => handleFeatureDetailChange(feature, 'crm', e.target.value)}
                            placeholder="Upload Blueprint / Floor Plan OR Scan Your Location"
                          />
                        </div>
                      )}
                      {feature === 'virtualTours' && (
                        <div>
                          <Label htmlFor={`${feature}-tourUrl`}>Virtual Tour URL</Label>
                          <Input
                            id={`${feature}-tourUrl`}
                            value={details.tourUrl}
                            onChange={(e) => handleFeatureDetailChange(feature, 'tourUrl', e.target.value)}
                            placeholder="Please provide all relevant up-to-date information on your product catalog"
                          />
                        </div>
                      )}
                      {feature === 'loyaltyProgram' && (
                        <div>
                          <Label htmlFor={`${feature}-programDetails`}>Loyalty Program Details</Label>
                          <Textarea
                            id={`${feature}-programDetails`}
                            value={details.programDetails}
                            onChange={(e) => handleFeatureDetailChange(feature, 'programDetails', e.target.value)}
                            placeholder="Enter loyalty program details"
                          />
                        </div>
                      )}
                      {feature === 'arVisualizations' && (
                        <div>
                          <Label htmlFor={`${feature}-arModelUrls`}>AR Model URLs</Label>
                          <Textarea
                            id={`${feature}-arModelUrls`}
                            value={details.arModelUrls}
                            onChange={(e) => handleFeatureDetailChange(feature, 'arModelUrls', e.target.value)}
                            placeholder="Enter AR model URLs (one per line)"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      case 5:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Review Your Blueprint</h3>
            <div className="bg-gray-100 p-4 rounded-lg">
              <pre className="whitespace-pre-wrap">{JSON.stringify(formData, null, 2)}</pre>
            </div>
            <p className="text-sm text-gray-600">
              Please review your Blueprint details above. If everything looks correct, click 'Submit' to create your Blueprint.
            </p>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-blue-900 mb-8">Create Your Blueprint</h1>
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="p-6">
            <div className="flex justify-between items-center mb-8">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex flex-col items-center ${
                    index <= currentStep ? 'text-blue-600' : 'text-gray-400'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      index <= currentStep ? 'bg-blue-600 text-white' : 'bg-gray-200'
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
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {renderStep()}
                </motion.div>
              </AnimatePresence>
              <div className="mt-8 flex justify-between">
                <Button
                  type="button"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  variant="outline"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
                {currentStep < steps.length - 1 ? (
                  <Button type="button" onClick={handleNext}>
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button type="submit">Submit Blueprint</Button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
