import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
  browserLocalPersistence,
  setPersistence
} from 'firebase/auth';

export type FirebaseUser = User;
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  DocumentData
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBfLLwlFQvxkztjgihEG7_2p9rTipdXGFs",
  authDomain: "blueprint-8c1ca.firebaseapp.com",
  databaseURL: "https://blueprint-8c1ca-default-rtdb.firebaseio.com",
  projectId: "blueprint-8c1ca",
  storageBucket: "blueprint-8c1ca.appspot.com",
  messagingSenderId: "744608654760",
  appId: "1:744608654760:web:5b697e80345ac2b0f4a99d",
  measurementId: "G-7LHTQSRF9L"
};

// Initialize Firebase
let app: any;
try {
  app = initializeApp(firebaseConfig);
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("Error initializing Firebase:", error);
  throw error;
}

const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

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
  additionalData?: { name?: string }
): Promise<void> => {
  if (!user) {
    console.error('No user provided to createUserDocument');
    throw new Error('No user provided to createUserDocument');
  }

  try {
    const userRef = doc(db, 'users', user.uid);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
      const { email } = user;
      const name = additionalData?.name || email?.split('@')[0] || '';
      const username = name.toLowerCase().replace(/\s+/g, '_');
      const timestamp = serverTimestamp();

      const newUserData = {
        uid: user.uid,
        email,
        name,
        username,
        deviceToken: '',
        referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        createdDate: timestamp,
        lastLoginAt: timestamp,
        lastSessionDate: timestamp,
        numSessions: 1,
        uploadedContentCount: 0,
        collectedContentCount: 0,
        planType: 'free',
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
        mostFrequentLocation: '',
        deviceTypes: []
      };

      await setDoc(userRef, newUserData);
      console.log('User document created successfully:', user.uid);
    } else {
      await updateDoc(userRef, {
        lastLoginAt: serverTimestamp(),
        numSessions: snapshot.data().numSessions + 1
      });
      console.log('User document updated successfully:', user.uid);
    }
  } catch (error) {
    console.error('Error in createUserDocument:', error);
    throw new Error(`Failed to create/update user document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const getUserData = async (uid: string): Promise<UserData | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserData;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
};

// Auth functions
export const loginWithEmailAndPassword = async (email: string, password: string) => {
  if (!auth) throw new Error("Firebase auth not initialized");
  
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await createUserDocument(result.user);
    console.log("Email login successful:", result.user.uid);
    return result.user;
  } catch (error: any) {
    console.error("Email login error:", error);
    throw error;
  }
};

export const registerWithEmailAndPassword = async (email: string, password: string, name?: string) => {
  if (!auth) throw new Error("Firebase auth not initialized");
  
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await createUserDocument(result.user, { name });
    console.log("Email registration successful:", result.user.uid);
    return result.user;
  } catch (error: any) {
    console.error("Email registration error:", error);
    throw error;
  }
};

export const signInWithGoogle = async () => {
  if (!auth) throw new Error("Firebase auth not initialized");
  
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await createUserDocument(result.user);
    console.log("Google sign in successful:", result.user.uid);
    return result.user;
  } catch (error: any) {
    console.error("Google sign in error:", error);
    throw error;
  }
};

export const logOut = async () => {
  if (!auth) throw new Error("Firebase auth not initialized");
  
  try {
    await signOut(auth);
    console.log("Logout successful");
  } catch (error: any) {
    console.error("Logout error:", error);
    throw error;
  }
};

export { auth, db, onAuthStateChanged, User };
