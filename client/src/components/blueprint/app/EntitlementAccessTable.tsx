import { Link } from "wouter";
import { useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { Button, StatusChip } from "@/components/blueprint";
import { useAuth } from "@/contexts/AuthContext";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import {
  entitlementDisplayName,
  entitlementScope,
  entitlementStateLabel,
  entitlementStateTone,
  formatEntitlementDate,
  type BuyerEntitlement,
} from "@/lib/buyerAppData";

export function EntitlementAccessTable({
  entitlements,
  actionLabel = "Open access",
}: {
  entitlements: BuyerEntitlement[];
  actionLabel?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-white">
      <table className="w-full min-w-[62rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            <th className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
              Entitlement
            </th>
            <th className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
              Access
            </th>
            <th className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
              Delivery
            </th>
            <th className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
              Granted
            </th>
            <th className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
              Scope
            </th>
            <th className="px-4 py-3 text-right text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entitlements.map((entitlement) => (
            <tr
              key={entitlement.id}
              className="border-b border-line-soft transition-colors last:border-b-0 hover:bg-inset"
            >
              <td className="px-4 py-3.5 align-middle">
                <div className="flex flex-col gap-0.5">
                  <span className="text-body-s font-semibold text-ink-900">
                    {entitlementDisplayName(entitlement)}
                  </span>
                  <span className="font-mono text-[0.7rem] text-ink-400">
                    {entitlement.id}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3.5 align-middle">
                <StatusChip tone={entitlementStateTone(entitlement.access_state)} square>
                  {entitlementStateLabel(entitlement.access_state)}
                </StatusChip>
              </td>
              <td className="px-4 py-3.5 align-middle font-mono text-[0.72rem] text-ink-600">
                {entitlement.delivery_mode || "Manual review"}
              </td>
              <td className="px-4 py-3.5 align-middle font-mono text-[0.72rem] text-ink-700">
                {formatEntitlementDate(entitlement.granted_at)}
              </td>
              <td className="px-4 py-3.5 align-middle text-body-s text-ink-600">
                {entitlementScope(entitlement)}
              </td>
              <td className="px-4 py-3.5 text-right align-middle">
                <EntitlementAccessButton
                  entitlement={entitlement}
                  actionLabel={actionLabel}
                  size="sm"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EntitlementAccessButton({
  entitlement,
  actionLabel = "Open access",
  size = "sm",
}: {
  entitlement: BuyerEntitlement;
  actionLabel?: string;
  size?: "sm" | "md";
}) {
  const { currentUser } = useAuth();
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (entitlement.access?.url) {
    return (
      <Button
        asChild
        variant={size === "sm" ? "secondary" : "action"}
        size={size}
        iconRight={<ArrowRight />}
      >
        <AccessLink href={entitlement.access.url}>
          {entitlement.access.label || actionLabel}
        </AccessLink>
      </Button>
    );
  }

  if (entitlement.access_state !== "provisioned") {
    return (
      <span className="font-mono text-[0.7rem] text-ink-400">
        Access review
      </span>
    );
  }

  async function mintSignedArtifactAccess() {
    if (!currentUser) {
      setError("Sign in required");
      return;
    }
    setIsMinting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/marketplace/entitlements/${encodeURIComponent(entitlement.id)}/artifact-access`,
        {
          credentials: "include",
          headers: await withFirebaseAuthHeaders(currentUser),
        },
      );
      const payload = (await response.json()) as {
        signed_url?: string;
        error?: string;
        code?: string;
      };
      if (!response.ok || !payload.signed_url) {
        throw new Error(payload.error || payload.code || "Artifact access is not configured");
      }
      window.open(payload.signed_url, "_blank", "noreferrer");
    } catch (mintError) {
      setError(mintError instanceof Error ? mintError.message : "Artifact access failed");
    } finally {
      setIsMinting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant={size === "sm" ? "secondary" : "action"}
        size={size}
        iconRight={<ArrowRight />}
        disabled={isMinting}
        onClick={mintSignedArtifactAccess}
      >
        {isMinting ? "Preparing" : actionLabel}
      </Button>
      {error ? (
        <span className="max-w-[14rem] text-right font-mono text-[0.68rem] text-red-700">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function AccessLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  if (/^https?:\/\//i.test(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return <Link href={href}>{children}</Link>;
}
