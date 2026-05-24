// src/content/pilotCopy.ts
export type FAQ = { q: string; a: string };

export const PILOT_FAQ: FAQ[] = [
  {
    q: "What is Blueprint in one sentence?",
    a: "Blueprint turns real-site walkthroughs into proof-backed hosted review and guidance experiences for physical spaces; smart-glasses demos are request-scoped, not default site access.",
  },
  {
    q: "What does the pilot cost?",
    a: "Pilot scope is reviewed per request. If approved, the request packet defines capture, hosted review, and any demo window before work starts.",
  },
  {
    q: "How long does mapping take?",
    a: "Most venues under 5,000 sq ft take 30–60 minutes; larger venues 1–2 hours. It’s quiet and won’t disrupt your operations.",
  },
  {
    q: "Do customers need special hardware?",
    a: "Phones are the default. Google/Meta smart glasses are used only for approved repeat walkthroughs when the assignment, hardware, launch proof, and downstream capture proof exist.",
  },
  {
    q: "What do you need from us?",
    a: "Access for mapping, some basic business info, and your feedback after demo day. We handle the rest, including design, setup, and analytics.",
  },
  {
    q: "Is the AR experience live for more than a day?",
    a: "Hosted review and any smart-glasses demo window are confirmed per request after proof review; neither is guaranteed from mapping alone.",
  },
  {
    q: "What happens after the pilot?",
    a: "We'll send a survey to everyone who joined the demo day. Feedback helps us improve Blueprint and decide what level of follow-on access to offer next.",
  },
];

export const SUPPORT = {
  email: "nijel@tryblueprint.io",
  hours: "Monday - Friday: 9AM - 6PM EST",
  calendly: "https://calendly.com/blueprintai/30min",
  reschedulePolicy:
    "You can reschedule up to 24 hours before your mapping appointment.",
  mappingTimeNote:
    "Most venues <5,000 sq ft take 30–60 minutes; larger venues 1–2 hours.",
  demoWindowNote:
    "Hosted-review or smart-glasses demo windows are scheduled per approved request.",
};
