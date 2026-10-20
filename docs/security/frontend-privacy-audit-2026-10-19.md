# Frontend privacy and credential audit — 2026-10-19

Scope: customer browser source, public files, Vite build configuration, consent controls, browser telemetry, and a read-only public deployed JavaScript scan. This is engineering evidence, not a legal compliance certification. Local secret files and provider dashboards were not read; no keys were rotated, no private account was used and no production state was changed.

## Observed issues and repairs

| Surface | Finding | Local repair |
| --- | --- | --- |
| Cookie consent | Existing banner already offered Reject all, Accept all, custom choices, footer reopening and Global Privacy Control handling. | Preserved these controls; malformed choices are ignored and storage failures no longer break buttons. The latest choice remains effective in this tab even when an old grant cannot be overwritten; storage events synchronize choices from another tab. |
| Google Analytics | The tag loaded before opt-in with denied storage consent, allowing cookieless requests. | Tag loading and analytics events now require analytics opt-in. Withdrawal disables the configured measurement ID and clears optional Google analytics cookies. Marketing-only permission does not start analytics. |
| PostHog | SDK initialization occurred before opt-in; autocapture was enabled; session recording was not explicitly disabled in code. Provider-side replay settings were not inspected. | SDK loads only after analytics consent; session recording, heatmaps, performance capture, automatic page events and form/element autocapture are explicitly off. Withdrawal opts out and disables persistence. |
| Blueprint analytics | First-party events could persist an anonymous experiment ID and send events before consent. | Events and creation of that analytics ID require consent. A consent change drops a queued event waiting for CSRF. This does not modify experiment variant assignment logic. |
| Capture tool | The banner was suppressed, but the common analytics initializer still ran. | `/capture-upload` is excluded even with earlier consent on the public site. Navigation updates consent before tracking the next page. |
| URLs and diagnostics | Invitation redaction covered one query key; other signed query values and bearer tokens in capture/claim paths could reach analytics and Sentry. Sentry lacked a before-send sanitizer. | App-authored telemetry URLs omit all query and fragment values and redact known bearer path segments. Nested analytics payloads, titles, attribution, Sentry automatic events/breadcrumbs and first-party diagnostics are sanitized. Sentry replay sample rates are zero; explicit user context is limited to an ID. Functional links and requests are unchanged. |
| Client credential configuration | Unused helpers accepted `VITE_GOOGLE_GENAI_API_KEY` and `VITE_INTERNAL_SCENE_ACCESS_CODE`; whole-object `import.meta.env` access can serialize configured `VITE_` entries even when a helper is unused. | Removed both unused helpers. The build guard rejects nonempty credential-shaped `VITE_` variables except the explicit public browser-key allowlist. This gate runs before, and cannot be bypassed by, the compile-only Firebase opt-out. |
| Secret regression guard | Existing browser scan covered Perplexity, Firecrawl and hard-coded bearer credentials in source only. | Extended it to text public assets and recognizable OpenAI/Anthropic, Stripe, Resend, SendGrid, GitHub, Slack and private-key patterns. Findings report paths and provider classes, never values. |

## Credential inventory

[credential-variable-inventory-2026-10-19.json](./credential-variable-inventory-2026-10-19.json) lists **116 credential-shaped references**, grouped by service, with source locations and exposure classification. These are credential names found in tracked runtime, scripts, configuration, CI and operator plugin/harness source; they are not 116 active keys. Aliases, optional providers and operator-only credentials are retained so they are not silently omitted. It excludes secret values, local secret files, tests/fixtures, dependencies and provider dashboards. Dynamically named credentials and historical Git objects are outside this static inventory.

