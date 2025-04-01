import React, { useState } from "react";
import {
  Check,
  X,
  Calculator,
  Zap,
  Users,
  Clock,
  Sparkles,
  Building2,
  TrendingUp,
  Calendar,
  Gauge,
  InfoIcon,
  ChevronRight,
} from "lucide-react";
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
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Stripe from "stripe";
// Import the new modal components
import { TeamSeatSelectorModal } from "@/components/TeamSeatSelectorModal";
import { WorkspaceNameModal } from "@/components/WorkspaceNameModal";
import { InviteMembersModal } from "@/components/InviteMembersModal";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext"; // Needed to get current user data
import { doc, getDoc } from "firebase/firestore"; // Needed to get user data
import { db } from "@/lib/firebase"; // Needed for db access
import { motion } from "framer-motion"; // Needed for motion divs
import { useRouter } from "next/navigation"; // Needed if buttons navigate

// Stripe Checkout Route - Keep original functionality
export const dynamic = "force-static";
export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Expect 'hours' and 'seats' from the frontend
    const { hours, seats } = body;

    // Basic validation
    if (
      typeof hours !== "number" ||
      hours <= 0 ||
      typeof seats !== "number" ||
      seats < 0
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid hours or seats provided." }),
        { status: 400 },
      );
    }
    if (seats > 0 && seats < 2) {
      return new Response(
        JSON.stringify({ error: "Minimum 2 seats required for Team add-on." }),
        { status: 400 },
      );
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY; // Ensure this matches your env variable name

    if (!stripeSecretKey) {
      console.error("Missing Stripe Secret Key environment variable.");
      return new Response(
        JSON.stringify({ error: "Server configuration error." }),
        { status: 500 },
      );
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

    const successBaseUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/pricing?canceled=true`;

    // --- Logic to get cost per hour (MUST match frontend logic) ---
    // IMPORTANT: Duplicate or share this logic reliably between frontend and backend
    function getCostPerHourForPlusBackend(h: number): number {
      const pricePerHourTiers = {
        100: 1.0,
        250: 0.97,
        500: 0.93,
        1000: 0.88,
        2500: 0.8,
        5000: 0.7,
        7500: 0.63,
        10000: 0.57,
        15000: 0.5,
        20000: 0.44,
        30000: 0.38,
        50000: 0.32,
      };
      if (pricePerHourTiers[h] !== undefined) return pricePerHourTiers[h];
      if (h < 100) return pricePerHourTiers[100];
      if (h > 50000) return pricePerHourTiers[50000];
      const tiers = Object.keys(pricePerHourTiers)
        .map(Number)
        .sort((a, b) => a - b);
      let lowerTier = 100;
      for (let i = 0; i < tiers.length; i++) {
        if (tiers[i] <= h) lowerTier = tiers[i];
        else break;
      }
      return pricePerHourTiers[lowerTier];
    }
    // --- End cost per hour logic ---

    const costPerHour = getCostPerHourForPlusBackend(hours);
    const hoursTotalCost = hours * costPerHour; // Recalculate backend side
    const TEAM_PLAN_PRICE_PER_SEAT_CENTS = 1000; // $10.00

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    // 1. Add the one-time payment item for hours
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: `Blueprint Plus - ${hours} Customer Hours`,
          description: "One-time purchase of customer usage hours.",
        },
        unit_amount: Math.round(hoursTotalCost * 100), // Price in cents
      },
      quantity: 1,
    });

    // 2. Add the recurring subscription item for team seats (if any)
    if (seats > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: `Blueprint Team Seats`,
            description: `Monthly subscription per team member seat.`,
          },
          unit_amount: TEAM_PLAN_PRICE_PER_SEAT_CENTS,
          recurring: {
            interval: "month",
          },
        },
        quantity: seats,
      });
    }

    // Create the Checkout Session
    // Mode MUST be 'subscription' if mixing one-time and recurring items
    const sessionMode: Stripe.Checkout.SessionCreateParams.Mode =
      seats > 0 ? "subscription" : "payment";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: sessionMode,
      line_items: lineItems,
      // Add metadata if needed (e.g., userId)
      // metadata: { userId: 'user_123' },
      success_url: `${successBaseUrl}&hours=${hours}&seats=${seats}`, // Pass details for post-checkout handling
      cancel_url: cancelUrl,
      // If using subscription mode, you might need billing address collection
      billing_address_collection:
        sessionMode === "subscription" ? "required" : undefined,
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

// Add this component right after your FeatureItem component definition
const HoursSelector = ({ value, onChange, tiers }) => (
  <div className="relative w-full">
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full p-2 border rounded-md border-indigo-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 bg-white"
    >
      {tiers.map((tier) => (
        <option key={tier} value={tier}>
          {tier} hours
        </option>
      ))}
    </select>
    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
      <svg
        className="w-5 h-5 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </div>
  </div>
);

// Modern component for the feature list items
const FeatureItem = ({
  included = true,
  children,
  highlight = false,
}: {
  included?: boolean;
  children: React.ReactNode;
  highlight?: boolean;
}) => (
  <li className={`flex items-start ${highlight ? "font-medium" : ""}`}>
    {included ? (
      <Check className="flex-shrink-0 w-5 h-5 text-emerald-500" />
    ) : (
      <X className="flex-shrink-0 w-5 h-5 text-rose-500" />
    )}
    <span
      className={`ml-3 text-base ${included ? "text-gray-700" : "text-gray-500"}`}
    >
      {children}
    </span>
  </li>
);

export default function PricingPage() {
  // State for plan selection
  const [selectedPlan, setSelectedPlan] = useState<"free" | "starter" | "plus">(
    "free",
  );

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
      },
    },
  };
  const [chosenHours, setChosenHours] = useState(100);
  const [estimatedUsage, setEstimatedUsage] = useState(100);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isWorkspaceNameOpen, setIsWorkspaceNameOpen] = useState(false);
  // Blueprint Usage Calculator state
  const [customerCount, setCustomerCount] = useState<number>(500);
  const [customerBasis, setCustomerBasis] = useState<"day" | "week" | "month">(
    "day",
  );
  const [avgVisitDuration, setAvgVisitDuration] = useState<number>(30);
  const [adoptionPercentage, setAdoptionPercentage] = useState<number>(10);
  const [estimatedBlueprintUsage, setEstimatedBlueprintUsage] =
    useState<number>(0);
  const [showCalculatorIndicator, setShowCalculatorIndicator] = useState(true);
  const [isIndicatorBouncing, setIsIndicatorBouncing] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const hourTiers = [
    100, 250, 500, 1000, 2500, 5000, 7500, 10000, 15000, 20000, 30000, 50000,
  ];

  // --- New State for Team Plan Flow ---
  const [teamSeats, setTeamSeats] = useState<number>(0); // Default to 0 seats (no team add-on)
  const [workspaceName, setWorkspaceName] = useState<string>(""); // Still needed for post-checkout invite
  const [isInviteMembersOpen, setIsInviteMembersOpen] =
    useState<boolean>(false); // For post-checkout
  const [finalWorkspaceName, setFinalWorkspaceName] = useState<string>(""); // To show in Invite modal

  React.useEffect(() => {
    if (isIndicatorBouncing) {
      const timer = setTimeout(() => {
        setIsIndicatorBouncing(false);
      }, 3000); // Approximately 3 bounces
      return () => clearTimeout(timer);
    }
  }, [isIndicatorBouncing]);

  // --- Modified useEffect to handle different success scenarios ---
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get("success");
    const canceled = urlParams.get("canceled");
    const sessionId = urlParams.get("session_id");
    const purchasedSeatsStr = urlParams.get("seats"); // Get seats from URL

    if (success === "true" && sessionId) {
      const purchasedSeats = parseInt(purchasedSeatsStr || "0", 10);

      if (purchasedSeats > 0) {
        // Combined plan with seats successful: Show Invite Members modal
        console.log("Plus + Team plan payment successful!");
        // You might want to fetch workspace details or prompt for name here if needed
        // For now, just use a placeholder or previously stored name
        setFinalWorkspaceName(
          localStorage.getItem("pendingWorkspaceName") || "Your Workspace",
        ); // Example: Use stored name or default
        setIsInviteMembersOpen(true);
        localStorage.removeItem("pendingWorkspaceName"); // Clean up if you used localStorage
        alert("Payment successful! Your hours and team seats are active."); // Optional alert
      } else {
        // Plus plan (hours only) success: Show generic success message
        console.log("Plus plan (hours only) payment successful!");
        alert("Payment successful! Your Plus plan hours have been added.");
      }
      // Clear sensitive parts of the URL after processing
      window.history.replaceState({}, document.title, "/pricing");
    } else if (canceled === "true") {
      // Show canceled message
      alert("Payment was canceled. You can try again when you're ready.");
      window.history.replaceState({}, document.title, "/pricing");
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  function calculateBlueprintUsage() {
    let monthlyCustomers = customerCount;
    if (customerBasis === "day") {
      monthlyCustomers = customerCount * 30;
    } else if (customerBasis === "week") {
      monthlyCustomers = customerCount * 4;
    }
    const totalMinutes = monthlyCustomers * avgVisitDuration;
    const totalHours = totalMinutes / 60;
    const blueprintUsage = totalHours * (adoptionPercentage / 100);
    const usageCapped = Math.max(100, blueprintUsage);

    // Set immediately without animation delay
    setEstimatedBlueprintUsage(usageCapped);
  }

  function handleUseThisEstimate() {
    setSelectedPlan("plus");
    setEstimatedUsage(estimatedBlueprintUsage);
    const usageAsHours = Math.round(estimatedBlueprintUsage);

    // Find the next tier up that covers the estimated usage
    const nextTierUp =
      hourTiers.find((tier) => tier >= usageAsHours) ||
      hourTiers[hourTiers.length - 1];

    setChosenHours(nextTierUp);

    // Scroll back up to see pricing changes - add a slight delay to allow state to update
    setTimeout(() => {
      document.getElementById("pricing-tiers").scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }

  // Price Calculation Functions - Keep original algorithms
  function getCostPerHourForPlus(hours: number) {
    const pricePerHourTiers = {
      100: 1.0, // $100 total
      250: 0.97, // $243 total
      500: 0.93, // $465 total
      1000: 0.88, // $880 total
      2500: 0.8, // $2,000 total
      5000: 0.7, // $3,500 total
      7500: 0.63, // $4,725 total
      10000: 0.57, // $5,700 total
      15000: 0.5, // $7,500 total
      20000: 0.44, // $8,800 total
      30000: 0.38, // $11,400 total
      50000: 0.32, // $16,000 total
    };

    // Find the exact tier if it exists
    if (pricePerHourTiers[hours] !== undefined) {
      return pricePerHourTiers[hours];
    }

    // If hours is smaller than the smallest tier, return the smallest tier price
    if (hours < 100) {
      return pricePerHourTiers[100];
    }

    // If hours is larger than the largest tier, return the largest tier price
    if (hours > 50000) {
      return pricePerHourTiers[50000];
    }

    // Find the closest lower tier
    const tiers = Object.keys(pricePerHourTiers)
      .map(Number)
      .sort((a, b) => a - b);
    let lowerTier = 100;

    for (let i = 0; i < tiers.length; i++) {
      if (tiers[i] <= hours) {
        lowerTier = tiers[i];
      } else {
        break;
      }
    }

    // Return the price of the lower tier
    return pricePerHourTiers[lowerTier];
  }

  function getOverageRateForPlus(hours: number) {
    const costPerHour = getCostPerHourForPlus(hours);
    return costPerHour + 0.2;
  }

  // function calculateMonthlyCost() {
  //   if (selectedPlan === "free") {
  //     return 0;
  //   } else {
  //     const costPerHour = getCostPerHourForPlus(chosenHours);
  //     const baseCost = chosenHours * costPerHour;
  //     if (estimatedUsage <= chosenHours) {
  //       return baseCost;
  //     } else {
  //       const overage = estimatedUsage - chosenHours;
  //       const overageCost = overage * getOverageRateForPlus(chosenHours);
  //       return baseCost + overageCost;
  //     }
  //   }
  // }
  function calculateTotalMonthlyCost() {
    const costPerHour = getCostPerHourForPlus(chosenHours);
    const baseCost = chosenHours * costPerHour;
    let usageCost = baseCost;
    if (estimatedUsage > chosenHours) {
      const overage = estimatedUsage - chosenHours;
      const overageCost = overage * getOverageRateForPlus(chosenHours);
      usageCost = baseCost + overageCost;
    }
    const seatsCost = teamSeats * 10; // $10 per seat
    return usageCost + seatsCost;
  }

  // You might want a separate function just for the hours cost for checkout
  function calculateHoursCost() {
    const costPerHour = getCostPerHourForPlus(chosenHours);
    return chosenHours * costPerHour;
  }

  // const hoursMonthlyCost = calculateTotalMonthlyCost() - teamSeats * 10; // Usage cost (base + overage)
  // const seatsMonthlyCost = teamSeats * 10; // Cost for seats only
  // const totalMonthlyCost = hoursMonthlyCost + seatsMonthlyCost; // Combined cost

  // --- Combined Checkout Handler for Plus (with optional Team) ---
  async function handleCheckout() {
    if (isCheckingOut || (teamSeats > 0 && teamSeats < 2)) return; // Prevent checkout if invalid seats
    setIsCheckingOut(true);

    // Prompt for workspace name if team seats are selected and name isn't set
    // For simplicity, let's assume workspace name is handled post-checkout or isn't strictly needed for checkout itself
    // If needed pre-checkout, you'd open a modal here first.

    try {
      const hoursCost = calculateHoursCost(); // Use the dedicated function

      const response = await fetch("/pricing", {
        // Your API endpoint
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Send both hours and seats
          hours: chosenHours,
          seats: teamSeats,
          // Optionally send cost breakdown if needed backend-side, but backend should recalculate
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Failed to create checkout session.",
        );
      }

      const { sessionId } = await response.json();
      const { loadStripe } = await import("@stripe/stripe-js");
      const stripePublicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

      if (!stripePublicKey) {
        console.error("Stripe public key is not set.");
        alert("Configuration error. Please contact support.");
        setIsCheckingOut(false);
        return;
      }

      const stripe = await loadStripe(stripePublicKey);
      if (!stripe) throw new Error("Stripe could not be loaded.");

      // Redirect to Stripe Checkout
      const { error } = await stripe.redirectToCheckout({ sessionId });
      if (error) {
        console.error("Checkout redirection error:", error);
        alert(`Checkout error: ${error.message}`);
      }
      // On success, Stripe redirects to success_url handled by useEffect
    } catch (error: any) {
      console.error("Checkout process error:", error);
      alert(`Something went wrong: ${error.message || "Please try again."}`);
    } finally {
      // Only set checking out to false if redirect fails immediately
      if (!window.location.href.includes("stripe.com")) {
        setIsCheckingOut(false);
      }
    }
  }

  function handleWorkspaceContinue() {
    // For example, store the workspace name in localStorage
    localStorage.setItem("pendingWorkspaceName", workspaceName);

    // Close the modal
    setIsWorkspaceNameOpen(false);

    // Proceed with the existing checkout
    handleCheckout();
  }

  const costPerHourPlus = getCostPerHourForPlus(chosenHours);
  const overageRatePlus = getOverageRateForPlus(chosenHours);
  const hoursMonthlyCost = calculateHoursCost(); // Cost for hours only
  const seatsMonthlyCost = teamSeats * 10; // Cost for seats only
  const totalMonthlyCost = hoursMonthlyCost + seatsMonthlyCost; // Combined cost

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-purple-50 to-white">
      <Nav />
      <div className="relative pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        {/* Background elements */}
        <div className="absolute inset-0 opacity-30" style={{ zIndex: -1 }}>
          <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-r from-purple-300 to-indigo-300 rounded-full filter blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-72 h-72 bg-gradient-to-r from-blue-300 to-teal-300 rounded-full filter blur-3xl"></div>
        </div>
        {/* Header */}
        <div className="max-w-7xl relative z-10 mx-auto text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl lg:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
            Choose Your Plan
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-600">
            Simple pricing for individuals and teams.
          </p>
          <div className="mt-4 bg-white border border-indigo-100 rounded-lg shadow-sm p-4 inline-flex items-center justify-center">
            <Users className="w-5 h-5 mr-2 text-indigo-600" />
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-indigo-800">
                Team Plan Benefit:{" "}
              </span>
              Usage by invited team members doesn’t count towards your monthly
              hours—just pay a flat
              <strong> $10/month per seat.</strong>
            </p>
          </div>
        </div>
        <div
          id="pricing-tiers"
          className="mt-16 md:grid md:grid-cols-3 md:gap-10 lg:max-w-[1800px] lg:mx-auto items-stretch px-8"
        >
          {/* Free Tier */}
          <div className="cursor-pointer hover:-translate-y-1 transition-transform duration-200 h-full">
            <Card
              className={`flex flex-col h-full overflow-hidden ${
                selectedPlan === "free"
                  ? "border-indigo-500 border-2 shadow-lg shadow-indigo-100"
                  : "border border-gray-200 hover:border-indigo-300 transition-all"
              }`}
              onClick={() => setSelectedPlan("free")}
            >
              <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 pb-8">
                <CardTitle className="text-2xl font-bold flex items-center">
                  <div className="w-8 h-8 mr-2 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-indigo-600" />
                  </div>
                  Free
                </CardTitle>
                <CardDescription className="text-gray-600">
                  For individuals starting out
                </CardDescription>
                <div className="mt-4 text-center">
                  <div className="text-center mb-4">
                    <span className="text-5xl font-extrabold text-gray-900">
                      $0
                    </span>
                    <span className="text-lg font-medium text-gray-500">
                      /month
                    </span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">
                      Includes 100 hours/month
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-6 flex-grow">
                <ul className="space-y-4">
                  <FeatureItem>Up to 3 Blueprints</FeatureItem>
                  <FeatureItem>Basic customer interactions</FeatureItem>
                  <FeatureItem>Standard support</FeatureItem>
                  <FeatureItem>Community access</FeatureItem>
                  <FeatureItem>100 hours/month included</FeatureItem>
                  <FeatureItem included={false}>Limited analytics</FeatureItem>
                  <FeatureItem included={false}>
                    No smart recommendations
                  </FeatureItem>
                </ul>
              </CardContent>

              <CardFooter className="pt-4 pb-8 mt-auto">
                <Button
                  variant={selectedPlan === "free" ? "default" : "outline"}
                  className={`w-full h-12 text-base ${
                    selectedPlan === "free"
                      ? "bg-indigo-600 hover:bg-indigo-700 cursor-default"
                      : "border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPlan("free");
                  }} // Prevent card click propagation if needed
                  aria-pressed={selectedPlan === "free"}
                >
                  {selectedPlan === "free" ? "Current Plan" : "Choose Free"}
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Starter Tier */}
          <div className="cursor-pointer hover:-translate-y-1 transition-transform duration-200 h-full">
            <Card
              className={`flex flex-col h-full overflow-hidden ${
                selectedPlan === "starter"
                  ? "border-indigo-500 border-2 shadow-lg shadow-indigo-100"
                  : "border border-gray-200 hover:border-indigo-300 transition-all"
              }`}
              onClick={() => setSelectedPlan("starter")}
            >
              <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 pb-8">
                <CardTitle className="text-2xl font-bold flex items-center">
                  <div className="w-8 h-8 mr-2 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-indigo-600" />
                  </div>
                  Starter
                </CardTitle>
                <CardDescription className="text-gray-600">
                  For prosumers &amp; power users
                </CardDescription>
                <div className="mt-4 text-center">
                  <div className="text-center mb-4">
                    <span className="text-5xl font-extrabold text-gray-900">
                      $10
                    </span>
                    <span className="text-lg font-medium text-gray-500">
                      /month
                    </span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">
                      Includes 500 hours/month
                    </p>
                    <p className="text-xs text-gray-500">Overage: $1/hr</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 flex-grow">
                <ul className="space-y-4">
                  <FeatureItem>Unlimited Blueprints</FeatureItem>
                  <FeatureItem>Early access to new features</FeatureItem>
                  <FeatureItem included={false}>
                    No commercial/team usage
                  </FeatureItem>
                  <FeatureItem included={false}>
                    Max 10 concurrent users
                  </FeatureItem>
                  <FeatureItem included={false}>
                    No Plus features (recommendations)
                  </FeatureItem>
                </ul>
              </CardContent>
              <CardFooter className="pt-4 pb-8 mt-auto">
                <Button
                  variant={selectedPlan === "starter" ? "default" : "outline"}
                  className={`w-full h-12 text-base ${
                    selectedPlan === "starter"
                      ? "bg-indigo-600 hover:bg-indigo-700 cursor-default"
                      : "border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPlan("starter");
                  }}
                  aria-pressed={selectedPlan === "starter"}
                >
                  {selectedPlan === "starter"
                    ? "Current Plan"
                    : "Choose Starter"}
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Combined Plus + Team Tier */}
          <div
            className="cursor-pointer hover:-translate-y-1 transition-transform duration-200 h-full"
            onClick={(e) => {
              // Select this plan if clicking outside interactive elements
              if (
                e.target.tagName !== "INPUT" &&
                e.target.tagName !== "SELECT" &&
                e.target.tagName !== "BUTTON" &&
                !e.target.closest("button") &&
                !e.target.closest("input[type='number']") && // Ignore number input clicks
                selectedPlan !== "plus"
              ) {
                setSelectedPlan("plus");
              }
            }}
          >
            <Card
              className={`flex flex-col h-full overflow-hidden ${
                selectedPlan === "plus"
                  ? "border-indigo-500 border-2 shadow-lg shadow-indigo-100"
                  : "border border-gray-200 hover:border-indigo-300 transition-all"
              }`}
            >
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-violet-50 pb-8">
                <CardTitle className="text-2xl font-bold flex items-center">
                  <div className="w-8 h-8 mr-2 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                  </div>
                  Plus
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Pay for customer hours, add team seats optionally.
                </CardDescription>

                {/* Combined Price Display */}
                <div className="mt-4 text-center">
                  <div className="text-center mb-4">
                    <span className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                      ${Math.round(totalMonthlyCost)}
                    </span>
                    <span className="text-lg font-medium text-gray-500">
                      /month
                    </span>
                    {teamSeats > 0 && (
                      <p className="text-sm text-gray-500 mt-1">
                        (${Math.round(hoursMonthlyCost)} for hours + $
                        {seatsMonthlyCost} for {teamSeats} seats)
                      </p>
                    )}
                  </div>

                  {/* Hours Selector */}
                  <div className="bg-indigo-50 p-3 rounded-lg mb-3">
                    <div className="mb-2 flex justify-between items-center">
                      <span className="text-sm font-medium text-indigo-700">
                        Customer Hours:
                      </span>
                      <span className="text-sm bg-indigo-200 text-indigo-800 px-2 py-1 rounded-md font-medium">
                        ${costPerHourPlus.toFixed(2)}/hour
                      </span>
                    </div>
                    <select
                      value={chosenHours}
                      onChange={(e) => {
                        setChosenHours(Number(e.target.value));
                        setSelectedPlan("plus"); // Ensure plan is selected when changing
                      }}
                      className="w-full p-2 border rounded-md border-indigo-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 bg-white"
                      onClick={(e) => e.stopPropagation()} // Prevent card selection
                    >
                      {hourTiers.map((hours) => (
                        <option key={hours} value={hours}>
                          {hours} hours
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-indigo-600 mt-1">
                      Overage: ${overageRatePlus.toFixed(2)}/hour
                    </p>
                  </div>

                  {/* Team Seat Selector */}
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <div className="mb-2 flex justify-between items-center">
                      <span className="text-sm font-medium text-purple-700">
                        Team Seats (Optional):
                      </span>
                      <span className="text-sm bg-purple-200 text-purple-800 px-2 py-1 rounded-md font-medium">
                        $10/seat/month
                      </span>
                    </div>
                    <div className="flex items-center justify-center space-x-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="border-purple-300 text-purple-600 hover:bg-purple-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTeamSeats((prev) => Math.max(0, prev - 1));
                          setSelectedPlan("plus");
                        }}
                        disabled={teamSeats <= 0}
                      >
                        {" "}
                        -{" "}
                      </Button>
                      <Input
                        type="number"
                        min="0"
                        value={teamSeats}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setTeamSeats(isNaN(val) || val < 0 ? 0 : val);
                          setSelectedPlan("plus");
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-16 text-center border-purple-300 focus:border-purple-500 focus:ring-purple-200"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="border-purple-300 text-purple-600 hover:bg-purple-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTeamSeats((prev) => prev + 1);
                          setSelectedPlan("plus");
                        }}
                      >
                        {" "}
                        +{" "}
                      </Button>
                    </div>
                    {teamSeats > 0 && teamSeats < 2 && (
                      <p className="text-xs text-red-600 mt-1">
                        Minimum 2 seats if adding team.
                      </p>
                    )}
                    {teamSeats === 1 && setTeamSeats(2)}{" "}
                    {/* Auto-adjust to minimum 2 if 1 is entered/clicked */}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-6 flex-grow">
                {/* 2-column grid to reduce height */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <ul className="space-y-4">
                    <FeatureItem>Everything in Free</FeatureItem>
                    <FeatureItem>Unlimited Blueprints</FeatureItem>
                    <FeatureItem>Advanced customer interactions</FeatureItem>
                    <FeatureItem>Priority support</FeatureItem>
                    <FeatureItem>Insights & Analytics</FeatureItem>
                    <FeatureItem>Smart recommendations</FeatureItem>
                    <FeatureItem highlight={true}>
                      Sliding discount on customer hours
                    </FeatureItem>
                  </ul>

                  <ul className="space-y-4">
                    <FeatureItem included={teamSeats > 0}>
                      Create and share custom Blueprints (with Team)
                    </FeatureItem>
                    <FeatureItem included={teamSeats > 0}>
                      Secure collaborative workspace (with Team)
                    </FeatureItem>
                    <FeatureItem highlight={true} included={teamSeats > 0}>
                      Usage by invited team members is included per seat
                    </FeatureItem>
                  </ul>
                </div>
              </CardContent>

              <CardFooter className="pt-4 pb-8 mt-auto">
                {selectedPlan === "plus" ? (
                  <div className="space-y-3 w-full">
                    <div className="text-sm text-center text-gray-600 mb-2">
                      Selected: {chosenHours} hours + {teamSeats} seats
                    </div>
                    {teamSeats > 0 ? (
                      <Button
                        className="w-full h-12 text-base bg-green-600 hover:bg-green-700 transition-all ..."
                        onClick={() => {
                          // If user has seats, open workspace modal first
                          setIsWorkspaceNameOpen(true);
                        }}
                        disabled={isCheckingOut || teamSeats < 2}
                      >
                        {isCheckingOut ? (
                          <>
                            <svg
                              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4m2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            Processing...
                          </>
                        ) : (
                          <>
                            <span>Next: Workspace</span>
                            <span className="font-bold">
                              ${Math.round(totalMonthlyCost)}/month
                            </span>
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        className="w-full h-12 text-base bg-green-600 hover:bg-green-700 transition-all ..."
                        onClick={handleCheckout}
                        disabled={isCheckingOut}
                      >
                        {isCheckingOut ? (
                          <>
                            <svg
                              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4m2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            Processing...
                          </>
                        ) : (
                          <>
                            <span>Next: Workspace</span>
                            <span className="font-bold">
                              ${Math.round(totalMonthlyCost)}/month
                            </span>
                          </>
                        )}
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      className="w-full border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPlan("free");
                        setTeamSeats(0); // Reset seats if canceling
                      }}
                      disabled={isCheckingOut}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-12 text-base border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPlan("plus");
                    }}
                    aria-pressed={selectedPlan === "plus"}
                  >
                    Configure Plan
                  </Button>
                )}
              </CardFooter>
            </Card>
          </div>
        </div>{" "}
        {/* End Pricing Tiers Grid */}
        {/* Floating Calculator Indicator (Keep as is) */}
        {showCalculatorIndicator && (
          <div
            className={`hidden md:flex cursor-pointer fixed right-8 bottom-28 z-20 flex-col items-center ${
              isIndicatorBouncing ? "animate-bounce" : ""
            }`}
            onClick={() => {
              document
                .getElementById("calculator")
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
              setShowCalculatorIndicator(false);
            }}
          >
            <div className="bg-indigo-600 text-white p-3 rounded-full shadow-lg hover:bg-indigo-700 transition-colors duration-300 flex flex-col items-center">
              <Calculator className="w-6 h-6 mb-1" />
              <div className="text-xs font-semibold">Calculator</div>
            </div>
            <div className="text-indigo-600 mt-2 text-sm font-medium">
              Try Our Calculator
            </div>
            <svg
              className="w-6 h-6 mt-1 text-indigo-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {" "}
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />{" "}
            </svg>
          </div>
        )}
        {/* Team Usage Benefits Card (Keep as is, maybe update text slightly) */}
        <div className="mt-16 max-w-3xl mx-auto">
          <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-0 shadow-md overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5"></div>
            <CardHeader>
              <CardTitle className="text-xl text-indigo-800 flex items-center">
                <Users className="w-5 h-5 mr-2 text-indigo-600" />
                Team Plan Benefit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start space-x-3">
                <div className="mt-1 bg-indigo-100 rounded-full p-1">
                  <Check className="flex-shrink-0 w-4 h-4 text-indigo-600" />
                </div>
                <p className="text-indigo-900">
                  <span className="font-medium">Usage Included:</span>{" "}
                  Interactions from invited team members using Blueprints within
                  your workspace do not count towards individual usage limits or
                  incur overage charges. Pay a flat fee per seat.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Blueprint Usage Calculator (Keep as is) */}
        <div
          id="calculator"
          className="mt-16 max-w-3xl mx-auto"
          style={{ scrollMarginTop: "100px" }}
        >
          <Card className="overflow-hidden border border-gray-200 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50">
              <CardTitle className="flex items-center text-xl">
                <Calculator className="w-5 h-5 mr-2 text-indigo-600" />
                Plus Plan Usage Calculator
              </CardTitle>
              <CardDescription>
                Estimate monthly hours needed for the <strong>Plus</strong> plan
                based on customer traffic. (Not applicable to Team plan).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 pt-8">
              {/* ... (calculator inputs remain the same) ... */}
              {/* Customer Count & Basis */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700 flex items-center">
                  <Users className="w-4 h-4 mr-2 text-indigo-500" />
                  Number of Customers
                </Label>
                <div className="flex items-center space-x-4">
                  <select
                    value={customerCount}
                    onChange={(e) => setCustomerCount(Number(e.target.value))}
                    className="p-2 border rounded-md border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 bg-white"
                  >
                    {" "}
                    <option value={100}>100</option>{" "}
                    <option value={250}>250</option>{" "}
                    <option value={500}>500</option>{" "}
                    <option value={1000}>1000</option>{" "}
                    <option value={5000}>5000</option>{" "}
                    <option value={10000}>10000</option>{" "}
                  </select>
                  <Input
                    type="number"
                    value={customerCount}
                    onChange={(e) => setCustomerCount(Number(e.target.value))}
                    className="w-24 border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  />
                  <select
                    value={customerBasis}
                    onChange={(e) =>
                      setCustomerBasis(
                        e.target.value as "day" | "week" | "month",
                      )
                    }
                    className="p-2 border rounded-md border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 bg-white"
                  >
                    {" "}
                    <option value="day">Per Day</option>{" "}
                    <option value="week">Per Week</option>{" "}
                    <option value="month">Per Month</option>{" "}
                  </select>
                </div>
              </div>
              {/* Average Visit Duration */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700 flex items-center">
                  {" "}
                  <Clock className="w-4 h-4 mr-2 text-indigo-500" /> Average
                  Visit Duration (minutes){" "}
                </Label>
                <div className="flex items-center space-x-4">
                  <select
                    value={avgVisitDuration}
                    onChange={(e) =>
                      setAvgVisitDuration(Number(e.target.value))
                    }
                    className="p-2 border rounded-md border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 bg-white"
                  >
                    {" "}
                    <option value={15}>15</option>{" "}
                    <option value={30}>30</option>{" "}
                    <option value={45}>45</option>{" "}
                    <option value={60}>60</option>{" "}
                    <option value={90}>90</option>{" "}
                    <option value={120}>120</option>{" "}
                    <option value={180}>180</option>{" "}
                  </select>
                  <Input
                    type="number"
                    value={avgVisitDuration}
                    onChange={(e) =>
                      setAvgVisitDuration(Number(e.target.value))
                    }
                    className="w-24 border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  />
                </div>
              </div>
              {/* Blueprint Adoption Percentage */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700 flex items-center">
                  {" "}
                  <Sparkles className="w-4 h-4 mr-2 text-indigo-500" />{" "}
                  Percentage of Visitors Using Blueprint (%){" "}
                </Label>
                <div className="flex items-center space-x-4">
                  <select
                    value={adoptionPercentage}
                    onChange={(e) =>
                      setAdoptionPercentage(Number(e.target.value))
                    }
                    className="p-2 border rounded-md border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 bg-white"
                  >
                    {" "}
                    <option value={10}>10%</option>{" "}
                    <option value={20}>20%</option>{" "}
                    <option value={30}>30%</option>{" "}
                    <option value={40}>40%</option>{" "}
                    <option value={50}>50%</option>{" "}
                  </select>
                  <Input
                    type="number"
                    value={adoptionPercentage}
                    onChange={(e) =>
                      setAdoptionPercentage(Number(e.target.value))
                    }
                    className="w-24 border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  />
                </div>
                <p className="text-sm text-gray-500">
                  {" "}
                  Default is 10% (average so far).{" "}
                </p>
              </div>
              {/* Calculation Result */}
              <div className="border-t border-gray-100 pt-6 mt-6">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium text-gray-700">
                    {" "}
                    Estimated Monthly Blueprint Usage:{" "}
                  </span>
                  <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                    {" "}
                    {estimatedBlueprintUsage.toFixed(2)} hrs{" "}
                  </span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex space-x-2 py-6 bg-gray-50 border-t border-gray-100">
              <Button
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                onClick={calculateBlueprintUsage}
              >
                {" "}
                Calculate Usage{" "}
              </Button>
              <Button
                variant="outline"
                className="w-full border-indigo-600 text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                onClick={handleUseThisEstimate}
              >
                {" "}
                Use Estimate for Plus Plan{" "}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>{" "}
      {/* FAQs */}
      <motion.div variants={itemVariants} className="mb-10">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Frequently Asked Questions
          </h2>
          <p className="text-gray-600 mt-2">
            Have questions about plans? We've got answers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              question: "How does the usage-based pricing work?",
              answer:
                "Our pricing is based on the total hours your customers spend interacting with your Blueprints. You only pay for what you use, with volume discounts as your usage increases.",
            },
            {
              question: "What happens if I exceed my chosen hours?",
              answer:
                "If you exceed your chosen hours on the Plus plan, you'll be charged the overage rate for each additional hour used. This is slightly higher than your base rate.",
            },
            {
              question: "Can I upgrade or downgrade at any time?",
              answer:
                "Yes, you can upgrade to Plus at any time. Downgrades take effect at the end of your current billing cycle.",
            },
            {
              question: "Are there any additional fees?",
              answer:
                "No, there are no hidden fees. The price you see is the price you pay based on your usage and chosen plan.",
            },
          ].map((faq, index) => (
            <Card key={index} className="border border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-gray-900">
                  {faq.question}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">{faq.answer}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>
      {/* Need Help Section */}
      <motion.div variants={itemVariants} className="mb-16">
        <Card className="border-0 shadow-md bg-gradient-to-r from-indigo-50 to-violet-50">
          <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between">
            <div className="mb-6 md:mb-0">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Need Help Choosing?
              </h3>
              <p className="text-gray-600">
                Our team is ready to help you find the perfect plan for your
                needs.
              </p>
            </div>
            <Button className="bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 shadow-sm">
              Contact Support
            </Button>
          </CardContent>
        </Card>
      </motion.div>
      {/* End Main Content Container */}
      <Footer />
      <WorkspaceNameModal
        isOpen={isWorkspaceNameOpen}
        onClose={() => setIsWorkspaceNameOpen(false)}
        workspaceName={workspaceName}
        setWorkspaceName={setWorkspaceName}
        onContinue={handleWorkspaceContinue}
        isProcessing={isCheckingOut}
      />
    </div> // End Root Div
  );
}
