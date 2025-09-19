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
}

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

  const websiteLine = companyUrl
    ? `- Primary website: ${companyUrl}`
    : "- Primary website: Not provided (locate an authoritative URL).";
  const audienceLine = audienceType
    ? `- Primary audience served: ${audienceType}`
    : "- Primary audience: Not specified.";
  const goalLine = onboardingGoal
    ? `- Deployment goal shared by client: ${onboardingGoal}`
    : "- Deployment goal: Not specified.";
  const areaLine =
    typeof squareFootage === "number" && Number.isFinite(squareFootage)
      ? `- Approximate square footage: ${squareFootage}`
      : "- Approximate square footage: Not supplied.";
  const contactDetails = [contactName, contactEmail, contactPhone]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" | ");
  const contactLine = contactDetails
    ? `- Primary contact person: ${contactDetails}`
    : "- Primary contact person: Not provided.";

  return `You are Blueprint's Meta Wearables research orchestrator. Prepare a knowledge kit for an on-location assistant that runs through Meta's new Wearables Device Access Toolkit (announced at Connect 2025 with deep integrations for Ray-Ban Meta and Quest devices).

Location overview:
- Company: ${companyName}
- Physical address: ${address}
${websiteLine}
- Location type / category: ${locationType ?? "Not provided"}
${areaLine}
${goalLine}
${audienceLine}
${contactLine}

Research focus for the Meta Device Access Toolkit deployment:
1. Find authoritative public URLs that answer walk-up visitor questions (hours, ticketing, reservations, exhibits, amenities, parking, accessibility, memberships, FAQs, special events, press, social media, review sites).
2. Prefer first-party sources maintained by the business. When missing, find trustworthy third-party references (tourism boards, reputable reviews, local directories).
3. Summarise context that is useful for a wearable assistant (short orientation, highlight flagship experiences, policies, membership perks).
4. Capture operational details that guests need on-site (hours, booking flows, price ranges, accessibility statements, parking, Wi-Fi, direct contact numbers).
5. Note anything relevant for spatial anchors, on-device guardrails, or instant actions that the Meta toolkit runtime can trigger (e.g., where anchors should live, staff-only areas, safety messaging).

Return ONLY valid JSON with the following structure:
{
  "summary": "2-3 sentence briefing about the location and why visitors come.",
  "knowledge_sources": [
    {
      "title": "Concise label (e.g., Reservations, Menu, Tickets)",
      "url": "https://example.com/...",
      "category": "menu|tickets|events|faq|policies|map|reviews|social|shop|accessibility|press|news|contact|other",
      "description": "Why this link matters for on-site guests."
    }
  ],
  "top_questions": [
    "List 6-8 likely visitor questions answered by these sources."
  ],
  "operational_details": {
    "hours": "Hours of operation with timezone",
    "pricing": "Ticketing or pricing guidance if any",
    "contact": "Key phone/email numbers for guests",
    "accessibility": "Elevators, ADA info, service animal policy, etc.",
    "parking": "Parking or transit guidance",
    "wifi": "Guest Wi-Fi details if publicly offered"
  },
  "meta_runtime_notes": [
    "Notes about spatial anchor opportunities, voice intents, or guardrails the Meta Device Access Toolkit runtime should enforce."
  ]
}

- Deduplicate URLs and ensure they are absolute HTTPS links.
- Include at least 6 knowledge_sources when the information exists.
- If a field is unknown, use null instead of guessing.
- Do not include markdown fences or commentary outside of the JSON object.`;
}

