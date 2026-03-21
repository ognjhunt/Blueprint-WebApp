// lib/firebaseAdmin.ts
import fs from "node:fs";
import admin, { type ServiceAccount } from "firebase-admin";

function loadServiceAccountFromFile(filePath: string): ServiceAccount | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as ServiceAccount;
  } catch (error: any) {
    console.error(
      `Failed to load Firebase service account from GOOGLE_APPLICATION_CREDENTIALS=${filePath}:`,
      error.message,
    );
    return null;
  }
}

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
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (credentialsPath) {
    return loadServiceAccountFromFile(credentialsPath);
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
    const hasApplicationDefaultContext = Boolean(
      process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
      process.env.K_SERVICE?.trim() ||
      process.env.FUNCTION_TARGET?.trim() ||
      process.env.GOOGLE_CLOUD_PROJECT?.trim(),
    );

    if (!serviceAccount && !hasApplicationDefaultContext) {
      const message =
        "Firebase Admin SDK: Missing service account credentials. " +
        "Set FIREBASE_SERVICE_ACCOUNT_JSON, GOOGLE_APPLICATION_CREDENTIALS, or attach a Cloud Run/Functions service account.";
      console.warn(message);
      return null;
    }

    try {
      const app = admin.initializeApp({
        credential: serviceAccount
          ? admin.credential.cert(serviceAccount)
          : admin.credential.applicationDefault(),
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
