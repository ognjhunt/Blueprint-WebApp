import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialSectionLabel,
  MonochromeMedia,
} from "@/components/site/editorial";
import { publicCaptureGeneratedAssets } from "@/lib/publicCaptureGeneratedAssets";
import { usePublicLaunchStatus } from "@/hooks/usePublicLaunchStatus";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
import { ArrowRight, DollarSign } from "lucide-react";

const processRows = [
  {
    step: "01",
    label: "Assignment",
    title: "Accept a reviewed assignment",
    body:
      "Apply for access, enter the city or invite gate, and only start work when an approved capture assignment is visible with the payout shown before you start.",
  },
  {
    step: "02",
    label: "Walkthrough",
    title: "Walk one public-facing route",
    body:
      "Follow app guidance through a lawful public-facing route, avoid private or sensitive areas, and upload one complete walkthrough for review.",
  },
  {
    step: "03",
    label: "Review",
    title: "Accepted capture or redo",
    body:
      "Blueprint reviews coverage, privacy fit, route accuracy, and completeness. Payout eligibility starts only after an accepted capture, not from signup alone.",
  },
];

export default function Capture() {
  const {
    data: publicLaunchStatus,
    loading: launchStatusLoading,
    error: launchStatusError,
  } = usePublicLaunchStatus();
  const supportedCities = publicLaunchStatus?.supportedCities ?? [];

  return (
    <>
      <SEO
        title="For Capturers | Blueprint"
        description="Apply for paid Blueprint capture assignments, record lawful public-facing walkthroughs, and learn how review, city gates, privacy, and payout eligibility work."
        canonical="/capture"
        jsonLd={[
          webPageJsonLd({
            path: "/capture",
            name: "Blueprint For Capturers",
            description:
              "How approved capturers can complete phone-first public-facing walkthrough assignments with review gates, provenance, privacy, and conditional payout eligibility.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Capture", path: "/capture" },
          ]),
        ]}
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto grid max-w-[96rem] gap-px lg:grid-cols-[0.38fr_0.62fr]">
            <div className="px-8 py-10 lg:px-12 lg:py-14">
              <EditorialSectionLabel>Capture</EditorialSectionLabel>
              <h1 className="font-editorial mt-8 max-w-[24rem] text-[4rem] leading-[0.88] tracking-[-0.07em] text-slate-950 sm:text-[5.2rem]">
                Get paid to capture real places robots need to understand.
              </h1>
              <p className="mt-8 max-w-[30rem] text-base leading-8 text-slate-700">
                Apply for approved field capture assignments you can complete with a phone first.
                Walk a public-facing route, follow app guidance, upload one complete walkthrough,
                and wait for review. Access stays city-, invite-, and code-gated so Blueprint
                never treats every location as open.
              </p>
              <p className="mt-4 max-w-[30rem] text-sm leading-7 text-slate-600">
                Payout language is conditional: assignment payout shown before you start, review
                required after upload, and only an accepted capture can become payout-eligible.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <a
                  href="/capture-app/launch-access?role=capturer&source=capture-hero"
                  className="inline-flex items-center justify-center bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Check capture access
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a
                  href="/signup/capturer"
                  className="inline-flex items-center justify-center border border-black/10 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Apply to capture
                </a>
              </div>
            </div>

            <MonochromeMedia
              src={publicCaptureGeneratedAssets.captureAppHero}
              alt="Blueprint capture walkthrough"
              className="min-h-[30rem] rounded-none"
              loading="eager"
              imageClassName="min-h-[30rem]"
              overlayClassName="bg-[linear-gradient(90deg,rgba(255,255,255,0.78)_0%,rgba(255,255,255,0.2)_36%,rgba(0,0,0,0.08)_100%)]"
            />
          </div>
        </section>

        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto max-w-[96rem] px-5 py-5 sm:px-8 lg:px-10">
            <div className="grid gap-px border border-black/10 bg-black/10 lg:grid-cols-[0.12fr_0.46fr_0.42fr]">
              {processRows.map((row, index) => (
                <div key={row.step} className="contents">
                  <div className="bg-[#f5f3ef] px-5 py-6 lg:px-7 lg:py-8">
                    <p className="text-[3.5rem] leading-none tracking-[-0.08em] text-slate-950">
                      {row.step}
                    </p>
                    <div className="mt-3 h-px w-10 bg-slate-950/15" />
                    <p className="mt-4 text-sm text-slate-700">{row.label}</p>
                  </div>

                  <div className="bg-slate-950">
                    <MonochromeMedia
                      src={
                        index === 0
                          ? publicCaptureGeneratedAssets.captureAppHero
                          : publicCaptureGeneratedAssets.everydayPlacesCollage
                      }
                      alt={row.title}
                      className="h-full rounded-none"
                      imageClassName={
                        index === 0
                          ? "h-full object-cover"
                          : index === 1
                            ? "h-full object-cover object-center"
                            : "h-full object-cover object-bottom"
                      }
                      overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.38))]"
                    />
                  </div>

                  <div className="grid gap-px bg-black/10 lg:grid-cols-[0.54fr_0.46fr]">
                    <div className="bg-white px-6 py-6">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        {row.title}
                      </p>
                      <p className="mt-4 max-w-[22rem] text-sm leading-7 text-slate-700">
                        {row.body}
                      </p>
                    </div>
                    {index === 0 ? (
                      <div className="bg-slate-950 px-6 py-6 text-white">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                          Field route
                        </p>
                        <div className="mt-4 space-y-3 text-sm text-white/80">
                          <div>Public aisle route</div>
                          <div>Common area only</div>
                          <div>Review required</div>
                        </div>
                        <div className="mt-6 border-t border-white/10 pt-5">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                          Uploading
                          </p>
                          <p className="mt-3 text-4xl tracking-[-0.06em]">73%</p>
                          <p className="mt-2 text-sm text-white/55">One complete walkthrough</p>
                          <div className="mt-4 h-px w-full bg-white/10">
                            <div className="h-px w-[73%] bg-white" />
                          </div>
                        </div>
                      </div>
                    ) : index === 1 ? (
                      <div className="bg-[#f5f3ef] px-6 py-6">
                        <div className="border border-black/10 bg-white p-5">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          Assignment
                          </p>
                          <p className="mt-4 text-sm text-slate-700">Payout shown upfront</p>
                          <p className="mt-1 text-sm text-slate-700">Accepted capture required</p>
                          <ul className="mt-5 space-y-2 text-sm text-slate-700">
                            <li>Follow app guidance</li>
                            <li>Upload after route completion</li>
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-950 px-6 py-6 text-white">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                          Review checklist
                        </p>
                        <ul className="mt-4 space-y-3 text-sm text-white/75">
                          <li>Coverage</li>
                          <li>Quality</li>
                          <li>Completeness</li>
                          <li>Route accuracy</li>
                        </ul>
                        <div className="mt-6 border-t border-white/10 pt-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                          Result
                          </p>
                          <p className="mt-3 text-2xl tracking-[-0.05em]">Accepted capture</p>
                          <p className="mt-2 text-sm text-white/55">Payout review can proceed</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-x border-b border-black/10 bg-white px-6 py-6 lg:px-8">
              <div className="grid gap-6 lg:grid-cols-[0.58fr_0.42fr] lg:items-center">
                <div>
                  <div className="inline-flex items-center gap-2 border border-black/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                    <DollarSign className="h-3.5 w-3.5" />
                    Paid field capture rollout
                  </div>
                  <h2 className="font-editorial mt-5 max-w-[36rem] text-[2.8rem] leading-[0.94] tracking-[-0.05em] text-slate-950">
                    Capture work opens only where the city, assignment, and review gates are ready.
                  </h2>
                  <p className="mt-4 max-w-[40rem] text-sm leading-7 text-slate-700">
                    Blueprint Capture follows the current launch-city roster. If your city is not
                    in the current rollout, you can still register interest, but paid assignments,
                    app access, and the public capture feed stay locked until the city is approved.
                    Public-area-only and privacy-safe route rules stay visible before field work.
                  </p>
                  <p className="mt-3 max-w-[40rem] text-sm leading-7 text-slate-700">
                    Smart glasses are aspirational here: supported for approved repeat walkthroughs
                    only when hardware, launch proof, and downstream capture proof exist.
                  </p>
                </div>
                <div>
                  <div className="rounded-[1.8rem] border border-sky-200 bg-sky-50/60 p-5">
                    <p className="text-sm leading-7 text-slate-700">
                      {launchStatusLoading ? (
                        <>
                          <strong>Checking current launch cities.</strong> Capture access stays
                          locked until the launch roster confirms a city is open for approved assignments.
                        </>
                      ) : launchStatusError ? (
                        <>
                          <strong>Launch status unavailable.</strong> This page is not treating any
                          city as supported from saved page copy. Request access or check the
                          launch map for the current backend status before expecting assignments.
                        </>
                      ) : supportedCities.length ? (
                        <>
                          <strong>Currently supported:</strong>{" "}
                          {supportedCities.map((city) => city.displayName).join(", ")}. Only
                          approved launch cities open public capture access, assignment cards, and payout review.
                        </>
                      ) : (
                        <>
                          <strong>No public launch cities are marked open right now.</strong> You can
                          still request access, but the app, assignment feed, and payout review
                          stay locked until the city is approved.
                        </>
                      )}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {supportedCities.map((city) => (
                      <span
                        key={city.citySlug}
                        className="border border-black/10 bg-[#f5f3ef] px-4 py-2 text-sm text-slate-700"
                      >
                        {city.displayName}
                      </span>
                    ))}
                    {!supportedCities.length ? (
                      <span className="border border-black/10 bg-[#f5f3ef] px-4 py-2 text-sm text-slate-700">
                        Backend launch roster required
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[96rem] px-5 py-10 sm:px-8 lg:px-10">
          <EditorialCtaBand
	            eyebrow="Buyer side"
            title="Looking for a world model your robot team can evaluate?"
            description="Robot teams start with world models and structured site requests, not capturer access."
            imageSrc={publicCaptureGeneratedAssets.everydayPlacesCollage}
            imageAlt="Blueprint capture route"
            primaryHref="/world-models"
            primaryLabel="Browse world models"
            secondaryHref="mailto:hello@tryblueprint.io?subject=Blueprint%20Capture%20Support"
            secondaryLabel="Email support"
          />
        </section>
      </div>
    </>
  );
}
