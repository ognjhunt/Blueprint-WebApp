import * as React from "react"; // Import all of React as React
import { createContext, useContext } from "react"; // Keep these as is, or change to React.createContext etc. later if needed
import { useLocation } from "wouter";
import type { IdTokenResult, User as FirebaseUser } from "firebase/auth";
import type { UserData } from "@/lib/firebase";
import { resolveOperatorQaAuth } from "@/lib/operatorQaAuth";

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: UserData | null;
  tokenClaims: IdTokenResult["claims"] | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string>;
  signUp: (email: string, password: string, name?: string) => Promise<string>;
  signInWithGoogle: () => Promise<string>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | null>(null);

const viteEnv =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env
    : ({} as Record<string, string | boolean | undefined>);

type FirebaseClientModule = typeof import("@/lib/firebase");

let firebaseClientModulePromise: Promise<FirebaseClientModule> | null = null;

function loadFirebaseClientModule(): Promise<FirebaseClientModule> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Firebase client module is only available in a browser runtime."),
    );
  }

  if (!firebaseClientModulePromise) {
    firebaseClientModulePromise = import("@/lib/firebase");
  }

  return firebaseClientModulePromise;
}

const authSensitivePathPatterns = [
  /^\/portal(?:\/|$)/,
  /^\/settings(?:\/|$)/,
  /^\/requests\/[^/]+(?:\/|$)/,
  /^\/capture-app(?:\/|$)/,
];

const authRequiredPathPatterns = [
  /^\/app(?:\/|$)/,
  /^\/admin(?:\/|$)/,
  /^\/dashboard(?:\/|$)/,
  /^\/onboarding(?:\/|$)/,
];

function isAuthSensitivePath(path: string) {
  return authSensitivePathPatterns.some((pattern) => pattern.test(path));
}

function isAuthRequiredPath(path: string) {
  return authRequiredPathPatterns.some((pattern) => pattern.test(path));
}

function storageHasFirebaseAuthSession(storage: Storage | null | undefined) {
  if (!storage) {
    return false;
  }

  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && key.startsWith("firebase:authUser:")) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

function hasPersistedFirebaseAuthSession() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    storageHasFirebaseAuthSession(window.localStorage) ||
    storageHasFirebaseAuthSession(window.sessionStorage)
  );
}

function scheduleIdleTask(task: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  if ("requestIdleCallback" in window) {
    const idleId = window.requestIdleCallback(task, { timeout: 2_500 });
    return () => window.cancelIdleCallback(idleId);
  }

  const timeoutId = globalThis.setTimeout(task, 1_500);
  return () => globalThis.clearTimeout(timeoutId);
}

