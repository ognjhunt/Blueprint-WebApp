import { Request, Response } from "express";
import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
//       estimated_square_footage,
//       address,
//       company_url,
//       chosen_date_of_mapping,
//       chosen_time_of_mapping,
//     };

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
// - Website: ${company_url}
// - Date: ${chosen_date_of_mapping}
// - Time: ${chosen_time_of_mapping}

// **STEP 1: UPDATE GOOGLE SHEET**
// Find row in "Blueprint Waitlist" spreadsheet where Website column matches "${company_url}" and update:
// - "Have they picked a date+time for mapping?" = "Yes"
// - "Have we Onboarded?" = "No"

// **STEP 2: DRAFT CONFIRMATION EMAIL**
// Create email draft to contact email from matched Google Sheet row:
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

// **STEP 5: PERPLEXITY TRAVEL TIME QUERY**
// Use Perplexity to get travel duration from "1005 Crete St, Durham, NC 27707" to "${address}" - return ONLY minutes for: car/uber travel time AND public transport travel time.

// **STEP 6: SLACK MESSAGE**
// Send to gumloop-experiment channel:
// "NEW APPOINTMENT:
// CONTACT NAME: ${contact_name}
// LOCATION: ${address}
// EST. TIME OF TRAVEL: [from Step 5]
// DATE: ${chosen_date_of_mapping}
// TIME: ${chosen_time_of_mapping}
// CONTACT PHONE NUMBER: ${contact_phone_number}
// EST. SQUARE FOOTAGE: [estimate from research]"

// **STEP 7: PERPLEXITY DEEP RESEARCH**
// Use Sonar Deep Research model for comprehensive analysis of ${company_url}:
// 1. Visit main website page
// 2. Extract URLs for: Menu, Reservations, Wait List, Online Ordering, Reviews, Loyalty Program, Specials/Promotions, Events/Calendar
// 3. Scrape menu word-for-word with descriptions and prices (download PDFs/images if needed)
// 4. Crawl entire website for: Hours, Social Media, Contact Info, About, Policies, etc.
// 5. Scrape all URLs from step 2 word-for-word
// 6. Find 6 Google Reviews + 6 Yelp Reviews (4+ stars, extract word-for-word)
// 7. Create 10 personalized multiple choice questions with answers for customer engagement

// **STEP 8: CREATE NOTION PAGE**
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

export default async function processMappingConfirmationHandler(
  req: Request,
  res: Response,
) {
  try {
    // Extract webhook data from request body
    const {
      have_we_onboarded,
      chosen_time_of_mapping,
      chosen_date_of_mapping,
      have_user_chosen_date,
      address,
      company_url,
      company_name,
      contact_name,
      contact_phone_number,
      estimated_square_footage,
    } = req.body;

    // Validate required fields
    const requiredFields = {
      company_name,
      contact_name,
      contact_phone_number,
      address,
      company_url,
      chosen_date_of_mapping,
      chosen_time_of_mapping,
      estimated_square_footage,
    };

    for (const [field, value] of Object.entries(requiredFields)) {
      if (!value) {
        return res.status(400).json({
          error: `Missing required field: ${field}`,
        });
      }
    }

    // Your existing MCP call logic goes here
    const mcpResponse = await anthropic.beta.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `Blueprint Post-Signup Mapping Automation - Execute complete workflow for ${company_name}:

**WEBHOOK DATA:**
- Company: ${company_name}
- Contact: ${contact_name} (${contact_phone_number})
- Address: ${address}
- Website: ${company_url}
- Date: ${chosen_date_of_mapping}
- Time: ${chosen_time_of_mapping}

**STEP 1: UPDATE GOOGLE SHEET**
Find row in "Blueprint Waitlist" spreadsheet where Website column matches "${company_url}" and update:
- "Have they picked a date+time for mapping?" = "Yes"
- "Have we Onboarded?" = "No"

**STEP 2: DRAFT CONFIRMATION EMAIL**
Create email draft to contact email from matched Google Sheet row:
Subject: "Confirmed for Blueprint Mapping!"
Body: "We've confirmed a Blueprint Mapping for ${company_name} at ${address.replace(", USA", "")} on ${chosen_date_of_mapping} at ${chosen_time_of_mapping}. You should get a Calendar Invite email soon, please confirm it.

We will also send a reminder email the day of the scheduled mapping. Based on the provided information, we estimate that the mapping will take ~[calculate: (estimated_square_footage / 100) + 15] minutes.

If you haven't already, check out our Pilot Details page: https://blueprint-vision-fork-nijelhunt.replit.app/pilot-program

Questions? Respond to this email or schedule a chat: https://calendly.com/blueprintar/30min

____
Nijel Hunt
Co-Founder at Blueprint"

**STEP 3: CREATE GOOGLE CALENDAR EVENT**
Event: "Scheduled Blueprint Mapping"
Description: "Company: ${company_name}
Contact Name: ${contact_name}
Contact Phone Number: ${contact_phone_number}"
Location: ${address}
Start: ${chosen_date_of_mapping} ${chosen_time_of_mapping}
Duration: 60 minutes
Allow conflicts: Yes

**STEP 4: DRAFT DAY-OF REMINDER EMAIL**
Create draft email scheduled for ${chosen_date_of_mapping} at 9:00 AM EST:
Subject: "Scheduled Blueprint Mapping is Today!"
Body: Include calendar event details, mention ${contact_name} gets 1hr advance notice, contact founders@blueprint.com for questions.

**STEP 5: PERPLEXITY TRAVEL TIME QUERY**
Use Perplexity to get travel duration from "1005 Crete St, Durham, NC 27707" to "${address}" - return ONLY minutes for: car/uber travel time AND public transport travel time.

**STEP 6: SLACK MESSAGE**
Send to gumloop-experiment channel:
"NEW APPOINTMENT:
CONTACT NAME: ${contact_name}
LOCATION: ${address}
EST. TIME OF TRAVEL: [from Step 5]
DATE: ${chosen_date_of_mapping}
TIME: ${chosen_time_of_mapping}
CONTACT PHONE NUMBER: ${contact_phone_number}
EST. SQUARE FOOTAGE: [estimate from research]"

**STEP 7: PERPLEXITY DEEP RESEARCH**
Use Sonar Deep Research model for comprehensive analysis of ${company_url}:
1. Visit main website page
2. Extract URLs for: Menu, Reservations, Wait List, Online Ordering, Reviews, Loyalty Program, Specials/Promotions, Events/Calendar
3. Scrape menu word-for-word with descriptions and prices (download PDFs/images if needed)
4. Crawl entire website for: Hours, Social Media, Contact Info, About, Policies, etc.
5. Scrape all URLs from step 2 word-for-word
6. Find 6 Google Reviews + 6 Yelp Reviews (4+ stars, extract word-for-word)
7. Create 10 personalized multiple choice questions with answers for customer engagement

**STEP 8: CREATE NOTION PAGE**
Create page in Blueprint Hub:
Title: "${company_name} - Design Ideas"
Content: AI-generated Blueprint experience ideas based on research including content placement suggestions for Text, 3D models, Media, Webpages, and uploaded content (MP3/4, GLB, PNG, PDF, PPT).
Icon: AI-selected based on company type
Cover: AI-selected based on company branding

Execute all steps and confirm completion with summary.`,
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

    // Return success response
    res.json({
      success: true,
      response: mcpResponse,
      message: "Mapping confirmation workflow completed successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error processing mapping confirmation:", error);
    res.status(500).json({
      error: "Failed to process mapping confirmation",
      message: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}
