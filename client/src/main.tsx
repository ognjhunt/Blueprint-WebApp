import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import { LiveAPIProvider } from "@/contexts/LiveAPIContext";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

// Lazy pages
const Home = lazy(() => import("./pages/Home"));
const CreateBlueprint = lazy(() => import("./pages/CreateBlueprint"));
const ClaimBlueprint = lazy(() => import("./pages/ClaimBlueprint"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const PricingPage = lazy(() => import("./pages/Pricing"));
const BusinessSearch = lazy(() => import("./pages/BusinessSearch"));
const Profile = lazy(() => import("./pages/Profile"));
const SignIn = lazy(() => import("./pages/SignIn"));
const CreateAccount = lazy(() => import("./pages/CreateAccount"));
const BlueprintEditor = lazy(() => import("./pages/BlueprintEditor"));
const Discover = lazy(() => import("./pages/Discover"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const OffWaitlistSignUpFlow = lazy(
  () => import("./pages/OffWaitlistSignUpFlow"),
);
const OutboundSignUpFlow = lazy(() => import("./pages/OutboundSignUpFlow"));
const WorkflowHub = lazy(() => import("@/components/WorkflowHub"));
const WorkspacePage = lazy(() => import("./pages/Workspace"));
const Help = lazy(() => import("./pages/Help"));
const ManagePlan = lazy(() => import("./pages/ManagePlan"));
const TeamMembers = lazy(() => import("./pages/TeamMembers"));
const Settings = lazy(() => import("./pages/Settings"));
const ScannerPortal = lazy(() => import("./pages/ScannerPortal"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const PilotProgram = lazy(() => import("./pages/PilotProgram"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Terms = lazy(() => import("./pages/Terms"));
const FAQ = lazy(() => import("./pages/FAQ"));
const VenueMaterials = lazy(() => import("./pages/VenueMaterials"));
const EmbedCalendar = lazy(() => import("./pages/EmbedCalendar"));
const EmbedDashboard = lazy(() => import("./pages/EmbedDashboard"));
const Blog = lazy(() => import("./pages/Blog"));
const WarehouseOS = lazy(() => import("./pages/blog/WarehouseOS"));
const RetailOS = lazy(() => import("./pages/blog/RetailOS"));
const PropertyOS = lazy(() => import("./pages/blog/PropertyOS"));
const MuseumOS = lazy(() => import("./pages/blog/MuseumOS"));
const HospitalityOS = lazy(() => import("./pages/blog/HospitalityOS"));
const RestaurantOS = lazy(() => import("./pages/blog/RestaurantOS"));
const WorkplaceOS = lazy(() => import("./pages/blog/WorkplaceOS"));
const RoboticsOS = lazy(() => import("./pages/blog/RoboticsOS"));
const Go = lazy(() => import("./pages/Go"));
const WebXR = lazy(() => import("./pages/WebXR"));

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/search" component={BusinessSearch} />
      <Route path="/sign-in" component={SignIn} />
      <Route path="/discover" component={Discover} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/create-account" component={CreateAccount} />
      <Route path="/off-waitlist-signup" component={OffWaitlistSignUpFlow} />
      <Route path="/outbound-signup" component={OutboundSignUpFlow} />
      <Route path="/workspace" component={WorkspacePage} />
      <Route path="/help" component={Help} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/warehouse-os" component={WarehouseOS} />
      <Route path="/blog/retail-os" component={RetailOS} />
      <Route path="/blog/property-os" component={PropertyOS} />
      <Route path="/blog/museum-os" component={MuseumOS} />
      <Route path="/blog/hospitality-os" component={HospitalityOS} />
      <Route path="/blog/restaurant-os" component={RestaurantOS} />
      <Route path="/blog/workplace-os" component={WorkplaceOS} />
      <Route path="/blog/robotics-os" component={RoboticsOS} />
      <Route path="/manage-plan" component={ManagePlan} />
      <Route path="/team-members" component={TeamMembers} />
      <Route path="/settings" component={Settings} />
      <Route path="/scanner-portal" component={ScannerPortal} />
      <Route path="/accept-invite" component={AcceptInvite} />
      <Route path="/pilot-program" component={PilotProgram} />
      <Route path="/go" component={Go} />
      <Route path="/webxr" component={WebXR} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/terms" component={Terms} />
      <Route path="/faq" component={FAQ} />
      <Route path="/venue-materials" component={VenueMaterials} />
      <Route path="/embed/calendar" component={EmbedCalendar} />
      <Route path="/embed/dashboard" component={EmbedDashboard} />

      {/* Protected */}
      <Route path="/create-blueprint">
        <ProtectedRoute>
          <CreateBlueprint />
        </ProtectedRoute>
      </Route>
      <Route path="/claim-blueprint" component={ClaimBlueprint} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/profile">
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      </Route>
      <Route path="/blueprint-editor/:id?">
        <ProtectedRoute>
          <BlueprintEditor />
        </ProtectedRoute>
      </Route>

      {/* Redirect for old casing */}
      <Route path="/BlueprintEditor/:id?">
        <ProtectedRoute>
          <BlueprintEditor />
        </ProtectedRoute>
      </Route>

      <Route>404 Page Not Found</Route>
    </Switch>
  );
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <LiveAPIProvider>
        <Suspense fallback={<div className="text-slate-400 p-6">Loading…</div>}>
          <Router />
          <Toaster />
        </Suspense>
      </LiveAPIProvider>
    </AuthProvider>
  </QueryClientProvider>,
);
