import { ContactForm } from "@/components/site/ContactForm";
import { SEO } from "@/components/SEO";
import { parseContactRequestPrefill } from "@/lib/contactRequestPrefill";
import { wamPolicyEvalAssets } from "@/lib/editorialGeneratedAssets";
import { ArrowRight, Bot, CheckCircle2, MapPin } from "lucide-react";
import { useMemo } from "react";
import { useLocation, useSearch } from "wouter";

type ContactPersona = "robot_team" | "site_operator";

function personaFromPrefill(params: {
  location: string;
  prefill: ReturnType<typeof parseContactRequestPrefill>;
}): ContactPersona {
  if (params.location === "/contact/site-operator") return "site_operator";
  if (params.prefill.buyerType === "site_operator") return "site_operator";
  return "robot_team";
}

function PersonaSwitch({ activePersona }: { activePersona: ContactPersona }) {
  const links = [
    {
      persona: "robot_team" as const,
      href: "/contact/robot-team#contact-intake",
      title: "Robot team",
      body: "Compare policies.",
      Icon: Bot,
    },
    {
      persona: "site_operator" as const,
      href: "/contact/site-operator#contact-intake",
      title: "Site owner",
      body: "Supply or monitor.",
      Icon: MapPin,
    },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2" aria-label="Choose contact path">
      {links.map(({ persona, href, title, body, Icon }) => {
        const active = activePersona === persona;
        return (
          <a
            key={persona}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[4.25rem] items-center justify-between gap-4 rounded-lg border px-4 py-3 text-sm transition ${
              active
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-200 bg-white text-slate-950 hover:bg-slate-50"
            }`}
          >
            <span>
              <span className="block font-semibold">{title}</span>
              <span className={`mt-1 block text-xs ${active ? "text-white/75" : "text-slate-500"}`}>
                {body}
              </span>
            </span>
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          </a>
        );
      })}
    </div>
  );
}

export default function Contact() {
  const search = useSearch();
  const [location] = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const prefill = useMemo(
    () => parseContactRequestPrefill(searchParams, location),
    [location, searchParams],
  );
  const persona = personaFromPrefill({ location, prefill });
  const isSiteOperator = persona === "site_operator";
  const isImprovement =
    persona === "robot_team" && prefill.requestPath === "data-package";

  const headline = isSiteOperator
    ? "Share a place for policy comparison."
    : isImprovement
      ? "Improve a policy."
      : "Tell us what policies to compare.";
  const subhead = isSiteOperator
    ? "Start a $5,000/site supply review or scope yearly monitoring for repeated policy-update and vendor-comparison checks. You control access."
    : isImprovement
      ? "Start with the failures worth fixing."
      : "We will recommend the right subscription, quick-look, or site-ops comparison path.";

  const steps = isSiteOperator
    ? ["Place", "Boundary", "Policy use"]
    : ["Task", "Policy set", "Episodes"];

  return (
    <>
      <SEO
        title={
          isSiteOperator
            ? "Submit a Site | Blueprint"
            : isImprovement
              ? "Policy Improvement Request | Blueprint"
              : "Start a Policy Evaluation | Blueprint"
        }
        description={
          isSiteOperator
            ? "Submit a site for Blueprint robot evaluation review."
            : "Start a Blueprint policy evaluation request for captured real-site tasks."
        }
        canonical={isSiteOperator ? "/contact/site-operator" : "/contact/robot-team"}
        image={`https://tryblueprint.io${wamPolicyEvalAssets.siteTask}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: headline,
          description: subhead,
          url: isSiteOperator
            ? "https://tryblueprint.io/contact/site-operator"
            : "https://tryblueprint.io/contact/robot-team",
        }}
      />

      <main className="bg-white text-slate-950">
        <section className="border-b border-slate-200">
          <div className="mx-auto grid max-w-[88rem] gap-10 px-5 py-12 md:grid-cols-[0.78fr_1.22fr] md:items-center md:px-8 md:py-16">
            <div>
              <h1 className="max-w-[11ch] text-5xl font-semibold leading-[0.95] tracking-normal sm:text-6xl">
                {headline}
              </h1>
              <p className="mt-5 max-w-md text-lg leading-8 text-slate-600">
                {subhead}
              </p>
              <div className="mt-8 max-w-lg">
                <PersonaSwitch activePersona={persona} />
              </div>
            </div>
            <img
              src={wamPolicyEvalAssets.siteTask}
              alt="Realistic humanoid robot working inside a captured task site"
              className="aspect-[16/9] w-full rounded-lg border border-slate-200 object-cover"
            />
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-[88rem] gap-3 px-5 py-6 sm:grid-cols-3 md:px-8">
            {steps.map((step) => (
              <div key={step} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
                <CheckCircle2 className="h-5 w-5 text-blue-600" aria-hidden="true" />
                <span className="text-sm font-semibold">{step}</span>
              </div>
            ))}
          </div>
        </section>

        <section
          id="contact-intake"
          className="mx-auto grid max-w-[88rem] scroll-mt-8 gap-6 px-5 py-10 lg:grid-cols-[minmax(0,0.68fr)_minmax(18rem,0.32fr)] md:px-8"
        >
          <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 lg:p-8">
            <div className="mb-6 border-b border-slate-200 pb-5">
              <h2 className="text-3xl font-semibold">
                {isSiteOperator ? "Send the site." : "Send the request."}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Keep it short. We will ask for missing details.
              </p>
            </div>
            <ContactForm />
          </div>

          <aside className="rounded-lg border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-2xl font-semibold">Next</h2>
            <div className="mt-4 grid gap-3 text-sm font-semibold">
              {(isSiteOperator
                ? ["We review the place.", "You approve access.", "Robot-team use stays scoped."]
                : ["We check the task.", "We scope the comparison.", "You get a priced run plan."]
              ).map((item, index) => (
                <div key={item} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs text-white">
                    {index + 1}
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-6 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
              Request only. Access, pricing, rights, and execution are confirmed
              per scope.
            </p>
            <a
              href="#contact-intake"
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Start
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </aside>
        </section>
      </main>
    </>
  );
}
