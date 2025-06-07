import { Request, Response } from "express";
import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";
import * as admin from "firebase-admin";
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
  Phase1ExtractedData,
} from "../utils/ai-prompts";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// In-memory queue for background jobs (production should use Redis/Bull)
interface QueueJob {
  id: string;
  type: "phase1-background" | "phase2";
  data: any;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: Date;
  error?: string;
}

class SimpleJobQueue {
  private jobs: Map<string, QueueJob> = new Map();
  private processing: boolean = false;

  async add(type: QueueJob["type"], data: any): Promise<string> {
    const id = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const job: QueueJob = {
      id,
      type,
      data,
      status: "pending",
      createdAt: new Date(),
    };

    this.jobs.set(id, job);
    this.processQueue(); // Start processing if not already running
    return id;
  }

  async getJob(id: string): Promise<QueueJob | undefined> {
    return this.jobs.get(id);
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      // Process jobs sequentially to avoid concurrency issues
      const pendingJobs = Array.from(this.jobs.entries()).filter(([_, job]) => job.status === "pending");
      
      for (const [id, job] of pendingJobs) {
        job.status = "processing";
        console.log(`Processing job ${id} of type ${job.type}`);

        try {
          if (job.type === "phase1-background") {
            await this.processPhase1Background(job);
          } else if (job.type === "phase2") {
            await this.processPhase2(job);
          }
          job.status = "completed";
          console.log(`Job ${id} completed successfully`);
        } catch (error: any) {
          job.status = "failed";
          job.error = error.message;
          console.error(`Job ${id} failed:`, error);
        }
      }
    } finally {
      this.processing = false;

      // Clean up old completed/failed jobs (keep last 100)
      const allJobs = Array.from(this.jobs.values()).sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );

      if (allJobs.length > 100) {
        const toDelete = allJobs.slice(100);
        toDelete.forEach((job) => this.jobs.delete(job.id));
      }
    }
  }

  private async processPhase1Background(job: QueueJob) {
    const { originalData, phase1EssentialResults } = job.data;

    // Build background tasks prompt (non-essential tasks from Phase 1)
    const backgroundPrompt = this.buildPhase1BackgroundPrompt(
      originalData,
      phase1EssentialResults,
    );

    await this.callOpenAIWithRetry(backgroundPrompt, {
      type: "mcp",
      server_label: "zapier",
      server_url:
        "https://mcp.zapier.com/api/mcp/s/4d32a0ae-826f-450a-9fe5-30c1e2fd41e7/mcp",
      require_approval: "never",
      allowed_tools: [
        "gmail_create_draft",
        "google_calendar_create_detailed_event",
        "perplexity_chat_completion",
      ],
      headers: {
        Authorization:
          "Bearer NGQzMmEwYWUtODI2Zi00NTBhLTlmZTUtMzBjMWUyZmQ0MWU3OjdmNjQ1YTVjLTBmY2UtNDg4ZS05NjIwLTMyOTY0YjI2ZWI0Mg==",
      },
    });
  }

  private async processPhase2(job: QueueJob) {
    const { originalData, phase1Results } = job.data;

    // Build Phase 2 prompt (simplified to avoid token limits)
    const phase2Prompt = this.buildSimplifiedPhase2Prompt(
      originalData,
      phase1Results,
    );

    const response = await this.callOpenAIWithRetry(phase2Prompt, {
      type: "mcp",
      server_label: "zapier",
      server_url:
        "https://mcp.zapier.com/api/mcp/s/bd9c31ca-1f38-455b-9cb2-9f22c45e7814/mcp",
      require_approval: "never",
      allowed_tools: [
        "perplexity_chat_completion",
        "google_sheets_update_spreadsheet_row",
        "notion_create_page",
      ],
      headers: {
        Authorization:
          "Bearer YmQ5YzMxY2EtMWYzOC00NTViLTljYjItOWYyMmM0NWU3ODE0OjJkN2ZmMzRjLTQ1MTgtNDNkMC05ODg0LTc2MzA5NTYyMjFjYw==",
      },
    });

    // Handle Firebase operations if blueprint_id exists
    if (originalData.blueprint_id) {
      await this.handleFirebaseOperations(originalData.blueprint_id, response);
    }
  }

  private buildPhase1BackgroundPrompt(
    originalData: any,
    essentialResults: any,
  ): string {
    const {
      company_name,
      contact_name,
      contact_phone_number,
      address,
      chosen_date_of_mapping,
      chosen_time_of_mapping,
      estimated_square_footage,
    } = originalData;
    const { sheetContactEmail, sheetContactName, calculatedMappingDuration } =
      essentialResults;

    return `Blueprint Phase 1 Background Tasks for ${company_name}.

  **TASK 1: DRAFT CONFIRMATION EMAIL**
  To: ${sheetContactEmail}
  Subject: "Confirmed for Blueprint Mapping: ${company_name}!"
  Body: "Hi ${sheetContactName},

  We've confirmed a Blueprint Mapping for ${company_name} at ${address.replace(", USA", "")} on ${this.formatDate(chosen_date_of_mapping)}, at ${this.formatTime(chosen_time_of_mapping)}.

  You should receive a Google Calendar Invite for this shortly. Please accept it to confirm.

  Based on the provided information (${estimated_square_footage} sq ft), we estimate the mapping will take approximately ${calculatedMappingDuration} minutes.

  Pilot Details: https://blueprint-vision-fork-nijelhunt.replit.app/pilot-program
  Questions? Reply to this email or schedule a chat: https://calendly.com/blueprintar/30min

  Thanks,
  Nijel Hunt
  Co-Founder at Blueprint"

  **TASK 2: CREATE GOOGLE CALENDAR EVENT**
  Event Title: "Blueprint Mapping: ${company_name}"
  Description: "Company: ${company_name}\\nContact (Webhook): ${contact_name} (${contact_phone_number})\\nPrimary Contact (Sheet): ${sheetContactName} (${sheetContactEmail})\\nAddress: ${address}\\nEst. Sq. Ft: ${estimated_square_footage}"
  Location: ${address}
  Start: ${chosen_date_of_mapping}T${chosen_time_of_mapping}:00-04:00
  End: ${chosen_date_of_mapping}T${this.addHour(chosen_time_of_mapping)}:00-04:00
  Attendees: ${sheetContactEmail}, support@tryblueprint.io

  **TASK 3: DRAFT DAY-OF REMINDER EMAIL**
  To: ${sheetContactEmail}
  Subject: "REMINDER: Blueprint Mapping for ${company_name} is Today!"
  Body: "Hi ${sheetContactName.split(" ")[0]},

  Just a friendly reminder that your Blueprint Mapping for ${company_name} is scheduled for today, ${this.formatDate(chosen_date_of_mapping)}, at ${this.formatTime(chosen_time_of_mapping)} at ${address.replace(", USA", "")}.

  The webhook contact, ${contact_name}, will also receive an SMS reminder approximately 1 hour before.

  If you have any questions, please contact support@tryblueprint.io.

  See you soon,
  Nijel Hunt
  Co-Founder at Blueprint"
  Schedule to send: ${chosen_date_of_mapping}T09:00:00-04:00

  Execute tasks. Confirm completion.`;
  }

  private buildSimplifiedPhase2Prompt(
    originalData: any,
    phase1Results: any,
  ): string {
    const { company_name, address } = originalData;
    const { companyUrlForCall2, sheetRowId } = phase1Results;

    return `Blueprint Phase 2: Research & Content for ${company_name}.

**TASK 1: BASIC COMPANY RESEARCH**
Research company at: ${companyUrlForCall2}
Find: Menu URL, Hours, Contact Info, 3 Recent Reviews
Create brief summary (max 200 words).

**TASK 2: UPDATE GOOGLE SHEET**
Spreadsheet: "Blueprint Waitlist", Sheet: "Inbound (Website)"
Row: ${sheetRowId}
Update "Company Research" column with research summary.

**TASK 3: CREATE NOTION PAGE**
Title: "${company_name} - Blueprint Research"
Icon: 🏢
Basic content with research summary and 2 AR experience ideas.

Keep responses concise. Execute sequentially.`;
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  private formatTime(timeStr: string): string {
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  }

  private addHour(timeStr: string): string {
    const [hours, minutes] = timeStr.split(":");
    const newHour = (parseInt(hours) + 1).toString().padStart(2, "0");
    return `${newHour}:${minutes}`;
  }

  private async callOpenAIWithRetry(
    prompt: string,
    tool: any,
    maxRetries: number = 3,
  ): Promise<string> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await Promise.race([
          openai.responses.create({
            model: "o4-mini",
            reasoning: { effort: "medium" }, // Reduced from "high"
            input: prompt,
            tools: [tool],
          }),
          new Promise(
            (_, reject) =>
              setTimeout(() => reject(new Error("Request timeout")), 120000), // 2 minute timeout
          ),
        ]);

        return this.extractResponseText(response);
      } catch (error: any) {
        console.error(`Attempt ${attempt} failed:`, error.message);

        if (attempt === maxRetries) throw error;

        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error("All retry attempts failed");
  }

  private extractResponseText(response: any): string {
    if (response.output_text && typeof response.output_text === "string") {
      return response.output_text;
    } else if (response.text && typeof response.text === "string") {
      return response.text;
    } else if (response.choices?.[0]?.message?.content) {
      return response.choices[0].message.content;
    } else if (response.output && typeof response.output === "string") {
      return response.output;
    } else if (response.result && typeof response.result === "string") {
      return response.result;
    } else if (response.content && typeof response.content === "string") {
      return response.content;
    }
    throw new Error("Could not extract text from response");
  }

  private async handleFirebaseOperations(
    blueprintId: string,
    responseText: string,
  ) {
    try {
      if (!admin.apps.length) {
        throw new Error("Firebase Admin SDK not initialized");
      }

      const db = admin.firestore();
      const bucket = admin.storage().bucket();

      // Upload to storage
      const storageFilePath = `blueprints/${blueprintId}/deep_research_report.md`;
      const file = bucket.file(storageFilePath);
      await file.save(responseText, {
        metadata: { contentType: "text/markdown; charset=utf-8" },
      });

      // Update Firestore
      const blueprintDocRef = db.collection("blueprints").doc(blueprintId);
      const updateData = {
        context: responseText,
        researchLastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...extractUrlsFromDeepResearch(responseText),
      };

      await blueprintDocRef.set(updateData, { merge: true });
      console.log(`Firebase operations completed for blueprint ${blueprintId}`);
    } catch (error) {
      console.error("Firebase operations failed:", error);
    }
  }
}

