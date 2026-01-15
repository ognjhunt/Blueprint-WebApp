interface WaitlistDataForPrompt {
  name: string;
  email: string;
  company: string;
  city: string;
  state: string;
  message?: string; // Optional
  companyWebsite?: string; // Optional
  companyAddress?: string; // Optional
  offWaitlistUrl: string;
}

/**
 * Builds the AI prompt for processing a new waitlist signup.
 * @param {WaitlistDataForPrompt} data The waitlist signup data.
 * @returns {string} The formatted AI prompt string.
 */
export function buildWaitlistAIPrompt(data: WaitlistDataForPrompt): string {
  const {
    name,
    email,
    company,
    city,
    state,
    message = "", // Default to empty string if not provided
    companyWebsite = "", // Default to empty string
    companyAddress = "", // Default to empty string
    offWaitlistUrl,
  } = data;

  // Ensure name processing for email greeting is safe (e.g., handles single names)
  const firstName = name.split(" ")[0] || name;

  // Use ISO date and locale time as in the original prompt
  const currentDate = new Date().toISOString().split("T")[0];
  const currentTime = new Date().toLocaleTimeString(); // Consider specifying locale/timezone if needed for consistency

  return `Blueprint Waitlist Automation: Process new signup for ${name} from ${company}.

 STEP 1: Create Google Sheet row in "Blueprint Waitlist" spreadsheet - Sheet named: 'Inbound (Website)' with columns: Name="${name}", Company="${company}", Email="${email}", City="${city}", State="${state}", Address="${companyAddress}", Website="${companyWebsite}", Additional Comments="${message}", Date of Waitlist="${currentDate}", Time of Waitlist="${currentTime}", Does Company Meet Criteria="", Have we sent off the waitlist email="No", Have they picked a date+time for mapping="No", Have we Onboarded="No".

 STEP 2: Use Perplexity to evaluate: "${company} located in ${city}, ${state} - Evaluate for Blueprint pilot program criteria: customer-facing business, retail/hospitality type, physical presence with foot traffic, located in or near Durham NC area. Respond with Yes (meets all criteria) or No (does not meet criteria) plus brief reason."

 STEP 3: Draft (DO NOT SEND - JUST CREATE DRAFT) appropriate email:
 - If Perplexity says YES: Subject="Hello - From Blueprint", Body="Hey ${firstName},

You're already off the waitlist for Blueprint!

${company} has met all the criteria needed to jump to first in line to try Blueprint out.

To get started, please take time to choose sign up and choose a date & time for us to send someone to your location for the 3D mapping of your space!:
${offWaitlistUrl}

Any questions? Here's a link to my calendar if you wanted to chat this week!:
https://calendly.com/blueprintar/30min

____
Nijel Hunt
Co-Founder at Blueprint"
 - If Perplexity says NO: Subject="Your Blueprint waitlist spot is confirmed! 🎉", Body="Hey ${firstName},

You're on the waitlist for Blueprint!

You'll be first to know once Blueprint expands into ${city} (then something about joining Pilot Program within city (first 3 months free)).

Want Blueprint to move to your city quicker?
Post on X and tag us @tryblueprintapp to let us know you applied.

If you have any questions about Blueprint in the meantime, just reply to this email.

____
Nijel Hunt
Co-Founder at Blueprint"

 STEP 4: Update the Google Sheet - Sheet named: 'Inbound (Website)' row with: Does Company Meet Criteria=[Yes/No from Perplexity], Have we sent off the waitlist email="Yes", Have they picked a date+time for mapping="No", Have we Onboarded="No".

 Execute all steps and confirm completion.`;
}

// Add this to server/utils/ai-prompts.ts

export interface MappingConfirmationDataForPrompt {
  company_name: string;
  contact_name: string; // This is the contact from the webhook/form
  contact_phone_number: string;
  address: string;
  company_url?: string; // Optional
  chosen_date_of_mapping: string;
  chosen_time_of_mapping: string;
  estimated_square_footage: number | string; // Can be number or string from form
}

