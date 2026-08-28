import { useMemo, useState } from "react";

import {
  AlertTriangle,
  Bot,
  Check,
  CircleStop,
  MapPin,
  PersonStanding,
  RotateCcw,
} from "lucide-react";

import { cn } from "@/lib/utils";

type PolicyId = "candidate-a" | "candidate-b";
type OutcomeTone = "complete" | "incomplete" | "stopped";

interface PreviewOutcome {
  imageSrc: string;
  imageAlt: string;
  status: string;
  tone: OutcomeTone;
  terminalEvent: string;
  condition: string;
  summary: string;
}

interface PreviewTask {
  id: string;
  site: string;
  task: string;
  shortTask: string;
  embodiment: "Fixed arm" | "Humanoid";
  outcomes: Record<PolicyId, PreviewOutcome>;
}

const previewRoot = "/generated/task-evaluation-preview-2026-08-13";

const policies: Array<{
  id: PolicyId;
  label: string;
  behavior: string;
}> = [
  {
    id: "candidate-a",
    label: "Candidate A",
    behavior: "Deliberate grasp",
  },
  {
    id: "candidate-b",
    label: "Candidate B",
    behavior: "Fast approach",
  },
];

const previewTasks: PreviewTask[] = [
  {
    id: "packing-cell",
    site: "Fulfillment cell",
    task: "Place parcel into outbound tote",
    shortTask: "Parcel to tote",
    embodiment: "Fixed arm",
    outcomes: {
      "candidate-a": {
        imageSrc: `${previewRoot}/packing-cell-candidate-a.jpg`,
        imageAlt:
          "Illustrative fixed robot arm after placing a blue parcel in a tan outbound tote",
        status: "Task completed",
        tone: "complete",
        terminalEvent: "Parcel placed",
        condition: "Baseline reset",
        summary:
          "The parcel finishes inside the destination tote and the gripper clears the settle window.",
      },
      "candidate-b": {
        imageSrc: `${previewRoot}/packing-cell-candidate-b.jpg`,
        imageAlt:
          "Illustrative fixed robot arm after a blue parcel placement overshot an empty tan tote",
        status: "Task incomplete",
        tone: "incomplete",
        terminalEvent: "Placement overshoot",
        condition: "Baseline reset",
        summary:
          "The approach completes, but the parcel finishes outside the destination boundary.",
      },
    },
  },
  {
    id: "machine-cell",
    site: "Machine cell",
    task: "Move machined part into inspection nest",
    shortTask: "Part to nest",
    embodiment: "Fixed arm",
    outcomes: {
      "candidate-a": {
        imageSrc: `${previewRoot}/machine-cell-candidate-a.jpg`,
        imageAlt:
          "Illustrative fixed robot arm after seating a machined cylinder in an inspection nest",
        status: "Task completed",
        tone: "complete",
        terminalEvent: "Part seated",
        condition: "Nominal clearance",
        summary:
          "The rigid part clears the fixture and finishes seated in the inspection nest.",
      },
      "candidate-b": {
        imageSrc: `${previewRoot}/machine-cell-candidate-b.jpg`,
        imageAlt:
          "Illustrative fixed robot arm safely stopped short of a machined cylinder in a CNC fixture",
        status: "Stopped safely",
        tone: "stopped",
        terminalEvent: "Clearance stop",
        condition: "Narrow approach",
        summary:
          "The run stops before contact when the approach falls outside the fixture-clearance envelope.",
      },
    },
  },
  {
    id: "inspection-bench",
    site: "Inspection bench",
    task: "Seat calibration block in test fixture",
    shortTask: "Block to fixture",
    embodiment: "Fixed arm",
    outcomes: {
      "candidate-a": {
        imageSrc: `${previewRoot}/inspection-bench-candidate-a.jpg`,
        imageAlt:
          "Illustrative fixed robot arm after seating a blue calibration block in a brass test fixture",
        status: "Task completed",
        tone: "complete",
        terminalEvent: "Target seated",
        condition: "Distractor present",
        summary:
          "The target block is selected, transferred, and seated while the distractor remains untouched.",
      },
      "candidate-b": {
        imageSrc: `${previewRoot}/inspection-bench-candidate-b.jpg`,
        imageAlt:
          "Illustrative fixed robot arm holding a gray distractor while the blue target remains beside an empty fixture",
        status: "Task incomplete",
        tone: "incomplete",
        terminalEvent: "Wrong object selected",
        condition: "Distractor present",
        summary:
          "The candidate establishes a grasp on the distractor, so the target-specific task remains incomplete.",
      },
    },
  },
  {
    id: "humanoid-decant",
    site: "Warehouse decant",
    task: "Lift parcel from tote to conveyor",
    shortTask: "Tote to conveyor",
    embodiment: "Humanoid",
    outcomes: {
      "candidate-a": {
        imageSrc: `${previewRoot}/humanoid-decant-candidate-a.jpg`,
        imageAlt:
          "Illustrative textile-covered humanoid placing a blue parcel from a tote onto a warehouse conveyor",
        status: "Task completed",
        tone: "complete",
        terminalEvent: "Parcel transferred",
        condition: "Clear top grasp",
        summary:
          "The parcel is lifted bimanually from the tote and finishes stable on the conveyor.",
      },
      "candidate-b": {
        imageSrc: `${previewRoot}/humanoid-decant-candidate-b.jpg`,
        imageAlt:
          "Illustrative textile-covered humanoid safely paused over an occluded parcel in a warehouse tote",
        status: "Stopped safely",
        tone: "stopped",
        terminalEvent: "Occlusion stop",
        condition: "Parcel overlap",
        summary:
          "The candidate does not commit to a grasp while the target remains partially occluded in the tote.",
      },
    },
  },
  {
    id: "humanoid-relay",
    site: "Replenishment aisle",
    task: "Carry tote to staging cart",
    shortTask: "Tote relay",
    embodiment: "Humanoid",
    outcomes: {
      "candidate-a": {
        imageSrc: `${previewRoot}/humanoid-relay-candidate-a.jpg`,
        imageAlt:
          "Illustrative textile-covered humanoid setting a teal warehouse tote onto a staging cart",
        status: "Task completed",
        tone: "complete",
        terminalEvent: "Tote staged",
        condition: "Open aisle",
        summary:
          "The tote remains level through the carry and finishes on the assigned staging cart.",
      },
      "candidate-b": {
        imageSrc: `${previewRoot}/humanoid-relay-candidate-b.jpg`,
        imageAlt:
          "Illustrative textile-covered humanoid beside a teal tote set down before a distant staging cart",
        status: "Stopped safely",
        tone: "stopped",
        terminalEvent: "Early set-down",
        condition: "Narrow approach",
        summary:
          "The tote is set down upright before the destination after the approach condition fails.",
      },
    },
  },
];

