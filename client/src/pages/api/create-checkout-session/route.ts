import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request) {
  try {
    const body = await request.json();
    const { totalCost, hours, costPerHour } = body;

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "API_KEY";
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: "Missing Stripe Secret Key" },
        { status: 500 },
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2022-11-15",
    });

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
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || window.location.origin}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || window.location.origin}/pricing?canceled=true`,
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error("Error creating Stripe session:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
