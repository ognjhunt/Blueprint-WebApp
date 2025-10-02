# App Clip Domain Association Setup

The web stack now exposes the assets that iOS needs in order to launch the
Blueprint App Clip when somebody scans a QR code that points at
`https://www.tryblueprint.io/go`. To enable the end-to-end flow you must supply
the identifiers that Apple issued for your production app and App Clip.

## Required environment variables

Populate these environment variables wherever the Express server runs:

| Variable | Description |
| --- | --- |
| `APPLE_TEAM_ID` | Your 10-character Apple Developer Team ID. |
| `IOS_APP_BUNDLE_ID` | The primary iOS app bundle identifier that hosts the App Clip experience. |
| `IOS_APP_CLIP_BUNDLE_ID` | The App Clip target bundle identifier. |
| `APP_CLIP_ADDITIONAL_PATHS` | *(optional)* Comma-separated list of additional URL paths that should open the App Clip. Each entry may start with `/`; the server normalises missing leading slashes. |

The server responds to both `/.well-known/apple-app-site-association` and
`/apple-app-site-association` with a JSON payload that includes the
`applinks.details` and `appclips.apps` sections derived from these variables.
When all identifiers are present the payload is cached for an hour and shared
across both GET and HEAD requests, which is what Apple’s association service
expects during verification.

## Front-end configuration

Expose the same bundle identifiers to the Vite build so Safari can render the
App Clip card banner when the Go page loads:

| Vite variable | Purpose |
| --- | --- |
| `VITE_APP_STORE_APP_ID` | The numeric App Store ID for the full Blueprint app. |
| `VITE_APP_CLIP_BUNDLE_ID` | The App Clip bundle identifier shown in the Smart App Banner metadata. |

Add both keys to your `.env` or hosting provider secrets. The Go QR experience
page resolves them at runtime and injects an `apple-itunes-app` meta tag via
`react-helmet`, keeping the banner scoped to
`https://www.tryblueprint.io/go` while the rest of the marketing site stays
unchanged.

## Checklist before testing on device

1. **Deploy the updated server** so the `apple-app-site-association` endpoint is
   publicly reachable over HTTPS.
2. **Host the QR code** that resolves to `https://www.tryblueprint.io/go`.
3. **Create and approve an App Clip Experience** for that URL inside App Store
   Connect and include the same Team ID / bundle IDs you configured above.
4. **Publish the App Clip-capable build** signed with provisioning profiles that
   contain the Associated Domains entitlement for `appclips:tryblueprint.io` and
   `applinks:tryblueprint.io`.

Once all steps are complete, scanning the QR code from an iOS device should
present the App Clip card and hand the invocation URL to the Unity runtime.
