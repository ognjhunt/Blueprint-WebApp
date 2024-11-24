import { useState } from 'react';
import { motion } from 'framer-motion';
import CustomerExperienceDesigner from '@/components/CustomerExperienceDesigner';
import { Check, ChevronRight, MapPin, Store, User, Mail, Phone, Globe, Shield } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface FormData {
  businessName: string;
  address: string;
  phone: string;
  website: string;
  email: string;
  verificationMethod: string;
  customizations: {
    loyaltyProgram: boolean;
    specialPromotions: boolean;
    virtualTour: boolean;
  };
}

const steps = [
  { id: 'verify', title: 'Verify Business', icon: Shield },
  { id: 'review', title: 'Review Information', icon: Store },
  { id: 'customize', title: 'Customize Blueprint', icon: User },
  { id: 'confirm', title: 'Confirm & Submit', icon: Check },
];

export default function ClaimBlueprint() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    businessName: 'Roots & Vines Restaurant',
    address: '123 Main St, Anytown, USA',
    phone: '(555) 123-4567',
    website: 'www.rootsandvines.com',
    email: '',
    verificationMethod: '',
    customizations: {
      loyaltyProgram: false,
      specialPromotions: false,
      virtualTour: false,
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCustomizationToggle = (feature: keyof FormData['customizations']) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Blueprint claimed:', formData);
    alert('Your Blueprint has been successfully claimed and customized!');
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Verify Your Business</h2>
            <p className="text-muted-foreground">Choose a verification method to prove you're the owner or manager of this business.</p>
            <RadioGroup
              name="verificationMethod"
              value={formData.verificationMethod}
              onValueChange={(value) => setFormData(prev => ({ ...prev, verificationMethod: value }))}
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
        );
      case 1:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Review Your Business Information</h2>
            <p className="text-muted-foreground">Please review the information we've gathered about your business. You can make changes if needed.</p>
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
      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Customize Your Blueprint</h2>
            <p className="text-muted-foreground">Design your customer experience flow and enhance your Blueprint with additional features.</p>
            
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
                      onChange={() => handleCustomizationToggle(feature as keyof FormData['customizations'])}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <Label htmlFor={feature} className="select-none">
                      {feature.split(/(?=[A-Z])/).join(' ')}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Confirm Your Blueprint</h2>
            <p className="text-muted-foreground">Please review your Blueprint details before submitting.</p>
            <Card>
              <CardHeader>
                <CardTitle>{formData.businessName}</CardTitle>
                <CardDescription>{formData.address}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
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
              <CardFooter>
                <div className="space-y-2">
                  <p className="font-semibold">Enabled Features:</p>
                  <ul className="list-disc list-inside">
                    {Object.entries(formData.customizations)
                      .filter(([, enabled]) => enabled)
                      .map(([feature]) => (
                        <li key={feature}>{feature.split(/(?=[A-Z])/).join(' ')}</li>
                      ))}
                  </ul>
                </div>
              </CardFooter>
            </Card>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-blue-900 mb-8">Claim Your Blueprint</h1>
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
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {renderStep()}
              </motion.div>
              <div className="mt-8 flex justify-between">
                <Button
                  type="button"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  variant="outline"
                >
                  Previous
                </Button>
                {currentStep < steps.length - 1 ? (
                  <Button type="button" onClick={handleNext}>
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button type="submit">Claim Blueprint</Button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
