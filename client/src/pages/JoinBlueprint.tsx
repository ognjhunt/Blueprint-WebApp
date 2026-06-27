import { useMemo, useState, type ReactNode } from "react";

import { Helmet } from "@/lib/helmet";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Cpu,
  MapPin,
  ShieldCheck,
} from "lucide-react";

import {
  Button,
  Checkbox,
  DataField,
  Field,
  ProofBoundary,
  SelectField,
  StatusChip,
  Switch,
} from "@/components/blueprint";
import { MonochromeMedia, ProofChip } from "@/components/site/editorial";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types + flow config                                                */
/* ------------------------------------------------------------------ */

type Flow = "capturer" | "robot";

type StepDef = {
  id: string;
  label: string;
  title: string;
  description: string;
};

const FLOW_STEPS: Record<Flow, StepDef[]> = {
  capturer: [
    {
      id: "account",
      label: "Account",
      title: "Create your capturer account.",
      description:
        "You capture real indoor sites on a phone. We package the evidence with provenance so robot teams can evaluate against it.",
    },
    {
      id: "coverage",
      label: "Coverage",
      title: "Where can you capture?",
      description:
        "Tell us the region and facility types you can reach. Assignments route by city and access.",
    },
    {
      id: "rights",
      label: "Rights",
      title: "Acknowledge the rights & privacy rules.",
      description:
        "Every capture stays in lawful, public-facing areas with provenance intact. Confirm all three to continue.",
    },
    {
      id: "review",
      label: "Review",
      title: "Review and submit.",
      description:
        "Confirm the details below. We will follow up with onboarding and your first assignment window.",
    },
  ],
  robot: [
    {
      id: "account",
      label: "Account",
      title: "Create your robot-team account.",
      description:
        "Evaluate robot policies against real captured sites before field time. Set up your workspace to request runs.",
    },
    {
      id: "team",
      label: "Team",
      title: "Tell us about your team.",
      description:
        "This sizes your workspace and routes you to the right onboarding. Nothing here is a commitment.",
    },
    {
      id: "policy",
      label: "Policy",
      title: "How do your policies run?",
      description:
        "We support checkpoints, API runners, and VLA policies. This is illustrative setup, not a deployment.",
    },
    {
      id: "review",
      label: "Review",
      title: "Review and submit.",
      description:
        "Confirm the details below. We will reach out to schedule your first evaluation run.",
    },
  ],
};

/* Left-panel content adapts to the selected flow. */
const PANEL: Record<
  Flow,
  {
    src: string;
    alt: string;
    eyebrow: string;
    headline: string;
    lede: string;
    chips: string[];
    facts: { label: string; value: string }[];
  }
> = {
  capturer: {
    src: "/redesign/pov/route-scan.jpg",
    alt: "Capturer walking a documented route through a facility",
    eyebrow: "Become a capturer",
    headline: "Walk real sites. Bank the proof.",
    lede:
      "Capture indoor facilities on a guided route. Blueprint packages every walkthrough with provenance, rights, and coverage so it can stand as evaluation evidence.",
    chips: ["Capture-backed", "Provenance kept", "Public-facing only"],
    facts: [
      { label: "Capture path", value: "Guided · route-traced" },
      { label: "Per bundle", value: "Est. payout on accept" },
      { label: "Review", value: "QA-gated before handoff" },
    ],
  },
  robot: {
    src: "/redesign/robot-hero.png",
    alt: "Robot operating in a captured indoor site",
    eyebrow: "For robot teams",
    headline: "Test policies before field time.",
    lede:
      "Run your policies against real captured sites and compare candidates on rank fidelity. Every verdict stays proof-gated and labeled as estimate, never a deployment guarantee.",
    chips: ["Proof-gated verdicts", "Rank fidelity", "Real-site evidence"],
    facts: [
      { label: "Episodes / run", value: "100 or 500" },
      { label: "Rank correlation", value: "0.929 illustrative" },
      { label: "Surfaces", value: "Buyer app + ops" },
    ],
  },
};

const REGION_OPTIONS = [
  { value: "austin", label: "Austin, TX" },
  { value: "dallas", label: "Dallas, TX" },
  { value: "phoenix", label: "Phoenix, AZ" },
  { value: "atlanta", label: "Atlanta, GA" },
  { value: "other", label: "Elsewhere (US)" },
];

