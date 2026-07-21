import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ExternalLink, Mail, MapPinned, QrCode, Smartphone } from "lucide-react";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
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
import {
  publicCaptureLocationTypes,
  publicCaptureProofStories,
} from "@/lib/proofEvidence";
import { publicCaptureGeneratedAssets } from "@/lib/publicCaptureGeneratedAssets";

const steps = [
  {
    label: "Apply",
    body: "Enter the city or invite path. Approved assignments show the route, rules, and payout before you start.",
  },
  {
    label: "Walk",
    body: "Use a phone first to walk one public-facing route, follow app guidance, and keep private or sensitive areas out.",
  },
  {
    label: "Review",
    body: "Upload one complete walkthrough. Blueprint reviews it before an accepted capture can become payout-eligible.",
  },
] as const;

type CapturerLadderState = "pending" | "approved" | "rejected";

const capturerLadderSteps = [
  {
    key: "applied",
    label: "Applied",
    body: "Your capturer application is on record.",
  },
  {
    key: "in_review",
    label: "In review",
    body: "Blueprint reviews your market, equipment, and availability.",
  },
  {
    key: "approved",
    label: "Approved",
    body: "Approved capturers become eligible for assignment coordination.",
  },
  {
    key: "first_assignment",
    label: "First assignment",
    body: "Coordinated by the ops team after approval — we reach out when one is ready.",
  },
] as const;

type CapturerLadderStepKey = (typeof capturerLadderSteps)[number]["key"];

function resolveCapturerLadderState(
  status: string | undefined,
): CapturerLadderState | null {
  if (status === "pending_review" || status === "applied") {
    return "pending";
  }
  if (status === "approved" || status === "active") {
    return "approved";
  }
  if (status === "rejected") {
    return "rejected";
  }
  return null;
}

function capturerStepState(
  step: CapturerLadderStepKey,
  ladderState: CapturerLadderState,
): "done" | "current" | "upcoming" {
  if (ladderState === "pending") {
    if (step === "applied") return "done";
    if (step === "in_review") return "current";
    return "upcoming";
  }
  if (ladderState === "approved") {
    if (step === "first_assignment") return "current";
    return "done";
  }
  // rejected: application was received and reviewed; later rungs never opened.
  if (step === "applied" || step === "in_review") return "done";
  return "upcoming";
}

const capturerStepStyles: Record<"done" | "current" | "upcoming", string> = {
  done: "border-black/10 bg-[#111110] text-white",
  current: "border-black/40 bg-white text-[#111110]",
  upcoming: "border-black/10 bg-[#faf6ef] text-[#111110] opacity-60",
};

const hasExternalAppLink = (value: string) => {
  try {
    const url = new URL(value, "https://tryblueprint.io");
    return url.origin !== "https://tryblueprint.io" || url.pathname !== "/capture-app";
  } catch {
    return false;
  }
};