// Global queue instance
const jobQueue = new SimpleJobQueue();

// Build essential Phase 1 prompt (only critical tasks) - WITH TRAVEL TIME
function buildEssentialPhase1Prompt(
  data: any,
  calculatedMappingDuration: number,
): string {
  const {
    company_name,
    contact_name,
    contact_phone_number,
    address,
    company_url,
    chosen_date_of_mapping,
    chosen_time_of_mapping,
    estimated_square_footage,
  } = data;

  return `Blueprint Phase 1 Essential Tasks for ${company_name}.

**TASK 1: LOCATE GOOGLE SHEET CONTACT**
Find row in "Blueprint Waitlist" -> "Inbound (Website)" where Website = "${company_url}"
Extract: Name as [SheetContactName], Email as [SheetContactEmail], Row ID as [SheetRowID]
If not found: Use "${contact_name}" and "support@tryblueprint.io", set [SheetRowID] = "NOT_FOUND"

**TASK 2: UPDATE GOOGLE SHEET**
Row: [SheetRowID] (skip if "NOT_FOUND")
Update: "Have they picked a date+time for mapping?" = "Yes", "Have we Onboarded?" = "No",
"Chosen Date of Mapping" = "${chosen_date_of_mapping}", "Chosen Time of Mapping" = "${chosen_time_of_mapping}",
"Contact Name" = "${contact_name}", "Contact Phone Number" = "${contact_phone_number}",
"Address" = "${address}", "Est. Sq Ft" = "${estimated_square_footage}"

**TASK 3: GET TRAVEL TIME**
Origin: "1005 Crete St, Durham, NC 27707"
Destination: "${address}"
Use Perplexity to calculate travel times. Return ONLY minutes for car/Uber travel time as [CarTravelMinutes] AND public transport travel time as [PublicTransportMinutes]. If a mode is unavailable, return 'N/A' for it.

**TASK 4: SEND IMMEDIATE SMS**
To: ${contact_phone_number}
Message: "Hi ${contact_name}! Your Blueprint Mapping for ${company_name} is confirmed for ${chosen_date_of_mapping} at ${chosen_time_of_mapping} (${address.replace(", USA", "")}). Email to [SheetContactEmail] & Calendar invite sent. Reminder SMS 1hr prior. - Blueprint"

**TASK 5: SEND SLACK NOTIFICATION**
Channel: gumloop-experiment
Message: "✅ NEW APPOINTMENT (Phase 1 Complete): ${company_name}
Contact (Webhook): ${contact_name} (${contact_phone_number})
Contact (Sheet): [SheetContactName] ([SheetContactEmail])
Location: ${address}
Date: ${chosen_date_of_mapping} @ ${chosen_time_of_mapping}
Est. Mapping Duration: ${calculatedMappingDuration} mins
Travel (Car): [CarTravelMinutes] mins / (Public): [PublicTransportMinutes] mins
Est. Sq. Ft: ${estimated_square_footage}
Sheet Row ID: [SheetRowID]

Next: Phase 2 (Deep Research) for ${company_url}."

Execute tasks. At end provide:
SHEET_ROW_ID:[SheetRowID]
SHEET_CONTACT_NAME:[SheetContactName]
SHEET_CONTACT_EMAIL:[SheetContactEmail]
MAPPING_DURATION_MINUTES:${calculatedMappingDuration}
CAR_TRAVEL_MINUTES:[CarTravelMinutes]
PUBLIC_TRANSPORT_MINUTES:[PublicTransportMinutes]
COMPANY_URL_USED:${company_url}`;
}

