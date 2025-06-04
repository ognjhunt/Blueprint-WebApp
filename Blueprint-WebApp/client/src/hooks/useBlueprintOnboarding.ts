// src/hooks/useBlueprintOnboarding.ts
"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function useBlueprintOnboarding() {
  const { currentUser } = useAuth();

  // State for onboarding
  const [onboardingCompleted, setOnboardingCompleted] = useState(
    localStorage.getItem("blueprintOnboardingCompleted") === "true"
  );
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);
  const [viewMode, setViewMode] = useState<"2D" | "3D" | "WORKFLOW">("2D");

  // Refs for UI elements to highlight
  const viewToggleRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const propertiesPanelRef = useRef<HTMLDivElement>(null);
  const alignButtonRef = useRef<HTMLButtonElement>(null);
  const markAreasRef = useRef<HTMLButtonElement>(null);
  const qrCodeRef = useRef<HTMLButtonElement>(null);
  const originPointRef = useRef<HTMLDivElement>(null);

  // Check if onboarding should start on mount
  useEffect(() => {
    const shouldStartOnboarding =
      localStorage.getItem("startBlueprintOnboarding") === "true" ||
      (currentUser && !localStorage.getItem("blueprintOnboardingCompleted"));

    if (shouldStartOnboarding && !onboardingCompleted) {
      localStorage.removeItem("startBlueprintOnboarding");
      setTimeout(() => {
        setShowWelcomeModal(true);
      }, 1500);
    }
  }, [currentUser, onboardingCompleted]);

  const startOnboarding = () => {
    setIsOnboardingActive(true);
    setShowWelcomeModal(false);
    setOnboardingStep(0);
    setViewMode("2D");
  };

  const skipOnboarding = () => {
    setIsOnboardingActive(false);
    setShowWelcomeModal(false);
    setOnboardingCompleted(true);
    localStorage.setItem("blueprintOnboardingCompleted", "true");
  };

  const nextStep = () => {
    const totalSteps = 6; // Match Dashboard's 6 steps
    if (onboardingStep < totalSteps - 1) {
      setOnboardingStep((prev) => prev + 1);
      // Adjust viewMode based on step if needed
      if (onboardingStep === 4) setViewMode("3D"); // For origin point step
    } else {
      completeOnboarding();
    }
  };

  const prevStep = () => {
    if (onboardingStep > 0) {
      setOnboardingStep((prev) => prev - 1);
      if (onboardingStep === 5) setViewMode("2D"); // Revert from 3D
    }
  };

  const completeOnboarding = () => {
    setIsOnboardingActive(false);
    setOnboardingCompleted(true);
    localStorage.setItem("blueprintOnboardingCompleted", "true");
  };

  return {
    onboardingCompleted,
    onboardingStep,
    showWelcomeModal,
    isOnboardingActive,
    viewMode,
    viewToggleRef,
    toolbarRef,
    propertiesPanelRef,
    alignButtonRef,
    markAreasRef,
    qrCodeRef,
    originPointRef,
    startOnboarding,
    skipOnboarding,
    nextStep,
    prevStep,
    completeOnboarding,
    setViewMode,
  };
}