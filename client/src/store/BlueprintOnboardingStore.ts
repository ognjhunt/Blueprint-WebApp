// This is a simple, non-React state management implementation
// that doesn't rely on hooks at all
// Define the store type
type BlueprintOnboardingStore = {
  onboardingCompleted: boolean;
  onboardingStep: number;
  showWelcomeModal: boolean;
  viewMode: "2D" | "3D" | "WORKFLOW";
  isOnboardingActive: boolean;
  hasSetOrigin: boolean; // Track if origin point is set
  activePanel: string | null; // Track which panel is open
  demonstrationMode: boolean; // For drag-and-drop demonstrations
  listeners: Array<() => void>;
};

const store: BlueprintOnboardingStore = {
  onboardingCompleted: false,
  onboardingStep: 0,
  showWelcomeModal: false,
  viewMode: "2D",
  isOnboardingActive: false,
  hasSetOrigin: false,
  activePanel: null,
  demonstrationMode: false,
  listeners: [],
};
// Check localStorage on initialization (safely for SSR)
if (typeof window !== "undefined") {
  const hasCompletedOnboarding =
    localStorage.getItem("blueprintOnboardingCompleted") === "true";
  const hasSetOrigin = localStorage.getItem("blueprintOriginSet") === "true";
  if (hasCompletedOnboarding) {
    store.onboardingCompleted = true;
    store.showWelcomeModal = false;
    store.hasSetOrigin = hasSetOrigin || false;
  } else {
    store.showWelcomeModal = true;
  }
}
// Actions
export const blueprintOnboardingActions = {
  startOnboarding: () => {
    store.showWelcomeModal = false;
    store.isOnboardingActive = true;
    store.onboardingStep = 0;
    store.hasSetOrigin = false; // Reset on start
    store.activePanel = null;
    store.demonstrationMode = false;
    notifyListeners();
  },

  skipOnboarding: () => {
    store.showWelcomeModal = false;
    store.isOnboardingActive = false;
    store.onboardingCompleted = true;
    store.hasSetOrigin = false; // Reset if skipped
    store.activePanel = null;
    store.demonstrationMode = false;
    if (typeof window !== "undefined") {
      localStorage.setItem("blueprintOnboardingCompleted", "true");
    }
    notifyListeners();
  },

  nextStep: () => {
    // Prevent advancing past origin selection (Step 5) until set
    if (store.onboardingStep === 5 && !store.hasSetOrigin) {
      console.log("Cannot proceed: Origin point must be set first.");
      return;
    }

    store.onboardingStep += 1;

    // Adjust view mode and panels based on step
    if (store.onboardingStep <= 4) {
      store.viewMode = "2D"; // Keep 2D for initial steps
      store.activePanel = null;
    } else if (store.onboardingStep === 5) {
      store.viewMode = "3D"; // Switch to 3D for origin
      store.activePanel = null;
    } else if (store.onboardingStep === 6) {
      // Properties panel step
      store.viewMode = "3D";
      store.activePanel = null;
    } else if (store.onboardingStep === 7) {
      // Left sidebar introduction
      store.viewMode = "3D";
      store.activePanel = null;
    } else if (store.onboardingStep === 8) {
      // Elements panel
      store.viewMode = "3D";
      store.activePanel = "Elements";
      store.demonstrationMode = false;
    } else if (store.onboardingStep === 9) {
      // Elements drag & drop demo
      store.viewMode = "3D";
      store.activePanel = "Elements";
      store.demonstrationMode = true;
    } else if (store.onboardingStep === 10) {
      // Text panel
      store.viewMode = "3D";
      store.activePanel = "Text";
      store.demonstrationMode = false;
    } else if (store.onboardingStep === 11) {
      // Final completion
      store.demonstrationMode = false;
    }

    notifyListeners();
  },

  prevStep: () => {
    if (store.onboardingStep > 0) {
      store.onboardingStep -= 1;

      // Match panel state when going backwards
      if (store.onboardingStep <= 4) {
        store.viewMode = "2D";
        store.activePanel = null;
      } else if (store.onboardingStep === 5) {
        store.viewMode = "3D";
        store.activePanel = null;
      } else if (store.onboardingStep === 6) {
        store.viewMode = "3D";
        store.activePanel = null;
      } else if (store.onboardingStep === 7) {
        store.viewMode = "3D";
        store.activePanel = null;
      } else if (store.onboardingStep === 8) {
        store.viewMode = "3D";
        store.activePanel = "Elements";
        store.demonstrationMode = false;
      } else if (store.onboardingStep === 9) {
        store.viewMode = "3D";
        store.activePanel = "Elements";
        store.demonstrationMode = true;
      } else if (store.onboardingStep === 10) {
        store.viewMode = "3D";
        store.activePanel = "Text";
        store.demonstrationMode = false;
      }
    }

    notifyListeners();
  },

  completeOnboarding: () => {
    store.isOnboardingActive = false;
    store.onboardingCompleted = true;
    store.hasSetOrigin = true; // Ensure marked as set on completion
    store.activePanel = null;
    store.demonstrationMode = false;
    if (typeof window !== "undefined") {
      localStorage.setItem("blueprintOnboardingCompleted", "true");
      localStorage.setItem("blueprintOriginSet", "true");
    }
    notifyListeners();
  },

  setActiveViewMode: (mode: "2D" | "3D" | "WORKFLOW") => {
    store.viewMode = mode;
    notifyListeners();
  },

  setOriginSet: () => {
    store.hasSetOrigin = true;
    if (typeof window !== "undefined") {
      localStorage.setItem("blueprintOriginSet", "true");
    }
    notifyListeners();
  },

  setActivePanel: (panel: string | null) => {
    store.activePanel = panel;
    notifyListeners();
  },

  startDemonstration: () => {
    store.demonstrationMode = true;
    notifyListeners();
  },

  endDemonstration: () => {
    store.demonstrationMode = false;
    notifyListeners();
  }
};

// Notify all listeners when the store changes
function notifyListeners() {
  store.listeners.forEach((listener) => listener());
}
// Function to subscribe to store changes
export function subscribeToBlueprintOnboarding(
  listener: () => void,
): () => void {
  store.listeners.push(listener);
  // Return unsubscribe function
  return () => {
    const index = store.listeners.indexOf(listener);
    if (index > -1) {
      store.listeners.splice(index, 1);
    }
  };
}
// Function to get current store state
export function getBlueprintOnboardingState(): Omit<
  BlueprintOnboardingStore,
  "listeners"
> {
  const { listeners, ...state } = store;
  return state;
}
