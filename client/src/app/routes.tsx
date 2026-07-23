import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import { MarketingRedirect } from "../pages/MarketingRedirect";
import type { AccessRole } from "../lib/adminAccess";

export type AppRoute = {
  path?: string;
  layout: "public" | "protected";
  shell?: "site" | "bare";
  // Restrict a protected route to users holding at least one of these roles.
  requireRoles?: AccessRole[];
  // Some route components require `params` props from wouter dynamic segments.
  component: ComponentType<any>;
};

// A lazy route component that also exposes its raw module loader, so
// main.tsx can preload the matched route's chunk before swapping out the
// prerendered markup — avoiding a Suspense-fallback flash on first paint.
export type PreloadableComponent<P = any> = LazyExoticComponent<ComponentType<P>> & {
  preload: () => Promise<unknown>;
};

function lazyRoute<P = any>(
  loader: () => Promise<{ default: ComponentType<P> }>,
): PreloadableComponent<P> {
  // Memoized so a manual preload() call and React.lazy's own internal
  // call (on first render of this component) resolve the exact same
  // promise — calling the raw loader twice would only warm the module
  // cache, not React.lazy's internal payload, so React would still
  // suspend on a fresh, separate thenable.
  let modulePromise: Promise<{ default: ComponentType<P> }> | undefined;
  const load = () => {
    if (!modulePromise) {
      modulePromise = loader();
    }
    return modulePromise;
  };
  return Object.assign(lazy(load), { preload: load });
}

const Home = lazyRoute(() => import("../pages/Home"));
const Capture = lazyRoute(() => import("../pages/Capture"));
const CaptureAppPlaceholder = lazyRoute(() => import("../pages/CaptureAppPlaceholder"));
const CapturerAccount = lazyRoute(() => import("../pages/CapturerAccount"));
const CaptureLaunchAccess = lazyRoute(() => import("../pages/CaptureLaunchAccess"));
const BusinessSignUpFlow = lazyRoute(() => import("../pages/BusinessSignUpFlow"));
const CapturerSignUpFlow = lazyRoute(() => import("../pages/CapturerSignUpFlow"));
const OnboardingChecklist = lazyRoute(() => import("../pages/OnboardingChecklist"));
// /robot-team/eval merged into /for-robot-teams (#intake); keep the URL as a redirect.
const RobotTeamEvalRedirect = () => <MarketingRedirect to="/for-robot-teams#intake" />;
const Sites = lazyRoute(() => import("../pages/Sites"));
const SiteDetail = lazyRoute(() => import("../pages/SiteDetail"));
const Pricing = lazyRoute(() => import("../pages/Pricing"));
const Contact = lazyRoute(() => import("../pages/Contact"));
const Proof = lazyRoute(() => import("../pages/Proof"));
const FAQ = lazyRoute(() => import("../pages/FAQ"));
const Login = lazyRoute(() => import("../pages/Login"));
const ForgotPassword = lazyRoute(() => import("../pages/ForgotPassword"));
const Privacy = lazyRoute(() => import("../pages/Privacy"));
const Terms = lazyRoute(() => import("../pages/Terms"));
const BetaCapturerGuide = lazyRoute(() => import("../pages/BetaCapturerGuide"));
const BetaBuyerGuide = lazyRoute(() => import("../pages/BetaBuyerGuide"));
const Settings = lazyRoute(() => import("../pages/Settings"));
const AdminLeads = lazyRoute(() => import("../pages/AdminLeads"));
const AdminGrowthOpsScorecard = lazyRoute(() => import("../pages/AdminGrowthOpsScorecard"));
const AdminAustinLaunchScorecard = lazyRoute(() => import("../pages/AdminAustinLaunchScorecard"));
const AdminGrowthStudio = lazyRoute(() => import("../pages/AdminGrowthStudio"));
const AdminCompanyMetrics = lazyRoute(() => import("../pages/AdminCompanyMetrics"));
const AdminCapturers = lazyRoute(() => import("../pages/AdminCapturers"));
const RequestConsole = lazyRoute(() => import("../pages/RequestConsole"));
const DesignSystem = lazyRoute(() => import("../pages/DesignSystem"));

// Redesign — public pages (distinct surfaces per SCREENS.md)
const About = lazyRoute(() => import("../pages/About"));
const Vision = lazyRoute(() => import("../pages/Vision"));
const Governance = lazyRoute(() => import("../pages/Governance"));
const HowItWorks = lazyRoute(() => import("../pages/HowItWorks"));
const ForRobotTeams = lazyRoute(() => import("../pages/ForRobotTeams"));
const ForSiteOperators = lazyRoute(() => import("../pages/ForSiteOperators"));

