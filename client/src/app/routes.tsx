import { lazy } from "react";
import type { ComponentType } from "react";
import { MarketingRedirect } from "../pages/MarketingRedirect";

export type AppRoute = {
  path?: string;
  layout: "public" | "protected";
  // Some route components require `params` props from wouter dynamic segments.
  component: ComponentType<any>;
};

const Home = lazy(() => import("../pages/Home"));
const Capture = lazy(() => import("../pages/Capture"));
const Environments = lazy(() => import("../pages/Environments"));
const BusinessSignUpFlow = lazy(() => import("../pages/BusinessSignUpFlow"));
const OnboardingChecklist = lazy(() => import("../pages/OnboardingChecklist"));
const EnvironmentDetail = lazy(() => import("../pages/EnvironmentDetail"));
const Solutions = lazy(() => import("../pages/Solutions"));
const ForSiteOperators = lazy(() => import("../pages/ForSiteOperators"));
const ForRobotIntegrators = lazy(() => import("../pages/ForRobotIntegrators"));
const SiteWorlds = lazy(() => import("../pages/SiteWorlds"));
const SiteWorldDetail = lazy(() => import("../pages/SiteWorldDetail"));
const HostedSessionSetup = lazy(() => import("../pages/HostedSessionSetup"));
const HostedSessionWorkspace = lazy(() => import("../pages/HostedSessionWorkspace"));
const Pricing = lazy(() => import("../pages/Pricing"));
const Contact = lazy(() => import("../pages/Contact"));
const HowItWorks = lazy(() => import("../pages/HowItWorks"));
const ReadinessPack = lazy(() => import("../pages/ReadinessPack"));
const PilotExchange = lazy(() => import("../pages/PilotExchange"));
const PilotExchangeGuide = lazy(() => import("../pages/PilotExchangeGuide"));
const Portal = lazy(() => import("../pages/Portal"));
const Login = lazy(() => import("../pages/Login"));
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"));
const Privacy = lazy(() => import("../pages/Privacy"));
const Terms = lazy(() => import("../pages/Terms"));
const Settings = lazy(() => import("../pages/Settings"));
const AdminLeads = lazy(() => import("../pages/AdminLeads"));
const Dashboard = lazy(() => import("../pages/Dashboard"));
const OffWaitlistSignUpFlow = lazy(() => import("../pages/OffWaitlistSignUpFlow"));
const NotFound = lazy(() => import("../pages/NotFound"));

// Legacy redirects
const LegacyPilotExchangeRedirect = () => (
  <MarketingRedirect to="/qualified-opportunities" />
);

const LegacyPilotExchangeGuideRedirect = () => (
  <MarketingRedirect to="/qualified-opportunities-guide" />
);

const LegacyPartnersRedirect = () => (
  <MarketingRedirect to="/contact" />
);

const LegacyDeploymentMarketplaceRedirect = () => (
  <MarketingRedirect to="/qualified-opportunities" />
);

const LegacyDeploymentMarketplaceGuideRedirect = () => (
  <MarketingRedirect to="/qualified-opportunities-guide" />
);

// Redirects from old site-worlds paths to new world-models paths
const LegacySiteWorldsRedirect = () => (
  <MarketingRedirect to="/world-models" />
);

const LegacyReadinessPackRedirect = () => (
  <MarketingRedirect to="/quality-standard" />
);

const LegacyForRobotIntegratorsRedirect = () => (
  <MarketingRedirect to="/for-robot-teams" />
);

