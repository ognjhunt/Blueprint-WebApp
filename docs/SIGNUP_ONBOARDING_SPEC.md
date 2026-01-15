# Business Signup & Onboarding UI/UX Specification

**Date:** January 15, 2026
**Status:** Draft for Review
**Design Philosophy:** KISS (Keep It Simple, Stupid), Minimalist

---

## Executive Summary

Based on competitive research of AI data companies (micro1, Scale AI, Surge AI, Labelbox, Mercor) and analysis of the current Blueprint signup flow, this spec proposes a streamlined signup process that:

1. **Collects essential business context upfront** (like competitors do)
2. **Reduces friction** while gathering qualification data
3. **Provides immediate value** through personalized marketplace experience
4. **Guides users** with progressive onboarding post-signup

**Current Problem:** Users sign up → immediately pushed to /marketplace with no context gathering, leading to:
- Generic marketplace experience
- No sales qualification data
- Missed opportunity for personalization
- High drop-off potential

**Proposed Solution:** Multi-step signup form → contextual onboarding checklist → personalized marketplace

---

## Competitor Research Findings

### Key Patterns Observed

| Company | Signup Approach | Info Collected During Signup |
|---------|----------------|------------------------------|
| **micro1** | Multi-step form before sales contact | Contact details, product selection (data vs. recruiting), project description, usage volume (20-200, 200-1k, 1k+), main challenge, referral source |
| **Scale AI** | Demo request form | Basic contact info → sales team schedules 1:1 demo |
| **Labelbox** | Self-serve + data warehouse connection | Rapid onboarding with warehouse credentials, dataset selection, import scheduling |
| **Surge AI** | Contact founder directly | Email-based contact (edwin@surgehq.ai) |
| **Mercor** | Separate portals | team.mercor.com for employers, work.mercor.com for talent |

### Key Insights

1. **Progressive Information Gathering:** Companies collect business context during signup to:
   - Qualify leads
   - Personalize follow-up
   - Route to appropriate team/product
   - Understand use cases and scale

2. **Optional vs. Required Fields:** Most use "required" for contact basics, "optional but helpful" for context

3. **Volume/Scale Questions:** Common pattern to ask about usage scale (helps with pricing/resource allocation)

4. **Use Case Discovery:** Open text fields for "What's your project?" or "What's your main challenge?"

5. **Source Attribution:** Almost all ask "How did you find us?"

---

## Proposed Solution: 3-Phase Approach

### Phase 1: Enhanced Signup Form (2-3 minutes)
### Phase 2: Onboarding Checklist (5-10 minutes)
### Phase 3: Marketplace Experience (Ongoing)

---

## Phase 1: Enhanced Signup Form

### Design Principle
**Balance friction vs. value:** Collect enough to personalize experience without causing drop-off.

### Step Progression

```
Step 1: Account Basics (30 sec)
    ↓
Step 2: Business Context (60 sec)
    ↓
Step 3: Project Details (60 sec)
    ↓
Account Created → Redirect to Onboarding
```

---

### Step 1: Account Basics

**Purpose:** Create account, establish identity

**Layout:** Center card, 480px max width

```
┌─────────────────────────────────────┐
│                                     │
│    Welcome to Blueprint             │
│    Create your business account     │
│                                     │
│    [  Organization Name  *  ]       │
│    [  Work Email         *  ]       │
│    [  Password           *  ]       │
│    [  Confirm Password   *  ]       │
│                                     │
│    [Continue →]                     │
│                                     │
│    Or sign up with:                 │
│    [Google] [LinkedIn]              │
│                                     │
│    Already have account? Sign in    │
└─────────────────────────────────────┘
```

**Fields:**
- Organization Name * (required)
- Work Email * (required, validated)
- Password * (required, min 8 chars)
- Confirm Password * (required)

**Validation:**
- Email format check
- Password strength indicator
- Real-time validation feedback

**OAuth Options:**
- Google (existing implementation)
- LinkedIn (recommended addition for B2B)

---

### Step 2: Business Context

**Purpose:** Understand the business, qualify lead, personalize experience

**Layout:** Center card with progress indicator (Step 2 of 3)

```
┌─────────────────────────────────────┐
│    ● ● ○  Step 2 of 3               │
│                                     │
│    Tell us about your business      │
│                                     │
│    [  Your Name              *  ]   │
│    [  Job Title                 ]   │
│    [  Phone Number              ]   │
│                                     │
│    What's your primary need?        │
│    [Dropdown ▾]                     │
│    • Training data for AI models    │
│    • Data labeling & annotation     │
│    • RLHF & preference data         │
│    • Custom data collection         │
│    • Dataset marketplace access     │
│    • Other                          │
│                                     │
│    Company size                     │
│    [Radio buttons]                  │
│    ○ 1-10   ○ 11-50   ○ 51-200      │
│    ○ 201-1000   ○ 1000+             │
│                                     │
│    [← Back]  [Continue →]           │
└─────────────────────────────────────┘
```

