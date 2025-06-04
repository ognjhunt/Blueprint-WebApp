// lib/firebaseAdmin.ts
import * as admin from "firebase-admin";
import path from "path";

// Option 1: Path to service account key file (RECOMMENDED for local dev, use env for production)
// Ensure 'serviceAccountKey.json' is in your .gitignore!
const serviceAccountKeyFileName = "blueprint-8c1ca-firebase-adminsdk-yu1gh-da1b8bf0d1.json"; // CHANGE THIS to your actual file name
const serviceAccountKeyPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.resolve(process.cwd(), serviceAccountKeyFileName);

let serviceAccount;
try {
  // require() is often easier for loading JSON if the path is determined at runtime start
  serviceAccount = require(serviceAccountKeyPath);
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

if (!admin.apps.length) {
  try {
    if (!serviceAccount) {
      throw new Error(
        "Firebase Admin SDK: Service account credentials are not loaded. Cannot initialize.",
      );
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: firebaseConfigForAdmin.storageBucket,
    });
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (error: any) {
    console.error("Firebase Admin SDK initialization error:", error.stack);
    // Consider how to handle this error. If admin SDK is critical,
    // you might want the app to not start or to clearly signal this failure.
  }
}

// Export the initialized admin services
export const dbAdmin = admin.firestore();
export const storageAdmin = admin.storage();
export const authAdmin = admin.auth();
export default admin; // Also export the default admin instance
