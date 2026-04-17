import { Smartphone } from "lucide-react";
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
  return [
    /^\/capture$/,
    /^\/capture-app$/,
    /^\/signup\/capturer$/,
  ].some((pattern) => pattern.test(pathname));
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
      className="fixed bottom-4 right-4 z-40 inline-flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-[1.35rem] border border-slate-200 bg-white px-4 py-3 text-left shadow-[0_18px_48px_-26px_rgba(15,23,42,0.45)] transition hover:border-slate-300 hover:bg-slate-50"
      aria-label="Open capture app"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
        <Smartphone className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-950">Open Capture App</span>
        <span className="block text-xs text-slate-500">Mobile handoff for Blueprint Capture</span>
      </span>
    </a>
  );
}
