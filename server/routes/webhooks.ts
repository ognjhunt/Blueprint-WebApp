import express from "express";
import { Request, Response } from "express";
import OpenAI from "openai";

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Store in-progress requests (in production, use Redis or database)
const pendingRequests = new Map<string, any>();

router.post("/openai-webhook", async (req: Request, res: Response) => {
  try {
    // Verify webhook signature (important for security)
    const signature = req.headers["webhook-signature"] as string;
    const timestamp = req.headers["webhook-timestamp"] as string;
    const webhookId = req.headers["webhook-id"] as string;

    // Verify the webhook (you'll need to implement this with your webhook secret)
    // const isValid = verifyWebhookSignature(req.body, signature, timestamp, process.env.OPENAI_WEBHOOK_SECRET);
    // if (!isValid) return res.status(400).send('Invalid signature');

    const event = req.body;

    if (event.type === "response.completed") {
      const responseId = event.data.id;

      // Retrieve the completed deep research response
      const completedResponse = await openai.responses.retrieve(responseId);

      // Get the original request data (you'll need to store this when starting background task)
      const originalRequestData = pendingRequests.get(responseId);

      if (originalRequestData && completedResponse.output_text) {
        // Continue with Phase 2B - update Google Sheets and Notion
        await continuePhase2B(
          completedResponse.output_text,
          originalRequestData,
        );

        // Clean up
        pendingRequests.delete(responseId);
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).send("Webhook processing failed");
  }
});

async function continuePhase2B(
  deepResearchFindings: string,
  originalData: any,
) {
  // Your Phase 2B logic here - update Google Sheets, Notion, Firebase, etc.
  // This is the same as the Phase 2B code from earlier
}

export default router;