| Browser setting | Classification and required provider checks |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Intended public Firebase project identifier. Firebase Security Rules and App Check protect data; API restrictions must exclude unrelated billable APIs, especially Gemini. Restrictions were not verified in this audit. |
| `VITE_GOOGLE_MAPS_API_KEY` | Intended browser Maps key. Restrict to the intended Maps/Places APIs and authorized HTTP referrers. Restrictions were not verified. |
| `VITE_GOOGLE_API_KEY` | Browser Google API/Picker helper reference; no active caller found. Must remain a separate API- and origin-restricted public key if used. |
| `VITE_FIREBASE_APPCHECK_SITE_KEY` | Public reCAPTCHA Enterprise site key. Not a server secret. |
| `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` | Public event-ingestion/project token. `POSTHOG_PERSONAL_API_KEY` is a separate server/operator credential and must never ship. |
| `VITE_GA_MEASUREMENT_ID`, `VITE_FIREBASE_MEASUREMENT_ID`, `VITE_SENTRY_DSN`, Google OAuth client/app IDs | Public routing/application identifiers, not server API secrets. They still reveal provider/project configuration. |
| `VITE_GOOGLE_GENAI_API_KEY`, `VITE_INTERNAL_SCENE_ACCESS_CODE` | Unsafe browser credential names; unused helpers removed and future configured values rejected by the build gate. No such configured values were observed in the scanned live assets. |

The requirement that *no API key be visible* cannot literally apply to Firebase or Maps browser keys; these SDKs intentionally use public application configuration. Server credentials such as Stripe secret keys, AI API keys, Resend keys, service-account private keys, OAuth refresh tokens and webhook secrets must stay server-side.

## Public deployed scan

[public-frontend-secret-scan-2026-10-19.json](./public-frontend-secret-scan-2026-10-19.json) retains the URL, byte count and SHA-256 of each scanned public asset, the deployment version response, redacted configuration classifications, and coverage limitations.

- Observed `/version.json`: `0413fec05c16ad1ad7bfc8aa467cb6581be7ebb3`; build timestamp `2026-10-19T23:09:54.325Z`.
- Scanned public HTML and recursively referenced same-origin JavaScript: **115 assets, 3,659,071 bytes**.
- Recognizable server-secret findings: **0**. Nonempty browser configuration observed: Firebase API key and Maps browser API key, both reported without values.
- Vite preload entries beginning `assets/` were normalized against the origin. All 111 normalized references were already among successfully scanned assets. No canonical discovered fetch remained unresolved.
- This scan does not establish revocation of previously exposed credentials, provider-side API restrictions, historical bundle safety or the absence of every possible opaque secret. It does not prove that these local consent/diagnostic fixes have been deployed.

## Remaining Google Analytics configuration check

Google Analytics Enhanced Measurement can independently send history-change page views and automatic form/link events. `send_page_view: false` only suppresses the default tag page view; it does not disable those remote stream features. The local sanitizer covers app-authored GA payloads, not independently collected vendor events. Before claiming that every GA event excludes private links, verify in the production GA stream that browser-history page views and other automatic raw form/link events are disabled. This audit did not inspect or change the GA dashboard. See [Google's page-view guidance](https://developers.google.com/analytics/devguides/collection/ga4/views).

## Verification and recovery

Observed focused result: **8 test files, 45 tests passed** (`analytics-consent`, `CookieConsent`, `error-tracking-privacy`, `invitationPrivacy`, both existing analytics payload suites, client source/public secret guard and `verify-client-env`).

Focused local suites cover no analytics before consent, positive opt-in, withdrawal and pending-event races, essential-storage preservation, capture-page exclusion, malformed/read-only storage, nested telemetry redaction, existing event payload contracts, public/source secret scanning and build-env rejection. The root task records the final combined unit/typecheck/build/browser result and Graphify refresh after all lanes finish.

The browser cookie suite blocks external network requests and stubs analytics/CSRF APIs. Its consent lifecycle test requires positive requests after opt-in so the negative assertions cannot pass merely because analytics is disabled in the test build.

Canonical artifacts are Markdown/JSON source files in this repository; source and revision plus the recorded public-asset SHA-256 values identify the audit. No chat-library ID or session is needed. A replacement engineer can recover them from the repository, rerun the named local suites, and repeat read-only public asset fetching. A fresh provider-dashboard review is needed for key restriction or rotation claims.

## Primary technical references

- [Firebase: API keys are public by design; restrictions, rules and App Check govern security](https://firebase.google.com/docs/projects/api-keys).
- [Google: consent mode and basic versus advanced loading](https://developers.google.com/tag-platform/security/concepts/consent-mode).
- [PostHog: JavaScript configuration, opt-out and session-recording options](https://posthog.com/docs/libraries/js/config).
