'use client'

import { useState, useEffect, ChangeEvent } from 'react'
import { useToast } from "@/hooks/use-toast"
import { motion, AnimatePresence } from 'framer-motion'

type FeatureDetail = {
  crm?: string;
  tourUrl?: string;
  programDetails?: string;
  arModelUrls?: string;
}

interface BaseFeatureDetail {
  enabled: boolean;
  details: FeatureDetail;
}

type FeatureDetails = {
  [key: string]: BaseFeatureDetail;
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
  qrCode: {
    placements: {
      entrance: boolean;
      checkout: boolean;
      productDisplays: boolean;
      custom: string;
    };
    shipping: {
      useBusinessAddress: boolean;
      address: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
      speed: 'standard' | 'express' | 'overnight';
      specialInstructions: string;
    };
    setup: {
      needsAssistance: boolean;
      preferredDate: string;
      preferredTimeSlot: string;
      requirements: string;
    };
  };
}
import { ChevronRight, ChevronLeft, Check, Building2, MapPin, Phone, Mail, Globe, Users, Palette, Cog, QrCode } from 'lucide-react'
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
  { id: 'qr-code', title: 'QR Code Info', icon: QrCode },
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
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  type FormDataWithId = FormData & { blueprintId?: string };
  
  const [formData, setFormData] = useState<FormDataWithId>({
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
      personalizedRecommendations: { enabled: false, details: { crm: '' } },
      virtualTours: { enabled: false, details: { tourUrl: '' } },
      loyaltyProgram: { enabled: false, details: { programDetails: '' } },
      arVisualizations: { enabled: false, details: { arModelUrls: '' } },
    },
    qrCode: {
      placements: {
        entrance: false,
        checkout: false,
        productDisplays: false,
        custom: '',
      },
      shipping: {
        useBusinessAddress: true,
        address: '',
        city: '',
        state: '',
        zipCode: '',
        country: '',
        speed: 'standard',
        specialInstructions: '',
      },
      setup: {
        needsAssistance: false,
        preferredDate: '',
        preferredTimeSlot: '',
        requirements: '',
      },
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

  type FeatureDetailType = {
    crm: string;
    tourUrl: string;
    programDetails: string;
    arModelUrls: string;
  }

  const handleFeatureDetailChange = (
    feature: string,
    field: keyof FeatureDetail,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: {
          ...prev.features[feature],
          details: {
            ...prev.features[feature].details,
            [field]: value
          }
        },
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

  const validateQRCodeSection = () => {
    // Check if at least one placement location is selected
    const hasPlacement = Object.values(formData.qrCode.placements).some(value => {
      if (typeof value === 'boolean') return value;
      return value.length > 0; // For custom placement
    });

    if (!hasPlacement) {
      toast({
        title: "Validation Error",
        description: "Please select at least one QR code placement location.",
        variant: "destructive",
      });
      return false;
    }

    // Validate shipping information
    if (!formData.qrCode.shipping.useBusinessAddress) {
      const { address, city, state, zipCode, country } = formData.qrCode.shipping;
      if (!address || !city || !state || !zipCode || !country) {
        toast({
          title: "Validation Error",
          description: "Please complete all shipping address fields.",
          variant: "destructive",
        });
        return false;
      }
    }

    // Validate setup assistance if needed
    if (formData.qrCode.setup.needsAssistance) {
      const { preferredDate, preferredTimeSlot } = formData.qrCode.setup;
      if (!preferredDate || !preferredTimeSlot) {
        toast({
          title: "Validation Error",
          description: "Please select preferred date and time slot for setup assistance.",
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (currentStep === steps.length - 1) {
      if (!validateQRCodeSection()) {
        return;
      }

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
        const existingBlueprints = JSON.parse(localStorage.getItem('blueprints') || '[]');
        localStorage.setItem('blueprints', JSON.stringify([...existingBlueprints, blueprintData]));
        
        toast({
          title: "Blueprint Created Successfully!",
          description: "Your Blueprint has been created with QR code specifications. Redirecting to editor...",
        });
        
        // Store blueprintId in state for navigation
        setFormData(prev => ({ ...prev, blueprintId }));

        // Redirect to blueprint editor after short delay
        setTimeout(() => {
          window.location.href = `/blueprint-editor/${blueprintId}`;
        }, 2000);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to create Blueprint. Please try again.",
          variant: "destructive",
        });
        console.error('Error creating blueprint:', error);
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
                            value={formData.features[feature].details.crm || ''}
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
                            value={formData.features[feature].details.tourUrl || ''}
                            onChange={(e) => handleFeatureDetailChange(feature, 'tourUrl', e.target.value)}
                            placeholder="Please provide all relevant up-to-date information on your product catalog"
                          />
                        </div>
                      )}
                      {feature === 'loyaltyProgram' && (
                        <div>
                          <Label htmlFor={`${feature}-programDetails`}>Loyalty Program Details</Label>
                          <Input
                            id={`${feature}-programDetails`}
                            value={formData.features[feature].details.programDetails || ''}
                            onChange={(e) => handleFeatureDetailChange(feature, 'programDetails', e.target.value)}
                            placeholder="Describe your loyalty program"
                          />
                        </div>
                      )}
                      {feature === 'arVisualizations' && (
                        <div>
                          <Label htmlFor={`${feature}-arModelUrls`}>AR Model URLs</Label>
                          <Input
                            id={`${feature}-arModelUrls`}
                            value={formData.features[feature].details.arModelUrls || ''}
                            onChange={(e) => handleFeatureDetailChange(feature, 'arModelUrls', e.target.value)}
                            placeholder="Enter AR model URLs (comma-separated)"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <div className="text-center mb-6">
                <QrCode className="w-12 h-12 mx-auto mb-4 text-primary" />
                <h4 className="text-xl font-semibold mb-2">Your Blueprint QR Code</h4>
                <p className="text-gray-600">Choose where you'd like to place your QR codes and how you'd like them delivered.</p>
              </div>

              {/* QR Code Placement Section */}
              <div className="space-y-4 mb-8">
                <h5 className="font-semibold">QR Code Placement</h5>
                <div className="space-y-2">
                  {['entrance', 'checkout', 'productDisplays'].map((location) => (
                    <div key={location} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`placement-${location}`}
                        checked={formData.qrCode.placements[location as keyof typeof formData.qrCode.placements]}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            placements: {
                              ...prev.qrCode.placements,
                              [location]: e.target.checked
                            }
                          }
                        }))}
                        className="w-4 h-4 mr-2"
                      />
                      <Label htmlFor={`placement-${location}`}>
                        {location.replace(/([A-Z])/g, ' $1').charAt(0).toUpperCase() + location.replace(/([A-Z])/g, ' $1').slice(1)}
                      </Label>
                    </div>
                  ))}
                  <div>
                    <Label htmlFor="custom-placement">Custom Location</Label>
                    <Input
                      id="custom-placement"
                      value={formData.qrCode.placements.custom}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        qrCode: {
                          ...prev.qrCode,
                          placements: {
                            ...prev.qrCode.placements,
                            custom: e.target.value
                          }
                        }
                      }))}
                      placeholder="Specify other placement locations"
                    />
                  </div>
                </div>
              </div>

              {/* Shipping Information Section */}
              <div className="space-y-4 mb-8">
                <h5 className="font-semibold">Shipping Information</h5>
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="use-business-address"
                    checked={formData.qrCode.shipping.useBusinessAddress}
                    onChange={(e) => {
                      const useBusinessAddress = e.target.checked;
                      setFormData(prev => ({
                        ...prev,
                        qrCode: {
                          ...prev.qrCode,
                          shipping: {
                            ...prev.qrCode.shipping,
                            useBusinessAddress,
                            address: useBusinessAddress ? prev.address : '',
                            city: useBusinessAddress ? prev.city : '',
                            state: useBusinessAddress ? prev.state : '',
                            zipCode: useBusinessAddress ? prev.zipCode : '',
                            country: useBusinessAddress ? prev.country : ''
                          }
                        }
                      }));
                    }}
                    className="w-4 h-4 mr-2"
                  />
                  <Label htmlFor="use-business-address">Use business address</Label>
                </div>

                {!formData.qrCode.shipping.useBusinessAddress && (
                  <div className="space-y-4">
                    <Input
                      placeholder="Address"
                      value={formData.qrCode.shipping.address}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        qrCode: {
                          ...prev.qrCode,
                          shipping: {
                            ...prev.qrCode.shipping,
                            address: e.target.value
                          }
                        }
                      }))}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        placeholder="City"
                        value={formData.qrCode.shipping.city}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            shipping: {
                              ...prev.qrCode.shipping,
                              city: e.target.value
                            }
                          }
                        }))}
                      />
                      <Input
                        placeholder="State"
                        value={formData.qrCode.shipping.state}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            shipping: {
                              ...prev.qrCode.shipping,
                              state: e.target.value
                            }
                          }
                        }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        placeholder="ZIP Code"
                        value={formData.qrCode.shipping.zipCode}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            shipping: {
                              ...prev.qrCode.shipping,
                              zipCode: e.target.value
                            }
                          }
                        }))}
                      />
                      <Input
                        placeholder="Country"
                        value={formData.qrCode.shipping.country}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            shipping: {
                              ...prev.qrCode.shipping,
                              country: e.target.value
                            }
                          }
                        }))}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Label>Shipping Speed</Label>
                  <Select
                    value={formData.qrCode.shipping.speed}
                    onValueChange={(value: 'standard' | 'express' | 'overnight') => setFormData(prev => ({
                      ...prev,
                      qrCode: {
                        ...prev.qrCode,
                        shipping: {
                          ...prev.qrCode.shipping,
                          speed: value
                        }
                      }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select shipping speed" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard (5-7 business days)</SelectItem>
                      <SelectItem value="express">Express (2-3 business days)</SelectItem>
                      <SelectItem value="overnight">Overnight</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="special-instructions">Special Handling Instructions</Label>
                  <Textarea
                    id="special-instructions"
                    value={formData.qrCode.shipping.specialInstructions}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      qrCode: {
                        ...prev.qrCode,
                        shipping: {
                          ...prev.qrCode.shipping,
                          specialInstructions: e.target.value
                        }
                      }
                    }))}
                    placeholder="Any special handling instructions..."
                  />
                </div>
              </div>

              {/* Setup Assistance Section */}
              <div className="space-y-4">
                <h5 className="font-semibold">Setup Assistance</h5>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="needs-assistance"
                    checked={formData.qrCode.setup.needsAssistance}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      qrCode: {
                        ...prev.qrCode,
                        setup: {
                          ...prev.qrCode.setup,
                          needsAssistance: e.target.checked
                        }
                      }
                    }))}
                    className="w-4 h-4 mr-2"
                  />
                  <Label htmlFor="needs-assistance">I need help with installation</Label>
                </div>

                {formData.qrCode.setup.needsAssistance && (
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="preferred-date">Preferred Date</Label>
                      <Input
                        type="date"
                        id="preferred-date"
                        value={formData.qrCode.setup.preferredDate}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            setup: {
                              ...prev.qrCode.setup,
                              preferredDate: e.target.value
                            }
                          }
                        }))}
                      />
                    </div>

                    <div>
                      <Label>Preferred Time Slot</Label>
                      <Select
                        value={formData.qrCode.setup.preferredTimeSlot}
                        onValueChange={(value) => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            setup: {
                              ...prev.qrCode.setup,
                              preferredTimeSlot: value
                            }
                          }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select time slot" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="morning">Morning (9 AM - 12 PM)</SelectItem>
                          <SelectItem value="afternoon">Afternoon (12 PM - 4 PM)</SelectItem>
                          <SelectItem value="evening">Evening (4 PM - 7 PM)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="setup-requirements">Specific Requirements</Label>
                      <Textarea
                        id="setup-requirements"
                        value={formData.qrCode.setup.requirements}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            setup: {
                              ...prev.qrCode.setup,
                              requirements: e.target.value
                            }
                          }
                        }))}
                        placeholder="Any specific requirements or concerns..."
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
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
            <h2 className="text-2xl font-bold">Review Your Blueprint</h2>
            <p className="text-muted-foreground">Please review your information before proceeding to QR code setup.</p>
            
            <div className="space-y-6">
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Business Information</h3>
                <p>Name: {formData.businessName}</p>
                <p>Type: {formData.businessType}</p>
              </div>
              
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Location Details</h3>
                <p>{formData.address}</p>
                <p>{formData.city}, {formData.state} {formData.zipCode}</p>
                <p>{formData.country}</p>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Contact Information</h3>
                <p>Phone: {formData.phone}</p>
                <p>Email: {formData.email}</p>
                <p>Website: {formData.website}</p>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Selected Features</h3>
                <ul className="list-disc list-inside">
                  {Object.entries(formData.features)
                    .filter(([, { enabled }]) => enabled)
                    .map(([feature]) => (
                      <li key={feature}>{feature.split(/(?=[A-Z])/).join(' ')}</li>
                    ))}
                </ul>
              </div>
            </div>
          </div>
        )
      case 6:
        return (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <div className="text-center mb-6">
                <QrCode className="w-12 h-12 mx-auto mb-4 text-primary" />
                <h4 className="text-xl font-semibold mb-2">Your Blueprint QR Code</h4>
                <p className="text-gray-600">Choose where you'd like to place your QR codes and how you'd like them delivered.</p>
              </div>

              {/* QR Code Placement Section */}
              <div className="space-y-4 mb-8">
                <h5 className="font-semibold">QR Code Placement</h5>
                <div className="space-y-2">
                  {['entrance', 'checkout', 'productDisplays'].map((location) => (
                    <div key={location} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`placement-${location}`}
                        checked={formData.qrCode.placements[location as keyof typeof formData.qrCode.placements]}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            placements: {
                              ...prev.qrCode.placements,
                              [location]: e.target.checked
                            }
                          }
                        }))}
                        className="w-4 h-4 mr-2"
                      />
                      <Label htmlFor={`placement-${location}`}>
                        {location.replace(/([A-Z])/g, ' $1').charAt(0).toUpperCase() + location.replace(/([A-Z])/g, ' $1').slice(1)}
                      </Label>
                    </div>
                  ))}
                  <div>
                    <Label htmlFor="custom-placement">Custom Location</Label>
                    <Input
                      id="custom-placement"
                      value={formData.qrCode.placements.custom}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        qrCode: {
                          ...prev.qrCode,
                          placements: {
                            ...prev.qrCode.placements,
                            custom: e.target.value
                          }
                        }
                      }))}
                      placeholder="Specify other placement locations"
                    />
                  </div>
                </div>
              </div>

              {/* Shipping Information Section */}
              <div className="space-y-4 mb-8">
                <h5 className="font-semibold">Shipping Information</h5>
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="use-business-address"
                    checked={formData.qrCode.shipping.useBusinessAddress}
                    onChange={(e) => {
                      const useBusinessAddress = e.target.checked;
                      setFormData(prev => ({
                        ...prev,
                        qrCode: {
                          ...prev.qrCode,
                          shipping: {
                            ...prev.qrCode.shipping,
                            useBusinessAddress,
                            address: useBusinessAddress ? prev.address : '',
                            city: useBusinessAddress ? prev.city : '',
                            state: useBusinessAddress ? prev.state : '',
                            zipCode: useBusinessAddress ? prev.zipCode : '',
                            country: useBusinessAddress ? prev.country : ''
                          }
                        }
                      }));
                    }}
                    className="w-4 h-4 mr-2"
                  />
                  <Label htmlFor="use-business-address">Use business address</Label>
                </div>

                {!formData.qrCode.shipping.useBusinessAddress && (
                  <div className="space-y-4">
                    <Input
                      placeholder="Address"
                      value={formData.qrCode.shipping.address}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        qrCode: {
                          ...prev.qrCode,
                          shipping: {
                            ...prev.qrCode.shipping,
                            address: e.target.value
                          }
                        }
                      }))}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        placeholder="City"
                        value={formData.qrCode.shipping.city}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            shipping: {
                              ...prev.qrCode.shipping,
                              city: e.target.value
                            }
                          }
                        }))}
                      />
                      <Input
                        placeholder="State"
                        value={formData.qrCode.shipping.state}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            shipping: {
                              ...prev.qrCode.shipping,
                              state: e.target.value
                            }
                          }
                        }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        placeholder="ZIP Code"
                        value={formData.qrCode.shipping.zipCode}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            shipping: {
                              ...prev.qrCode.shipping,
                              zipCode: e.target.value
                            }
                          }
                        }))}
                      />
                      <Input
                        placeholder="Country"
                        value={formData.qrCode.shipping.country}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            shipping: {
                              ...prev.qrCode.shipping,
                              country: e.target.value
                            }
                          }
                        }))}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Label>Shipping Speed</Label>
                  <Select
                    value={formData.qrCode.shipping.speed}
                    onValueChange={(value: 'standard' | 'express' | 'overnight') => setFormData(prev => ({
                      ...prev,
                      qrCode: {
                        ...prev.qrCode,
                        shipping: {
                          ...prev.qrCode.shipping,
                          speed: value
                        }
                      }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select shipping speed" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard (5-7 business days)</SelectItem>
                      <SelectItem value="express">Express (2-3 business days)</SelectItem>
                      <SelectItem value="overnight">Overnight</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="special-instructions">Special Handling Instructions</Label>
                  <Textarea
                    id="special-instructions"
                    value={formData.qrCode.shipping.specialInstructions}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      qrCode: {
                        ...prev.qrCode,
                        shipping: {
                          ...prev.qrCode.shipping,
                          specialInstructions: e.target.value
                        }
                      }
                    }))}
                    placeholder="Any special handling instructions..."
                  />
                </div>
              </div>

              {/* Setup Assistance Section */}
              <div className="space-y-4">
                <h5 className="font-semibold">Setup Assistance</h5>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="needs-assistance"
                    checked={formData.qrCode.setup.needsAssistance}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      qrCode: {
                        ...prev.qrCode,
                        setup: {
                          ...prev.qrCode.setup,
                          needsAssistance: e.target.checked
                        }
                      }
                    }))}
                    className="w-4 h-4 mr-2"
                  />
                  <Label htmlFor="needs-assistance">I need help with installation</Label>
                </div>

                {formData.qrCode.setup.needsAssistance && (
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="preferred-date">Preferred Date</Label>
                      <Input
                        type="date"
                        id="preferred-date"
                        value={formData.qrCode.setup.preferredDate}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            setup: {
                              ...prev.qrCode.setup,
                              preferredDate: e.target.value
                            }
                          }
                        }))}
                      />
                    </div>

                    <div>
                      <Label>Preferred Time Slot</Label>
                      <Select
                        value={formData.qrCode.setup.preferredTimeSlot}
                        onValueChange={(value) => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            setup: {
                              ...prev.qrCode.setup,
                              preferredTimeSlot: value
                            }
                          }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select time slot" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="morning">Morning (9 AM - 12 PM)</SelectItem>
                          <SelectItem value="afternoon">Afternoon (12 PM - 4 PM)</SelectItem>
                          <SelectItem value="evening">Evening (4 PM - 7 PM)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="setup-requirements">Specific Requirements</Label>
                      <Textarea
                        id="setup-requirements"
                        value={formData.qrCode.setup.requirements}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            setup: {
                              ...prev.qrCode.setup,
                              requirements: e.target.value
                            }
                          }
                        }))}
                        placeholder="Any specific requirements or concerns..."
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }
                      {feature === 'loyaltyProgram' && (
                        <div>
                          <Label htmlFor={`${feature}-programDetails`}>Loyalty Program Details</Label>
                          <Textarea
                            id={`${feature}-programDetails`}
                            value={formData.features[feature].details.programDetails || ''}
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
                            value={formData.features[feature].details.arModelUrls || ''}
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
              Please review your Blueprint details above. If everything looks correct, click 'Next' to proceed to QR code generation.
            </p>
          </div>
        )
      case 6:
        return (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <div className="space-y-8">
                {/* QR Code Placement Section */}
                <div>
                  <h4 className="text-xl font-semibold mb-4">QR Code Placement</h4>
                  <p className="text-gray-600 mb-4">Select where you plan to display your Blueprint QR codes:</p>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      {['entrance', 'checkout', 'productDisplays'].map((location) => (
                        <div key={location} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`placement-${location}`}
                            checked={formData.qrCode.placements[location as keyof typeof formData.qrCode.placements]}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              qrCode: {
                                ...prev.qrCode,
                                placements: {
                                  ...prev.qrCode.placements,
                                  [location]: e.target.checked
                                }
                              }
                            }))}
                            className="w-4 h-4 mr-2"
                          />
                          <Label htmlFor={`placement-${location}`}>
                            {location.replace(/([A-Z])/g, ' $1').charAt(0).toUpperCase() + location.replace(/([A-Z])/g, ' $1').slice(1)}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <div>
                      <Label htmlFor="custom-placement">Custom Location</Label>
                      <Input
                        id="custom-placement"
                        value={formData.qrCode.placements.custom}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            placements: {
                              ...prev.qrCode.placements,
                              custom: e.target.value
                            }
                          }
                        }))}
                        placeholder="Specify other placement locations"
                      />
                    </div>
                  </div>
                </div>

                {/* Shipping Information Section */}
                <div>
                  <h4 className="text-xl font-semibold mb-4">Shipping Information</h4>
                  <div className="space-y-4">
                    <div className="flex items-center mb-4">
                      <input
                        type="checkbox"
                        id="use-business-address"
                        checked={formData.qrCode.shipping.useBusinessAddress}
                        onChange={(e) => {
                          const useBusinessAddress = e.target.checked;
                          setFormData(prev => ({
                            ...prev,
                            qrCode: {
                              ...prev.qrCode,
                              shipping: {
                                ...prev.qrCode.shipping,
                                useBusinessAddress,
                                address: useBusinessAddress ? prev.address : '',
                                city: useBusinessAddress ? prev.city : '',
                                state: useBusinessAddress ? prev.state : '',
                                zipCode: useBusinessAddress ? prev.zipCode : '',
                                country: useBusinessAddress ? prev.country : ''
                              }
                            }
                          }));
                        }}
                        className="w-4 h-4 mr-2"
                      />
                      <Label htmlFor="use-business-address">Use business address</Label>
                    </div>

                    {!formData.qrCode.shipping.useBusinessAddress && (
                      <div className="space-y-4">
                        <Input
                          placeholder="Address"
                          value={formData.qrCode.shipping.address}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            qrCode: {
                              ...prev.qrCode,
                              shipping: {
                                ...prev.qrCode.shipping,
                                address: e.target.value
                              }
                            }
                          }))}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <Input
                            placeholder="City"
                            value={formData.qrCode.shipping.city}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              qrCode: {
                                ...prev.qrCode,
                                shipping: {
                                  ...prev.qrCode.shipping,
                                  city: e.target.value
                                }
                              }
                            }))}
                          />
                          <Input
                            placeholder="State"
                            value={formData.qrCode.shipping.state}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              qrCode: {
                                ...prev.qrCode,
                                shipping: {
                                  ...prev.qrCode.shipping,
                                  state: e.target.value
                                }
                              }
                            }))}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <Input
                            placeholder="ZIP Code"
                            value={formData.qrCode.shipping.zipCode}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              qrCode: {
                                ...prev.qrCode,
                                shipping: {
                                  ...prev.qrCode.shipping,
                                  zipCode: e.target.value
                                }
                              }
                            }))}
                          />
                          <Input
                            placeholder="Country"
                            value={formData.qrCode.shipping.country}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              qrCode: {
                                ...prev.qrCode,
                                shipping: {
                                  ...prev.qrCode.shipping,
                                  country: e.target.value
                                }
                              }
                            }))}
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <Label>Shipping Speed</Label>
                      <Select
                        value={formData.qrCode.shipping.speed}
                        onValueChange={(value: 'standard' | 'express' | 'overnight') => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            shipping: {
                              ...prev.qrCode.shipping,
                              speed: value
                            }
                          }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select shipping speed" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard (5-7 business days)</SelectItem>
                          <SelectItem value="express">Express (2-3 business days)</SelectItem>
                          <SelectItem value="overnight">Overnight</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="special-instructions">Special Handling Instructions</Label>
                      <Textarea
                        id="special-instructions"
                        value={formData.qrCode.shipping.specialInstructions}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            shipping: {
                              ...prev.qrCode.shipping,
                              specialInstructions: e.target.value
                            }
                          }
                        }))}
                        placeholder="Any special handling instructions..."
                      />
                    </div>
                  </div>
                </div>

                {/* Setup Assistance Section */}
                <div>
                  <h4 className="text-xl font-semibold mb-4">Setup Assistance</h4>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="needs-assistance"
                        checked={formData.qrCode.setup.needsAssistance}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            setup: {
                              ...prev.qrCode.setup,
                              needsAssistance: e.target.checked
                            }
                          }
                        }))}
                        className="w-4 h-4 mr-2"
                      />
                      <Label htmlFor="needs-assistance">I need help with installation</Label>
                    </div>

                    {formData.qrCode.setup.needsAssistance && (
                      <>
                        <div>
                          <Label htmlFor="preferred-date">Preferred Date</Label>
                          <Input
                            type="date"
                            id="preferred-date"
                            value={formData.qrCode.setup.preferredDate}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              qrCode: {
                                ...prev.qrCode,
                                setup: {
                                  ...prev.qrCode.setup,
                                  preferredDate: e.target.value
                                }
                              }
                            }))}
                          />
                        </div>

                        <div>
                          <Label>Preferred Time Slot</Label>
                          <Select
                            value={formData.qrCode.setup.preferredTimeSlot}
                            onValueChange={(value) => setFormData(prev => ({
                              ...prev,
                              qrCode: {
                                ...prev.qrCode,
                                setup: {
                                  ...prev.qrCode.setup,
                                  preferredTimeSlot: value
                                }
                              }
                            }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select time slot" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="morning">Morning (9 AM - 12 PM)</SelectItem>
                              <SelectItem value="afternoon">Afternoon (12 PM - 4 PM)</SelectItem>
                              <SelectItem value="evening">Evening (4 PM - 7 PM)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="setup-requirements">Specific Requirements</Label>
                          <Textarea
                            id="setup-requirements"
                            value={formData.qrCode.setup.requirements}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              qrCode: {
                                ...prev.qrCode,
                                setup: {
                                  ...prev.qrCode.setup,
                                  requirements: e.target.value
                                }
                              }
                            }))}
                            placeholder="Any specific requirements or concerns..."
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
                    <div className="space-y-2">
                      {['entrance', 'checkout', 'productDisplays'].map((location) => (
                        <div key={location} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`placement-${location}`}
                            checked={formData.qrCode.placements[location as keyof typeof formData.qrCode.placements]}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              qrCode: {
                                ...prev.qrCode,
                                placements: {
                                  ...prev.qrCode.placements,
                                  [location]: e.target.checked
                                }
                              }
                            }))}
                            className="w-4 h-4 mr-2"
                          />
                          <Label htmlFor={`placement-${location}`}>
                            {location.replace(/([A-Z])/g, ' $1').trim()}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <div>
                      <Label htmlFor="custom-placement">Custom Location</Label>
                      <Input
                        id="custom-placement"
                        value={formData.qrCode.placements.custom}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            placements: {
                              ...prev.qrCode.placements,
                              custom: e.target.value
                            }
                          }
                        }))}
                        placeholder="Specify other placement locations"
                      />
                    </div>
                  </div>
                </div>

                {/* Shipping Information Section */}
                <div>
                  <h4 className="text-xl font-semibold mb-4">Shipping Information</h4>
                  <div className="space-y-4">
                    <div className="flex items-center mb-4">
                      <input
                        type="checkbox"
                        id="use-business-address"
                        checked={formData.qrCode.shipping.useBusinessAddress}
                        onChange={(e) => {
                          const useBusinessAddress = e.target.checked;
                          setFormData(prev => ({
                            ...prev,
                            qrCode: {
                              ...prev.qrCode,
                              shipping: {
                                ...prev.qrCode.shipping,
                                useBusinessAddress,
                                address: useBusinessAddress ? prev.address : '',
                                city: useBusinessAddress ? prev.city : '',
                                state: useBusinessAddress ? prev.state : '',
                                zipCode: useBusinessAddress ? prev.zipCode : '',
                                country: useBusinessAddress ? prev.country : '',
                              }
                            }
                          }))
                        }}
                        className="w-4 h-4 mr-2"
                      />
                      <Label htmlFor="use-business-address">Use business address</Label>
                    </div>

                    {!formData.qrCode.shipping.useBusinessAddress && (
                      <div className="space-y-4">
                        <Input
                          placeholder="Address"
                          value={formData.qrCode.shipping.address}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            qrCode: {
                              ...prev.qrCode,
                              shipping: {
                                ...prev.qrCode.shipping,
                                address: e.target.value
                              }
                            }
                          }))}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <Input
                            placeholder="City"
                            value={formData.qrCode.shipping.city}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              qrCode: {
                                ...prev.qrCode,
                                shipping: {
                                  ...prev.qrCode.shipping,
                                  city: e.target.value
                                }
                              }
                            }))}
                          />
                          <Input
                            placeholder="State"
                            value={formData.qrCode.shipping.state}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              qrCode: {
                                ...prev.qrCode,
                                shipping: {
                                  ...prev.qrCode.shipping,
                                  state: e.target.value
                                }
                              }
                            }))}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <Input
                            placeholder="ZIP Code"
                            value={formData.qrCode.shipping.zipCode}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              qrCode: {
                                ...prev.qrCode,
                                shipping: {
                                  ...prev.qrCode.shipping,
                                  zipCode: e.target.value
                                }
                              }
                            }))}
                          />
                          <Input
                            placeholder="Country"
                            value={formData.qrCode.shipping.country}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              qrCode: {
                                ...prev.qrCode,
                                shipping: {
                                  ...prev.qrCode.shipping,
                                  country: e.target.value
                                }
                              }
                            }))}
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <Label>Shipping Speed</Label>
                      <Select
                        value={formData.qrCode.shipping.speed}
                        onValueChange={(value: 'standard' | 'express' | 'overnight') => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            shipping: {
                              ...prev.qrCode.shipping,
                              speed: value
                            }
                          }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select shipping speed" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard (5-7 business days)</SelectItem>
                          <SelectItem value="express">Express (2-3 business days)</SelectItem>
                          <SelectItem value="overnight">Overnight</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="special-instructions">Special Handling Instructions</Label>
                      <Textarea
                        id="special-instructions"
                        value={formData.qrCode.shipping.specialInstructions}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            shipping: {
                              ...prev.qrCode.shipping,
                              specialInstructions: e.target.value
                            }
                          }
                        }))}
                        placeholder="Any special handling instructions..."
                      />
                    </div>
                  </div>
                </div>

                {/* Setup Assistance Section */}
                <div>
                  <h4 className="text-xl font-semibold mb-4">Setup Assistance</h4>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="needs-assistance"
                        checked={formData.qrCode.setup.needsAssistance}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          qrCode: {
                            ...prev.qrCode,
                            setup: {
                              ...prev.qrCode.setup,
                              needsAssistance: e.target.checked
                            }
                          }
                        }))}
                        className="w-4 h-4 mr-2"
                      />
                      <Label htmlFor="needs-assistance">I need help with installation</Label>
                    </div>

                    {formData.qrCode.setup.needsAssistance && (
                      <>
                        <div>
                          <Label htmlFor="preferred-date">Preferred Date</Label>
                          <Input
                            type="date"
                            id="preferred-date"
                            value={formData.qrCode.setup.preferredDate}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              qrCode: {
                                ...prev.qrCode,
                                setup: {
                                  ...prev.qrCode.setup,
                                  preferredDate: e.target.value
                                }
                              }
                            }))}
                          />
                        </div>

                        <div>
                          <Label>Preferred Time Slot</Label>
                          <Select
                            value={formData.qrCode.setup.preferredTimeSlot}
                            onValueChange={(value) => setFormData(prev => ({
                              ...prev,
                              qrCode: {
                                ...prev.qrCode,
                                setup: {
                                  ...prev.qrCode.setup,
                                  preferredTimeSlot: value
                                }
                              }
                            }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select time slot" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="morning">Morning (9 AM - 12 PM)</SelectItem>
                              <SelectItem value="afternoon">Afternoon (12 PM - 4 PM)</SelectItem>
                              <SelectItem value="evening">Evening (4 PM - 7 PM)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="setup-requirements">Specific Requirements</Label>
                          <Textarea
                            id="setup-requirements"
                            value={formData.qrCode.setup.requirements}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              qrCode: {
                                ...prev.qrCode,
                                setup: {
                                  ...prev.qrCode.setup,
                                  requirements: e.target.value
                                }
                              }
                            }))}
                            placeholder="Any specific requirements or concerns..."
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
              </ul>

              <div className="bg-blue-50 p-4 rounded-lg mt-6">
                <p className="text-sm text-blue-600">
                  Note: The QR code will be generated automatically once you submit your Blueprint. You'll be
                  able to download it in various formats and sizes.
                </p>
              </div>
            </div>
          </div>
        )
                  <Check className="w-5 h-5 text-green-500 mr-2 mt-0.5" />
                  <span>Include it in your marketing materials</span>
                </li>
                <li className="flex items-start">
                  <Check className="w-5 h-5 text-green-500 mr-2 mt-0.5" />
                  <span>Share it on social media to promote your AR experience</span>
                </li>
              </ul>

              <div className="bg-blue-50 p-4 rounded-lg mt-6">
                <p className="text-sm text-blue-600">
                  Note: The QR code will be generated automatically once you submit your Blueprint. You'll be
                  able to download it in various formats and sizes.
                </p>
              </div>
            </div>
          </div>
                    <span>Print and display it at your business location</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 mt-0.5" />
                    <span>Include it in your marketing materials</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 mt-0.5" />
                    <span>Share it on social media to promote your AR experience</span>
                  </li>
                </ul>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-600">
                    Note: The QR code will be generated automatically once you submit your Blueprint. You'll be
                    able to download it in various formats and sizes.
                  </p>
                </div>
              </div>
            </div>
          </div>
                    <span>Print and display it at your business location</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 mt-0.5" />
                    <span>Include it in your marketing materials</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 mt-0.5" />
                    <span>Share it on social media to promote your AR experience</span>
                  </li>
                </ul>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-600">
                    Note: The QR code will be generated automatically once you submit your Blueprint. You'll be
                    able to download it in various formats and sizes.
                  </p>
                </div>
              </div>
            </div>
                    <div className="space-y-2">
                      {['Entrance', 'Checkout Counter', 'Product Displays', 'Window Display'].map((location) => (
                        <div key={location} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`location-${location}`}
                            className="w-4 h-4 text-primary rounded border-gray-300"
                            required
                          />
                          <Label htmlFor={`location-${location}`}>{location}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <Label>Floor Plan Upload</Label>
                    <Input 
                      type="file" 
                      accept=".png,.jpg,.jpeg,.pdf"
                      className="w-full"
                      required
                    />
                    <p className="text-sm text-gray-500">Upload your floor plan to mark QR code locations</p>
                  </div>
                </div>
              </div>

              {/* Shipping Information Section */}
              <div className="mb-8">
                <h5 className="text-lg font-semibold mb-4">Shipping Information</h5>
                <div className="space-y-4">
                  <div>
                    <Label>Shipping Address</Label>
                    <Input 
                      defaultValue={`${formData.address}, ${formData.city}, ${formData.state} ${formData.zipCode}`}
                      className="w-full"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label>Shipping Options</Label>
                    <Select defaultValue="standard">
                      <SelectTrigger>
                        <SelectValue placeholder="Select shipping option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard Shipping (5-7 days)</SelectItem>
                        <SelectItem value="express">Express Shipping (2-3 days)</SelectItem>
                        <SelectItem value="rush">Rush Shipping (Next day)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Special Handling Instructions</Label>
                    <Textarea 
                      placeholder="Enter any special handling instructions"
                      className="min-h-[100px]"
                    />
                  </div>
                </div>
              </div>

              {/* Setup Assistance Section */}
              <div className="mb-8">
                <h5 className="text-lg font-semibold mb-4">Setup Assistance</h5>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <input
                      type="checkbox"
                      id="need-installation"
                      className="w-4 h-4 text-primary rounded border-gray-300"
                    />
                    <Label htmlFor="need-installation">I need help with installation</Label>
                  </div>
                  
                  <div>
                    <Label>Preferred Installation Date</Label>
                    <Input 
                      type="date"
                      className="w-full"
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label>Preferred Time Slot</Label>
                    <Select defaultValue="morning">
                      <SelectTrigger>
                        <SelectValue placeholder="Select preferred time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="morning">Morning (9 AM - 12 PM)</SelectItem>
                        <SelectItem value="afternoon">Afternoon (12 PM - 4 PM)</SelectItem>
                        <SelectItem value="evening">Evening (4 PM - 7 PM)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Setup Requirements</Label>
                    <Textarea 
                      placeholder="Describe any specific setup requirements or concerns"
                      className="min-h-[100px]"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <p className="text-sm text-gray-500 mb-4">
                  Note: After submitting, your QR codes will be generated and shipped according to your specifications.
                  You'll receive an email confirmation with tracking information.
                </p>
              </div>
            </div>
          </div>
        );
                <li className="flex items-start">
                  <Check className="w-5 h-5 text-green-500 mr-2 mt-0.5" />
                  <span>Include it in your marketing materials</span>
                </li>
                <li className="flex items-start">
                  <Check className="w-5 h-5 text-green-500 mr-2 mt-0.5" />
                  <span>Share it on social media to promote your AR experience</span>
                </li>
              </ul>

              <div className="text-sm text-gray-500 bg-blue-50 p-4 rounded-lg">
                <p>
                  Note: The QR code will be generated automatically once you submit your Blueprint. You'll be
                  able to download it in various formats and sizes.
                </p>
              </div>
            </div>
          </div>
        );
                    <Label>Common Placement Locations</Label>
                    <div className="space-y-2">
                      {['Entrance', 'Checkout Counter', 'Product Displays', 'Window Display'].map((location) => (
                        <div key={location} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`location-${location}`}
                            className="w-4 h-4 text-primary rounded border-gray-300"
                            required
                          />
                          <Label htmlFor={`location-${location}`}>{location}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Upload Floor Plan</Label>
                    <Input 
                      type="file" 
                      accept=".png,.jpg,.jpeg,.pdf"
                      className="w-full"
                      required
                    />
                    <p className="text-sm text-gray-500">Upload your floor plan to mark QR code locations</p>
                  </div>
                </div>
              </div>

              {/* Shipping Information Section */}
              <div className="mb-8">
                <h5 className="text-lg font-semibold mb-4">Shipping Information</h5>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Shipping Address</Label>
                    <Input 
                      defaultValue={`${formData.address}, ${formData.city}, ${formData.state} ${formData.zipCode}`}
                      className="w-full"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Shipping Options</Label>
                    <Select defaultValue="standard">
                      <SelectTrigger>
                        <SelectValue placeholder="Select shipping option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard Shipping (5-7 days)</SelectItem>
                        <SelectItem value="express">Express Shipping (2-3 days)</SelectItem>
                        <SelectItem value="rush">Rush Shipping (Next day)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Special Handling Instructions</Label>
                    <Textarea 
                      placeholder="Enter any special handling instructions"
                      className="min-h-[100px]"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Setup Assistance Section */}
              <div className="mb-8">
                <h5 className="text-lg font-semibold mb-4">Setup Assistance</h5>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <input
                      type="checkbox"
                      id="need-installation"
                      className="w-4 h-4 text-primary rounded border-gray-300"
                    />
                    <Label htmlFor="need-installation">I need help with installation</Label>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Preferred Installation Date</Label>
                    <Input 
                      type="date"
                      className="w-full"
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Preferred Time Slot</Label>
                    <Select defaultValue="morning">
                      <SelectTrigger>
                        <SelectValue placeholder="Select preferred time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="morning">Morning (9 AM - 12 PM)</SelectItem>
                        <SelectItem value="afternoon">Afternoon (12 PM - 4 PM)</SelectItem>
                        <SelectItem value="evening">Evening (4 PM - 7 PM)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Setup Requirements</Label>
                    <Textarea 
                      placeholder="Describe any specific setup requirements or concerns"
                      className="min-h-[100px]"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <p className="text-sm text-gray-500 mb-4">
                  Note: After submitting, your QR codes will be generated and shipped according to your specifications.
                  You'll receive an email confirmation with tracking information.
                </p>
              </div>
            </div>
          </div>
        );
                  <span>Print and display it at your business location</span>
                </li>
                <li className="flex items-start">
                  <Check className="w-5 h-5 text-green-500 mr-2 mt-0.5" />
                  <span>Include it in your marketing materials</span>
                </li>
                <li className="flex items-start">
                  <Check className="w-5 h-5 text-green-500 mr-2 mt-0.5" />
                  <span>Share it on social media to promote your AR experience</span>
                </li>
              </ul>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Note:</strong> The QR code will be generated automatically once you submit your Blueprint. You'll be able to download it in various formats and sizes.
                </p>
              </div>
            </div>
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
