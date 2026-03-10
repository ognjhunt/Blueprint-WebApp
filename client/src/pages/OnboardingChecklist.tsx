"use client";

import React, { useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  Shield,
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

  const checklistItems: ChecklistItem[] = useMemo(
    () => [
      {
        id: "profile",
        title: "Account profile complete",
        description: "Your account exists and the intake owner is identified.",
        completed: progress.profileComplete,
        icon: Shield,
      },
      {
        id: "submission",
        title: "Confirm the site submission",
        description:
          "Review the site, location, task, and constraints that Blueprint should use for qualification.",
        completed: progress.defineSiteSubmission,
        icon: Building2,
        action: {
          label: "Review intake",
          href: "/contact",
          updateField: "onboardingProgress.defineSiteSubmission",
        },
      },
      {
        id: "review",
        title: "Route the submission for review",
        description:
          "Open the intake form and send the site into the qualification queue with the latest details.",
        completed: progress.completeIntakeReview,
        icon: ClipboardCheck,
        action: {
          label: "Open submission form",
          href: "/contact",
          updateField: "onboardingProgress.completeIntakeReview",
        },
      },
      {
        id: "opportunities",
        title: "Review qualified opportunities",
        description:
          "See what the downstream handoff looks like after a site clears qualification.",
        completed: progress.reviewQualifiedOpportunities,
        icon: FileSearch,
        action: {
          label: "Open qualified opportunities",
          href: "/qualified-opportunities",
          updateField: "onboardingProgress.reviewQualifiedOpportunities",
        },
        optional: true,
      },
      {
        id: "team",
        title: "Invite your team",
        description: "Bring in teammates after the intake path is set.",
        completed: progress.inviteTeam,
        icon: Users,
        action: {
          label: "Open settings",
          href: "/settings",
        },
        optional: true,
      },
    ],
    [progress]
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
    { label: "Site", value: userData?.siteName || "Not set yet" },
    { label: "Location", value: userData?.siteLocation || "Not set yet" },
    { label: "Task", value: userData?.taskStatement || "Not set yet" },
  ];

  return (
    <main className="min-h-screen bg-white px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-zinc-950">
            Qualification intake hub
          </h1>
          <p className="mt-2 text-zinc-600">
            Confirm the submission, route it into review, and keep marketplace browsing secondary.
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
