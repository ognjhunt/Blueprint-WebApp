/** OAuth material and private address searches must not enter request logs. */
export function privateWorkLogPath(url: string): string {
  if (url.split("?", 1)[0].startsWith("/api/location-autocomplete")) return url.split("?", 1)[0];
  if (!url.startsWith("/api/blueprint-work/") && !url.startsWith("/app/connect/chatgpt")
    && !url.startsWith("/api/communications/gmail/oauth")) return url;
  return url.split("?", 1)[0].replace(/(\/consent\/)[^/]+/, "$1[flow]");
}
