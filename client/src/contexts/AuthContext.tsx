import { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { 
  auth, 
  loginWithEmailAndPassword, 
  registerWithEmailAndPassword,
  signInWithGoogle as firebaseSignInWithGoogle,
  logOut,
  onAuthStateChanged,
  getUserData,
  UserData,
  FirebaseUser
} from '@/lib/firebase';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: UserData | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userData = await getUserData(user.uid);
          setUserData(userData);
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function signIn(email: string, password: string) {
    try {
      const user = await loginWithEmailAndPassword(email, password);
      console.log("User signed in successfully:", user.uid);
      
      try {
        const userData = await getUserData(user.uid);
        setUserData(userData);
        setLocation("/");
      } catch (userDataError: any) {
        console.error("Error fetching user data after sign in:", userDataError);
        throw new Error("Failed to load user data. Please try again.");
      }
    } catch (error: any) {
      console.error("Sign in error:", { code: error.code, message: error.message });
      throw new Error(getAuthErrorMessage(error.code) || error.message);
    }
  }

  async function signUp(email: string, password: string, name?: string) {
    try {
      const user = await registerWithEmailAndPassword(email, password, name);
      console.log("User registered successfully:", user.uid);
      
      try {
        const userData = await getUserData(user.uid);
        if (!userData) {
          throw new Error("User document not created properly");
        }
        setUserData(userData);
        setLocation("/");
      } catch (userDataError: any) {
        console.error("Error creating/fetching user data after registration:", userDataError);
        throw new Error("Account created but failed to set up user profile. Please try signing in again.");
      }
    } catch (error: any) {
      console.error("Sign up error:", { code: error.code, message: error.message });
      throw new Error(getAuthErrorMessage(error.code) || error.message);
    }
  }

  async function signInWithGoogle() {
    try {
      const user = await firebaseSignInWithGoogle();
      console.log("User signed in with Google successfully:", user.uid);
      const userData = await getUserData(user.uid);
      setUserData(userData);
    } catch (error: any) {
      console.error("Google sign in error:", { code: error.code, message: error.message });
      throw new Error(getAuthErrorMessage(error.code) || error.message);
    }
  }

  async function logout() {
    try {
      await logOut();
      setUserData(null);
      console.log("User logged out successfully");
    } catch (error: any) {
      console.error("Logout error:", { code: error.code, message: error.message });
      throw new Error("Failed to sign out. Please try again.");
    }
  }

  function getAuthErrorMessage(code: string): string {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'An account with this email already exists';
      case 'auth/invalid-email':
        return 'Invalid email address';
      case 'auth/operation-not-allowed':
        return 'Operation not allowed';
      case 'auth/weak-password':
        return 'Password is too weak';
      case 'auth/user-disabled':
        return 'This account has been disabled';
      case 'auth/user-not-found':
        return 'No account found with this email';
      case 'auth/wrong-password':
        return 'Invalid password';
      case 'auth/popup-closed-by-user':
        return 'Google sign-in was cancelled';
      case 'auth/network-request-failed':
        return 'Network error occurred. Please check your connection';
      default:
        return '';
    }
  }

  const value = {
    currentUser,
    userData,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