const toneStyles: Record<OutcomeTone, string> = {
  complete: "border-[#8ca579]/45 bg-[#8ca579]/15 text-runway-text",
  incomplete: "border-[#c98774]/45 bg-[#c98774]/15 text-runway-text",
  stopped: "border-runway-signal/45 bg-runway-signal/15 text-runway-text",
};

const toneIcons = {
  complete: Check,
  incomplete: AlertTriangle,
  stopped: CircleStop,
} satisfies Record<OutcomeTone, typeof Check>;

export function InteractiveEvaluationPreview() {
  const [selectedTaskId, setSelectedTaskId] = useState(previewTasks[0].id);
  const [selectedPolicyId, setSelectedPolicyId] =
    useState<PolicyId>("candidate-a");
  const [replayKey, setReplayKey] = useState(0);

  const selectedTask = useMemo(
    () =>
      previewTasks.find((task) => task.id === selectedTaskId) ??
      previewTasks[0],
    [selectedTaskId],
  );
  const selectedPolicy = policies.find(
    (policy) => policy.id === selectedPolicyId,
  )!;
  const outcome = selectedTask.outcomes[selectedPolicyId];
  const OutcomeIcon = toneIcons[outcome.tone];

  const selectTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    setReplayKey((value) => value + 1);
  };

  const selectPolicy = (policyId: PolicyId) => {
    setSelectedPolicyId(policyId);
    setReplayKey((value) => value + 1);
  };

  return (
    <section aria-labelledby="evaluation-preview-heading">
      <div className="grid gap-7 lg:grid-cols-[minmax(0,0.9fr)_minmax(18rem,0.42fr)] lg:items-end">
        <div>
          <p className="inline-flex items-center gap-[0.6rem] text-[11px] font-semibold uppercase tracking-[0.2em] leading-none text-runway-signal">
            <span
              aria-hidden="true"
              className="h-px w-6 shrink-0 bg-current opacity-50"
            />
            Interactive run preview
          </p>
          <h2
            id="evaluation-preview-heading"
            className="mt-5 max-w-[19ch] font-display uppercase text-[clamp(2.25rem,4.6vw,4.25rem)] font-semibold leading-[0.98] tracking-[0.005em] text-runway-text"
          >
            Change the task. Swap the candidate. See what changed.
          </h2>
        </div>
        <p className="max-w-[48ch] text-[15px] leading-[1.75] text-runway-mute lg:pb-1">
          A Task Evaluation Run holds the site-task and reset still, then
          compares two frozen candidates. Choose a workcell and policy below to
          inspect an illustrative terminal outcome.
        </p>
      </div>

      <div className="mt-10 overflow-hidden rounded-xl border border-ink-900/10 bg-[#121512] shadow-[0_28px_80px_-42px_rgba(13,18,13,0.72)]">
        <div className="grid lg:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.62fr)]">
          <div className="relative min-h-[28rem] overflow-hidden border-b border-runway-line lg:min-h-[40rem] lg:border-b-0 lg:border-r">
            <img
              key={`${selectedTask.id}-${selectedPolicyId}-${replayKey}`}
              src={outcome.imageSrc}
              alt={outcome.imageAlt}
              className="absolute inset-0 h-full w-full object-cover motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-transparent to-white/85" />
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-[34%] h-px bg-gradient-to-r from-transparent via-brass/55 to-transparent opacity-60 motion-safe:animate-pulse"
            />

            <div className="absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
              <div className="inline-flex items-center gap-2 rounded-xs border border-runway-line bg-white/45 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/80 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-runway-signal motion-safe:animate-pulse" />
                Preview loop
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-xs border border-runway-line bg-white/45 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-runway-mute backdrop-blur-md">
                  {selectedTask.embodiment}
                </span>
                <span className="rounded-xs border border-runway-line bg-white/45 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-runway-mute backdrop-blur-md">
                  Thumbnail mode
                </span>
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
              <div className="flex flex-wrap items-end justify-between gap-5">
                <div>
                  <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-runway-mute">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {selectedTask.site}
                  </p>
                  <p className="mt-2 max-w-[24ch] font-display uppercase text-[clamp(1.65rem,3vw,2.7rem)] font-semibold leading-[1.05] tracking-[0.005em] text-runway-text">
                    {selectedTask.task}
                  </p>
                </div>
                <div
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xs border px-3 py-2 text-xs font-semibold",
                    toneStyles[outcome.tone],
                  )}
                >
                  <OutcomeIcon className="h-4 w-4" aria-hidden="true" />
                  {outcome.status}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-[#171a17] text-runway-text">
            <div className="border-b border-runway-line p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-runway-faint">
                    Candidate policy
                  </p>
                  <p className="mt-2 text-sm font-semibold text-runway-text">
                    Choose one frozen input
                  </p>
                </div>
                <Bot className="h-5 w-5 text-runway-signal" aria-hidden="true" />
              </div>
              <div
                className="mt-4 grid grid-cols-2 gap-2"
                role="group"
                aria-label="Candidate policy"
              >
                {policies.map((policy) => {
                  const isSelected = policy.id === selectedPolicyId;
                  return (
                    <button
                      key={policy.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => selectPolicy(policy.id)}
                      className={cn(
                        "rounded-md border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-[#171a17]",
                        isSelected
                          ? "border-runway-signal/70 bg-runway-signal/[0.12]"
                          : "border-runway-line bg-runway-panel hover:border-white/25 hover:bg-white/[0.05]",
                      )}
                    >
                      <span
                        className={cn(
                          "block text-xs font-semibold",
                          isSelected ? "text-runway-signal" : "text-white/80",
                        )}
                      >
                        {policy.label}
                      </span>
                      <span className="mt-1 block text-[11px] leading-4 text-runway-faint">
                        {policy.behavior}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 p-5 sm:p-6" aria-live="polite">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-runway-faint">
                Illustrative outcome
              </p>
              <h3 className="mt-3 font-display uppercase text-2xl font-semibold tracking-[0.005em] text-runway-text">
                {outcome.terminalEvent}
              </h3>
              <p className="mt-3 text-sm leading-6 text-white/60">
                {outcome.summary}
              </p>

              <dl className="mt-6 divide-y divide-white/10 border-y border-runway-line">
                <div className="flex items-center justify-between gap-5 py-3">
                  <dt className="text-xs text-runway-faint">Candidate</dt>
                  <dd className="text-right text-xs font-semibold text-white/80">
                    {selectedPolicy.label} · {selectedPolicy.behavior}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-5 py-3">
                  <dt className="text-xs text-runway-faint">Condition</dt>
                  <dd className="text-right text-xs font-semibold text-white/80">
                    {outcome.condition}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-5 py-3">
                  <dt className="text-xs text-runway-faint">Claim ceiling</dt>
                  <dd className="text-right text-xs font-semibold text-white/80">
                    Simulation only
                  </dd>
                </div>
              </dl>
            </div>

            <div className="border-t border-runway-line p-5 sm:p-6">
              <div
                className="grid grid-cols-3 gap-2"
                aria-label="Preview sequence"
              >
                {["Reset", "Policy", "Outcome"].map((step, index) => (
                  <div key={step} className="min-w-0">
                    <div
                      className={cn(
                        "h-0.5 rounded-full",
                        index === 2 ? "bg-runway-signal" : "bg-white/35",
                      )}
                    />
                    <p className="mt-2 truncate font-mono text-[9px] uppercase tracking-[0.14em] text-white/40">
                      {step}
                    </p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setReplayKey((value) => value + 1)}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md border border-runway-line px-4 py-3 text-xs font-semibold text-white/80 transition-colors hover:border-white/30 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Replay preview
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-runway-line bg-[#101310] p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-runway-faint">
              Select a site-task
            </p>
            <p className="text-[11px] text-runway-faint">
              3 fixed-arm · 2 humanoid
            </p>
          </div>
          <div
            className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
            role="group"
            aria-label="Site-task"
          >
            {previewTasks.map((task) => {
              const isSelected = task.id === selectedTask.id;
              const thumbnail = task.outcomes[selectedPolicyId];
              return (
                <button
                  key={task.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => selectTask(task.id)}
                  className={cn(
                    "group grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-3 rounded-md border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass",
                    isSelected
                      ? "border-runway-signal/65 bg-runway-signal/10"
                      : "border-runway-line bg-runway-panel hover:border-white/25 hover:bg-white/[0.05]",
                  )}
                >
                  <span className="relative block aspect-[4/3] overflow-hidden rounded-sm bg-white/5">
                    <img
                      src={thumbnail.imageSrc}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover grayscale-[0.25] transition duration-500 group-hover:scale-105 group-hover:grayscale-0"
                    />
                    <span className="absolute bottom-1 left-1 rounded-xs bg-white/60 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-runway-mute backdrop-blur-sm">
                      {task.embodiment === "Fixed arm" ? "Arm" : "Humanoid"}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block truncate text-xs font-semibold",
                        isSelected ? "text-runway-signal" : "text-runway-mute",
                      )}
                    >
                      {task.shortTask}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 truncate text-[10px] text-runway-faint">
                      {task.embodiment === "Fixed arm" ? (
                        <Bot className="h-3 w-3 shrink-0" aria-hidden="true" />
                      ) : (
                        <PersonStanding
                          className="h-3 w-3 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      {task.site}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-4 max-w-[80ch] text-[11px] leading-5 text-runway-mute">
        Generated concept frames show interface behavior only. They are not
        captured site media, completed policy runs, policy-ranking evidence,
        physical outcomes, or deployment approval.
      </p>
    </section>
  );
}