// **TASK 5: DRAFT DAY-OF REMINDER EMAIL**
// To: [SheetContactEmail]
// Subject: "REMINDER: Blueprint Mapping for ${company_name} is Today!"
// Body:
// "Hi [SheetContactName (just first name)],

// Just a friendly reminder that your Blueprint Mapping for ${company_name} is scheduled for today, (chosen date of mapping, but in the format of Saturday, May 31st, 2025 instead of ${chosen_date_of_mapping}), at (chosen time of mapping, but in the format 1:00 PM instead of ${chosen_time_of_mapping}) at ${displayAddress}.

// The webhook contact, ${contact_name}, will also receive an SMS reminder approximately 1 hour before.

// If you have any questions, please contact support@tryblueprint.io.

// See you soon,
// Nijel Hunt
// Co-Founder at Blueprint
// This draft should be scheduled to be sent on ${chosen_date_of_mapping} at 9:00 AM EST.

// **TASK 7: SCHEDULE 1-HOUR REMINDER TWILIO SMS TO WEBHOOK CONTACT**
// To: ${contact_phone_number} (Fallback: +19196389913)
// Message: "Reminder: Your Blueprint Mapping for ${company_name} at ${displayAddress} is in about 1 hour (${chosen_time_of_mapping}). See you soon! - Blueprint"
// Schedule: 1 hour before ${chosen_date_of_mapping} ${chosen_time_of_mapping} (use the same timezone considerations as TASK 4 for the base time).

/**
 * Builds the AI prompt for Phase 1 of mapping confirmation (initial setup).
 * @param {MappingConfirmationDataForPrompt} data The mapping confirmation data from the webhook.
 * @param {number} calculatedMappingDuration The pre-calculated mapping duration.
 * @returns {string} The formatted AI prompt string for Phase 1.
 */
