import { useMemo, useState } from "react";
import { ChevronDown, PlayCircle } from "lucide-react";
import type { SiteLibrarySite } from "@/data/siteLibrary";
import {
  buildRobotEvalJobRequestFromSite,
  robotTeamSubmissionReadyForJobRequest,
} from "@/lib/robotEvalJobRequest";
import {
  buildRobotTeamSubmissionInput,
  normalizeRobotTeamTestSubmission,
  ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS,
  type RobotTeamTestSubmissionModalityId,
} from "@/lib/robotTeamTestSubmission";

type FieldState = Record<RobotTeamTestSubmissionModalityId, Record<string, string>>;

type StatusState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "queued"; jobId: string }
  | { kind: "error"; message: string };

function initialFieldState(): FieldState {
  return Object.fromEntries(
    ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS.map((definition) => [
      definition.id,
      Object.fromEntries(definition.fields.map((field) => [field.key, ""])),
    ]),
  ) as FieldState;
}

export function RobotEvalJobRequestButton({
  site,
  source,
  className,
}: {
  site: SiteLibrarySite;
  source: "sites" | "site-detail";
  className?: string;
}) {
  const [status, setStatus] = useState<StatusState>({ kind: "idle" });
  const [formOpen, setFormOpen] = useState(false);
  const [selectedModality, setSelectedModality] =
    useState<RobotTeamTestSubmissionModalityId>("policy_api_endpoint");
  const [fieldValues, setFieldValues] = useState<FieldState>(() => initialFieldState());
  const selectedDefinition =
    ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS.find(
      (definition) => definition.id === selectedModality,
    ) || ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS[0];
  const currentSubmission = useMemo(() => {
    const selection = site.defaultRobotEvalSelection;
    if (!selection) {
      return null;
    }
    return normalizeRobotTeamTestSubmission(
      buildRobotTeamSubmissionInput({
        submissionId: null,
        siteWorldId: `site-${site.slug}`,
        taskId: selection.taskId,
        scenarioId: selection.scenarioId,
        robotProfileId: selection.robotProfileId,
        modalities: Object.fromEntries(
          ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS.map((definition) => [
            definition.id,
            {
              selected: definition.id === selectedModality,
              fields: fieldValues[definition.id],
            },
          ]),
        ),
      }),
    );
  }, [fieldValues, selectedModality, site.defaultRobotEvalSelection, site.slug]);
  const selectedSubmissionState = currentSubmission?.modalities[selectedModality] || null;
  const submissionReady = robotTeamSubmissionReadyForJobRequest(currentSubmission);
  const disabled =
    status.kind === "submitting" ||
    !site.robotEvalPublication?.readyToEvaluatePublishable ||
    !site.defaultRobotEvalSelection;

  async function submitJobRequest() {
    if (!submissionReady || !currentSubmission) {
      setFormOpen(true);
      setStatus({
        kind: "error",
        message: "Enter required robot-team references before creating a Pipeline request.",
      });
      return;
    }

    try {
      setStatus({ kind: "submitting" });
      const jobRequest = buildRobotEvalJobRequestFromSite(site, {
        route: `/sites/${site.slug}`,
        surface: source,
      }, {
        robotTeamTestSubmission: currentSubmission,
      });
      const response = await fetch("/api/robot-eval/job-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobRequest),
      });
      const data = (await response.json()) as {
        jobRequest?: { job_id?: string };
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || `Request failed with ${response.status}`);
      }
      setStatus({
        kind: "queued",
        jobId: data.jobRequest?.job_id || jobRequest.job_id,
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Request failed",
      });
    }
  }

  function updateField(fieldKey: string, value: string) {
    setFieldValues((current) => ({
      ...current,
      [selectedModality]: {
        ...current[selectedModality],
        [fieldKey]: value,
      },
    }));
    if (status.kind === "error") {
      setStatus({ kind: "idle" });
    }
  }

  return (
    <div className="min-w-0">
      <div className="mb-2">
        <button
          type="button"
          aria-expanded={formOpen}
          onClick={() => setFormOpen((value) => !value)}
          className="inline-flex min-h-10 items-center justify-center border border-black/10 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Robot policy input
          <ChevronDown
            className={`ml-2 h-3.5 w-3.5 transition ${formOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {formOpen ? (
        <div className="mb-3 border border-black/10 bg-white p-3 text-left">
          <label className="block text-xs font-semibold text-slate-700">
            Submission modality
            <select
              value={selectedModality}
              onChange={(event) =>
                setSelectedModality(event.target.value as RobotTeamTestSubmissionModalityId)
              }
              className="mt-1 h-10 w-full border border-slate-300 bg-white px-2 text-sm text-slate-950 outline-none focus:border-slate-950"
            >
              {ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS.map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.label}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 grid gap-2">
            {selectedDefinition.fields.map((field) => (
              <label
                key={`${selectedDefinition.id}-${field.key}`}
                className="block text-xs font-semibold text-slate-700"
              >
                {field.label}
                {field.required ? " *" : ""}
                <textarea
                  value={fieldValues[selectedModality][field.key] || ""}
                  onChange={(event) => updateField(field.key, event.target.value)}
                  rows={field.key.toLowerCase().includes("note") ? 3 : 2}
                  className="mt-1 w-full resize-y border border-slate-300 bg-white px-2 py-2 text-sm leading-5 text-slate-950 outline-none focus:border-slate-950"
                />
              </label>
            ))}
          </div>
          {selectedSubmissionState?.missingFields.length ? (
            <p className="mt-2 text-xs font-semibold text-amber-800">
              Missing: {selectedSubmissionState.missingFields.join(", ")}
            </p>
          ) : (
            <p className="mt-2 text-xs font-semibold text-emerald-800">
              Ready for Pipeline review.
            </p>
          )}
        </div>
      ) : null}
      <button
        type="button"
        disabled={disabled}
        onClick={submitJobRequest}
        className={
          className ||
          "inline-flex min-h-11 items-center justify-center border border-black/10 px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-55"
        }
      >
        <PlayCircle className="mr-2 h-4 w-4" />
        {status.kind === "submitting" ? "Creating request" : "Create eval job request"}
      </button>
      {status.kind === "queued" ? (
        <p className="mt-2 text-xs font-semibold text-emerald-800">{status.jobId}</p>
      ) : null}
      {status.kind === "error" ? (
        <p className="mt-2 text-xs font-semibold text-red-700">{status.message}</p>
      ) : null}
    </div>
  );
}