function schedulePostLoadIdleTask(task: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  if (document.readyState === "complete") {
    return scheduleIdleTask(task);
  }

  let cancelIdleTask = () => {};
  const runTask = () => {
    cancelIdleTask = scheduleIdleTask(task);
  };
  window.addEventListener("load", runTask, { once: true });

  return () => {
    window.removeEventListener("load", runTask);
    cancelIdleTask();
  };
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH is a dev-only bypass for local operator QA.
  const operatorQaAuth = React.useMemo(() => resolveOperatorQaAuth(viteEnv), []);
  const [location, setLocation] = useLocation();
  const initializeAuthImmediately =
    !operatorQaAuth.enabled &&
    typeof window !== "undefined" &&
    (isAuthRequiredPath(location) ||
      (isAuthSensitivePath(location) && hasPersistedFirebaseAuthSession()));

  // Set persistence to LOCAL
  React.useEffect(() => {
    if (typeof window === "undefined" || operatorQaAuth.enabled) {
      return;
    }

    const initPersistence = async () => {
      try {
        const { auth, browserLocalPersistence, firebasePersistence } =
          await loadFirebaseClientModule();
        await firebasePersistence(auth, browserLocalPersistence);
      } catch (error) {
        console.error("Error setting persistence:", error);
      }
    };
    if (initializeAuthImmediately) {
      void initPersistence();
      return;
    }

    return schedulePostLoadIdleTask(() => {
      void initPersistence();
    });
  }, [initializeAuthImmediately, operatorQaAuth.enabled]);
  const [currentUser, setCurrentUser] = React.useState<FirebaseUser | null>(
    operatorQaAuth.enabled ? (operatorQaAuth.currentUser as FirebaseUser) : null,
  );
  const [userData, setUserData] = React.useState<UserData | null>(
    operatorQaAuth.enabled ? operatorQaAuth.userData : null,
  );
  const [tokenClaims, setTokenClaims] = React.useState<IdTokenResult["claims"] | null>(
    operatorQaAuth.enabled ? operatorQaAuth.tokenClaims : null,
  );
  const [loading, setLoading] = React.useState(
    operatorQaAuth.enabled ? false : initializeAuthImmediately,
  );

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
      const marketingDestination =
        (viteEnv.VITE_MARKETING_DESTINATION as string | undefined)?.trim() ||
        "/onboarding";
      const isCapturer =
        data?.role === "capturer" || data?.roles?.includes("capturer") === true;
      let storedRedirect: string | null = null;
      try {
        storedRedirect = sessionStorage.getItem("redirectAfterAuth");
      } catch (storageError) {
        console.error("Unable to read redirectAfterAuth from sessionStorage:", storageError);
      }

      if (isCapturer) {
        if (storedRedirect) {
          try {
            sessionStorage.removeItem("redirectAfterAuth");
          } catch (storageError) {
            console.error(
              "Unable to clear redirectAfterAuth from sessionStorage:",
              storageError,
            );
          }
        }
        return "/capture-app";
      }

      if (storedRedirect) {
        // Allow redirect to onboarding if user hasn't completed it
        const normalizedRedirect =
          storedRedirect === "/onboarding" && data?.onboardingStep === "completed"
            ? marketingDestination
            : storedRedirect;
        try {
          sessionStorage.removeItem("redirectAfterAuth");
        } catch (storageError) {
          console.error(
            "Unable to clear redirectAfterAuth from sessionStorage:",
            storageError,
          );
        }
        return normalizedRedirect;
      }

      // If user just signed up (has onboardingStep set but not completed)
      if (data?.onboardingStep && data.onboardingStep !== "completed") {
        return "/onboarding";
      }

      // If user hasn't finished the intake-first onboarding flow
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
    if (operatorQaAuth.enabled) {
      setCurrentUser(operatorQaAuth.currentUser as FirebaseUser);
      setUserData(normalizeUserData(operatorQaAuth.userData));
      setTokenClaims(operatorQaAuth.tokenClaims);
      setLoading(false);
      return;
    }

    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let fallbackTimeout: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe = () => {};

    const clearFallbackTimeout = () => {
      if (fallbackTimeout) {
        clearTimeout(fallbackTimeout);
        fallbackTimeout = null;
      }
    };

    const startAuthListener = () => {
      fallbackTimeout = setTimeout(() => {
        console.warn("Auth initialization timed out. Rendering app without auth state.");
        setLoading(false);
      }, 8000);

      void (async () => {
        try {
          const firebase = await loadFirebaseClientModule();
          unsubscribe = firebase.onAuthStateChanged(
            firebase.auth,
            async (user) => {
              if (!isMounted) {
                return;
              }

              setCurrentUser(user);
              if (user) {
                try {
                  const [userData, tokenResult] = await Promise.all([
                    firebase.getUserData(user.uid),
                    user.getIdTokenResult().catch(() => null),
                  ]);
                  if (!isMounted) {
                    return;
                  }
                  setUserData(normalizeUserData(userData));
                  setTokenClaims(tokenResult?.claims || null);
                } catch (error) {
                  console.error("Error fetching user data:", error);
                }
              } else {
                setUserData(null);
                setTokenClaims(null);
              }
              clearFallbackTimeout();
              setLoading(false);
            },
            (error) => {
              console.error("Auth state change listener error:", error);
              clearFallbackTimeout();
              setLoading(false);
            },
          );
        } catch (error) {
          console.error("Failed to initialize auth state listener:", error);
          clearFallbackTimeout();
          if (isMounted) {
            setLoading(false);
          }
        }
      })();
    };

    const cancelScheduledAuthListener = initializeAuthImmediately
      ? (startAuthListener(), () => {})
      : schedulePostLoadIdleTask(startAuthListener);

    if (!initializeAuthImmediately) {
      setLoading(false);
    }

    return () => {
      isMounted = false;
      cancelScheduledAuthListener();
      clearFallbackTimeout();
      unsubscribe();
    };
  }, [initializeAuthImmediately, normalizeUserData, operatorQaAuth]);

  async function signIn(email: string, password: string) {
    try {
      if (operatorQaAuth.enabled) {
        const normalizedUserData = normalizeUserData(operatorQaAuth.userData);
        setCurrentUser(operatorQaAuth.currentUser as FirebaseUser);
        setUserData(normalizedUserData);
        setTokenClaims(operatorQaAuth.tokenClaims);
        return navigateAfterAuth(normalizedUserData);
      }

      const firebase = await loadFirebaseClientModule();
      const user = await firebase.loginWithEmailAndPassword(email, password);
      console.log("User signed in successfully:", user.uid);
      setCurrentUser(user);

      let userDataRecord: UserData | null = null;
      try {
        userDataRecord = await firebase.getUserData(user.uid);
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
      setTokenClaims((await user.getIdTokenResult().catch(() => null))?.claims || null);
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
      if (operatorQaAuth.enabled) {
        const normalizedUserData = normalizeUserData(operatorQaAuth.userData);
        setCurrentUser(operatorQaAuth.currentUser as FirebaseUser);
        setUserData(normalizedUserData);
        setTokenClaims(operatorQaAuth.tokenClaims);
        return navigateAfterAuth(normalizedUserData);
      }

      const firebase = await loadFirebaseClientModule();
      const user = await firebase.registerWithEmailAndPassword(email, password, name);
      console.log("User registered successfully:", user.uid);
      setCurrentUser(user);

      let userDataRecord: UserData | null = null;
      try {
        userDataRecord = await firebase.getUserData(user.uid);
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
      setTokenClaims((await user.getIdTokenResult().catch(() => null))?.claims || null);
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
      if (operatorQaAuth.enabled) {
        const normalizedUserData = normalizeUserData(operatorQaAuth.userData);
        setCurrentUser(operatorQaAuth.currentUser as FirebaseUser);
        setUserData(normalizedUserData);
        setTokenClaims(operatorQaAuth.tokenClaims);
        return navigateAfterAuth(normalizedUserData);
      }

      const firebase = await loadFirebaseClientModule();
      const user = await firebase.signInWithGoogle();
      console.log("User signed in with Google successfully:", user.uid);
      setCurrentUser(user);
      let userDataRecord: UserData | null = null;

      try {
        userDataRecord = await firebase.getUserData(user.uid);
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
          await firebase.createUserDocument(user, {
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
          userDataRecord = await firebase.getUserData(user.uid);
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
      setTokenClaims((await user.getIdTokenResult().catch(() => null))?.claims || null);
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
      if (operatorQaAuth.enabled) {
        setCurrentUser(operatorQaAuth.currentUser as FirebaseUser);
        setUserData(normalizeUserData(operatorQaAuth.userData));
        setTokenClaims(operatorQaAuth.tokenClaims);
        return;
      }

      const firebase = await loadFirebaseClientModule();
      await firebase.logOut();
      setCurrentUser(null);
      setUserData(null);
      setTokenClaims(null);
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
    tokenClaims,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
