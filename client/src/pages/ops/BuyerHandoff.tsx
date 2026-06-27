import { Helmet } from "@/lib/helmet";
import { PackageCheck } from "lucide-react";

import {
  Button,
  Card,
  DataField,
  ProofBoundary,
  StatusChip,
} from "@/components/blueprint";
import { OpsShell } from "@/components/blueprint/ops/OpsShell";
import {
  HANDOFF_ENTITLEMENT,
  HANDOFF_PACKAGE_ITEMS,
  HANDOFF_RELEASE_BOUNDARY,
} from "@/components/blueprint/ops/mockData";

/**
 * BuyerHandoff — OPS CONSOLE › Buyer handoff (/ops/handoff).
 *
 * Proof-safe closeout: the operator confirms exactly what ships to the buyer
 * before granting hosted access. Package contents carry Included / Labeled /
 * Withheld / Pending StatusChips, entitlement & scope render as DataFields, and
 * a release ProofBoundary restates the proof discipline (generated media is
 * review support, the Eval Card reports rank fidelity — never deployment
 * readiness) before the brass "Release to buyer" action.
 *
 * Illustrative data only — there is no backend behind this surface.
 */
export default function BuyerHandoff() {
  return (
    <>
      <Helmet>
        <title>Buyer handoff · Blueprint Ops</title>
        <meta
          name="description"
          content="Proof-safe closeout for a buyer package — confirm included, labeled, withheld and pending contents within the licensed scope before releasing hosted access."
        />
      </Helmet>

      <OpsShell
        active="handoff"
        title="Buyer handoff"
        sub="PKG-2040-A · Atlas Inspection Bench · Vendor B Robotics"
        actions={
          <Button
            variant="brass"
            size="sm"
            iconLeft={<PackageCheck aria-hidden="true" />}
          >
            Release to buyer
          </Button>
        }
      >
        <div className="mx-auto flex max-w-[72rem] flex-col gap-6">
          <p className="max-w-[44rem] text-body-s leading-[1.6] text-ink-600">
            Confirm exactly what ships to the buyer before granting hosted
            access. Every item is labeled by how it can be used — included
            evidence, labeled review support, withheld per privacy scope, or
            pending an entitlement upgrade.
          </p>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.45fr_1fr]">
            {/* Package contents */}
            <Card
              eyebrow="Closeout"
              title="Package contents"
              headerRight={
                <span className="font-mono text-[0.7rem] uppercase tracking-[0.08em] text-ink-500">
                  {HANDOFF_PACKAGE_ITEMS.length} items
                </span>
              }
              pad="md"
            >
              <ul className="flex flex-col">
                {HANDOFF_PACKAGE_ITEMS.map((item, i) => (
                  <li
                    key={item.id}
                    className={
                      i > 0
                        ? "flex items-start justify-between gap-4 border-t border-line-soft py-3.5"
                        : "flex items-start justify-between gap-4 pb-3.5"
                    }
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="text-body-s font-semibold text-ink-900">
                        {item.label}
                      </span>
                      <span className="text-[13px] leading-snug text-ink-500">
                        {item.detail}
                      </span>
                      <span className="font-mono text-[0.7rem] text-ink-400">
                        {item.id}
                      </span>
                    </div>
                    <StatusChip tone={item.stateTone} className="mt-0.5 shrink-0">
                      {item.stateLabel}
                    </StatusChip>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Entitlement & scope */}
            <Card
              tone="inset"
              eyebrow="Entitlement"
              title="Buyer scope & access"
              pad="md"
            >
              <dl className="flex flex-col">
                {HANDOFF_ENTITLEMENT.map((field, i) => (
                  <DataField
                    key={field.label}
                    label={field.label}
                    value={field.value}
                    border={i < HANDOFF_ENTITLEMENT.length - 1}
                    trailing={
                      field.chipLabel ? (
                        <StatusChip tone={field.chipTone} dot={false} square>
                          {field.chipLabel}
                        </StatusChip>
                      ) : undefined
                    }
                  />
                ))}
              </dl>
            </Card>
          </div>

          {/* Release boundary */}
          <ProofBoundary level="proof" title={HANDOFF_RELEASE_BOUNDARY.title}>
            {HANDOFF_RELEASE_BOUNDARY.body}
          </ProofBoundary>

          {/* Release action */}
          <div className="flex flex-col items-start justify-between gap-4 border-t border-line pt-6 sm:flex-row sm:items-center">
            <p className="max-w-[40rem] text-[13px] leading-snug text-ink-500">
              Releasing grants Vendor B Robotics hosted access to this package
              within the scope and window above. No raw export is included.
            </p>
            <Button
              variant="brass"
              size="md"
              iconLeft={<PackageCheck aria-hidden="true" />}
              className="shrink-0"
            >
              Release to buyer
            </Button>
          </div>
        </div>
      </OpsShell>
    </>
  );
}