// Redesign — buyer app (entitlement-backed protected surfaces)
const AppOverview = lazyRoute(() => import("../pages/app/Overview"));
const AppRuns = lazyRoute(() => import("../pages/app/Runs"));
const AppRunDetail = lazyRoute(() => import("../pages/app/RunDetail"));
const AppSitePacks = lazyRoute(() => import("../pages/app/SitePacks"));
const AppSiteDetail = lazyRoute(() => import("../pages/app/SiteDetail"));
const AppPolicies = lazyRoute(() => import("../pages/app/Policies"));
const AppDataPackages = lazyRoute(() => import("../pages/app/DataPackages"));
const AppEntitlements = lazyRoute(() => import("../pages/app/Entitlements"));

const NotFound = lazyRoute(() => import("../pages/NotFound"));

// Shared role requirement for admin/ops surfaces (stable reference so the
// ProtectedRoute effect deps don't churn).
const ADMIN_ROLES: AccessRole[] = ["admin", "ops"];

const HomeRedirect = () => <MarketingRedirect to="/" />;

const HowItWorksRedirect = () => <MarketingRedirect to="/#how-it-works" />;

const ProofRedirect = () => <MarketingRedirect to="/proof" />;

const SitesRedirect = () => <MarketingRedirect to="/sites" />;

const ContactRedirect = () => {
  const search =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const persona = search?.get("persona") ?? search?.get("buyerType") ?? "";
  const isSiteOperator = persona === "site-operator" || persona === "site_operator";
  return (
    <MarketingRedirect
      to={
        isSiteOperator
          ? "/contact/site-operator?source=public-route-redirect"
          : "/contact/robot-team?persona=robot-team&source=public-route-redirect"
      }
    />
  );
};

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
  params: _params,
}: {
  params?: { slug?: string };
}) => <MarketingRedirect to="/sites" />;

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

const BuyerAppRedirect = () => <MarketingRedirect to="/app" />;

