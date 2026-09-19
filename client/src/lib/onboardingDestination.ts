/** Keep a specific task/claim across signup; never accept an external redirect. */
export function onboardingDestination(workspaceType: string, search: string, existing = false): string {
  const params = new URLSearchParams(search);
  const requested = params.get("returnTo");
  if (requested && !/[\\\s]/.test(requested) && /^\/(?:claim\/[^/?#]+|app(?:\/[^?#]*)?|contact\/(?:site-operator|robot-team)|sites)(?:[?#].*)?$/.test(requested)) {
    return requested;
  }
  const destination = existing ? "/app" : workspaceType === "site_operator" ? "/contact/site-operator" : "/contact/robot-team";
  const context = new URLSearchParams();
  for (const key of ["source", "intent", "sceneId"]) {
    const value = params.get(key);
    if (value && value.length <= 200) context.set(key, value);
  }
  return `${destination}${context.size ? `?${context}` : ""}`;
}
