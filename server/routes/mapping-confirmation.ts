// import { Request, Response } from "express";
// import { Anthropic } from "@anthropic-ai/sdk";
// import OpenAI from "openai";
// import * as admin from "firebase-admin"; // Added for Firebase Admin SDK
// //import admin, { db, storageAdmin } from '@/lib/firebaseAdmin'; // Adjust path if you placed it elsewhere
// import {
//   extractDataFromAIResponse,
//   extractUrlsFromDeepResearch,
// } from "../utils/data-extraction";
// import {
//   validateMappingConfirmationData,
//   MappingConfirmationData,
//   ValidationError,
// } from "../utils/validation";
// import { calculateMappingDuration } from "../utils/business-logic";
// import {
//   buildMappingConfirmationPhase1AIPrompt,
//   buildMappingConfirmationPhase2AIPrompt,
//   Phase1ExtractedData, // This is the type for extractedDataCall1
// } from "../utils/ai-prompts";

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

// const anthropic = new Anthropic({
//   apiKey: process.env.ANTHROPIC_API_KEY,
// });

// export default async function processMappingConfirmationHandler(
//   req: Request,
//   res: Response,
// ) {
//   try {
//     const {
//       chosen_time_of_mapping,
//       chosen_date_of_mapping,
//       address,
//       company_url,
//       company_name,
//       contact_name,
//       contact_phone_number,
//       estimated_square_footage,
//       blueprint_id,
//     }: MappingConfirmationData = req.body; // Use the interface here

//     const validationErrors = validateMappingConfirmationData(req.body);
//     if (validationErrors.length > 0) {
//       return res.status(400).json({
//         error: "Validation failed",
//         errors: validationErrors, // Return structured errors
//       });
//     }

//     // At this point, estimated_square_footage has been validated to be a non-negative number (or string coercible to one)
//     // by validateMappingConfirmationData.
//     const duration = calculateMappingDuration(estimated_square_footage);
//     // The calculateMappingDuration function is robust, but if for some reason it still results in NaN
//     // (e.g. if validation logic changes or there's a bug), we should handle it.
//     // However, validateMappingConfirmationData should ensure estimated_square_footage is valid.
//     // For the prompt, we'll rely on prior validation.
//     const calculatedMappingDuration = duration;

//     // Consider what to do if `duration` is NaN.
//     // The `validateMappingConfirmationData` should prevent this.
//     // If it could still happen, add a check:
//     if (isNaN(duration)) {
//       console.error(
//         "Error: calculateMappingDuration returned NaN despite prior validation. SqFt:",
//         estimated_square_footage,
//       );
//       return res.status(500).json({
//         error:
//           "Internal server error: Could not calculate mapping duration due to invalid square footage after validation.",
//       });
//     }

//     // Prepare data for Phase 1 prompt builder
//     // req.body already conforms to MappingConfirmationData which is compatible with MappingConfirmationDataForPrompt
//     const phase1PromptData = {
//       company_name: company_name!, // Add ! to assert that company_name is defined
//       contact_name: contact_name!,
//       contact_phone_number: contact_phone_number!,
//       address: address!,
//       company_url: company_url, // Optional, so no ! needed
//       chosen_date_of_mapping: chosen_date_of_mapping!,
//       chosen_time_of_mapping: chosen_time_of_mapping!,
//       estimated_square_footage: estimated_square_footage!,
//     };
//     const promptCall1 = buildMappingConfirmationPhase1AIPrompt(
//       phase1PromptData,
//       calculatedMappingDuration,
//     );

