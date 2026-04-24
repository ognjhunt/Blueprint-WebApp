import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialSectionLabel,
  MonochromeMedia,
} from "@/components/site/editorial";
import { getCaptureAppPlaceholderUrl } from "@/lib/client-env";
import { editorialRefreshAssets } from "@/lib/editorialRefreshAssets";
import { ArrowRight, BookOpen, CalendarDays, LifeBuoy, Smartphone } from "lucide-react";

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
    body:
      "Use this when the question is about one exact site, hosted evaluation, package access, or the next commercial step.",
    href: "/contact?persona=robot-team",
    icon: LifeBuoy,
  },
  {
    title: "FAQ",
    body:
      "Use this when the team still needs product definitions, trust language, and the core objections answered first.",
    href: "/faq",
    icon: BookOpen,
  },
  {
    title: "Scoping call",
    body:
      "Use this when the site is already known and the team wants to choose between package, hosted evaluation, or custom scope.",
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

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto grid max-w-[96rem] gap-px lg:grid-cols-[0.74fr_0.26fr]">
            <div className="px-8 py-10 lg:px-12 lg:py-14">
              <div className="grid gap-6 lg:grid-cols-[0.56fr_0.44fr]">
                <div>
                  <EditorialSectionLabel>Help</EditorialSectionLabel>
                  <h1 className="font-editorial mt-6 text-[5.2rem] leading-[0.86] tracking-[-0.08em] text-slate-950 sm:text-[6.6rem]">
                    Help
                  </h1>
                </div>
                <div className="flex items-center lg:justify-end">
                  <p className="max-w-[18rem] text-[2rem] leading-tight tracking-[-0.04em] text-slate-950">
                    Get the right help.
                  </p>
                </div>
              </div>
            </div>

            <MonochromeMedia
              src={editorialRefreshAssets.helpDossier}
              alt="Blueprint support materials"
              className="min-h-[18rem] rounded-none"
              loading="eager"
              imageClassName="min-h-[18rem] object-cover"
              overlayClassName="bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.02))]"
            />
          </div>
        </section>

        <section className="mx-auto max-w-[96rem] px-5 py-5 sm:px-8 lg:px-10">
          <div className="grid gap-3 lg:grid-cols-3">
            {helpPaths.map((path, index) => {
              const Icon = path.icon;
              return (
                <a key={path.title} href={path.href} className="group relative min-h-[17rem] overflow-hidden bg-slate-950">
                  <MonochromeMedia
                    src={
                      index === 2
                        ? editorialRefreshAssets.helpScopingRoom
                        : editorialRefreshAssets.helpDossier
                    }
                    alt={path.title}
                    className="h-full rounded-none"
                    imageClassName={
                      index === 0
                        ? "h-full object-cover object-left"
                        : index === 1
                          ? "h-full object-cover object-center"
                          : "h-full object-cover object-center"
                    }
                    overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.72))]"
                  />
                  <div className="absolute inset-0 flex flex-col justify-between p-5 text-white">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/25 text-white/75">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-editorial text-[2.5rem] leading-[0.95] tracking-[-0.05em]">
                        {path.title}
                      </h2>
                      <p className="mt-4 max-w-[19rem] text-sm leading-7 text-white/70">
                        {path.body}
                      </p>
                      <div className="mt-5 inline-flex items-center text-sm font-semibold text-white/85">
                        Open path
                        <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-[96rem] px-5 pb-10 sm:px-8 lg:px-10">
          <div className="grid gap-3 lg:grid-cols-[0.62fr_0.38fr]">
            <div className="grid gap-3 bg-white p-6 lg:grid-cols-[0.28fr_0.72fr] lg:p-8">
              <div className="border border-black/10 bg-[#f5f3ef] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Email support
                </p>
                <div className="mt-6 overflow-hidden border border-black/10">
                  <MonochromeMedia
                    src={editorialRefreshAssets.helpDossier}
                    alt="Buyer support note"
                    className="aspect-[3/4] rounded-none"
                    imageClassName="aspect-[3/4] object-cover object-left"
                    overlayClassName="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))]"
                  />
                </div>
              </div>
              <div className="flex flex-col justify-between">
                <div>
                  <h2 className="font-editorial text-[2.2rem] leading-[0.95] tracking-[-0.05em] text-slate-950">
                    Need a human reply?
                  </h2>
                  <p className="mt-4 max-w-[26rem] text-sm leading-7 text-slate-700">
                    Email{" "}
                    <a
                      href="mailto:hello@tryblueprint.io?subject=Blueprint%20Support"
                      className="font-semibold text-slate-950 hover:underline"
                    >
                      hello@tryblueprint.io
                    </a>{" "}
                    with the page you were on, the exact problem, and the next thing you were
                    trying to do. For commercial questions, include the listing link and the robot
                    question so the next reply can stay narrow.
                  </p>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href="/contact?persona=robot-team"
                    className="inline-flex items-center justify-center bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Open contact
                  </a>
                  <a
                    href="/book-exact-site-review"
                    className="inline-flex items-center justify-center border border-black/10 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    Book scoping call
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 p-6 text-white lg:p-8">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/75">
                <Smartphone className="h-5 w-5" />
              </div>
              <p className="mt-6 text-[11px] uppercase tracking-[0.18em] text-white/45">
                For capture teams
              </p>
              <h2 className="font-editorial mt-4 text-[2.4rem] leading-[0.94] tracking-[-0.05em]">
                Handoff to Blueprint Capture.
              </h2>
	                  <p className="mt-4 text-sm leading-7 text-white/70">
	                The capture app is not the primary buyer route. It is the public handoff
	                for capturers who want to record everyday public-facing locations, follow privacy rules, and submit captures for review.
	              </p>
              <div className="mt-8 grid gap-2 text-sm text-white/75">
                {["Capture", "Package", "Upload", "Blueprint review"].map((item) => (
                  <div key={item} className="flex items-center justify-between border border-white/10 px-4 py-3">
                    <span>{item}</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                ))}
              </div>
              <a
                href={captureAppHref}
                target={captureAppIsExternal ? "_blank" : undefined}
                rel={captureAppIsExternal ? "noreferrer noopener" : undefined}
                className="mt-8 inline-flex items-center justify-center bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Open capture app
              </a>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[96rem] px-5 pb-10 sm:px-8 lg:px-10">
          <EditorialCtaBand
	            eyebrow="Decision"
	            title="Start with the path that matches the question."
	            description="The public site routes the buyer to the next useful step without turning support into a handbook."
	            imageSrc={editorialRefreshAssets.helpScopingRoom}
            imageAlt="Blueprint scoping room"
            primaryHref="/contact?persona=robot-team"
            primaryLabel="Open contact"
            secondaryHref="/faq"
            secondaryLabel="Read FAQ"
          />
        </section>
      </div>
    </>
  );
}
