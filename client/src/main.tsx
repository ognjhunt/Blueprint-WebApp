import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/create-blueprint" component={CreateBlueprint} />
      <Route path="/claim-blueprint" component={ClaimBlueprint} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/search" component={BusinessSearch} />
      <Route path="/profile" component={Profile} />
      <Route path="/settings" component={Settings} />
      <Route path="/sign-in" component={SignIn} />
      <Route path="/create-account" component={CreateAccount} />
      <Route path="/blueprint-editor/:id?" component={BlueprintEditor} />
      <Route>404 Page Not Found</Route>
    </Switch>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
);