//     console.log("Sending Prompt for Call 1 to OpenAI...");
//     const mcpResponseCall1 = await openai.responses.create({
//       model: "o3",
//       reasoning: {
//         effort: "medium",
//       },
//       input: promptCall1,
//       tools: [
//         {
//           type: "mcp",
//           server_label: "zapier",
//           server_url:
//             "https://mcp.zapier.com/api/mcp/s/bd9c31ca-1f38-455b-9cb2-9f22c45e7814/mcp", //NEWER:  https://mcp.zapier.com/api/mcp/s/4d32a0ae-826f-450a-9fe5-30c1e2fd41e7/mcp
//           require_approval: "never",
//           allowed_tools: [
//             "gmail_create_draft",
//             "gmail_send_email",
//             "perplexity_chat_completion",
//             "google_sheets_find_worksheet",
//             "google_sheets_lookup_spreadsheet_row",
//             "google_sheets_update_spreadsheet_row",
//             "twilio_send_sms",
//             "google_calendar_create_detailed_event",
//             "slack_send_channel_message",
//             "google_calendar_add_attendee_s_to_event",
//           ],
//           headers: {
//             Authorization:
//               "Bearer YmQ5YzMxY2EtMWYzOC00NTViLTljYjItOWYyMmM0NWU3ODE0OjJkN2ZmMzRjLTQ1MTgtNDNkMC05ODg0LTc2MzA5NTYyMjFjYw==", //NEWER:  Bearer NGQzMmEwYWUtODI2Zi00NTBhLTlmZTUtMzBjMWUyZmQ0MWU3OjdmNjQ1YTVjLTBmY2UtNDg4ZS05NjIwLTMyOTY0YjI2ZWI0Mg==
//           },
//         },
//       ],
//     });

//     console.log(
//       "Full mcpResponseCall1 object from OpenAI:",
//       JSON.stringify(mcpResponseCall1, null, 2),
//     );

//     // NEW CODE - REPLACE THE OLD RESPONSE HANDLING:
//     let responseTextCall1: string | null | undefined;

//     // Try different possible response locations, with output_text FIRST
//     const response1: any = mcpResponseCall1;
//     if (response1.output_text && typeof response1.output_text === "string") {
//       responseTextCall1 = response1.output_text;
//     } else if (response1.text && typeof response1.text === "string") {
//       responseTextCall1 = response1.text;
//     } else if (response1.choices?.[0]?.message?.content) {
//       responseTextCall1 = response1.choices[0].message.content;
//     } else if (response1.output && typeof response1.output === "string") {
//       responseTextCall1 = response1.output;
//     } else if (response1.result && typeof response1.result === "string") {
//       responseTextCall1 = response1.result;
//     } else if (response1.content && typeof response1.content === "string") {
//       responseTextCall1 = response1.content;
//     }

//     console.log("=== DEBUGGING CALL 1 RESPONSE ===");
//     console.log("Response text found:", !!responseTextCall1);
//     console.log(
//       "Using field:",
//       response1.output_text ? "output_text" : "other",
//     );

//     if (typeof responseTextCall1 !== "string" || !responseTextCall1.trim()) {
//       console.error("=== FULL RESPONSE STRUCTURE DEBUG ===");
//       console.error(JSON.stringify(mcpResponseCall1, null, 2));

//       return res.status(500).json({
//         error: "Failed to get valid text response from Call 1",
//         debug_info: {
//           available_keys: Object.keys(mcpResponseCall1),
//           has_output_text: !!mcpResponseCall1.output_text,
//           has_text: !!mcpResponseCall1.text,
//         },
//       });
//     }

//     console.log("Successfully extracted responseTextCall1:", responseTextCall1);

//     const extractedDataCall1 = extractDataFromAIResponse(responseTextCall1);

//     // Check if essential data was extracted. If not, the AI might not have followed format.
//     if (
//       !extractedDataCall1.SHEET_ROW_ID ||
//       !extractedDataCall1.COMPANY_URL_USED
//     ) {
//       console.error(
//         "Error: Essential data (SHEET_ROW_ID or COMPANY_URL_USED) not found in AI's formatted response. Extracted data:",
//         extractedDataCall1,
//         "Full AI response text:",
//         responseTextCall1,
//       );
//       return res.status(500).json({
//         error:
//           "AI response for Call 1 did not contain the expected structured data. Check prompt and AI output.",
//         details:
//           "SHEET_ROW_ID or COMPANY_URL_USED missing from the AI's explicitly formatted output section.",
//       });
//     }