**Fields:**
- Your Name * (required) - Pre-filled from OAuth if available
- Job Title (optional) - Helps understand decision-making authority
- Phone Number (optional) - For high-value follow-up
- Primary Need * (required dropdown) - Routes to relevant marketplace sections
- Company Size * (required radio) - Helps with pricing/support tier

**Why These Fields:**
- **Name/Title:** Sales qualification
- **Phone:** Optional but increases lead quality
- **Primary Need:** Personalizes marketplace view
- **Company Size:** Helps predict usage scale

---

### Step 3: Project Details

**Purpose:** Understand immediate use case, set expectations

**Layout:** Center card with progress indicator (Step 3 of 3)

```
┌─────────────────────────────────────┐
│    ● ● ●  Step 3 of 3               │
│                                     │
│    Help us personalize your         │
│    experience                       │
│                                     │
│    What brings you to Blueprint?    │
│    [Text area, 2-3 lines]           │
│    (Optional, but helps us show     │
│     you relevant datasets)          │
│                                     │
│    Expected monthly volume          │
│    [Dropdown ▾]                     │
│    • Just exploring                 │
│    • Small (< 1,000 annotations)    │
│    • Medium (1K - 10K)              │
│    • Large (10K - 100K)             │
│    • Enterprise (100K+)             │
│                                     │
│    How did you hear about us?       │
│    [Dropdown ▾]                     │
│    • Search (Google, etc.)          │
│    • LinkedIn                       │
│    • Twitter/X                      │
│    • Referral                       │
│    • Event/Conference               │
│    • Other                          │
│                                     │
│    [← Back]  [Complete Signup →]    │
└─────────────────────────────────────┘
```

**Fields:**
- Project Description (optional textarea) - Open-ended for context
- Expected Volume * (required dropdown) - Key for pricing/resource planning
- Referral Source * (required dropdown) - Attribution tracking

**Why These Fields:**
- **Project Description:** Sales context, AI can analyze and suggest datasets
- **Volume:** Critical for pricing tier recommendations
- **Source:** Marketing attribution

---

### Post-Signup: Account Creation

**Backend Actions:**
```javascript
// 1. Create Firebase user
const user = await registerWithEmailAndPassword(email, password, name);

// 2. Create Firestore user document with new fields
await setDoc(doc(db, "users", user.uid), {
  // Existing fields
  uid: user.uid,
  email,
  name,
  organizationName,
  createdDate: serverTimestamp(),
  finishedOnboarding: false,
  planType: "free",

  // NEW FIELDS from signup form
  jobTitle,
  phoneNumber,
  primaryNeed,          // "training-data", "labeling", "rlhf", etc.
  companySize,          // "1-10", "11-50", etc.
  projectDescription,
  expectedVolume,       // "exploring", "small", "medium", "large", "enterprise"
  referralSource,       // "google", "linkedin", etc.

  // Onboarding state
  onboardingStep: "welcome",
  onboardingProgress: {
    profileComplete: true,
    exploreMarketplace: false,
    createFirstOrder: false,
    inviteTeam: false,
  }
});

// 3. Trigger welcome email with personalized recommendations
await triggerPostSignupWorkflow(user.uid);

// 4. Redirect to onboarding
return { redirectTo: "/onboarding" };
```

**Redirect Logic Update:**
```typescript
// In AuthContext.tsx
const resolveRedirectPath = (data: UserData | null): string => {
  // If user just signed up (onboardingStep exists and not completed)
  if (data?.onboardingStep && data.onboardingStep !== "completed") {
    return "/onboarding";
  }

  // If user hasn't finished main onboarding flow
  if (data && data.finishedOnboarding !== true) {
    return "/marketplace";
  }

  // Otherwise dashboard
  return "/dashboard";
};
```

---

## Phase 2: Onboarding Checklist

### Purpose
Guide new users to first value moments without overwhelming them.

### Design: In-App Checklist Overlay

**Location:** `/onboarding` route (new page)

**Layout:**