export function buildMappingConfirmationPhase1AIPrompt(
  data: MappingConfirmationDataForPrompt,
  calculatedMappingDuration: number, // This comes from calculateMappingDuration
): string {
  const {
    company_name,
    contact_name,
    contact_phone_number,
    address,
    company_url = "Not provided", // Default if undefined or empty
    chosen_date_of_mapping,
    chosen_time_of_mapping,
    estimated_square_footage,
  } = data;

  // Ensure address is cleaned for display if needed, e.g. removing ", USA"
  const displayAddress = address.replace(", USA", "");

  return `
Blueprint Post-Signup - Phase 1: Initial Mapping Setup for ${company_name}.

**WEBHOOK DATA:**
- Company: ${company_name}
- Contact (from Webhook): ${contact_name} (${contact_phone_number})
- Address: ${address}
- Website: ${company_url}
- Mapping Date: ${chosen_date_of_mapping}
- Mapping Time: ${chosen_time_of_mapping}
- Est. Square Footage: ${estimated_square_footage}

**TASK 1: LOCATE & PREPARE GOOGLE SHEET CONTACT**
1.  In the "Blueprint Waitlist" spreadsheet, in Sheet: Inbound (Website), find the row where the 'Website' column matches "${company_url}".
2.  From this specific row, extract:
    - Full Name from 'Name' (Column A) - store as [SheetContactName].
    - Email from 'Email' (Column B) - store as [SheetContactEmail].
3.  If multiple rows match, use the first one found. If no row is found, note this in your final summary, use "${contact_name}" as [SheetContactName] and "support@tryblueprint.io" as [SheetContactEmail] (or another placeholder) for subsequent email steps BUT CLEARLY INDICATE THIS FALLBACK.
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

We've confirmed a Blueprint Mapping for ${company_name} at ${displayAddress} on (chosen date of mapping, but in the format of Saturday, May 31st, 2025 instead of ${chosen_date_of_mapping}), at (chosen time of mapping, but in the format 1:00 PM instead of ${chosen_time_of_mapping}).

You should receive a Google Calendar Invite for this shortly. Please accept it to confirm.

Based on the provided information (${estimated_square_footage} sq ft), we estimate the mapping will take approximately ${calculatedMappingDuration} minutes.

Pilot Details: https://blueprint-vision-fork-nijelhunt.replit.app/pilot-program
Questions? Reply to this email or schedule a chat: https://calendly.com/blueprintar/30min

Thanks,
Nijel Hunt
Co-Founder at Blueprint"

**TASK 4: CREATE GOOGLE CALENDAR EVENT**
Event Title: "Blueprint Mapping: ${company_name}"
Description: "Company: ${company_name}\nContact (Webhook): ${contact_name} (${contact_phone_number})\nPrimary Contact (Sheet): [SheetContactName] ([SheetContactEmail])\nAddress: ${address}\nEst. Sq. Ft: ${estimated_square_footage}"
Location: ${address}
Start: ${chosen_date_of_mapping} ${chosen_time_of_mapping} (Ensure this is in a Zapier-compatible format, assume EST if no timezone specified by user. If the provided time is already in a specific timezone, use that.)
End: Calculate end time based on a 60-minute duration from the start time.
Attendees: Add [SheetContactEmail] AND support@tryblueprint.io.
Allow conflicts: Yes

**TASK 5: SEND IMMEDIATE TWILIO SMS TO WEBHOOK CONTACT**
To: ${contact_phone_number} (Fallback: +19196389913 if primary is invalid/missing)
Message: "Hi ${contact_name}! Your Blueprint Mapping for ${company_name} is confirmed for ${chosen_date_of_mapping} at ${chosen_time_of_mapping} (${displayAddress}). Email to [SheetContactEmail] & Calendar invite sent. Reminder SMS 1hr prior. - Blueprint"

**TASK 6: GET TRAVEL TIME (Use Google Maps via Zapier if available, otherwise Perplexity. Prioritize Zapier's Google Maps tool for reliability)**
Origin: "1005 Crete St, Durham, NC 27707"
Destination: "${address}"
Return ONLY minutes for car/Uber travel time as [CarTravelMinutes] AND public transport travel time as [PublicTransportMinutes]. If a mode is unavailable, return 'N/A' for it.

**TASK 7: SEND SLACK MESSAGE**
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
}

// Assuming MappingConfirmationDataForPrompt is already defined from the previous step.
// We also need a type for what's extracted from Phase 1 AI response.
export interface Phase1ExtractedData {
  SHEET_ROW_ID: string;
  COMPANY_URL_USED: string; // This is crucial
  // Other fields like SHEET_CONTACT_NAME, SHEET_CONTACT_EMAIL, etc., might be present
  // but COMPANY_URL_USED and SHEET_ROW_ID are key for Phase 2 prompt.
  [key: string]: string;
}

/**
 * Builds the AI prompt for Phase 2 of mapping confirmation (deep research).
 * @param {MappingConfirmationDataForPrompt} originalWebhookData The initial data received by the handler.
 * @param {Phase1ExtractedData} phase1ExtractedData Data extracted from the AI's Phase 1 response.
 * @returns {string} The formatted AI prompt string for Phase 2.
 */
export function buildMappingConfirmationPhase2AIPrompt(
  originalWebhookData: MappingConfirmationDataForPrompt, // The initial data received by the handler
  phase1ExtractedData: Phase1ExtractedData, // Data extracted from AI Call 1's response
): string {
  const {
    company_name, // from original webhook data
    address, // from original webhook data
  } = originalWebhookData;

  const sheetRowId = phase1ExtractedData.SHEET_ROW_ID || "LOOKUP_REQUIRED"; // Fallback if missing
  // Crucially, use the URL that the AI confirmed it used or found in Phase 1
  const companyUrlForCall2 =
    phase1ExtractedData.COMPANY_URL_USED ||
    originalWebhookData.company_url ||
    "No website provided, conduct general search if possible.";

  return `
    Blueprint Post-Signup - Phase 2: Deep Research & Content Generation for ${company_name}.

    **INPUT DATA:**
    - Company Name: ${company_name}
    - Company URL: ${companyUrlForCall2}
    - Company Address: ${address}
    - Google Sheet Row ID to update: ${sheetRowId} (If "LOOKUP_REQUIRED" or "NOT_FOUND", your first step in TASK 2 must be to find the row by Website column matching "${companyUrlForCall2}")

    **TASK 1: PROCESS DEEP RESEARCH FINDINGS** The following deep research has already been completed using OpenAI's Deep Research API:
    For company at URL: ${companyUrlForCall2} (and physical address: ${address} for local context if needed)
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
    Sheet: "Inbound (Website)"
    If the provided Google Sheet Row ID is "LOOKUP_REQUIRED" or "NOT_FOUND", first find the row where 'Website' column matches "${companyUrlForCall2}" and use that Row ID. If still not found after attempting lookup, note this clearly.
    If a valid Row ID is available, update the column "Company Research" with the entire [DeepResearchOutput] from TASK 1.

    **TASK 3: CREATE NOTION PAGE**
    In a Notion database/page named "Blueprint Hub" (or a relevant parent page you can access):
    Title: "${company_name} - Blueprint Design Ideas & Research"
    Icon: (AI-selected emoji based on company type, e.g., 🍕 for pizza, ☕ for cafe, 🛍️ for retail)
    Cover: (AI-selected stock image URL based on company branding/type/location)
    Content (structured using Notion blocks like Headings, Text, Bullet lists):
    "### Deep Research Summary
    [Paste a concise 3-5 sentence summary of [DeepResearchOutput] here, highlighting key findings like menu type/main products, main services, hours. Include the direct website link: ${companyUrlForCall2}]

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

    ### Customer Engagement Questions (from Research):
    (List the 5-10 MCQs with their answers from TASK 1.7)"

    Execute tasks sequentially. Provide a summary of actions, including the Notion page URL. If research was limited or any task failed, note these limitations clearly.
    The entire response from this phase will be considered [DeepResearchOutput].
    `;
}

// blueprint-prompts.v2.ts
// Vendor-neutral wearables + on-site assistant prompt builders aligned with RAG URL context and local ops data.
// Keeps function names for drop-in compatibility, but upgrades schemas and guidance for Parallel Deep Research + Gemini URL-Context.

export interface PostSignupWorkflowPromptInput {
  companyName: string;
  address: string;
  companyUrl?: string;
  locationType?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  squareFootage?: number | null;
  onboardingGoal?: string;
  audienceType?: string;
}

export interface PostSignupSystemInstructionContext {
  summary?: string;
  knowledgeSources: Array<{
    title: string;
    url: string;
    category?: string;
    description?: string;
  }>;
  topQuestions?: string[];
  operationalDetails?: Record<string, unknown>;
  metaRuntimeNotes?: string[];
}

export interface PostSignupWelcomeMessageContext
  extends PostSignupSystemInstructionContext {
  systemInstructions?: string;
  assistantVoice?: string;
}

/** Utilities */

function lineOrFallback(label: string, value?: string | number | null): string {
  const present =
    (typeof value === "string" && value.trim()) ||
    (typeof value === "number" && Number.isFinite(value));
  return present ? `- ${label}: ${value}` : `- ${label}: Not provided`;
}

function contactLine(name?: string, email?: string, phone?: string): string {
  const parts = [name, email, phone].filter(
    (v) => typeof v === "string" && v.trim(),
  );
  return parts.length
    ? `- Primary contact: ${parts.join(" | ")}`
    : "- Primary contact: Not provided";
}

/**
 * Deep Research prompt: produces a RAG-ready URL set for Gemini URL-Context,
 * while explicitly separating venue-local operational data for on-site assistance.
 */
export function buildPostSignupDeepResearchPrompt(
  input: PostSignupWorkflowPromptInput,
): string {
  const {
    companyName,
    address,
    companyUrl,
    locationType,
    contactName,
    contactEmail,
    contactPhone,
    squareFootage,
    onboardingGoal,
    audienceType,
  } = input;

  const header = [
    `You are Blueprint's Research Orchestrator for an on-location voice assistant running on modern wearable devices (vendor-neutral).`,
    `Your task: produce a compact, strictly-typed JSON knowledge kit optimized for:`,
    `1) Web URL context (for Gemini/LLM RAG from authoritative public pages).`,
    `2) On-site operations data (for customer service and SOP coaching).`,
    ``,
    `Context about the venue:`,
    `- Company: ${companyName}`,
    `- Physical address: ${address}`,
    lineOrFallback("Primary website", companyUrl),
    lineOrFallback("Location type / category", locationType),
    lineOrFallback("Approximate square footage", squareFootage ?? null),
    lineOrFallback("Deployment goal", onboardingGoal),
    lineOrFallback("Primary audience served", audienceType),
    contactLine(contactName, contactEmail, contactPhone),
    ``,
    `Research rules (RAG URL set):`,
    `- Prefer first-party URLs (official site, .gov/.edu if applicable).`,
    `- Include trusted third-party only when first-party is missing (tourism boards, reputable directories, high-signal review hubs).`,
    `- URLs must be absolute HTTPS, deduplicated, canonical (no tracking params).`,
    `- Each URL must have a short “why_it_matters” specific to on-site guests.`,
    `- Extract last-known “updated_on” (from page if available, else null).`,
    `- If the primary site is missing, locate a single authoritative homepage.`,
    ``,
    `On-site operations data (local-only; do not hallucinate):`,
    `- Hours, ticketing/pricing ranges, booking flows, accessibility, parking/transit, Wi-Fi, essential contact numbers/emails.`,
    `- If unknown/unavailable, set the field to null (never guess).`,
    ``,
    `Wearables runtime assumptions (vendor-neutral):`,
    `- Experiences run via a companion mobile app that mediates access to glasses sensors (camera/mic/speakers).`,
    `- Treat glanceable display as optional UI “sugar”; primary interface is audio/voice.`,
    `- Return short strings suitable for TTS and brief HUD cards (2–4s), but do NOT include any markdown.`,
    ``,
    `Return ONLY a single JSON object with this exact shape and keys:`,
    `{
  "summary": "2–3 sentences about why visitors come to this specific venue.",
  "url_context": {
    "must_include": [
      {
        "title": "Homepage",
        "url": "https://...",
        "category": "home",
        "why_it_matters": "Authoritative anchor for all other links",
        "updated_on": "YYYY-MM-DD or null"
      }
    ],
    "nice_to_have": [
      {
        "title": "Tickets / Reservations",
        "url": "https://...",
        "category": "tickets|reservations",
        "why_it_matters": "Explain booking flow or prices for on-site guests",
        "updated_on": "YYYY-MM-DD or null"
      }
    ],
    "crawl_instructions": {
      "dedupe_rules": "Canonicalize; drop utm/*; prefer https; one URL per unique task",
      "max_total_urls": 12
    }
  },
  "knowledge_sources": [
    {
      "title": "Concise label (e.g., Menu, Map, Events Calendar)",
      "url": "https://...",
      "category": "menu|tickets|events|faq|policies|map|reviews|social|shop|accessibility|press|news|contact|other",
      "description": "Why this link matters for on-site guests"
    }
  ],
  "top_questions": [
    "6–10 likely on-site questions answerable by the sources (hours today? parking? accessibility? membership perks? exhibit highlights? refunds?)"
  ],
  "operational_details": {
    "hours": "Hours with timezone, or null",
    "pricing": "Ticketing/pricing guidance, or null",
    "contact": "Key phone/email for guests, or null",
    "accessibility": "ADA/service animals/elevators text, or null",
    "parking": "Parking or transit guidance, or null",
    "wifi": "Guest Wi-Fi SSID/pass or portal URL, or null"
  },
  "runtime_hints": [
    "Short notes for the assistant e.g., prefer audio; keep answers <= 2 sentences; offer to open links or start a task."
  ]
}`,
    ``,
    `Strictness:`,
    `- Output the JSON object only. No prose, no markdown fences.`,
    `- If a field is unknown, use null.`,
    `- Ensure all URLs are https and live (if not verifiable, include but set "updated_on": null).`,
  ];

  return header.join("\n");
}

