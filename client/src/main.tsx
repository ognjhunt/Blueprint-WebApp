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
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import { installClientLogger } from "./utils/clientLogger";

installClientLogger();

const Home = lazy(() => import("./pages/Home"));
const WhySimulation = lazy(() => import("./pages/WhySimulation"));
const Environments = lazy(() => import("./pages/Environments"));
const BusinessSignUpFlow = lazy(() => import("./pages/BusinessSignUpFlow"));
const OnboardingChecklist = lazy(() => import("./pages/OnboardingChecklist"));
// const Recipes = lazy(() => import("./pages/Recipes")); // Hidden: recipes temporarily removed from offerings
const EnvironmentDetail = lazy(() => import("./pages/EnvironmentDetail"));
const Solutions = lazy(() => import("./pages/Solutions"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Learn = lazy(() => import("./pages/Learn"));
const Blog = lazy(() => import("./pages/Blog"));
const RoboticsOS = lazy(() => import("./pages/blog/RoboticsOS"));
const WorkplaceOS = lazy(() => import("./pages/blog/WorkplaceOS"));
const RestaurantOS = lazy(() => import("./pages/blog/RestaurantOS"));
const HospitalityOS = lazy(() => import("./pages/blog/HospitalityOS"));
const MuseumOS = lazy(() => import("./pages/blog/MuseumOS"));
const PropertyOS = lazy(() => import("./pages/blog/PropertyOS"));
const RetailOS = lazy(() => import("./pages/blog/RetailOS"));
const WarehouseOS = lazy(() => import("./pages/blog/WarehouseOS"));
// const Capture = lazy(() => import("./pages/Capture")); // Capture service coming Q2 2026
const Docs = lazy(() => import("./pages/Docs"));
const Evals = lazy(() => import("./pages/Evals"));
const BenchmarkDetail = lazy(() => import("./pages/BenchmarkDetail"));
const RLTraining = lazy(() => import("./pages/RLTraining"));
const CaseStudies = lazy(() => import("./pages/CaseStudies"));
const Careers = lazy(() => import("./pages/Careers"));
const Contact = lazy(() => import("./pages/Contact"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const PilotExchange = lazy(() => import("./pages/PilotExchange"));
const PartnerProgram = lazy(() => import("./pages/PartnerProgram"));
const Portal = lazy(() => import("./pages/Portal"));
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminLeads = lazy(() => import("./pages/AdminLeads"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
        <Route path="/" component={withLayout(Home)} />
        <Route path="/why-simulation" component={withLayout(WhySimulation)} />
        {/* Primary route: /marketplace (canonical), /environments kept for backwards compatibility */}
        <Route path="/marketplace" component={withLayout(Environments)} />
        <Route path="/marketplace/scenes" component={withLayout(Environments)} />
        <Route path="/marketplace/datasets" component={withLayout(Environments)} />
        <Route path="/environments" component={withLayout(Environments)} />
        <Route
          path="/marketplace/scenes/:slug"
          component={withProtectedLayout(EnvironmentDetail)}
        />
        <Route
          path="/marketplace/datasets/:slug"
          component={withProtectedLayout(EnvironmentDetail)}
        />
        <Route
          path="/marketplace/:slug"
          component={withProtectedLayout(EnvironmentDetail)}
        />
        <Route
          path="/environments/:slug"
          component={withProtectedLayout(EnvironmentDetail)}
        />
        <Route path="/solutions" component={withLayout(Solutions)} />
        <Route path="/pricing" component={withLayout(Pricing)} />
        <Route path="/learn" component={withLayout(Learn)} />
        <Route path="/blog" component={Blog} />
        <Route path="/blog/robotics-os" component={RoboticsOS} />
        <Route path="/blog/workplace-os" component={WorkplaceOS} />
        <Route path="/blog/restaurant-os" component={RestaurantOS} />
        <Route path="/blog/hospitality-os" component={HospitalityOS} />
        <Route path="/blog/museum-os" component={MuseumOS} />
        <Route path="/blog/property-os" component={PropertyOS} />
        <Route path="/blog/retail-os" component={RetailOS} />
        <Route path="/blog/warehouse-os" component={WarehouseOS} />
        <Route path="/docs" component={withLayout(Docs)} />
        <Route path="/evals" component={withLayout(Evals)} />
        <Route path="/benchmarks" component={withLayout(Evals)} />
        <Route
          path="/benchmarks/:slug"
          component={withProtectedLayout(BenchmarkDetail)}
        />
        <Route path="/rl-training" component={withLayout(RLTraining)} />
        <Route path="/case-studies" component={withLayout(CaseStudies)} />
        <Route path="/careers" component={withLayout(Careers)} />
        <Route path="/contact" component={withLayout(Contact)} />
        <Route path="/how-it-works" component={withLayout(HowItWorks)} />
        <Route path="/pilot-exchange" component={withLayout(PilotExchange)} />
        <Route path="/partners" component={withLayout(PartnerProgram)} />
        <Route path="/portal" component={withLayout(Portal)} />
        <Route path="/login" component={withLayout(Login)} />
        <Route path="/signup" component={withLayout(BusinessSignUpFlow)} />
        <Route path="/signup/business" component={withLayout(BusinessSignUpFlow)} />
        <Route path="/onboarding" component={withProtectedLayout(OnboardingChecklist)} />
        <Route path="/forgot-password" component={withLayout(ForgotPassword)} />
        <Route path="/privacy" component={withLayout(Privacy)} />
        <Route path="/terms" component={withLayout(Terms)} />
        <Route path="/settings" component={withLayout(Settings)} />
        {/* Admin routes */}
        <Route path="/admin/leads" component={withProtectedLayout(AdminLeads)} />
        <Route path="/admin/leads/:requestId" component={withProtectedLayout(AdminLeads)} />
        <Route component={withLayout(NotFound)} />
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
