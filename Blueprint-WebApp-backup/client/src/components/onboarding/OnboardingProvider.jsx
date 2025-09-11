import React, { createContext, useState, useContext, useEffect } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

// Create context
const OnboardingContext = createContext(null);

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
};

export function OnboardingProvider({ children }) {
  // Get onboarding state from localStorage
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useLocalStorage(
    "blueprint_onboarding_completed",
    false,
  );

  // Current step in the onboarding flow
  const [currentStep, setCurrentStep] = useState(0);

  // Whether onboarding is active
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);

  // Current section of the app (dashboard, blueprints, editor)
  const [currentSection, setCurrentSection] = useState("dashboard");

  // Initialize onboarding based on completion status
  useEffect(() => {
    if (!hasCompletedOnboarding) {
      // Delay starting onboarding to ensure UI is ready
      const timer = setTimeout(() => {
        setIsOnboardingActive(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [hasCompletedOnboarding]);

  // Next step handler
  const nextStep = () => {
    setCurrentStep((prev) => prev + 1);
  };

  // Previous step handler
  const prevStep = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  // Skip onboarding
  const skipOnboarding = () => {
    setIsOnboardingActive(false);
    setHasCompletedOnboarding(true);
  };

  // Complete onboarding
  const completeOnboarding = () => {
    setIsOnboardingActive(false);
    setHasCompletedOnboarding(true);
    setCurrentStep(0);
  };

  // Restart onboarding
  const restartOnboarding = () => {
    setCurrentStep(0);
    setIsOnboardingActive(true);
    setHasCompletedOnboarding(false);
  };

  // Change section
  const changeSection = (section) => {
    setCurrentSection(section);
  };

  const value = {
    currentStep,
    isOnboardingActive,
    hasCompletedOnboarding,
    currentSection,
    nextStep,
    prevStep,
    skipOnboarding,
    completeOnboarding,
    restartOnboarding,
    changeSection,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}
