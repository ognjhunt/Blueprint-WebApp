import { Request, Response } from "express";
import OpenAI from "openai";

import { attachRequestMeta, logger } from "../logger";
import { buildWaitlistAIPrompt } from "../utils/ai-prompts";
import { validateWaitlistData, WaitlistData } from "../utils/validation";

const openAiApiKey = process.env.OPENAI_API_KEY;
const openAiTimeoutMs = Number(process.env.OPENAI_TIMEOUT_MS ?? 20_000);

const openai = openAiApiKey
  ? new OpenAI({
      apiKey: openAiApiKey,
      maxRetries: 2,
      timeout: openAiTimeoutMs,
    })
  : null;

const zapierMcpUrl = process.env.ZAPIER_MCP_URL || "https://mcp.zapier.com/api/mcp/mcp";
const zapierMcpToken = process.env.ZAPIER_MCP_TOKEN;

export default async function processWaitlistHandler(req: Request, res: Response) {
  const requestMeta = attachRequestMeta({
    requestId: res.locals?.requestId,
    route: "process-waitlist",
  });

  if (!openai) {
    logger.error(requestMeta, "OpenAI client not configured");
    return res.status(500).json({ error: "Service temporarily unavailable" });
  }

  if (!zapierMcpToken) {
    logger.error(requestMeta, "Missing Zapier MCP token configuration");
    return res.status(500).json({ error: "Service temporarily unavailable" });
  }

  try {
    const requestData = req.body as WaitlistData;
    const validationErrors = validateWaitlistData(requestData);

    if (validationErrors.length > 0) {
      logger.warn(
        attachRequestMeta({
          ...requestMeta,
          validationErrors: validationErrors.length,
        }),
        "Waitlist submission failed validation",
      );

      return res.status(400).json({
        error: "Validation failed",
        errors: validationErrors,
      });
    }

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

    const aiPrompt = buildWaitlistAIPrompt(promptData);

    let timeoutHandle: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error("OpenAI request timed out"));
      }, openAiTimeoutMs);
    });

    const mcpResponse = (await Promise.race([
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
            server_url: zapierMcpUrl,
            require_approval: "never",
            headers: {
              Authorization: `Bearer ${zapierMcpToken}`,
            },
          },
        ],
      }),
      timeoutPromise,
    ])) as Awaited<ReturnType<typeof openai.responses.create>>;

    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    logger.info(
      attachRequestMeta({
        ...requestMeta,
        emailDomain: email?.includes("@") ? email.split("@")[1] : undefined,
        companyLength: company?.length,
      }),
      "Waitlist submission processed",
    );

    res.json({ success: true, response: mcpResponse });
  } catch (error: any) {
    const statusCode = error?.status ?? error?.statusCode ?? 500;

    logger.error(
      {
        ...attachRequestMeta({
          ...requestMeta,
          statusCode,
          errorType: error?.constructor?.name,
        }),
        err: error,
      },
      "Failed to process waitlist submission",
    );

    res.status(500).json({
      error: "Failed to process waitlist signup",
      details: error?.message || "Unknown error",
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
