// OnboardingChecklist — Minimalist onboarding checklist page
// Based on SIGNUP_ONBOARDING_SPEC.md
//
// Shows progress after signup with checklist items:
// 1. Profile complete (auto-done)
// 2. Explore marketplace
// 3. Create first order
// 4. Invite team (optional)

"use client";

import React, { useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  Store,
  ShoppingCart,
  Users,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  completed: boolean;
  primaryAction?: {
    label: string;
    href: string;
  };
  optional?: boolean;
}

function ChecklistCard({
  item,
  index,
  onAction,
}: {
  item: ChecklistItem;
  index: number;
  onAction: (href: string) => void;
}) {
  const Icon = item.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`border rounded-xl p-4 transition-all ${
        item.completed
          ? "bg-emerald-50/50 border-emerald-200"
          : "bg-white border-zinc-200 hover:border-zinc-300"
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Status Icon */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            item.completed
              ? "bg-emerald-500 text-white"
              : "bg-zinc-100 text-zinc-400"
          }`}
        >
          {item.completed ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <span className="text-sm font-medium">{index}</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className={`font-medium ${
                item.completed ? "text-emerald-700" : "text-zinc-900"
              }`}
            >
              {item.title}
            </h3>
            {item.optional && (
              <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded">
                Optional
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500 mt-0.5">{item.description}</p>

          {/* Action Button */}
          {item.primaryAction && !item.completed && (
            <Button
              onClick={() => onAction(item.primaryAction!.href)}
              size="sm"
              className="mt-3 bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {item.primaryAction.label}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}

          {item.completed && (
            <p className="text-sm text-emerald-600 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              Completed
            </p>
          )}
        </div>

        {/* Item Icon */}
        <Icon
          className={`flex-shrink-0 w-5 h-5 ${
            item.completed ? "text-emerald-400" : "text-zinc-300"
          }`}
        />
      </div>
    </motion.div>
  );
}

export default function OnboardingChecklist() {
  const { userData, currentUser } = useAuth();
  const [, setLocation] = useLocation();

  // Get first name for greeting
  const firstName = userData?.name?.split(" ")[0] || "there";

  // Build checklist items based on user progress
  const onboardingProgress = userData?.onboardingProgress || {
    profileComplete: true,
    exploreMarketplace: false,
    createFirstOrder: false,
    inviteTeam: false,
  };

  const checklistItems: ChecklistItem[] = [
    {
      id: "profile",
      title: "Profile complete",
      description: "You're all set up!",
      icon: Sparkles,
      completed: onboardingProgress.profileComplete,
    },
    {
      id: "explore",
      title: "Explore the marketplace",
      description: "Browse datasets for your project",
      icon: Store,
      completed: onboardingProgress.exploreMarketplace,
      primaryAction: {
        label: "Start Exploring",
        href: "/marketplace",
      },
    },
    {
      id: "order",
      title: "Create your first order",
      description: "Request custom data or browse existing datasets",
      icon: ShoppingCart,
      completed: onboardingProgress.createFirstOrder,
      primaryAction: {
        label: "View Datasets",
        href: "/marketplace",
      },
    },
    {
      id: "team",
      title: "Invite your team",
      description: "Collaborate with teammates",
      icon: Users,
      completed: onboardingProgress.inviteTeam,
      primaryAction: {
        label: "Invite Team",
        href: "/settings",
      },
      optional: true,
    },
  ];

  const completedCount = checklistItems.filter((item) => item.completed).length;
  const totalRequired = checklistItems.filter((item) => !item.optional).length;

  // Handle action button click
  const handleAction = useCallback(
    async (href: string) => {
      // Track marketplace exploration
      if (href === "/marketplace" && currentUser?.uid) {
        try {
          await updateDoc(doc(db, "users", currentUser.uid), {
            "onboardingProgress.exploreMarketplace": true,
            firstMarketplaceVisit: serverTimestamp(),
          });
        } catch (error) {
          console.error("Failed to update onboarding progress:", error);
        }
      }

      setLocation(href);
    },
    [currentUser?.uid, setLocation]
  );

  // Handle skip to marketplace
  const handleSkip = useCallback(async () => {
    if (currentUser?.uid) {
      try {
        await updateDoc(doc(db, "users", currentUser.uid), {
          finishedOnboarding: true,
          onboardingStep: "completed",
          "onboardingProgress.completedAt": serverTimestamp(),
        });
      } catch (error) {
        console.error("Failed to complete onboarding:", error);
      }
    }
    setLocation("/marketplace");
  }, [currentUser?.uid, setLocation]);

  // Personalized message based on primary need
  const getPersonalizedMessage = () => {
    if (!userData?.primaryNeeds || userData.primaryNeeds.length === 0) return null;

    const messages: Record<string, string> = {
      "benchmark-packs": "Explore benchmark and eval packs tailored to your needs",
      "scene-library": "Browse SimReady scenes that match your simulation goals",
      "dataset-packs": "Find robotic policy trajectories and episodes for training",
      "custom-capture": "Explore custom scene captures for your facilities",
      other: "Let's get you started with the right data",
    };

    return messages[userData.primaryNeeds[0]] || null;
  };

  const personalizedMessage = getPersonalizedMessage();

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-white py-12 px-4">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-2xl font-semibold text-zinc-900">
              Welcome to Blueprint, {firstName}!
            </h1>
            {personalizedMessage && (
              <p className="text-zinc-600 mt-2">{personalizedMessage}</p>
            )}
            {!personalizedMessage && (
              <p className="text-zinc-600 mt-2">
                Let's get you started in a few quick steps
              </p>
            )}
          </motion.div>

          {/* Progress */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <div className="flex items-center justify-between text-sm text-zinc-500 mb-2">
              <span>Your progress</span>
              <span>
                {completedCount} of {checklistItems.length} complete
              </span>
            </div>
            <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${(completedCount / checklistItems.length) * 100}%`,
                }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="h-full bg-emerald-500 rounded-full"
              />
            </div>
          </motion.div>

          {/* Checklist */}
          <div className="space-y-3">
            {checklistItems.map((item, index) => (
              <ChecklistCard
                key={item.id}
                item={item}
                index={index}
                onAction={handleAction}
              />
            ))}
          </div>

          {/* Skip Link */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-8"
          >
            <button
              onClick={handleSkip}
              className="text-sm text-zinc-500 hover:text-zinc-700 underline underline-offset-2"
            >
              Skip to Marketplace
            </button>
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
}