//     // ✅ ADD THIS NEW LINDY WEBHOOK CALL HERE:
//     // Trigger Lindy workflow for day-of and 1-hour reminder scheduling
//     const lindyReminderOptions = {
//       method: "POST",
//       headers: {
//         Authorization:
//           "Bearer 1b1338d68dff4f009bbfaee1166cb9fc48b5fefa6dddbea797264674e2ee0150",
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         company_name: company_name!,
//         contact_name: contact_name!,
//         contact_phone_number: contact_phone_number!,
//         address: address!,
//         company_url: company_url || "",
//         chosen_date_of_mapping: chosen_date_of_mapping!,
//         chosen_time_of_mapping: chosen_time_of_mapping!,
//         estimated_square_footage: estimated_square_footage!,
//         sheet_contact_name:
//           extractedDataCall1.SHEET_CONTACT_NAME || contact_name!,
//         sheet_contact_email:
//           extractedDataCall1.SHEET_CONTACT_EMAIL || "support@tryblueprint.io",
//         sheet_row_id: extractedDataCall1.SHEET_ROW_ID,
//         // Add any other data the Lindy workflow needs for scheduling reminders
//       }),
//     };

//     // Fire Lindy webhook for reminder scheduling (don't await - let it run in background)
//     fetch(
//       "https://public.lindy.ai/api/v1/webhooks/lindy/2b00a300-d573-4dcd-8b24-f1e5f1c8abf7",
//       lindyReminderOptions,
//     )
//       .then((lindyResponse) => lindyResponse.json())
//       .then((lindyData) =>
//         console.log("Lindy reminder scheduling webhook initiated:", lindyData),
//       )
//       .catch((lindyErr) =>
//         console.error("Lindy reminder webhook error:", lindyErr),
//       );

//     const sheetRowId = extractedDataCall1.SHEET_ROW_ID;
//     const companyUrlForCall2 = extractedDataCall1.COMPANY_URL_USED; // This comes from AI in phase 1

//     // Prepare original webhook data for Phase 2 prompt builder
//     // req.body is already of type MappingConfirmationData, which is compatible with MappingConfirmationDataForPrompt
//     const originalWebhookDataForPhase2 = {
//       company_name: company_name!,
//       contact_name: contact_name!,
//       contact_phone_number: contact_phone_number!,
//       address: address!,
//       company_url: company_url,
//       chosen_date_of_mapping: chosen_date_of_mapping!,
//       chosen_time_of_mapping: chosen_time_of_mapping!,
//       estimated_square_footage: estimated_square_footage!,
//     };

//     const promptCall2 = buildMappingConfirmationPhase2AIPrompt(
//       originalWebhookDataForPhase2,
//       extractedDataCall1 as Phase1ExtractedData, // Type assertion since we've validated the required fields above
//     );

//     console.log("Sending Prompt for Call 2 to OpenAI...");
//     // const mcpResponseCall2 = await openai.responses.create({
//     //   model: "o3",
//     //   reasoning: {
//     //     effort: "medium",
//     //   },
//     //   input: promptCall2,
//     //   tools: [
//     //     {
//     //       type: "mcp",
//     //       server_label: "zapier",
//     //       server_url:
//     //         "https://mcp.zapier.com/api/mcp/s/bd9c31ca-1f38-455b-9cb2-9f22c45e7814/mcp",
//     //       require_approval: "never",
//     //       allowed_tools: [
//     //         "perplexity_chat_completion",
//     //         "google_sheets_find_worksheet",
//     //         "google_sheets_lookup_spreadsheet_row",
//     //         "google_sheets_update_spreadsheet_row",
//     //         "notion_create_page",
//     //         "notion_add_content_to_page",
//     //         "notion_get_page_and_children",
//     //         "notion_find_page_by_title",
//     //       ],
//     //       headers: {
//     //         Authorization:
//     //           "Bearer YmQ5YzMxY2EtMWYzOC00NTViLTljYjItOWYyMmM0NWU3ODE0OjJkN2ZmMzRjLTQ1MTgtNDNkMC05ODg0LTc2MzA5NTYyMjFjYw==",
//     //       },
//     //     },
//     //   ],
//     // });
//     // Phase 2A: Deep Research using OpenAI's Deep Research API
//     // Phase 2A: Deep Research using OpenAI's Deep Research API
//     console.log("Starting Deep Research phase...");
//     try {
//       const deepResearchResponse = await openai.responses.create({
//         model: "o4-mini-deep-research",
//         input: `Research the company: ${companyUrlForCall2} (${company_name} at ${address})

