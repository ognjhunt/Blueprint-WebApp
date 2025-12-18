import * as React from "react"; // Import all of React as React
import { createContext, useContext } from "react"; // Keep these as is, or change to React.createContext etc. later if needed
import { useLocation } from "wouter";
import {
  browserLocalPersistence,
  setPersistence as firebasePersistence,
} from "firebase/auth";
import {
  auth,
  loginWithEmailAndPassword,
  registerWithEmailAndPassword,
  signInWithGoogle as firebaseSignInWithGoogle,
  logOut,
  onAuthStateChanged,
  getUserData,
  createUserDocument,
  UserData,
} from "@/lib/firebase";
import { User as FirebaseUser } from "firebase/auth";

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: UserData | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string>;
  signUp: (email: string, password: string, name?: string) => Promise<string>;
  signInWithGoogle: () => Promise<string>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Set persistence to LOCAL
  React.useEffect(() => {
    if (!auth) {
      console.warn("Firebase auth not initialized. Skipping persistence setup.");
      return;
    }
    
    const initPersistence = async () => {
      try {
        await firebasePersistence(auth!, browserLocalPersistence);
      } catch (error) {
        console.error("Error setting persistence:", error);
      }
    };
    initPersistence();
  }, []);
  const [currentUser, setCurrentUser] = React.useState<FirebaseUser | null>(
    null,
  );
  const [userData, setUserData] = React.useState<UserData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [, setLocation] = useLocation();

  const normalizeUserData = React.useCallback((data: UserData | null) => {
    if (!data) {
      return null;
    }
    return {
      ...data,
      finishedOnboarding: data.finishedOnboarding ?? false,
    };
  }, []);

  const resolveRedirectPath = React.useCallback(
    (data: UserData | null): string => {
      let storedRedirect: string | null = null;
      try {
        storedRedirect = sessionStorage.getItem("redirectAfterAuth");
      } catch (storageError) {
        console.error("Unable to read redirectAfterAuth from sessionStorage:", storageError);
      }

      if (storedRedirect) {
        try {
          sessionStorage.removeItem("redirectAfterAuth");
        } catch (storageError) {
          console.error(
            "Unable to clear redirectAfterAuth from sessionStorage:",
            storageError,
          );
        }
        return storedRedirect;
      }

      if (data && data.finishedOnboarding !== true) {
        return "/onboarding";
      }

      return "/dashboard";
    },
    [],
  );

  const navigateAfterAuth = React.useCallback(
    (data: UserData | null): string => {
      const destination = resolveRedirectPath(data);
      if (destination.startsWith("http")) {
        if (typeof window !== "undefined") {
          window.location.href = destination;
        } else {
          console.warn(
            "Attempted to redirect to an external URL without a window context:",
            destination,
          );
        }
      } else {
        setLocation(destination);
      }
      return destination;
    },
    [resolveRedirectPath, setLocation],
  );

  const ACCESS_DENIED_CODE = "auth/access-denied";
  const USER_DATA_MISSING_CODE = "auth/user-data-missing";

  const isPermissionDeniedError = (error: unknown): boolean => {
    if (!error || typeof error !== "object") {
      return false;
    }
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" && code.includes("permission-denied");
  };

  const createAccessDeniedError = () => {
    const accessError: any = new Error(
      "Access to Blueprint is currently invite-only. Please request an invitation to continue.",
    );
    accessError.code = ACCESS_DENIED_CODE;
    return accessError;
  };

  const createUserDataMissingError = () => {
    const dataError: any = new Error(
      "We created your account but couldn't finish loading it. Please try signing in again.",
    );
    dataError.code = USER_DATA_MISSING_CODE;
    return dataError;
  };

  React.useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userData = await getUserData(user.uid);
          setUserData(normalizeUserData(userData));
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

      let userDataRecord: UserData | null = null;
      try {
        userDataRecord = await getUserData(user.uid);
      } catch (userDataError: any) {
        console.error("Error fetching user data after sign in:", userDataError);
        if (isPermissionDeniedError(userDataError)) {
          throw createAccessDeniedError();
        }
        throw new Error(
          "Failed to load user data. Please try signing in again.",
        );
      }

      if (!userDataRecord) {
        throw createUserDataMissingError();
      }

      const normalizedUserData = normalizeUserData(userDataRecord);
      setUserData(normalizedUserData);
      return navigateAfterAuth(normalizedUserData);
    } catch (error: any) {
      console.error("Sign in error:", {
        code: error.code,
        message: error.message,
      });
      throw new Error(getAuthErrorMessage(error.code) || error.message);
    }
  }

  async function signUp(email: string, password: string, name?: string) {
    try {
      const user = await registerWithEmailAndPassword(email, password, name);
      console.log("User registered successfully:", user.uid);

      let userDataRecord: UserData | null = null;
      try {
        userDataRecord = await getUserData(user.uid);
      } catch (userDataError: any) {
        console.error(
          "Error creating/fetching user data after registration:",
          userDataError,
        );
        if (isPermissionDeniedError(userDataError)) {
          throw createAccessDeniedError();
        }
        throw new Error(
          "Account created but failed to set up user profile. Please try signing in again.",
        );
      }

      if (!userDataRecord) {
        throw createUserDataMissingError();
      }

      const normalizedUserData = normalizeUserData(userDataRecord);
      setUserData(normalizedUserData);
      return navigateAfterAuth(normalizedUserData);
    } catch (error: any) {
      console.error("Sign up error:", {
        code: error.code,
        message: error.message,
      });
      throw new Error(getAuthErrorMessage(error.code) || error.message);
    }
  }

  async function signInWithGoogle() {
    try {
      const user = await firebaseSignInWithGoogle();
      console.log("User signed in with Google successfully:", user.uid);
      let userDataRecord: UserData | null = null;

      try {
        userDataRecord = await getUserData(user.uid);
      } catch (userDataError: any) {
        console.error("Error fetching Google user data:", userDataError);
        if (isPermissionDeniedError(userDataError)) {
          throw createAccessDeniedError();
        }
        throw new Error(
          "We couldn't load your profile after signing in with Google. Please try again.",
        );
      }

      let createdProfile = false;

      if (!userDataRecord) {
        try {
          await createUserDocument(user, {
            name: user.displayName ?? undefined,
          });
          createdProfile = true;
        } catch (creationError: any) {
          console.error("Error creating user document after Google sign in:", creationError);
          if (isPermissionDeniedError(creationError)) {
            throw createAccessDeniedError();
          }
          throw new Error(
            "We couldn't finish setting up your profile after Google sign in. Please try again.",
          );
        }

        try {
          userDataRecord = await getUserData(user.uid);
        } catch (userDataFetchError: any) {
          console.error(
            "Error fetching user data after creating Google profile:",
            userDataFetchError,
          );
          if (isPermissionDeniedError(userDataFetchError)) {
            throw createAccessDeniedError();
          }
          throw new Error(
            "Your account was created, but we couldn't finish loading it. Please try signing in again.",
          );
        }
      }

      if (!userDataRecord) {
        throw createUserDataMissingError();
      }

      const normalizedUserData = normalizeUserData(userDataRecord);
      if (!normalizedUserData) {
        throw createUserDataMissingError();
      }

      const onboardingReadyUserData = createdProfile
        ? { ...normalizedUserData, finishedOnboarding: false }
        : normalizedUserData;

      setUserData(onboardingReadyUserData);
      return navigateAfterAuth(onboardingReadyUserData);
    } catch (error: any) {
      console.error("Google sign in error:", {
        code: error.code,
        message: error.message,
      });
      throw new Error(getAuthErrorMessage(error.code) || error.message);
    }
  }

  async function logout() {
    try {
      await logOut();
      setUserData(null);
      console.log("User logged out successfully");
    } catch (error: any) {
      console.error("Logout error:", {
        code: error.code,
        message: error.message,
      });
      throw new Error("Failed to sign out. Please try again.");
    }
  }

  function getAuthErrorMessage(code: string): string {
    switch (code) {
      case "auth/email-already-in-use":
        return "An account with this email already exists";
      case "auth/invalid-email":
        return "Invalid email address";
      case "auth/operation-not-allowed":
        return "Operation not allowed";
      case "auth/weak-password":
        return "Password is too weak";
      case "auth/user-disabled":
        return "This account has been disabled";
      case "auth/user-not-found":
        return "No account found with this email";
      case "auth/wrong-password":
        return "Invalid password";
      case "auth/popup-closed-by-user":
        return "Google sign-in was cancelled";
      case "auth/network-request-failed":
        return "Network error occurred. Please check your connection";
      case ACCESS_DENIED_CODE:
      case "permission-denied":
        return "Blueprint access is currently invite-only. Please request an invitation to continue.";
      case USER_DATA_MISSING_CODE:
        return "We created your account but couldn't finish loading it. Please try signing in again.";
      default:
        return "";
    }
  }

  const value = {
    currentUser,
    userData,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {loading && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
        </div>
      )}
    </AuthContext.Provider>
  );
}
