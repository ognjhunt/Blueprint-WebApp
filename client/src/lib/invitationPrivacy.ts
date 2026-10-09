/** Bearer invitation links must not enter analytics or referrer properties. */
export function redactInvitationUrl(value: string): string {
  if (!/[?&]invitation=/.test(value)) return value;
  try {
    const url = new URL(value, "https://tryblueprint.io");
    url.searchParams.delete("invitation");
    return value.startsWith("/") ? `${url.pathname}${url.search}${url.hash}` : url.toString();
  } catch { return value.split("?", 1)[0]; }
}