const FACILITY_OPTIONS = [
  { value: "warehouse", label: "Warehouse & logistics" },
  { value: "manufacturing", label: "Manufacturing & machine tending" },
  { value: "retail", label: "Retail backroom & floor" },
  { value: "coldstorage", label: "Cold storage & food handling" },
  { value: "mixed", label: "Mixed / multiple types" },
];

const GEAR_OPTIONS = [
  { value: "iphone-pro", label: "iPhone Pro (LiDAR)" },
  { value: "ipad-pro", label: "iPad Pro (LiDAR)" },
  { value: "none", label: "No LiDAR device yet" },
];

const TEAM_SIZE_OPTIONS = [
  { value: "1-5", label: "1-5 people" },
  { value: "6-20", label: "6-20 people" },
  { value: "21-50", label: "21-50 people" },
  { value: "50+", label: "50+ people" },
];

const ROBOT_TYPE_OPTIONS = [
  { value: "mobile-manip", label: "Mobile manipulator" },
  { value: "humanoid", label: "Humanoid" },
  { value: "arm", label: "Fixed arm / cell" },
  { value: "amr", label: "Autonomous mobile robot" },
];

const POLICY_TYPE_OPTIONS = [
  { value: "checkpoint", label: "Checkpoint" },
  { value: "api-runner", label: "API runner" },
  { value: "vla", label: "VLA policy" },
];

const EPISODE_OPTIONS = [
  { value: "100", label: "100 episodes" },
  { value: "500", label: "500 episodes" },
];

/* ------------------------------------------------------------------ */
/* Form state                                                         */
/* ------------------------------------------------------------------ */

type FormState = {
  name: string;
  email: string;
  password: string;
  // capturer
  region: string;
  facility: string;
  gear: string;
  ackRights: boolean;
  ackPrivacy: boolean;
  ackProvenance: boolean;
  // robot team
  company: string;
  teamSize: string;
  robotType: string;
  policyType: string;
  episodes: string;
  advisorySim: boolean;
};

const INITIAL_FORM: FormState = {
  name: "",
  email: "",
  password: "",
  region: "",
  facility: "",
  gear: "",
  ackRights: false,
  ackPrivacy: false,
  ackProvenance: false,
  company: "",
  teamSize: "",
  robotType: "",
  policyType: "checkpoint",
  episodes: "100",
  advisorySim: true,
};

/* ------------------------------------------------------------------ */
/* Small inline pieces                                                */
/* ------------------------------------------------------------------ */

function BrandLockup({ onInk = false }: { onInk?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3">
      <img
        src="/redesign/logo-mark-brass.svg"
        alt=""
        aria-hidden="true"
        className="h-7 w-7 shrink-0"
      />
      <span
        className={cn(
          "font-semibold leading-none tracking-[-0.035em] text-[1.35rem]",
          onInk ? "text-[color:var(--text-on-ink)]" : "text-ink-900",
        )}
      >
        Blueprint
      </span>
    </span>
  );
}

function Stepper({
  steps,
  current,
}: {
  steps: StepDef[];
  current: number;
}) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step.id} className="flex flex-1 items-center gap-2">
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-mono",
                  done && "border-brass-deep bg-brass text-ink-900",
                  active &&
                    "border-brass-deep bg-white text-ink-900 ring-2 ring-brass-deep/40",
                  !done && !active && "border-line-strong bg-white text-ink-400",
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
              </span>
              <span
                className={cn(
                  "hidden text-[11px] font-semibold uppercase tracking-[0.16em] sm:inline",
                  active ? "text-ink-900" : "text-ink-400",
                )}
              >
                {step.label}
              </span>
            </span>
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "h-px flex-1",
                  done ? "bg-brass-deep" : "bg-line-strong",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/* Segmented control for the episode budget. */
