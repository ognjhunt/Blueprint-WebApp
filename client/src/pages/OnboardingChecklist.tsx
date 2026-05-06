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
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
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
      className={`rounded-xl border p-4 ${
        item.completed
          ? "border-emerald-200 bg-emerald-50/60"
          : "border-zinc-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full ${
            item.completed ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-500"
          }`}
        >
          {item.completed ? <CheckCircle2 className="h-5 w-5" /> : <span>{index}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-zinc-900">{item.title}</h3>
            {item.optional ? (
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                Optional
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-zinc-600">{item.description}</p>
          {item.completed ? (
            <p className="mt-2 text-sm text-emerald-700">Completed</p>
          ) : item.action ? (
            <Button
              type="button"
              size="sm"
              className="mt-3"
              onClick={() => onAction(item)}
            >
              {item.action.label}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <Icon className={`h-5 w-5 ${item.completed ? "text-emerald-500" : "text-zinc-300"}`} />
      </div>
    </motion.div>
  );
}

export default function OnboardingChecklist() {
  const { userData, currentUser } = useAuth();
  const [, setLocation] = useLocation();

  const progress = userData?.onboardingProgress || {
    profileComplete: true,
    defineSiteSubmission: Boolean(userData?.siteName && userData?.taskStatement),
    completeIntakeReview: false,
    reviewQualifiedOpportunities: false,
    inviteTeam: false,
  };
  const isRobotTeam = userData?.buyerType !== "site_operator";
  const calendarDisposition = userData?.calendarDisposition || "not_needed_yet";
  const calendarIsRecommended =
    calendarDisposition === "recommended" || calendarDisposition === "required_before_next_step";
  const proofReadyOutcome =
    userData?.proofReadyOutcome || (isRobotTeam ? "needs_clarification" : "operator_handoff");
  const proofPathOutcome =
    userData?.proofPathOutcome || (isRobotTeam ? "scoped_follow_up" : "operator_handoff");
  const proofReadinessScore =
    typeof userData?.proofReadinessScore === "number" ? userData.proofReadinessScore : null;
  const missingProofReadyFields = userData?.missingProofReadyFields || [];
  const proofReadyIntakeComplete =
    Boolean(progress.proofReadyIntake) || proofReadyOutcome === "proof_ready_intake";
  const siteOperatorClaimOutcome =
    userData?.siteOperatorClaimOutcome || (isRobotTeam ? "not_site_operator" : "site_claim_needs_detail");
  const accessBoundaryOutcome =
    userData?.accessBoundaryOutcome || (isRobotTeam ? "not_applicable" : "needs_access_rules");
  const siteClaimReadinessScore =
    typeof userData?.siteClaimReadinessScore === "number" ? userData.siteClaimReadinessScore : null;
  const siteClaimCriteria = userData?.siteClaimCriteria || [];
  const missingSiteClaimFields = userData?.missingSiteClaimFields || [];
  const rightsControlDefined = hasText(userData?.captureRights);
  const privacyControlDefined =
    Boolean(progress.privacyRulesConfirmed)
    || siteClaimCriteria.includes("privacy_security_boundary")
    || hasText(userData?.privacySecurityConstraints);
  const commercialControlDefined =
    Boolean(progress.commercializationPreferenceSet)
    || hasText(userData?.derivedScenePermission)
    || hasText(userData?.datasetLicensingPermission);
  const operatorControlRows = [
    {
      label: "Rights",
      value: rightsControlDefined ? "Rights note captured" : "Needs owner or release context",
      detail: rightsControlDefined
        ? "Approval and rights context stay attached to the site claim."
        : "Add who can approve capture, release, or downstream use before this moves.",
    },
    {
      label: "Privacy",
      value: privacyControlDefined ? "Privacy boundary captured" : "Needs privacy boundary",
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
      value: commercialControlDefined ? "Commercial posture captured" : "Needs commercial preference",
      detail: commercialControlDefined
        ? "Private, claim-only, or listable use is visible before buyer-facing motion."
        : "Choose whether the site stays private, claim-only, or potentially listable.",
    },
  ];

  const checklistItems: ChecklistItem[] = useMemo(
    () => {
      const baseItems: ChecklistItem[] = [{
        id: "profile",
        title: "Account profile complete",
        description: "Your account exists and the intake owner is identified.",
        completed: progress.profileComplete,
        icon: Shield,
      }];

      const roleItems: ChecklistItem[] = isRobotTeam
        ? [
            {
              id: "buyer-workflow",
              title: "Confirm robot workflow",
              description:
                "Keep the buyer path anchored to one task, robot stack, site, or site class.",
              completed: Boolean(progress.buyerWorkflowConfirmed || progress.defineSiteSubmission),
              icon: Route,
              action: {
                label: "Review intake",
                href: "/contact?persona=robot-team",
                updateField: "onboardingProgress.buyerWorkflowConfirmed",
              },
            },
            {
              id: "package-path",
              title: "Pick package or hosted path",
              description:
                "Confirm whether the request starts with package access, hosted evaluation, data licensing, or guidance.",
              completed: Boolean(progress.packageOrHostedPathSelected || progress.defineSiteSubmission),
              icon: FileSearch,
              action: {
                label: "Open world models",
                href: "/world-models",
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
                href: "/contact?persona=robot-team",
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
                href: "/contact?persona=robot-team",
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
                progress.siteClaimConfirmed
                || siteOperatorClaimOutcome === "site_claim_access_boundary_ready"
                || siteOperatorClaimOutcome === "site_claim_needs_access_boundary",
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
              completed: Boolean(progress.accessBoundariesDefined || accessBoundaryOutcome === "access_boundary_defined"),
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
                progress.privacyRulesConfirmed
                || siteClaimCriteria.includes("privacy_security_boundary"),
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
          href: isRobotTeam ? "/contact?persona=robot-team" : "/contact/site-operator",
          updateField: "onboardingProgress.defineSiteSubmission",
        },
      },
      {
        id: "review",
        title: "Route the submission for review",
        description:
          "The request enters the intake review queue before a package, hosted review, or operator call opens.",
        completed: progress.completeIntakeReview,
        icon: ClipboardCheck,
        action: {
          label: "Open submission form",
          href: isRobotTeam ? "/contact?persona=robot-team" : "/contact/site-operator",
          updateField: "onboardingProgress.completeIntakeReview",
        },
      },
      {
        id: "review-session",
        title: calendarIsRecommended ? "Scope the human call" : "Keep calendar secondary",
        description: calendarIsRecommended
          ? "The intake is specific enough that a scoped meeting can accelerate the next decision."
          : "A meeting is optional until the structured intake shows a concrete site, workflow, buyer, or rights question.",
        completed: Boolean(progress.reviewSessionScoped) || !calendarIsRecommended,
        icon: CalendarClock,
        action: calendarIsRecommended
          ? {
              label: "Book scoping call",
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
        completed: Boolean(progress.teamContactConfirmed || progress.inviteTeam),
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
    },
    [
      calendarIsRecommended,
      isRobotTeam,
      missingProofReadyFields,
      missingSiteClaimFields,
      progress,
      accessBoundaryOutcome,
      proofReadyIntakeComplete,
      siteClaimCriteria,
      siteOperatorClaimOutcome,
    ]
  );

  const completedCount = checklistItems.filter((item) => item.completed).length;

  const handleAction = useCallback(
    async (item: ChecklistItem) => {
      if (currentUser?.uid && item.action?.updateField) {
        await updateDoc(doc(db, "users", currentUser.uid), {
          [item.action.updateField]: true,
        });
      }

      if (item.action) {
        setLocation(item.action.href);
      }
    },
    [currentUser?.uid, setLocation]
  );

  const handleFinish = useCallback(async () => {
    if (currentUser?.uid) {
      await updateDoc(doc(db, "users", currentUser.uid), {
        finishedOnboarding: true,
        onboardingStep: "completed",
        "onboardingProgress.completedAt": serverTimestamp(),
      });
    }

    setLocation("/dashboard");
  }, [currentUser?.uid, setLocation]);

  const intakeSummary = [
    { label: "Buyer type", value: userData?.buyerType === "robot_team" ? "Robot team" : "Site operator" },
    { label: "Primary path", value: userData?.structuredIntakeRecommendedPath || "Structured intake review" },
    ...(isRobotTeam
      ? [
          { label: "Proof outcome", value: formatIntakeLabel(proofReadyOutcome) },
          { label: "Proof path", value: formatIntakeLabel(proofPathOutcome) },
          {
            label: "Proof readiness",
            value: proofReadinessScore === null ? "Not measured yet" : `${proofReadinessScore}%`,
          },
        ]
      : [
          { label: "Site claim", value: formatIntakeLabel(siteOperatorClaimOutcome) },
          { label: "Access boundary", value: formatIntakeLabel(accessBoundaryOutcome) },
          {
            label: "Claim readiness",
            value: siteClaimReadinessScore === null ? "Not measured yet" : `${siteClaimReadinessScore}%`,
          },
        ]),
    { label: "Calendar", value: calendarDisposition.replaceAll("_", " ") },
    { label: "Site", value: userData?.siteName || "Not set yet" },
    { label: "Location", value: userData?.siteLocation || "Not set yet" },
    { label: "Task", value: userData?.taskStatement || "Not set yet" },
  ];

  return (
    <main className="min-h-screen bg-white px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-zinc-950">Intake review hub</h1>
          <p className="mt-2 text-zinc-600">
            Confirm the structured intake first. A calendar step only opens when the site, workflow, buyer, or rights question is concrete enough.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            {checklistItems.map((item, index) => (
              <ChecklistCard
                key={item.id}
                item={item}
                index={index + 1}
                onAction={handleAction}
              />
            ))}
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Submission summary
              </p>
              <div className="mt-4 space-y-3">
                {intakeSummary.map((item) => (
                  <div key={item.label}>
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                      {item.label}
                    </p>
                    <p className="text-sm text-zinc-900">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              {!isRobotTeam ? (
                <div className="mb-6 border-b border-zinc-200 pb-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Operator control map
                  </p>
                  <div className="mt-4 grid gap-3">
                    {operatorControlRows.map((item) => (
                      <div key={item.label} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-zinc-950">{item.label}</p>
                          <p className="text-xs font-medium text-zinc-500">{item.value}</p>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-zinc-600">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mb-4 flex items-center justify-between text-sm text-zinc-500">
                <span>Checklist progress</span>
                <span>
                  {completedCount} / {checklistItems.length}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${(completedCount / checklistItems.length) * 100}%` }}
                />
              </div>
              <p className="mt-4 text-sm text-zinc-600">
                Finish onboarding once the intake path is clear. You can still return here later.
              </p>
              <Button type="button" className="mt-4 w-full" onClick={handleFinish}>
                Finish onboarding
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
