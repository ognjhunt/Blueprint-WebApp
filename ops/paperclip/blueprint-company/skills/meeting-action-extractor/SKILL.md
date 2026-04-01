---
name: meeting-action-extractor
description: Extract decisions, owners, deadlines, open questions, and Paperclip-ready follow-ups from Blueprint meeting notes or transcripts for chief-of-staff and manager workflows.
---

# Meeting Action Extractor

Use this skill when a meeting transcript, notes dump, or recap needs to be converted into clear follow-through.

Primary users:

- `blueprint-chief-of-staff`
- `ops-lead`
- `growth-lead`
- `notion-manager-agent` after the meeting artifact exists

## Goal

Convert discussion into execution-ready outputs with explicit ownership.

## What to Extract

- decisions made
- action items
- owners
- due dates or timing cues
- open questions
- cross-agent handoffs
- founder-only items

## Workflow

1. Read the notes or transcript once for overall context.
2. Read again to separate:
   - decisions
   - proposals that were not decided
   - real commitments
   - vague ideas that still need an owner
3. Normalize every action into:
   - `owner`
   - `next step`
   - `why it matters`
   - `due date` or `timing`
4. Mark unclear ownership or timing as a blocker, not as fake certainty.
5. Identify any item that should become or update a Paperclip issue.

## Output Format

Always return:

- `Summary`
- `Decisions`
- `Actions`
- `Open questions`
- `Escalations`
- `Paperclip-ready comment`

For `Actions`, use a flat list where each line contains:

- owner
- action
- due date or timing
- status: `new`, `follow-up`, or `blocked`

## Blueprint Rules

- Prefer the current Paperclip issue graph over meeting memory when they conflict.
- If the meeting implies a cross-agent handoff, state both the sender and receiver.
- If an action needs founder approval, mark it clearly.
- If the notes include strategy, legal, rights, privacy, or pricing commitments, do not convert them into done state automatically.

## Paperclip-Ready Comment

End with one short comment that a manager could paste into a Paperclip issue. It should say:

- what was decided
- who owns the next step
- what is blocked, if anything

Keep it plain English. No raw JSON.

## Do Not

- assign owners that were never implied by the discussion
- invent due dates
- convert brainstorming into commitments
- mark work complete just because it was discussed
