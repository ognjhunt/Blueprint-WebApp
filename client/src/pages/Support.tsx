import { SEO } from "@/components/SEO";
import { getCaptureAppPlaceholderUrl } from "@/lib/client-env";
import { BookOpen, LifeBuoy, Smartphone } from "lucide-react";

function isExternalHref(value: string) {
  try {
    const url = new URL(value, "https://tryblueprint.io");
    return url.origin !== "https://tryblueprint.io";
  } catch {
    return false;
  }
}

export default function Support() {
  const captureAppHref = getCaptureAppPlaceholderUrl();
  const captureAppIsExternal = isExternalHref(captureAppHref);

  return (
    <>
      <SEO
        title="Support | Blueprint"
        description="Get help with Blueprint's capture app handoff, buyer questions, and public support resources."
        canonical="/help"
      />

      <div className="min-h-screen bg-stone-50 text-slate-900">
        <section className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.08),_transparent_42%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.98))]">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Support
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Get the right help without hunting for it.
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
              Use support for straightforward product questions and capture-app handoff issues. Use
              contact when your team needs a package, hosted evaluation, or a site-specific
              commercial next step.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            <a
              href="/faq"
              className="rounded-[1.6rem] border border-slate-200 bg-white p-6 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <BookOpen className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-950">Read the FAQ</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Start here for common buyer, hosted-evaluation, and capture questions.
              </p>
            </a>

            <a
              href="/contact?persona=robot-team"
              className="rounded-[1.6rem] border border-slate-200 bg-white p-6 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <LifeBuoy className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-950">Contact Blueprint</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Use the short contact path when the question is about one exact site, hosted
                evaluation, or package access.
              </p>
            </a>

            <a
              href={captureAppHref}
              target={captureAppIsExternal ? "_blank" : undefined}
              rel={captureAppIsExternal ? "noreferrer noopener" : undefined}
              className="rounded-[1.6rem] border border-slate-200 bg-white p-6 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Smartphone className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-950">Open Capture App</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Launch the current public handoff for Blueprint Capture and invite-gated capturer
                access.
              </p>
            </a>
          </div>

          <div className="mt-8 rounded-[1.8rem] border border-slate-200 bg-white p-6">
            <p className="text-sm font-semibold text-slate-950">Need a human reply?</p>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Email{" "}
              <a
                className="font-semibold text-slate-900 hover:underline"
                href="mailto:hello@tryblueprint.io?subject=Blueprint%20Support"
              >
                hello@tryblueprint.io
              </a>{" "}
              with the page you were on, the exact problem, and the next thing you were trying to
              do.
            </p>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              For commercial requests, the faster path is usually{" "}
              <a className="font-semibold text-slate-900 hover:underline" href="/contact?persona=robot-team">
                the contact form
              </a>
              .
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