export const appRoutes: AppRoute[] = [
  { path: "/", layout: "public", component: Home },

  // Capture / Earn (new)
  { path: "/capture", layout: "public", component: Capture },

  // World Models (renamed from site-worlds)
  { path: "/world-models", layout: "public", component: SiteWorlds },
  { path: "/world-models/:slug", layout: "public", component: SiteWorldDetail },
  { path: "/world-models/:slug/start", layout: "public", component: HostedSessionSetup },
  { path: "/world-models/:slug/workspace", layout: "public", component: HostedSessionWorkspace },

  // Legacy site-worlds redirects
  { path: "/site-worlds", layout: "public", component: LegacySiteWorldsRedirect },
  { path: "/site-worlds/:slug", layout: "public", component: LegacySiteWorldsRedirect },
  { path: "/site-worlds/:slug/start", layout: "public", component: LegacySiteWorldsRedirect },
  { path: "/site-worlds/:slug/workspace", layout: "public", component: LegacySiteWorldsRedirect },

  // Persona pages
  { path: "/for-site-operators", layout: "public", component: ForSiteOperators },
  { path: "/for-robot-teams", layout: "public", component: ForRobotIntegrators },
  { path: "/for-robot-integrators", layout: "public", component: LegacyForRobotIntegratorsRedirect },

  // Marketplace (redirects to world-models)
  { path: "/marketplace", layout: "public", component: Environments },
  { path: "/marketplace/scenes", layout: "public", component: Environments },
  { path: "/marketplace/datasets", layout: "public", component: Environments },
  { path: "/environments", layout: "public", component: Environments },
  {
    path: "/marketplace/scenes/:slug",
    layout: "protected",
    component: EnvironmentDetail,
  },
  {
    path: "/marketplace/datasets/:slug",
    layout: "protected",
    component: EnvironmentDetail,
  },
  { path: "/marketplace/:slug", layout: "protected", component: EnvironmentDetail },
  { path: "/environments/:slug", layout: "protected", component: EnvironmentDetail },

  // Core pages
  { path: "/solutions", layout: "public", component: Solutions },
  { path: "/pricing", layout: "public", component: Pricing },
  { path: "/contact", layout: "public", component: Contact },
  { path: "/how-it-works", layout: "public", component: HowItWorks },
  { path: "/quality-standard", layout: "public", component: ReadinessPack },
  { path: "/readiness-pack", layout: "public", component: LegacyReadinessPackRedirect },
  { path: "/qualified-opportunities", layout: "public", component: PilotExchange },
  {
    path: "/qualified-opportunities-guide",
    layout: "public",
    component: PilotExchangeGuide,
  },

  // Legacy redirects
  {
    path: "/deployment-marketplace",
    layout: "public",
    component: LegacyDeploymentMarketplaceRedirect,
  },
  {
    path: "/deployment-marketplace-guide",
    layout: "public",
    component: LegacyDeploymentMarketplaceGuideRedirect,
  },
  { path: "/pilot-exchange", layout: "public", component: LegacyPilotExchangeRedirect },
  { path: "/pilot-exchange-guide", layout: "public", component: LegacyPilotExchangeGuideRedirect },
  { path: "/partners", layout: "public", component: LegacyPartnersRedirect },

  // Auth & account
  { path: "/portal", layout: "public", component: Portal },
  { path: "/login", layout: "public", component: Login },
  { path: "/signup", layout: "public", component: BusinessSignUpFlow },
  { path: "/signup/business", layout: "public", component: BusinessSignUpFlow },
  { path: "/onboarding", layout: "protected", component: OnboardingChecklist },
  { path: "/forgot-password", layout: "public", component: ForgotPassword },
  { path: "/privacy", layout: "public", component: Privacy },
  { path: "/terms", layout: "public", component: Terms },
  { path: "/settings", layout: "public", component: Settings },

  // Admin
  { path: "/admin/leads", layout: "protected", component: AdminLeads },
  { path: "/admin/leads/:requestId", layout: "protected", component: AdminLeads },
  { path: "/admin/submissions", layout: "protected", component: AdminLeads },
  { path: "/admin/submissions/:requestId", layout: "protected", component: AdminLeads },

  // Dashboard
  { path: "/dashboard", layout: "protected", component: Dashboard },
  {
    path: "/off-waitlist-signup",
    layout: "public",
    component: OffWaitlistSignUpFlow,
  },

  // 404
  { layout: "public", component: NotFound },
];
