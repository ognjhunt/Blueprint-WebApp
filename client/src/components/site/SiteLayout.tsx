import type { PropsWithChildren } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function SiteLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />
      <main id="main-content" className="relative z-0 flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
