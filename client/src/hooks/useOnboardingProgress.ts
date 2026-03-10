import { useCallback, useMemo } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

interface OnboardingProgress {
  profileComplete: boolean;
  defineSiteSubmission: boolean;
  completeIntakeReview: boolean;
  reviewQualifiedOpportunities: boolean;
  inviteTeam: boolean;
  completedAt?: Date;
}

type ProgressStep = keyof Omit<OnboardingProgress, "completedAt">;

interface UseOnboardingProgressReturn {
  progress: OnboardingProgress;
  isComplete: boolean;
  completedCount: number;
  totalSteps: number;
  currentStep: string;
  markStepComplete: (step: ProgressStep) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  getProgressPercentage: () => number;
}

export function useOnboardingProgress(): UseOnboardingProgressReturn {
  const { userData, currentUser } = useAuth();

  const progress: OnboardingProgress = useMemo(
    () =>
      userData?.onboardingProgress || {
        profileComplete: false,
        defineSiteSubmission: false,
        completeIntakeReview: false,
        reviewQualifiedOpportunities: false,
        inviteTeam: false,
      },
    [userData?.onboardingProgress]
  );

  const completedCount = useMemo(() => {
    let count = 0;
    if (progress.profileComplete) count += 1;
    if (progress.defineSiteSubmission) count += 1;
    if (progress.completeIntakeReview) count += 1;
    if (progress.reviewQualifiedOpportunities) count += 1;
    if (progress.inviteTeam) count += 1;
    return count;
  }, [progress]);

  const totalSteps = 5;

  const currentStep = useMemo(() => {
    if (!progress.profileComplete) return "profile";
    if (!progress.defineSiteSubmission) return "defineSiteSubmission";
    if (!progress.completeIntakeReview) return "completeIntakeReview";
    if (!progress.reviewQualifiedOpportunities) return "reviewQualifiedOpportunities";
    if (!progress.inviteTeam) return "inviteTeam";
    return "completed";
  }, [progress]);

  const isComplete = useMemo(
    () =>
      progress.profileComplete &&
      progress.defineSiteSubmission &&
      progress.completeIntakeReview,
    [progress]
  );

  const markStepComplete = useCallback(
    async (step: ProgressStep) => {
      if (!currentUser?.uid) return;

      await updateDoc(doc(db, "users", currentUser.uid), {
        [`onboardingProgress.${step}`]: true,
      });
    },
    [currentUser?.uid]
  );

  const completeOnboarding = useCallback(async () => {
    if (!currentUser?.uid) return;

    await updateDoc(doc(db, "users", currentUser.uid), {
      finishedOnboarding: true,
      onboardingStep: "completed",
      "onboardingProgress.completedAt": serverTimestamp(),
    });
  }, [currentUser?.uid]);

  const getProgressPercentage = useCallback(
    () => Math.round((completedCount / totalSteps) * 100),
    [completedCount]
  );

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
