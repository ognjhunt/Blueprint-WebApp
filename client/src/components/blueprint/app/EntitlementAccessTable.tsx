import { Link } from "wouter";
import { useState, type ReactNode } from "react";
import { ArrowRight, Download } from "lucide-react";

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

function hasDownloadablePackage(entitlement: BuyerEntitlement): boolean {
  return (
    entitlement.access_state === "provisioned" &&
    typeof entitlement.package_delivery_base_uri === "string" &&
    entitlement.package_delivery_base_uri.trim().length > 0
  );
}

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
                {entitlement.access?.url ? (
                  <Button asChild variant="secondary" size="sm" iconRight={<ArrowRight />}>
                    <AccessLink href={entitlement.access.url}>
                      {entitlement.access.label || actionLabel}
                    </AccessLink>
                  </Button>
                ) : hasDownloadablePackage(entitlement) ? (
                  <PackageDownloadButton entitlementId={entitlement.id} />
                ) : (
                  <span className="font-mono text-[0.7rem] text-ink-400">
                    Access review
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * R031: mint a short-lived signed URL for a pipeline-delivered GCS package and
 * open it. The entitlement/consent gate is enforced server-side by the
 * `artifact-access` route; a failure (not provisioned / revoked / no source)
 * surfaces as an inline "Access not ready" note rather than a broken link.
 */
function PackageDownloadButton({ entitlementId }: { entitlementId: string }) {
  const { currentUser } = useAuth();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function handleDownload() {
    if (status === "loading") {
      return;
    }
    setStatus("loading");
    try {
      const response = await fetch(
        `/api/marketplace/entitlements/${encodeURIComponent(entitlementId)}/artifact-access`,
        {
          credentials: "include",
          headers: await withFirebaseAuthHeaders(currentUser),
        },
      );
      if (!response.ok) {
        throw new Error(`artifact_access_${response.status}`);
      }
      const payload = (await response.json()) as { signed_url?: string };
      if (!payload.signed_url) {
        throw new Error("missing_signed_url");
      }
      window.open(payload.signed_url, "_blank", "noopener,noreferrer");
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        size="sm"
        iconRight={<Download />}
        onClick={handleDownload}
        disabled={status === "loading"}
      >
        {status === "loading" ? "Preparing…" : "Download package"}
      </Button>
      {status === "error" ? (
        <span className="font-mono text-[0.65rem] text-block-fg">
          Access not ready
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