```
┌──────────────────────────────────────────────┐
│  [Blueprint Logo]              [Skip Tour] │
│                                              │
│     Welcome to Blueprint, {firstName}! 👋    │
│                                              │
│     Let's get you started in 3 quick steps   │
│                                              │
│  ┌─────────────────────────────────────┐   │
│  │  ✓  Profile complete                │   │
│  │      You're all set up!             │   │
│  └─────────────────────────────────────┘   │
│                                              │
│  ┌─────────────────────────────────────┐   │
│  │  1  Explore the marketplace         │   │
│  │     Browse datasets for your project│   │
│  │     [Start Exploring →]             │   │
│  └─────────────────────────────────────┘   │
│                                              │
│  ┌─────────────────────────────────────┐   │
│  │  2  Create your first order         │   │
│  │     Request custom data or buy      │   │
│  │     existing dataset                │   │
│  │     [Not yet available]             │   │
│  └─────────────────────────────────────┘   │
│                                              │
│  ┌─────────────────────────────────────┐   │
│  │  3  Invite your team (Optional)     │   │
│  │     Collaborate with teammates      │   │
│  │     [Invite Team →]                 │   │
│  └─────────────────────────────────────┘   │
│                                              │
│     [Skip to Marketplace]                    │
└──────────────────────────────────────────────┘
```

### Checklist Items

**✓ 1. Profile Complete** (Auto-completed from signup)
- Already done during signup
- Shows green checkmark

**○ 2. Explore the Marketplace**
- Primary CTA: "Start Exploring →"
- Redirects to `/marketplace` with personalized filters based on `primaryNeed`
- Marks as complete on first marketplace visit

**○ 3. Create Your First Order**
- Secondary priority
- Enabled after exploring marketplace
- Marks as complete when user submits first order/inquiry

**○ 4. Invite Your Team** (Optional)
- Tertiary priority
- Opens team invitation modal
- Can be skipped

### Personalization Logic

Based on signup data, customize the onboarding:

```javascript
// Example personalization
if (userData.primaryNeed === "training-data") {
  welcomeMessage = "Let's find the perfect training datasets for your AI model";
  marketplaceFilter = { category: "training-data" };
  suggestedDatasets = ["Computer Vision", "NLP", "Audio"];
}

if (userData.expectedVolume === "enterprise") {
  showEnterpriseUpgradePrompt = true;
  assignAccountManager = true;
}

if (userData.companySize === "1-10") {
  emphasizeSelfServe = true;
} else {
  emphasizeTeamCollaboration = true;
}
```

### Progress Persistence

```typescript
interface OnboardingProgress {
  profileComplete: boolean;      // Always true after signup
  exploreMarketplace: boolean;   // True after first marketplace visit
  createFirstOrder: boolean;     // True after first order submitted
  inviteTeam: boolean;           // True if team member invited (optional)
  completedAt?: Timestamp;       // When onboarding marked complete
}
```

### Completion Trigger

**Auto-complete when:**
- User explores marketplace (minimum 30 seconds on page)
- User creates first order OR
- User manually clicks "Skip to Marketplace"

**Actions on completion:**
```javascript
await updateDoc(doc(db, "users", uid), {
  finishedOnboarding: true,
  onboardingStep: "completed",
  "onboardingProgress.completedAt": serverTimestamp()
});

// Future visits → redirect to /dashboard instead of /marketplace
```

---

## Phase 3: Enhanced Marketplace Experience

### Purpose
Use signup data to personalize the marketplace landing.

### Personalized Welcome Banner

**Location:** Top of `/marketplace` page

```
┌──────────────────────────────────────────────┐
│  Hi {firstName}! Based on your interest in   │
│  {primaryNeed}, here are some datasets we    │
│  think you'll love.                          │
│                                              │
│  [View Recommended →]  [Browse All]          │
└──────────────────────────────────────────────┘
```

### Smart Filtering

Pre-apply filters based on signup data:

```javascript
// Default marketplace filters on first visit
const initialFilters = {
  category: mapPrimaryNeedToCategory(userData.primaryNeed),
  sort: "recommended-for-you",
  priceRange: mapVolumeToPrice(userData.expectedVolume)
};
```

### Suggested Actions

Based on `projectDescription` AI analysis:

