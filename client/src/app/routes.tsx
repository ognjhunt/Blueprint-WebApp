import { lazy } from "react";
import type { ComponentType } from "react";
import { MarketingRedirect } from "../pages/MarketingRedirect";

export type AppRoute = {
  path?: string;
  layout: "public" | "protected";
  shell?: "site" | "bare";
  // Some route components require `params` props from wouter dynamic segments.
  component: ComponentType<any>;
};

const Home = lazy(() => import("../pages/Home"));
const LaunchMap = lazy(() => import("../pages/LaunchMap"));
const Capture = lazy(() => import("../pages/Capture"));
const CaptureAppPlaceholder = lazy(() => import("../pages/CaptureAppPlaceholder"));
const CaptureLaunchAccess = lazy(() => import("../pages/CaptureLaunchAccess"));
const BusinessSignUpFlow = lazy(() => import("../pages/BusinessSignUpFlow"));
const CapturerSignUpFlow = lazy(() => import("../pages/CapturerSignUpFlow"));
const OnboardingChecklist = lazy(() => import("../pages/OnboardingChecklist"));
const ForSiteOperators = lazy(() => import("../pages/ForSiteOperators"));
const ForRobotIntegrators = lazy(() => import("../pages/ForRobotIntegrators"));
const SiteWorlds = lazy(() => import("../pages/SiteWorlds"));
const SiteWorldDetail = lazy(() => import("../pages/SiteWorldDetail"));
const HostedSessionSetup = lazy(() => import("../pages/HostedSessionSetup"));
const HostedSessionWorkspace = lazy(() => import("../pages/HostedSessionWorkspace"));
const Pricing = lazy(() => import("../pages/Pricing"));
const CaseStudies = lazy(() => import("../pages/CaseStudies"));
const SampleDeliverables = lazy(() => import("../pages/SampleDeliverables"));
const SampleEvaluation = lazy(() => import("../pages/SampleEvaluation"));
const Contact = lazy(() => import("../pages/Contact"));
const Support = lazy(() => import("../pages/Support"));
const ExactSiteHostedReview = lazy(() => import("../pages/ExactSiteHostedReview"));
const BookExactSiteReview = lazy(() => import("../pages/BookExactSiteReview"));
const HowItWorks = lazy(() => import("../pages/HowItWorks"));
const Proof = lazy(() => import("../pages/Proof"));
const Portal = lazy(() => import("../pages/Portal"));
const Login = lazy(() => import("../pages/Login"));
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"));
const Careers = lazy(() => import("../pages/Careers"));
const FAQ = lazy(() => import("../pages/FAQ"));
const Governance = lazy(() => import("../pages/Governance"));
const About = lazy(() => import("../pages/About"));
const Docs = lazy(() => import("../pages/Docs"));
const Blog = lazy(() => import("../pages/Blog"));
const Privacy = lazy(() => import("../pages/Privacy"));
const Terms = lazy(() => import("../pages/Terms"));
const Settings = lazy(() => import("../pages/Settings"));
const AdminLeads = lazy(() => import("../pages/AdminLeads"));
const AdminGrowthOpsScorecard = lazy(() => import("../pages/AdminGrowthOpsScorecard"));
const AdminAustinLaunchScorecard = lazy(() => import("../pages/AdminAustinLaunchScorecard"));
const AdminGrowthStudio = lazy(() => import("../pages/AdminGrowthStudio"));
const AdminCompanyMetrics = lazy(() => import("../pages/AdminCompanyMetrics"));
const Dashboard = lazy(() => import("../pages/Dashboard"));
const OffWaitlistSignUpFlow = lazy(() => import("../pages/OffWaitlistSignUpFlow"));
const RequestConsole = lazy(() => import("../pages/RequestConsole"));
const NotFound = lazy(() => import("../pages/NotFound"));
const CityLanding = lazy(() => import("../pages/CityLanding"));

// Legacy redirects
const LegacyPilotExchangeRedirect = () => (
  <MarketingRedirect to="/world-models" />
);

const LegacyPilotExchangeGuideRedirect = () => (
  <MarketingRedirect to="/world-models" />
);

const LegacyPartnersRedirect = () => (
  <MarketingRedirect to="/contact" />
);

const LegacyEnvironmentsRedirect = () => (
  <MarketingRedirect to="/world-models" />
);

// Redirects from old site-worlds paths to new world-models paths
const LegacySiteWorldsRedirect = () => (
  <MarketingRedirect to="/world-models" />
);

const LegacyReadinessPackRedirect = () => (
  <MarketingRedirect to="/how-it-works" />
);

const LegacySolutionsRedirect = () => (
  <MarketingRedirect to="/for-robot-teams" />
);

const LegacyQualifiedOpportunitiesRedirect = () => (
  <MarketingRedirect to="/world-models" />
);

const LegacyForRobotIntegratorsRedirect = () => (
  <MarketingRedirect to="/for-robot-teams" />
);

const LegacyLoginRedirect = () => (
  <MarketingRedirect to="/sign-in" />
);

const LegacyDocsRedirect = () => (
  <MarketingRedirect to="/sample-deliverables" />
);

