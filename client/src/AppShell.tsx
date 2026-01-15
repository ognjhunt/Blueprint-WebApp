import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router as WouterRouter, type BaseLocationHook } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { CookieConsent } from "./components/CookieConsent";
import { Analytics } from "./components/Analytics";
import { AuthProvider } from "./contexts/AuthContext";
import { queryClient } from "./lib/queryClient";

type AppShellProps = {
  children: ReactNode;
  locationHook?: BaseLocationHook;
};

export function AppShell({ children, locationHook }: AppShellProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter hook={locationHook}>
        <AuthProvider>
          <Analytics />
          {children}
          <Toaster />
          <CookieConsent />
        </AuthProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}