function SegmentedField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <span className="text-caption font-semibold text-ink-800">{label}</span>
      <div className="inline-flex w-full overflow-hidden rounded-xs border border-line-strong bg-white">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={cn(
                "flex-1 px-3 py-2 text-body-s font-medium transition-colors duration-200 ease-standard",
                selected
                  ? "bg-ink text-[color:var(--text-on-ink)]"
                  : "bg-white text-ink-600 hover:bg-inset",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function JoinBlueprint() {
  const [flow, setFlow] = useState<Flow>("capturer");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitted, setSubmitted] = useState(false);

  const steps = FLOW_STEPS[flow];
  const panel = PANEL[flow];
  const activeStep = steps[step];
  const isLastStep = step === steps.length - 1;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const switchFlow = (next: Flow) => {
    if (next === flow) return;
    setFlow(next);
    setStep(0);
  };

  /* The capturer flow gates Continue on the 3-checkbox acknowledgement. */
  const rightsAcknowledged =
    form.ackRights && form.ackPrivacy && form.ackProvenance;
  const continueBlocked =
    flow === "capturer" && activeStep.id === "rights" && !rightsAcknowledged;

  const handleBack = () => setStep((value) => Math.max(0, value - 1));
  const handleContinue = () => {
    if (continueBlocked) return;
    if (isLastStep) {
      setSubmitted(true);
      return;
    }
    setStep((value) => Math.min(steps.length - 1, value + 1));
  };

  const reset = () => {
    setSubmitted(false);
    setStep(0);
    setForm(INITIAL_FORM);
  };

  const summaryRows = useMemo(() => {
    if (flow === "capturer") {
      return [
        { label: "Account", value: form.email || "—" },
        {
          label: "Region",
          value:
            REGION_OPTIONS.find((o) => o.value === form.region)?.label ?? "—",
        },
        {
          label: "Facilities",
          value:
            FACILITY_OPTIONS.find((o) => o.value === form.facility)?.label ?? "—",
        },
        {
          label: "Capture gear",
          value: GEAR_OPTIONS.find((o) => o.value === form.gear)?.label ?? "—",
        },
      ];
    }
    return [
      { label: "Account", value: form.email || "—" },
      { label: "Company", value: form.company || "—" },
      {
        label: "Team size",
        value:
          TEAM_SIZE_OPTIONS.find((o) => o.value === form.teamSize)?.label ?? "—",
      },
      {
        label: "Policy type",
        value:
          POLICY_TYPE_OPTIONS.find((o) => o.value === form.policyType)?.label ??
          "—",
      },
    ];
  }, [flow, form]);

  return (
    <div className="min-h-screen bg-canvas">
      <Helmet>
        <title>Join Blueprint | Capturers & robot teams</title>
        <meta
          name="description"
          content="Create a Blueprint account — capture real indoor sites, or evaluate robot policies against real-site evidence."
        />
      </Helmet>

      <div className="grid min-h-screen lg:grid-cols-[0.46fr_0.54fr]">
        {/* ---------------------------------------------------------- */}
        {/* LEFT — dark value panel (adapts to flow)                   */}
        {/* ---------------------------------------------------------- */}
        <aside className="relative hidden overflow-hidden bg-ink lg:block">
          <MonochromeMedia
            src={panel.src}
            alt={panel.alt}
            loading="eager"
            radius="none"
            overlay="none"
            className="absolute inset-0 h-full w-full"
            imageClassName="h-full w-full brightness-[0.4]"
            overlayClassName="bg-[linear-gradient(180deg,rgba(13,13,11,0.55),rgba(13,13,11,0.82))]"
          />
          <div
            aria-hidden="true"
            className="bp-evidence-grid pointer-events-none absolute inset-0 opacity-60"
          />

          <div className="relative flex h-full min-h-screen flex-col justify-between p-10 xl:p-12">
            <BrandLockup onInk />

            <div className="bp-fade-up max-w-[30rem]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">
                {panel.eyebrow}
              </p>
              <h1 className="font-display mt-5 text-[clamp(2.4rem,3.4vw,3.4rem)] font-medium leading-[1.04] tracking-[-0.03em] text-[color:var(--text-on-ink)]">
                {panel.headline}
              </h1>
              <p className="mt-5 text-[15px] leading-[1.7] text-[color:var(--text-on-ink)] opacity-80">
                {panel.lede}
              </p>
              <div className="mt-7 flex flex-wrap gap-2">
                {panel.chips.map((chip) => (
                  <ProofChip key={chip} light>
                    {chip}
                  </ProofChip>
                ))}
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <dl className="grid gap-2">
                {panel.facts.map((fact) => (
                  <DataField
                    key={fact.label}
                    label={fact.label}
                    value={fact.value}
                    onInk
                    border={false}
                  />
                ))}
              </dl>
              <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.12em] text-[color:var(--text-on-ink)] opacity-55">
                Generated & simulated media is review support — not real-world proof.
              </p>
            </div>
          </div>
        </aside>

        {/* ---------------------------------------------------------- */}
        {/* RIGHT — white form                                         */}
        {/* ---------------------------------------------------------- */}
        <main className="flex min-h-screen flex-col bg-canvas">
          <div className="mx-auto flex w-full max-w-[34rem] flex-1 flex-col px-6 py-8 sm:px-8 sm:py-10">
            {/* Mobile brand lockup (left panel hidden under lg) */}
            <div className="mb-8 lg:hidden">
              <BrandLockup />
            </div>

            {submitted ? (
              <SuccessState flow={flow} form={form} onReset={reset} />
            ) : (
              <>
                {/* Flow toggle */}
                <div
                  className="grid grid-cols-2 gap-px overflow-hidden rounded-xs border border-line-strong bg-line-strong"
                  role="tablist"
                  aria-label="Choose how you'll use Blueprint"
                >
                  <FlowTab
                    active={flow === "capturer"}
                    icon={<Camera className="h-4 w-4" strokeWidth={1.75} />}
                    label="I'm a capturer"
                    onClick={() => switchFlow("capturer")}
                  />
                  <FlowTab
                    active={flow === "robot"}
                    icon={<Cpu className="h-4 w-4" strokeWidth={1.75} />}
                    label="I'm a robot team"
                    onClick={() => switchFlow("robot")}
                  />
                </div>

                {/* Stepper */}
                <div className="mt-8">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400">
                      Step {step + 1} / {steps.length}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400">
                      {flow === "capturer" ? "Capturer" : "Robot team"}
                    </span>
                  </div>
                  <Stepper steps={steps} current={step} />
                </div>

                {/* Step header */}
                <div className="bp-fade-up mt-8" key={`${flow}-${activeStep.id}`}>
                  <h2 className="font-display text-[1.7rem] font-medium leading-[1.1] tracking-[-0.02em] text-ink-900">
                    {activeStep.title}
                  </h2>
                  <p className="mt-2 text-body-s leading-[1.6] text-ink-500">
                    {activeStep.description}
                  </p>
                </div>

                {/* Step fields */}
                <div className="mt-7 flex flex-col gap-5">
                  {flow === "capturer" ? (
                    <CapturerStep
                      step={activeStep.id}
                      form={form}
                      update={update}
                      summaryRows={summaryRows}
                    />
                  ) : (
                    <RobotStep
                      step={activeStep.id}
                      form={form}
                      update={update}
                      summaryRows={summaryRows}
                    />
                  )}
                </div>

                {/* Nav */}
                <div className="mt-auto flex items-center gap-3 pt-10">
                  {step > 0 ? (
                    <Button
                      variant="secondary"
                      onClick={handleBack}
                      iconLeft={<ArrowLeft className="h-4 w-4" />}
                    >
                      Back
                    </Button>
                  ) : (
                    <a
                      href="/login"
                      className="text-body-s font-semibold text-ink-500 transition-colors hover:text-ink-900"
                    >
                      Already have an account? Sign in
                    </a>
                  )}
                  <div className="ml-auto">
                    {isLastStep ? (
                      <Button
                        variant="brass"
                        onClick={handleContinue}
                        disabled={continueBlocked}
                        iconRight={<ShieldCheck className="h-4 w-4" />}
                      >
                        Submit application
                      </Button>
                    ) : (
                      <Button
                        variant="action"
                        onClick={handleContinue}
                        disabled={continueBlocked}
                        iconRight={<ArrowRight className="h-4 w-4" />}
                      >
                        Continue
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Flow tab                                                           */
/* ------------------------------------------------------------------ */

function FlowTab({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-3 text-body-s font-semibold transition-colors duration-200 ease-standard",
        active
          ? "bg-ink text-[color:var(--text-on-ink)]"
          : "bg-white text-ink-500 hover:bg-inset hover:text-ink-900",
      )}
    >
      <span className={active ? "text-brass" : "text-ink-400"}>{icon}</span>
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Capturer steps                                                     */
/* ------------------------------------------------------------------ */

function CapturerStep({
  step,
  form,
  update,
  summaryRows,
}: {
  step: string;
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  summaryRows: { label: string; value: string }[];
}) {
  if (step === "account") {
    return (
      <>
        <Field
          label="Full name"
          placeholder="Jordan Rivera"
          autoComplete="name"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
        />
        <Field
          label="Email"
          type="email"
          placeholder="you@email.com"
          autoComplete="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
        />
        <Field
          label="Password"
          type="password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
          hint="You'll confirm your email before your first assignment."
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
        />
      </>
    );
  }

  if (step === "coverage") {
    return (
      <>
        <SelectField
          label="Primary region"
          placeholder="Select a city"
          options={REGION_OPTIONS}
          value={form.region || undefined}
          onValueChange={(v) => update("region", v)}
        />
        <SelectField
          label="Facility types you can reach"
          placeholder="Select facility types"
          options={FACILITY_OPTIONS}
          value={form.facility || undefined}
          onValueChange={(v) => update("facility", v)}
        />
        <SelectField
          label="Capture device"
          placeholder="Select your device"
          hint="A LiDAR-capable device produces the strongest capture bundles."
          options={GEAR_OPTIONS}
          value={form.gear || undefined}
          onValueChange={(v) => update("gear", v)}
        />
      </>
    );
  }

  if (step === "rights") {
    return (
      <>
        <ProofBoundary level="info" title="Why this matters">
          Captures become evaluation evidence only when rights, privacy, and
          provenance hold. These acknowledgements stay attached to every bundle
          you submit.
        </ProofBoundary>
        <div className="flex flex-col gap-4 rounded-md border border-line bg-white p-4">
          <Checkbox
            label="Rights — lawful, public-facing capture only"
            description="I will only capture in areas I'm permitted to record, and I'll stop on objection."
            checked={form.ackRights}
            onCheckedChange={(v) => update("ackRights", v === true)}
          />
          <Checkbox
            label="Privacy — no restricted or private zones"
            description="I will avoid employee-only, payment, screen, and other restricted areas, and flag anything for redaction."
            checked={form.ackPrivacy}
            onCheckedChange={(v) => update("ackPrivacy", v === true)}
          />
          <Checkbox
            label="Provenance — capture truth stays intact"
            description="I won't alter, stage, or misrepresent a capture; the manifest reflects where, when, and how it was recorded."
            checked={form.ackProvenance}
            onCheckedChange={(v) => update("ackProvenance", v === true)}
          />
        </div>
        {!(form.ackRights && form.ackPrivacy && form.ackProvenance) ? (
          <p className="flex items-center gap-2 text-caption text-warn-fg">
            <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            Acknowledge all three to continue.
          </p>
        ) : (
          <StatusChip tone="proof">All acknowledgements confirmed</StatusChip>
        )}
      </>
    );
  }

  // review
  return (
    <SummaryCard
      eyebrow="Capturer application"
      rows={summaryRows}
      boundaryLevel="proof"
      boundaryTitle="Provenance preserved"
      boundaryBody="Your acknowledgements are recorded with this application. We'll confirm your region and schedule your first assignment window."
      acknowledged
    />
  );
}

/* ------------------------------------------------------------------ */
/* Robot-team steps                                                   */
/* ------------------------------------------------------------------ */

function RobotStep({
  step,
  form,
  update,
  summaryRows,
}: {
  step: string;
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  summaryRows: { label: string; value: string }[];
}) {
  if (step === "account") {
    return (
      <>
        <Field
          label="Full name"
          placeholder="Alex Chen"
          autoComplete="name"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
        />
        <Field
          label="Work email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
        />
        <Field
          label="Password"
          type="password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
        />
      </>
    );
  }

  if (step === "team") {
    return (
      <>
        <Field
          label="Company"
          placeholder="Acme Robotics"
          autoComplete="organization"
          value={form.company}
          onChange={(e) => update("company", e.target.value)}
        />
        <SelectField
          label="Team size"
          placeholder="Select team size"
          options={TEAM_SIZE_OPTIONS}
          value={form.teamSize || undefined}
          onValueChange={(v) => update("teamSize", v)}
        />
        <SelectField
          label="Robot type"
          placeholder="Select robot type"
          options={ROBOT_TYPE_OPTIONS}
          value={form.robotType || undefined}
          onValueChange={(v) => update("robotType", v)}
        />
      </>
    );
  }

  if (step === "policy") {
    return (
      <>
        <SelectField
          label="Policy type"
          placeholder="Select policy type"
          hint="Checkpoints, API runners, and VLA policies are all supported."
          options={POLICY_TYPE_OPTIONS}
          value={form.policyType || undefined}
          onValueChange={(v) => update("policyType", v)}
        />
        <SegmentedField
          label="Default episode budget per run"
          options={EPISODE_OPTIONS}
          value={form.episodes}
          onChange={(v) => update("episodes", v)}
        />
        <div className="rounded-md border border-line bg-inset p-4">
          <Switch
            label="Include advisory sim preflight"
            checked={form.advisorySim}
            onCheckedChange={(v) => update("advisorySim", v === true)}
          />
          <p className="mt-2 text-caption text-ink-500">
            Sim preflight is review support, labeled as a prediction — never a
            deployment-ready guarantee.
          </p>
        </div>
        <ProofBoundary level="warn" title="Estimates, not guarantees">
          Run outputs are framed as predicted success and rank fidelity. Blueprint
          does not claim guaranteed field performance.
        </ProofBoundary>
      </>
    );
  }

  // review
  return (
    <SummaryCard
      eyebrow="Robot-team workspace"
      rows={summaryRows}
      boundaryLevel="info"
      boundaryBody="We'll provision your workspace and reach out to schedule a first evaluation run on a real captured site."
      boundaryTitle="What happens next"
      extraRows={[
        {
          label: "Episodes / run",
          value: `${form.episodes} default`,
        },
        {
          label: "Advisory sim",
          value: form.advisorySim ? "On" : "Off",
        },
      ]}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Review summary                                                     */
/* ------------------------------------------------------------------ */

function SummaryCard({
  eyebrow,
  rows,
  extraRows = [],
  boundaryLevel,
  boundaryTitle,
  boundaryBody,
  acknowledged = false,
}: {
  eyebrow: string;
  rows: { label: string; value: string }[];
  extraRows?: { label: string; value: string }[];
  boundaryLevel: "info" | "proof" | "warn" | "block";
  boundaryTitle: string;
  boundaryBody: string;
  acknowledged?: boolean;
}) {
  const allRows = [...rows, ...extraRows];
  return (
    <>
      <div className="rounded-md border border-line bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-400">
            {eyebrow}
          </span>
          {acknowledged ? (
            <StatusChip tone="proof" square dot={false}>
              Rights confirmed
            </StatusChip>
          ) : null}
        </div>
        <dl>
          {allRows.map((row, index) => (
            <DataField
              key={row.label}
              label={row.label}
              value={row.value}
              mono={false}
              border={index < allRows.length - 1}
            />
          ))}
        </dl>
      </div>
      <ProofBoundary level={boundaryLevel} title={boundaryTitle}>
        {boundaryBody}
      </ProofBoundary>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Success state                                                      */
/* ------------------------------------------------------------------ */

function SuccessState({
  flow,
  form,
  onReset,
}: {
  flow: Flow;
  form: FormState;
  onReset: () => void;
}) {
  const isCapturer = flow === "capturer";
  return (
    <div className="bp-fade-up flex flex-1 flex-col justify-center py-10">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-proof-bd bg-proof-bg text-proof-fg">
        <Check className="h-7 w-7" strokeWidth={2.25} />
      </span>
      <h2 className="font-display mt-6 text-[2rem] font-medium leading-[1.08] tracking-[-0.025em] text-ink-900">
        {isCapturer
          ? "Application received."
          : "Workspace request received."}
      </h2>
      <p className="mt-3 max-w-[28rem] text-body-s leading-[1.6] text-ink-500">
        {isCapturer
          ? "Thanks for applying to capture for Blueprint. We'll confirm your region and follow up with onboarding and your first assignment window."
          : "Thanks for your interest. We'll provision your workspace and reach out to schedule a first evaluation run on a real captured site."}
      </p>

      <div className="mt-7 rounded-md border border-line bg-white p-5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-400">
          On file
        </span>
        <dl className="mt-3">
          <DataField label="Account" value={form.email || "—"} mono={false} />
          <DataField
            label="Track"
            value={isCapturer ? "Capturer" : "Robot team"}
            mono={false}
          />
          <DataField
            label="Reference"
            value={isCapturer ? "CAP-2049" : "RUN-2049"}
            border={false}
          />
        </dl>
      </div>

      <ProofBoundary
        level={isCapturer ? "proof" : "info"}
        title="No claims beyond this application"
        className="mt-5"
      >
        This is a review-support workflow. Nothing here is a deployment, supply,
        or readiness guarantee — we'll confirm everything before next steps.
      </ProofBoundary>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button variant="brass" asChild>
          <a href="/">
            <span className="inline-flex items-center gap-2">
              Back to home
              <ArrowRight className="h-4 w-4" />
            </span>
          </a>
        </Button>
        <Button
          variant="ghost"
          onClick={onReset}
          iconLeft={<MapPin className="h-4 w-4" />}
        >
          Submit another
        </Button>
      </div>
    </div>
  );
}
