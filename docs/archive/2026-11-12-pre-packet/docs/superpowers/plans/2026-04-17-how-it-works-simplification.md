# How It Works Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify `/how-it-works` into a shorter proof-led exact-site training-loop page.

**Architecture:** Keep the implementation scoped to `HowItWorks.tsx` and its focused page test. Remove repeated conceptual sections and keep the page centered on the exact-site loop, the proof path, the comparison, and the closing CTA.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind utility classes, Vitest, Testing Library

---

## File Structure

- Modify: `client/src/pages/HowItWorks.tsx`
- Modify: `client/tests/pages/HowItWorks.test.tsx`
- Create: `docs/superpowers/specs/2026-04-17-how-it-works-simplification-design.md`

### Task 1: Lock the Simplified How-It-Works Contract in Tests

**Files:**
- Modify: `client/tests/pages/HowItWorks.test.tsx`

- [ ] **Step 1: Write the failing test**

Replace the current test with assertions for:

```tsx
expect(screen.getByRole("heading", { name: /Start with one real site\. Train around it\./i })).toBeInTheDocument();
expect(screen.getByRole("heading", { name: /The exact-site loop\./i })).toBeInTheDocument();
expect(screen.getByText(/Anchor to the site/i)).toBeInTheDocument();
expect(screen.getByText(/Branch realistic variation/i)).toBeInTheDocument();
expect(screen.getByText(/Run, compare, and export/i)).toBeInTheDocument();
expect(screen.getByRole("heading", { name: /Proof path, not abstract positioning\./i })).toBeInTheDocument();
expect(screen.getByRole("heading", { name: /Where Blueprint fits in the training stack\./i })).toBeInTheDocument();
expect(screen.queryByText(/What teams train and ship with this/i)).not.toBeInTheDocument();
expect(screen.queryByText(/Proof stories/i)).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the focused How-It-Works test and verify it fails**

Run:

```bash
npx vitest run client/tests/pages/HowItWorks.test.tsx
```

Expected:
- FAIL

### Task 2: Simplify the Page

- [ ] **Step 1: Replace the hero with the shorter editorial framing**
- [ ] **Step 2: Remove the experiment-driven variant split and keep one exact-site loop section**
- [ ] **Step 3: Keep a compressed proof-path section with the existing imagery**
- [ ] **Step 4: Keep the comparison section, but remove the common-jobs and proof-stories sections**
- [ ] **Step 5: Keep a shorter closing CTA**

### Task 3: Verify How It Works

- [ ] **Step 1: Run `npx vitest run client/tests/pages/HowItWorks.test.tsx`**
- [ ] **Step 2: Run `npx vitest run client/tests/pages/Governance.test.tsx client/tests/pages/Pricing.test.tsx client/tests/components/site/PublicCopy.test.tsx`**

Expected:
- PASS

