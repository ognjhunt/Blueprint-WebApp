"use client";

import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Building2, MapPin, Phone, Bot, Cog, CheckCircle, Loader2 } from 'lucide-react';
import { usePlacesWidget } from "react-google-autocomplete";
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

const steps = [
    { icon: Building2, label: 'Business Information' },
    { icon: MapPin, label: 'Location Details' },
    { icon: Phone, label: 'Contact Information' },
    { icon: Bot, label: 'AI Assistant' },
    { icon: Cog, label: 'Blueprint Features' },
    { icon: CheckCircle, label: 'Review & Submit' }
];

export default function CreateBlueprint() {
    const [currentStep, setCurrentStep] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [, setLocation] = useLocation();

    const { ref: businessNameRef } = usePlacesWidget({
        apiKey: import.meta.env.VITE_GOOGLE_PLACES_API_KEY,
        onPlaceSelected: (place) => {
            const placeDetails = {
                businessName: place.name || '',
                address: place.formatted_address || '',
                phone: place.formatted_phone_number || '',
                website: place.website || '',
                locationName: place.name || '',
            };
            setFormData(prev => ({
                ...prev,
                ...placeDetails
            }));
        },
        options: {
            types: ['establishment'],
            fields: ['name', 'formatted_address', 'formatted_phone_number', 'website']
        }
    });

    const [formData, setFormData] = useState({
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
        blueprintId: '',
        createdDate: new Date(),
        features: {
            virtualTours: { enabled: false, details: { tourUrl: '' } },
            personalizedRecommendations: { enabled: false, details: { crm: '' } },
            loyaltyProgram: { enabled: false, details: { programDetails: '' } },
            arVisualizations: { enabled: false, details: { arModelUrls: '' } },
        },
    });

    const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

    const validateField = (name: string, value: string) => {
        switch (name) {
            case 'businessName':
                return value.length < 2 ? 'Business name must be at least 2 characters' : '';
            case 'businessType':
                return !value ? 'Please select a business type' : '';
            case 'email':
                return !value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) ? 'Please enter a valid email' : '';
            case 'phone':
                return !value.match(/^\+?[\d\s-()]*$/) ? 'Please enter a valid phone number' : '';
            case 'website':
                return value && !value.match(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/)
                    ? 'Please enter a valid URL' : '';
            case 'apiKey':
                return value.trim().length === 0 ? "API Key is required" : "";
            default:
                return !value ? `${name} is required` : '';
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        const error = validateField(name, value);
        setFieldErrors(prev => ({ ...prev, [name]: error }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
        const error = validateField(name, value);
        setFieldErrors(prev => ({ ...prev, [name]: error }));
    };

    const handleFeatureToggle = (feature: string) => {
        setFormData(prev => ({
            ...prev,
            features: {
                ...prev.features,
                [feature]: {
                    ...prev.features[feature as keyof typeof prev.features],
                    enabled: !prev.features[feature as keyof typeof prev.features].enabled
                }
            }
        }));
    };

    const handleFeatureDetailChange = (feature: string, field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            features: {
                ...prev.features,
                [feature]: {
                    ...prev.features[feature as keyof typeof prev.features],
                    details: {
                        ...prev.features[feature as keyof typeof prev.features].details,
                        [field]: value
                    }
                }
            }
        }));
    };

    const isStepValid = () => {
        switch (currentStep) {
            case 0:
                return !validateField("businessName", formData.businessName) &&
                    !validateField("businessType", formData.businessType);
            case 1:
                return !validateField("locationName", formData.locationName) &&
                    !validateField("address", formData.address) &&
                    !validateField("city", formData.city) &&
                    !validateField("state", formData.state) &&
                    !validateField("zipCode", formData.zipCode) &&
                    !validateField("country", formData.country);
            case 2:
                return !validateField("phone", formData.phone) &&
                    !validateField("email", formData.email) &&
                    !validateField("website", formData.website);
            case 3:
                return !validateField("aiProvider", formData.aiProvider) && 
                       !validateField("apiKey", formData.apiKey);
            case 4:
                return true; // Features are optional
            case 5:
                return true; // Review step is always valid
            default:
                return false;
        }
    };

    const { toast } = useToast();
    const handleSubmit = async () => {
        setIsLoading(true);
        try {
            const blueprintId = formData.blueprintId || uuidv4();
            const blueprintData = {
                id: blueprintId,
                name: formData.businessName,
                category: formData.businessType,
                address: formData.address,
                city: formData.city,
                state: formData.state,
                zipCode: formData.zipCode,
                country: formData.country,
                phoneNumber: formData.phone,
                contactEmail: formData.email,
                websiteURL: formData.website,
                aiProvider: formData.aiProvider,
                apiKey: formData.apiKey,
                createdDate: new Date(),
                features: formData.features,
                host: auth.currentUser?.uid || '',
                numSessions: 0,
                storage: 0,
                isPrivate: false,
                userCount: 0,
                connectedTime: 0,
                locationName: formData.locationName,
                anchorIDs: [],
                objectIDs: [],
                portalIDs: [],
                photoIDs: [],
                noteIDs: [],
                fileIDs: [],
                widgetIDs: [],
                users: [],
                goals: {},
                frameImageURLs: [],
                aiAnalysisData: {},
                spatialGraph: {},
                planeAnchorDescriptions: '',
                descriptionText: '',
                dimensions: {},
                actions: [],
                openingHours: [],
            };

            // Save to Firestore
            const blueprintRef = doc(db, 'blueprints', blueprintData.id);
            await setDoc(blueprintRef, blueprintData);

            // Update user's createdBlueprintIds
            if (auth.currentUser) {
                const userRef = doc(db, 'users', auth.currentUser.uid);
                await updateDoc(userRef, {
                    createdBlueprintIds: arrayUnion(blueprintData.id)
                });
            }

            toast({
                title: "Success",
                description: "Blueprint created successfully!",
                variant: "default",
            });

            // Redirect to dashboard
            setLocation('/dashboard');
        } catch (error: any) {
            console.error('Error creating blueprint:', error);
            toast({
                title: "Error",
                description: "Failed to create blueprint. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const renderStep = () => {
        switch (currentStep) {
            case 5:
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold">Review Your Blueprint</h2>
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <pre className="whitespace-pre-wrap">
                                {JSON.stringify(formData, null, 2)}
                            </pre>
                        </div>
                        <p className="text-gray-600">
                            Please review your Blueprint details above. If everything looks correct, click 'Create Blueprint' to submit.
                        </p>
                        <Button
                            className="w-full"
                            onClick={handleSubmit}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating Blueprint...
                                </>
                            ) : (
                                'Create Blueprint'
                            )}
                        </Button>
                    </div>
                );
            case 0:
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="businessName">Business Name</Label>
                            <Input
                                id="businessName"
                                name="businessName"
                                ref={businessNameRef}
                                value={formData.businessName}
                                onChange={handleInputChange}
                                placeholder="Search for your business"
                                className={cn(
                                    "w-full",
                                    fieldErrors.businessName && "border-red-500 focus-visible:ring-red-500"
                                )}
                            />
                            {fieldErrors.businessName && (
                                <p className="text-sm text-red-500 mt-1">{fieldErrors.businessName}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="businessType">Business Type</Label>
                            <Select
                                name="businessType"
                                value={formData.businessType}
                                onValueChange={(value) => handleSelectChange("businessType", value)}
                            >
                                <SelectTrigger className={cn(
                                    fieldErrors.businessType && "border-red-500 focus-visible:ring-red-500"
                                )}>
                                    <SelectValue placeholder="Select business type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="restaurant">Restaurant</SelectItem>
                                    <SelectItem value="retail">Retail</SelectItem>
                                    <SelectItem value="service">Service</SelectItem>
                                    <SelectItem value="hotel">Hotel</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                            {fieldErrors.businessType && (
                                <p className="text-sm text-red-500 mt-1">{fieldErrors.businessType}</p>
                            )}
                        </div>
                    </div>
                );
            case 1:
                return (
                    <div className="space-y-4">
                        <Input
                            id="locationName"
                            name="locationName"
                            type="text"
                            placeholder="Enter location name"
                            value={formData.locationName}
                            onChange={handleInputChange}
                        />
                        <Input
                            id="address"
                            name="address"
                            type="text"
                            placeholder="Enter street address"
                            value={formData.address}
                            onChange={handleInputChange}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                id="city"
                                name="city"
                                type="text"
                                placeholder="City"
                                value={formData.city}
                                onChange={handleInputChange}
                            />
                            <Input
                                id="state"
                                name="state"
                                type="text"
                                placeholder="State/Province"
                                value={formData.state}
                                onChange={handleInputChange}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                id="zipCode"
                                name="zipCode"
                                type="text"
                                placeholder="ZIP/Postal Code"
                                value={formData.zipCode}
                                onChange={handleInputChange}
                            />
                            <Input
                                id="country"
                                name="country"
                                type="text"
                                placeholder="Country"
                                value={formData.country}
                                onChange={handleInputChange}
                            />
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="space-y-4">
                        <Input
                            id="phone"
                            name="phone"
                            type="text"
                            placeholder="Phone Number"
                            value={formData.phone}
                            onChange={handleInputChange}
                        />
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="Email Address"
                            value={formData.email}
                            onChange={handleInputChange}
                        />
                        <Input
                            id="website"
                            name="website"
                            type="url"
                            placeholder="Website"
                            value={formData.website}
                            onChange={handleInputChange}
                        />
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-4">
                        <Select
                            name="aiProvider"
                            value={formData.aiProvider}
                            onValueChange={(value) => handleSelectChange("aiProvider", value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select AI Provider" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="openai">OpenAI</SelectItem>
                                <SelectItem value="anthropic">Anthropic</SelectItem>
                                <SelectItem value="google">Google AI</SelectItem>
                            </SelectContent>
                        </Select>
                        <Input
                            id="apiKey"
                            name="apiKey"
                            type="password"
                            placeholder="Enter API Key"
                            value={formData.apiKey}
                            onChange={handleInputChange}
                        />
                        {fieldErrors.apiKey && (
                            <p className="text-sm text-red-500">{fieldErrors.apiKey}</p>
                        )}
                    </div>
                );
            case 4:
                return (
                    <div className="space-y-6">
                        {Object.entries(formData.features).map(([feature, value]) => (
                            <div key={feature} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor={feature}>{feature.replace(/([A-Z])/g, ' $1').trim()}</Label>
                                    <Button
                                        type="button"
                                        variant={value.enabled ? "default" : "outline"}
                                        onClick={() => handleFeatureToggle(feature)}
                                    >
                                        {value.enabled ? 'Enabled' : 'Disabled'}
                                    </Button>
                                </div>
                                {value.enabled && (
                                    <Textarea
                                        id={`${feature}-details`}
                                        value={Object.values(value.details)[0]}
                                        onChange={(e) => handleFeatureDetailChange(
                                            feature,
                                            Object.keys(value.details)[0],
                                            e.target.value
                                        )}
                                        placeholder={`Enter ${feature} details...`}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12">
            <div className="container mx-auto px-4">
                <h1 className="text-3xl font-bold text-center mb-8">Create Your Blueprint</h1>
                <div className="flex justify-center mb-8">
                    <div className="flex items-center">
                        {steps.map((step, index) => {
                            const StepIcon = step.icon;
                            const isCompleted = index < currentStep;
                            const isCurrent = index === currentStep;
                            
                            return (
                                <div key={index} className="flex items-center">
                                    <div
                                        className={cn(
                                            "rounded-full p-2",
                                            isCompleted ? "bg-blue-500" :
                                            isCurrent ? "bg-blue-500" : "bg-gray-200"
                                        )}
                                    >
                                        <StepIcon className={cn(
                                            "w-6 h-6",
                                            isCompleted || isCurrent ? "text-white" : "text-gray-500"
                                        )} />
                                    </div>
                                    {index < steps.length - 1 && (
                                        <div className={cn(
                                            "w-20 h-1 mx-2",
                                            index < currentStep ? "bg-blue-500" : "bg-gray-200"
                                        )} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        {renderStep()}
                    </motion.div>
                    <div className="flex justify-between mt-8">
                        <Button
                            variant="outline"
                            onClick={() => setCurrentStep(prev => prev - 1)}
                            disabled={currentStep === 0}
                        >
                            Previous
                        </Button>
                        {currentStep < steps.length - 1 ? (
                            <Button
                                onClick={() => setCurrentStep(prev => prev + 1)}
                                disabled={!isStepValid()}
                            >
                                Next
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}