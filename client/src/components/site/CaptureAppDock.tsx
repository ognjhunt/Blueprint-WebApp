import { Download, Smartphone } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "wouter";
import { getCaptureAppPlaceholderUrl } from "@/lib/client-env";

function isExternalHref(value: string) {
  try {
    const url = new URL(value, "https://tryblueprint.io");
    return url.origin !== "https://tryblueprint.io";
  } catch {
    return false;
  }
}

function shouldShowDock(pathname: string) {
  const hiddenRoutes = [
    /^\/dashboard(?:\/|$)/,
    /^\/admin(?:\/|$)/,
    /^\/portal(?:\/|$)/,
    /^\/settings(?:\/|$)/,
    /^\/requests(?:\/|$)/,
    /^\/onboarding(?:\/|$)/,
    /^\/sign-in$/,
    /^\/login$/,
    /^\/signup(?:\/|$)/,
    /^\/forgot-password$/,
    /^\/world-models\/[^/]+\/(?:start|workspace)$/,
  ];

  return !hiddenRoutes.some((pattern) => pattern.test(pathname));
}

export function CaptureAppDock() {
  const [location] = useLocation();
  const captureAppHref = useMemo(() => getCaptureAppPlaceholderUrl(), []);
  const external = useMemo(() => isExternalHref(captureAppHref), [captureAppHref]);

  if (!shouldShowDock(location)) {
    return null;
  }

  return (
    <a
      href={captureAppHref}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer noopener" : undefined}
      className="fixed bottom-4 right-4 z-40 inline-flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-[1.4rem] border border-slate-200/90 bg-white/96 px-4 py-3 text-left shadow-[0_22px_54px_-30px_rgba(15,23,42,0.45)] backdrop-blur-md transition hover:border-slate-300 hover:bg-white"
      aria-label="Download the Blueprint app"
    >
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_12px_28px_-18px_rgba(15,23,42,0.9)]">
        <Smartphone className="h-5 w-5 opacity-90" />
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-emerald-500 text-white">
          <Download className="h-2.5 w-2.5" />
        </span>
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-950">Download the Blueprint app</span>
        <span className="block text-xs text-slate-500">
          For capturers and boots on the ground
        </span>
      </span>
    </a>
  );
}
