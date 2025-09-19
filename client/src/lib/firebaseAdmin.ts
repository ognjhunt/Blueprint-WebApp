// lib/firebaseAdmin.ts
import * as admin from "firebase-admin";
import path from "path";
import { readFileSync } from "fs";

// Option 1: Path to service account key file (RECOMMENDED for local dev, use env for production)
// Ensure 'serviceAccountKey.json' is in your .gitignore!
const serviceAccountKeyFileName = "blueprint-8c1ca-firebase-adminsdk-yu1gh-da1b8bf0d1.json"; // CHANGE THIS to your actual file name
const serviceAccountKeyPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.resolve(process.cwd(), serviceAccountKeyFileName);

let serviceAccount;
try {
  // Use readFileSync and JSON.parse instead of require() for ES modules
  const serviceAccountKey = readFileSync(serviceAccountKeyPath, "utf8");
  serviceAccount = JSON.parse(serviceAccountKey);
} catch (e: any) {
  console.warn(
    `Failed to load Firebase service account key from: ${serviceAccountKeyPath}. \n` +
      `Error: ${e.message} \n` +
      `Ensure the file '${serviceAccountKeyFileName}' exists at the project root or GOOGLE_APPLICATION_CREDENTIALS env var is set correctly.`,
  );
  // If you are deploying to Vercel/Netlify etc., you should set GOOGLE_APPLICATION_CREDENTIALS
  // or load the JSON content from another environment variable.
}

const firebaseConfigForAdmin = {
  // The storageBucket is taken from your client-side firebaseConfig.
  // It's usually the same as your project ID + .appspot.com
  storageBucket:
    process.env.FIREBASE_STORAGE_BUCKET || "blueprint-8c1ca.appspot.com",
};

// Check if admin is properly imported
if (!admin) {
  console.error("Firebase Admin SDK could not be imported");
} else if (!admin.apps) {
  console.error("Firebase Admin SDK apps property is not available");
} else if (!admin.apps.length) {
  try {
    if (!serviceAccount) {
      console.warn(
        "Firebase Admin SDK: Service account credentials are not loaded. Skipping initialization."
      );
    } else {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: firebaseConfigForAdmin.storageBucket,
      });
      console.log("Firebase Admin SDK initialized successfully.");
    }
  } catch (error: any) {
    console.error("Firebase Admin SDK initialization error:", error.stack);
    // Consider how to handle this error. If admin SDK is critical,
    // you might want the app to not start or to clearly signal this failure.
  }
}

// Export the initialized admin services with error handling
export const dbAdmin = admin?.firestore?.() || null;
export const storageAdmin = admin?.storage?.() || null;
export const authAdmin = admin?.auth?.() || null;
export default admin; // Also export the default admin instance
