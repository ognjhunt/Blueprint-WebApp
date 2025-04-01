import { useState, useRef, useEffect } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { useToast } from "@/hooks/use-toast";

export function useDashboardOnboarding() {
  // Track completion in localStorage
  const [onboardingCompleted, setOnboardingCompleted] = useLocalStorage(
    "blueprint_onboarding_completed",
    false,
  );

  // Current onboarding step
  const [onboardingStep, setOnboardingStep] = useState(0);

  // Show welcome modal
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Active tab for navigation
  const [activeTab, setActiveTab] = useState("overview");

  // Track if onboarding is active
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);

  // Toast for notifications
  const { toast } = useToast();

  // Element refs for spotlights
  const overviewTabRef = useRef(null);
  const statsCardRef = useRef(null);
  const blueprintsTabRef = useRef(null);
  const blueprintItemRef = useRef(null);
  const createBlueprintRef = useRef(null);

  // Initialize onboarding
  useEffect(() => {
    // Only show onboarding if not completed and not waiting for mapping
    const isWaitingForMapping =
      localStorage.getItem("waitingForMapping") === "true";
    const scanCompleted = localStorage.getItem("scanCompleted") === "true";

    if (!onboardingCompleted && !isWaitingForMapping && scanCompleted) {
      const timer = setTimeout(() => {
        setShowWelcomeModal(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [onboardingCompleted]);

  // Start the onboarding
  const startOnboarding = () => {
    setShowWelcomeModal(false);
    setIsOnboardingActive(true);
    setOnboardingStep(0);
    showSuccessToast("Let's get started with your Blueprint tour!");
  };

  // Skip the onboarding
  const skipOnboarding = () => {
    setShowWelcomeModal(false);
    setIsOnboardingActive(false);
    setOnboardingCompleted(true);
  };

  // Go to next step
  const nextStep = () => {
    // Total steps in the onboarding flow
    const totalSteps = 6;

    if (onboardingStep < totalSteps - 1) {
      setOnboardingStep((prevStep) => prevStep + 1);

      // Switch tabs when needed
      if (onboardingStep === 1) {
        setActiveTab("blueprints");
      }
    } else {
      // Complete onboarding
      completeOnboarding();
    }
  };

  // Go to previous step
  const prevStep = () => {
    if (onboardingStep > 0) {
      setOnboardingStep((prevStep) => prevStep - 1);

      // Switch tabs when needed
      if (onboardingStep === 2) {
        setActiveTab("overview");
      }
    }
  };

  // Complete the onboarding
  const completeOnboarding = () => {
    setIsOnboardingActive(false);
    setOnboardingCompleted(true);
    showSuccessToast("Onboarding complete! Welcome to Blueprint.");
  };

  // Helper for success toasts
  const showSuccessToast = (message) => {
    toast({
      title: "Blueprint",
      description: message,
      variant: "default",
    });
  };

  return {
    onboardingCompleted,
    onboardingStep,
    showWelcomeModal,
    activeTab,
    isOnboardingActive,
    overviewTabRef,
    statsCardRef,
    blueprintsTabRef,
    blueprintItemRef,
    createBlueprintRef,
    setActiveTab,
    startOnboarding,
    skipOnboarding,
    nextStep,
    prevStep,
    completeOnboarding,
  };
}
