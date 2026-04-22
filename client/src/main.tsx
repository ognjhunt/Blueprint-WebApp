import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Route, Switch } from "wouter";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { SiteLayout } from "./components/site/SiteLayout";
import { LoadingScreen } from "./components/site/LoadingScreen";
import { CookieConsent } from "./components/CookieConsent";
import { Analytics } from "./components/Analytics";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import { installClientLogger } from "./utils/clientLogger";
import { appRoutes } from "./app/routes";

installClientLogger();

const withShell =
  <P extends object>(
    Component: React.ComponentType<P>,
    options: { protectedRoute?: boolean; shell?: "site" | "bare" },
  ) =>
  (props: P) => {
    const content =
      options.shell === "bare" ? (
        <Component {...props} />
      ) : (
        <SiteLayout>
          <Component {...props} />
        </SiteLayout>
      );

    if (options.protectedRoute) {
      return <ProtectedRoute>{content}</ProtectedRoute>;
    }

    return content;
  };

function Router() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Switch>
        {appRoutes.map((route, index) => {
          const wrappedComponent = withShell(route.component, {
            protectedRoute: route.layout === "protected",
            shell: route.shell || "site",
          });

          if (!route.path) {
            return <Route key={`fallback-${index}`} component={wrappedComponent} />;
          }

          return (
            <Route
              key={`${route.path}-${index}`}
              path={route.path}
              component={wrappedComponent}
            />
          );
        })}
      </Switch>
    </Suspense>
  );
}

const app = (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Analytics />
        <Router />
        <Toaster />
        <CookieConsent />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);

const rootElement = document.getElementById("root")!;

// Prerendered HTML serves SEO crawlers that don't run JS.
// Lazy-loaded routes inside Suspense produce a LoadingScreen fallback on first
// render, which never matches the prerendered markup. React's hydration then
// fails and leaves duplicate DOM nodes. Clearing the prerendered content and
// using createRoot avoids the mismatch entirely — the JS bundle renders the
// real page almost immediately.
if (rootElement.hasChildNodes()) {
  rootElement.textContent = "";
}
createRoot(rootElement).render(app);
