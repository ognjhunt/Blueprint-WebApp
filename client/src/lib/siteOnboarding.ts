/** Legacy signup links start with a job; a signed claim resumes an existing job. */
export function siteSignupDestination(search: string): string {
  const params = new URLSearchParams(search);
  const returnTo = params.get("returnTo");
  if (returnTo && /^\/claim\/[A-Za-z0-9_.-]+(?:\?(?:auto=1|mode=signin))?$/.test(returnTo)) return returnTo;
  const context = new URLSearchParams();
  // Never "authoring": the development consent boxes are not reachable from a public link (owner rule, 2026-11-20).
  for (const key of ["source", "intent", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const value = params.get(key);
    if (value && value.length <= 200) context.set(key, value);
  }
  return `/contact/site-operator${context.size ? `?${context}` : ""}`;
}