/**
 * System instructions prompt: defines persona, tool usage, safety, and fallbacks,
 * mapping neutral capabilities to whatever wearables SDK is present.
 */
export function buildPostSignupSystemInstructionsPrompt(
  input: PostSignupWorkflowPromptInput,
  context: PostSignupSystemInstructionContext,
): string {
  const { companyName, address, companyUrl, locationType, onboardingGoal } =
    input;

  const knowledgeSourcesJson = JSON.stringify(
    context.knowledgeSources ?? [],
    null,
    2,
  );
  const topQuestions =
    context.topQuestions && context.topQuestions.length
      ? context.topQuestions.map((q) => `- ${q}`).join("\n")
      : "- No specific visitor questions captured.";
  const operationalDetails = context.operationalDetails
    ? JSON.stringify(context.operationalDetails, null, 2)
    : "{}";
  const metaNotes =
    context.metaRuntimeNotes && context.metaRuntimeNotes.length
      ? context.metaRuntimeNotes.map((note) => `- ${note}`).join("\n")
      : "- No special runtime guardrails detected.";
  const summary = context.summary ?? "No research summary was generated.";

  const body = [
    `You are the on-location assistant for ${companyName} (${address}).`,
    `Primary interface is voice; if a heads-up display exists, use brief (2–4s) glanceable text only when it increases clarity.`,
    `Persona: calm, fast, privacy-respectful, brand-aligned for a ${locationType ?? "venue"}.`,
    `Deployment goal: ${onboardingGoal ?? "assist visitors and streamline operations"}.`,
    ``,
    `Research summary:`,
    summary,
    ``,
    `Primary site reference: ${companyUrl ?? "None (use curated knowledge sources)."}\n`,
    `Knowledge sources (JSON):\n${knowledgeSourcesJson}\n`,
    `Top visitor questions to anticipate:\n${topQuestions}\n`,
    `Operational details (JSON):\n${operationalDetails}\n`,
    `Runtime/guardrail notes:\n${metaNotes}\n`,
    `Capabilities (map these to the active wearables/mobile SDK at runtime):`,
    `- open_link(url): open a first-party page for tickets/menu/map.`,
    `- start_navigation(target): step-by-step audio wayfinding; optionally show 1-line breadcrumb if display exists.`,
    `- request_staff(reason, zone): page staff with context; attach short audio clip only if user explicitly consents.`,
    `- create_booking(type, when, party_size, name, contact): start a reservation or tour sign-up.`,
    `- log_sop_progress(list_id, step_no, note?): mark SOP steps and exceptions.`,
    `- capture_snapshot(purpose): hands-free photo/video per user request; confirm and summarize what will be shared.`,
    ``,
    `Safety & privacy:`,
    `- Obtain explicit consent before capturing/sharing any photo, video, or audio clip.`,
    `- Never store PII locally; hand off to secure backend endpoints when needed.`,
    `- Respect staff-only areas and safety policies; warn and refuse unsafe requests.`,
    `- If connectivity is limited, answer from cached operational details; otherwise apologize and offer an offline-safe action (e.g., show hours, explain where to get help in person).`,
    ``,
    `Response style:`,
    `- Default to one sentence; use two only if clarity requires it.`,
    `- Offer an action (“Want me to open tickets?”) when appropriate.`,
    ``,
    `Return ONLY valid JSON with this shape:`,
    `{
  "system_instructions": "Full instruction text for the runtime (you may restate the above in compact form).",
  "voice": "Short descriptor of tone/persona (e.g., calm, concise, professional).",
  "tool_hints": [
    {
      "name": "open_link",
      "when_to_use": "When a first-party URL answers the request",
      "meta_call": "Map to wearables/mobile SDK link opening"
    }
  ],
  "fallback_messages": [
    "Sorry, I can’t reach that right now. Want hours and directions instead?"
  ],
  "meta_runtime_expectations": [
    "Prefer audio first; keep HUD text under 40 chars/line for <= 4s.",
    "Log unresolved intents for future training."
  ]
}`,
    ``,
    `Strictness: Output JSON object only — no extra text, no markdown.`,
  ];

  return body.join("\n");
}

