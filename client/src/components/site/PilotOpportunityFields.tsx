import { LockKeyhole, Network, ShieldCheck } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  PilotOpportunityVisibility,
  PilotPermissionDisposition,
} from "@/types/inbound-request";

const VISIBILITY_OPTIONS: Array<{
  value: PilotOpportunityVisibility;
  label: string;
  detail: string;
}> = [
  {
    value: "private",
    label: "Private",
    detail: "Only your team and Blueprint can review the dossier.",
  },
  {
    value: "anonymized",
    label: "Anonymized",
    detail: "Qualified robot teams see only the summary you approve, never your identity or address.",
  },
  {
    value: "approved_robot_teams",
    label: "Approved robot teams",
    detail: "Only authenticated robot-team accounts whose work emails you name can see the full dossier.",
  },
];

type PilotOpportunityFieldsProps = {
  requested: boolean;
  onRequestedChange: (requested: boolean) => void;
  visibility: PilotOpportunityVisibility;
  onVisibilityChange: (visibility: PilotOpportunityVisibility) => void;
  approvedRobotTeamEmails: string;
  onApprovedRobotTeamEmailsChange: (value: string) => void;
  anonymizedSummary: string;
  onAnonymizedSummaryChange: (value: string) => void;
  benchmarkProfile: string;
  onBenchmarkProfileChange: (value: string) => void;
  objectProfile: string;
  onObjectProfileChange: (value: string) => void;
  operationalProfile: string;
  onOperationalProfileChange: (value: string) => void;
  integrationEnvironment: string;
  onIntegrationEnvironmentChange: (value: string) => void;
  rolloutReadiness: string;
  onRolloutReadinessChange: (value: string) => void;
  siteSpecificAdaptation: PilotPermissionDisposition;
  onSiteSpecificAdaptationChange: (value: PilotPermissionDisposition) => void;
  retainImprovements: PilotPermissionDisposition;
  onRetainImprovementsChange: (value: PilotPermissionDisposition) => void;
  generalModelTraining: PilotPermissionDisposition;
  onGeneralModelTrainingChange: (value: PilotPermissionDisposition) => void;
};

