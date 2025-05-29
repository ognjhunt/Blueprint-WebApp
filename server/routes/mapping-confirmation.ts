import { Request, Response } from "express";
import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";
import * as admin from "firebase-admin"; // Added for Firebase Admin SDK
//import admin, { db, storageAdmin } from '@/lib/firebaseAdmin'; // Adjust path if you placed it elsewhere

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Helper function to extract structured data from AI response (Phase 1)
function extractDataFromAIResponse(responseText: string): {
  [key: string]: string;
} {
  const extractedData: { [key: string]: string } = {};
  if (typeof responseText !== "string" || !responseText.trim()) {
    console.warn(
      "extractDataFromAIResponse received invalid input or empty string.",
    );
    return extractedData; // Return empty if no valid text
  }
  const lines = responseText.split("\n");
  const markers = [
    "SHEET_ROW_ID:",
    "SHEET_CONTACT_NAME:",
    "SHEET_CONTACT_EMAIL:",
    "MAPPING_DURATION_MINUTES:",
    "CAR_TRAVEL_MINUTES:",
    "PUBLIC_TRANSPORT_MINUTES:",
    "COMPANY_URL_USED:",
  ];

  lines.forEach((line) => {
    for (const marker of markers) {
      if (line.trim().startsWith(marker)) {
        const key = marker
          .substring(0, marker.length - 1)
          .replace(/ /g, "_")
          .toUpperCase();
        const value = line.substring(marker.length).trim();
        extractedData[key] = value;
        break;
      }
    }
  });
  return extractedData;
}

// Helper function to extract Key URLs from Deep Research Output (Phase 2)
function extractUrlsFromDeepResearch(markdownText: string): {
  [key: string]: string;
} {
  const urls: { [key: string]: string } = {};
  if (typeof markdownText !== "string" || !markdownText) {
    return urls;
  }
  const lines = markdownText.split("\n");
  let inKeyUrlsSection = false;

  // Define mappings from the text labels in markdown to Firestore field names
  const keyMappings: { [key: string]: string } = {
    Menu: "menu_url",
    Reservations: "reservations_url",
    "Wait List": "wait_list_url",
    "Online Ordering": "online_ordering_url",
    Reviews: "reviews_url",
    "Loyalty Program": "loyalty_program_url",
    "Specials/Promotions": "specials_promotions_url",
    "Events/Calendar": "events_url",
    // Add other mappings if needed
  };

  // Regex to find lines like "- Menu: http://example.com" or "- Menu: N/A"
  // It also handles potential markdown links like "- Menu: [Visit Here](http://example.com)"
  const itemRegex = /^\s*-\s*([^:]+):\s*(.*)/;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("### Key URLs Found:")) {
      inKeyUrlsSection = true;
      continue;
    }

    // If we encounter another H3 or a completely different section, stop processing Key URLs.
    // This condition might need adjustment based on the variability of the AI's output.
    if (
      inKeyUrlsSection &&
      (trimmedLine.startsWith("### ") || trimmedLine === "")
    ) {
      // If it's an empty line immediately after "### Key URLs Found:", don't break yet.
      // If it's another heading, or several empty lines, then break.
      // For simplicity, we'll break on any other H3.
      if (
        trimmedLine.startsWith("### ") &&
        !trimmedLine.startsWith("### Key URLs Found:")
      ) {
        inKeyUrlsSection = false; // Exit the section
        break;
      }
    }

    if (inKeyUrlsSection) {
      const match = trimmedLine.match(itemRegex);
      if (match) {
        const keyName = match[1].trim(); // e.g., "Menu"
        let value = match[2].trim(); // e.g., "http://example.com" or "[Text](url)" or "N/A"

        if (value.toLowerCase() !== "n/a" && value !== "") {
          // Extract URL if it's in markdown format [Text](URL)
          const markdownLinkMatch = value.match(
            /\[.*?\]\((https?:\/\/[^\s)]+)\)/,
          );
          if (markdownLinkMatch && markdownLinkMatch[1]) {
            value = markdownLinkMatch[1];
          }

          // Ensure it's a plausible URL (basic check)
          if (value.startsWith("http://") || value.startsWith("https://")) {
            if (keyMappings[keyName]) {
              urls[keyMappings[keyName]] = value;
            }
          }
        }
      }
    }
  }
  return urls;
}

