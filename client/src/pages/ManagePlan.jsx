"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Zap,
  Sparkles,
  CreditCard,
  CheckCircle,
  Clock,
  Users,
  Building2,
  TrendingUp,
  ChevronRight,
  ArrowRight,
  Calendar,
  Calculator,
  Gauge,
  PieChart,
  BarChart4,
  PanelTop,
  InfoIcon,
  AlertCircle,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

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

const cardVariants = {
  hover: {
    y: -8,
    boxShadow:
      "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    transition: { type: "spring", stiffness: 300, damping: 20 },
  },
  tap: {
    y: -3,
    boxShadow:
      "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    scale: 0.99,
  },
};

const FeatureItem = ({ included = true, children }) => (
  <li className="flex items-start mb-3">
    <div
      className={`flex-shrink-0 w-5 h-5 mt-0.5 ${included ? "text-emerald-500" : "text-gray-300"}`}
    >
      <CheckCircle className="w-5 h-5" />
    </div>
    <span
      className={`ml-3 text-sm ${included ? "text-gray-700" : "text-gray-500"}`}
    >
      {children}
    </span>
  </li>
);

const PlanCard = ({
  title,
  icon,
  price,
  priceDetail,
  description,
  features,
  isSelected,
  isRecommended,
  onClick,
  actionText,
  onAction,
}) => (
  <motion.div
    variants={cardVariants}
    whileHover="hover"
    whileTap="tap"
    className={`h-full overflow-hidden ${
      isSelected
        ? "ring-2 ring-indigo-500 shadow-xl shadow-indigo-100"
        : "border border-gray-200"
    }`}
  >
    <Card className="h-full flex flex-col relative">
      {isRecommended && (
        <div className="absolute top-0 right-0">
          <Badge className="bg-gradient-to-r from-amber-400 to-amber-500 text-white border-0 rounded-bl-lg rounded-tr-lg py-1 px-3 font-medium">
            RECOMMENDED
          </Badge>
        </div>
      )}
      <CardHeader
        className={`pb-6 ${isSelected ? "bg-gradient-to-br from-indigo-50 to-violet-50" : "bg-gray-50"}`}
      >
        <div className="flex items-center mb-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${
              isSelected ? "bg-indigo-100" : "bg-gray-100"
            }`}
          >
            {icon}
          </div>
          <CardTitle className="text-xl font-bold">{title}</CardTitle>
        </div>
        <div className="mt-3">
          <span
            className={`text-4xl font-extrabold ${
              isSelected
                ? "bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600"
                : "text-gray-800"
            }`}
          >
            {price}
          </span>
          <span className="text-sm font-medium text-gray-500 ml-2">
            {priceDetail}
          </span>
        </div>
        <CardDescription className="mt-3 text-gray-600">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <FeatureItem key={index} included={feature.included}>
              {feature.text}
            </FeatureItem>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="pt-4 pb-6">
        <Button
          onClick={onAction}
          className={`w-full h-11 text-base font-medium transition-all ${
            isSelected
              ? "border-2 border-indigo-600 text-indigo-600 bg-white hover:bg-indigo-50"
              : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md"
          }`}
        >
          {actionText}
        </Button>
      </CardFooter>
    </Card>
  </motion.div>
);

const UsageStatsCard = ({
  icon,
  title,
  value,
  change,
  changeType = "positive",
}) => (
  <Card className="overflow-hidden border-0 shadow-md">
    <CardContent className="p-6">
      <div className="flex items-start">
        <div
          className={`rounded-full p-3 mr-4 ${
            changeType === "positive"
              ? "bg-emerald-100"
              : changeType === "neutral"
                ? "bg-blue-100"
                : "bg-amber-100"
          }`}
        >
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold text-gray-900 mr-2">
              {value}
            </span>
            {change && (
              <span
                className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                  changeType === "positive"
                    ? "bg-emerald-100 text-emerald-800"
                    : changeType === "neutral"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-amber-100 text-amber-800"
                }`}
              >
                {change}
              </span>
            )}
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function ManagePlan() {
  const { currentUser } = useAuth();
  const [userPlan, setUserPlan] = useState("free");
  const [chosenHours, setChosenHours] = useState(0);
  const [estimatedUsage, setEstimatedUsage] = useState(0);
  const [usageStats, setUsageStats] = useState({
    currentMonthHours: 0,
    lastMonthHours: 0,
    activeBlueprints: 0,
    avgDailyUsage: 0,
    renewalDate: null,
    billingCycle: "monthly",
  });
  const router = useLocation();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Blueprint Usage Calculator state
  const [customerCount, setCustomerCount] = useState(500);
  const [customerBasis, setCustomerBasis] = useState("day");
  const [avgVisitDuration, setAvgVisitDuration] = useState(30);
  const [adoptionPercentage, setAdoptionPercentage] = useState(10);
  const [estimatedBlueprintUsage, setEstimatedBlueprintUsage] = useState(0);

  // Price calculation functions
  const getCostPerHourForPlus = (hours) => {
    const minHours = 100;
    const maxHours = 10000;
    const maxDiscountRate = 0.6;
    const fullRate = 1.0;

    if (hours <= minHours) return fullRate;
    if (hours >= maxHours) return maxDiscountRate;

    const ratio = (hours - minHours) / (maxHours - minHours);
    return fullRate - (fullRate - maxDiscountRate) * ratio;
  };

  const getOverageRateForPlus = (hours) => {
    const costPerHour = getCostPerHourForPlus(hours);
    return costPerHour + 0.2;
  };

  const calculateMonthlyCost = () => {
    if (userPlan === "free") {
      return 0;
    } else {
      const costPerHour = getCostPerHourForPlus(chosenHours);
      const baseCost = chosenHours * costPerHour;
      return baseCost;
    }
  };

  const calculateUpgradeCost = () => {
    const costPerHour = getCostPerHourForPlus(chosenHours);
    return chosenHours * costPerHour;
  };

  async function calculateBlueprintUsage() {
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

    setEstimatedBlueprintUsage(Math.round(usageCapped));
    setChosenHours(Math.round(usageCapped));

    // Optionally save this calculation to user's profile
    if (currentUser) {
      try {
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, {
          estimatedMonthlyUsage: Math.round(usageCapped),
        });
      } catch (error) {
        console.error("Error saving usage estimate:", error);
      }
    }
  }

  async function handleUpgrade() {
    try {
      // Start the upgrade process
      setIsUpgrading(true);

      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);

        // Calculate renewal date (1 month from now)
        const now = new Date();
        const renewalDate = new Date(now.setMonth(now.getMonth() + 1));

        // Update user document with new plan details
        await updateDoc(userRef, {
          planType: "plus",
          planHours: chosenHours,
          planCostPerHour: getCostPerHourForPlus(chosenHours),
          planOverageRate: getOverageRateForPlus(chosenHours),
          planUpdatedAt: new Date(),
          planExpiryDate: renewalDate,
        });

        // Update local state
        setUserPlan("plus");
        setUsageStats((prev) => ({
          ...prev,
          renewalDate: renewalDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
        }));
      }

      // Complete the upgrade process
      setIsUpgrading(false);
    } catch (error) {
      console.error("Error upgrading plan:", error);
      setIsUpgrading(false);
    }
  }

  async function handleCancel() {
    try {
      setIsCancelling(true);

      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);

        // Update user document to free plan
        await updateDoc(userRef, {
          planType: "free",
          planHours: 100, // Free tier gets 100 hours
          planCostPerHour: 0,
          planOverageRate: 0,
          planUpdatedAt: new Date(),
          planExpiryDate: null,
        });

        // Update local state
        setUserPlan("free");
        setChosenHours(100);
        setUsageStats((prev) => ({
          ...prev,
          renewalDate: "N/A",
        }));
      }

      setIsCancelling(false);
    } catch (error) {
      console.error("Error cancelling plan:", error);
      setIsCancelling(false);
    }
  }

  useEffect(() => {
    const fetchUserData = async () => {
      if (currentUser) {
        try {
          const userRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();

            // Set the user's plan
            const plan = userData.planType || "free";
            setUserPlan(plan);

            // Set chosen hours based on plan
            const hours = userData.planHours || 100;
            setChosenHours(hours);

            // Calculate current usage
            const currentUsage = calculateCurrentUsage(userData);

            // Calculate renewal date
            let renewalDate = null;
            if (userData.planExpiryDate) {
              renewalDate = userData.planExpiryDate.toDate
                ? userData.planExpiryDate.toDate().toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : new Date(userData.planExpiryDate).toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    },
                  );
            } else {
              renewalDate = "N/A";
            }

            // Count active blueprints
            const activeBlueprints =
              userData.createdBlueprintIDs?.filter((id) => {
                // You could add logic to check if a blueprint is active
                return true;
              }).length || 0;

            // Set usage stats with real data
            setUsageStats({
              currentMonthHours: userData.currentMonthHours || 0,
              lastMonthHours: userData.lastMonthHours || 0,
              activeBlueprints: activeBlueprints,
              avgDailyUsage: userData.avgDailyUsage || 0,
              renewalDate: renewalDate,
              billingCycle: userData.billingCycle || "monthly",
            });

            // Set estimated usage
            setEstimatedUsage(userData.estimatedMonthlyUsage || hours);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
      setIsLoading(false);
    };

    // Helper function to calculate current usage
    const calculateCurrentUsage = (userData) => {
      // This would normally be calculated from actual usage data
      // For now, just return whatever is in userData or 0
      return userData.currentMonthHours || 0;
    };

    fetchUserData();
  }, [currentUser]);

  const monthlyCost = calculateMonthlyCost();
  const costPerHourPlus = getCostPerHourForPlus(chosenHours);
  const overageRatePlus = getOverageRateForPlus(chosenHours);
  const upgradePrice = calculateUpgradeCost();

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/40 via-purple-50/30 to-white">
      <Nav />

      <div className="relative pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        {/* Decorative elements */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{ zIndex: -1 }}
        >
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-gradient-to-br from-indigo-200/20 to-violet-200/20 rounded-full blur-3xl"></div>
          <div className="absolute top-1/4 right-0 w-72 h-72 bg-gradient-to-br from-blue-200/20 to-indigo-200/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-gradient-to-br from-purple-200/20 to-pink-200/20 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              Manage Your Blueprint Plan
            </h1>
            <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
              Review your current usage, optimize your subscription, and scale
              as you grow.
            </p>
          </motion.div>

          {isLoading ? (
            <div className="min-h-screen flex items-center justify-center">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 relative">
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-200 opacity-25"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-t-indigo-600 animate-spin"></div>
                </div>
                <p className="mt-4 text-gray-600 font-medium">
                  Loading your plan details...
                </p>
              </div>
            </div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-8"
            >
              {/* Current Plan Section */}
              <motion.div variants={itemVariants}>
                <Card className="bg-white shadow-xl border-0 overflow-hidden">
                  <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-indigo-50/30 pb-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge className="mb-2 bg-indigo-100 text-indigo-800 hover:bg-indigo-100">
                          CURRENT PLAN
                        </Badge>
                        <CardTitle className="text-2xl font-bold text-gray-900">
                          {userPlan === "free" ? "Free Plan" : "Plus Plan"}
                        </CardTitle>
                        <CardDescription className="text-gray-600 mt-1">
                          {userPlan === "free"
                            ? "Basic access with limited features"
                            : "Premium access with advanced capabilities and support"}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-gray-900">
                          ${userPlan === "free" ? "0" : monthlyCost.toFixed(2)}
                          <span className="text-sm font-normal text-gray-500">
                            /month
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {userPlan === "free"
                            ? "Up to 100 hours included"
                            : `${chosenHours} hours at $${costPerHourPlus.toFixed(2)}/hour`}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="py-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <UsageStatsCard
                        icon={<Clock className="h-5 w-5 text-blue-600" />}
                        title="Hours Used This Month"
                        value={`${usageStats.currentMonthHours} hrs`}
                        change={
                          usageStats.lastMonthHours > 0
                            ? `${usageStats.currentMonthHours > usageStats.lastMonthHours ? "+" : ""}${usageStats.currentMonthHours - usageStats.lastMonthHours} hrs`
                            : null
                        }
                        changeType={
                          usageStats.currentMonthHours >
                          usageStats.lastMonthHours
                            ? "positive"
                            : usageStats.currentMonthHours <
                                usageStats.lastMonthHours
                              ? "negative"
                              : "neutral"
                        }
                      />
                      <UsageStatsCard
                        icon={
                          <Building2 className="h-5 w-5 text-emerald-600" />
                        }
                        title="Active Blueprints"
                        value={usageStats.activeBlueprints}
                        change="+1 new"
                        changeType="positive"
                      />
                      <UsageStatsCard
                        icon={<TrendingUp className="h-5 w-5 text-amber-600" />}
                        title="Avg. Daily Usage"
                        value={`${usageStats.avgDailyUsage} hrs`}
                        change="+12.5%"
                        changeType="neutral"
                      />
                      <UsageStatsCard
                        icon={<Calendar className="h-5 w-5 text-violet-600" />}
                        title="Next Renewal"
                        value={usageStats.renewalDate}
                        change={usageStats.billingCycle}
                        changeType="neutral"
                      />
                    </div>

                    <div className="mt-6 bg-gray-50 rounded-lg p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2">
                        <div className="flex items-center mb-2 sm:mb-0">
                          <Gauge className="w-5 h-5 text-indigo-600 mr-2" />
                          <span className="font-medium text-gray-800">
                            Usage Overview
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">
                            {usageStats.currentMonthHours} hrs
                          </span>{" "}
                          of {userPlan === "free" ? "100" : chosenHours} hrs
                          used
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="h-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                          style={{
                            width: `${Math.min((usageStats.currentMonthHours / (userPlan === "free" ? 100 : chosenHours)) * 100, 100)}%`,
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between mt-2 text-xs text-gray-500">
                        <div>0 hrs</div>
                        <div>
                          {Math.round(
                            (userPlan === "free" ? 100 : chosenHours) / 2,
                          )}{" "}
                          hrs
                        </div>
                        <div>{userPlan === "free" ? 100 : chosenHours} hrs</div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t border-gray-100 bg-gray-50 py-4">
                    <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                      <div className="text-sm text-gray-600">
                        <p className="flex items-center">
                          <InfoIcon className="w-4 h-4 mr-2 text-gray-400" />
                          {userPlan === "free"
                            ? "Upgrade to Plus for unlimited blueprints and advanced features"
                            : "Your next billing date is on September 30, 2025"}
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        {userPlan === "free" ? (
                          <Button
                            className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md"
                            onClick={() => router.push("/contact")} // Use router.push for Next.js App Router
                            // Or onClick={() => window.location.href = '/pricing'} for simple redirect
                          >
                            Upgrade to Plus
                            {/* Removed ArrowRight icon */}
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              className="border-gray-300 text-gray-600 hover:bg-gray-50"
                              onClick={() => setIsCancelling(true)}
                              disabled={isCancelling}
                            >
                              {isCancelling ? "Cancelling..." : "Cancel Plan"}
                            </Button>
                            <Button
                              className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md"
                              onClick={() => router.push("/contact")} // Use router.push for Next.js App Router
                              // Or onClick={() => window.location.href = '/pricing'} for simple redirect
                            >
                              Modify Plan{" "}
                              <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardFooter>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
