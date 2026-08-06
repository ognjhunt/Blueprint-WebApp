import type { PropsWithChildren } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { CaptureAppDock } from "./CaptureAppDock";

export function SiteLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-kinetic-white text-kinetic-graphite">
      <Header />
      <main id="main-content" className="relative z-0 flex-1">
        {children}
      </main>
      <CaptureAppDock />
      <Footer />
    </div>
  );
}
