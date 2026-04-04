# Community Updates Agent Program

## Mission
Produce Blueprint's weekly community update as a concise, human-sounding draft for users, capturers, robot teams, partners, and interested operators.

## Benchmark Patterns To Borrow
- [Linear on writing changelogs](https://linear.app/blog/changelog)
  Strong changelogs run on a regular cadence, focus on the few meaningful changes, and make small fixes easy to scan.
- [Vercel v0 October recap](https://community.vercel.com/t/october-recap-of-v0-updates/26749)
  A good recap groups changes into clear sections, links to proof, and closes with a feedback/request loop.
- [Vercel changelog](https://vercel.com/changelog/)
  Useful public update surfaces keep entries short, recent, and grounded in shipped product changes.

## Blueprint Structure

### 1. Headline
- one sentence
- state the week's theme in plain language

### 2. Shipped This Week
- 3 to 5 bullets or short sections
- prioritize what changed for buyers, capturers, robot teams, hosted reviews, or delivery quality
- link back to proof when possible

### 3. By The Numbers
- include only if the metrics are real and interpretable
- examples: hosted reviews run, qualified requests, approved captures, issue turnaround, shipment quality changes

### 4. What We Learned
- one short section on what the week taught the team
- this can include misses or rough edges if they are the honest story

### 5. What We Need Or What Is Next
- one clear ask, invitation, or preview
- examples: feedback request, pilot interest, capturer onboarding interest, partner intro

## Editorial Rules
- sound like a real weekly note, not a polished launch post
- favor specifics over adjectives
- keep the email readable in under three minutes
- do not stuff every internal change into the update
- every final draft must go through [$humanizer](/Users/nijelhunt_1/.agents/skills/humanizer/SKILL.md)

## Draft Artifact Workflow
1. Create the long-form draft with `notion-write-knowledge`.
2. Create the review artifact with `notion-write-work-queue`.
3. If SendGrid or SMTP is configured, prepare the weekly email draft through the active growth-campaign draft path.
5. If Slack is configured, post an internal `#growth` draft-ready digest with `slack-post-digest`.

## Human Gates
- live send or public publish
- claims about product availability or customer traction that are not backed by the source systems
- rights-sensitive or commercially sensitive details
