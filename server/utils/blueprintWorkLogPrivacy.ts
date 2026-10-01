/** OAuth flow handles, state and PKCE material must not enter request logs. */
export function privateWorkLogPath(url: string): string {
  if (!url.startsWith("/api/blueprint-work/") && !url.startsWith("/app/connect/chatgpt")
    && !url.startsWith("/api/communications/gmail/oauth")) return url;
  return url.split("?", 1)[0].replace(/(\/consent\/)[^/]+/, "$1[flow]");
}