export function PilotOpportunityFields({
  requested,
  onRequestedChange,
  visibility,
  onVisibilityChange,
  approvedRobotTeamEmails,
  onApprovedRobotTeamEmailsChange,
  anonymizedSummary,
  onAnonymizedSummaryChange,
  benchmarkProfile,
  onBenchmarkProfileChange,
  objectProfile,
  onObjectProfileChange,
  operationalProfile,
  onOperationalProfileChange,
  integrationEnvironment,
  onIntegrationEnvironmentChange,
  rolloutReadiness,
  onRolloutReadinessChange,
  siteSpecificAdaptation,
  onSiteSpecificAdaptationChange,
  retainImprovements,
  onRetainImprovementsChange,
  generalModelTraining,
  onGeneralModelTrainingChange,
}: PilotOpportunityFieldsProps) {
  return (
    <section className="md:col-span-2" aria-labelledby="pilot-opportunity-heading">
      <div className="rounded-[1.35rem] border border-white/10 bg-[#101312] p-5">
        <label className="flex cursor-pointer items-start gap-3">
          <Checkbox
            checked={requested}
            onCheckedChange={(checked) => onRequestedChange(Boolean(checked))}
            className="mt-1"
            aria-label="Prepare this workflow as a pilot opportunity"
          />
          <span>
            <span id="pilot-opportunity-heading" className="flex items-center gap-2 text-sm font-semibold text-runway-text">
              <Network className="h-4 w-4" aria-hidden="true" />
              Prepare this workflow as a pilot opportunity
            </span>
            <span className="mt-1 block text-sm leading-6 text-white/60">
              Blueprint will standardize the site-task for private qualification. This remains one
              Task Evaluation Run and does not promise a match, site visit, or deployment.
            </span>
          </span>
        </label>

        {requested ? (
          <div className="mt-6 space-y-6 border-t border-white/10 pt-6">
            <fieldset>
              <legend className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                Who may see the opportunity after qualification?
              </legend>
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                {VISIBILITY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`cursor-pointer border p-4 transition-colors ${
                      visibility === option.value
                        ? "border-[#111110] bg-paper-0"
                        : "border-white/10 bg-[#101312] hover:border-white/25"
                    }`}
                  >
                    <span className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="pilotOpportunityVisibility"
                        value={option.value}
                        checked={visibility === option.value}
                        onChange={() => onVisibilityChange(option.value)}
                        className="mt-1 h-4 w-4 accent-black"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-runway-text">{option.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-white/55">{option.detail}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="border-y border-white/10 py-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                Progressive access
              </p>
              <ol className="mt-3 grid gap-3 text-xs leading-5 text-white/60 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ["01", "Anonymized summary"],
                  ["02", "Standardized benchmark"],
                  ["03", "Controlled evaluation"],
                  ["04", "Shortlisted confidential package"],
                  ["05", "Separately negotiated training rights"],
                ].map(([index, label]) => (
                  <li key={index} className="border-l border-white/15 pl-3">
                    <span className="font-mono text-[10px] text-white/35">{index}</span>
                    <span className="mt-1 block font-semibold text-runway-text">{label}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-xs leading-5 text-white/55">
                The site model remains hosted inside Blueprint. Robot teams submit approved robot
                specifications, policy containers, and interface requirements; they receive results,
                not unrestricted twin files.
              </p>
            </div>

            {visibility === "approved_robot_teams" ? (
              <div>
                <Label htmlFor="approvedRobotTeamEmails" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                  Approved robot-team work emails
                </Label>
                <Input
                  id="approvedRobotTeamEmails"
                  className="mt-2 h-12 rounded-[1rem] border-white/10 bg-paper-0"
                  placeholder="deployment@robotco.com, autonomy@anotherteam.ai"
                  value={approvedRobotTeamEmails}
                  onChange={(event) => onApprovedRobotTeamEmailsChange(event.target.value)}
                />
                <p className="mt-2 text-xs leading-5 text-white/50">Exact authenticated email matches only. Separate multiple emails with commas.</p>
              </div>
            ) : null}

            {visibility === "anonymized" ? (
              <div>
                <Label htmlFor="anonymizedSummary" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                  Anonymized opportunity summary
                </Label>
                <Textarea
                  id="anonymizedSummary"
                  className="mt-2 min-h-24 rounded-[1rem] border-white/10 bg-paper-0"
                  placeholder="Describe the workflow without company names, addresses, people, or restricted details."
                  value={anonymizedSummary}
                  onChange={(event) => onAnonymizedSummaryChange(event.target.value)}
                />
              </div>
            ) : null}

            <div>
              <Label htmlFor="pilotBenchmarkProfile" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                Standardized benchmark
              </Label>
              <Textarea
                id="pilotBenchmarkProfile"
                className="mt-2 min-h-24 rounded-[1rem] border-white/10 bg-paper-0"
                placeholder="Object ranges, environment classes, success metrics, expected throughput, and permitted exception classes—without confidential facility details."
                value={benchmarkProfile}
                onChange={(event) => onBenchmarkProfileChange(event.target.value)}
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <Label htmlFor="pilotObjectProfile" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                  Objects and variability
                </Label>
                <Textarea
                  id="pilotObjectProfile"
                  className="mt-2 min-h-28 rounded-[1rem] border-white/10 bg-paper-0"
                  placeholder="Objects, weights, dimensions, materials, packaging, and normal variation."
                  value={objectProfile}
                  onChange={(event) => onObjectProfileChange(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pilotOperationalProfile" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                  Operational profile
                </Label>
                <Textarea
                  id="pilotOperationalProfile"
                  className="mt-2 min-h-28 rounded-[1rem] border-white/10 bg-paper-0"
                  placeholder="Cycle time, volume, shifts, seasonality, exception rate, accuracy, and downtime tolerance."
                  value={operationalProfile}
                  onChange={(event) => onOperationalProfileChange(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pilotIntegrationEnvironment" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                  Integration environment
                </Label>
                <Textarea
                  id="pilotIntegrationEnvironment"
                  className="mt-2 min-h-28 rounded-[1rem] border-white/10 bg-paper-0"
                  placeholder="WMS, MES, PLC, Wi-Fi, cybersecurity, data, and fleet-system constraints."
                  value={integrationEnvironment}
                  onChange={(event) => onIntegrationEnvironmentChange(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pilotRolloutReadiness" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                  Owner and rollout readiness
                </Label>
                <Textarea
                  id="pilotRolloutReadiness"
                  className="mt-2 min-h-28 rounded-[1rem] border-white/10 bg-paper-0"
                  placeholder="Named internal owner, pilot area, timing, procurement path, and number of similar workflows or sites."
                  value={rolloutReadiness}
                  onChange={(event) => onRolloutReadinessChange(event.target.value)}
                />
              </div>
            </div>

            <fieldset className="border-t border-white/10 pt-5">
              <legend className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                Data-use permissions
              </legend>
              <p className="mt-2 text-xs leading-5 text-white/55">
                Evaluation is permitted for approved controlled runs. Adaptation, retention, and
                general training remain separate permissions; no choice here transfers files.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {[
                  {
                    id: "siteSpecificAdaptation",
                    label: "Adapt for this site",
                    value: siteSpecificAdaptation,
                    onChange: onSiteSpecificAdaptationChange,
                  },
                  {
                    id: "retainImprovements",
                    label: "Retain improvements",
                    value: retainImprovements,
                    onChange: onRetainImprovementsChange,
                  },
                  {
                    id: "generalModelTraining",
                    label: "General model training",
                    value: generalModelTraining,
                    onChange: onGeneralModelTrainingChange,
                  },
                ].map((permission) => (
                  <div key={permission.id}>
                    <Label htmlFor={permission.id} className="text-xs font-semibold text-runway-text">
                      {permission.label}
                    </Label>
                    <select
                      id={permission.id}
                      className="mt-2 flex h-11 w-full rounded-[1rem] border border-white/10 bg-paper-0 px-3 text-sm text-runway-text"
                      value={permission.value}
                      onChange={(event) =>
                        permission.onChange(event.target.value as PilotPermissionDisposition)
                      }
                    >
                      <option value="not_granted">Not granted</option>
                      <option value="negotiable">Negotiable separately</option>
                      <option value="granted">Granted for approved scope</option>
                    </select>
                  </div>
                ))}
              </div>
            </fieldset>

            <div className="flex items-start gap-3 border-t border-white/10 pt-4 text-xs leading-5 text-white/55">
              {visibility === "private" ? (
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <p>
                Visibility is enforced by the authenticated opportunity API. A complete dossier
                still remains hidden until capture, rights, qualification, and explicit Blueprint
                opportunity-review gates pass. The site funds the common model and baseline;
                robot teams fund their incremental evaluation compute. Training compute is scoped
                separately according to who retains the reusable value.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
