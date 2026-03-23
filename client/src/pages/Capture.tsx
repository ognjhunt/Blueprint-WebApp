import { SEO } from "@/components/SEO";
import { ArrowRight, Camera, DollarSign, Smartphone, Upload } from "lucide-react";

const steps = [
  {
    title: "Open the app",
    body:
      "Capturers use the mobile app, not the buyer-facing website. That is where tasks, guidelines, and upload status live.",
    icon: Smartphone,
  },
  {
    title: "Record one clear walkthrough",
    body:
      "Walk the indoor space with steady coverage. Blueprint reviews whether the capture is usable before it becomes part of the pipeline.",
    icon: Camera,
  },
  {
    title: "Upload and wait for review",
    body:
      "Payout depends on coverage, device quality, and whether the walkthrough is usable downstream.",
    icon: Upload,
  },
];

const whoItsFor = [
  "People recording indoor spaces with a supported device.",
  "Capturers who need the app handoff and basic expectations.",
  "Anyone who landed on the site looking for capture instructions instead of buyer information.",
];

export default function Capture() {
  return (
    <>
      <SEO
        title="Capture Basics | Blueprint"
        description="A short explainer for Blueprint capturers and the mobile app handoff."
        canonical="/capture"
        noIndex={true}
      />

      <div className="min-h-screen bg-white">
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                  <DollarSign className="h-3 w-3" />
                  For Capturers
                </p>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  Capture is a short path to the mobile app.
                </h1>
                <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                  This page only exists to explain the basics and send capturers to the app. The
                  main Blueprint site is for robot teams buying access to real sites.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <a
                    href="/capture-app"
                    className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Open capture app
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href="mailto:hello@tryblueprint.io?subject=Blueprint%20Capture%20Support"
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    Email support
                  </a>
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-6">
                <p className="text-sm font-semibold text-slate-900">Who this is for</p>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                  {whoItsFor.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Process
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Three steps are enough.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((item) => {
              const Icon = item.icon;

              return (
                <article key={item.title} className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6">
                  <Icon className="h-5 w-5 text-slate-700" />
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white">
            <h2 className="text-2xl font-semibold tracking-tight">
              Looking for the buyer side instead?
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Robot teams should start with the world-model catalog and request flow, not the
              capture pages.
            </p>
            <a
              href="/world-models"
              className="mt-6 inline-flex items-center text-sm font-semibold text-white"
            >
              Browse world models
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
