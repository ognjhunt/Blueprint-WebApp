import { Request, Response } from "express";
import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { buildWaitlistAIPrompt } from "../utils/ai-prompts";
import {
  validateWaitlistData,
  WaitlistData,
  ValidationError,
} from "../utils/validation";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function processWaitlistHandler(
  req: Request,
  res: Response,
) {
  console.log("🔵 [DEBUG] Starting processWaitlistHandler");
  console.log("🔵 [DEBUG] Request body:", JSON.stringify(req.body, null, 2));

  try {
    // Cast req.body to WaitlistData for type safety with validator and prompt builder
    const requestData = req.body as WaitlistData;
    console.log(
      "🔵 [DEBUG] Casted request data:",
      JSON.stringify(requestData, null, 2),
    );

    const validationErrors = validateWaitlistData(requestData);
    if (validationErrors.length > 0) {
      console.log("❌ [DEBUG] Validation failed:", validationErrors);
      return res.status(400).json({
        error: "Validation failed",
        errors: validationErrors,
      });
    }
    console.log("✅ [DEBUG] Validation passed");

    // Destructure after validation, using validated data (requestData)
    const {
      name,
      email,
      company,
      city,
      state,
      message,
      companyWebsite,
      companyAddress,
      offWaitlistUrl,
    } = requestData;

    // Prepare data for the prompt builder
    const promptData = {
      name: name!,
      email: email!,
      company: company!,
      city: city!,
      state: state!,
      message: message,
      companyWebsite: companyWebsite,
      companyAddress: companyAddress,
      offWaitlistUrl: offWaitlistUrl!,
    };
    console.log(
      "🔵 [DEBUG] Prompt data prepared:",
      JSON.stringify(promptData, null, 2),
    );

    const aiPrompt = buildWaitlistAIPrompt(promptData);
    console.log(
      "🔵 [DEBUG] AI Prompt generated (first 500 chars):",
      aiPrompt.substring(0, 500) + "...",
    );
    console.log("🔵 [DEBUG] Full AI Prompt length:", aiPrompt.length);

    // Check OpenAI client configuration
    console.log(
      "🔵 [DEBUG] OpenAI API Key exists:",
      !!process.env.OPENAI_API_KEY,
    );
    console.log(
      "🔵 [DEBUG] OpenAI API Key length:",
      process.env.OPENAI_API_KEY?.length || 0,
    );

    console.log("🔵 [DEBUG] About to make OpenAI MCP call...");
    console.log(
      "🔵 [DEBUG] MCP Server URL:",
      "https://mcp.zapier.com/api/mcp/mcp",
    );

    // Add timeout and detailed error handling
    const mcpResponse = await Promise.race([
      openai.responses.create({
        model: "o3",
        input: aiPrompt,
        reasoning: {
          effort: "medium",
        },
        tools: [
          {
            type: "mcp",
            server_label: "zapier",
            server_url: "https://mcp.zapier.com/api/mcp/mcp",
            require_approval: "never",
            headers: {
              Authorization:
                "Bearer YmQ5YzMxY2EtMWYzOC00NTViLTljYjItOWYyMmM0NWU3ODE0OjJkN2ZmMzRjLTQ1MTgtNDNkMC05ODg0LTc2MzA5NTYyMjFjYw==",
            },
          },
        ],
      }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Request timeout after 60 seconds")),
          60000,
        ),
      ),
    ]);

    console.log("✅ [DEBUG] OpenAI MCP call completed successfully");
    console.log("🔵 [DEBUG] Response type:", typeof mcpResponse);
    console.log("🔵 [DEBUG] Response keys:", Object.keys(mcpResponse || {}));
    console.log(
      "🔵 [DEBUG] Full response:",
      JSON.stringify(mcpResponse, null, 2),
    );

    res.json({ success: true, response: mcpResponse });
    console.log("✅ [DEBUG] Response sent successfully");
  } catch (error: any) {
    console.error("❌ [ERROR] Caught error in processWaitlistHandler:");
    console.error("❌ [ERROR] Error type:", typeof error);
    console.error("❌ [ERROR] Error constructor:", error?.constructor?.name);
    console.error("❌ [ERROR] Error message:", error?.message);
    console.error("❌ [ERROR] Error code:", error?.code);
    console.error("❌ [ERROR] Error status:", error?.status);
    console.error("❌ [ERROR] Error response:", error?.response?.data);
    console.error(
      "❌ [ERROR] Full error object:",
      JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
    );
    console.error("❌ [ERROR] Stack trace:", error?.stack);

    res.status(500).json({
      error: "Failed to process waitlist signup",
      details: error?.message || "Unknown error",
      errorType: error?.constructor?.name || "Unknown",
    });
  }
}

