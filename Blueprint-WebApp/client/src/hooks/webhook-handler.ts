import { Request, Response } from "express";

export default async function handleDeepResearchWebhook(req: Request, res: Response) {
  try {
    const event = req.body;

    if (event.type === "response.completed") {
      const responseId = event.data.id;

      // Retrieve the completed response
      const response = await openai.responses.retrieve(responseId);

      // Continue with Phase 2B processing here
      // You'll need to store the original request data to continue the workflow

      console.log("Deep research completed via webhook:", response.output_text);
    }

    res.status(200).send();
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(400).send("Invalid signature");
  }
}