const RESULT_PATH = /^\/app\/results\/[A-Za-z0-9_-]+$/;
// The request ID shape used by the website's capture and media routes.
const COMPANY_JOB_PATH = /^\/jobs\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;

export function authReturnPath(pathname: string | null): string | null {
  if (!pathname) return null;
  // Require the whole string, including any trailing line terminator.
  return [RESULT_PATH, COMPANY_JOB_PATH].some(pattern => pattern.exec(pathname)?.[0] === pathname) ? pathname : null;
}

function signInHref(pathname: string | null): string {
  return pathname ? `/sign-in?next=${encodeURIComponent(pathname)}` : "/sign-in";
}

export function resultSignInHref(pathname: string): string {
  return signInHref(RESULT_PATH.exec(pathname)?.[0] === pathname ? pathname : null);
}

export function companyJobSignInHref(jobId: string): string {
  return signInHref(authReturnPath(`/jobs/${jobId}`));
}
