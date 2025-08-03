import { Request, Response } from "express";
import Stripe from "stripe";

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const body = req.body;
    const { totalCost, hours, costPerHour } = body;

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "API_KEY";
    if (!stripeSecretKey) {
      return res.status(500).json({ error: "Missing Stripe Secret Key" });
    }

    const stripe = new Stripe(stripeSecretKey);

    // Determine the base URL for redirects. `window.location.origin` isn't
    // available in a server environment, so fall back to the request's origin
    // header or a sensible default.
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ?? req.headers.origin ?? "http://localhost:3000";

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Blueprint Plus Plan",
              description: `${hours} hours at $${costPerHour.toFixed(2)}/hour`,
            },
            unit_amount: Math.round(totalCost * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        plan: "plus",
        hours: hours.toString(),
        costPerHour: costPerHour.toString(),
      },
      success_url: `${baseUrl}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing?canceled=true`,
    });

    return res.json({ sessionId: session.id });
  } catch (error) {
    console.error("Error creating Stripe session:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return res.status(500).json({ 
      error: errorMessage 
    });
  }
}
