import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import { LiveAPIProvider } from "@/contexts/LiveAPIContext";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./contexts/AuthContext";
import Home from "./pages/Home";
import CreateBlueprint from "./pages/CreateBlueprint";
import ClaimBlueprint from "./pages/ClaimBlueprint";
import Dashboard from "./pages/Dashboard";
import PricingPage from "./pages/Pricing";
import BusinessSearch from "./pages/BusinessSearch";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import SignIn from "./pages/SignIn";
import CreateAccount from "./pages/CreateAccount";
import BlueprintEditor from "./pages/BlueprintEditor";

import ProtectedRoute from "@/components/ProtectedRoute";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/search" component={BusinessSearch} />
      <Route path="/sign-in" component={SignIn} />
      <Route path="/create-account" component={CreateAccount} />

      {/* Protected Routes */}
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
      <Route path="/settings">
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      </Route>
      <Route path="/blueprint-editor/:id?">
        <ProtectedRoute>
          <BlueprintEditor />
        </ProtectedRoute>
      </Route>
      <Route>404 Page Not Found</Route>
    </Switch>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LiveAPIProvider>
          {" "}
          {/* Add this here */}
          <Router />
          <Toaster />
        </LiveAPIProvider>{" "}
        {/* And close it here */}
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
