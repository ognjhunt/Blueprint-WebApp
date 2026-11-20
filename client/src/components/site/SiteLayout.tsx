import type { PropsWithChildren } from "react";
import { useLocation } from "wouter";
import { MinimalSiteLayout } from "./MinimalSiteLayout";
import { isMinimalPublicPath } from "@/data/minimalPublicSite";
import { jobLibrarySignInHref } from "@/lib/robotTeamAccess";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function SiteLayout({ children }: PropsWithChildren) {
  const [location] = useLocation();
  if (isMinimalPublicPath(location)) {
    return <MinimalSiteLayout key={location} signInHref={location === "/contact/robot-team" ? jobLibrarySignInHref() : undefined}>{children}</MinimalSiteLayout>;
  }
  return (
    <div className="min-h-screen bg-runway-black text-runway-text">
      <Header />
      <main id="main-content" className="relative z-0 flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
