import { SEO } from "@/components/SEO";
import { publicCaptureGeneratedAssets } from "@/lib/publicCaptureGeneratedAssets";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Glasses,
  Info,
  MapPinned,
  ShieldCheck,
  Smartphone,
  WalletCards,
} from "lucide-react";

const captureMethods = [
  {
    title: "360 camera",
    label: "Complete coverage",
    body: "Best for full walkthroughs, aisles, rooms, and spatial context when an assignment calls for it.",
    icon: Camera,
  },
  {
    title: "Phone",
    label: "Flexible capture",
    body: "Useful for stable, well-lit walkthroughs and bounded task areas with an approved route brief.",
    icon: Smartphone,
  },
  {
    title: "Smart glasses",
    label: "Supplemental POV",
    body: "Hands-free point-of-view context for assignments that explicitly accept wearable capture.",
    icon: Glasses,
  },
] as const;

const assignmentSteps = [
  {
    number: "01",
    title: "Apply",
    body: "Tell us your city, capture devices, availability, and experience. An application is a request for review, not an assignment.",
  },
  {
    number: "02",
    title: "Get reviewed",
    body: "Blueprint reviews city coverage, cohort capacity, privacy fit, and device readiness before approving capturer access.",
  },
  {
    number: "03",
    title: "Accept a real assignment",
    body: "Approved capturers receive the exact route, access boundary, accepted device, QA requirements, timing, and payout offer before work begins.",
  },
  {
    number: "04",
    title: "Capture, upload, and pass QA",
    body: "Payment eligibility follows the assigned route, upload completion, and QA approval. Application or upload alone does not guarantee payout.",
  },
] as const;

const assignmentIncludes = [
  "A named site or lawful public-area route",
  "The approved access and privacy boundary",
  "Accepted device and capture instructions",
  "QA criteria, timing, and payout offer",
] as const;

const safetyRules = [
  "Capture only the public-facing or operator-approved route in the assignment.",
  "Avoid people, private records, screens, payment terminals, employee-only areas, and restricted zones.",
  "Stop if a manager, employee, resident, or security staff member asks you to stop.",
  "Upload only the assigned route. Extra areas can fail QA even when the media quality is good.",
  "Do not begin work until the assignment names the route, device, privacy rules, QA criteria, and payout offer.",
] as const;

const applicationHref = "/signup/capturer?source=capture";
const cityStatusHref = "/capture-app/launch-access?role=capturer&source=capture";