const BusinessSignupRedirect = () => <MarketingRedirect to="/signup/business" />;

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
  { path: "/launch-map", layout: "public", component: CaptureLaunchAccess },

  // Capture / Earn direct flows
  { path: "/capture", layout: "public", component: Capture },
  { path: "/capture-app", layout: "public", shell: "bare", component: CaptureAppPlaceholder },
  { path: "/capture-app/account", layout: "protected", shell: "bare", component: CapturerAccount },
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
  { path: "/world-models/:slug/start", layout: "public", component: LegacySiteLibraryDetailRedirect },
  { path: "/world-models/:slug/workspace", layout: "public", component: LegacySiteLibraryDetailRedirect },

  // Legacy site-worlds redirects
  { path: "/site-worlds", layout: "public", component: LegacySiteWorldsRedirect },
  { path: "/site-worlds/:slug", layout: "public", component: LegacySiteLibraryDetailRedirect },
  { path: "/site-worlds/:slug/start", layout: "public", component: LegacySiteLibraryDetailRedirect },
  { path: "/site-worlds/:slug/workspace", layout: "public", component: LegacySiteLibraryDetailRedirect },

  // Persona pages
  { path: "/for-site-operators", layout: "public", component: ForSiteOperators },
  { path: "/for-robot-teams", layout: "public", component: ForRobotTeams },
  { path: "/robot-team/eval", layout: "public", component: RobotTeamEvalRedirect },
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
  { path: "/faq", layout: "public", component: FAQ },
  { path: "/governance", layout: "public", component: Governance },
  { path: "/about", layout: "public", component: About },
  { path: "/vision", layout: "public", component: Vision },
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
  { path: "/portal", layout: "public", shell: "bare", component: LegacyLoginRedirect },
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
  { path: "/beta/capturer-guide", layout: "public", shell: "bare", component: BetaCapturerGuide },
  { path: "/beta/buyer-guide", layout: "public", shell: "bare", component: BetaBuyerGuide },
  { path: "/settings", layout: "protected", shell: "bare", component: Settings },
  { path: "/requests/:requestId", layout: "public", shell: "bare", component: RequestConsole },
  { path: "/requests/:requestId/evidence", layout: "public", shell: "bare", component: RequestConsole },
  { path: "/requests/:requestId/qualification", layout: "public", shell: "bare", component: RequestConsole },
  { path: "/requests/:requestId/preview", layout: "public", shell: "bare", component: RequestConsole },

  // Admin
  { path: "/admin/leads", layout: "protected", requireRoles: ADMIN_ROLES, component: AdminLeads },
  { path: "/admin/leads/:requestId", layout: "protected", requireRoles: ADMIN_ROLES, component: AdminLeads },
  { path: "/admin/submissions", layout: "protected", requireRoles: ADMIN_ROLES, component: AdminLeads },
  { path: "/admin/submissions/:requestId", layout: "protected", requireRoles: ADMIN_ROLES, component: AdminLeads },
  { path: "/admin/growth-ops-scorecard", layout: "protected", requireRoles: ADMIN_ROLES, component: AdminGrowthOpsScorecard },
  { path: "/admin/company-metrics", layout: "protected", requireRoles: ADMIN_ROLES, component: AdminCompanyMetrics },
  { path: "/admin/capturers", layout: "protected", requireRoles: ADMIN_ROLES, component: AdminCapturers },
  { path: "/admin/city-launch/austin", layout: "protected", requireRoles: ADMIN_ROLES, component: AdminAustinLaunchScorecard },
  { path: "/admin/city-launch/:citySlug", layout: "protected", requireRoles: ADMIN_ROLES, component: AdminAustinLaunchScorecard },
  { path: "/admin/growth-studio", layout: "protected", requireRoles: ADMIN_ROLES, component: AdminGrowthStudio },

  // Legacy logged-in and signup aliases resolve to the maintained flows.
  { path: "/dashboard", layout: "protected", shell: "bare", component: BuyerAppRedirect },
  { path: "/internal/design-system", layout: "public", shell: "bare", component: DesignSystem },
  {
    path: "/off-waitlist-signup",
    layout: "public",
    component: BusinessSignupRedirect,
  },

  { path: "/join", layout: "public", shell: "bare", component: BusinessSignupRedirect },

  // Redesign — buyer app; own app shell, no SiteLayout
  { path: "/app", layout: "protected", shell: "bare", component: AppOverview },
  { path: "/app/runs", layout: "protected", shell: "bare", component: AppRuns },
  { path: "/app/runs/:runId", layout: "protected", shell: "bare", component: AppRunDetail },
  { path: "/app/packs", layout: "protected", shell: "bare", component: AppSitePacks },
  { path: "/app/packs/:siteId", layout: "protected", shell: "bare", component: AppSiteDetail },
  { path: "/app/policies", layout: "protected", shell: "bare", component: AppPolicies },
  { path: "/app/data", layout: "protected", shell: "bare", component: AppDataPackages },
  { path: "/app/entitlements", layout: "protected", shell: "bare", component: AppEntitlements },

  // Legacy ops aliases route to protected admin/operator truth surfaces.
  { path: "/ops", layout: "protected", requireRoles: ADMIN_ROLES, component: AdminLeads },
  { path: "/ops/supply", layout: "protected", requireRoles: ADMIN_ROLES, component: AdminLeads },
  { path: "/ops/city-launch", layout: "protected", requireRoles: ADMIN_ROLES, component: AdminAustinLaunchScorecard },
  { path: "/ops/evidence", layout: "protected", requireRoles: ADMIN_ROLES, component: AdminLeads },
  { path: "/ops/handoff", layout: "protected", requireRoles: ADMIN_ROLES, component: AdminLeads },
  { path: "/ops/spend", layout: "protected", requireRoles: ADMIN_ROLES, component: AdminCompanyMetrics },

  // 404
  { layout: "public", component: NotFound },
];

function hasPreload(component: ComponentType<any>): component is PreloadableComponent {
  return typeof (component as { preload?: unknown }).preload === "function";
}

// Mirrors wouter's <Switch>/<Route> first-match-wins semantics (literal
// segments plus `:param` segments) so main.tsx can resolve the same route
// the live <Router> will render, without rendering it.
export function matchAppRoute(pathname: string): AppRoute | undefined {
  const segments = pathname.split("/").filter(Boolean);
  const staticMatch = appRoutes.find((route) => {
    if (!route.path) return false;
    const routeSegments = route.path.split("/").filter(Boolean);
    if (routeSegments.length !== segments.length) return false;
    return routeSegments.every(
      (segment, index) => segment.startsWith(":") || segment === segments[index],
    );
  });

  return staticMatch ?? appRoutes.find((route) => !route.path);
}

// Preloads the JS chunk for the route matching `pathname`, if it's lazy. Used
// on initial boot so the first client render doesn't suspend (see main.tsx).
export function preloadMatchedRoute(pathname: string): Promise<unknown> | null {
  const component = matchAppRoute(pathname)?.component;
  return component && hasPreload(component) ? component.preload() : null;
}