//         RESEARCH TASKS:
//         1. Visit main website and find key information
//         2. Extract Key URLs: Menu, Reservations, Wait List, Online Ordering, Reviews, Loyalty Program, Specials/Promotions, Events/Calendar
//         3. Get full menu details (items, descriptions, prices) 
//         4. Find general info: Hours, Social Media links, Contact Info, About Us, Policies
//         5. Scrape content from each key URL found
//         6. Find up to 6 Google Reviews & 6 Yelp Reviews (4+ stars, recent, with text and ratings)
//         7. Create 5-10 personalized multiple-choice questions about the company based on research

//         Format your research findings in a comprehensive markdown report with clear sections for each task above.`,
//         tools: [
//           { type: "web_search_preview" },
//           { type: "code_interpreter", container: { type: "auto" } },
//         ],
//         background: false,
//         // Add max_tool_calls to control research depth vs speed
//         max_tool_calls: 20, // Adjust based on your needs - lower = faster, higher = more thorough
//       });
//     } catch (error) {
//       console.error("Deep Research API error:", error);
//       return res.status(500).json({
//         error: "Deep Research API failed",
//         details: error.message,
//       });
//     }

//     console.log("Deep Research completed, extracting findings...");

//     // Extract the research findings with better error handling
//     let deepResearchFindings: string;
//     try {
//       if (
//         deepResearchResponse.output_text &&
//         typeof deepResearchResponse.output_text === "string"
//       ) {
//         deepResearchFindings = deepResearchResponse.output_text;
//       } else if (
//         deepResearchResponse.text &&
//         typeof deepResearchResponse.text === "string"
//       ) {
//         deepResearchFindings = deepResearchResponse.text;
//       } else {
//         console.error(
//           "Deep Research Response Structure:",
//           JSON.stringify(deepResearchResponse, null, 2),
//         );
//         throw new Error(
//           "Could not extract deep research findings from response - no valid text field found",
//         );
//       }

//       if (!deepResearchFindings.trim()) {
//         throw new Error("Deep research findings are empty");
//       }

//       console.log(
//         "Deep Research findings extracted successfully, length:",
//         deepResearchFindings.length,
//       );
//     } catch (error) {
//       console.error("Error extracting deep research findings:", error);
//       return res.status(500).json({
//         error: "Failed to extract deep research findings",
//         details: error.message,
//         debug_info: {
//           available_keys: Object.keys(deepResearchResponse),
//           has_output_text: !!deepResearchResponse.output_text,
//           has_text: !!deepResearchResponse.text,
//         },
//       });
//     }

//     console.log("Deep Research findings extracted, proceeding to Phase 2B...");

//     // Phase 2B: Use MCP to update Google Sheets and Notion with the research findings
//     const maxPromptLength = 15000; // Adjust based on model limits
//     let researchSummary = deepResearchFindings;

//     // If research findings are too long, truncate for the MCP call
//     if (deepResearchFindings.length > maxPromptLength) {
//       researchSummary =
//         deepResearchFindings.substring(0, maxPromptLength) +
//         "\n\n[Research findings truncated for prompt length. Full findings saved to Firebase.]";
//       console.log("Research findings truncated for MCP call due to length");
//     }
//     const updatedPromptCall2 = `
//     Blueprint Post-Signup - Phase 2B: Update Systems with Deep Research for ${company_name}.

//     **DEEP RESEARCH FINDINGS:**
//     ${deepResearchFindings}

//     **INPUT DATA:**
//     - Company Name: ${company_name}
//     - Company URL: ${companyUrlForCall2}
//     - Company Address: ${address}
//     - Google Sheet Row ID to update: ${sheetRowId}

//     **TASK 1: UPDATE GOOGLE SHEET WITH DEEP RESEARCH**
//     Spreadsheet: "Blueprint Waitlist"
//     Sheet: "Inbound (Website)"
//     If the provided Google Sheet Row ID is "LOOKUP_REQUIRED" or "NOT_FOUND", first find the row where 'Website' column matches "${companyUrlForCall2}" and use that Row ID.
//     Update the column "Company Research" with the entire research findings above.

