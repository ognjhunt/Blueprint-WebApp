import { lazy } from "react";
import type { ComponentType } from "react";
import { MarketingRedirect } from "../pages/MarketingRedirect";
import { getSiteLibrarySite } from "../data/siteLibrary";

export type AppRoute = {
  path?: string;
  layout: "public" | "protected";
  shell?: "site" | "bare";
  // Some route components require `params` props from wouter dynamic segments.
  component: ComponentType<any>;
};

const Home = lazy(() => import("../pages/Home"));
const Capture = lazy(() => import("../pages/Capture"));
const CaptureAppPlaceholder = lazy(() => import("../pages/CaptureAppPlaceholder"));
const CaptureLaunchAccess = lazy(() => import("../pages/CaptureLaunchAccess"));
const BusinessSignUpFlow = lazy(() => import("../pages/BusinessSignUpFlow"));
const CapturerSignUpFlow = lazy(() => import("../pages/CapturerSignUpFlow"));
const OnboardingChecklist = lazy(() => import("../pages/OnboardingChecklist"));
const HostedSessionSetup = lazy(() => import("../pages/HostedSessionSetup"));
const HostedSessionWorkspace = lazy(() => import("../pages/HostedSessionWorkspace"));
const RobotTeamEval = lazy(() => import("../pages/RobotTeamEval"));
const Sites = lazy(() => import("../pages/Sites"));
const SiteDetail = lazy(() => import("../pages/SiteDetail"));
const Pricing = lazy(() => import("../pages/Pricing"));
const Contact = lazy(() => import("../pages/Contact"));
const Proof = lazy(() => import("../pages/Proof"));
const Portal = lazy(() => import("../pages/Portal"));
const Login = lazy(() => import("../pages/Login"));
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"));
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
const DesignSystem = lazy(() => import("../pages/DesignSystem"));

// Redesign — public pages (distinct surfaces per SCREENS.md)
const About = lazy(() => import("../pages/About"));
const Governance = lazy(() => import("../pages/Governance"));
const HowItWorks = lazy(() => import("../pages/HowItWorks"));
const ForRobotTeams = lazy(() => import("../pages/ForRobotTeams"));
const ForSiteOperators = lazy(() => import("../pages/ForSiteOperators"));
const JoinBlueprint = lazy(() => import("../pages/JoinBlueprint"));

// Redesign — buyer app (mock-data demo surfaces)
const AppOverview = lazy(() => import("../pages/app/Overview"));
const AppRuns = lazy(() => import("../pages/app/Runs"));
const AppRunDetail = lazy(() => import("../pages/app/RunDetail"));
const AppSitePacks = lazy(() => import("../pages/app/SitePacks"));
const AppSiteDetail = lazy(() => import("../pages/app/SiteDetail"));
const AppPolicies = lazy(() => import("../pages/app/Policies"));
const AppDataPackages = lazy(() => import("../pages/app/DataPackages"));
const AppEntitlements = lazy(() => import("../pages/app/Entitlements"));

// Redesign — ops console (mock-data demo surfaces)
const OpsQueue = lazy(() => import("../pages/ops/Queue"));
const OpsCaptureSupply = lazy(() => import("../pages/ops/CaptureSupply"));
const OpsCityLaunch = lazy(() => import("../pages/ops/CityLaunch"));
const OpsEvidenceReview = lazy(() => import("../pages/ops/EvidenceReview"));
const OpsBuyerHandoff = lazy(() => import("../pages/ops/BuyerHandoff"));
const OpsSpendControls = lazy(() => import("../pages/ops/SpendControls"));

const NotFound = lazy(() => import("../pages/NotFound"));

const HomeRedirect = () => <MarketingRedirect to="/" />;

const HowItWorksRedirect = () => <MarketingRedirect to="/#how-it-works" />;

const ProofRedirect = () => <MarketingRedirect to="/proof" />;

const SitesRedirect = () => <MarketingRedirect to="/sites" />;

const ContactRedirect = () => (
  <MarketingRedirect to="/contact/robot-team?persona=robot-team&source=public-route-redirect" />
);

const LegacyCaptureJobsRedirect = () => (
  <MarketingRedirect to="/capture" />
);

// Legacy redirects
const LegacyPilotExchangeRedirect = () => (
  <MarketingRedirect to="/proof" />
);

const LegacyPilotExchangeGuideRedirect = () => (
  <MarketingRedirect to="/proof" />
);

const LegacyPartnersRedirect = () => (
  <MarketingRedirect to="/contact/robot-team" />
);

const LegacyEnvironmentsRedirect = () => (
  <MarketingRedirect to="/proof" />
);

const LegacySiteLibraryDetailRedirect = ({
  params,
}: {
  params?: { slug?: string };
}) => {
  const site = getSiteLibrarySite(params?.slug);
  return <MarketingRedirect to={site ? `/sites/${site.slug}` : "/sites"} />;
};

