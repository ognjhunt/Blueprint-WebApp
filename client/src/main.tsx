import { StrictMode, Suspense, lazy } from "react";
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

const Home = lazy(() => import("./pages/Home"));
const WhySimulation = lazy(() => import("./pages/WhySimulation"));
const Environments = lazy(() => import("./pages/Environments"));
// const Recipes = lazy(() => import("./pages/Recipes")); // Hidden: recipes temporarily removed from offerings
const EnvironmentDetail = lazy(() => import("./pages/EnvironmentDetail"));
const Solutions = lazy(() => import("./pages/Solutions"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Learn = lazy(() => import("./pages/Learn"));
// const Capture = lazy(() => import("./pages/Capture")); // Capture service coming Q2 2026
const Docs = lazy(() => import("./pages/Docs"));
const Evals = lazy(() => import("./pages/Evals"));
const CaseStudies = lazy(() => import("./pages/CaseStudies"));
const Careers = lazy(() => import("./pages/Careers"));
const Contact = lazy(() => import("./pages/Contact"));
const Portal = lazy(() => import("./pages/Portal"));
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
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
        <Route path="/why-simulation" component={withLayout(WhySimulation)} />
        <Route path="/environments" component={withLayout(Environments)} />
        {/* <Route path="/recipes" component={withLayout(Recipes)} /> */}{/* Hidden: recipes temporarily removed from offerings */}
        <Route
          path="/environments/:slug"
          component={withLayout(EnvironmentDetail)}
        />
        <Route path="/solutions" component={withLayout(Solutions)} />
        <Route path="/pricing" component={withLayout(Pricing)} />
        <Route path="/learn" component={withLayout(Learn)} />
        <Route path="/docs" component={withLayout(Docs)} />
        <Route path="/evals" component={withLayout(Evals)} />
        <Route path="/case-studies" component={withLayout(CaseStudies)} />
        <Route path="/careers" component={withLayout(Careers)} />
        <Route path="/contact" component={withLayout(Contact)} />
        <Route path="/portal" component={withLayout(Portal)} />
        <Route path="/login" component={withLayout(Login)} />
        <Route path="/forgot-password" component={withLayout(ForgotPassword)} />
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
      <Analytics />
      <Router />
      <Toaster />
      <CookieConsent />
    </QueryClientProvider>
  </StrictMode>,
);
