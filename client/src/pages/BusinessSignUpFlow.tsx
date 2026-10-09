import RobotTeamSignUpFlow from "./RobotTeamSignUpFlow";
import { MarketingRedirect } from "./MarketingRedirect";
import { siteSignupDestination } from "@/lib/siteOnboarding";
import { AuthLayout } from "@/components/auth/AuthLayout";

/** Sites submit their job first; robot accounts retain the invitation flow. */
export default function BusinessSignUpFlow() {
  const search = typeof window === "undefined" ? "" : window.location.search;
  const params = new URLSearchParams(search);
  const persona = (params.get("buyerType") || params.get("persona") || "").replaceAll("-", "_");
  if (params.has("invitation") || persona === "robot_team") return <RobotTeamSignUpFlow />;
  const destination = siteSignupDestination(search);
  return <AuthLayout>
    <MarketingRedirect to={destination} preserveQuery={false} />
    <h1>Start with your site and job</h1>
    <p className="auth-subtitle">Show us the work, then save it to your account.</p>
    <p><a className="auth-primary" href={destination}>Show us a task</a></p>
  </AuthLayout>;
}
