// src/content/pilotCopy.ts
export type FAQ = { q: string; a: string };

export const PILOT_FAQ: FAQ[] = [
  {
    q: "What is Blueprint in one sentence?",
    a: "It’s a custom AR layer for your physical space—scan a QR code, and visitors instantly get interactive guidance, stories, and offers on their device.",
  },
  {
    q: "What does the pilot cost?",
    a: "Nothing. The two-visit pilot (~10 days) is free and feedback-only. No contract, and there’s no purchase option yet.",
  },
  {
    q: "How long does mapping take?",
    a: "Most venues under 5,000 sq ft take 30–60 minutes; larger venues 1–2 hours. It’s quiet and won’t disrupt your operations.",
  },
  {
    q: "Do customers need special hardware?",
    a: "No. The AR runs in the browser via QR codes. For demo day, we bring a VR headset so your team can try it hands-on.",
  },
  {
    q: "What do you need from us?",
    a: "Access for mapping, some basic business info, and your feedback after demo day. We handle the rest—design, setup, and analytics.",
  },
  {
    q: "Is the AR experience live for two weeks?",
    a: "No. The experience is live during the scheduled demo window (1–2 hours) on Visit 2. The goal is to gather feedback and learn, not to run the experience continuously yet.",
  },
  {
    q: "What happens after the pilot?",
    a: "We'll send a survey to all Demo Day participants about the Pilot Program. Feedback helps us improve Blueprint. As of today, there’s no option to continue with a full implementation yet.",
  },
];

export const SUPPORT = {
  email: "nijel@tryblueprint.io",
  hours: "Monday - Friday: 9AM - 6PM EST",
  calendly: "https://calendly.com/blueprintar/30min",
  reschedulePolicy:
    "You can reschedule up to 24 hours before your mapping appointment.",
  mappingTimeNote:
    "Most venues <5,000 sq ft take 30–60 minutes; larger venues 1–2 hours.",
  demoWindowNote:
    "The AR experience is live during the scheduled Demo Day window (1–2 hours) on Visit 2.",
};