export default function CaptureAppPlaceholder() {
  const { currentUser, userData } = useAuth();
  const capturerStatus: string | undefined = userData?.capturerApplicationStatus;
  const ladderState = currentUser
    ? resolveCapturerLadderState(capturerStatus)
    : null;
  const captureAppUrl = getCaptureAppPlaceholderUrl();
  const showExternalHandoff = hasExternalAppLink(captureAppUrl);
  const captureAccessUrl = "/capture-app/launch-access?source=capture-app-placeholder";
  const qrTargetUrl = showExternalHandoff ? captureAppUrl : captureAccessUrl;
  const {
    data: publicLaunchStatus,
    loading: launchStatusLoading,
    error: launchStatusError,
  } = usePublicLaunchStatus();
  const launchCities = publicLaunchStatus?.supportedCities ?? [];
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
	        description="Open Blueprint Capture for approved phone-first field assignments, lawful public-facing walkthroughs, and review-gated payout eligibility."
	        canonical="/capture-app"
	        noIndex
	      />

      <SurfacePage>
        <SurfaceTopBar eyebrow="Capture Access" rightLabel="Public Capture Path" />
        {ladderState ? (
          <SurfaceSection className="pt-8">
            <div className="rounded-[1.75rem] border border-black/10 bg-white p-6 lg:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SurfaceMiniLabel>Your Capturer Application</SurfaceMiniLabel>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">
                  {ladderState === "pending"
                    ? "In review"
                    : ladderState === "approved"
                      ? "Approved"
                      : "Not approved"}
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {capturerLadderSteps.map((step, index) => {
                  const state = capturerStepState(step.key, ladderState);
                  return (
                    <div
                      key={step.key}
                      className={`rounded-[1.35rem] border p-4 ${capturerStepStyles[state]}`}
                    >
                      <p
                        className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
                          state === "done" ? "text-white/50" : "text-black/40"
                        }`}
                      >
                        0{index + 1} ·{" "}
                        {state === "done"
                          ? "Done"
                          : state === "current"
                            ? "Current"
                            : "Next"}
                      </p>
                      <p className="mt-2 text-sm font-semibold">{step.label}</p>
                      <p
                        className={`mt-2 text-sm leading-6 ${
                          state === "done" ? "text-white/65" : "text-black/60"
                        }`}
                      >
                        {step.body}
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-5 max-w-[46rem] text-sm leading-7 text-black/60">
                {ladderState === "pending"
                  ? "Your application is in review — we'll email you when there's a decision. Nothing else is needed from you right now."
                  : ladderState === "approved"
                    ? "You're approved. First assignments are coordinated by the Blueprint ops team after approval — we'll contact you directly when one is ready in your market. Keep the capture app path below handy."
                    : "Your application wasn't approved this time. If your market, equipment, or availability changes — or you think we got this wrong — reach out and we'll take another look."}
              </p>
              {ladderState === "rejected" ? (
                <a
                  href="/contact"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#111110]"
                >
                  Contact the Blueprint team
                  <ArrowRight className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </SurfaceSection>
        ) : null}
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
                <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4 text-[11px] uppercase tracking-[0.22em] text-white/60">
                  <span>Capture App</span>
	                  <span>Paid Field Capture</span>
                  <span>Capture Basics</span>
                </div>
                <div className="relative flex h-full items-end px-6 py-8 lg:px-8">
                  <div className="max-w-[28rem]">
	                    <SurfaceMiniLabel className="text-white/50">Approved Capture Assignments</SurfaceMiniLabel>
	                    <h1 className="mt-5 text-[clamp(3.5rem,7vw,6rem)] font-semibold uppercase leading-[0.86] tracking-[-0.08em] text-white">
	                      Get paid to capture real places robots need to understand.
	                      <br />
	                      Phone first.
	                    </h1>
	                    <p className="mt-5 max-w-[22rem] text-base leading-8 text-white/75">
	                      Open Blueprint Capture when you have access to an approved assignment:
                        walk a public-facing route, follow app guidance, upload one complete
                        walkthrough, and wait for review.
	                    </p>
                      <p className="mt-4 max-w-[22rem] text-sm leading-7 text-white/65">
                        Payout applies only to an accepted capture. The assignment payout is shown
                        before you start; review is required after upload.
                      </p>
                    <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      {showExternalHandoff ? (
                        <a
                          href={captureAppUrl}
                          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white px-5 text-sm font-semibold text-[#111110] transition hover:bg-[#f4f0e8]"
                        >
                          Open assignment app
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        <a
                          href="/capture-app/launch-access?source=capture-app-placeholder"
                          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white px-5 text-sm font-semibold text-[#111110] transition hover:bg-[#f4f0e8]"
                        >
	                          Request assignment access
	                          <Mail className="h-4 w-4" />
                        </a>
                      )}
                      <a
                        href="/signup/capturer"
                        className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
                      >
	                        Apply for approved capture assignments
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#f8f4ec] p-8 lg:p-9">
                <div className="mx-auto flex h-full max-w-[24rem] flex-col justify-between gap-6">
                  <div className="rounded-[2rem] border border-black/10 bg-[#111110] p-6 text-white shadow-[0_22px_70px_rgba(17,17,16,0.16)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
                        <Smartphone className="h-3.5 w-3.5" />
                        Phone-first capture
                      </div>
	                      <span className="text-[10px] uppercase tracking-[0.22em] text-white/45">Review required</span>
                    </div>
                    <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
                      <p className="text-center text-sm font-semibold uppercase tracking-[0.22em] text-white/55">
                      {showExternalHandoff ? "Scan to open" : "Scan to request assignment access"}
                      </p>
                      <div className="mt-4 flex justify-center">
                        <div className="rounded-[1.35rem] border border-white/10 bg-[#f8f5ee] p-3">
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
                            <div className="flex h-44 w-44 items-center justify-center rounded-xl bg-black/5 text-sm text-black/45">
                              Rendering QR
                            </div>
                          )}
                        </div>
                      </div>
                    <p className="mt-4 text-center text-sm leading-6 text-white/65">
                      {showExternalHandoff
                        ? "Capturers use this stable path to open the app, follow field rules, and submit accepted-capture candidates for review."
                        : "The app link is invite-gated for now. Request access or apply as a capturer so Blueprint can route the right city, invite, and review path."}
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
                        {showExternalHandoff ? "Open assignment app" : "Request assignment access"}
                      </SurfaceButton>
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] border border-black/10 bg-white p-5">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-black/40">
                      <MapPinned className="h-4 w-4" />
                      Open capture markets
                    </div>
                    <div className="mt-4 grid gap-2">
                      {launchStatusLoading ? (
                        <p className="text-sm leading-7 text-black/55">
                          Reviewing public capture-market status before showing open cities.
                        </p>
                      ) : launchStatusError ? (
                        <p className="text-sm leading-7 text-black/55">
                          Launch status is unavailable. Request access instead of relying on a
                          cached city list.
                        </p>
                      ) : launchCityLabels.length > 0 ? (
                        launchCityLabels.slice(0, 5).map((label) => (
                          <div
                            key={label}
                            className="flex items-center justify-between rounded-full border border-black/10 bg-[#faf6ef] px-4 py-2 text-sm"
                          >
                            <span className="text-[#111110]">{label}</span>
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">
                              Open
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm leading-7 text-black/55">
	                        No open public capture market is listed here right now. Leave your city if you can capture public-area-only routes in common public-facing locations.
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
                      <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-black/40">
                        {step.label}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-black/60">{step.body}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-[1.35rem] border border-black/10 bg-[#111110] p-5 text-white">
                  <SurfaceMiniLabel className="text-white/50">Need The Buyer Side Instead?</SurfaceMiniLabel>
                  <p className="mt-4 text-base leading-7 text-white/75">
	                    Robot teams browse exact-site worlds and hosted review. Capturers use this path for approved paid assignments, lawful public-facing walkthroughs, and review-gated payout eligibility.
                  </p>
                  <a
                    href="/world-models"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white"
                  >
                    Explore sites
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>

              <div className="mt-8 grid gap-5 lg:grid-cols-[0.36fr_0.64fr]">
                <div className="rounded-[1.35rem] border border-black/10 bg-[#111110] p-5 text-white">
                  <SurfaceMiniLabel className="text-white/50">Capture Opportunities</SurfaceMiniLabel>
                  <p className="mt-4 text-base leading-7 text-white/75">
                    The public app is for ordinary places with useful robot workflows: store
                    aisles, lobbies, corridors, common areas, venues, and service spaces.
                    Google/Meta smart glasses are supported only for approved repeat walkthroughs
                    where the assignment, hardware, launch proof, and downstream capture proof exist.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {publicCaptureLocationTypes.map((item) => (
                    <div key={item.label} className="rounded-[1.35rem] border border-black/10 bg-[#faf6ef] p-4">
                      <p className="text-sm font-semibold text-[#111110]">{item.label}</p>
                      <p className="mt-2 text-sm leading-6 text-black/60">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-4">
                {publicCaptureProofStories.map((story) => (
                  <div key={story.id} className="rounded-[1.35rem] border border-black/10 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">
                      {story.city}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#111110]">{story.locationName}</p>
                    <p className="mt-2 text-sm leading-6 text-black/60">{story.captureAppCue}</p>
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
