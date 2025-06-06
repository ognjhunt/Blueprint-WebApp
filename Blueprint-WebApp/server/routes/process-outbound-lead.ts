import { Request, Response } from "express";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

// Your Firebase config (same as frontend)
const firebaseConfig = {
  apiKey: "AIzaSyBfLLwlFQvxkztjgihEG7_2p9rTipdXGFs",
  authDomain: "blueprint-8c1ca.firebaseapp.com",
  databaseURL: "https://blueprint-8c1ca-default-rtdb.firebaseio.com",
  projectId: "blueprint-8c1ca",
  storageBucket: "blueprint-8c1ca.appspot.com",
  messagingSenderId: "744608654760",
  appId: "1:744608654760:web:5b697e80345ac2b0f4a99d",
  measurementId: "G-7LHTQSRF9L",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface OutboundLeadData {
  name: string;
  company: string;
  email: string;
  city: string;
  state: string;
  message: string;
  companyWebsite?: string;
  offWaitlistUrl: string;
  phone?: string;
  isOutboundLead: boolean;
}

export default async function processOutboundLeadHandler(
  req: Request,
  res: Response,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const data: OutboundLeadData = req.body;

    // Validate required fields
    if (!data.name || !data.email || !data.company || !data.offWaitlistUrl) {
      return res.status(400).json({
        error: "Missing required fields: name, email, company, offWaitlistUrl",
      });
    }

    // Step 1: Create Firebase token record
    const urlParams = new URLSearchParams(data.offWaitlistUrl.split("?")[1]);
    const token = urlParams.get("token");

    if (!token) {
      return res
        .status(400)
        .json({ error: "No token found in offWaitlistUrl" });
    }

    // Create the Firebase token record
    await addDoc(collection(db, "waitlistTokens"), {
      token: token,
      email: data.email,
      company: data.company,
      status: "unused",
      createdAt: serverTimestamp(),
    });

    console.log(`✅ Created Firebase token record for: ${data.company}`);

    // Step 2: Call your existing process-waitlist API
    const apiResponse = await fetch(
      `${req.headers.origin}/api/process-waitlist`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      },
    );

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error("Error calling process-waitlist:", errorText);
      // Even if the API call fails, we've created the token, so signup will work
      return res.json({
        success: true,
        message: "Token created successfully, but MCP process may have failed",
        tokenCreated: true,
        mcpProcessed: false,
      });
    }

    const apiResult = await apiResponse.json();
    console.log("✅ MCP process completed successfully");

    res.json({
      success: true,
      message: "Outbound lead processed successfully",
      tokenCreated: true,
      mcpProcessed: true,
      mcpResponse: apiResult,
    });
  } catch (error) {
    console.error("Error processing outbound lead:", error);
    res.status(500).json({
      error: "Failed to process outbound lead",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