/**
 * Welcome message prompt: short persona-targeted greetings for five roles.
 */
export function buildPostSignupWelcomeMessagesPrompt(
  input: PostSignupWorkflowPromptInput,
  context: PostSignupWelcomeMessageContext,
): string {
  const { companyName, address, locationType, onboardingGoal, audienceType } =
    input;

  const summary = context.summary ?? "No research summary available.";
  const voice =
    typeof context.assistantVoice === "string" && context.assistantVoice.trim()
      ? context.assistantVoice.trim()
      : "Warm, concise, brand-aligned";

  const sys =
    typeof context.systemInstructions === "string" &&
    context.systemInstructions.trim()
      ? context.systemInstructions.trim()
      : "Use voice-first guidance, short HUD text only when needed; offer to start actions.";

  const knowledgeSourceLines = (context.knowledgeSources || [])
    .slice(0, 8)
    .map((s) => `- ${s.title}${s.category ? ` [${s.category}]` : ""}: ${s.url}`)
    .join("\n");

  const topQs = context.topQuestions?.length
    ? context.topQuestions.map((q) => `- ${q}`).join("\n")
    : "- None captured.";

  const ops =
    context.operationalDetails && Object.keys(context.operationalDetails).length
      ? JSON.stringify(context.operationalDetails, null, 2)
      : "{}";

  const metaNotes =
    context.metaRuntimeNotes && context.metaRuntimeNotes.length
      ? context.metaRuntimeNotes.map((n) => `- ${n}`).join("\n")
      : "- None.";

  const body = [
    `You are Blueprint's onboarding copy specialist. Create concise, first-person greetings for different personas arriving at ${companyName} (${address}).`,
    `Keep each under ~35 words, voice: ${voice}.`,
    `Location type: ${locationType ?? "unspecified"}; goal: ${
      onboardingGoal ?? "engage visitors"
    }; audience: ${audienceType ?? "not specified"}.`,
    ``,
    `Research summary:\n${summary}\n`,
    `System instruction highlights:\n${sys}\n`,
    `Key knowledge sources:\n${knowledgeSourceLines || "- None provided."}\n`,
    `Operational details JSON:\n${ops}\n`,
    `Top visitor questions:\n${topQs}\n`,
    `Runtime notes:\n${metaNotes}\n`,
    `Personas: target_customer, casual_visitor, vip_member, staff_member, partner_press.`,
    ``,
    `Return ONLY this JSON object:`,
    `{
  "welcome_messages": {
    "target_customer": "Message for target customers.",
    "casual_visitor": "Message for casual visitors.",
    "vip_member": "Message for VIPs or members.",
    "staff_member": "Message for staff members.",
    "partner_press": "Message for partners, vendors, or press."
  }
}`,
    ``,
    `Strictness: Output JSON object only; no markdown; reference the assistant’s ability to help without naming a specific device brand.`,
  ];

  return body.join("\n");
}