export const appRoutes: AppRoute[] = [
  { path: "/", layout: "public", component: Home },
  { path: "/launch-map", layout: "public", component: LaunchMap },

  // Capture / Earn (new)
  { path: "/capture", layout: "public", component: Capture },
  { path: "/capture-app", layout: "public", shell: "bare", component: CaptureAppPlaceholder },
  { path: "/capture-app/launch-access", layout: "public", component: CaptureLaunchAccess },

  // City landing pages (auto-generated from city launch profile)
  { path: "/city/:citySlug", layout: "public", component: CityLanding },

  // World Models (renamed from site-worlds)
  { path: "/world-models", layout: "public", component: SiteWorlds },
  { path: "/world-models/:slug", layout: "public", component: SiteWorldDetail },
  { path: "/world-models/:slug/start", layout: "public", component: HostedSessionSetup },
  { path: "/world-models/:slug/workspace", layout: "public", shell: "bare", component: HostedSessionWorkspace },

  // Legacy site-worlds redirects
  { path: "/site-worlds", layout: "public", component: LegacySiteWorldsRedirect },
  { path: "/site-worlds/:slug", layout: "public", component: LegacySiteWorldsRedirect },
  { path: "/site-worlds/:slug/start", layout: "public", component: LegacySiteWorldsRedirect },
  { path: "/site-worlds/:slug/workspace", layout: "public", component: LegacySiteWorldsRedirect },

  // Persona pages
  { path: "/for-site-operators", layout: "public", component: ForSiteOperators },
  { path: "/for-robot-teams", layout: "public", component: ForRobotIntegrators },
  { path: "/for-robot-integrators", layout: "public", component: LegacyForRobotIntegratorsRedirect },

  // Core pages
  { path: "/pricing", layout: "public", component: Pricing },
  { path: "/sample-evaluation", layout: "public", component: SampleEvaluation },
  { path: "/sample-deliverables", layout: "public", component: SampleDeliverables },
  { path: "/case-studies", layout: "public", component: CaseStudies },
  { path: "/contact", layout: "public", component: Contact },
  { path: "/contact/site-operator", layout: "public", component: Contact },
  { path: "/help", layout: "public", component: Support },
  { path: "/help/contact", layout: "public", component: Support },
  { path: "/help/category/:categorySlug", layout: "public", component: Support },
  { path: "/help/article/:articleSlug", layout: "public", component: Support },
  { path: "/exact-site-hosted-review", layout: "public", component: ExactSiteHostedReview },
  { path: "/book-exact-site-review", layout: "public", component: BookExactSiteReview },
  { path: "/how-it-works", layout: "public", component: HowItWorks },
  { path: "/proof", layout: "public", component: Proof },
  { path: "/faq", layout: "public", component: FAQ },
  { path: "/governance", layout: "public", component: Governance },
  { path: "/about", layout: "public", component: About },
  { path: "/docs", layout: "public", component: LegacyDocsRedirect },
  { path: "/blog", layout: "public", component: Blog },
  { path: "/careers", layout: "public", component: Careers },

  // Legacy redirects for removed pages
  { path: "/solutions", layout: "public", component: LegacySolutionsRedirect },
  { path: "/quality-standard", layout: "public", component: LegacyReadinessPackRedirect },
  { path: "/readiness-pack", layout: "public", component: LegacyReadinessPackRedirect },
  { path: "/qualified-opportunities", layout: "public", component: LegacyQualifiedOpportunitiesRedirect },
  { path: "/qualified-opportunities-guide", layout: "public", component: LegacyQualifiedOpportunitiesRedirect },

  // Legacy redirects
  { path: "/pilot-exchange", layout: "public", component: LegacyPilotExchangeRedirect },
  { path: "/pilot-exchange-guide", layout: "public", component: LegacyPilotExchangeGuideRedirect },
  { path: "/partners", layout: "public", component: LegacyPartnersRedirect },
  { path: "/environments", layout: "public", component: LegacyEnvironmentsRedirect },

  // Auth & account
  { path: "/portal", layout: "public", shell: "bare", component: Portal },
  { path: "/sign-in", layout: "public", shell: "bare", component: Login },
  { path: "/login", layout: "public", component: LegacyLoginRedirect },
  { path: "/signup", layout: "public", shell: "bare", component: BusinessSignUpFlow },
  { path: "/signup/business", layout: "public", shell: "bare", component: BusinessSignUpFlow },
  { path: "/signup/capturer", layout: "public", shell: "bare", component: CapturerSignUpFlow },
  { path: "/onboarding", layout: "protected", component: OnboardingChecklist },
  { path: "/forgot-password", layout: "public", shell: "bare", component: ForgotPassword },
  { path: "/privacy", layout: "public", shell: "bare", component: Privacy },
  { path: "/terms", layout: "public", shell: "bare", component: Terms },
  { path: "/settings", layout: "public", shell: "bare", component: Settings },
  { path: "/requests/:requestId", layout: "public", shell: "bare", component: RequestConsole },
  { path: "/requests/:requestId/evidence", layout: "public", shell: "bare", component: RequestConsole },
  { path: "/requests/:requestId/qualification", layout: "public", shell: "bare", component: RequestConsole },
  { path: "/requests/:requestId/preview", layout: "public", shell: "bare", component: RequestConsole },

  // Admin
  { path: "/admin/leads", layout: "protected", component: AdminLeads },
  { path: "/admin/leads/:requestId", layout: "protected", component: AdminLeads },
  { path: "/admin/submissions", layout: "protected", component: AdminLeads },
  { path: "/admin/submissions/:requestId", layout: "protected", component: AdminLeads },
  { path: "/admin/growth-ops-scorecard", layout: "protected", component: AdminGrowthOpsScorecard },
  { path: "/admin/company-metrics", layout: "protected", component: AdminCompanyMetrics },
  { path: "/admin/city-launch/austin", layout: "protected", component: AdminAustinLaunchScorecard },
  { path: "/admin/city-launch/:citySlug", layout: "protected", component: AdminAustinLaunchScorecard },
  { path: "/admin/growth-studio", layout: "protected", component: AdminGrowthStudio },

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
