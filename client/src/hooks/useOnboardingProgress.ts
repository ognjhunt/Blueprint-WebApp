// useOnboardingProgress hook
// Manages onboarding progress tracking and updates

import { useCallback, useMemo } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, type UserData } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

interface OnboardingProgress {
  profileComplete: boolean;
  exploreMarketplace: boolean;
  createFirstOrder: boolean;
  inviteTeam: boolean;
  completedAt?: Date;
}

interface UseOnboardingProgressReturn {
  progress: OnboardingProgress;
  isComplete: boolean;
  completedCount: number;
  totalSteps: number;
  currentStep: string;
  markStepComplete: (step: keyof Omit<OnboardingProgress, "completedAt">) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  getProgressPercentage: () => number;
}

export function useOnboardingProgress(): UseOnboardingProgressReturn {
  const { userData, currentUser } = useAuth();

  // Default progress if not available
  const progress: OnboardingProgress = useMemo(() => {
    return userData?.onboardingProgress || {
      profileComplete: false,
      exploreMarketplace: false,
      createFirstOrder: false,
      inviteTeam: false,
    };
  }, [userData?.onboardingProgress]);

  // Calculate completion stats
  const completedCount = useMemo(() => {
    let count = 0;
    if (progress.profileComplete) count++;
    if (progress.exploreMarketplace) count++;
    if (progress.createFirstOrder) count++;
    if (progress.inviteTeam) count++;
    return count;
  }, [progress]);

  const totalSteps = 4;

  // Determine current step
  const currentStep = useMemo(() => {
    if (!progress.profileComplete) return "profile";
    if (!progress.exploreMarketplace) return "explore";
    if (!progress.createFirstOrder) return "order";
    if (!progress.inviteTeam) return "team";
    return "completed";
  }, [progress]);

  // Check if onboarding is complete (excluding optional inviteTeam)
  const isComplete = useMemo(() => {
    return (
      progress.profileComplete &&
      progress.exploreMarketplace &&
      progress.createFirstOrder
    );
  }, [progress]);

  // Mark a specific step as complete
  const markStepComplete = useCallback(
    async (step: keyof Omit<OnboardingProgress, "completedAt">) => {
      if (!currentUser?.uid) return;

      try {
        const updates: Record<string, any> = {
          [`onboardingProgress.${step}`]: true,
        };

        // Track specific timestamps for analytics
        if (step === "exploreMarketplace" && !userData?.firstMarketplaceVisit) {
          updates.firstMarketplaceVisit = serverTimestamp();
        }
        if (step === "createFirstOrder" && !userData?.firstOrderAt) {
          updates.firstOrderAt = serverTimestamp();
        }

        await updateDoc(doc(db, "users", currentUser.uid), updates);
      } catch (error) {
        console.error(`Failed to mark ${step} as complete:`, error);
        throw error;
      }
    },
    [currentUser?.uid, userData?.firstMarketplaceVisit, userData?.firstOrderAt]
  );

  // Complete the entire onboarding flow
  const completeOnboarding = useCallback(async () => {
    if (!currentUser?.uid) return;

    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        finishedOnboarding: true,
        onboardingStep: "completed",
        "onboardingProgress.completedAt": serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      throw error;
    }
  }, [currentUser?.uid]);

  // Calculate progress percentage
  const getProgressPercentage = useCallback(() => {
    return Math.round((completedCount / totalSteps) * 100);
  }, [completedCount]);

  return {
    progress,
    isComplete,
    completedCount,
    totalSteps,
    currentStep,
    markStepComplete,
    completeOnboarding,
    getProgressPercentage,
  };
}