// Helper function to call OpenAI with retry logic
async function callOpenAIWithRetry(
  prompt: string,
  tools: any[],
  maxRetries: number = 3,
): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await Promise.race([
        openai.responses.create({
          model: "o4-mini",
          reasoning: { effort: "medium" }, // Reduced from "high" to prevent token exhaustion
          input: prompt,
          tools: tools,
        }),
        new Promise(
          (_, reject) =>
            setTimeout(() => reject(new Error("Request timeout")), 90000), // 90 second timeout
        ),
      ]);
    } catch (error: any) {
      console.error(`OpenAI call attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) throw error;

      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("All retry attempts failed");
}

// Extract response text with multiple fallbacks
function extractResponseText(response: any): string {
  if (response.output_text && typeof response.output_text === "string") {
    return response.output_text;
  } else if (response.text && typeof response.text === "string") {
    return response.text;
  } else if (response.choices?.[0]?.message?.content) {
    return response.choices[0].message.content;
  } else if (response.output && typeof response.output === "string") {
    return response.output;
  } else if (response.result && typeof response.result === "string") {
    return response.result;
  } else if (response.content && typeof response.content === "string") {
    return response.content;
  }
  throw new Error("Could not extract text from response");
}

// Main handler - Phase 1 Essential only
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
    }: MappingConfirmationData = req.body;

    // Validation
    const validationErrors = validateMappingConfirmationData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        errors: validationErrors,
      });
    }

    // Calculate duration
    const calculatedMappingDuration = calculateMappingDuration(
      estimated_square_footage,
    );
    if (isNaN(calculatedMappingDuration)) {
      return res.status(500).json({
        error: "Could not calculate mapping duration",
      });
    }

    // Build essential Phase 1 prompt (only critical tasks)
    const essentialPrompt = buildEssentialPhase1Prompt(
      req.body,
      calculatedMappingDuration,
    );

    console.log("Executing Phase 1 Essential Tasks...");

    // Execute Phase 1 Essential with timeout and retry
    const mcpResponseCall1 = await callOpenAIWithRetry(essentialPrompt, [
      {
        type: "mcp",
        server_label: "zapier",
        server_url:
          "https://mcp.zapier.com/api/mcp/s/4d32a0ae-826f-450a-9fe5-30c1e2fd41e7/mcp",
        require_approval: "never",
        allowed_tools: [
          "google_sheets_lookup_spreadsheet_row",
          "google_sheets_update_spreadsheet_row",
          "twilio_send_sms",
          "slack_send_channel_message",
          "perplexity_chat_completion", // Added for travel time calculation
        ],
        headers: {
          Authorization:
            "Bearer NGQzMmEwYWUtODI2Zi00NTBhLTlmZTUtMzBjMWUyZmQ0MWU3OjdmNjQ1YTVjLTBmY2UtNDg4ZS05NjIwLTMyOTY0YjI2ZWI0Mg==",
        },
      },
    ]);

    // Extract response
    const responseTextCall1 = extractResponseText(mcpResponseCall1);
    const extractedDataCall1 = extractDataFromAIResponse(responseTextCall1);

    // Validate essential data
    if (
      !extractedDataCall1.SHEET_ROW_ID ||
      !extractedDataCall1.COMPANY_URL_USED
    ) {
      return res.status(500).json({
        error: "Essential data missing from Phase 1 response",
        details: "SHEET_ROW_ID or COMPANY_URL_USED not found",
      });
    }

    // Queue background jobs (non-essential Phase 1 tasks)
    const backgroundJobId = await jobQueue.add("phase1-background", {
      originalData: req.body,
      phase1EssentialResults: {
        sheetContactEmail: extractedDataCall1.SHEET_CONTACT_EMAIL,
        sheetContactName: extractedDataCall1.SHEET_CONTACT_NAME,
        calculatedMappingDuration,
      },
    });

    // Queue Phase 2 (deep research)
    const phase2JobId = await jobQueue.add("phase2", {
      originalData: req.body,
      phase1Results: {
        companyUrlForCall2: extractedDataCall1.COMPANY_URL_USED,
        sheetRowId: extractedDataCall1.SHEET_ROW_ID,
      },
    });

    console.log(`Background job queued: ${backgroundJobId}`);
    console.log(`Phase 2 job queued: ${phase2JobId}`);

    // Return immediate success response
    res.json({
      success: true,
      message:
        "Phase 1 essential tasks completed. Background processing initiated.",
      phase1_extracted_data: extractedDataCall1,
      background_job_id: backgroundJobId,
      phase2_job_id: phase2JobId,
      status_endpoint: `/api/mapping-confirmation/status`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error processing mapping confirmation:", error);
    res.status(500).json({
      error: "Failed to process mapping confirmation",
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

// Job status endpoint
export async function getMappingConfirmationStatus(
  req: Request,
  res: Response,
) {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({ error: "Job ID required" });
    }

    const job = await jobQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    res.json({
      job_id: job.id,
      type: job.type,
      status: job.status,
      created_at: job.createdAt,
      error: job.error || null,
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to get job status",
      details: error.message,
    });
  }
}

// Export for job status route
export { getMappingConfirmationStatus as statusHandler };

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
//       model: "o4-mini",
//       reasoning: {
//         effort: "high",
//       },
//       input: promptCall1,
//       tools: [
//         {
//           type: "mcp",
//           server_label: "zapier",
//           server_url:
//             "https://mcp.zapier.com/api/mcp/s/4d32a0ae-826f-450a-9fe5-30c1e2fd41e7/mcp", //OG: https://mcp.zapier.com/api/mcp/s/bd9c31ca-1f38-455b-9cb2-9f22c45e7814/mcp
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
//               "Bearer NGQzMmEwYWUtODI2Zi00NTBhLTlmZTUtMzBjMWUyZmQ0MWU3OjdmNjQ1YTVjLTBmY2UtNDg4ZS05NjIwLTMyOTY0YjI2ZWI0Mg==", //OG: YmQ5YzMxY2EtMWYzOC00NTViLTljYjItOWYyMmM0NWU3ODE0OjJkN2ZmMzRjLTQ1MTgtNDNkMC05ODg0LTc2MzA5NTYyMjFjYw==
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
//     const mcpResponseCall2 = await openai.responses.create({
//       model: "o4-mini",
//       reasoning: {
//         effort: "high",
//       },
//       input: promptCall2,
//       tools: [
//         {
//           type: "mcp",
//           server_label: "zapier",
//           server_url:
//             "https://mcp.zapier.com/api/mcp/s/bd9c31ca-1f38-455b-9cb2-9f22c45e7814/mcp",
//           require_approval: "never",
//           allowed_tools: [
//             "perplexity_chat_completion",
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
//       // Ensure blueprint_id is available
//       try {
//         // Ensure Firebase Admin is initialized
//         if (!admin.apps.length) {
//           // This is a critical error if not initialized. For this example, we log and proceed,
//           // but in a production app, this should be handled robustly, or initialization guaranteed.
//           console.error(
//             "CRITICAL: Firebase Admin SDK is not initialized. Firebase operations will fail.",
//           );
//           throw new Error("Firebase Admin SDK not initialized.");
//         }
//         const db = admin.firestore();
//         const bucket = admin.storage().bucket(); // Default bucket

//         // 1. Upload Deep Research output (responseTextCall2) to Firebase Storage
//         // The "IF THE output from deep research contains markdown files" implies that
//         // responseTextCall2 itself is the markdown content to be uploaded.
//         if (responseTextCall2) {
//           const storageFilePath = `blueprints/${blueprint_id}/deep_research_report.md`;
//           const file = bucket.file(storageFilePath);

//           await file.save(responseTextCall2, {
//             metadata: {
//               contentType: "text/markdown; charset=utf-8", // Specify UTF-8
//             },
//           });
//           firebaseStoragePath = `gs://${bucket.name}/${storageFilePath}`;
//           console.log(
//             `Deep research report uploaded to Firebase Storage: ${firebaseStoragePath}`,
//           );
//         }

//         // 2. Update Firestore document
//         const blueprintDocRef = db.collection("blueprints").doc(blueprint_id);
//         const firestoreUpdateData: { [key: string]: any } = {
//           context: responseTextCall2, // Paste whole output from Deep Research
//           researchLastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
//         };

//         // Extract Key URLs from responseTextCall2 and add them to the update object
//         const extractedUrls = extractUrlsFromDeepResearch(responseTextCall2);
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

//         await blueprintDocRef.set(firestoreUpdateData, { merge: true }); // Use set with merge to create or update
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
//         // Optional: if Firebase ops are critical, you might re-throw or return 500 here
//         // For now, we'll report the error in the response.
//       }
//     } else {
//       firebaseOpsError =
//         "Blueprint ID was missing, Firebase operations skipped.";
//       console.warn(firebaseOpsError);
//     }
//     // --- END: New Firebase Operations ---

//     res.json({
//       success: true,
//       phase1_summary: responseTextCall1,
//       phase1_extracted_data: extractedDataCall1,
//       phase2_summary: responseTextCall2,
//       firebase_operations_status: {
//         // New section for Firebase results
//         storage_upload_path: firebaseStoragePath,
//         firestore_update: firestoreUpdateDetails,
//         error: firebaseOpsError,
//       },
//       message:
//         "Mapping confirmation workflow (Phases 1 & 2) processed. Review Firebase operations status.",
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
