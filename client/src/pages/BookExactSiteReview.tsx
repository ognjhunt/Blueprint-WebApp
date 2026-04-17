import { SEO } from "@/components/SEO";
import {
  exactSiteScopingCallChecklist,
  exactSiteScopingCallUrl,
} from "@/lib/booking";

export default function BookExactSiteReview() {
  return (
    <>
      <SEO
        title="Book Exact-Site Review Call | Blueprint"
        description="Book a Blueprint scoping call for exact-site world-model work, hosted evaluation, and site-package review."
        canonical="/book-exact-site-review"
      />
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Scheduling
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Book an exact-site scoping call.
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
                This is the fastest path when your team already has a real facility or listing in
                mind and wants to confirm whether Blueprint package access, hosted evaluation, or a
                custom path makes the most sense.
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
              </div>
            </div>

            <section className="rounded-3xl border border-slate-200 bg-stone-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Bring this to the call
              </p>
              <ul className="mt-4 space-y-3">
                {exactSiteScopingCallChecklist.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                The scheduling path is for scoping and buyer fit. It is not a customer testimonial,
                a deployment promise, or a claim that every listed site is already commercially
                cleared.
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