```
┌──────────────────────────────────────────────┐
│  📊 Suggested for Your Project               │
│                                              │
│  We noticed you're working on "{excerpt}"   │
│                                              │
│  [Computer Vision Dataset] [NLP Toolkit]    │
│  [Custom Data Request]                       │
└──────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Enhanced Signup (Week 1-2)
- [ ] Update `OutboundSignUpFlow.tsx` or create new `BusinessSignUpFlow.tsx`
- [ ] Add new fields to Firestore user schema
- [ ] Update AuthContext redirect logic
- [ ] Add form validation and error handling
- [ ] Update Firebase user creation logic

### Phase 2: Onboarding Page (Week 2-3)
- [ ] Create `/onboarding` route and component
- [ ] Build checklist UI components
- [ ] Implement progress tracking
- [ ] Add personalization logic based on signup data
- [ ] Update `finishedOnboarding` flag on completion

### Phase 3: Marketplace Personalization (Week 3-4)
- [ ] Update marketplace landing with welcome banner
- [ ] Implement smart filtering based on signup data
- [ ] Build AI-powered recommendation engine using `projectDescription`
- [ ] Add suggested actions section
- [ ] A/B test personalized vs. generic experience

---

## Technical Specifications

### New Firestore Fields

```typescript
interface UserData {
  // ... existing fields ...

  // NEW: Signup form data
  jobTitle?: string;
  phoneNumber?: string;
  primaryNeed?: "training-data" | "labeling" | "rlhf" | "collection" | "marketplace" | "other";
  companySize?: "1-10" | "11-50" | "51-200" | "201-1000" | "1000+";
  projectDescription?: string;
  expectedVolume?: "exploring" | "small" | "medium" | "large" | "enterprise";
  referralSource?: "google" | "linkedin" | "twitter" | "referral" | "event" | "other";

  // NEW: Onboarding state
  onboardingStep?: "welcome" | "explore" | "order" | "team" | "completed";
  onboardingProgress?: {
    profileComplete: boolean;
    exploreMarketplace: boolean;
    createFirstOrder: boolean;
    inviteTeam: boolean;
    completedAt?: Timestamp;
  };

  // NEW: Personalization metadata
  recommendedCategories?: string[];
  personalizedWelcomeShown?: boolean;
  firstMarketplaceVisit?: Timestamp;
  firstOrderAt?: Timestamp;
}
```

### Routes Updates

```typescript
// New routes to add
{
  path: "/onboarding",
  element: <OnboardingChecklist />,
  protected: true
}

// Update existing signup route
{
  path: "/signup/business",
  element: <BusinessSignUpFlow />,
  protected: false
}
```

### API Endpoints

```typescript
// New endpoints needed

POST /api/signup/business
  - Creates user with extended business fields
  - Triggers welcome email
  - Returns: { userId, redirectTo: "/onboarding" }

PUT /api/users/:uid/onboarding
  - Updates onboarding progress
  - Body: { step: string, progress: OnboardingProgress }
  - Returns: { updated: boolean, nextStep: string }

GET /api/marketplace/recommendations/:uid
  - Returns personalized dataset recommendations
  - Based on: primaryNeed, projectDescription, expectedVolume
  - Uses AI to analyze project description
  - Returns: { datasets: Dataset[], reasoning: string }
```

### Component Structure

```
src/
├── pages/
│   ├── BusinessSignUpFlow.tsx (new)
│   ├── OnboardingChecklist.tsx (new)
│   └── Marketplace.tsx (update)
├── components/
│   ├── signup/
│   │   ├── AccountBasicsStep.tsx (new)
│   │   ├── BusinessContextStep.tsx (new)
│   │   └── ProjectDetailsStep.tsx (new)
│   └── onboarding/
│       ├── ChecklistCard.tsx (new)
│       ├── ProgressIndicator.tsx (new)
│       └── WelcomeBanner.tsx (new)
└── hooks/
    ├── useOnboardingProgress.ts (new)
    └── useMarketplacePersonalization.ts (new)
