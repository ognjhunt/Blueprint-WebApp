import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ExternalLink, Mail, MapPinned, QrCode, Smartphone } from "lucide-react";
import { SEO } from "@/components/SEO";
import {
  SurfaceBrowserFrame,
  SurfaceButton,
  SurfaceMiniLabel,
  SurfacePage,
  SurfaceSection,
  SurfaceTopBar,
} from "@/components/site/privateSurface";
import { usePublicLaunchStatus } from "@/hooks/usePublicLaunchStatus";
import { getCaptureAppPlaceholderUrl } from "@/lib/client-env";
import { defaultSupportedLaunchCities } from "@/lib/publicLaunchStatus";
import {
  publicCaptureLocationTypes,
  publicCaptureProofStories,
} from "@/lib/proofEvidence";
import { publicCaptureGeneratedAssets } from "@/lib/publicCaptureGeneratedAssets";

const steps = [
  {
    label: "Plan",
    body: "Pick a lawful public-facing route, identify sensitive zones, and keep the walkthrough narrow.",
  },
  {
    label: "Capture",
    body: "Record grocery, retail, service, library, lobby, or other everyday spaces from common areas.",
  },
  {
    label: "Process",
    body: "Blueprint reviews coverage, privacy, and usefulness before the capture becomes downstream output.",
  },
] as const;

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
  const captureAccessUrl = "/capture-app/launch-access?source=capture-app-placeholder";
  const qrTargetUrl = showExternalHandoff ? captureAppUrl : captureAccessUrl;
  const { data: publicLaunchStatus } = usePublicLaunchStatus();
  const launchCities = publicLaunchStatus?.supportedCities?.length
    ? publicLaunchStatus.supportedCities
    : defaultSupportedLaunchCities;
  const [qrCode, setQrCode] = useState("");

  const launchCityLabels = useMemo(() => launchCities.map((city) => city.displayName), [launchCities]);

  useEffect(() => {
    let active = true;

    async function renderQr() {
      try {
        const qrcode = await import("qrcode");
        const dataUrl = await qrcode.toDataURL(qrTargetUrl, {
          width: 280,
          margin: 1,
          color: {
            dark: "#111110",
            light: "#f8f5ee",
          },
        });
        if (active) {
          setQrCode(dataUrl);
        }
      } catch (error) {
        console.error("Failed to render capture QR code:", error);
      }
    }

    void renderQr();

    return () => {
      active = false;
    };
  }, [qrTargetUrl]);

  return (
    <>
      <SEO
	        title="Capture App | Blueprint"
	        description="Open Blueprint Capture to record lawful public-facing locations and submit walkthrough evidence for review."
	        canonical="/capture-app"
	        noIndex
	      />

      <SurfacePage>
        <SurfaceTopBar eyebrow="Capture Access" rightLabel="Public Capture Handoff" />
        <SurfaceSection className="py-8">
          <SurfaceBrowserFrame className="overflow-hidden">
            <div className="grid xl:grid-cols-[0.56fr_0.44fr]">
              <div className="relative min-h-[42rem] overflow-hidden bg-black text-white">
                <img
                  src={publicCaptureGeneratedAssets.captureAppHero}
                  alt="Blueprint public-facing capture app walkthrough"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.76),rgba(0,0,0,0.38)_58%,rgba(0,0,0,0.18))]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4 text-[11px] uppercase tracking-[0.22em] text-white/58">
                  <span>Capture App</span>
	                  <span>Capture & Earn</span>
                  <span>Capture Basics</span>
                </div>
                <div className="relative flex h-full items-end px-6 py-8 lg:px-8">
                  <div className="max-w-[28rem]">
	                    <SurfaceMiniLabel className="text-white/52">Public Capture Handoff</SurfaceMiniLabel>
	                    <h1 className="mt-5 text-[clamp(3.5rem,7vw,6rem)] font-semibold uppercase leading-[0.86] tracking-[-0.08em] text-white">
	                      Everyday site.
	                      <br />
	                      Captured.
	                    </h1>
	                    <p className="mt-5 max-w-[22rem] text-base leading-8 text-white/76">
	                      Open Blueprint Capture to record public-facing places people visit every day: grocery stores, retail aisles, libraries, lobbies, and other common areas where capture is allowed.
	                    </p>
                    <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      {showExternalHandoff ? (
                        <a
                          href={captureAppUrl}
                          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/12 bg-white px-5 text-sm font-semibold text-[#111110] transition hover:bg-[#f4f0e8]"
                        >
                          Open the capture app
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        <a
                          href="/capture-app/launch-access?source=capture-app-placeholder"
                          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/12 bg-white px-5 text-sm font-semibold text-[#111110] transition hover:bg-[#f4f0e8]"
                        >
	                          Request capture access
	                          <Mail className="h-4 w-4" />
                        </a>
                      )}
                      <a
                        href="/signup/capturer"
                        className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/18 px-5 text-sm font-semibold text-white transition hover:bg-white/8"
                      >
	                        Apply for capturer access
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#f8f4ec] p-8 lg:p-9">
                <div className="mx-auto flex h-full max-w-[24rem] flex-col justify-between gap-6">
                  <div className="rounded-[2rem] border border-black/12 bg-[#111110] p-6 text-white shadow-[0_22px_70px_rgba(17,17,16,0.16)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
                        <Smartphone className="h-3.5 w-3.5" />
                        Capture App
                      </div>
	                      <span className="text-[10px] uppercase tracking-[0.22em] text-white/45">Review required</span>
                    </div>
                    <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
                      <p className="text-center text-sm font-semibold uppercase tracking-[0.22em] text-white/56">
                        {showExternalHandoff ? "Scan to open" : "Scan to request access"}
                      </p>
                      <div className="mt-4 flex justify-center">
                        <div className="rounded-[1.35rem] border border-white/8 bg-[#f8f5ee] p-3">
                          {qrCode ? (
                            <img
                              src={qrCode}
                              alt={
                                showExternalHandoff
                                  ? "QR code for the Blueprint Capture App"
                                  : "QR code for Blueprint capture access"
                              }
                              className="h-44 w-44 rounded-xl"
                            />
                          ) : (
                            <div className="flex h-44 w-44 items-center justify-center rounded-xl bg-black/6 text-sm text-black/46">
                              Rendering QR
                            </div>
                          )}
                        </div>
                      </div>
                    <p className="mt-4 text-center text-sm leading-6 text-white/66">
                      {showExternalHandoff
                        ? "Capturers use this stable handoff to open the app, follow field rules, and submit walkthroughs for review."
                        : "The app link is invite-gated for now. Request access or apply as a capturer so Blueprint can route the right handoff."}
                    </p>
                    </div>
                    <div className="mt-5">
                      <SurfaceButton
                        href={
                          showExternalHandoff
                            ? captureAppUrl
                            : captureAccessUrl
                        }
                        tone="secondary"
                        className="w-full rounded-full"
                      >
                        {showExternalHandoff ? "Open the capture app" : "Request capture access"}
                      </SurfaceButton>
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] border border-black/10 bg-white p-5">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">
                      <MapPinned className="h-4 w-4" />
                      Available launch cities
                    </div>
                    <div className="mt-4 grid gap-2">
                      {launchCityLabels.length > 0 ? (
                        launchCityLabels.slice(0, 5).map((label) => (
                          <div
                            key={label}
                            className="flex items-center justify-between rounded-full border border-black/10 bg-[#faf6ef] px-4 py-2 text-sm"
                          >
                            <span className="text-[#111110]">{label}</span>
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/42">
                              Live
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm leading-7 text-black/56">
	                          City access is opening in stages. Leave a signal if your city is not open yet, especially if you can capture common public-facing locations.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-black/10 bg-white p-6 lg:p-8">
              <div className="grid gap-6 xl:grid-cols-[0.78fr_0.22fr]">
                <div className="grid gap-5 lg:grid-cols-3">
                  {steps.map((step, index) => (
                    <div key={step.label} className="rounded-[1.35rem] border border-black/10 bg-[#faf6ef] p-5">
                      <p className="text-[2rem] font-semibold tracking-[-0.06em] text-[#111110]">
                        0{index + 1}
                      </p>
                      <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-black/42">
                        {step.label}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-black/58">{step.body}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-[1.35rem] border border-black/10 bg-[#111110] p-5 text-white">
                  <SurfaceMiniLabel className="text-white/50">Need The Buyer Side Instead?</SurfaceMiniLabel>
                  <p className="mt-4 text-base leading-7 text-white/76">
	                    Robot teams browse exact-site worlds and hosted review. Capturers use this handoff to record lawful public-facing locations for review.
                  </p>
                  <a
                    href="/world-models"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white"
                  >
                    Explore world models
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>

              <div className="mt-8 grid gap-5 lg:grid-cols-[0.36fr_0.64fr]">
                <div className="rounded-[1.35rem] border border-black/10 bg-[#111110] p-5 text-white">
                  <SurfaceMiniLabel className="text-white/50">Capture Opportunities</SurfaceMiniLabel>
                  <p className="mt-4 text-base leading-7 text-white/76">
                    The public app is for ordinary places with useful robot workflows: store aisles, lobbies, corridors, common areas, venues, and service spaces.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {publicCaptureLocationTypes.map((item) => (
                    <div key={item.label} className="rounded-[1.35rem] border border-black/10 bg-[#faf6ef] p-4">
                      <p className="text-sm font-semibold text-[#111110]">{item.label}</p>
                      <p className="mt-2 text-sm leading-6 text-black/58">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-4">
                {publicCaptureProofStories.map((story) => (
                  <div key={story.id} className="rounded-[1.35rem] border border-black/10 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/42">
                      {story.city}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#111110]">{story.locationName}</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">{story.captureAppCue}</p>
                  </div>
                ))}
              </div>
            </div>
          </SurfaceBrowserFrame>
        </SurfaceSection>
      </SurfacePage>
    </>
  );
}