//     **TASK 2: CREATE NOTION PAGE**
//     In Notion database/page named "Blueprint Hub":
//     Title: "${company_name} - Blueprint Design Ideas & Research"
//     Icon: (AI-selected emoji based on company type)
//     Cover: (AI-selected stock image URL)
//     Content: Structure the deep research findings into a well-organized Notion page with:

//     ### Deep Research Summary
//     [3-5 sentence summary highlighting key findings]

//     ### Key URLs Found:
//     (CRITICAL for Firestore - use exact format)
//     - Menu: [URL or N/A]
//     - Reservations: [URL or N/A] 
//     - Wait List: [URL or N/A]
//     - Online Ordering: [URL or N/A]
//     - Reviews: [URL or N/A]
//     - Loyalty Program: [URL or N/A]
//     - Specials/Promotions: [URL or N/A]
//     - Events/Calendar: [URL or N/A]

//     ### AI-Generated Blueprint AR Experience Ideas:
//     [Generate 3-5 creative AR experience ideas based on the research, with suggestions for Text, 3D Models, Media, Webpages, and Uploaded Content for each idea]

//     ### Customer Engagement Questions:
//     [List the research-based MCQs with answers]

//     Execute both tasks and confirm completion.`;

//     const mcpResponseCall2 = await openai.responses.create({
//       model: "o3",
//       reasoning: {
//         effort: "medium",
//       },
//       input: updatedPromptCall2,
//       tools: [
//         {
//           type: "mcp",
//           server_label: "zapier",
//           server_url:
//             "https://mcp.zapier.com/api/mcp/s/bd9c31ca-1f38-455b-9cb2-9f22c45e7814/mcp",
//           require_approval: "never",
//           allowed_tools: [
//             // Remove perplexity_chat_completion from here
//             "google_sheets_find_worksheet",
//             "google_sheets_lookup_spreadsheet_row",
//             "google_sheets_update_spreadsheet_row",
//             "notion_create_page",
//             "notion_add_content_to_page",
//             "notion_get_page_and_children",
//             "notion_find_page_by_title",
//           ],
//           headers: {
//             Authorization:
//               "Bearer YmQ5YzMxY2EtMWYzOC00NTViLTljYjItOWYyMmM0NWU3ODE0OjJkN2ZmMzRjLTQ1MTgtNDNkMC05ODg0LTc2MzA5NTYyMjFjYw==",
//           },
//         },
//       ],
//     });

//     console.log(
//       "Full mcpResponseCall2 object from OpenAI:",
//       JSON.stringify(mcpResponseCall2, null, 2),
//     );

//     // Fix Call 2 response handling too:
//     let responseTextCall2: string | null | undefined;
//     const response2: any = mcpResponseCall2;

//     if (response2.output_text && typeof response2.output_text === "string") {
//       responseTextCall2 = response2.output_text;
//     } else if (response2.text && typeof response2.text === "string") {
//       responseTextCall2 = response2.text;
//     } else if (response2.choices?.[0]?.message?.content) {
//       responseTextCall2 = response2.choices[0].message.content;
//     } else if (response2.output && typeof response2.output === "string") {
//       responseTextCall2 = response2.output;
//     } else if (response2.result && typeof response2.result === "string") {
//       responseTextCall2 = response2.result;
//     } else if (response2.content && typeof response2.content === "string") {
//       responseTextCall2 = response2.content;
//     }

//     if (typeof responseTextCall2 !== "string" || !responseTextCall2.trim()) {
//       console.error("=== CALL 2 FULL RESPONSE STRUCTURE DEBUG ===");
//       console.error(JSON.stringify(mcpResponseCall2, null, 2));

//       return res.status(500).json({
//         error: "Failed to get valid text response from Call 2",
//         debug_info: {
//           available_keys: Object.keys(mcpResponseCall2),
//           has_output_text: !!mcpResponseCall2.output_text,
//           has_text: !!mcpResponseCall2.text,
//         },
//       });
//     }
//     console.log("Successfully extracted responseTextCall2:", responseTextCall2);

