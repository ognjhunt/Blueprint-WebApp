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
import { privateGeneratedAssets } from "@/lib/privateGeneratedAssets";

const steps = [
  {
    label: "Plan",
    body: "Map the route, confirm the access path, and identify the zones that matter.",
  },
  {
    label: "Capture",
    body: "Record one usable walkthrough with the device you actually plan to use.",
  },
  {
    label: "Process",
    body: "Blueprint reviews coverage and turns the usable record into site-specific output.",
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
  const { data: publicLaunchStatus } = usePublicLaunchStatus();
  const launchCities = publicLaunchStatus?.supportedCities ?? [];
  const [qrCode, setQrCode] = useState("");

  const launchCityLabels = useMemo(() => launchCities.map((city) => city.displayName), [launchCities]);

  useEffect(() => {
    let active = true;

    async function renderQr() {
      try {
        const qrcode = await import("qrcode");
        const dataUrl = await qrcode.toDataURL(captureAppUrl, {
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
  }, [captureAppUrl]);

  return (
    <>
      <SEO
        title="Capture App | Blueprint"
        description="Open the Blueprint capture app or request invite-gated capturer access."
        canonical="/capture-app"
        noIndex
      />

      <SurfacePage>
        <SurfaceTopBar eyebrow="Capture Access" rightLabel="Invite-Gated Handoff" />
        <SurfaceSection className="py-8">
          <SurfaceBrowserFrame className="overflow-hidden">
            <div className="grid xl:grid-cols-[0.56fr_0.44fr]">
              <div className="relative min-h-[42rem] overflow-hidden bg-black text-white">
                <img
                  src={privateGeneratedAssets.captureAppAisle}
                  alt="Blueprint capture aisle"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.76),rgba(0,0,0,0.38)_58%,rgba(0,0,0,0.18))]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4 text-[11px] uppercase tracking-[0.22em] text-white/58">
                  <span>Capture App</span>
                  <span>Capturer Access</span>
                  <span>Capture Basics</span>
                </div>
                <div className="relative flex h-full items-end px-6 py-8 lg:px-8">
                  <div className="max-w-[28rem]">
                    <SurfaceMiniLabel className="text-white/52">Public Capture Handoff</SurfaceMiniLabel>
                    <h1 className="mt-5 text-[clamp(3.5rem,7vw,6rem)] font-semibold uppercase leading-[0.86] tracking-[-0.08em] text-white">
                      Exact site.
                      <br />
                      Captured.
                    </h1>
                    <p className="mt-5 max-w-[22rem] text-base leading-8 text-white/76">
                      Open the Blueprint Capture App if you already have access. If you still need
                      approval, route through the capturer application first.
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
                          href="mailto:hello@tryblueprint.io?subject=Blueprint%20Capture%20App%20Access"
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
                      <span className="text-[10px] uppercase tracking-[0.22em] text-white/45">Invite required</span>
                    </div>
                    <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
                      <p className="text-center text-sm font-semibold uppercase tracking-[0.22em] text-white/56">
                        Scan to open
                      </p>
                      <div className="mt-4 flex justify-center">
                        <div className="rounded-[1.35rem] border border-white/8 bg-[#f8f5ee] p-3">
                          {qrCode ? (
                            <img
                              src={qrCode}
                              alt="QR code for the Blueprint Capture App"
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
                        Approved capturers can use this stable handoff even if the downstream app
                        surface changes.
                      </p>
                    </div>
                    <div className="mt-5">
                      <SurfaceButton href={captureAppUrl} tone="secondary" className="w-full rounded-full">
                        Open the capture app
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
                          Capture access only opens inside approved launch cities. Unsupported
                          markets stay in the future-city queue until the launch org opens them.
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
                    Robot teams should browse exact-site worlds and hosted review, not the capturer
                    application flow.
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
            </div>
          </SurfaceBrowserFrame>
        </SurfaceSection>
      </SurfacePage>
    </>
  );
}
