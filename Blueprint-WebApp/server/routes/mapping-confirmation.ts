import { Request, Response } from "express";
import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";
import * as admin from "firebase-admin"; // Added for Firebase Admin SDK
//import admin, { db, storageAdmin } from '@/lib/firebaseAdmin'; // Adjust path if you placed it elsewhere
import {
  extractDataFromAIResponse,
  extractUrlsFromDeepResearch,
} from "../utils/data-extraction";
import {
  validateMappingConfirmationData,
  MappingConfirmationData,
  ValidationError,
} from "../utils/validation";
import { calculateMappingDuration } from "../utils/business-logic";
import {
  buildMappingConfirmationPhase1AIPrompt,
  buildMappingConfirmationPhase2AIPrompt,
  Phase1ExtractedData, // This is the type for extractedDataCall1
} from "../utils/ai-prompts";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
    }: MappingConfirmationData = req.body; // Use the interface here

    const validationErrors = validateMappingConfirmationData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        errors: validationErrors, // Return structured errors
      });
    }

    // At this point, estimated_square_footage has been validated to be a non-negative number (or string coercible to one)
    // by validateMappingConfirmationData.
    const duration = calculateMappingDuration(estimated_square_footage);
    // The calculateMappingDuration function is robust, but if for some reason it still results in NaN
    // (e.g. if validation logic changes or there's a bug), we should handle it.
    // However, validateMappingConfirmationData should ensure estimated_square_footage is valid.
    // For the prompt, we'll rely on prior validation.
    const calculatedMappingDuration = duration;

    // Consider what to do if `duration` is NaN.
    // The `validateMappingConfirmationData` should prevent this.
    // If it could still happen, add a check:
    if (isNaN(duration)) {
      console.error(
        "Error: calculateMappingDuration returned NaN despite prior validation. SqFt:",
        estimated_square_footage,
      );
      return res.status(500).json({
        error:
          "Internal server error: Could not calculate mapping duration due to invalid square footage after validation.",
      });
    }

    // Prepare data for Phase 1 prompt builder
    // req.body already conforms to MappingConfirmationData which is compatible with MappingConfirmationDataForPrompt
    const phase1PromptData = {
      company_name: company_name!, // Add ! to assert that company_name is defined
      contact_name: contact_name!,
      contact_phone_number: contact_phone_number!,
      address: address!,
      company_url: company_url, // Optional, so no ! needed
      chosen_date_of_mapping: chosen_date_of_mapping!,
      chosen_time_of_mapping: chosen_time_of_mapping!,
      estimated_square_footage: estimated_square_footage!,
    };
    const promptCall1 = buildMappingConfirmationPhase1AIPrompt(
      phase1PromptData,
      calculatedMappingDuration,
    );

    console.log("Sending Prompt for Call 1 to OpenAI...");
    const mcpResponseCall1 = await openai.responses.create({
      model: "o4-mini",
      reasoning: {
        effort: "medium",
      },
      input: promptCall1,
      tools: [
        {
          type: "mcp",
          server_label: "zapier",
          server_url:
            "https://mcp.zapier.com/api/mcp/s/4d32a0ae-826f-450a-9fe5-30c1e2fd41e7/mcp", //OG: https://mcp.zapier.com/api/mcp/s/bd9c31ca-1f38-455b-9cb2-9f22c45e7814/mcp
          require_approval: "never",
          allowed_tools: [
            "gmail_create_draft",
            "gmail_send_email",
            "perplexity_chat_completion",
            "google_sheets_find_worksheet",
            "google_sheets_update_spreadsheet_row",
            "google_sheets_lookup_spreadsheet_row",
            "google_calendar_create_detailed_event",
            "google_calendar_add_attendee_s_to_event",
            "twilio_send_sms",
            "slack_send_channel_message",
            "slack_send_private_channel_message",
          ],
          headers: {
            Authorization:
              "Bearer NGQzMmEwYWUtODI2Zi00NTBhLTlmZTUtMzBjMWUyZmQ0MWU3OjdmNjQ1YTVjLTBmY2UtNDg4ZS05NjIwLTMyOTY0YjI2ZWI0Mg==", //OG: YmQ5YzMxY2EtMWYzOC00NTViLTljYjItOWYyMmM0NWU3ODE0OjJkN2ZmMzRjLTQ1MTgtNDNkMC05ODg0LTc2MzA5NTYyMjFjYw==
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
    const response1: any = mcpResponseCall1;
    if (response1.output_text && typeof response1.output_text === "string") {
      responseTextCall1 = response1.output_text;
    } else if (response1.text && typeof response1.text === "string") {
      responseTextCall1 = response1.text;
    } else if (response1.choices?.[0]?.message?.content) {
      responseTextCall1 = response1.choices[0].message.content;
    } else if (response1.output && typeof response1.output === "string") {
      responseTextCall1 = response1.output;
    } else if (response1.result && typeof response1.result === "string") {
      responseTextCall1 = response1.result;
    } else if (response1.content && typeof response1.content === "string") {
      responseTextCall1 = response1.content;
    }

    console.log("=== DEBUGGING CALL 1 RESPONSE ===");
    console.log("Response text found:", !!responseTextCall1);
    console.log(
      "Using field:",
      response1.output_text ? "output_text" : "other",
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
    const companyUrlForCall2 = extractedDataCall1.COMPANY_URL_USED; // This comes from AI in phase 1

    // Prepare original webhook data for Phase 2 prompt builder
    // req.body is already of type MappingConfirmationData, which is compatible with MappingConfirmationDataForPrompt
    const originalWebhookDataForPhase2 = {
      company_name: company_name!,
      contact_name: contact_name!,
      contact_phone_number: contact_phone_number!,
      address: address!,
      company_url: company_url,
      chosen_date_of_mapping: chosen_date_of_mapping!,
      chosen_time_of_mapping: chosen_time_of_mapping!,
      estimated_square_footage: estimated_square_footage!,
    };

    const promptCall2 = buildMappingConfirmationPhase2AIPrompt(
      originalWebhookDataForPhase2,
      extractedDataCall1 as Phase1ExtractedData, // Type assertion since we've validated the required fields above
    );

    console.log("Sending Prompt for Call 2 to OpenAI...");
    const mcpResponseCall2 = await openai.responses.create({
      model: "o4-mini",
      reasoning: {
        effort: "medium",
      },
      input: promptCall2,
      tools: [
        {
          type: "mcp",
          server_label: "zapier",
          server_url:
            "https://mcp.zapier.com/api/mcp/s/bd9c31ca-1f38-455b-9cb2-9f22c45e7814/mcp",
          require_approval: "never",
          allowed_tools: [
            "perplexity_chat_completion",
            "google_sheets_find_worksheet",
            "google_sheets_update_spreadsheet_row",
            "google_sheets_lookup_spreadsheet_row",
            "notion_find_page_by_title",
            "notion_get_page_and_children",
            "notion_create_page",
            "notion_add_content_to_page",
          ],
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
    const response2: any = mcpResponseCall2;

    if (response2.output_text && typeof response2.output_text === "string") {
      responseTextCall2 = response2.output_text;
    } else if (response2.text && typeof response2.text === "string") {
      responseTextCall2 = response2.text;
    } else if (response2.choices?.[0]?.message?.content) {
      responseTextCall2 = response2.choices[0].message.content;
    } else if (response2.output && typeof response2.output === "string") {
      responseTextCall2 = response2.output;
    } else if (response2.result && typeof response2.result === "string") {
      responseTextCall2 = response2.result;
    } else if (response2.content && typeof response2.content === "string") {
      responseTextCall2 = response2.content;
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