export function buildPostSignupSystemInstructionsPrompt(
  input: PostSignupWorkflowPromptInput,
  context: PostSignupSystemInstructionContext,
): string {
  const {
    companyName,
    address,
    companyUrl,
    locationType,
    onboardingGoal,
  } = input;

  const knowledgeSourcesJson = JSON.stringify(context.knowledgeSources ?? [], null, 2);
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

  return `You are drafting production-grade system instructions for Blueprint's on-location assistant deployed on Meta's Wearables Device Access Toolkit. The assistant speaks to guests at ${companyName} (${address}) using Ray-Ban Meta and Quest devices. It must comply with Meta's on-device guardrails, handle audio/voice interactions, and trigger spatial anchors or quick actions exposed by the toolkit.

Research summary:
${summary}

Primary public site reference: ${companyUrl ?? "Not provided — rely on curated knowledge sources."}

Knowledge sources (JSON):
${knowledgeSourcesJson}

Top visitor questions to anticipate:
${topQuestions}

Operational details pulled from research:
${operationalDetails}

Meta runtime notes:
${metaNotes}

Write instructions that:
1. Define the assistant's persona and tone aligned with the venue's brand (location type: ${locationType ?? "unspecified"}; deployment goal: ${onboardingGoal ?? "engage visitors"}).
2. Explain how to use the knowledge sources above—cite titles when referencing them and map them to Meta toolkit capabilities (e.g., knowledgeBase.lookup, blueprintAnchors.navigate, metaToolkit.launchAction).
3. Outline available capabilities and triggers: accessing Blueprint spatial anchors, launching AR layers, handing off to staff, capturing visitor feedback, booking demos or tours.
4. Include safety and privacy guardrails that align with Meta's Device Access Toolkit announcements (respect opt-outs, avoid storing personal data on-device, escalate sensitive or staff-only requests).
5. Provide fallback behavior when no answer is available or when connectivity is limited.
6. Keep responses concise (max two sentences unless the visitor asks for detail) and offer to open relevant links, anchors, or follow-up actions when helpful.
7. End with quick reference metadata for the runtime (tone keywords, default language, mention to log unresolved questions for future training).

Return ONLY valid JSON with the shape:
{
  "system_instructions": "Full instruction text ready for the assistant runtime.",
  "voice": "Short description of tone/persona.",
  "tool_hints": [
    {
      "name": "Tool or action name",
      "when_to_use": "One sentence on when to trigger it",
      "meta_call": "If relevant, mention the Device Access Toolkit API or Blueprint function"
    }
  ],
  "fallback_messages": [
    "Visitor-facing message used when the assistant lacks an answer."
  ],
  "meta_runtime_expectations": [
    "Additional constraints or telemetry the runtime should apply."
  ]
}

Do not include markdown fences or commentary. Output the JSON object only.`;
}

export function buildPostSignupWelcomeMessagesPrompt(
  input: PostSignupWorkflowPromptInput,
  context: PostSignupWelcomeMessageContext,
): string {
  const {
    companyName,
    address,
    locationType,
    onboardingGoal,
    audienceType,
  } = input;

  const summary = context.summary ?? "No research summary available.";

  let voiceLine = "Preferred tone: Warm, helpful, brand-aligned.";
  if (typeof context.assistantVoice === "string" && context.assistantVoice.trim()) {
    voiceLine = "Preferred tone: " + context.assistantVoice + ".";
  }

  let systemInstructionsLine =
    "System instruction highlights: Not provided yet—rely on the research summary and details.";
  if (
    typeof context.systemInstructions === "string" &&
    context.systemInstructions.trim()
  ) {
    systemInstructionsLine =
      "System instruction highlights:\n" + context.systemInstructions;
  }

  const knowledgeSourceLines = (context.knowledgeSources || [])
    .slice(0, 8)
    .map((source) => {
      const categoryLabel = source.category ? ` [${source.category}]` : "";
      return `- ${source.title}${categoryLabel}: ${source.url}`;
    })
    .join("\n");

  const topQuestionsLines = context.topQuestions?.length
    ? context.topQuestions.map((q) => `- ${q}`).join("\n")
    : "- None captured.";

  const operationalDetailsBlock =
    context.operationalDetails && Object.keys(context.operationalDetails).length
      ? JSON.stringify(context.operationalDetails, null, 2)
      : "{}";

  const metaNotesLines = context.metaRuntimeNotes?.length
    ? context.metaRuntimeNotes.map((note) => `- ${note}`).join("\n")
    : "- None.";

  return `You are Blueprint's onboarding copy specialist. Draft concise welcome messages that the on-location assistant will speak when greeting different personas arriving at ${companyName} (${address}). Keep each response to one or two sentences in first-person assistant voice, pointing visitors to helpful actions informed by Blueprint's capabilities.

Location type: ${locationType ?? "unspecified"}
Primary onboarding goal: ${onboardingGoal ?? "engage visitors"}
Primary audience noted: ${audienceType ?? "not specified"}

Research summary:
${summary}

${voiceLine}

${systemInstructionsLine}

Key knowledge sources:
${knowledgeSourceLines || "- None provided."}

Operational details JSON:
${operationalDetailsBlock}

Top visitor questions to anticipate:
${topQuestionsLines}

Meta runtime notes:
${metaNotesLines}

Personas requiring distinct welcome templates:
1. target_customer — Core guests who match the ideal customer profile.
2. casual_visitor — Curious walk-ins exploring ${companyName} without a plan.
3. vip_member — Loyalty members, subscribers, or high-value guests expecting premium service.
4. staff_member — Employees or internal team members verifying schedules, tasks, or SOPs.
5. partner_press — Partners, vendors, or press/influencer contacts arriving for meetings or coverage.

Return ONLY valid JSON exactly in the following shape:
{
  "welcome_messages": {
    "target_customer": "Message for target customers.",
    "casual_visitor": "Message for casual visitors.",
    "vip_member": "Message for VIPs or members.",
    "staff_member": "Message for staff members.",
    "partner_press": "Message for partners, vendors, or press."
  }
}

Messages must stay under ~35 words, reference Blueprint or the assistant's ability to help, and avoid markdown formatting. Respond with the JSON object only.
Do not include markdown fences or commentary. Output the JSON object only.`;
}
