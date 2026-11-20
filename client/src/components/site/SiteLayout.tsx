import type { PropsWithChildren } from "react";
import { useLocation } from "wouter";
import { MinimalSiteLayout } from "./MinimalSiteLayout";
import { isMinimalPublicPath } from "@/data/minimalPublicSite";
import { BROWSE_JOBS_PATH, jobLibrarySignInHref } from "@/lib/robotTeamAccess";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function SiteLayout({ children }: PropsWithChildren) {
  const [location] = useLocation();
  if (isMinimalPublicPath(location)) {
    const browseCurrent = location === BROWSE_JOBS_PATH;
    return <MinimalSiteLayout key={location} browseCurrent={browseCurrent} signInHref={browseCurrent ? jobLibrarySignInHref() : undefined}>{children}</MinimalSiteLayout>;
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
