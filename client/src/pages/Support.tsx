import { SEO } from "@/components/SEO";
import { getCaptureAppPlaceholderUrl } from "@/lib/client-env";
import { BookOpen, CalendarDays, LifeBuoy, Smartphone } from "lucide-react";

function isExternalHref(value: string) {
  try {
    const url = new URL(value, "https://tryblueprint.io");
    return url.origin !== "https://tryblueprint.io";
  } catch {
    return false;
  }
}

const helpPaths = [
  {
    title: "Buyer questions",
    body: "Use this when the question is about one exact site, hosted evaluation, package access, or the right next commercial step.",
    href: "/contact?persona=robot-team",
    icon: LifeBuoy,
  },
  {
    title: "FAQ and product reference",
    body: "Use this when your team is still answering product questions and wants straightforward definitions, trust language, and common objections first.",
    href: "/faq",
    icon: BookOpen,
  },
  {
    title: "Scoping call",
    body: "Use this when the site is already known and your team wants to confirm whether to start with the package path, hosted evaluation, or a custom scope.",
    href: "/book-exact-site-review",
    icon: CalendarDays,
  },
];

export default function Support() {
  const captureAppHref = getCaptureAppPlaceholderUrl();
  const captureAppIsExternal = isExternalHref(captureAppHref);

  return (
    <>
      <SEO
        title="Support | Blueprint"
        description="Get help with Blueprint's buyer path, hosted evaluation, package questions, and capture-app handoff."
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
              Buyer support should route you to the next useful path quickly. Use contact for
              site-specific package or hosted-evaluation questions, use booking when the exact site
              is already known, and use the capture app path only for capturer-side handoff issues.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {helpPaths.map((path) => {
              const Icon = path.icon;
              return (
                <a
                  key={path.title}
                  href={path.href}
                  className="rounded-[1.6rem] border border-slate-200 bg-white p-6 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-slate-950">{path.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{path.body}</p>
                </a>
              );
            })}
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_0.95fr]">
            <section className="rounded-[1.8rem] border border-slate-200 bg-white p-6">
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
                do. If the issue is commercial, include the site or listing link and the robot
                question so the next reply can stay narrow.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href="/contact?persona=robot-team"
                  className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Open contact
                </a>
                <a
                  href="/book-exact-site-review"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  Book scoping call
                </a>
              </div>
            </section>

            <section className="rounded-[1.8rem] border border-slate-200 bg-slate-950 p-6 text-white">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-slate-300">
                <Smartphone className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-white">Capture-side handoff</h2>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                The capture app is not the primary buyer route. It is the current public handoff for
                Blueprint Capture and invite-gated capturer access.
              </p>
              <a
                href={captureAppHref}
                target={captureAppIsExternal ? "_blank" : undefined}
                rel={captureAppIsExternal ? "noreferrer noopener" : undefined}
                className="mt-5 inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Open Capture App
              </a>
            </section>
          </div>
        </section>
      </div>
    </>
  );
}
