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
  const visibleRoutes = [
    /^\/capture-app$/,
    /^\/signup\/capturer$/,
  ];

  return visibleRoutes.some((pattern) => pattern.test(pathname));
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
      className="fixed bottom-4 right-4 z-40 inline-flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-[1.4rem] border border-runway-line/90 bg-runway-panel/95 px-4 py-3 text-left shadow-[0_22px_54px_-30px_rgba(15,23,42,0.45)] backdrop-blur-md transition hover:border-runway-line-strong hover:bg-paper-0"
      aria-label="Download the Blueprint app"
    >
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-none bg-runway-panel text-white shadow-[0_12px_28px_-18px_rgba(15,23,42,0.9)]">
        <Smartphone className="h-5 w-5 opacity-90" />
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-runway-green text-white">
          <Download className="h-2.5 w-2.5" />
        </span>
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-runway-text">Download the Blueprint app</span>
        <span className="block text-xs text-runway-faint">
          For capturers and boots on the ground
        </span>
      </span>
    </a>
  );
}
