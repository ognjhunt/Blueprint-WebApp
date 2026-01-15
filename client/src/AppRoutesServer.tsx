import type { ComponentType } from "react";
import { Route, Switch } from "wouter";
import { SiteLayout } from "./components/site/SiteLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import WhySimulation from "./pages/WhySimulation";
import Environments from "./pages/Environments";
import EnvironmentDetail from "./pages/EnvironmentDetail";
import Solutions from "./pages/Solutions";
import Pricing from "./pages/Pricing";
import Learn from "./pages/Learn";
import Docs from "./pages/Docs";
import Evals from "./pages/Evals";
import BenchmarkDetail from "./pages/BenchmarkDetail";
import RLTraining from "./pages/RLTraining";
import CaseStudies from "./pages/CaseStudies";
import Careers from "./pages/Careers";
import Contact from "./pages/Contact";
import PartnerProgram from "./pages/PartnerProgram";
import Portal from "./pages/Portal";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const withLayout = <P extends object>(Component: ComponentType<P>) =>
  (props: P) => (
    <SiteLayout>
      <Component {...props} />
    </SiteLayout>
  );

const withProtectedLayout = <P extends object>(
  Component: ComponentType<P>,
) =>
  (props: P) => (
    <ProtectedRoute>
      <SiteLayout>
        <Component {...props} />
      </SiteLayout>
    </ProtectedRoute>
  );

export function AppRoutesServer() {
  return (
    <Switch>
      <Route path="/" component={withLayout(Home)} />
      <Route path="/why-simulation" component={withLayout(WhySimulation)} />
      {/* Primary route: /marketplace (canonical), /environments kept for backwards compatibility */}
      <Route path="/marketplace" component={withLayout(Environments)} />
      <Route path="/environments" component={withLayout(Environments)} />
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
      <Route path="/partners" component={withLayout(PartnerProgram)} />
      <Route path="/portal" component={withLayout(Portal)} />
      <Route path="/login" component={withLayout(Login)} />
      <Route path="/forgot-password" component={withLayout(ForgotPassword)} />
      <Route path="/privacy" component={withLayout(Privacy)} />
      <Route path="/terms" component={withLayout(Terms)} />
      <Route path="/settings" component={withLayout(Settings)} />
      <Route component={withLayout(NotFound)} />
    </Switch>
  );
}