export default async function processMappingConfirmationHandler(
  req: Request,
  res: Response,
) {
  try {
    const {
      chosen_time_of_mapping,
      chosen_date_of_mapping,
      address,
      company_url,
      company_name,
      contact_name,
      contact_phone_number,
      estimated_square_footage,
      blueprint_id,
    }: {
      have_we_onboarded?: string;
      chosen_time_of_mapping?: string;
      chosen_date_of_mapping?: string;
      have_user_chosen_date?: string;
      address?: string;
      company_url?: string;
      company_name?: string;
      contact_name?: string;
      contact_phone_number?: string;
      estimated_square_footage?: number;
      blueprint_id?: string;
    } = req.body;

    const requiredFields = {
      company_name,
      contact_name,
      contact_phone_number,
      address,
      chosen_date_of_mapping,
      chosen_time_of_mapping,
      estimated_square_footage,
      company_url,
      blueprint_id,
    };

    for (const [field, value] of Object.entries(requiredFields)) {
      if (value === undefined || value === null || value === "") {
        return res.status(400).json({
          error: `Missing required field: ${field}`,
        });
      }
    }

    const calculatedMappingDuration =
      Number(estimated_square_footage) / 100 + 15;

    const promptCall1 = `
Blueprint Post-Signup - Phase 1: Initial Mapping Setup for ${company_name}.

**WEBHOOK DATA:**
- Company: ${company_name}
- Contact (from Webhook): ${contact_name} (${contact_phone_number})
- Address: ${address}
- Website: ${company_url || "Not provided"}
- Mapping Date: ${chosen_date_of_mapping}
- Mapping Time: ${chosen_time_of_mapping}
- Est. Square Footage: ${estimated_square_footage}

**TASK 1: LOCATE & PREPARE GOOGLE SHEET CONTACT**
1.  In the "Blueprint Waitlist" spreadsheet, find the row where the 'Website' column matches "${company_url}".
2.  From this specific row, extract:
    - Full Name from 'Name' (Column A) - store as [SheetContactName].
    - Email from 'Email' (Column B) - store as [SheetContactEmail].
3.  If multiple rows match, use the first one found. If no row is found, note this in your final summary, use "${contact_name}" as [SheetContactName] and "no-reply@blueprint.com" as [SheetContactEmail] (or another placeholder) for subsequent email steps BUT CLEARLY INDICATE THIS FALLBACK.
4.  Store the Row ID of the matched row as [SheetRowID]. If no row is found, use "NOT_FOUND" for [SheetRowID].

**TASK 2: UPDATE GOOGLE SHEET (using [SheetRowID] if found and not "NOT_FOUND", else skip this task and note it)**
Update the following columns for row [SheetRowID]:
- "Have they picked a date+time for mapping?" = "Yes"
- "Have we Onboarded?" = "No"
- "Chosen Date of Mapping" = "${chosen_date_of_mapping}"
- "Chosen Time of Mapping" = "${chosen_time_of_mapping}"
- "Contact Name" (this is the webhook contact) = "${contact_name}"
- "Contact Phone Number" (this is the webhook contact) = "${contact_phone_number}"
- "Address" = "${address}"
- "Est. Sq Ft" (if such a column exists, otherwise use a suitable column or note) = "${estimated_square_footage}"

**TASK 3: DRAFT CONFIRMATION EMAIL**
To: [SheetContactEmail] (using the email found/derived in TASK 1)
Subject: "Confirmed for Blueprint Mapping: ${company_name}!"
Body:
"Hi [SheetContactName],

We've confirmed a Blueprint Mapping for ${company_name} at ${address ? address.replace(", USA", "") : "the provided address"} on ${chosen_date_of_mapping} at ${chosen_time_of_mapping}.

You should receive a Google Calendar Invite for this shortly. Please accept it to confirm.

Based on the provided information (${estimated_square_footage} sq ft), we estimate the mapping will take approximately ${calculatedMappingDuration} minutes.

Pilot Details: https://blueprint-vision-fork-nijelhunt.replit.app/pilot-program
Questions? Reply to this email or schedule a chat: https://calendly.com/blueprintar/30min

Thanks,
Nijel Hunt
Co-Founder at Blueprint"

**TASK 4: CREATE GOOGLE CALENDAR EVENT**
Event Title: "Blueprint Mapping: ${company_name}"
Description: "Company: ${company_name}\\nContact (Webhook): ${contact_name} (${contact_phone_number})\\nPrimary Contact (Sheet): [SheetContactName] ([SheetContactEmail])\\nAddress: ${address}\\nEst. Sq. Ft: ${estimated_square_footage}"
Location: ${address}
Start: ${chosen_date_of_mapping} ${chosen_time_of_mapping} (Ensure this is in a Zapier-compatible format, assume EST if no timezone specified by user. If the provided time is already in a specific timezone, use that.)
End: Calculate end time based on a 60-minute duration from the start time.
Attendees: Add [SheetContactEmail] AND founders@blueprint.com.
Allow conflicts: Yes

**TASK 5: DRAFT DAY-OF REMINDER EMAIL**
To: [SheetContactEmail]
Subject: "REMINDER: Blueprint Mapping for ${company_name} is Today!"
Body:
"Hi [SheetContactName],

Just a friendly reminder that your Blueprint Mapping for ${company_name} is scheduled for today, ${chosen_date_of_mapping}, at ${chosen_time_of_mapping} at ${address ? address.replace(", USA", "") : "the provided address"}.

The webhook contact, ${contact_name}, will also receive an SMS reminder approximately 1 hour before.

If you have any questions, please contact founders@blueprint.com.

See you soon,
Nijel Hunt
Co-Founder at Blueprint"
This draft should be scheduled to be sent on ${chosen_date_of_mapping} at 9:00 AM EST.

**TASK 6: SEND IMMEDIATE TWILIO SMS TO WEBHOOK CONTACT**
To: ${contact_phone_number} (Fallback: +19196389913 if primary is invalid/missing)
Message: "Hi ${contact_name}! Your Blueprint Mapping for ${company_name} is confirmed for ${chosen_date_of_mapping} at ${chosen_time_of_mapping} (${address ? address.replace(", USA", "") : "location"}). Email to [SheetContactEmail] & Calendar invite sent. Reminder SMS 1hr prior. - Blueprint"

**TASK 7: SCHEDULE 1-HOUR REMINDER TWILIO SMS TO WEBHOOK CONTACT**
To: ${contact_phone_number} (Fallback: +19196389913)
Message: "Reminder: Your Blueprint Mapping for ${company_name} at ${address ? address.replace(", USA", "") : "location"} is in about 1 hour (${chosen_time_of_mapping}). See you soon! - Blueprint"
Schedule: 1 hour before ${chosen_date_of_mapping} ${chosen_time_of_mapping} (use the same timezone considerations as TASK 4 for the base time).

**TASK 8: GET TRAVEL TIME (Use Google Maps via Zapier if available, otherwise Perplexity. Prioritize Zapier's Google Maps tool for reliability)**
Origin: "1005 Crete St, Durham, NC 27707"
Destination: "${address}"
Return ONLY minutes for car/Uber travel time as [CarTravelMinutes] AND public transport travel time as [PublicTransportMinutes]. If a mode is unavailable, return 'N/A' for it.

**TASK 9: SEND SLACK MESSAGE**
Channel: gumloop-experiment
Message:
"✅ NEW APPOINTMENT (Phase 1 Complete): ${company_name}
Contact (Webhook): ${contact_name} (${contact_phone_number})
Contact (Sheet): [SheetContactName] ([SheetContactEmail])
Location: ${address}
Date: ${chosen_date_of_mapping} @ ${chosen_time_of_mapping}
Est. Mapping Duration: ${calculatedMappingDuration} mins
Travel (Car): [CarTravelMinutes] mins / (Public): [PublicTransportMinutes] mins
Est. Sq. Ft: ${estimated_square_footage}
Sheet Row ID: [SheetRowID]

Next: Phase 2 (Deep Research) for ${company_url}."

Execute all tasks sequentially.
IMPORTANT: At the VERY END of your response, provide the following details in this exact format, on separate lines, ensuring each value is present:
SHEET_ROW_ID:[SheetRowID]
SHEET_CONTACT_NAME:[SheetContactName]
SHEET_CONTACT_EMAIL:[SheetContactEmail]
MAPPING_DURATION_MINUTES:${calculatedMappingDuration}
CAR_TRAVEL_MINUTES:[CarTravelMinutes]
PUBLIC_TRANSPORT_MINUTES:[PublicTransportMinutes]
COMPANY_URL_USED:${company_url}
Provide a summary of all actions taken. Confirm if any fallback was used.
`;

    console.log("Sending Prompt for Call 1 to OpenAI...");
    // The type from openai.responses.create() is OpenAI.Response
    const mcpResponseCall1: OpenAI.Response = await openai.responses.create({
      model: "o4-mini",
      input: promptCall1,
      tools: [
        {
          type: "mcp",
          server_label: "zapier",
          server_url:
            "https://mcp.zapier.com/api/mcp/s/bd9c31ca-1f38-455b-9cb2-9f22c45e7814/mcp",
          require_approval: "never",
          headers: {
            Authorization:
              "Bearer YmQ5YzMxY2EtMWYzOC00NTViLTljYjItOWYyMmM0NWU3ODE0OjJkN2ZmMzRjLTQ1MTgtNDNkMC05ODg0LTc2MzA5NTYyMjFjYw==",
          },
        },
      ],
    });

    console.log(
      "Full mcpResponseCall1 object from OpenAI:",
      JSON.stringify(mcpResponseCall1, null, 2),
    );

    // NEW CODE - REPLACE THE OLD RESPONSE HANDLING:
    let responseTextCall1: string | null | undefined;

    // Try different possible response locations, with output_text FIRST
    if (
      mcpResponseCall1.output_text &&
      typeof mcpResponseCall1.output_text === "string"
    ) {
      responseTextCall1 = mcpResponseCall1.output_text;
    } else if (
      mcpResponseCall1.text &&
      typeof mcpResponseCall1.text === "string"
    ) {
      responseTextCall1 = mcpResponseCall1.text;
    } else if (mcpResponseCall1.choices?.[0]?.message?.content) {
      responseTextCall1 = mcpResponseCall1.choices[0].message.content;
    } else if (
      mcpResponseCall1.output &&
      typeof mcpResponseCall1.output === "string"
    ) {
      responseTextCall1 = mcpResponseCall1.output;
    } else if (
      mcpResponseCall1.result &&
      typeof mcpResponseCall1.result === "string"
    ) {
      responseTextCall1 = mcpResponseCall1.result;
    } else if (
      mcpResponseCall1.content &&
      typeof mcpResponseCall1.content === "string"
    ) {
      responseTextCall1 = mcpResponseCall1.content;
    }

    console.log("=== DEBUGGING CALL 1 RESPONSE ===");
    console.log("Response text found:", !!responseTextCall1);
    console.log(
      "Using field:",
      mcpResponseCall1.output_text ? "output_text" : "other",
    );

    if (typeof responseTextCall1 !== "string" || !responseTextCall1.trim()) {
      console.error("=== FULL RESPONSE STRUCTURE DEBUG ===");
      console.error(JSON.stringify(mcpResponseCall1, null, 2));

      return res.status(500).json({
        error: "Failed to get valid text response from Call 1",
        debug_info: {
          available_keys: Object.keys(mcpResponseCall1),
          has_output_text: !!mcpResponseCall1.output_text,
          has_text: !!mcpResponseCall1.text,
        },
      });
    }

    console.log("Successfully extracted responseTextCall1:", responseTextCall1);

    const extractedDataCall1 = extractDataFromAIResponse(responseTextCall1);

    // Check if essential data was extracted. If not, the AI might not have followed format.
    if (
      !extractedDataCall1.SHEET_ROW_ID ||
      !extractedDataCall1.COMPANY_URL_USED
    ) {
      console.error(
        "Error: Essential data (SHEET_ROW_ID or COMPANY_URL_USED) not found in AI's formatted response. Extracted data:",
        extractedDataCall1,
        "Full AI response text:",
        responseTextCall1,
      );
      return res.status(500).json({
        error:
          "AI response for Call 1 did not contain the expected structured data. Check prompt and AI output.",
        details:
          "SHEET_ROW_ID or COMPANY_URL_USED missing from the AI's explicitly formatted output section.",
      });
    }

    const sheetRowId = extractedDataCall1.SHEET_ROW_ID;
    const companyUrlForCall2 = extractedDataCall1.COMPANY_URL_USED;

    const promptCall2 = `
    Blueprint Post-Signup - Phase 2: Deep Research & Content Generation for ${company_name}.

    **INPUT DATA:**
    - Company Name: ${company_name}
    - Company URL: ${companyUrlForCall2 || "No website provided, conduct general search if possible."}
    - Company Address: ${address}
    - Google Sheet Row ID to update: ${sheetRowId} (If "LOOKUP_REQUIRED" or "NOT_FOUND", your first step in TASK 2 must be to find the row by Website column matching "${companyUrlForCall2}")

    **TASK 1: PERFORM DEEP COMPANY RESEARCH (Using Perplexity Sonar or similar advanced web research tool available via Zapier)**
    For company at URL: ${companyUrlForCall2 || "No website provided. Attempt research based on Company Name and Address."} (and physical address: ${address} for local context if needed)
    1.  Visit main website. If it's a generic portal, find the specific page for the location. If no URL provided, attempt to find one.
    2.  Extract Key URLs: Menu, Reservations, Wait List, Online Ordering, Reviews, Loyalty Program, Specials/Promotions, Events/Calendar. List them. If a URL is not found, state "N/A".
    3.  Menu Scrape: Get full menu (items, descriptions, prices). If PDF/image, provide a link to it and attempt to summarize its contents if tool supports. Note if not fully scrapable.
    4.  General Info Crawl: Hours, Social Media links, Contact Info (phone, email), About Us, Policies.
    5.  Content Scrape: For each Key URL from (1.2) that is not N/A, scrape its textual content.
    6.  Reviews: Find up to 6 Google Reviews & up to 6 Yelp Reviews (preferably 4+ stars, recent, extract text, reviewer name/initials, rating). If fewer are found, list what's available.
    7.  Engagement Questions: Create 5-10 personalized multiple-choice questions (with distinct correct answers) about the company, its services, or menu, based on your research.
    Compile all findings into a well-structured markdown block. Let's call this [DeepResearchOutput].

    **TASK 2: UPDATE GOOGLE SHEET WITH DEEP RESEARCH**
    Spreadsheet: "Blueprint Waitlist"
    If the provided Google Sheet Row ID is "LOOKUP_REQUIRED" or "NOT_FOUND", first find the row where 'Website' column matches "${companyUrlForCall2}" and use that Row ID. If still not found after attempting lookup, note this clearly.
    If a valid Row ID is available, update the column "Company Research" with the entire [DeepResearchOutput] from TASK 1.
    Also, update a column named "Research Timestamp" (or create if it doesn't exist) with the current date & time (e.g., YYYY-MM-DD HH:MM AM/PM EST).

    **TASK 3: CREATE NOTION PAGE**
    In a Notion database/page named "Blueprint Hub" (or a relevant parent page you can access):
    Title: "${company_name} - Blueprint Design Ideas & Research"
    Icon: (AI-selected emoji based on company type, e.g., 🍕 for pizza, ☕ for cafe, 🛍️ for retail)
    Cover: (AI-selected stock image URL based on company branding/type/location)
    Content (structured using Notion blocks like Headings, Text, Bullet lists):
    "### Deep Research Summary
    [Paste a concise 3-5 sentence summary of [DeepResearchOutput] here, highlighting key findings like menu type/main products, main services, hours. Include the direct website link: ${companyUrlForCall2 || "N/A"}]

    ### Key URLs Found: 
    (This section is CRITICAL for Firestore update. Ensure clear list format, e.g., "- Menu: [URL or N/A]")
    - Menu: [Link or N/A from TASK 1.2]
    - Reservations: [Link or N/A from TASK 1.2]
    - Wait List: [Link or N/A from TASK 1.2]
    - Online Ordering: [Link or N/A from TASK 1.2]
    - Reviews: [Link or N/A from TASK 1.2]
    - Loyalty Program: [Link or N/A from TASK 1.2]
    - Specials/Promotions: [Link or N/A from TASK 1.2]
    - Events/Calendar: [Link or N/A from TASK 1.2]

    ### AI-Generated Blueprint AR Experience Ideas:
    (Based on [DeepResearchOutput], generate 3-5 creative AR experience ideas. For each, suggest potential placements/uses for Text, 3D Models, Media (images/videos), Webpages, and Uploaded Content (MP3/4, GLB, PNG, PDF, PPT) that could be relevant to the idea.)
       **Idea 1: [Descriptive Title]**
          - *Objective:* [Brief goal of this AR idea]
          - *Text Elements:* [Examples]
          - *3D Models:* [Examples, e.g., featured product, mascot]
          - *Media:* [Examples, e.g., promotional video, image gallery]
          - *Webpages:* [Examples, e.g., link to online ordering, loyalty signup]
          - *Uploaded Content:* [Examples, e.g., PDF menu, promotional audio]
       **(Repeat for 2-4 more ideas)**

    ### Customer Engagement Questions (from Research):
    (List the 5-10 MCQs with their answers from TASK 1.7)"

    Execute tasks sequentially. Provide a summary of actions, including the Notion page URL. If research was limited or any task failed, note these limitations clearly.
    The entire response from this phase will be considered [DeepResearchOutput].
    `;

    console.log("Sending Prompt for Call 2 to OpenAI...");
    const mcpResponseCall2: OpenAI.Response = await openai.responses.create({
      model: "o4-mini",
      input: promptCall2,
      tools: [
        {
          type: "mcp",
          server_label: "zapier",
          server_url:
            "https://mcp.zapier.com/api/mcp/s/bd9c31ca-1f38-455b-9cb2-9f22c45e7814/mcp",
          require_approval: "never",
          headers: {
            Authorization:
              "Bearer YmQ5YzMxY2EtMWYzOC00NTViLTljYjItOWYyMmM0NWU3ODE0OjJkN2ZmMzRjLTQ1MTgtNDNkMC05ODg0LTc2MzA5NTYyMjFjYw==",
          },
        },
      ],
    });

    console.log(
      "Full mcpResponseCall2 object from OpenAI:",
      JSON.stringify(mcpResponseCall2, null, 2),
    );

    // Fix Call 2 response handling too:
    let responseTextCall2: string | null | undefined;

    if (
      mcpResponseCall2.output_text &&
      typeof mcpResponseCall2.output_text === "string"
    ) {
      responseTextCall2 = mcpResponseCall2.output_text;
    } else if (
      mcpResponseCall2.text &&
      typeof mcpResponseCall2.text === "string"
    ) {
      responseTextCall2 = mcpResponseCall2.text;
    } else if (mcpResponseCall2.choices?.[0]?.message?.content) {
      responseTextCall2 = mcpResponseCall2.choices[0].message.content;
    } else if (
      mcpResponseCall2.output &&
      typeof mcpResponseCall2.output === "string"
    ) {
      responseTextCall2 = mcpResponseCall2.output;
    } else if (
      mcpResponseCall2.result &&
      typeof mcpResponseCall2.result === "string"
    ) {
      responseTextCall2 = mcpResponseCall2.result;
    } else if (
      mcpResponseCall2.content &&
      typeof mcpResponseCall2.content === "string"
    ) {
      responseTextCall2 = mcpResponseCall2.content;
    }

    if (typeof responseTextCall2 !== "string" || !responseTextCall2.trim()) {
      console.error("=== CALL 2 FULL RESPONSE STRUCTURE DEBUG ===");
      console.error(JSON.stringify(mcpResponseCall2, null, 2));

      return res.status(500).json({
        error: "Failed to get valid text response from Call 2",
        debug_info: {
          available_keys: Object.keys(mcpResponseCall2),
          has_output_text: !!mcpResponseCall2.output_text,
          has_text: !!mcpResponseCall2.text,
        },
      });
    }
    console.log("Successfully extracted responseTextCall2:", responseTextCall2);

    // --- START: New Firebase Operations ---
    let firebaseStoragePath: string | null = null;
    let firestoreUpdateDetails: any = { success: false };
    let firebaseOpsError: string | null = null;

    if (blueprint_id) {
      // Ensure blueprint_id is available
      try {
        // Ensure Firebase Admin is initialized
        if (!admin.apps.length) {
          // This is a critical error if not initialized. For this example, we log and proceed,
          // but in a production app, this should be handled robustly, or initialization guaranteed.
          console.error(
            "CRITICAL: Firebase Admin SDK is not initialized. Firebase operations will fail.",
          );
          throw new Error("Firebase Admin SDK not initialized.");
        }
        const db = admin.firestore();
        const bucket = admin.storage().bucket(); // Default bucket

        // 1. Upload Deep Research output (responseTextCall2) to Firebase Storage
        // The "IF THE output from deep research contains markdown files" implies that
        // responseTextCall2 itself is the markdown content to be uploaded.
        if (responseTextCall2) {
          const storageFilePath = `blueprints/${blueprint_id}/deep_research_report.md`;
          const file = bucket.file(storageFilePath);

          await file.save(responseTextCall2, {
            metadata: {
              contentType: "text/markdown; charset=utf-8", // Specify UTF-8
            },
          });
          firebaseStoragePath = `gs://${bucket.name}/${storageFilePath}`;
          console.log(
            `Deep research report uploaded to Firebase Storage: ${firebaseStoragePath}`,
          );
        }

        // 2. Update Firestore document
        const blueprintDocRef = db.collection("blueprints").doc(blueprint_id);
        const firestoreUpdateData: { [key: string]: any } = {
          context: responseTextCall2, // Paste whole output from Deep Research
          researchLastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Extract Key URLs from responseTextCall2 and add them to the update object
        const extractedUrls = extractUrlsFromDeepResearch(responseTextCall2);
        if (Object.keys(extractedUrls).length > 0) {
          console.log("Extracted URLs for Firestore:", extractedUrls);
        } else {
          console.warn(
            "No key URLs extracted from deep research output for Firestore. Check AI output format.",
          );
        }

        for (const key in extractedUrls) {
          firestoreUpdateData[key] = extractedUrls[key];
        }

        await blueprintDocRef.set(firestoreUpdateData, { merge: true }); // Use set with merge to create or update
        firestoreUpdateDetails = {
          success: true,
          documentPath: blueprintDocRef.path,
          updatedFields: Object.keys(firestoreUpdateData),
        };
        console.log(
          `Firestore document ${blueprintDocRef.path} updated successfully.`,
        );
      } catch (fbError: any) {
        console.error("Firebase operation failed:", fbError);
        firebaseOpsError =
          fbError.message ||
          "An unknown error occurred during Firebase operations.";
        // Optional: if Firebase ops are critical, you might re-throw or return 500 here
        // For now, we'll report the error in the response.
      }
    } else {
      firebaseOpsError =
        "Blueprint ID was missing, Firebase operations skipped.";
      console.warn(firebaseOpsError);
    }
    // --- END: New Firebase Operations ---

    res.json({
      success: true,
      phase1_summary: responseTextCall1,
      phase1_extracted_data: extractedDataCall1,
      phase2_summary: responseTextCall2,
      firebase_operations_status: {
        // New section for Firebase results
        storage_upload_path: firebaseStoragePath,
        firestore_update: firestoreUpdateDetails,
        error: firebaseOpsError,
      },
      message:
        "Mapping confirmation workflow (Phases 1 & 2) processed. Review Firebase operations status.",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error processing mapping confirmation:", error);
    let errorMessage = "Failed to process mapping confirmation";
    if (error.response && error.response.data) {
      errorMessage =
        error.response.data.error ||
        error.response.data.message ||
        errorMessage;
    } else if (error.message) {
      errorMessage = error.message;
    }
    res.status(500).json({
      error: "Failed to process mapping confirmation",
      details: errorMessage,
      fullError: error.stack || error.toString(),
    });
  }
}
//NEXT STEPS: Code-execution within API calls (Anthropic supports, i think OpenAI does too) - this is for uploading files + updating document field values, Real Deep Research / Agent API/MCP,
//MAYBE: SPLIT UP API/MCP calls into 2 separate calls - might be too complex for one call

// export default async function processMappingConfirmationHandler(
//   req: Request,
//   res: Response,
// ) {
//   try {
//     // Extract webhook data from request body
//     const {
//       have_we_onboarded,
//       chosen_time_of_mapping,
//       chosen_date_of_mapping,
//       have_user_chosen_date,
//       address,
//       company_url,
//       company_name,
//       contact_name,
//       contact_phone_number,
//       estimated_square_footage,
//     } = req.body;

//     // Validate required fields
//     const requiredFields = {
//       company_name,
//       contact_name,
//       contact_phone_number,
//       address,
//       chosen_date_of_mapping,
//       chosen_time_of_mapping,
//       estimated_square_footage,
//     };

//     const promptCall1 = `
//       Blueprint Post-Signup - Phase 1: Initial Mapping Setup for ${company_name}.

// **WEBHOOK DATA:**
// - Company: ${company_name}
// - Contact: ${contact_name} (${contact_phone_number})
// - Address: ${address}
// - Website: ${company_url || "Not provided"}
// - Date: ${chosen_date_of_mapping}
// - Time: ${chosen_time_of_mapping}
// - EST. SQUARE FOOTAGE: ${estimated_square_footage}

// **STEP 1: UPDATE GOOGLE SHEET**
// Find row in "Blueprint Waitlist" spreadsheet where Website column matches "${company_url}" and update:
// - "Have they picked a date+time for mapping?" = "Yes"
// - "Have we Onboarded?" = "No"
// - "Chosen Date of Mapping" = "${chosen_date_of_mapping}"
// - "Chosen Time of Mapping" = "${chosen_time_of_mapping}"
// - "Contact Name" = "${contact_name}"
// - "Contact Phone Number" = "${contact_phone_number}"

// **STEP 2: DRAFT CONFIRMATION EMAIL**
// Create email draft to Name (column A) email (column B) from matched Google Sheet row - not necessarily the same as the contact from webhook - probably different:
// Subject: "Confirmed for Blueprint Mapping!"
// Body: "We've confirmed a Blueprint Mapping for ${company_name} at ${address.replace(", USA", "")} on ${chosen_date_of_mapping} at ${chosen_time_of_mapping}. You should get a Calendar Invite email soon, please confirm it.

// We will also send a reminder email the day of the scheduled mapping. Based on the provided information, we estimate that the mapping will take ~[calculate: (estimated_square_footage / 100) + 15] minutes.

// If you haven't already, check out our Pilot Details page: https://blueprint-vision-fork-nijelhunt.replit.app/pilot-program

// Questions? Respond to this email or schedule a chat: https://calendly.com/blueprintar/30min

// ____
// Nijel Hunt
// Co-Founder at Blueprint"

// **STEP 3: CREATE GOOGLE CALENDAR EVENT**
// Event: "Scheduled Blueprint Mapping"
// Description: "Company: ${company_name}
// Contact Name: ${contact_name}
// Contact Phone Number: ${contact_phone_number}"
// Location: ${address}
// Start: ${chosen_date_of_mapping} ${chosen_time_of_mapping}
// Duration: 60 minutes
// Allow conflicts: Yes

// **STEP 4: DRAFT DAY-OF REMINDER EMAIL**
// Create draft email scheduled for ${chosen_date_of_mapping} at 9:00 AM EST:
// Subject: "Scheduled Blueprint Mapping is Today!"
// Body: Include calendar event details, mention ${contact_name} gets 1hr advance notice, contact founders@blueprint.com for questions.

// **STEP 5: SEND TWILIO SMS MESSAGE IMMEDIATELY TO CONTACT**
// TO: [CONTACT PHONE NUMBER - if not found/doesnt work - then use +19196389913]
// MESSAGE: "Hi [Contact Name]! You'll ___________

// We plan to meet you at [Address] on [Day] at [Time].

// We also will send a reminder SMS message about 1 hour before the scheduled mapping. See you then!"

// **STEP 6: SCHEDULE TWILIO SMS MESSAGE TO BE SENT 1-HR BEFORE THE START OF THE CREATED CALENDAR EVENT**
// TO: [CONTACT PHONE NUMBER - if not found/doesnt work - then use +19196389913]
// MESSAGE: "Hi [Contact Name], just a reminder that your Blueprint Mapping is scheduled for today at [Address of location] at ${chosen_time_of_mapping}. See you then!

//     const promptCall2 = `
// Blueprint Post-Signup - Phase 2:

//     for (const [field, value] of Object.entries(requiredFields)) {
//       if (!value) {
//         return res.status(400).json({
//           error: `Missing required field: ${field}`,
//         });
//       }
//     }

//     // Your existing MCP call logic goes here
//     const mcpResponse = await openai.responses.create({
//       model: "o4-mini",
//       input: `Blueprint Post-Signup Mapping Automation - Execute complete workflow for ${company_name}:

// **WEBHOOK DATA:**
// - Company: ${company_name}
// - Contact: ${contact_name} (${contact_phone_number})
// - Address: ${address}
// - Website: ${company_url || "Not provided"}
// - Date: ${chosen_date_of_mapping}
// - Time: ${chosen_time_of_mapping}
// - EST. SQUARE FOOTAGE: ${estimated_square_footage}

// **STEP 1: UPDATE GOOGLE SHEET**
// Find row in "Blueprint Waitlist" spreadsheet where Website column matches "${company_url}" and update:
// - "Have they picked a date+time for mapping?" = "Yes"
// - "Have we Onboarded?" = "No"
// - "Chosen Date of Mapping" = "${chosen_date_of_mapping}"
// - "Chosen Time of Mapping" = "${chosen_time_of_mapping}"
// - "Contact Name" = "${contact_name}"
// - "Contact Phone Number" = "${contact_phone_number}"

// **STEP 2: DRAFT CONFIRMATION EMAIL**
// Create email draft to Name (column A) email (column B) from matched Google Sheet row - not necessarily the same as the contact from webhook - probably different:
// Subject: "Confirmed for Blueprint Mapping!"
// Body: "We've confirmed a Blueprint Mapping for ${company_name} at ${address.replace(", USA", "")} on ${chosen_date_of_mapping} at ${chosen_time_of_mapping}. You should get a Calendar Invite email soon, please confirm it.

// We will also send a reminder email the day of the scheduled mapping. Based on the provided information, we estimate that the mapping will take ~[calculate: (estimated_square_footage / 100) + 15] minutes.

// If you haven't already, check out our Pilot Details page: https://blueprint-vision-fork-nijelhunt.replit.app/pilot-program

// Questions? Respond to this email or schedule a chat: https://calendly.com/blueprintar/30min

// ____
// Nijel Hunt
// Co-Founder at Blueprint"

// **STEP 3: CREATE GOOGLE CALENDAR EVENT**
// Event: "Scheduled Blueprint Mapping"
// Description: "Company: ${company_name}
// Contact Name: ${contact_name}
// Contact Phone Number: ${contact_phone_number}"
// Location: ${address}
// Start: ${chosen_date_of_mapping} ${chosen_time_of_mapping}
// Duration: 60 minutes
// Allow conflicts: Yes

// **STEP 4: DRAFT DAY-OF REMINDER EMAIL**
// Create draft email scheduled for ${chosen_date_of_mapping} at 9:00 AM EST:
// Subject: "Scheduled Blueprint Mapping is Today!"
// Body: Include calendar event details, mention ${contact_name} gets 1hr advance notice, contact founders@blueprint.com for questions.

// **STEP 5: SEND TWILIO SMS MESSAGE IMMEDIATELY TO CONTACT**
// TO: [CONTACT PHONE NUMBER - if not found/doesnt work - then use +19196389913]
// MESSAGE: "Hi [Contact Name]! You'll ___________

// We plan to meet you at [Address] on [Day] at [Time].

// We also will send a reminder SMS message about 1 hour before the scheduled mapping. See you then!"

// **STEP 6: SCHEDULE TWILIO SMS MESSAGE TO BE SENT 1-HR BEFORE THE START OF THE CREATED CALENDAR EVENT**
// TO: [CONTACT PHONE NUMBER - if not found/doesnt work - then use +19196389913]
// MESSAGE: "Hi [Contact Name], just a reminder that your Blueprint Mapping is scheduled for today at [Address of location] at ${chosen_time_of_mapping}. See you then!

// **STEP 7: PERPLEXITY TRAVEL TIME QUERY**
// Use Perplexity to get travel duration from "1005 Crete St, Durham, NC 27707" to "${address}" - return ONLY minutes for: car/uber travel time AND public transport travel time.

// **STEP 8: SLACK MESSAGE**
// Send to gumloop-experiment channel:
// "NEW APPOINTMENT:
// CONTACT NAME: ${contact_name}
// LOCATION: ${address}
// EST. TIME OF TRAVEL: [from Step 5]
// DATE: ${chosen_date_of_mapping}
// TIME: ${chosen_time_of_mapping}
// CONTACT PHONE NUMBER: ${contact_phone_number}
// EST. SQUARE FOOTAGE: [estimate from research]"

// **STEP 9: PERPLEXITY DEEP RESEARCH**
// Use Sonar Deep Research model for comprehensive analysis of the Company URL (found in Website column of Google Sheet - same row previously updated) - if can't find it, then just search the company regularly and find website for specific location:
// 1. Visit main website page
// 2. Extract URLs for: Menu, Reservations, Wait List, Online Ordering, Reviews, Loyalty Program, Specials/Promotions, Events/Calendar
// 3. Scrape menu word-for-word with descriptions and prices (download PDFs/images if needed)
// 4. Crawl entire website for: Hours, Social Media, Contact Info, About, Policies, etc.
// 5. Scrape all URLs from step 2 word-for-word
// 6. Find 6 Google Reviews + 6 Yelp Reviews (4+ stars, extract word-for-word)
// 7. Create 10 personalized multiple choice questions with answers for customer engagement

// **STEP 10: UPDATE GOOGLE SHEET WITH DEEP RESEARCH RESULT**
// Find row in "Blueprint Waitlist" spreadsheet where Website column matches "${company_url}" and update:
// - "Company Research" = "[Deep Research Results]" (from previous step - just copy and paste entire Deep Research result)

// **STEP 11: CREATE NOTION PAGE**
// Create page in Blueprint Hub:
// Title: "${company_name} - Design Ideas"
// Content: AI-generated Blueprint experience ideas based on research including content placement suggestions for Text, 3D models, Media, Webpages, and uploaded content (MP3/4, GLB, PNG, PDF, PPT).
// Icon: AI-selected based on company type
// Cover: AI-selected based on company branding

// Execute all steps and confirm completion with summary.`,
//       reasoning: {
//         effort: "high",
//       },
//       tools: [
//         {
//           type: "mcp",
//           server_label: "zapier",
//           server_url:
//             "https://mcp.zapier.com/api/mcp/s/bd9c31ca-1f38-455b-9cb2-9f22c45e7814/mcp",
//           require_approval: "never",
//           headers: {
//             Authorization:
//               "Bearer YmQ5YzMxY2EtMWYzOC00NTViLTljYjItOWYyMmM0NWU3ODE0OjJkN2ZmMzRjLTQ1MTgtNDNkMC05ODg0LTc2MzA5NTYyMjFjYw==",
//           },
//         },
//       ],
//     });

//     res.json({ success: true, response: mcpResponse });
//   } catch (error) {
//     console.error("Error processing waitlist:", error);
//     res.status(500).json({ error: "Failed to process waitlist signup" });
//   }
// }

// export default async function processMappingConfirmationHandler(
//   req: Request,
//   res: Response,
// ) {
//   try {
//     // Extract webhook data from request body
//     const {
//       have_we_onboarded,
//       chosen_time_of_mapping,
//       chosen_date_of_mapping,
//       have_user_chosen_date,
//       address,
//       company_url,
//       company_name,
//       contact_name,
//       contact_phone_number,
//       estimated_square_footage,
//     } = req.body;

//     // Validate required fields
//     const requiredFields = {
//       company_name,
//       contact_name,
//       contact_phone_number,
//       address,
//       chosen_date_of_mapping,
//       chosen_time_of_mapping,
//       estimated_square_footage,
//     };

//     for (const [field, value] of Object.entries(requiredFields)) {
//       if (!value) {
//         return res.status(400).json({
//           error: `Missing required field: ${field}`,
//         });
//       }
//     }

//     // Your existing MCP call logic goes here
//     const mcpResponse = await anthropic.beta.messages.create({
//       model: "claude-sonnet-4-20250514",
//       max_tokens: 4000,
//       messages: [
//         {
//           role: "user",
//           content: `Blueprint Post-Signup Mapping Automation - Execute complete workflow for ${company_name}:

// **WEBHOOK DATA:**
// - Company: ${company_name}
// - Contact: ${contact_name} (${contact_phone_number})
// - Address: ${address}
// - Website: ${company_url || "Not provided"}
// - Date: ${chosen_date_of_mapping}
// - Time: ${chosen_time_of_mapping}
// - EST. SQUARE FOOTAGE: ${estimated_square_footage}

// **STEP 1: UPDATE GOOGLE SHEET**
// Find row in "Blueprint Waitlist" spreadsheet where Website column matches "${company_url}" and update:
// - "Have they picked a date+time for mapping?" = "Yes"
// - "Have we Onboarded?" = "No"
// - "Chosen Date of Mapping" = "${chosen_date_of_mapping}"
// - "Chosen Time of Mapping" = "${chosen_time_of_mapping}"
// - "Contact Name" = "${contact_name}"
// - "Contact Phone Number" = "${contact_phone_number}"

// **STEP 2: DRAFT CONFIRMATION EMAIL**
// Create email draft to Name (column A) email (column B) from matched Google Sheet row - not necessarily the same as the contact from webhook - probably different:
// Subject: "Confirmed for Blueprint Mapping!"
// Body: "We've confirmed a Blueprint Mapping for ${company_name} at ${address.replace(", USA", "")} on ${chosen_date_of_mapping} at ${chosen_time_of_mapping}. You should get a Calendar Invite email soon, please confirm it.

// We will also send a reminder email the day of the scheduled mapping. Based on the provided information, we estimate that the mapping will take ~[calculate: (estimated_square_footage / 100) + 15] minutes.

// If you haven't already, check out our Pilot Details page: https://blueprint-vision-fork-nijelhunt.replit.app/pilot-program

// Questions? Respond to this email or schedule a chat: https://calendly.com/blueprintar/30min

// ____
// Nijel Hunt
// Co-Founder at Blueprint"

// **STEP 3: CREATE GOOGLE CALENDAR EVENT**
// Event: "Scheduled Blueprint Mapping"
// Description: "Company: ${company_name}
// Contact Name: ${contact_name}
// Contact Phone Number: ${contact_phone_number}"
// Location: ${address}
// Start: ${chosen_date_of_mapping} ${chosen_time_of_mapping}
// Duration: 60 minutes
// Allow conflicts: Yes

// **STEP 4: DRAFT DAY-OF REMINDER EMAIL**
// Create draft email scheduled for ${chosen_date_of_mapping} at 9:00 AM EST:
// Subject: "Scheduled Blueprint Mapping is Today!"
// Body: Include calendar event details, mention ${contact_name} gets 1hr advance notice, contact founders@blueprint.com for questions.

// **STEP 5: SEND TWILIO SMS MESSAGE IMMEDIATELY TO CONTACT**
// TO: [CONTACT PHONE NUMBER - if not found/doesnt work - then use +19196389913]
// MESSAGE: "Hi [Contact Name]! You'll ___________

// We plan to meet you at [Address] on [Day] at [Time].

// We also will send a reminder SMS message about 1 hour before the scheduled mapping. See you then!"

// **STEP 6: SCHEDULE TWILIO SMS MESSAGE TO BE SENT 1-HR BEFORE THE START OF THE CREATED CALENDAR EVENT**
// TO: [CONTACT PHONE NUMBER - if not found/doesnt work - then use +19196389913]
// MESSAGE: "Hi [Contact Name], just a reminder that your Blueprint Mapping is scheduled for today at [Address of location] at ${chosen_time_of_mapping}. See you then!

// **STEP 7: PERPLEXITY TRAVEL TIME QUERY**
// Use Perplexity to get travel duration from "1005 Crete St, Durham, NC 27707" to "${address}" - return ONLY minutes for: car/uber travel time AND public transport travel time.

// **STEP 8: SLACK MESSAGE**
// Send to gumloop-experiment channel:
// "NEW APPOINTMENT:
// CONTACT NAME: ${contact_name}
// LOCATION: ${address}
// EST. TIME OF TRAVEL: [from Step 5]
// DATE: ${chosen_date_of_mapping}
// TIME: ${chosen_time_of_mapping}
// CONTACT PHONE NUMBER: ${contact_phone_number}
// EST. SQUARE FOOTAGE: [estimate from research]"

// **STEP 9: PERPLEXITY DEEP RESEARCH**
// Use Sonar Deep Research model for comprehensive analysis of the Company URL (found in Website column of Google Sheet - same row previously updated) - if can't find it, then just search the company regularly and find website for specific location:
// 1. Visit main website page
// 2. Extract URLs for: Menu, Reservations, Wait List, Online Ordering, Reviews, Loyalty Program, Specials/Promotions, Events/Calendar
// 3. Scrape menu word-for-word with descriptions and prices (download PDFs/images if needed)
// 4. Crawl entire website for: Hours, Social Media, Contact Info, About, Policies, etc.
// 5. Scrape all URLs from step 2 word-for-word
// 6. Find 6 Google Reviews + 6 Yelp Reviews (4+ stars, extract word-for-word)
// 7. Create 10 personalized multiple choice questions with answers for customer engagement

// **STEP 10: UPDATE GOOGLE SHEET WITH DEEP RESEARCH RESULT**
// Find row in "Blueprint Waitlist" spreadsheet where Website column matches "${company_url}" and update:
// - "Company Research" = "[Deep Research Results]" (from previous step - just copy and paste entire Deep Research result)

// **STEP 11: CREATE NOTION PAGE**
// Create page in Blueprint Hub:
// Title: "${company_name} - Design Ideas"
// Content: AI-generated Blueprint experience ideas based on research including content placement suggestions for Text, 3D models, Media, Webpages, and uploaded content (MP3/4, GLB, PNG, PDF, PPT).
// Icon: AI-selected based on company type
// Cover: AI-selected based on company branding

// Execute all steps and confirm completion with summary.`,
//         },
//       ],
//       mcp_servers: [
//         {
//           type: "url",
//           url: "https://mcp.zapier.com/api/mcp/s/4d602731-9c5e-4c56-a494-7d1cdef77199/mcp",
//           name: "zapier",
//           authorization_token:
//             "NGQ2MDI3MzEtOWM1ZS00YzU2LWE0OTQtN2QxY2RlZjc3MTk5Ojc0ZWJlNTdlLWZlNzUtNDhjNC1hOGVkLWNjN2I2YzVjNGJmMA==",
//         },
//       ],
//       betas: ["mcp-client-2025-04-04"],
//     });

//     // Return success response
//     res.json({
//       success: true,
//       response: mcpResponse,
//       message: "Mapping confirmation workflow completed successfully",
//       timestamp: new Date().toISOString(),
//     });
//   } catch (error) {
//     console.error("Error processing mapping confirmation:", error);
//     res.status(500).json({
//       error: "Failed to process mapping confirmation",
//       message: error.message,
//     });
//   }
// }
