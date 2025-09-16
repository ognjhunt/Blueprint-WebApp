import { initializeApp, type FirebaseOptions } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseEnvKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

function getOptionalEnv(key: (typeof firebaseEnvKeys)[number]): string | null {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return value || null;
}

function isFirebaseConfigured(): boolean {
  return firebaseEnvKeys.every(key => getOptionalEnv(key) !== null);
}

// Only initialize Firebase if all required variables are present
let firebaseConfig: FirebaseOptions | null = null;

if (isFirebaseConfigured()) {
  firebaseConfig = {
    apiKey: getOptionalEnv("VITE_FIREBASE_API_KEY")!,
    authDomain: getOptionalEnv("VITE_FIREBASE_AUTH_DOMAIN")!,
    projectId: getOptionalEnv("VITE_FIREBASE_PROJECT_ID")!,
    storageBucket: getOptionalEnv("VITE_FIREBASE_STORAGE_BUCKET")!,
    messagingSenderId: getOptionalEnv("VITE_FIREBASE_MESSAGING_SENDER_ID")!,
    appId: getOptionalEnv("VITE_FIREBASE_APP_ID")!,
  };
} else {
  console.warn("Firebase configuration incomplete. Firebase features will be disabled.");
}

const optionalFirebaseConfig: Record<string, string | undefined> = {
  databaseURL: (import.meta.env as Record<string, string | undefined>).VITE_FIREBASE_DATABASE_URL,
  measurementId: (import.meta.env as Record<string, string | undefined>).VITE_FIREBASE_MEASUREMENT_ID,
};

// Add optional configuration if Firebase is configured
if (firebaseConfig) {
  for (const [key, value] of Object.entries(optionalFirebaseConfig)) {
    if (value) {
      (firebaseConfig as Record<string, string>)[key] = value;
    }
  }
}

// Initialize Firebase only if configuration is available
const app = firebaseConfig ? initializeApp(firebaseConfig) : null;

const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const storage = app ? getStorage(app) : null;
const googleProvider = app ? new GoogleAuthProvider() : null;
if (googleProvider) {
  googleProvider.setCustomParameters({
    prompt: "select_account",
  });
}

// User data interface
export interface UserData {
  uid: string;
  email: string;
  name: string;
  username: string;
  deviceToken: string;
  referralCode: string;
  createdDate: Date;
  lastLoginAt: Date;
  lastSessionDate: Date;
  numSessions: number;
  uploadedContentCount: number;
  collectedContentCount: number;
  planType: string;
  credits: number;
  finishedOnboarding: boolean;
  hasEnteredNotes: boolean;
  hasEnteredInventory: boolean;
  hasEnteredCameraRoll: boolean;
  amountEarned: number;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  connectedBlueprintIds: string[];
  createdBlueprintIds: string[];
  collectedObjectIds: string[];
  collectedPortalIds: string[];
  uploadedFileIds: string[];
  createdPhotoIds: string[];
  createdNoteIds: string[];
  createdReportIds: string[];
  createdSuggestionIds: string[];
  createdContentIds: string[];
  modelInteractions: { [key: string]: number };
  blueprintInteractions: { [key: string]: number };
  portalInteractions: { [key: string]: number };
  categoryPreferences: { [key: string]: number };
  averageSessionDuration: number;
  peakUsageHours: number[];
  featureUsageCount: { [key: string]: number };
  mostUsedFeatures: string[];
  collaborationScore: number;
  sharedContentCount: number;
  preferredModelScales: number[];
  preferredRoomTypes: string[];
  preferredColors: string[];
  dailyActiveStreak: number;
  weeklyEngagementScore: number;
  completedTutorials: string[];
  skillLevels: { [key: string]: number };
  mostFrequentLocation: string;
  deviceTypes: string[];
}

// Firestore functions
export const createUserDocument = async (
  user: FirebaseUser,
  additionalData?: { name?: string },
): Promise<void> => {
  if (!user) {
    console.error("No user provided to createUserDocument");
    throw new Error("No user provided to createUserDocument");
  }

  if (!db) {
    console.warn("Firebase not configured. Cannot create user document.");
    return;
  }

  try {
    const userRef = doc(db, "users", user.uid);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
      const { email } = user;
      const name = additionalData?.name || email?.split("@")[0] || "";
      const username = name.toLowerCase().replace(/\s+/g, "_");
      const timestamp = serverTimestamp();

      const newUserData = {
        uid: user.uid,
        email,
        name,
        username,
        deviceToken: "",
        referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        createdDate: timestamp,
        lastLoginAt: timestamp,
        lastSessionDate: timestamp,
        numSessions: 1,
        uploadedContentCount: 0,
        collectedContentCount: 0,
        planType: "free",
        credits: 0,
        finishedOnboarding: false,
        hasEnteredNotes: false,
        hasEnteredInventory: false,
        hasEnteredCameraRoll: false,
        amountEarned: 0,
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
        dailyActiveStreak: 1,
        weeklyEngagementScore: 0,
        completedTutorials: [],
        skillLevels: {},
        mostFrequentLocation: "",
        deviceTypes: [],
      };

      await setDoc(userRef, newUserData);
    } else {
      await updateDoc(userRef, {
        lastLoginAt: serverTimestamp(),
        numSessions: increment(1),
      });
    }
  } catch (error) {
    console.error("Error in createUserDocument:", error);
    throw new Error(
      `Failed to create/update user document: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

export const getUserData = async (uid: string): Promise<UserData | null> => {
  if (!db) {
    console.warn("Firebase not configured. Cannot get user data.");
    return null;
  }

  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserData;
    }
    return null;
  } catch (error) {
    console.error("Error fetching user data:", error);
    throw error;
  }
};

// Auth functions
export const loginWithEmailAndPassword = async (
  email: string,
  password: string,
) => {
  if (!auth) {
    console.warn("Firebase not configured. Cannot login with email and password.");
    throw new Error("Firebase auth not configured");
  }

  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await createUserDocument(result.user);
    return result.user;
  } catch (error: any) {
    console.error("Email login error:", error);
    throw error;
  }
};

export const registerWithEmailAndPassword = async (
  email: string,
  password: string,
  name?: string,
) => {
  if (!auth) {
    console.warn("Firebase not configured. Cannot register with email and password.");
    throw new Error("Firebase auth not configured");
  }

  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await createUserDocument(result.user, { name });
    return result.user;
  } catch (error: any) {
    console.error("Email registration error:", error);
    throw error;
  }
};

export const signInWithGoogle = async () => {
  if (!auth || !googleProvider) {
    console.warn("Firebase not configured. Cannot sign in with Google.");
    throw new Error("Firebase auth not configured");
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Google sign in error:", error);
    throw error;
  }
};

export const logOut = async () => {
  if (!auth) {
    console.warn("Firebase not configured. Cannot log out.");
    throw new Error("Firebase auth not configured");
  }

  try {
    await signOut(auth);
  } catch (error: any) {
    console.error("Logout error:", error);
    throw error;
  }
};

export { auth, db, onAuthStateChanged, storage };
export type { FirebaseUser };
