import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ExternalLink, Mail, MapPinned, QrCode, Smartphone } from "lucide-react";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import {
  SurfaceBrowserFrame,
  SurfaceMiniLabel,
  SurfacePage,
  SurfaceSection,
  SurfaceTopBar,
} from "@/components/site/privateSurface";
import { usePublicLaunchStatus } from "@/hooks/usePublicLaunchStatus";
import { getCaptureAppPlaceholderUrl } from "@/lib/client-env";
import { publicCaptureGeneratedAssets } from "@/lib/publicCaptureGeneratedAssets";

const captureLocationTypes = [
  {
    label: "Retail and service spaces",
    detail: "Public-facing aisles, counters, and customer routes when an approved assignment is open.",
  },
  {
    label: "Lobbies and common areas",
    detail: "Lawfully accessible shared routes with assignment-specific privacy and access rules.",
  },
  {
    label: "Venues and corridors",
    detail: "Approved navigation paths captured only within the boundaries shown before the walk begins.",
  },
] as const;

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
  done: "border-runway-green-dim bg-runway-panel",
  current: "border-runway-signal-dim bg-runway-panel",
  upcoming: "border-runway-line bg-runway-deep",
};

const capturerStepMetaStyles: Record<"done" | "current" | "upcoming", string> = {
  done: "text-runway-green",
  current: "text-runway-signal",
  upcoming: "text-runway-faint",
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
            dark: "#0c0f0e",
            light: "#e8e6dd",
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
            <div className="runway-panel p-6 lg:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SurfaceMiniLabel className="text-runway-faint">Your Capturer Application</SurfaceMiniLabel>
                <span
                  className={`runway-chip ${
                    ladderState === "pending"
                      ? "runway-chip-open"
                      : ladderState === "approved"
                        ? "runway-chip-live"
                        : "runway-chip-fail"
                  }`}
                >
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
                      className={`border p-4 ${capturerStepStyles[state]}`}
                    >
                      <p className={`runway-meta ${capturerStepMetaStyles[state]}`}>
                        0{index + 1} ·{" "}
                        {state === "done"
                          ? "Done"
                          : state === "current"
                            ? "Current"
                            : "Next"}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-runway-text">{step.label}</p>
                      <p className="mt-2 text-sm leading-6 text-runway-mute">
                        {step.body}
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-5 max-w-[46rem] text-sm leading-7 text-runway-mute">
                {ladderState === "pending"
                  ? "Your application is in review — we'll email you when there's a decision. Nothing else is needed from you right now."
                  : ladderState === "approved"
                    ? "You're approved. First assignments are coordinated by the Blueprint ops team after approval — we'll contact you directly when one is ready in your market. Keep the capture app path below handy."
                    : "Your application wasn't approved this time. If your market, equipment, or availability changes — or you think we got this wrong — reach out and we'll take another look."}
              </p>
              {ladderState === "rejected" ? (
                <a
                  href="/contact"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-runway-text transition hover:text-runway-signal"
                >
                  Contact the Blueprint team
                  <ArrowRight className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </SurfaceSection>
        ) : null}
        <SurfaceSection className="py-8">
          <SurfaceBrowserFrame className="overflow-hidden rounded-none shadow-none">
            <div className="grid xl:grid-cols-[0.56fr_0.44fr]">
              <div className="relative min-h-[42rem] overflow-hidden bg-runway-black text-runway-text">
                <img
                  src={publicCaptureGeneratedAssets.captureAppHero}
                  alt="Blueprint public-facing capture app walkthrough"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(12,15,14,0.86),rgba(12,15,14,0.55)_58%,rgba(12,15,14,0.3))]" />
                <div className="runway-meta pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-4 border-b border-runway-line px-6 py-4">
                  <span>Capture App</span>
	                  <span>Paid Field Capture</span>
                  <span>Capture Basics</span>
                </div>
                <div className="relative flex h-full items-end px-6 py-8 lg:px-8">
                  <div className="max-w-[28rem]">
	                    <SurfaceMiniLabel className="text-runway-faint">Approved Capture Assignments</SurfaceMiniLabel>
	                    <h1 className="mt-5 font-display uppercase text-[clamp(3.5rem,7vw,6rem)] font-semibold leading-[0.86] tracking-[0.005em] text-runway-text">
	                      Get paid to capture the job before the robot arrives.
	                      <br />
	                      Phone first.
	                    </h1>
	                    <p className="mt-5 max-w-[22rem] text-base leading-8 text-runway-body">
	                      Open Blueprint Capture when you have an approved assignment: record the
                        named workflow, follow the access boundary, upload one complete walkthrough,
                        and wait for QA.
	                    </p>
                      <p className="mt-4 max-w-[22rem] text-sm leading-7 text-runway-mute">
                        Payout applies only to an accepted capture. The assignment payout is shown
                        before you start; review is required after upload.
                      </p>
                    <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      {showExternalHandoff ? (
                        <a href={captureAppUrl} className="runway-cta">
                          Open assignment app
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        <a
                          href="/capture-app/launch-access?source=capture-app-placeholder"
                          className="runway-cta"
                        >
	                          Request assignment access
	                          <Mail className="h-4 w-4" />
                        </a>
                      )}
                      <a href="/signup/capturer" className="runway-cta-ghost">
	                        Apply for approved capture assignments
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-runway-deep p-8 lg:p-9">
                <div className="mx-auto flex h-full max-w-[24rem] flex-col justify-between gap-6">
                  <div className="runway-panel p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div className="runway-chip runway-chip-neutral">
                        <Smartphone className="h-3.5 w-3.5" />
                        Phone-first capture
                      </div>
	                      <span className="runway-meta">Review required</span>
                    </div>
                    <div className="mt-6 border border-runway-line bg-runway-raised p-5">
                      <p className="runway-meta text-center">
                      {showExternalHandoff ? "Scan to open" : "Scan to request assignment access"}
                      </p>
                      <div className="mt-4 flex justify-center">
                        <div className="border border-runway-line bg-runway-panel p-3">
                          {qrCode ? (
                            <img
                              src={qrCode}
                              alt={
                                showExternalHandoff
                                  ? "QR code for the Blueprint Capture App"
                                  : "QR code for Blueprint capture access"
                              }
                              className="h-44 w-44"
                            />
                          ) : (
                            <div className="flex h-44 w-44 items-center justify-center bg-runway-raised text-sm text-runway-mute">
                              Rendering QR
                            </div>
                          )}
                        </div>
                      </div>
                    <p className="mt-4 text-center text-sm leading-6 text-runway-mute">
                      {showExternalHandoff
                        ? "Capturers use this stable path to open the app, follow field rules, and submit accepted-capture candidates for review."
                        : "The app link is invite-gated for now. Request access or apply as a capturer so Blueprint can route the right city, invite, and review path."}
                    </p>
                    </div>
                    <div className="mt-5">
                      <a
                        href={
                          showExternalHandoff
                            ? captureAppUrl
                            : captureAccessUrl
                        }
                        className="runway-cta-ghost w-full"
                      >
                        {showExternalHandoff ? "Open assignment app" : "Request assignment access"}
                      </a>
                    </div>
                  </div>

                  <div className="runway-panel p-5">
                    <div className="runway-meta flex items-center gap-2">
                      <MapPinned className="h-4 w-4" />
                      Open capture markets
                    </div>
                    <div className="mt-4 grid gap-2">
                      {launchStatusLoading ? (
                        <p className="text-sm leading-7 text-runway-mute">
                          Reviewing public capture-market status before showing open cities.
                        </p>
                      ) : launchStatusError ? (
                        <p className="text-sm leading-7 text-runway-mute">
                          Launch status is unavailable. Request access instead of relying on a
                          cached city list.
                        </p>
                      ) : launchCityLabels.length > 0 ? (
                        launchCityLabels.slice(0, 5).map((label) => (
                          <div
                            key={label}
                            className="flex items-center justify-between gap-3 border border-runway-line bg-runway-deep px-4 py-2 text-sm"
                          >
                            <span className="text-runway-text">{label}</span>
                            <span className="runway-chip runway-chip-open">
                              Open
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm leading-7 text-runway-mute">
	                        No open public capture market is listed here right now. Leave your city if you can capture public-area-only routes in common public-facing locations.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-runway-line bg-runway-panel p-6 lg:p-8">
              <div className="grid gap-6 xl:grid-cols-[0.78fr_0.22fr]">
                <div className="grid gap-5 lg:grid-cols-3">
                  {steps.map((step, index) => (
                    <div key={step.label} className="border border-runway-line bg-runway-deep p-5">
                      <p className="runway-num text-[2rem] font-semibold text-runway-text">
                        0{index + 1}
                      </p>
                      <p className="runway-meta mt-3">
                        {step.label}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-runway-mute">{step.body}</p>
                    </div>
                  ))}
                </div>

                <div className="border border-runway-line bg-runway-deep p-5">
                  <SurfaceMiniLabel className="text-runway-faint">Need The Buyer Side Instead?</SurfaceMiniLabel>
                  <p className="mt-4 text-base leading-7 text-runway-body">
	                    Robot teams use these records for the task discovery, site recreation, and fit testing that happens before onsite deployment. Capturers use this path only for approved assignments and review-gated payout eligibility.
                  </p>
                  <a
                    href="/sites"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-runway-text transition hover:text-runway-signal"
                  >
                    Explore sites
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>

              <div className="mt-8 grid gap-5 lg:grid-cols-[0.36fr_0.64fr]">
                <div className="border border-runway-line bg-runway-deep p-5">
                  <SurfaceMiniLabel className="text-runway-faint">Capture Opportunities</SurfaceMiniLabel>
                  <p className="mt-4 text-base leading-7 text-runway-body">
                    The public app is for ordinary places with useful robot workflows: store
                    aisles, lobbies, corridors, common areas, venues, and service spaces.
                    Accepted capture gear is a 360 camera and a smartphone; no other device class
                    is approved for assignments.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {captureLocationTypes.map((item) => (
                    <div key={item.label} className="border border-runway-line bg-runway-deep p-4">
                      <p className="text-sm font-semibold text-runway-text">{item.label}</p>
                      <p className="mt-2 text-sm leading-6 text-runway-mute">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </SurfaceBrowserFrame>
        </SurfaceSection>
      </SurfacePage>
    </>
  );
}
