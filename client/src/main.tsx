import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Route, Switch } from "wouter";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "@/lib/helmet";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { SiteLayout } from "./components/site/SiteLayout";
import { LoadingScreen } from "./components/site/LoadingScreen";
import { CookieConsent } from "./components/CookieConsent";
import { Analytics } from "./components/Analytics";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import { installClientLogger } from "./utils/clientLogger";
import { appRoutes, preloadMatchedRoute } from "./app/routes";

installClientLogger();

const withShell =
  <P extends object>(
    Component: React.ComponentType<P>,
    options: { gate?: "protected" | "admin"; shell?: "site" | "bare" },
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

    if (options.gate === "admin") {
      return <AdminProtectedRoute>{content}</AdminProtectedRoute>;
    }

    if (options.gate === "protected") {
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
            gate:
              route.layout === "admin"
                ? "admin"
                : route.layout === "protected"
                  ? "protected"
                  : undefined,
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
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Analytics />
          <Router />
          <Toaster />
          <CookieConsent />
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </StrictMode>
);

const rootElement = document.getElementById("root")!;

// Prerendered HTML serves SEO crawlers that don't run JS, and gives users a
// real first paint before the JS bundle runs. Hydrating it isn't viable here
// (prerendering uses renderToStaticMarkup, which emits no hydration markers),
// so we clear it and do a client render instead. Clearing immediately and
// rendering would otherwise flash the prerendered markup to blank + a
// LoadingScreen fallback while the matched route's lazy chunk loads, so when
// there's prerendered markup worth protecting we preload that chunk first and
// only swap once it (or a timeout) resolves. Routes with no prerendered markup
// (app-shell.html) have nothing to protect, so they mount immediately and get
// the normal Suspense LoadingScreen fallback like before.
const ROUTE_PRELOAD_TIMEOUT_MS = 3000;
const hasPrerenderedMarkup = rootElement.hasChildNodes();

function mountApp() {
  if (rootElement.hasChildNodes()) {
    rootElement.textContent = "";
  }
  createRoot(rootElement).render(app);
}

const routePreload = hasPrerenderedMarkup ? preloadMatchedRoute(window.location.pathname) : null;
if (routePreload) {
  const timeout = new Promise((resolve) => setTimeout(resolve, ROUTE_PRELOAD_TIMEOUT_MS));
  Promise.race([routePreload, timeout])
    .catch(() => {})
    .then(mountApp);
} else {
  mountApp();
}
