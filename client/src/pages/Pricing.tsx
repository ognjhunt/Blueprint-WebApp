'use client'

import { useState } from 'react'
import { Check, X, Calculator } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import Nav from "@/components/Nav"
import Footer from "@/components/Footer"

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false)
  const [estimatedHours, setEstimatedHours] = useState(100)
  const hourlyRate = isAnnual ? 0.75 : 1 // 25% discount for annual billing

  const tiers = [
    {
      name: 'Free',
      price: 0,
      description: 'For small businesses just getting started with Blueprint',
      features: [
        'Up to 3 Blueprints',
        'Basic customer interactions',
        'Standard support',
        'Community access',
      ],
      limitations: [
        'Limited analytics',
        'No smart recommendations',
        'Basic customization options',
      ],
    },
    {
      name: 'Plus',
      price: hourlyRate,
      description: 'For growing businesses that need more power and insights',
      features: [
        'Unlimited Blueprints',
        'Advanced customer interactions',
        'Priority support',
        'Insights & Analytics',
        'Smart recommendations',
        'Advanced customization options',
        'A/B testing',
        'Integration with CRM systems',
        'Multi-language support',
        'Custom branding',
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-white">
      <Nav />
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
              Pricing Plans
            </h1>
            <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500">
              Choose the perfect plan for your business
            </p>
          </div>

          <div className="mt-12 flex justify-center items-center space-x-4">
            <span className="text-sm font-medium text-gray-500">Monthly</span>
            <Switch
              checked={isAnnual}
              onCheckedChange={setIsAnnual}
              id="billing-toggle"
            />
            <span className="text-sm font-medium text-gray-900">
              Annually <span className="text-green-500 font-bold">(Save 25%)</span>
            </span>
          </div>

          <div className="mt-12 space-y-4 sm:mt-16 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0 xl:grid-cols-2">
            {tiers.map((tier) => (
              <Card key={tier.name} className={tier.name === 'Plus' ? 'border-blue-500 border-2' : ''}>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <span className="text-4xl font-extrabold">
                      ${tier.price}
                    </span>
                    {tier.name === 'Plus' && (
                      <span className="text-base font-medium text-gray-500">
                        /hour of usage
                      </span>
                    )}
                  </div>
                  <ul className="mt-8 space-y-4">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start">
                        <Check className="flex-shrink-0 w-5 h-5 text-green-500" />
                        <span className="ml-3 text-base text-gray-700">{feature}</span>
                      </li>
                    ))}
                    {tier.limitations && tier.limitations.map((limitation) => (
                      <li key={limitation} className="flex items-start">
                        <X className="flex-shrink-0 w-5 h-5 text-red-500" />
                        <span className="ml-3 text-base text-gray-700">{limitation}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" variant={tier.name === 'Plus' ? 'default' : 'outline'}>
                    {tier.name === 'Free' ? 'Get Started' : 'Upgrade to Plus'}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Cost Calculator */}
          <div className="mt-16 max-w-3xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calculator className="w-6 h-6 mr-2" />
                  Cost Calculator
                </CardTitle>
                <CardDescription>
                  Estimate your monthly cost based on expected usage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label>Estimated Hours of Usage per Month</Label>
                  <div className="flex items-center space-x-4">
                    <Slider
                      value={[estimatedHours]}
                      onValueChange={([value]) => setEstimatedHours(value)}
                      max={500}
                      step={10}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={estimatedHours}
                      onChange={(e) => setEstimatedHours(Number(e.target.value))}
                      className="w-24"
                    />
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium">Estimated Monthly Cost:</span>
                    <span className="text-2xl font-bold">
                      ${(estimatedHours * hourlyRate).toFixed(2)}
                    </span>
                  </div>
                  {isAnnual && (
                    <p className="text-sm text-green-600 mt-2">
                      You save ${(estimatedHours * 0.25).toFixed(2)} per month with annual billing!
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
