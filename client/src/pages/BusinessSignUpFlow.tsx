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
    <h1>Start a job</h1>
    <p className="auth-description">Send a video of the job first. You can save it to an account after.</p>
    <p><a className="auth-primary" href={destination}>Start a job</a></p>
  </AuthLayout>;
}
