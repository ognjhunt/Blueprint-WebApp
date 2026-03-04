import { lazy } from "react";
import type { ComponentType } from "react";

export type AppRoute = {
  path?: string;
  layout: "public" | "protected";
  // Some route components require `params` props from wouter dynamic segments.
  component: ComponentType<any>;
};

const Home = lazy(() => import("../pages/Home"));
const Environments = lazy(() => import("../pages/Environments"));
const BusinessSignUpFlow = lazy(() => import("../pages/BusinessSignUpFlow"));
const OnboardingChecklist = lazy(() => import("../pages/OnboardingChecklist"));
const EnvironmentDetail = lazy(() => import("../pages/EnvironmentDetail"));
const Solutions = lazy(() => import("../pages/Solutions"));
const Pricing = lazy(() => import("../pages/Pricing"));
const Contact = lazy(() => import("../pages/Contact"));
const HowItWorks = lazy(() => import("../pages/HowItWorks"));
const PilotExchange = lazy(() => import("../pages/PilotExchange"));
const PilotExchangeGuide = lazy(() => import("../pages/PilotExchangeGuide"));
const PartnerProgram = lazy(() => import("../pages/PartnerProgram"));
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

export const appRoutes: AppRoute[] = [
  { path: "/", layout: "public", component: Home },
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
  { path: "/solutions", layout: "public", component: Solutions },
  { path: "/pricing", layout: "public", component: Pricing },
  { path: "/contact", layout: "public", component: Contact },
  { path: "/how-it-works", layout: "public", component: HowItWorks },
  { path: "/pilot-exchange", layout: "public", component: PilotExchange },
  { path: "/pilot-exchange-guide", layout: "public", component: PilotExchangeGuide },
  { path: "/partners", layout: "public", component: PartnerProgram },
  { path: "/portal", layout: "public", component: Portal },
  { path: "/login", layout: "public", component: Login },
  { path: "/signup", layout: "public", component: BusinessSignUpFlow },
  { path: "/signup/business", layout: "public", component: BusinessSignUpFlow },
  { path: "/onboarding", layout: "protected", component: OnboardingChecklist },
  { path: "/forgot-password", layout: "public", component: ForgotPassword },
  { path: "/privacy", layout: "public", component: Privacy },
  { path: "/terms", layout: "public", component: Terms },
  { path: "/settings", layout: "public", component: Settings },
  { path: "/admin/leads", layout: "protected", component: AdminLeads },
  { path: "/admin/leads/:requestId", layout: "protected", component: AdminLeads },
  { path: "/dashboard", layout: "protected", component: Dashboard },
  {
    path: "/off-waitlist-signup",
    layout: "public",
    component: OffWaitlistSignUpFlow,
  },
  { layout: "public", component: NotFound },
];
