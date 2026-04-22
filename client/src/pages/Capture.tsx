import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialSectionLabel,
  MonochromeMedia,
} from "@/components/site/editorial";
import { editorialRefreshAssets } from "@/lib/editorialRefreshAssets";
import { ArrowRight, DollarSign } from "lucide-react";

const processRows = [
  {
    step: "01",
    label: "Capture",
    title: "Open the app",
    body:
      "Capturers work inside the mobile handoff. The website exists to route the right person there, not to replace it.",
  },
  {
    step: "02",
    label: "Upload",
    title: "Keep one walkthrough moving",
    body:
      "Record one complete pass, keep the app open, and let Blueprint review coverage before anything becomes downstream package work.",
  },
  {
    step: "03",
    label: "Review",
    title: "Approval stays explicit",
    body:
      "Access stays invite- and code-gated. Coverage, quality, and route accuracy still decide whether the capture is usable.",
  },
];

const supportedCities = ["Austin, TX", "Sacramento, CA", "San Diego, CA", "San Jose, CA"];

export default function Capture() {
  return (
    <>
      <SEO
        title="Capture Basics | Blueprint"
        description="Blueprint's capturer handoff, invite-gated access, and mobile capture path."
        canonical="/capture"
        noIndex={true}
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto grid max-w-[96rem] gap-px lg:grid-cols-[0.38fr_0.62fr]">
            <div className="px-8 py-10 lg:px-12 lg:py-14">
              <EditorialSectionLabel>Capture</EditorialSectionLabel>
              <h1 className="font-editorial mt-8 max-w-[24rem] text-[4rem] leading-[0.88] tracking-[-0.07em] text-slate-950 sm:text-[5.2rem]">
                Capture starts in the app.
              </h1>
              <p className="mt-8 max-w-[30rem] text-base leading-8 text-slate-700">
                Blueprint&apos;s main site is for buyers inspecting exact-site world models. If
                you are the person recording the facility, this page is the narrow handoff into the
                invite-gated capture lane.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <a
                  href="/capture-app"
                  className="inline-flex items-center justify-center bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Open capture app
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a
                  href="/signup/capturer"
                  className="inline-flex items-center justify-center border border-black/10 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Apply for capturer access
                </a>
              </div>
            </div>

            <MonochromeMedia
              src={editorialRefreshAssets.captureHero}
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
                    <div className="mt-3 h-px w-10 bg-slate-950/16" />
                    <p className="mt-4 text-sm text-slate-700">{row.label}</p>
                  </div>

                  <div className="bg-slate-950">
                    <MonochromeMedia
                      src={
                        index === 0
                          ? editorialRefreshAssets.capturePhone
                          : editorialRefreshAssets.captureHero
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
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/44">
                          Field route
                        </p>
                        <div className="mt-4 space-y-3 text-sm text-white/78">
                          <div>Route 04</div>
                          <div>Floor 02</div>
                          <div>Wing B</div>
                        </div>
                        <div className="mt-6 border-t border-white/10 pt-5">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-white/44">
                            Uploading
                          </p>
                          <p className="mt-3 text-4xl tracking-[-0.06em]">73%</p>
                          <p className="mt-2 text-sm text-white/56">2.4 GB / 3.2 GB</p>
                          <div className="mt-4 h-px w-full bg-white/12">
                            <div className="h-px w-[73%] bg-white" />
                          </div>
                        </div>
                      </div>
                    ) : index === 1 ? (
                      <div className="bg-[#f5f3ef] px-6 py-6">
                        <div className="border border-black/10 bg-white p-5">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                            Uplink
                          </p>
                          <p className="mt-4 text-sm text-slate-700">Wi-Fi</p>
                          <p className="mt-1 text-sm text-slate-700">Blueprint_Capture</p>
                          <ul className="mt-5 space-y-2 text-sm text-slate-700">
                            <li>Uploading...</li>
                            <li>Keep app open</li>
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-950 px-6 py-6 text-white">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/44">
                          Review checklist
                        </p>
                        <ul className="mt-4 space-y-3 text-sm text-white/76">
                          <li>Coverage</li>
                          <li>Quality</li>
                          <li>Completeness</li>
                          <li>Route accuracy</li>
                        </ul>
                        <div className="mt-6 border-t border-white/10 pt-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-white/44">
                            Status
                          </p>
                          <p className="mt-3 text-2xl tracking-[-0.05em]">Approved</p>
                          <p className="mt-2 text-sm text-white/56">Ready for processing</p>
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
                    Current capture rollout
                  </div>
                  <h2 className="font-editorial mt-5 max-w-[36rem] text-[2.8rem] leading-[0.94] tracking-[-0.05em] text-slate-950">
                    Current capture access is limited to launch-approved cities.
                  </h2>
                  <p className="mt-4 max-w-[40rem] text-sm leading-7 text-slate-700">
                    Blueprint Capture follows the city-launch org state. If your city is not in the
                    current rollout, you can still register interest, but the app and public
                    capture feed stay locked until the city is approved.
                  </p>
                </div>
                <div>
                  <div className="rounded-[1.8rem] border border-sky-200 bg-sky-50/60 p-5">
                    <p className="text-sm leading-7 text-slate-700">
                      <strong>Currently supported:</strong> {supportedCities.join(", ")}. Only
                      approved launch cities open public capture access and capture cards.
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {supportedCities.map((city) => (
                      <span
                        key={city}
                        className="rounded-full border border-black/10 bg-[#f5f3ef] px-4 py-2 text-sm text-slate-700"
                      >
                        {city}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[96rem] px-5 py-10 sm:px-8 lg:px-10">
          <EditorialCtaBand
            eyebrow="Buyer side"
            title="Looking for the buyer side instead?"
            description="Robot teams should start in the world-model catalog and the hosted-review path, not in the capturer handoff."
            imageSrc={editorialRefreshAssets.captureHero}
            imageAlt="Blueprint capture lane"
            primaryHref="/world-models"
            primaryLabel="Explore world models"
            secondaryHref="mailto:hello@tryblueprint.io?subject=Blueprint%20Capture%20Support"
            secondaryLabel="Email support"
          />
        </section>
      </div>
    </>
  );
}
