// lib/firebaseAdmin.ts
import admin, { type ServiceAccount } from "firebase-admin";
import path from "path";
import { existsSync, readFileSync } from "fs";

const SERVICE_ACCOUNT_FILE =
  "blueprint-8c1ca-firebase-adminsdk-yu1gh-5992fcf620.json";

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

  const serviceAccountPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.resolve(process.cwd(), SERVICE_ACCOUNT_FILE);

  if (!existsSync(serviceAccountPath)) {
    console.warn(
      `Firebase Admin SDK service account file not found at ${serviceAccountPath}. ` +
        `Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON to configure credentials.`,
    );
    return null;
  }

  try {
    const serviceAccountKey = readFileSync(serviceAccountPath, "utf8");
    return JSON.parse(serviceAccountKey) as ServiceAccount;
  } catch (error: any) {
    console.error(
      `Failed to read Firebase service account key from ${serviceAccountPath}:`,
      error.message,
    );
    return null;
  }
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
      console.warn(
        "Firebase Admin SDK: Service account credentials are not available. Firestore operations will be disabled.",
      );
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
