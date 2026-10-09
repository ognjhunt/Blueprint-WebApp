/** Legacy signup links start with a job; a signed claim resumes an existing job. */
export function siteSignupDestination(search: string): string {
  const params = new URLSearchParams(search);
  const returnTo = params.get("returnTo");
  if (returnTo && /^\/claim\/[A-Za-z0-9_.-]+(?:\?(?:auto=1|mode=signin))?$/.test(returnTo)) return returnTo;
  const context = new URLSearchParams();
  for (const key of ["source", "intent", "authoring", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const value = params.get(key);
    if (value && value.length <= 200) context.set(key, value);
  }
  return `/contact/site-operator${context.size ? `?${context}` : ""}`;
}
