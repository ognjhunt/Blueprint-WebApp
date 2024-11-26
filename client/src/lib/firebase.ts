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
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Auth functions
export const loginWithEmailAndPassword = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const registerWithEmailAndPassword = async (email: string, password: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export { auth, onAuthStateChanged, User };
