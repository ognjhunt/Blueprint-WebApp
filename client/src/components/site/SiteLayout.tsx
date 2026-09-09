import type { PropsWithChildren } from "react";
import { useLocation } from "wouter";
import { MinimalSiteLayout } from "./MinimalSiteLayout";
import { minimalPublicPaths } from "@/data/minimalPublicSite";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { CaptureAppDock } from "./CaptureAppDock";

export function SiteLayout({ children }: PropsWithChildren) {
  const [location] = useLocation();
  if ((minimalPublicPaths as readonly string[]).includes(location.replace(/\/$/, "") || "/")) {
    return <MinimalSiteLayout key={location}>{children}</MinimalSiteLayout>;
  }
  return (
    <div className="min-h-screen bg-runway-black text-runway-text">
      <Header />
      <main id="main-content" className="relative z-0 flex-1">
        {children}
      </main>
      <CaptureAppDock />
      <Footer />
    </div>
  );
}
