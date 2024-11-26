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
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Auth functions
export const loginWithEmailAndPassword = async (email: string, password: string) => {
  if (!auth) throw new Error("Firebase auth not initialized");
  
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    console.log("Email login successful:", result.user.uid);
    return result.user;
  } catch (error: any) {
    console.error("Email login error:", error);
    throw error;
  }
};

export const registerWithEmailAndPassword = async (email: string, password: string) => {
  if (!auth) throw new Error("Firebase auth not initialized");
  
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
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

export { auth, onAuthStateChanged, User };
