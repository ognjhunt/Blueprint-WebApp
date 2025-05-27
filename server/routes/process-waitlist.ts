import { Request, Response } from "express";
import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
//       companyAddress: companyAddress,
//       offWaitlistUrl,
//     } = req.body;

//     const mcpResponse = await openai.responses.create({
//       model: "o4-mini",
//       input: `Blueprint Waitlist Automation: Process new signup for ${name} from ${company}.

//     STEP 1: Create Google Sheet row in "Blueprint Waitlist" spreadsheet with columns: Name="${name}", Company="${company}", Email="${email}", City="${city}", State="${state}", Address="${companyAddress}", Website="${companyWebsite}", Additional Comments="${message}", Date of Waitlist="${new Date().toISOString().split("T")[0]}", Time of Waitlist="${new Date().toLocaleTimeString()}", Does Company Meet Criteria="", Have we sent off the waitlist email="No", Have they picked a date+time for mapping="No", Have we Onboarded="No".

//     STEP 2: Use Perplexity to evaluate: "${company} located in ${city}, ${state} - Evaluate for Blueprint pilot program criteria: customer-facing business, retail/hospitality type, physical presence with foot traffic, located in or near Durham NC area. Respond with Yes (meets all criteria) or No (does not meet criteria) plus brief reason."

//     STEP 3: Draft (DO NOT SEND - JUST CREATE DRAFT) appropriate email:
//     - If Perplexity says YES: Subject="Hello - From Blueprint", Body="Hey ${name.split(" ")[0]},\n\nYou're already off the waitlist for Blueprint!\n\n${company} has met all the criteria needed to jump to first in line to try Blueprint out.\n\nTo get started, please take time to choose sign up and choose a date & time for us to send someone to your location for the 3D mapping of your space!:\n${offWaitlistUrl}\n\nAny questions? Here's a link to my calendar if you wanted to chat this week!:\nhttps://calendly.com/blueprintar/30min\n\n____\nNijel Hunt\nCo-Founder at Blueprint"
//     - If Perplexity says NO: Subject="Your Blueprint waitlist spot is confirmed! 🎉", Body="Hey ${name.split(" ")[0]},\n\nYou're on the waitlist for Blueprint!\n\nYou'll be first to know once Blueprint expands into ${city} (then something about joining Pilot Program within city (first 3 months free)).\n\nWant Blueprint to move to your city quicker?\nPost on X and tag us @tryblueprintapp to let us know you applied.\n\nIf you have any questions about Blueprint in the meantime, just reply to this email.\n\n____\nNijel Hunt\nCo-Founder at Blueprint"

//     STEP 4: Update the Google Sheet row with: Does Company Meet Criteria=[Yes/No from Perplexity], Have we sent off the waitlist email="Yes", Have they picked a date+time for mapping="No", Have we Onboarded="No".

//     Execute all steps and confirm completion.`,
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

export default async function processWaitlistHandler(
  req: Request,
  res: Response,
) {
  try {
    const {
      name,
      email,
      company,
      city,
      state,
      message,
      companyWebsite,
      offWaitlistUrl,
    } = req.body;

    const mcpResponse = await anthropic.beta.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Blueprint Waitlist Automation: Process new signup for ${name} from ${company}.

STEP 1: Create Google Sheet row in "Blueprint Waitlist" spreadsheet with columns: Name="${name}", Company="${company}", Email="${email}", City="${city}", State="${state}", Address="${city}, ${state}", Website="${companyWebsite}", Additional Comments="${message}", Date of Waitlist="${new Date().toISOString().split("T")[0]}", Time of Waitlist="${new Date().toLocaleTimeString()}", Does Company Meet Criteria="", Have we sent off the waitlist email="No", Have they picked a date+time for mapping="No", Have we Onboarded="No".

STEP 2: Use Perplexity to evaluate: "${company} located in ${city}, ${state} - Evaluate for Blueprint pilot program criteria: customer-facing business, retail/hospitality type, physical presence with foot traffic, located in or near Durham NC area. Respond with Yes (meets all criteria) or No (does not meet criteria) plus brief reason."

STEP 3: Draft (DO NOT SEND - JUST CREATE DRAFT) appropriate email:
- If Perplexity says YES: Subject="Hello - From Blueprint", Body="Hey ${name.split(" ")[0]},\n\nYou're already off the waitlist for Blueprint!\n\n${company} has met all the criteria needed to jump to first in line to try Blueprint out.\n\nTo get started, please take time to choose sign up and choose a date & time for us to send someone to your location for the 3D mapping of your space!:\n${offWaitlistUrl}\n\nAny questions? Here's a link to my calendar if you wanted to chat this week!:\nhttps://calendly.com/blueprintar/30min\n\n____\nNijel Hunt\nCo-Founder at Blueprint"
- If Perplexity says NO: Subject="Your Blueprint waitlist spot is confirmed! 🎉", Body="Hey ${name.split(" ")[0]},\n\nYou're on the waitlist for Blueprint!\n\nYou'll be first to know once Blueprint expands into ${city} (then something about joining Pilot Program within city (first 3 months free)).\n\nWant Blueprint to move to your city quicker?\nPost on X and tag us @tryblueprintapp to let us know you applied.\n\nIf you have any questions about Blueprint in the meantime, just reply to this email.\n\n____\nNijel Hunt\nCo-Founder at Blueprint"

STEP 4: Update the Google Sheet row with: Does Company Meet Criteria=[Yes/No from Perplexity], Have we sent off the waitlist email="Yes", Have they picked a date+time for mapping="No", Have we Onboarded="No".

Execute all steps and confirm completion.`,
        },
      ],
      mcp_servers: [
        {
          type: "url",
          url: "https://mcp.zapier.com/api/mcp/s/4d602731-9c5e-4c56-a494-7d1cdef77199/mcp",
          name: "zapier",
          authorization_token:
            "NGQ2MDI3MzEtOWM1ZS00YzU2LWE0OTQtN2QxY2RlZjc3MTk5Ojc0ZWJlNTdlLWZlNzUtNDhjNC1hOGVkLWNjN2I2YzVjNGJmMA==",
        },
      ],
      betas: ["mcp-client-2025-04-04"],
    });

    res.json({ success: true, response: mcpResponse });
  } catch (error) {
    console.error("Error processing waitlist:", error);
    res.status(500).json({ error: "Failed to process waitlist signup" });
  }
}
