# BLU-144 Robot-Team Buyer Copy Drift Audit and Message Test Brief

> Internal working brief for [BLU-144](/BLU/issues/BLU-144). Source playbook: `ops/paperclip/playbooks/robot-team-demand-playbook.md`.
> Current doctrine: capture-first and world-model-product-first.

## 1. Readout

The main buyer-story risk is not the core proof and world-model pages themselves. The bigger drift is in support surfaces, hosted-evaluation entry points, and long-form export text that still frame Blueprint as a qualification-first product.

What is already close:
- `client/src/pages/Home.tsx`
- `client/src/pages/SampleDeliverables.tsx`
- most of `client/src/pages/Proof.tsx`

What still needs a tighter story:
- `client/public/llms-full.txt`
- `client/src/pages/ReadinessPack.tsx`
- `client/src/pages/Contact.tsx`
- `client/src/components/site/ContactForm.tsx`
- `client/src/pages/BusinessSignUpFlow.tsx`
- `client/src/pages/HostedSessionSetup.tsx`
- `client/src/pages/SiteWorldDetail.tsx`
- `client/src/pages/SiteWorlds.tsx`

## 2. Evidence Of Drift

| Surface | Current copy | Why it drifts | Direction to move toward |
| --- | --- | --- | --- |
| `client/public/llms-full.txt:4-38` | Repeats “qualification-first platform,” “qualification-first workflow,” and “default output is a qualification read and routing decision.” | This is the clearest public-facing summary and it teaches the wrong company story everywhere it is consumed. | Rewrite as capture-first, world-model-product-first, with exact-site proof, hosted access, and artifact handoff as the center. |
| `client/src/pages/ReadinessPack.tsx:65-170` | “Use the readiness review when the deployment decision needs extra proof,” plus a `/contact?interest=site-qualification` CTA. | It makes readiness feel like the main product instead of an optional trust layer. | Keep it as a secondary trust surface, but name it as optional and only for cases that need extra proof. |
| `client/src/pages/Contact.tsx:49-80` and `client/src/components/site/ContactForm.tsx:144-147` | Robot-team requests still default to the `qualification` lane unless hosted mode is explicit. | The form is fine as an intake tool, but the copy around it should not imply qualification is the default value proposition. | Make the default ask “what exact site do you need and what proof path do you want?” and reserve qualification wording for optional trust routing. |
| `client/src/pages/BusinessSignUpFlow.tsx:47-58, 777-785` | Robot-team buyer type says “I already have a target site and need a cleaner qualification read,” then says signup moves the site toward qualification. | This is a direct qualification-first statement on a buyer flow. | Reframe as “I have a target site and need a proof path or hosted review,” then route to the right downstream lane. |
| `client/src/pages/HostedSessionSetup.tsx:323-394` | “Hosted Evaluation Setup,” “Embedded demo readiness,” and “World-model runtime readiness.” | Readiness language is doing too much work and makes the launch path sound conditional instead of buyer-led. | Recast as hosted review / hosted proof launch, with readiness as a secondary status line only. |
| `client/src/pages/SiteWorldDetail.tsx:497-615` | “See the public proof path before you ask for more,” plus a large “Deployment Readiness” block. | The page is good structurally, but the readiness section can dominate the buyer story if it is read as the main decision gate. | Keep proof path primary, and label readiness as an optional trust layer that supports the deal. |
| `client/src/pages/Proof.tsx:69-149` | “See what you can train on before you commit.” | This is directionally okay, but it still leans too hard on training language instead of proof, package, and hosted review. | Put exact-site proof, package choice, and hosted review in the foreground. |
| `client/src/pages/SiteWorlds.tsx:169-225` | “Train on exact sites your team needs before deployment” and “decide whether the site is worth deeper work.” | Mostly aligned, but still a little too deployment-readiness oriented. | Make the action verbs about browsing exact-site packages, hosted review, and artifact handoff. |

## 3. Must-Fix Reference Export

`client/public/llms-full.txt` should be rewritten first.

Reason:
- It is the canonical long-form summary that other agents and tools will reuse.
- It currently teaches the old company story instead of the current one.
- The current repo playbook already flags it as conflicting with doctrine.

Suggested rewrite shape:
- Product overview: “Blueprint is a capture-first platform that turns real sites into site-specific world-model packages and hosted access.”
- Positioning: lead with exact-site proof, hosted review, and artifact handoff.
- Key capabilities: capture, packaging, hosted access, rights/privacy/provenance, optional trust layers.
- FAQs: answer in terms of real-site coverage and buyer workflow, not qualification.

## 4. Message Test Brief

Keep each test to one variable. Measure clicks into the next buyer step, not just page views.

### Test 1. `/proof` hero

- Current: “See what you can train on before you commit.”
- Variant: “See the site first, then choose package or hosted review.”
- Hypothesis: more precise buyer intent, less training-only framing.
- Primary metric: click-through to `/world-models` and `/contact?persona=robot-team`.
- Guard rails: proof-module engagement, bounce rate, sample-listing opens.

### Test 2. `/world-models` hero and access block

- Current: “Train on exact sites your team needs before deployment.”
- Variant: “Browse exact-site packages and hosted review paths.”
- Hypothesis: shifts the page from readiness language to buyer action language.
- Primary metric: listing detail opens and request-hosted-evaluation clicks.
- Guard rails: package CTA clicks, catalog engagement, time on page.

### Test 3. Hosted-evaluation entry copy

- Current: “Hosted Evaluation Setup,” “Embedded demo readiness,” and “World-model runtime readiness.”
- Variant: “Start hosted review for this site,” “Proof launch status,” and “Runtime launch status.”
- Hypothesis: makes the hosted path sound like a proof surface, not a gatekeeping screen.
- Primary metric: hosted-session setup start to launch completion.
- Guard rails: blocker rate, support/help clicks, abandonment rate.

## 5. Rollout Order

1. Rewrite `client/public/llms-full.txt`.
2. Tweak `/proof` to foreground exact-site proof, package choice, and hosted review.
3. Tighten `/world-models` hero/access language.
4. Rephrase hosted-evaluation entry copy.
5. Leave readiness-only language in optional trust surfaces, not the main buyer story.

## 6. Measurement Rule

Treat the page changes as experiments, not taste edits.

- Minimum sample before evaluation: 100 sessions per variant.
- Minimum exposure window: 48 hours.
- Evaluate click-through to the next buyer step as the primary metric.
- Do not claim a win before the sample and guard rails are checked.

## 7. Verification Note

Source review is complete against the repo files above.
Rendered browser verification still needs a working browser environment on this host.