```

---

## Design System Guidelines

### Visual Hierarchy
- **Primary CTA:** Blue (#0066FF), bold, larger
- **Secondary CTA:** Gray outline, medium
- **Progress Indicators:** Green checkmarks for completed, gray circles for pending

### Typography
- **Headings:** Inter/System font, 24px, semibold
- **Body:** 16px, regular
- **Helper text:** 14px, gray-600

### Spacing
- **Form fields:** 16px vertical gap
- **Sections:** 32px vertical gap
- **Card padding:** 24px

### Form Validation
- **Inline validation:** Show errors on blur
- **Success states:** Green checkmark next to valid fields
- **Error states:** Red border + error message below field

### Mobile Responsiveness
- Stack form fields vertically on mobile
- Reduce card width to 100% on mobile
- Maintain touch-friendly tap targets (min 44px)

---

## Success Metrics

### Signup Conversion
- **Current baseline:** (measure current signup → marketplace flow)
- **Target:** 85%+ completion rate for 3-step signup
- **Metric:** (completed signups / started signups) × 100

### Onboarding Completion
- **Target:** 70%+ users complete "Explore marketplace" step
- **Target:** 30%+ users complete "Create first order" step
- **Metric:** Track onboardingProgress.exploreMarketplace and .createFirstOrder

### Time to Value
- **Target:** < 5 minutes from signup to marketplace exploration
- **Metric:** (firstMarketplaceVisit - createdDate) average

### Data Quality
- **Target:** 60%+ users provide project description
- **Target:** 90%+ users complete all required fields
- **Metric:** Count non-null projectDescription fields

### Personalization Impact
- **Target:** 20%+ increase in marketplace engagement for users with personalized experience
- **Metric:** Compare session duration and page views between personalized vs. non-personalized users

---

## A/B Testing Plan

### Test 1: Signup Length (Week 1)
- **Variant A:** 3-step signup (proposed)
- **Variant B:** 2-step signup (combine steps 2 & 3)
- **Metric:** Completion rate, time to complete
- **Winner:** Higher completion rate

### Test 2: Optional Fields (Week 2)
- **Variant A:** All optional fields visible
- **Variant B:** Optional fields hidden behind "More details" expansion
- **Metric:** Completion rate, data quality
- **Winner:** Balance between completion and data collected

### Test 3: Onboarding Format (Week 3)
- **Variant A:** Dedicated onboarding page (proposed)
- **Variant B:** In-marketplace tooltip tour
- **Metric:** Onboarding completion, time to first order
- **Winner:** Higher engagement and conversion

---

## Competitive Advantages

Based on research, Blueprint's approach will stand out by:

1. **Self-Serve Focus:** Unlike Scale/Surge (sales-heavy), we enable immediate marketplace access
2. **Progressive Onboarding:** Collect data over time vs. upfront
3. **AI Personalization:** Use project description to suggest datasets (unique)
4. **Transparency:** Show pricing and datasets upfront (vs. demo-required)
5. **Fast Time-to-Value:** < 5 min to explore marketplace vs. waiting for sales calls

---

## Open Questions for Review

1. **OAuth Providers:** Add LinkedIn in addition to Google? (Recommended YES for B2B)
2. **Phone Number:** Should it be required or optional? (Recommend OPTIONAL to reduce friction)
3. **Volume Tiers:** Are the proposed tiers (small/medium/large/enterprise) aligned with actual pricing?
4. **Marketplace Personalization:** How aggressive should smart filtering be? (Recommend subtle: suggest but don't restrict)
5. **Team Invitations:** Should this be in onboarding or saved for dashboard? (Recommend OPTIONAL in onboarding)
6. **Sales Follow-up:** For "enterprise" volume users, should we trigger immediate sales outreach? (Recommend YES)
7. **Demo Scheduling:** Should we keep the demo scheduling step from OutboundSignUpFlow? (Recommend REMOVE for self-serve, add "Request Demo" CTA in dashboard)

---

## Migration Plan

### For Existing Users
- Users with `finishedOnboarding: false` → Show onboarding checklist on next login
- Users with `finishedOnboarding: true` → No change, continue to dashboard
- Backfill missing fields with modal: "Help us personalize your experience" (optional survey)

### For New Users
- All new signups use BusinessSignUpFlow
- Redirect to /onboarding after account creation
- Mark onboarding complete after marketplace exploration

---

## Appendix: Research Sources

### Competitor Signups Researched
- [micro1.ai](https://www.micro1.ai) - Multi-step form with volume/challenge questions
- [Scale AI Demo Request](https://scale.com/request-a-demo) - Sales-qualified leads
- [Labelbox Signup](https://labelbox.com/) - Self-serve with data warehouse integration
- [Surge AI Contact](https://surgehq.ai/) - Direct founder contact
- [Mercor Team Portal](https://www.mercor.com) - Separate B2B/talent portals
- Handshake AI Fellowship - Onboarding checklist pattern
- DataAnnotation.tech - Worker-focused (not B2B)
- Remotasks - Worker-focused (Scale subsidiary)

### Additional Research
- [Built With Census: Labelbox](https://www.getcensus.com/blog/labelbox-data-onboarding-census-embedded) - Data onboarding patterns
- [Scale AI Overview](https://scale.com/blog/remotasks-overview) - B2B vs. worker platforms
- Industry best practices for B2B SaaS onboarding

---

**Next Steps:**
1. Review this spec with team
2. Answer open questions above
3. Prioritize Phase 1 implementation
4. Design mockups in Figma (optional)
5. Begin development

---

**Document Owner:** Claude (AI Assistant)
**Last Updated:** January 15, 2026
**Status:** Ready for Review
