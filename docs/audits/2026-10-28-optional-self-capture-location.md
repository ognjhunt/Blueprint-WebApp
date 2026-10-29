# Optional address for a self-recorded job

The owner requested that a site start with its video and email, while Blueprint
handles processing and recovery. A read-only browser check of the deployed
entry form found that `start-location` still had native `required` validation.
The signed-in capture route and public intake also required a nonempty site
name/location, so changing only the label would not remove that blocker.

The existing country boundary controls whether Blueprint may receive footage.
It remains explicit: the form offers United States or outside the United
States when no optional address establishes the country. It selects neither by
default. Outside-US uploads remain held. Entering or choosing a new address
invalidates the prior country inference/declaration; a selected country without
an address is retained in the existing durable draft and frozen retry body.

Self-recorded and uploaded jobs may leave site name and address empty. The
public and authenticated intake routes preserve that absence and the existing
source ownership, consent, Terms, private-link and capture-region controls.
A requested Blueprint filming visit still requires its address. No new
country, privacy authority, location, spending authority or account is invented.

Verification: the six focused intake, browser-state recovery, workspace and
dispatch suites cover 249 cases. Five old assertions for the mandatory-address
UI were updated; their 106-case component suite then passed. The other five
suites passed on the initial run. Full TypeScript passed. The existing 390px
and 1440px browser fixture now starts with country permission and email,
asserting that no address is required or fabricated before optional account
saving. Hosted browser execution and production rollout remain separate from
these local checks.
