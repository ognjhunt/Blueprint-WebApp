import { initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  type Auth,
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
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// Firebase configuration - hardcoded for Render deployment
// TODO: Move to environment variables when possible
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyAbIZbjqsG9daPQYfpFTfCUHWszqHAfgjI",
  authDomain: "blueprint-8c1ca.firebaseapp.com",
  projectId: "blueprint-8c1ca",
  storageBucket: "blueprint-8c1ca.appspot.com",
  messagingSenderId: "744608654760",
  appId: "1:744608654760:web:5b697e80345ac2b0f4a99d",
  databaseURL: "https://blueprint-8c1ca-default-rtdb.firebaseio.com",
  measurementId: "G-7LHTQSRF9L",
};

const isBrowser = typeof window !== "undefined";

// Initialize Firebase - this will throw if configuration is invalid
let app: FirebaseApp | null = null;
if (isBrowser) {
  try {
    app = initializeApp(firebaseConfig);
    console.log("[Firebase] App initialized successfully for project:", firebaseConfig.projectId);
  } catch (error) {
    console.error("[Firebase] Failed to initialize app:", error);
    throw error;
  }
}

// Export non-null Firebase services
const authInstance = app ? getAuth(app) : null;
const dbInstance = app ? getFirestore(app) : null;
const storageInstance = app ? getStorage(app) : null;

export const auth: Auth | null = authInstance;
export const db = dbInstance as Firestore;
export const storage = storageInstance as FirebaseStorage;

// Log Firebase service initialization
if (isBrowser) {
  console.log(
    "[Firebase] Services initialized - Auth:",
    !!authInstance,
    "Firestore:",
    !!dbInstance,
    "Storage:",
    !!storageInstance,
  );
}

const requireAuth = (): Auth => {
  if (!authInstance) {
    throw new Error("[Firebase] Auth has not been initialized.");
  }
  return authInstance;
};

const requireDb = (): Firestore => {
  if (!dbInstance) {
    throw new Error("[Firebase] Firestore has not been initialized.");
  }
  return dbInstance;
};

// Debug function to test Firestore connectivity
export const testFirestoreConnection = async (): Promise<boolean> => {
  console.log("[Firebase] Testing Firestore connection...");
  if (!dbInstance) {
    console.warn("[Firebase] Firestore is not initialized. Skipping connection test.");
    return false;
  }
  try {
    const testRef = doc(dbInstance, "_connection_test", "test");
    await setDoc(testRef, { timestamp: serverTimestamp(), test: true });
    console.log("[Firebase] Firestore write test PASSED");

    const testDoc = await getDoc(testRef);
    console.log("[Firebase] Firestore read test PASSED, doc exists:", testDoc.exists());

    return true;
  } catch (error) {
    console.error("[Firebase] Firestore connection test FAILED:", error);
    console.error("[Firebase] Error details:", {
      name: (error as any)?.name,
      code: (error as any)?.code,
      message: (error as any)?.message,
    });
    return false;
  }
};

const env =
  typeof import.meta !== "undefined"
    ? (import.meta as { env?: { DEV?: boolean; VITE_FIREBASE_DEBUG?: string } }).env
    : undefined;
const isFirestoreDebugEnabled =
  (env?.DEV ?? false) || env?.VITE_FIREBASE_DEBUG === "true";

export const runFirestoreConnectionTestIfDebug = async (): Promise<boolean> => {
  if (!isFirestoreDebugEnabled) {
    return false;
  }

  const success = await testFirestoreConnection();
  console.log("[Firebase] Debug connection test result:", success ? "SUCCESS" : "FAILED");
  return success;
};

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

// User data interface
export interface UserData {
  uid: string;
  email: string;
  name: string;
  displayName?: string;
  photoURL?: string;
  bio?: string;
  jobTitle?: string;
  company?: string;
  timeZone?: string;
  language?: string;
  phoneNumber?: string;
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
  mappingOptIn?: boolean | null;
  kitDeliveryEstimate?: Date | null;
  kitTrackingUrl?: string | null;
  subscriptionStartEstimate?: Date | null;
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
  planUsage?: number;
  planExpiryDate?: Date | null;
  activeBlueprintsPercentage?: number;
  planCost?: number | string;
  planHours?: number | string;
  currentMonthHours?: number;
  accountSettings?: {
    email2FA?: boolean;
    sms2FA?: boolean;
    securityAlerts?: boolean;
    loginAttempts?: boolean;
  };
  notificationSettings?: {
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    blueprintChanges?: boolean;
    teamUpdates?: boolean;
    usageAlerts?: boolean;
    marketingEmails?: boolean;
    weeklyDigest?: boolean;
    securityNotifications?: boolean;
  };
  apiKeys?: Array<{
    id?: string;
    label?: string;
    key?: string;
    createdAt?: Date;
    lastUsed?: Date;
  }>;
  integrations?: Array<{
    id?: string;
    name?: string;
    status?: string;
    connectedAt?: Date;
  }>;
  teamMembers?: {
    count?: number;
    pending?: number;
  };
  blueprintsShared?: {
    count?: number;
    sharedWith?: number;
  };
  billingHistory?: Array<{
    id?: string;
    date?: Date;
    amount?: number;
    status?: string;
  }>;
  paymentMethods?: Array<{
    id?: string;
    cardholder?: string;
    brand?: string;
    last4?: string;
    expiryDate?: string;
    isDefault?: boolean;
    stripePaymentMethodId?: string;
  }>;
  teamRoles?: {
    count?: number;
    roles?: string[];
  };
}