// export default async function processWaitlistHandler(
//   req: Request,
//   res: Response,
// ) {
//   try {
//     const {
//       name,
//       email,
//       company,
//       city,
//       state,
//       message,
//       companyWebsite,
//       offWaitlistUrl,
//     } = req.body;

//     const mcpResponse = await anthropic.beta.messages.create({
//       model: "claude-sonnet-4-20250514",
//       max_tokens: 2000,
//       messages: [
//         {
//           role: "user",
//           content: `Blueprint Waitlist Automation: Process new signup for ${name} from ${company}.

// STEP 1: Create Google Sheet row in "Blueprint Waitlist" spreadsheet with columns: Name="${name}", Company="${company}", Email="${email}", City="${city}", State="${state}", Address="${city}, ${state}", Website="${companyWebsite}", Additional Comments="${message}", Date of Waitlist="${new Date().toISOString().split("T")[0]}", Time of Waitlist="${new Date().toLocaleTimeString()}", Does Company Meet Criteria="", Have we sent off the waitlist email="No", Have they picked a date+time for mapping="No", Have we Onboarded="No".

// STEP 2: Use Perplexity to evaluate: "${company} located in ${city}, ${state} - Evaluate for Blueprint pilot program criteria: customer-facing business, retail/hospitality type, physical presence with foot traffic, located in or near Durham NC area. Respond with Yes (meets all criteria) or No (does not meet criteria) plus brief reason."

// STEP 3: Draft (DO NOT SEND - JUST CREATE DRAFT) appropriate email:
// - If Perplexity says YES: Subject="Hello - From Blueprint", Body="Hey ${name.split(" ")[0]},\n\nYou're already off the waitlist for Blueprint!\n\n${company} has met all the criteria needed to jump to first in line to try Blueprint out.\n\nTo get started, please take time to choose sign up and choose a date & time for us to send someone to your location for the 3D mapping of your space!:\n${offWaitlistUrl}\n\nAny questions? Here's a link to my calendar if you wanted to chat this week!:\nhttps://calendly.com/blueprintar/30min\n\n____\nNijel Hunt\nCo-Founder at Blueprint"
// - If Perplexity says NO: Subject="Your Blueprint waitlist spot is confirmed! 🎉", Body="Hey ${name.split(" ")[0]},\n\nYou're on the waitlist for Blueprint!\n\nYou'll be first to know once Blueprint expands into ${city} (then something about joining Pilot Program within city (first 3 months free)).\n\nWant Blueprint to move to your city quicker?\nPost on X and tag us @tryblueprintapp to let us know you applied.\n\nIf you have any questions about Blueprint in the meantime, just reply to this email.\n\n____\nNijel Hunt\nCo-Founder at Blueprint"

// STEP 4: Update the Google Sheet row with: Does Company Meet Criteria=[Yes/No from Perplexity], Have we sent off the waitlist email="Yes", Have they picked a date+time for mapping="No", Have we Onboarded="No".

// Execute all steps and confirm completion.`,
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

//     res.json({ success: true, response: mcpResponse });
//   } catch (error) {
//     console.error("Error processing waitlist:", error);
//     res.status(500).json({ error: "Failed to process waitlist signup" });
//   }
// }
