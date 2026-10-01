import { google } from "googleapis";
import { verifyFounderMailbox } from "./communications-gmail";
import type { FounderConsentPorts } from "./communications-oauth";

/** One bounded token exchange, fixed Google endpoint, no POST retry/redirect. */
export function founderGoogleConsent(clientId: string, clientSecret: string, fetcher = fetch): Pick<FounderConsentPorts, "exchange" | "verify"> {
  return {
    async exchange(input) {
      if (input.clientId !== clientId) throw new Error("founder_oauth_client_mismatch");
      const response = await fetcher("https://oauth2.googleapis.com/token", {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId,
          client_secret: clientSecret, redirect_uri: input.callback, code: input.code, code_verifier: input.verifier }),
      });
      if (!response.ok) { await response.body?.cancel(); throw new Error("founder_oauth_token_exchange_refused"); }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("founder_oauth_token_response_missing");
      const chunks: Uint8Array[] = []; let bytes = 0;
      try {
        for (;;) {
          const result = await reader.read(); if (result.done) break;
          bytes += result.value.length;
          if (bytes > 16384) { await reader.cancel(); throw new Error("founder_oauth_token_response_too_large"); }
          chunks.push(result.value);
        }
      } finally { reader.releaseLock(); }
      const token = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (token.token_type !== "Bearer" || typeof token.access_token !== "string" || typeof token.refresh_token !== "string"
        || typeof token.scope !== "string") throw new Error("founder_oauth_token_response_invalid");
      return { accessToken: token.access_token, refreshToken: token.refresh_token, scopes: token.scope.split(/\s+/).filter(Boolean) };
    },
    async verify({ accessToken }) {
      const auth = new google.auth.OAuth2(clientId, clientSecret);
      // No refresh material on this ephemeral verification client.
      auth.setCredentials({ access_token: accessToken });
      return verifyFounderMailbox(google.gmail({ version: "v1", auth,
        timeout: 15000, retry: false }));
    },
  };
}
