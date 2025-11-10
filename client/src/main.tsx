import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { Route, Switch } from "wouter";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { SiteLayout } from "./components/site/SiteLayout";
import { LoadingScreen } from "./components/site/LoadingScreen";

const Home = lazy(() => import("./pages/Home"));
const Environments = lazy(() => import("./pages/Environments"));
const EnvironmentDetail = lazy(() => import("./pages/EnvironmentDetail"));
const Solutions = lazy(() => import("./pages/Solutions"));
const Docs = lazy(() => import("./pages/Docs"));
const CaseStudies = lazy(() => import("./pages/CaseStudies"));
const Careers = lazy(() => import("./pages/Careers"));
const Contact = lazy(() => import("./pages/Contact"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const NotFound = lazy(() => import("./pages/NotFound"));

const withLayout = <P extends object>(Component: React.ComponentType<P>) =>
  (props: P) => (
    <SiteLayout>
      <Component {...props} />
    </SiteLayout>
  );

function Router() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Switch>
        <Route path="/" component={withLayout(Home)} />
        <Route path="/environments" component={withLayout(Environments)} />
        <Route
          path="/environments/:slug"
          component={withLayout(EnvironmentDetail)}
        />
        <Route path="/solutions" component={withLayout(Solutions)} />
        <Route path="/docs" component={withLayout(Docs)} />
        <Route path="/case-studies" component={withLayout(CaseStudies)} />
        <Route path="/careers" component={withLayout(Careers)} />
        <Route path="/contact" component={withLayout(Contact)} />
        <Route path="/privacy" component={withLayout(Privacy)} />
        <Route path="/terms" component={withLayout(Terms)} />
        <Route component={withLayout(NotFound)} />
      </Switch>
    </Suspense>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
);
