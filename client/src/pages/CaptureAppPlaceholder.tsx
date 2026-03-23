import { SEO } from "@/components/SEO";
import { getCaptureAppPlaceholderUrl } from "@/lib/client-env";
import { ArrowRight, Download, ExternalLink, QrCode, ShieldCheck, Smartphone, Wallet } from "lucide-react";

const steps = [
  "Open the app and confirm the capture guidelines for the site.",
  "Record one clear walkthrough with the device you actually plan to use.",
  "Upload the session so Blueprint can review coverage and quality before payout.",
];

const basics = [
  "Capturers use the app, not the web portal.",
  "Payout depends on coverage, device quality, and whether the walkthrough is usable.",
  "If you are a robot team or site operator, this page is not your main entry point.",
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
        description="Download the Blueprint capture app, see how mobile capture works, and understand what happens after a walkthrough is uploaded."
        canonical="/capture-app"
        noIndex={true}
      />

      <div className="min-h-screen bg-stone-50 text-slate-900">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Capture App
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                This is the mobile handoff for people capturing real sites.
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                The web product is for robot teams and site operators. Capturers use the mobile
                app to record walkthroughs, upload sessions, and track payout status.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {showExternalHandoff ? (
                  <a
                    href={captureAppUrl}
                    className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Open app handoff
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                ) : (
                  <a
                    href="/contact?interest=capture-app-beta"
                    className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Join the capture beta
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                )}
                <a
                  href="/capture"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  Read capture basics
                </a>
              </div>

              <div className="mt-10 rounded-[2rem] border border-slate-200 bg-white p-6">
                <p className="text-sm font-semibold text-slate-900">What to expect</p>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                  {steps.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <aside className="space-y-4">
              <section className="rounded-[2rem] border border-slate-200 bg-white p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Mobile-first flow</p>
                    <p className="text-sm text-slate-600">Use the app for capture, upload, and payout tracking.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl bg-stone-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Download
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {showExternalHandoff
                        ? "This workspace has a real app handoff configured, so the button above opens it directly."
                        : "The public mobile build is not linked yet. This page stays live as the beta handoff and support reference until the app link is ready."}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-stone-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Support
                    </p>
                    <a href="mailto:hello@tryblueprint.io" className="mt-2 inline-flex text-sm font-semibold text-slate-900">
                      hello@tryblueprint.io
                    </a>
                  </div>
                </div>
              </section>

              <section className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white">
                <p className="text-sm font-semibold">Who this page is for</p>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                  {basics.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-[2rem] border border-slate-200 bg-white p-6">
                <div className="flex items-center gap-3">
                  <Download className="h-5 w-5 text-slate-700" />
                  <Wallet className="h-5 w-5 text-slate-700" />
                  <QrCode className="h-5 w-5 text-slate-700" />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-900">Need the buyer side instead?</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Robot teams should start with the catalog. Site operators should start with the
                  facility page and governance notes.
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  <a href="/world-models" className="inline-flex items-center text-sm font-semibold text-slate-900">
                    Browse world models
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a href="/for-site-operators" className="inline-flex items-center text-sm font-semibold text-slate-900">
                    For site operators
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