const LegacySiteWorldsRedirect = () => <MarketingRedirect to="/sites" />;

const LegacyReadinessPackRedirect = () => (
  <MarketingRedirect to="/#how-it-works" />
);

const LegacySolutionsRedirect = () => (
  <MarketingRedirect to="/#how-it-works" />
);

const LegacyQualifiedOpportunitiesRedirect = () => (
  <MarketingRedirect to="/proof" />
);

const LegacyForRobotIntegratorsRedirect = () => (
  <MarketingRedirect to="/" />
);

const LegacyForSiteOperatorsRedirect = () => (
  <MarketingRedirect to="/contact/site-operator" />
);

const LegacyHostedReviewRedirect = () => (
  <MarketingRedirect to="/#how-it-works" />
);

const LegacyProofStoryRedirect = () => (
  <MarketingRedirect to="/proof" />
);

const LegacyBookExactSiteReviewRedirect = () => (
  <MarketingRedirect to="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=book-exact-site-review" />
);

const LegacyBlogRedirect = () => (
  <MarketingRedirect to="/" />
);

const LegacyLoginRedirect = () => (
  <MarketingRedirect to="/sign-in" />
);

const RobotTeamSignupRedirect = () => (
  <MarketingRedirect to="/signup/business?buyerType=robot_team&source=signup-route" />
);

const SiteOperatorSignupRedirect = () => (
  <MarketingRedirect to="/signup/business?buyerType=site_operator&source=signup-route" />
);

const LegacyDocsRedirect = () => (
  <MarketingRedirect to="/proof" />
);

