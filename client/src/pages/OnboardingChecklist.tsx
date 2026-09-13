"use client";

import React, { useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileSearch,
  Route,
  Shield,
  Target,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { Tag, Feedback } from "@/components/workspace/WorkspaceUI";
import { useAuth } from "@/contexts/AuthContext";

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  icon: React.ElementType;
  action?: {
    label: string;
    href: string;
    updateField?: string;
  };
  optional?: boolean;
}

function formatIntakeLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function ChecklistCard({
  item,
  index,
  onAction,
}: {
  item: ChecklistItem;
  index: number;
  onAction: (item: ChecklistItem) => void;
}) {
  const Icon = item.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`runway-panel p-4 ${
        item.completed ? "border-runway-green-dim" : "border-runway-line"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`runway-num flex h-9 w-9 items-center justify-center border text-sm ${
            item.completed
              ? "border-runway-green-dim text-runway-green"
              : "border-runway-line-strong text-runway-faint"
          }`}
        >
          {item.completed ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <span>{index}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-runway-text">{item.title}</h3>
            {item.optional ? (
              <span className="runway-chip runway-chip-quiet">Optional</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-runway-mute">{item.description}</p>
          {item.completed ? (
            <p className="mt-2 text-sm text-runway-green">Completed</p>
          ) : item.action ? (
            <button
              type="button"
              className="runway-cta-ghost mt-3 h-9 min-h-0 px-4"
              onClick={() => onAction(item)}
            >
              {item.action.label}
              <ArrowRight className="ml-1 h-4 w-4" />
            </button>
          ) : null}
        </div>
        <Icon
          className={`h-5 w-5 ${item.completed ? "text-runway-green" : "text-runway-faint"}`}
        />
      </div>
    </motion.div>
  );
}

export default function OnboardingChecklist() {
  const { userData, currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");

  const progress = userData?.onboardingProgress || {
    profileComplete: true,
    defineSiteSubmission: Boolean(
      userData?.siteName && userData?.taskStatement,
    ),
    completeIntakeReview: false,
    reviewQualifiedOpportunities: false,
    inviteTeam: false,
  };
  const isRobotTeam = userData?.buyerType !== "site_operator";
  const calendarDisposition = userData?.calendarDisposition || "not_needed_yet";
  const calendarIsRecommended =
    calendarDisposition === "recommended" ||
    calendarDisposition === "required_before_next_step";
  const proofReadyOutcome =
    userData?.proofReadyOutcome ||
    (isRobotTeam ? "needs_clarification" : "operator_handoff");
  const proofPathOutcome =
    userData?.proofPathOutcome ||
    (isRobotTeam ? "scoped_follow_up" : "operator_handoff");
  const proofReadinessScore =
    typeof userData?.proofReadinessScore === "number"
      ? userData.proofReadinessScore
      : null;
  const missingProofReadyFields = userData?.missingProofReadyFields || [];
  const proofReadyIntakeComplete =
    Boolean(progress.proofReadyIntake) ||
    proofReadyOutcome === "proof_ready_intake";
  const siteOperatorClaimOutcome =
    userData?.siteOperatorClaimOutcome ||
    (isRobotTeam ? "not_site_operator" : "site_claim_needs_detail");
  const accessBoundaryOutcome =
    userData?.accessBoundaryOutcome ||
    (isRobotTeam ? "not_applicable" : "needs_access_rules");
  const siteClaimReadinessScore =
    typeof userData?.siteClaimReadinessScore === "number"
      ? userData.siteClaimReadinessScore
      : null;
  const siteClaimCriteria = userData?.siteClaimCriteria || [];
  const missingSiteClaimFields = userData?.missingSiteClaimFields || [];
  const rightsControlDefined = hasText(userData?.captureRights);
  const privacyControlDefined =
    Boolean(progress.privacyRulesConfirmed) ||
    siteClaimCriteria.includes("privacy_security_boundary") ||
    hasText(userData?.privacySecurityConstraints);
  const commercialControlDefined =
    Boolean(progress.commercializationPreferenceSet) ||
    hasText(userData?.derivedScenePermission) ||
    hasText(userData?.datasetLicensingPermission);
  const operatorControlRows = [
    {
      label: "Rights",
      value: rightsControlDefined
        ? "Rights note captured"
        : "Needs owner or release context",
      detail: rightsControlDefined
        ? "Approval and rights context stay attached to the site claim."
        : "Add who can approve capture, release, or downstream use before this moves.",
    },
    {
      label: "Privacy",
      value: privacyControlDefined
        ? "Privacy boundary captured"
        : "Needs privacy boundary",
      detail: privacyControlDefined
        ? "Private areas, redaction, or security limits are visible for review."
        : "Add camera limits, restricted areas, redaction needs, or security rules.",
    },
    {
      label: "Access",
      value:
        accessBoundaryOutcome === "access_boundary_defined"
          ? "Access rules defined"
          : "Needs access rules",
      detail:
        accessBoundaryOutcome === "access_boundary_defined"
          ? "Capture windows, escort rules, and restricted zones are structured."
          : "Add capture windows, escort rules, restricted zones, or safety limits.",
    },
    {
      label: "Commercial control",
      value: commercialControlDefined
        ? "Commercial posture captured"
        : "Needs commercial preference",
      detail: commercialControlDefined
        ? "Private, claim-only, or listable use is visible before buyer-facing motion."
        : "Choose whether the site stays private, claim-only, or potentially listable.",
    },
  ];

  const checklistItems: ChecklistItem[] = useMemo(() => {
    const baseItems: ChecklistItem[] = [
      {
        id: "profile",
        title: "Account profile complete",
        description: "Your account exists and the intake owner is identified.",
        completed: progress.profileComplete,
        icon: Shield,
      },
    ];

    const roleItems: ChecklistItem[] = isRobotTeam
      ? [
          {
            id: "buyer-workflow",
            title: "Confirm robot workflow",
            description:
              "Keep the buyer path anchored to one task, robot stack, site, or site class.",
            completed: Boolean(
              progress.buyerWorkflowConfirmed || progress.defineSiteSubmission,
            ),
            icon: Route,
            action: {
              label: "Review intake",
              href: "/contact/robot-team?persona=robot-team",
              updateField: "onboardingProgress.buyerWorkflowConfirmed",
            },
          },
          {
            id: "package-path",
            title: "Define the evaluation decision",
            description:
              "Describe the site-task, decision, candidates when applicable, thresholds, false-safe consequence, budget, deadline, evidence, and restrictions.",
            completed: Boolean(
              progress.packageOrHostedPathSelected ||
              progress.defineSiteSubmission,
            ),
            icon: FileSearch,
            action: {
              label: "Start run intake",
              href: "/app/runs/new",
              updateField: "onboardingProgress.packageOrHostedPathSelected",
            },
          },
          {
            id: "proof-ready-intake",
            title: proofReadyIntakeComplete
              ? "Proof-ready intake measured"
              : "Complete proof-ready intake",
            description: proofReadyIntakeComplete
              ? "The request has enough structured buyer, workflow, site, robot, and proof-path context for a first proof-path decision."
              : missingProofReadyFields.length > 0
                ? `Add ${missingProofReadyFields.map(formatIntakeLabel).join(", ")} so intake can route the proof path without guessing.`
                : "Add enough structured proof-path context so the next step is a measured intake outcome, not another generic discovery loop.",
            completed: proofReadyIntakeComplete,
            icon: Target,
            action: {
              label: "Update proof details",
              href: "/contact/robot-team?persona=robot-team",
              updateField: "onboardingProgress.proofReadyIntake",
            },
          },
          {
            id: "procurement",
            title: "Add procurement context",
            description:
              "Budget range, timing, and blockers help Blueprint decide whether a call accelerates the request.",
            completed: Boolean(progress.procurementReviewed),
            icon: CreditCard,
            action: {
              label: "Update intake",
              href: "/contact/robot-team?persona=robot-team",
              updateField: "onboardingProgress.procurementReviewed",
            },
            optional: true,
          },
        ]
      : [
          {
            id: "site-claim",
            title:
              siteOperatorClaimOutcome === "site_claim_access_boundary_ready"
                ? "Site claim measured"
                : "Confirm the site claim",
            description:
              missingSiteClaimFields.length > 0
                ? `Add ${missingSiteClaimFields.map(formatIntakeLabel).join(", ")} so the site claim can be routed without guessing.`
                : "Name the facility, operator, location, and why the site should enter the review queue.",
            completed: Boolean(
              progress.siteClaimConfirmed ||
              siteOperatorClaimOutcome === "site_claim_access_boundary_ready" ||
              siteOperatorClaimOutcome === "site_claim_needs_access_boundary",
            ),
            icon: Building2,
            action: {
              label: "Review site claim",
              href: "/contact/site-operator",
              updateField: "onboardingProgress.siteClaimConfirmed",
            },
          },
          {
            id: "access-boundaries",
            title:
              accessBoundaryOutcome === "access_boundary_defined"
                ? "Access boundary measured"
                : "Define access boundaries",
            description:
              accessBoundaryOutcome === "needs_privacy_security_boundary"
                ? "Add privacy, security, or restricted-zone boundaries before treating the site claim as ready."
                : "Capture windows, restricted zones, escort rules, and safety limits stay structured before a meeting.",
            completed: Boolean(
              progress.accessBoundariesDefined ||
              accessBoundaryOutcome === "access_boundary_defined",
            ),
            icon: ClipboardCheck,
            action: {
              label: "Update access rules",
              href: "/contact/site-operator",
              updateField: "onboardingProgress.accessBoundariesDefined",
            },
          },
          {
            id: "privacy-rules",
            title: "Confirm privacy rules",
            description:
              "Camera limits, redaction needs, private areas, and security concerns decide whether human scoping is required.",
            completed: Boolean(
              progress.privacyRulesConfirmed ||
              siteClaimCriteria.includes("privacy_security_boundary"),
            ),
            icon: Shield,
            action: {
              label: "Update privacy notes",
              href: "/contact/site-operator",
              updateField: "onboardingProgress.privacyRulesConfirmed",
            },
          },
          {
            id: "commercialization",
            title: "Set commercialization preference",
            description:
              "Choose whether the site is private, claim-only, or potentially listable for robot-team evaluation.",
            completed: Boolean(progress.commercializationPreferenceSet),
            icon: FileSearch,
            action: {
              label: "Update preference",
              href: "/contact/site-operator",
              updateField: "onboardingProgress.commercializationPreferenceSet",
            },
            optional: true,
          },
        ];

    const routingItems: ChecklistItem[] = [
      {
        id: "submission",
        title: "Structured intake captured",
        description:
          "The website has enough structured detail to route the request before any calendar step.",
        completed: progress.defineSiteSubmission,
        icon: Building2,
        action: {
          label: "Review intake",
          href: isRobotTeam
            ? "/contact/robot-team?persona=robot-team"
            : "/contact/site-operator",
          updateField: "onboardingProgress.defineSiteSubmission",
        },
      },
      {
        id: "review",
        title: "Route the submission for review",
        description:
          "The request enters intake review before authorization, evidence planning, or an operator call begins.",
        completed: progress.completeIntakeReview,
        icon: ClipboardCheck,
        action: {
          label: "Open submission form",
          href: isRobotTeam
            ? "/contact/robot-team?persona=robot-team"
            : "/contact/site-operator",
          updateField: "onboardingProgress.completeIntakeReview",
        },
      },
      {
        id: "review-session",
        title: calendarIsRecommended
          ? "Scope the human call"
          : "Keep calendar secondary",
        description: calendarIsRecommended
          ? "The intake is specific enough that a scoped meeting can accelerate the next decision."
          : "A meeting is optional until the structured intake shows a concrete site, workflow, buyer, or rights question.",
        completed:
          Boolean(progress.reviewSessionScoped) || !calendarIsRecommended,
        icon: CalendarClock,
        action: calendarIsRecommended
          ? {
              label: "Request scoping call",
              href: "/book-exact-site-review",
              updateField: "onboardingProgress.reviewSessionScoped",
            }
          : undefined,
        optional: !calendarIsRecommended,
      },
      {
        id: "opportunities",
        title: "Review world-model opportunities",
        description:
          "See what downstream buyer-facing world-model access can look like once a site is ready to package.",
        completed: progress.reviewQualifiedOpportunities,
        icon: FileSearch,
        action: {
          label: "Open world models",
          href: "/world-models",
          updateField: "onboardingProgress.reviewQualifiedOpportunities",
        },
        optional: true,
      },
      {
        id: "team",
        title: isRobotTeam ? "Invite your team" : "Confirm team contact",
        description: isRobotTeam
          ? "Bring in teammates after the intake path is set."
          : "Identify the facility contact who can answer access, privacy, and scheduling questions.",
        completed: Boolean(
          progress.teamContactConfirmed || progress.inviteTeam,
        ),
        icon: Users,
        action: {
          label: "Open settings",
          href: "/settings",
          updateField: "onboardingProgress.teamContactConfirmed",
        },
        optional: true,
      },
    ];

    return [...baseItems, ...roleItems, ...routingItems];
  }, [
    calendarIsRecommended,
    isRobotTeam,
    missingProofReadyFields,
    missingSiteClaimFields,
    progress,
    accessBoundaryOutcome,
    proofReadyIntakeComplete,
    siteClaimCriteria,
    siteOperatorClaimOutcome,
  ]);

  const handleAction = useCallback(
    async (item: ChecklistItem) => {
      if (currentUser?.uid && item.action?.updateField) {
        const { db } = await import("@/lib/firebase");
        await updateDoc(doc(db, "users", currentUser.uid), {
          [item.action.updateField]: true,
        });
      }

      if (item.action) {
        setLocation(item.action.href);
      }
    },
    [currentUser?.uid, setLocation],
  );

  const handleFinish = useCallback(async () => {
    if (!currentUser?.uid || busy) return;
    setBusy(true);
    setError("");
    try {
      const { db } = await import("@/lib/firebase");
      await updateDoc(doc(db, "users", currentUser.uid), {
        finishedOnboarding: true,
        onboardingStep: "completed",
        "onboardingProgress.completedAt": serverTimestamp(),
      });
      setLocation("/app");
    } catch {
      setError("Could not finish setup. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [currentUser?.uid, busy, setLocation]);

  const intakeSummary = [
    {
      label: "Buyer type",
      value:
        userData?.buyerType === "robot_team" ? "Robot team" : "Site operator",
    },
    {
      label: "Primary path",
      value:
        userData?.structuredIntakeRecommendedPath || "Structured intake review",
    },
    ...(isRobotTeam
      ? [
          {
            label: "Proof outcome",
            value: formatIntakeLabel(proofReadyOutcome),
          },
          { label: "Proof path", value: formatIntakeLabel(proofPathOutcome) },
          {
            label: "Proof readiness",
            value:
              proofReadinessScore === null
                ? "Not measured yet"
                : `${proofReadinessScore}%`,
          },
        ]
      : [
          {
            label: "Site claim",
            value: formatIntakeLabel(siteOperatorClaimOutcome),
          },
          {
            label: "Access boundary",
            value: formatIntakeLabel(accessBoundaryOutcome),
          },
          {
            label: "Claim readiness",
            value:
              siteClaimReadinessScore === null
                ? "Not measured yet"
                : `${siteClaimReadinessScore}%`,
          },
        ]),
    { label: "Calendar", value: calendarDisposition.replaceAll("_", " ") },
    { label: "Site", value: userData?.siteName || "Not set yet" },
    { label: "Location", value: userData?.siteLocation || "Not set yet" },
    { label: "Task", value: userData?.taskStatement || "Not set yet" },
  ];

  return (
    <AppShell active="overview" breadcrumb="Finish setup">
      <div className="ws-form">
        <header className="ws-heading">
          <div>
            <p>{userData?.company || userData?.name || "Your workspace"}</p>
            <h1>Finish setup</h1>
          </div>
        </header>
        <p className="ws-muted">
          Your account is ready. Review your details, then open your workspace.
        </p>
        <Feedback error={error} notice={notice} />
        <section className="ws-section">
          <div className="ws-task-row">
            <div className="ws-task-copy">
              <h3>Account details</h3>
              <p className="ws-muted">
                Name, organization, and sign-in details
              </p>
            </div>
            <Tag tone="green">Saved</Tag>
          </div>
          {!currentUser?.emailVerified && (
            <div className="ws-task-row">
              <div className="ws-task-copy">
                <h3>Verify your email</h3>
                <p className="ws-muted">
                  Confirm your email before requesting captures or evaluations.
                </p>
              </div>
              <button
                className="ws-link"
                disabled={busy}
                onClick={async () => {
                  if (!currentUser || busy) return;
                  setBusy(true);
                  setError("");
                  try {
                    const { sendEmailVerification } =
                      await import("firebase/auth");
                    await sendEmailVerification(currentUser);
                    setNotice(
                      "Verification email sent. Follow the link, then sign in again.",
                    );
                  } catch {
                    setError("Could not send verification. Please try again.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Send verification email
              </button>
            </div>
          )}
          <div className="ws-task-row">
            <div className="ws-task-copy">
              <h3>{isRobotTeam ? "Robot & policy" : "Site & task"}</h3>
              <p className="ws-muted">
                {isRobotTeam
                  ? "Set up the robot and policy you want to evaluate."
                  : "Review the intake submitted for your site."}
              </p>
            </div>
            <button
              className="ws-link"
              onClick={() =>
                setLocation(isRobotTeam ? "/settings?tab=robots" : "/app/tasks")
              }
            >
              Review details →
            </button>
          </div>
        </section>
        <details className="ws-section">
          <summary>Intake summary & next steps</summary>
          <div className="space-y-4">
            {checklistItems.map((item, index) => (
              <ChecklistCard
                key={item.id}
                item={item}
                index={index + 1}
                onAction={(item) => {
                  void handleAction(item).catch(() =>
                    setError("Could not open this step. Please try again."),
                  );
                }}
              />
            ))}
          </div>
          <dl className="ws-facts">
            {intakeSummary.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
          {!isRobotTeam && (
            <details>
              <summary>Site access & review</summary>
              <dl className="ws-facts">
                {operatorControlRows.map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>
                      <p>{item.value}</p>
                      <small>{item.detail}</small>
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </details>
        <div className="ws-form-actions">
          <button
            type="button"
            className="ws-primary"
            onClick={handleFinish}
            disabled={busy}
          >
            {busy ? "Saving…" : "Open workspace →"}
          </button>
        </div>
        <p className="ws-note">
          You can return to your task and settings at any time.
        </p>
      </div>
    </AppShell>
  );
}
