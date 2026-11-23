// The public chrome's links, in one place, so both layouts say the same thing: the paper `MinimalSiteLayout` (every
// public page) and the Runway `Header`/`Footer` (staff operations pages, and a moment on a redirect). Launch copy,
// 2026-11-20: one name per link, "Find jobs" for the company job list and "Your account" for the signed-in link.
import { FIND_JOBS, FIND_JOBS_PATH } from "@/lib/publicCopy";
import { BROWSE_JOBS_PATH } from "@/lib/robotTeamAccess";

export type NavLink = { href: string; label: string };

/** How it works, and Find jobs: the page with the application when signed out, the job list when signed in. */
export function primaryNavLinks(signedIn: boolean): NavLink[] {
  return [
    { href: "/#how-it-works", label: "How it works" },
    { href: signedIn ? BROWSE_JOBS_PATH : FIND_JOBS_PATH, label: FIND_JOBS },
  ];
}

/** The signed-in link, the same for every account: /app takes each account to its own place. */
export const ACCOUNT_LINK: NavLink = { href: "/app", label: "Your account" };
export const SIGN_IN_LABEL = "Sign in";

/** The footer's links; each layout adds "Cookie settings" and the company line. */
export const footerLinks: NavLink[] = [
  { href: "/beta", label: "Questions" },
  { href: "/beta#who-we-are", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];