export const appRoutes: AppRoute[] = [
  { path: "/", layout: "public", component: Home },
  { path: "/launch-map", layout: "public", component: ContactRedirect },

  // Capture / Earn direct flows
  { path: "/capture", layout: "public", component: Capture },
  { path: "/capture-app", layout: "public", shell: "bare", component: CaptureAppPlaceholder },
  { path: "/capture-app/launch-access", layout: "public", component: CaptureLaunchAccess },
  { path: "/capture-jobs", layout: "public", component: LegacyCaptureJobsRedirect },
  { path: "/capture-network", layout: "public", component: LegacyCaptureJobsRedirect },
  { path: "/capturer", layout: "public", component: LegacyCaptureJobsRedirect },
  { path: "/capturers", layout: "public", component: LegacyCaptureJobsRedirect },
  { path: "/capturer-access", layout: "public", component: LegacyCaptureJobsRedirect },
  { path: "/become-a-capturer", layout: "public", component: LegacyCaptureJobsRedirect },
  { path: "/for-capturers", layout: "public", component: LegacyCaptureJobsRedirect },
  { path: "/earn", layout: "public", component: LegacyCaptureJobsRedirect },

  // City landing aliases stay request-first instead of implying open city coverage.
  { path: "/city/:citySlug", layout: "public", component: ContactRedirect },

  // Site library is the public discovery surface; site-world internals remain backend/API vocabulary.
  { path: "/sites", layout: "public", component: Sites },
  { path: "/sites/:slug", layout: "public", component: SiteDetail },

  // Legacy world-model catalog/detail URLs map into the Sites library.
  { path: "/world-models", layout: "public", component: SitesRedirect },
  { path: "/world-models/:slug", layout: "public", component: LegacySiteLibraryDetailRedirect },
  { path: "/world-models/:slug/start", layout: "public", component: HostedSessionSetup },
  { path: "/world-models/:slug/workspace", layout: "public", shell: "bare", component: HostedSessionWorkspace },

  // Legacy site-worlds redirects
  { path: "/site-worlds", layout: "public", component: LegacySiteWorldsRedirect },
  { path: "/site-worlds/:slug", layout: "public", component: LegacySiteLibraryDetailRedirect },
  { path: "/site-worlds/:slug/start", layout: "public", component: LegacySiteLibraryDetailRedirect },
  { path: "/site-worlds/:slug/workspace", layout: "public", component: LegacySiteLibraryDetailRedirect },

  // Persona pages
  { path: "/for-site-operators", layout: "public", component: ForSiteOperators },
  { path: "/for-robot-teams", layout: "public", component: ForRobotTeams },
  { path: "/robot-team/eval", layout: "public", component: RobotTeamEval },
  { path: "/for-robot-integrators", layout: "public", component: LegacyForRobotIntegratorsRedirect },

  // Core pages
  { path: "/product", layout: "public", component: HowItWorksRedirect },
  { path: "/readiness", layout: "public", component: HowItWorksRedirect },
  { path: "/readiness-pack", layout: "public", component: LegacyReadinessPackRedirect },
  { path: "/agents", layout: "public", component: ContactRedirect },
  { path: "/pricing", layout: "public", component: Pricing },
  { path: "/sample-evaluation", layout: "public", component: LegacyProofStoryRedirect },
  { path: "/sample-deliverables", layout: "public", component: ProofRedirect },
  { path: "/case-studies", layout: "public", component: LegacyProofStoryRedirect },
  { path: "/contact", layout: "public", component: ContactRedirect },
  { path: "/contact/robot-team", layout: "public", component: Contact },
  { path: "/contact/site-operator", layout: "public", component: Contact },
  { path: "/help", layout: "public", component: ContactRedirect },
  { path: "/help/contact", layout: "public", component: ContactRedirect },
  { path: "/help/category/:categorySlug", layout: "public", component: ContactRedirect },
  { path: "/help/article/:articleSlug", layout: "public", component: ContactRedirect },
  { path: "/exact-site-hosted-review", layout: "public", component: LegacyHostedReviewRedirect },
  { path: "/book-exact-site-review", layout: "public", component: LegacyBookExactSiteReviewRedirect },
  { path: "/how-it-works", layout: "public", component: HowItWorks },
  { path: "/proof", layout: "public", component: Proof },
  { path: "/faq", layout: "public", component: ProofRedirect },
  { path: "/governance", layout: "public", component: Governance },
  { path: "/about", layout: "public", component: About },
  { path: "/docs", layout: "public", component: LegacyDocsRedirect },
  { path: "/updates", layout: "public", component: HomeRedirect },
  { path: "/blog", layout: "public", component: LegacyBlogRedirect },
  { path: "/careers", layout: "public", component: ContactRedirect },

  // Legacy redirects for removed pages
  { path: "/solutions", layout: "public", component: LegacySolutionsRedirect },
  { path: "/quality-standard", layout: "public", component: LegacyReadinessPackRedirect },
  { path: "/qualified-opportunities", layout: "public", component: LegacyQualifiedOpportunitiesRedirect },
  { path: "/qualified-opportunities-guide", layout: "public", component: LegacyQualifiedOpportunitiesRedirect },

  // Legacy redirects
  { path: "/pilot-exchange", layout: "public", component: LegacyPilotExchangeRedirect },
  { path: "/pilot-exchange-guide", layout: "public", component: LegacyPilotExchangeGuideRedirect },
  { path: "/partners", layout: "public", component: LegacyPartnersRedirect },
  { path: "/environments", layout: "public", component: LegacyEnvironmentsRedirect },
  { path: "/marketplace", layout: "public", component: SitesRedirect },

  // Auth & account
  { path: "/portal", layout: "public", shell: "bare", component: Portal },
  { path: "/sign-in", layout: "public", shell: "bare", component: Login },
  { path: "/login", layout: "public", component: LegacyLoginRedirect },
  { path: "/signup", layout: "public", shell: "bare", component: BusinessSignUpFlow },
  { path: "/signup/business", layout: "public", shell: "bare", component: BusinessSignUpFlow },
  { path: "/signup/robot-team", layout: "public", shell: "bare", component: RobotTeamSignupRedirect },
  { path: "/signup/site-operator", layout: "public", shell: "bare", component: SiteOperatorSignupRedirect },
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
  { path: "/internal/design-system", layout: "public", shell: "bare", component: DesignSystem },
  {
    path: "/off-waitlist-signup",
    layout: "public",
    component: OffWaitlistSignUpFlow,
  },

  // Redesign — sign-up (two-pane stepped wizard)
  { path: "/join", layout: "public", shell: "bare", component: JoinBlueprint },

  // Redesign — buyer app (mock-data demo; own app shell, no SiteLayout)
  { path: "/app", layout: "public", shell: "bare", component: AppOverview },
  { path: "/app/runs", layout: "public", shell: "bare", component: AppRuns },
  { path: "/app/runs/:runId", layout: "public", shell: "bare", component: AppRunDetail },
  { path: "/app/packs", layout: "public", shell: "bare", component: AppSitePacks },
  { path: "/app/packs/:siteId", layout: "public", shell: "bare", component: AppSiteDetail },
  { path: "/app/policies", layout: "public", shell: "bare", component: AppPolicies },
  { path: "/app/data", layout: "public", shell: "bare", component: AppDataPackages },
  { path: "/app/entitlements", layout: "public", shell: "bare", component: AppEntitlements },

  // Redesign — ops console (mock-data demo; own ops shell, no SiteLayout)
  { path: "/ops", layout: "public", shell: "bare", component: OpsQueue },
  { path: "/ops/supply", layout: "public", shell: "bare", component: OpsCaptureSupply },
  { path: "/ops/city-launch", layout: "public", shell: "bare", component: OpsCityLaunch },
  { path: "/ops/evidence", layout: "public", shell: "bare", component: OpsEvidenceReview },
  { path: "/ops/handoff", layout: "public", shell: "bare", component: OpsBuyerHandoff },
  { path: "/ops/spend", layout: "public", shell: "bare", component: OpsSpendControls },

  // 404
  { layout: "public", component: NotFound },
];
