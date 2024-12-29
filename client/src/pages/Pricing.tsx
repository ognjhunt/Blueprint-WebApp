"use client";

import React, { useState } from "react";
import { Check, X, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { UpgradeModal } from "@/components/UpgradeModal";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

// -------------------------------------------------------------------------
// 1) Client-Side Stripe Integration
// -------------------------------------------------------------------------
// Make sure you have your publishable key in NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
// and your secret key in STRIPE_SECRET_KEY (in a .env file).
//
// This example uses a "one-time" Payment flow. If you'd like a recurring
// subscription or usage-based subscription, adapt as needed with Stripe's
// Subscription APIs. Keep in mind you'll need to set up corresponding
// products/prices in your Stripe Dashboard.
//
// Also note that Next.js 13 best practice is to keep API routes in the
// /app/api directory (or /pages/api in older versions). Here, for simplicity
// and because you requested "rewrite in full", we'll place the route
// definition in this same file. In a real production app, separate your API
// routes from the page code.
// -------------------------------------------------------------------------

/**
 * This is the server-side route for creating a Checkout Session with Stripe.
 * You'd typically place this in /app/api/create-checkout-session/route.ts
 * or /pages/api/create-checkout-session.ts depending on your Next.js version.
 *
 * We’ll inline it here to keep everything in one file, as requested.
 */
export const dynamic = "force-static"; // or force-dynamic if needed

export async function POST(request: Request) {
  try {
    // We read the incoming data from the request body
    const body = await request.json();
    const { totalCost } = body;

    // IMPORTANT: For a real production app, do NOT import your secret
    // key client-side. Instead, store it in an environment variable
    // accessible only on the server (e.g. STRIPE_SECRET_KEY).
    // We'll assume you've done so here:
    const stripeSecretKey =
      "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";
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: "Missing Stripe Secret Key" }),
        { status: 500 },
      );
    }

    // Dynamically import Stripe because we're in a server environment
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2022-11-15",
    });

    // In a production app, you might want to create a Price in your
    // Stripe Dashboard for "Plus" plan, or handle usage-based billing, etc.
    // For demonstration, we’re creating ephemeral line_items with the
    // user’s computed total cost.
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Blueprint Plus Plan",
            },
            // totalCost is in "dollars" format; multiply by 100 to convert to cents
            unit_amount: Math.round(totalCost * 100),
          },
          quantity: 1,
        },
      ],
      // Update these URLs to match your deployed site
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/pricing?canceled=true`,
    });

    return new Response(JSON.stringify({ sessionId: session.id }), {
      status: 200,
    });
  } catch (error: any) {
    console.error("Error creating Stripe session:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500 },
    );
  }
}

// -------------------------------------------------------------------------
// 2) The Pricing Page Component (Client-Side)
// -------------------------------------------------------------------------
// This is your actual page/UI code. Here, we show two tiers: Free + Plus.
// When the user hits "Upgrade to Plus", we send them to Stripe's hosted
// payment page (Checkout).
// -------------------------------------------------------------------------

export default function PricingPage() {
  const [numberOfCustomers, setNumberOfCustomers] = useState(5000);
  const [averageVisitTime, setAverageVisitTime] = useState(0.5);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const hourlyRate = 1;
  const totalHours = numberOfCustomers * averageVisitTime;

  const tiers = [
    {
      name: "Free",
      price: 0,
      description: "For small businesses just getting started with Blueprint",
      features: [
        "Up to 3 Blueprints",
        "Basic customer interactions",
        "Standard support",
        "Community access",
      ],
      limitations: [
        "Limited analytics",
        "No access to ad revenue",
        "No smart recommendations",
        "Basic customization options",
      ],
    },
    {
      name: "Plus",
      price: hourlyRate,
      description: "For growing businesses that need more power and insights",
      features: [
        "Unlimited Blueprints",
        "Advanced customer interactions",
        "Priority support",
        "Insights & Analytics",
        "Smart recommendations",
        "Advanced customization options",
        "Split ad revenue",
        "Integration with CRM systems",
        "Multi-language support",
        "Custom branding",
      ],
    },
  ];

  /**
   * Client-side function that calls our server-side route (POST) to create
   * a Checkout Session, then redirects the user to Stripe's hosted payment
   * page. We'll pass the total cost for the month so the user can pay.
   */
  const handleCheckout = async () => {
    try {
      // If you want to do usage-based, you might pass totalHours * hourlyRate,
      // or some other formula. Here we’ll just do one monthly cost example:
      const monthlyCost = totalHours * hourlyRate;

      // Create the Checkout session on our server
      const response = await fetch("/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalCost: monthlyCost }),
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session.");
      }

      const { sessionId } = await response.json();

      // IMPORTANT: loadStripe should be called outside the function if used often
      // But for brevity, we'll just inline it here.

      //new api key: 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
      const { loadStripe } = await import("@stripe/stripe-js");
      const stripePublicKey =
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
      const stripe = await loadStripe(stripePublicKey);

      if (!stripe) {
        throw new Error("Stripe could not be loaded. Check your public key.");
      }

      // Redirect to Stripe Checkout
      const { error } = await stripe.redirectToCheckout({ sessionId });
      if (error) {
        console.error(error);
      }
    } catch (error) {
      console.error("Checkout error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-white">
      <Nav />

      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl lg:text-6xl">
            Pricing Plans
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500">
            Choose the perfect plan for your business
          </p>
        </div>

        <div className="mt-12 space-y-4 sm:mt-16 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0 xl:grid-cols-2">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={tier.name === "Plus" ? "border-blue-500 border-2" : ""}
            >
              <CardHeader>
                <CardTitle className="text-2xl font-bold">
                  {tier.name}
                </CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="text-center">
                  <span className="text-4xl font-extrabold">${tier.price}</span>
                  {tier.name === "Plus" && (
                    <span className="text-base font-medium text-gray-500">
                      /hour of usage
                    </span>
                  )}
                </div>

                <ul className="mt-8 space-y-4">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <Check className="flex-shrink-0 w-5 h-5 text-green-500" />
                      <span className="ml-3 text-base text-gray-700">
                        {feature}
                      </span>
                    </li>
                  ))}
                  {tier.limitations &&
                    tier.limitations.map((limitation) => (
                      <li key={limitation} className="flex items-start">
                        <X className="flex-shrink-0 w-5 h-5 text-red-500" />
                        <span className="ml-3 text-base text-gray-700">
                          {limitation}
                        </span>
                      </li>
                    ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={tier.name === "Plus" ? "default" : "outline"}
                  onClick={() =>
                    tier.name === "Plus" ? handleCheckout() : null
                  }
                >
                  {tier.name === "Free" ? "Get Started" : "Upgrade to Plus"}
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
              <div className="space-y-6">
                <div className="space-y-4">
                  <Label>Number of Monthly Customers</Label>
                  <div className="flex items-center space-x-4">
                    <Slider
                      value={[numberOfCustomers]}
                      onValueChange={([value]) => setNumberOfCustomers(value)}
                      max={10000}
                      step={100}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={numberOfCustomers}
                      onChange={(e) =>
                        setNumberOfCustomers(Number(e.target.value))
                      }
                      className="w-24"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <Label>Average Visit Time (hours)</Label>
                  <div className="flex items-center space-x-4">
                    <Slider
                      value={[averageVisitTime]}
                      onValueChange={([value]) => setAverageVisitTime(value)}
                      max={4}
                      step={0.25}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={averageVisitTime}
                      onChange={(e) =>
                        setAverageVisitTime(Number(e.target.value))
                      }
                      className="w-24"
                    />
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">
                        Number of Customers
                      </p>
                      <p className="text-lg font-medium">{numberOfCustomers}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">
                        Average Time per Visit
                      </p>
                      <p className="text-lg font-medium">
                        {averageVisitTime} hours
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">
                        Total Hours per Month
                      </p>
                      <p className="text-lg font-medium">{totalHours} hours</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Rate per Hour</p>
                      <p className="text-lg font-medium">
                        ${hourlyRate.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium">
                        Total Monthly Cost:
                      </span>
                      <span className="text-2xl font-bold">
                        ${(totalHours * hourlyRate).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        usageDetails={{
          numberOfCustomers,
          averageVisitTime,
          totalHours,
          monthlyTotal: totalHours * hourlyRate,
        }}
        // We call handleCheckout once the user confirms in the UpgradeModal
        onUpgradeConfirm={handleCheckout}
      />
    </div>
  );
}