//     // --- START: New Firebase Operations ---
//     let firebaseStoragePath: string | null = null;
//     let firestoreUpdateDetails: any = { success: false };
//     let firebaseOpsError: string | null = null;

//     if (blueprint_id) {
//       try {
//         if (!admin.apps.length) {
//           console.error(
//             "CRITICAL: Firebase Admin SDK is not initialized. Firebase operations will fail.",
//           );
//           throw new Error("Firebase Admin SDK not initialized.");
//         }
//         const db = admin.firestore();
//         const bucket = admin.storage().bucket();

//         // 1. Upload Deep Research output to Firebase Storage
//         if (deepResearchFindings) {
//           const storageFilePath = `blueprints/${blueprint_id}/deep_research_report.md`;
//           const file = bucket.file(storageFilePath);
//           await file.save(deepResearchFindings, {
//             metadata: { contentType: "text/markdown; charset=utf-8" },
//           });
//           firebaseStoragePath = `gs://${bucket.name}/${storageFilePath}`;
//         }

//         // 2. Update Firestore document
//         const blueprintDocRef = db.collection("blueprints").doc(blueprint_id);
//         const firestoreUpdateData: { [key: string]: any } = {
//           context: deepResearchFindings, // Use deepResearchFindings consistently
//           researchLastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
//         };

//         // Extract URLs from the deep research findings for Firestore
//         const extractedUrls = extractUrlsFromDeepResearch(deepResearchFindings); // Use deepResearchFindings consistently

//         if (Object.keys(extractedUrls).length > 0) {
//           console.log("Extracted URLs for Firestore:", extractedUrls);
//         } else {
//           console.warn(
//             "No key URLs extracted from deep research output for Firestore. Check AI output format.",
//           );
//         }

//         for (const key in extractedUrls) {
//           firestoreUpdateData[key] = extractedUrls[key];
//         }

//         await blueprintDocRef.set(firestoreUpdateData, { merge: true });
//         firestoreUpdateDetails = {
//           success: true,
//           documentPath: blueprintDocRef.path,
//           updatedFields: Object.keys(firestoreUpdateData),
//         };
//         console.log(
//           `Firestore document ${blueprintDocRef.path} updated successfully.`,
//         );
//       } catch (fbError: any) {
//         console.error("Firebase operation failed:", fbError);
//         firebaseOpsError =
//           fbError.message ||
//           "An unknown error occurred during Firebase operations.";
//       }
//     } else {
//       firebaseOpsError =
//         "Blueprint ID was missing, Firebase operations skipped.";
//       console.warn(firebaseOpsError);
//     }
//     // --- END: New Firebase Operations ---

//     // Combine both deep research findings and system update results
//     const combinedResponse = `=== DEEP RESEARCH FINDINGS ===\n${deepResearchFindings}\n\n=== SYSTEM UPDATES ===\n${responseTextCall2}`;

//     res.json({
//       success: true,
//       phase1_summary: responseTextCall1,
//       phase1_extracted_data: extractedDataCall1,
//       phase2a_deep_research: deepResearchFindings, // ← Full research report
//       phase2b_system_updates: responseTextCall2, // ← Google Sheets/Notion updates
//       phase2_combined: `${deepResearchFindings}\n\n=== SYSTEM UPDATES ===\n${responseTextCall2}`,
//       firebase_operations_status: {
//         storage_upload_path: firebaseStoragePath,
//         firestore_update: firestoreUpdateDetails,
//         error: firebaseOpsError,
//       },
//       message: "Mapping confirmation workflow completed with Deep Research API",
//       timestamp: new Date().toISOString(),
//     });
//   } catch (error: any) {
//     console.error("Error processing mapping confirmation:", error);
//     let errorMessage = "Failed to process mapping confirmation";
//     if (error.response && error.response.data) {
//       errorMessage =
//         error.response.data.error ||
//         error.response.data.message ||
//         errorMessage;
//     } else if (error.message) {
//       errorMessage = error.message;
//     }
//     res.status(500).json({
//       error: "Failed to process mapping confirmation",
//       details: errorMessage,
//       fullError: error.stack || error.toString(),
//     });
//   }
// }
