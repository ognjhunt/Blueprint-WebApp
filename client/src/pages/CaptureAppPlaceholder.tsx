import { SEO } from "@/components/SEO";
import { getCaptureAppPlaceholderUrl } from "@/lib/client-env";
import { ArrowRight, ExternalLink, Mail, Smartphone } from "lucide-react";

const steps = [
  "Open the app and confirm the capture instructions for the site.",
  "Record one usable walkthrough with the device you actually plan to use.",
  "Upload the session so Blueprint can review quality and coverage.",
];

const hasExternalAppLink = (value: string) => {
  try {
    const url = new URL(value, "https://tryblueprint.io");
    return url.origin !== "https://tryblueprint.io" || url.pathname !== "/capture-app";
  } catch {
    return false;
  }
};

export default function CaptureAppPlaceholder() {
  const captureAppUrl = getCaptureAppPlaceholderUrl();
  const showExternalHandoff = hasExternalAppLink(captureAppUrl);

  return (
    <>
      <SEO
        title="Capture App | Blueprint"
        description="Open the Blueprint capture app or request capture access."
        canonical="/capture-app"
        noIndex={true}
      />

      <div className="min-h-screen bg-stone-50 text-slate-900">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <Smartphone className="h-4 w-4" />
              Capture App
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Open the capture app.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              This is the public handoff for people recording indoor spaces for Blueprint. If
              you are here to buy world models, go to the catalog instead.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {showExternalHandoff ? (
                <a
                  href={captureAppUrl}
                  className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Open capture app
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              ) : (
                <a
                  href="mailto:hello@tryblueprint.io?subject=Blueprint%20Capture%20App%20Access"
                  className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Request capture access
                  <Mail className="ml-2 h-4 w-4" />
                </a>
              )}
              <a
                href="/capture"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Read capture basics
              </a>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6">
              <p className="text-sm font-semibold text-slate-900">What to expect</p>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                {steps.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white">
              <p className="text-sm font-semibold">Need the buyer side instead?</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                The main website is for robot teams reviewing site-specific world models and
                requesting hosted evaluations.
              </p>
              <a href="/world-models" className="mt-5 inline-flex items-center text-sm font-semibold text-white">
                Browse world models
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
