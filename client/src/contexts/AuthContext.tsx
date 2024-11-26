import { createContext, useContext, useEffect, useState } from 'react';
import { 
  auth, 
  loginWithEmailAndPassword, 
  registerWithEmailAndPassword,
  signInWithGoogle as firebaseSignInWithGoogle,
  logOut,
  onAuthStateChanged,
  FirebaseUser
} from '@/lib/firebase';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function signIn(email: string, password: string) {
    try {
      await loginWithEmailAndPassword(email, password);
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  async function signUp(email: string, password: string) {
    try {
      await registerWithEmailAndPassword(email, password);
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  async function signInWithGoogle() {
    try {
      await firebaseSignInWithGoogle();
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  async function logout() {
    try {
      await logOut();
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  const value = {
    currentUser,
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
