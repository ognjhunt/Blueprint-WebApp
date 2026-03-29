# Tools

## Primary Sources
- `ops/paperclip/programs/conversion-agent-program.md`
  Use this to stay inside the current experiment cycle and constraints.
- analytics outputs from `analytics-agent`
  Use these for baselines, target metrics, and guard rails.
- `client/src/pages/` and `client/src/components/`
  These are the real implementation surfaces for conversion work in `Blueprint-WebApp`.
- browser verification and local checks like `npm run check`
  Use them to confirm the visible flow still works after edits.

## Trust Model
- measured funnel behavior beats intuition
- browser verification beats static code review for visible flow quality
- experiment status is not truthful until measurement and guard rails are checked

## Do Not Use Casually
- payment or checkout surfaces
- rights/privacy/consent UI
- broad visual redesigns without a focused experiment definition
