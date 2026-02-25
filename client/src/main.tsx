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

const withLayout = <P extends object>(Component: React.ComponentType<P>) =>
  (props: P) => (
    <SiteLayout>
      <Component {...props} />
    </SiteLayout>
  );

const withProtectedLayout = <P extends object>(
  Component: React.ComponentType<P>,
) =>
  (props: P) => (
    <ProtectedRoute>
      <SiteLayout>
        <Component {...props} />
      </SiteLayout>
    </ProtectedRoute>
  );

function Router() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Switch>
        {appRoutes.map((route, index) => {
          const wrappedComponent =
            route.layout === "protected"
              ? withProtectedLayout(route.component)
              : withLayout(route.component);

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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Analytics />
        <Router />
        <Toaster />
        <CookieConsent />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
