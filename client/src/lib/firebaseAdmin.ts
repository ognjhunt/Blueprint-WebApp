// lib/firebaseAdmin.ts
import admin, { type ServiceAccount } from "firebase-admin";

function loadServiceAccount(): ServiceAccount | null {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv) as ServiceAccount;
    } catch (error: any) {
      console.error(
        "Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON environment variable:",
        error.message,
      );
      return null;
    }
  }
  return null;
}

const firebaseConfigForAdmin = {
  storageBucket:
    process.env.FIREBASE_STORAGE_BUCKET || "blueprint-8c1ca.appspot.com",
};

function initializeFirebaseAdmin() {
  if (!admin) {
    console.error("Firebase Admin SDK could not be imported");
    return null;
  }

  if (!admin.apps?.length) {
    const serviceAccount = loadServiceAccount();

    if (!serviceAccount) {
      const message =
        "Firebase Admin SDK: Missing service account credentials. " +
        "Set FIREBASE_SERVICE_ACCOUNT_JSON to a valid service account JSON string.";
      console.warn(message);
      return null;
    }

    try {
      const app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: firebaseConfigForAdmin.storageBucket,
      });
      console.log("Firebase Admin SDK initialized successfully.");
      return app;
    } catch (error: any) {
      console.error("Firebase Admin SDK initialization error:", error.stack);
      return null;
    }
  }

  return admin.apps[0] ?? null;
}

const firebaseAdminApp = initializeFirebaseAdmin();

export const dbAdmin = firebaseAdminApp
  ? admin.firestore(firebaseAdminApp)
  : null;
export const storageAdmin = firebaseAdminApp
  ? admin.storage(firebaseAdminApp)
  : null;
export const authAdmin = firebaseAdminApp ? admin.auth(firebaseAdminApp) : null;

export default admin; // Also export the default admin instance
