import { createContext, useContext } from 'react';

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  currentUser: User | null;
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
  // Mock authentication functions
  async function signIn(email: string, password: string) {
    console.log('Mock sign in:', email);
  }

  async function signUp(email: string, password: string) {
    console.log('Mock sign up:', email);
  }

  async function signInWithGoogle() {
    console.log('Mock Google sign in');
  }

  async function logout() {
    console.log('Mock logout');
  }

  const value = {
    currentUser: null,
    loading: false,
    signIn,
    signUp,
    signInWithGoogle,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
