import { Suspense, lazy } from "react";
import type { ComponentType } from "react";
import { Route, Switch } from "wouter";
import { SiteLayout } from "./components/site/SiteLayout";
import { LoadingScreen } from "./components/site/LoadingScreen";
import ProtectedRoute from "./components/ProtectedRoute";
import {
  publicRouteAliases,
  publicRoutes,
  type PublicRouteEntry,
} from "./routes/publicRoutes";

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
const BenchmarkDetail = lazy(() => import("./pages/BenchmarkDetail"));
const RLTraining = lazy(() => import("./pages/RLTraining"));
const CaseStudies = lazy(() => import("./pages/CaseStudies"));
const Careers = lazy(() => import("./pages/Careers"));
const Contact = lazy(() => import("./pages/Contact"));
const PartnerProgram = lazy(() => import("./pages/PartnerProgram"));
const Portal = lazy(() => import("./pages/Portal"));
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

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

const publicRouteComponents: Record<
  PublicRouteEntry["path"],
  ComponentType<object>
> = {
  "/": Home,
  "/why-simulation": WhySimulation,
  "/marketplace": Environments,
  "/solutions": Solutions,
  "/pricing": Pricing,
  "/learn": Learn,
  "/docs": Docs,
  "/evals": Evals,
  "/benchmarks": Evals,
  "/rl-training": RLTraining,
  "/case-studies": CaseStudies,
  "/careers": Careers,
  "/contact": Contact,
  "/partners": PartnerProgram,
  "/privacy": Privacy,
  "/terms": Terms,
};

type AppRoutesProps = {
  publicRouteEntries?: PublicRouteEntry[];
};

export function AppRoutes({ publicRouteEntries = publicRoutes }: AppRoutesProps) {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Switch>
        {publicRouteEntries.map(({ path }) => {
          const Component = publicRouteComponents[path];
          if (!Component) {
            return null;
          }

          return (
            <Route key={path} path={path} component={withLayout(Component)} />
          );
        })}
        {publicRouteAliases.map((alias) => {
          const Component = publicRouteComponents[alias.aliasFor];
          if (!Component) {
            return null;
          }

          return (
            <Route
              key={alias.path}
              path={alias.path}
              component={withLayout(Component)}
            />
          );
        })}
        <Route
          path="/marketplace/:slug"
          component={withProtectedLayout(EnvironmentDetail)}
        />
        <Route
          path="/environments/:slug"
          component={withProtectedLayout(EnvironmentDetail)}
        />
        <Route
          path="/benchmarks/:slug"
          component={withProtectedLayout(BenchmarkDetail)}
        />
        <Route path="/portal" component={withLayout(Portal)} />
        <Route path="/login" component={withLayout(Login)} />
        <Route path="/forgot-password" component={withLayout(ForgotPassword)} />
        <Route path="/settings" component={withLayout(Settings)} />
        <Route component={withLayout(NotFound)} />
      </Switch>
    </Suspense>
  );
}