export default function Capture() {
  return (
    <>
      <SEO
        title="Become a Capturer | Blueprint"
        description="Apply to capture approved real-site routes for Blueprint robot evaluation packages. Review city status, accepted methods, assignment boundaries, safety, QA, and payout eligibility."
        canonical="/capture"
        jsonLd={[
          webPageJsonLd({
            path: "/capture",
            name: "Become a Blueprint Capturer",
            description:
              "A public application path for review-based real-site capture assignments, accepted capture methods, city status, safety, QA, and payout boundaries.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Become a capturer", path: "/capture" },
          ]),
        ]}
      />

      <div className="bg-slate-50 text-slate-950">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-10 lg:py-14">
            <div className="flex flex-col justify-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Blueprint capture network
              </p>
              <h1 className="font-editorial mt-5 max-w-[12ch] text-5xl leading-none text-slate-950 sm:text-6xl">
                Capture real sites for robot evaluation.
              </h1>
              <p className="mt-5 max-w-2xl text-xl font-semibold leading-tight text-slate-950 sm:text-2xl">
                Apply for review, receive a real assignment, and get paid after the assigned route passes QA.
              </p>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700">
                Blueprint publishes assignments only after review. Site availability, access,
                assignment, and payout are confirmed for each approved route before capture begins.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={applicationHref}
                  className="inline-flex min-h-11 items-center justify-center border border-slate-950 bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Apply to capture
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a
                  href={cityStatusHref}
                  className="inline-flex min-h-11 items-center justify-center border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-950 transition hover:border-slate-500"
                >
                  Check city status
                </a>
              </div>
            </div>

            <div className="relative min-h-[28rem] overflow-hidden border border-slate-200 bg-slate-900">
              <img
                src={publicCaptureGeneratedAssets.captureAppHero}
                alt="Capturer following an approved indoor route"
                className="absolute inset-0 h-full w-full object-cover grayscale"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  Assignment boundary
                </p>
                <p className="mt-3 max-w-xl text-lg font-semibold leading-7">
                  The route, access rules, device, QA criteria, and payout offer arrive together.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-950 text-white">
          <div className="mx-auto max-w-[88rem] px-4 py-10 sm:px-6 lg:px-10">
            <div className="grid gap-5 lg:grid-cols-[0.34fr_0.66fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  Accepted methods
                </p>
                <h2 className="mt-3 text-3xl font-semibold leading-tight">
                  Use the device named in the assignment.
                </h2>
                <p className="mt-4 text-sm leading-7 text-white/70">
                  Device eligibility is route-specific. Owning a device does not imply approval or an open assignment.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {captureMethods.map((method) => {
                  const Icon = method.icon;
                  return (
                    <article key={method.title} className="border border-white/15 bg-white/5 p-5">
                      <div className="flex h-10 w-10 items-center justify-center border border-white/15 text-emerald-200">
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
                        {method.label}
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold">{method.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-white/70">{method.body}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[88rem] px-4 py-10 sm:px-6 lg:px-10">
            <div className="grid gap-8 lg:grid-cols-[0.38fr_0.62fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  How assignments work
                </p>
                <h2 className="mt-3 text-4xl font-semibold leading-tight text-slate-950">
                  Review first. Assignment second. Payout after QA.
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  Public application is open; operational availability remains tied to real city and site records.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {assignmentSteps.map((step) => (
                  <article key={step.number} className="border border-slate-200 bg-slate-50 p-5">
                    <p className="text-xs font-semibold tracking-[0.18em] text-emerald-700">{step.number}</p>
                    <h3 className="mt-3 text-2xl font-semibold text-slate-950">{step.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{step.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-100">
          <div className="mx-auto grid max-w-[88rem] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:px-10">
            <article className="border border-slate-200 bg-white p-6">
              <div className="flex h-11 w-11 items-center justify-center bg-slate-950 text-white">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-3xl font-semibold text-slate-950">
                Every approved assignment includes
              </h2>
              <div className="mt-5 grid gap-3">
                {assignmentIncludes.map((item) => (
                  <div key={item} className="flex gap-3 border-t border-slate-200 pt-3 first:border-t-0 first:pt-0">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <p className="text-sm leading-6 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="border border-slate-200 bg-white p-6">
              <div className="flex h-11 w-11 items-center justify-center bg-emerald-600 text-white">
                <WalletCards className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-3xl font-semibold text-slate-950">
                No public payout promises
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Payout depends on the real assignment, accepted device, access complexity, route completion, and QA result. The offer is shown before you accept work.
              </p>
              <div className="mt-5 flex gap-3 border border-amber-200 bg-amber-50 p-4">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <p className="text-sm leading-6 text-amber-950">
                  Application approval, assignment, capture acceptance, and payout are separate states backed by their owning records.
                </p>
              </div>
            </article>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.42fr_0.58fr] lg:px-10">
            <div>
              <div className="flex h-11 w-11 items-center justify-center bg-emerald-600 text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-3xl font-semibold text-slate-950">Safety and QA rules</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                These rules protect the site, people inside it, and the provenance of the resulting package.
              </p>
            </div>

            <div className="grid gap-3">
              {safetyRules.map((rule) => (
                <div key={rule} className="flex gap-3 border border-slate-200 bg-slate-50 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <p className="text-sm leading-6 text-slate-700">{rule}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-950 text-white">
          <div className="mx-auto grid max-w-[88rem] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                Start with your city
              </p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight">
                Apply for review or leave a city signal.
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
                If no public capture market is open in your city, the launch-access path records demand without inventing an assignment.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <a
                href={applicationHref}
                className="inline-flex min-h-12 items-center justify-center bg-white px-6 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Apply to capture
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a
                href={cityStatusHref}
                className="inline-flex min-h-12 items-center justify-center border border-white/30 px-6 text-sm font-semibold text-white transition hover:border-white"
              >
                <MapPinned className="mr-2 h-4 w-4" />
                Check city status
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
