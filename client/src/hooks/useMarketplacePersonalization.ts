// useMarketplacePersonalization hook
// Provides personalization data for the marketplace based on user signup data

import { useMemo, useCallback } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db, type UserData } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

interface PersonalizationData {
  welcomeMessage: string | null;
  suggestedCategory: string | null;
  suggestedFilters: Record<string, string[]>;
  showWelcomeBanner: boolean;
  firstName: string;
  primaryNeed: string | null;
  projectExcerpt: string | null;
}

interface UseMarketplacePersonalizationReturn {
  personalization: PersonalizationData;
  dismissWelcomeBanner: () => Promise<void>;
  getRecommendedCategories: () => string[];
  getSuggestedSearchTerms: () => string[];
}

// Map primary needs to marketplace categories/filters
const PRIMARY_NEED_TO_CATEGORY: Record<string, string[]> = {
  "benchmark-packs": ["scenes", "datasets"],
  "scene-library": ["scenes"],
  "dataset-packs": ["training", "datasets"],
  "custom-capture": ["scenes"],
  other: ["all"],
};

// Map primary needs to welcome messages
const PRIMARY_NEED_MESSAGES: Record<string, string> = {
  "benchmark-packs": "Explore benchmark and eval packs with scenes, tasks, and harnesses",
  "scene-library": "Browse SimReady scenes ready for simulation",
  "dataset-packs": "Discover robotic policy trajectories and episodes for training",
  "custom-capture": "Request custom scene captures tailored to your facility",
  other: "Welcome! Start exploring our simulation data offerings",
};

// Extract keywords from project description for suggestions
function extractKeywords(description: string): string[] {
  if (!description) return [];

  // Common AI/ML keywords to look for
  const keywords = [
    "computer vision",
    "nlp",
    "natural language",
    "image",
    "video",
    "audio",
    "text",
    "classification",
    "detection",
    "segmentation",
    "recognition",
    "robotics",
    "autonomous",
    "self-driving",
    "medical",
    "healthcare",
    "retail",
    "manufacturing",
    "warehouse",
    "indoor",
    "outdoor",
  ];

  const lowerDesc = description.toLowerCase();
  return keywords.filter((keyword) => lowerDesc.includes(keyword));
}

export function useMarketplacePersonalization(): UseMarketplacePersonalizationReturn {
  const { userData, currentUser } = useAuth();

  const personalization: PersonalizationData = useMemo(() => {
    const firstName = userData?.name?.split(" ")[0] || "";
    const primaryNeed = userData?.primaryNeeds?.[0] || null;
    const projectDescription = userData?.projectDescription || null;

    // Determine if we should show the welcome banner
    const showWelcomeBanner =
      userData?.personalizedWelcomeShown !== true && !!primaryNeed;

    // Get welcome message based on primary need
    const welcomeMessage = primaryNeed
      ? PRIMARY_NEED_MESSAGES[primaryNeed] || null
      : null;

    // Get suggested category based on primary need
    const suggestedCategories = primaryNeed
      ? PRIMARY_NEED_TO_CATEGORY[primaryNeed] || []
      : [];
    const suggestedCategory = suggestedCategories[0] || null;

    // Build suggested filters
    const suggestedFilters: Record<string, string[]> = {};
    if (projectDescription) {
      const keywords = extractKeywords(projectDescription);
      if (keywords.length > 0) {
        suggestedFilters.tags = keywords.slice(0, 3);
      }
    }

    // Create excerpt from project description
    const projectExcerpt = projectDescription
      ? projectDescription.length > 100
        ? projectDescription.substring(0, 100) + "..."
        : projectDescription
      : null;

    return {
      welcomeMessage,
      suggestedCategory,
      suggestedFilters,
      showWelcomeBanner,
      firstName,
      primaryNeed,
      projectExcerpt,
    };
  }, [
    userData?.name,
    userData?.primaryNeeds,
    userData?.projectDescription,
    userData?.personalizedWelcomeShown,
  ]);

  // Dismiss the welcome banner
  const dismissWelcomeBanner = useCallback(async () => {
    if (!currentUser?.uid) return;

    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        personalizedWelcomeShown: true,
      });
    } catch (error) {
      console.error("Failed to dismiss welcome banner:", error);
    }
  }, [currentUser?.uid]);

  // Get recommended categories based on user data
  const getRecommendedCategories = useCallback((): string[] => {
    if (!userData?.primaryNeeds || userData.primaryNeeds.length === 0) return [];
    return PRIMARY_NEED_TO_CATEGORY[userData.primaryNeeds[0]] || [];
  }, [userData?.primaryNeeds]);

  // Get suggested search terms based on project description
  const getSuggestedSearchTerms = useCallback((): string[] => {
    if (!userData?.projectDescription) return [];
    return extractKeywords(userData.projectDescription);
  }, [userData?.projectDescription]);

  return {
    personalization,
    dismissWelcomeBanner,
    getRecommendedCategories,
    getSuggestedSearchTerms,
  };
}