// Firestore functions
export const createUserDocument = async (
  user: FirebaseUser,
  additionalData?: { name?: string; displayName?: string; photoURL?: string },
): Promise<void> => {
  if (!user) {
    console.error("[Firebase] No user provided to createUserDocument");
    throw new Error("No user provided to createUserDocument");
  }

  console.log("[Firebase] createUserDocument called for user:", user.uid);
  console.log("[Firebase] Firestore db instance:", dbInstance ? "exists" : "null");

  try {
    const firestore = requireDb();
    const userRef = doc(firestore, "users", user.uid);
    console.log("[Firebase] Created doc reference for users/" + user.uid);

    console.log("[Firebase] Attempting to get existing document...");
    const snapshot = await getDoc(userRef);
    console.log("[Firebase] getDoc completed, exists:", snapshot.exists());

    if (!snapshot.exists()) {
      const { email } = user;
      const name = additionalData?.name || user.displayName || email?.split("@")[0] || "";
      const displayName = additionalData?.displayName || user.displayName || name;
      const photoURL = additionalData?.photoURL || user.photoURL || "";
      const username = name.toLowerCase().replace(/\s+/g, "_");
      const timestamp = serverTimestamp();

      const newUserData = {
        uid: user.uid,
        email,
        name,
        displayName,
        photoURL,
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
        mappingOptIn: null,
        kitDeliveryEstimate: null,
        kitTrackingUrl: null,
        subscriptionStartEstimate: null,
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
        billingHistory: [],
        paymentMethods: [],
      };

      console.log("[Firebase] Attempting setDoc for new user...");
      await setDoc(userRef, newUserData);
      console.log("[Firebase] setDoc completed successfully for new user");
    } else {
      console.log("[Firebase] User exists, attempting updateDoc...");
      await updateDoc(userRef, {
        lastLoginAt: serverTimestamp(),
        numSessions: increment(1),
      });
      console.log("[Firebase] updateDoc completed successfully");
    }
  } catch (error) {
    console.error("[Firebase] Error in createUserDocument:", error);
    console.error("[Firebase] Error details:", {
      name: (error as any)?.name,
      code: (error as any)?.code,
      message: (error as any)?.message,
    });
    throw new Error(
      `Failed to create/update user document: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

export const getUserData = async (uid: string): Promise<UserData | null> => {
  console.log("[Firebase] getUserData called for uid:", uid);
  try {
    const firestore = requireDb();
    console.log("[Firebase] Attempting to fetch user document...");
    const userDoc = await getDoc(doc(firestore, "users", uid));
    console.log("[Firebase] getUserData fetch completed, exists:", userDoc.exists());
    if (userDoc.exists()) {
      return userDoc.data() as UserData;
    }
    return null;
  } catch (error) {
    console.error("[Firebase] Error fetching user data:", error);
    console.error("[Firebase] Error details:", {
      name: (error as any)?.name,
      code: (error as any)?.code,
      message: (error as any)?.message,
    });
    throw error;
  }
};

export const updateUserBillingDetails = async (
  uid: string,
  updates: Pick<UserData, "paymentMethods" | "billingHistory">,
): Promise<void> => {
  try {
    const firestore = requireDb();
    const userRef = doc(firestore, "users", uid);
    await updateDoc(userRef, updates);
  } catch (error) {
    console.error("[Firebase] Error updating billing details:", error);
    throw error;
  }
};

// Auth functions
export const loginWithEmailAndPassword = async (
  email: string,
  password: string,
) => {
  try {
    const firebaseAuth = requireAuth();
    const result = await signInWithEmailAndPassword(firebaseAuth, email, password);
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
  try {
    const firebaseAuth = requireAuth();
    const result = await createUserWithEmailAndPassword(firebaseAuth, email, password);
    await createUserDocument(result.user, { name });
    return result.user;
  } catch (error: any) {
    console.error("Email registration error:", error);
    throw error;
  }
};

export const signInWithGoogle = async () => {
  try {
    const firebaseAuth = requireAuth();
    const result = await signInWithPopup(firebaseAuth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Google sign in error:", error);
    throw error;
  }
};

export const logOut = async () => {
  try {
    const firebaseAuth = requireAuth();
    await signOut(firebaseAuth);
  } catch (error: any) {
    console.error("Logout error:", error);
    throw error;
  }
};

export { onAuthStateChanged };
export type { FirebaseUser };
