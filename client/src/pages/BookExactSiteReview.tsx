import { SEO } from "@/components/SEO";
import {
  exactSiteScopingCallChecklist,
  exactSiteScopingCallUrl,
} from "@/lib/booking";
import { ArrowRight, CalendarDays, CheckCircle2, FileText, Workflow } from "lucide-react";

const scopingOutcomes = [
  "Whether the first step should be hosted evaluation, package access, or a custom program",
  "Which exact site, workflow lane, and trust questions actually matter before travel",
  "What your team needs to provide next if the request moves forward",
];

const comparePaths = [
  {
    title: "Book the call",
    body: "Best when the site is already known and your team wants a fast human scoping pass.",
  },
  {
    title: "Send a written brief",
    body: "Best when you want to attach a listing, robot notes, or workflow context before the conversation.",
  },
  {
    title: "Inspect the sample first",
    body: "Best when your team is still validating whether Blueprint's proof style matches the kind of exact-site review you need.",
  },
];

export default function BookExactSiteReview() {
  return (
    <>
      <SEO
        title="Book Exact-Site Review Call | Blueprint"
        description="Book a Blueprint scoping call for exact-site world-model work, hosted evaluation, and site-package review."
        canonical="/book-exact-site-review"
      />
      <div className="min-h-screen bg-stone-50 text-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Scheduling
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Book an exact-site scoping call.
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
                Use this path when your team already has a real facility or listing in mind and
                wants to confirm whether Blueprint package access, hosted evaluation, or a custom
                scope makes the most sense.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={exactSiteScopingCallUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Open scheduling
                </a>
                <a
                  href="/contact?persona=robot-team&interest=evaluation-package"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  Send a written brief instead
                </a>
                <a
                  href="/world-models/siteworld-f5fd54898cfb"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-stone-100 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-stone-200"
                >
                  Inspect sample listing
                </a>
              </div>
            </div>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_-50px_rgba(15,23,42,0.45)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Bring this to the call
              </p>
              <ul className="mt-4 space-y-3">
                {exactSiteScopingCallChecklist.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                The call is for scoping and buyer fit. It is not a testimonial, a deployment
                promise, or a claim that every public listing is already commercially cleared.
              </div>
            </section>
          </div>

          <section className="mt-10 grid gap-4 lg:grid-cols-3">
            {comparePaths.map((item) => (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-xl font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              </article>
            ))}
          </section>

          <section className="mt-10 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <article className="rounded-[2rem] border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                  <Workflow className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    What happens in the call
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">A narrow scoping pass on one real site.</h2>
                </div>
              </div>
              <div className="mt-5 space-y-3 text-sm leading-7 text-slate-700">
                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  1. Confirm the exact facility or listing and the workflow lane that matters.
                </p>
                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  2. Clarify whether your team needs the package, the Blueprint-run hosted path, or
                  a request-scoped commercial review.
                </p>
                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  3. Leave with the next step that matches the question instead of restarting
                  discovery from scratch.
                </p>
              </div>
            </article>

            <article className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-800 p-3 text-slate-300">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Typical outcomes
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold">What a good scoping call resolves.</h2>
                </div>
              </div>
              <ul className="mt-5 space-y-3">
                {scopingOutcomes.map((item) => (
                  <li key={item} className="rounded-2xl border border-slate-800 bg-slate-900/90 px-4 py-4 text-sm leading-7 text-slate-300">
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className="mt-10 rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8">
            <div className="grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Need a paper trail first?
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                  Send the written brief before or after the call.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                  Some teams want the conversation first. Others want to attach a listing, robot
                  notes, rights questions, and workflow context before anyone talks. Both are valid.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white p-3 text-slate-700 shadow-sm">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Written brief path</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Better when you need to preserve the exact site, robot setup, and trust notes in writing.
                    </p>
                  </div>
                </div>
                <a
                  href="/contact?persona=robot-team&interest=evaluation-package"
                  className="mt-5 inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Open the contact path
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
