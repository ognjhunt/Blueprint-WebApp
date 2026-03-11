import { ContactForm } from "@/components/site/ContactForm";
import { SEO } from "@/components/SEO";
import { normalizeInterestToLane } from "@/lib/contactInterest";
import { Mail, MessageSquare, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useSearch } from "wouter";

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-zinc-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid-pattern"
          width={40}
          height={40}
          x="50%"
          y={-1}
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 40V.5H40" fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill="url(#grid-pattern)" />
    </svg>
  );
}

export default function Contact() {
  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const interest = searchParams.get("interest")?.trim() ?? "";
  const buyerType = searchParams.get("buyerType")?.trim() ?? "";
  const hostedMode =
    normalizeInterestToLane(interest) === "deeper_evaluation" && buyerType === "robot_team";

  const seoTitle = hostedMode ? "Start Hosted Session | Blueprint" : "Contact Us";
  const seoDescription = hostedMode
    ? "Start a hosted robot-team evaluation session for a site-specific world model."
    : "Get in touch with Blueprint to qualify a site, scope the workflow, and plan the right next step.";

  const badgeLabel = hostedMode ? "Hosted Session Start" : "Qualification Intake";
  const heroTitle = hostedMode
    ? "Start a hosted session for this site."
    : "Tell us the site, the task, and what you need checked.";
  const heroBody = hostedMode
    ? "Confirm the site, the task, and the robot setup. Blueprint will use that to line up the next step for a hosted evaluation run."
    : "Blueprint reviews the site, task, and constraints first, then routes the right next step for qualification, exchange, preview assets, or deeper evaluation.";
  const responseTitle = hostedMode ? "Hosted session setup" : "Quick Response";
  const responseBody = hostedMode
    ? "Fill out the short form and our team will follow up within 24 hours to confirm the site, the robot setup, and the next step toward launch."
    : "Fill out the form and our team will get back to you within 24 hours to talk through the site, the qualification record, and the best next step.";
  const learnMoreLinks = hostedMode
    ? [
        { href: "/site-worlds", label: "Back to Site Worlds" },
        { href: "/for-robot-integrators", label: "For Robot Teams" },
        { href: "/how-it-works", label: "How Blueprint works" },
      ]
    : [
        { href: "/how-it-works", label: "How It Works" },
        { href: "/readiness-pack", label: "See the deliverable" },
        { href: "/for-robot-integrators", label: "For Robot Teams" },
      ];

  return (
    <>
      <SEO title={seoTitle} description={seoDescription} canonical="/contact" />
      <div className="relative min-h-screen overflow-hidden bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DotPattern />
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-12 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-indigo-600 backdrop-blur-sm">
              <MessageSquare className="h-3 w-3" />
              {badgeLabel}
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
              {heroTitle}
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-zinc-600">{heroBody}</p>
          </div>

          <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
            <div className="space-y-8">
              <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
                <ContactForm />
              </div>
            </div>

            <div className="flex flex-col justify-start space-y-6 lg:pl-8">
              <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-900">{responseTitle}</h3>
                    <p className="mt-1 text-sm text-zinc-600">{responseBody}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-900">Prefer email?</h3>
                    <a
                      href="mailto:hello@tryblueprint.io"
                      className="mt-1 inline-block text-indigo-600 transition hover:text-indigo-700 hover:underline"
                    >
                      hello@tryblueprint.io
                    </a>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-zinc-400">
                  Learn More
                </h3>
                <ul className="space-y-3">
                  {learnMoreLinks.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        className="group flex items-center gap-2 text-zinc-700 transition hover:text-indigo-600"
                      >
                        <span>{link.label}</span>
                        <span className="transition-transform group-hover:translate-x-0.5">→</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
