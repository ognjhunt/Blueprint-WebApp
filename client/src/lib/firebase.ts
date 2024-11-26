import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
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
  createdAt: Date;
  lastLoginAt: Date;
  blueprintCount: number;
  planType: string;
  connectedBlueprintIds: string[];
  createdBlueprintIds: string[];
}

// Firestore functions
export const createUserDocument = async (
  user: FirebaseUser,
  additionalData?: { name?: string }
): Promise<void> => {
  if (!user) return;

  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    const { email } = user;
    const name = additionalData?.name || email?.split('@')[0] || '';

    try {
      await setDoc(userRef, {
        uid: user.uid,
        email,
        name,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        blueprintCount: 0,
        planType: 'free',
        connectedBlueprintIds: [],
        createdBlueprintIds: []
      });
    } catch (error) {
      console.error('Error creating user document:', error);
      throw error;
    }
  } else {
    await updateDoc(userRef, {
      lastLoginAt: serverTimestamp()
    });
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
