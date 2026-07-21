import type { IdTokenResult } from "firebase/auth";
import type { UserData } from "@/lib/firebase";

export const operatorQaFakeAuthEnvVar = "VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH";
export const operatorQaFakeAuthEmail = "operator-qa@tryblueprint.local";

export type OperatorQaAuthSnapshot = {
  enabled: boolean;
  currentUser: unknown | null;
  userData: UserData | null;
  tokenClaims: IdTokenResult["claims"] | null;
};

type ViteEnvLike = Record<string, string | boolean | undefined>;

function buildOperatorQaUserData(): UserData {
  const now = new Date("2026-05-26T12:00:00.000Z");

  return {
    uid: "operator-qa-local-user",
    email: operatorQaFakeAuthEmail,
    name: "Operator QA",
    username: "operator-qa",
    deviceToken: "",
    referralCode: "operator-qa",
    createdDate: now,
    lastLoginAt: now,
    lastSessionDate: now,
    numSessions: 1,
    uploadedContentCount: 0,
    collectedContentCount: 0,
    credits: 0,
    finishedOnboarding: true,
    onboardingStep: "completed",
    hasEnteredNotes: false,
    hasEnteredInventory: false,
    hasEnteredCameraRoll: false,
    connectedBlueprintIds: [],
    createdBlueprintIds: [],
    collectedObjectIds: [],
    collectedPortalIds: [],
    uploadedFileIds: [],
    createdPhotoIds: [],
    createdNoteIds: [],
    createdReportIds: [],
    createdSuggestionIds: [],
    createdContentIds: [],
    modelInteractions: {},
    blueprintInteractions: {},
    portalInteractions: {},
    categoryPreferences: {},
    averageSessionDuration: 0,
    peakUsageHours: [],
    featureUsageCount: {},
    mostUsedFeatures: [],
    collaborationScore: 0,
    sharedContentCount: 0,
    preferredModelScales: [],
    preferredRoomTypes: [],
    preferredColors: [],
    dailyActiveStreak: 0,
    weeklyEngagementScore: 0,
    completedTutorials: [],
    skillLevels: {},
    mostFrequentLocation: "local-qa",
    deviceTypes: [],
    role: "admin",
    roles: ["admin", "ops"],
    admin: true,
    ops: true,
  };
}

export function resolveOperatorQaAuth(env: ViteEnvLike): OperatorQaAuthSnapshot {
  const isDev = env.DEV === true || env.MODE === "development";
  const enabled = isDev && env[operatorQaFakeAuthEnvVar] === "1";

  if (!enabled) {
    return {
      enabled: false,
      currentUser: null,
      userData: null,
      tokenClaims: null,
    };
  }

  const claims = {
    email: operatorQaFakeAuthEmail,
    admin: true,
    ops: true,
    roles: ["admin", "ops"],
  } as IdTokenResult["claims"];

  return {
    enabled: true,
    currentUser: {
      uid: "operator-qa-local-user",
      email: operatorQaFakeAuthEmail,
      displayName: "Operator QA",
      isAnonymous: false,
      getIdToken: async () => "operator-qa-local-token",
      getIdTokenResult: async () => ({ claims }),
    },
    userData: buildOperatorQaUserData(),
    tokenClaims: claims,
  };
}
