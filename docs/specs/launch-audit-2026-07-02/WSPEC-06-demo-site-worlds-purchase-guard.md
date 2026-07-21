# WSPEC-06: Demo site-worlds can never be purchasable in production

- Status: Superseded by deletion (2026-07-20)
- Priority: **P1 — major** (doctrine: no fake supply for sale)
- Area: `server/routes/api/create-checkout-session.ts`

## Problem

The static marketplace catalog and its checkout mode were removed. This file is
retained as historical context; none of the paths or flags below remain active.

`create-checkout-session.ts:187-188`:

```ts
const staticMarketplaceFallbackEnabled =
  process.env.NODE_ENV !== "production" || process.env.BLUEPRINT_ENABLE_DEMO_SITE_WORLDS === "1";
```

When no live inventory record exists, the server correctly rejects with 409 (`:293-297`)
— *unless* `BLUEPRINT_ENABLE_DEMO_SITE_WORLDS=1`, in which case the static/illustrative
catalog (`client/src/data/content`) becomes purchasable **in production**. One misplaced
env var turns demo supply into sellable fake supply — a direct violation of the
no-fake-supply doctrine, with real money charged for inventory that doesn't exist.

## Proposed fix

1. Separate demo *display* from demo *purchase*: the demo flag may control catalog
   display, but checkout-session creation for a non-live inventory record must be
   impossible in production regardless of flags:
   ```ts
   const demoCheckoutAllowed =
     process.env.NODE_ENV !== "production" && process.env.BLUEPRINT_ENABLE_DEMO_SITE_WORLDS === "1";
   ```
2. If sales/demos need a walkthrough of checkout in production, use Stripe test-mode
   sessions on a dedicated staging origin, never live-mode sessions on demo inventory.
3. Belt-and-braces: tag demo/static catalog records with `demo: true` end-to-end and add
   a webhook-side guard that refuses to fulfill entitlements for `demo` line items in
   live mode, with alerting.
4. Startup log/alert if `BLUEPRINT_ENABLE_DEMO_SITE_WORLDS=1` is set in production so a
   misconfiguration is loudly visible even for the display-only behavior.

## Acceptance criteria

- [ ] With `NODE_ENV=production` and `BLUEPRINT_ENABLE_DEMO_SITE_WORLDS=1`, checkout-session creation for non-live inventory returns 409 (test).
- [ ] Webhook fulfillment refuses demo line items in live mode.
- [ ] Production startup emits an alert when the demo flag is set.
