import { Link } from "wouter";
import { Loader2, ShieldCheck } from "lucide-react";

import { Button, Card, ProofBoundary } from "@/components/blueprint";

export function BuyerAppLoadingState() {
  return (
    <div className="flex min-h-[18rem] items-center justify-center rounded-md border border-line bg-white">
      <Loader2 className="h-6 w-6 animate-spin text-ink-500" aria-label="Loading buyer access" />
    </div>
  );
}
export function BuyerAppErrorState({ message }: { message: string }) {
  return (
    <ProofBoundary level="block" title="Access state unavailable">
      {message}
    </ProofBoundary>
  );
}

export function BuyerAppEmptyState({
  title = "No buyer entitlements yet",
  body = "Paid orders and approved access windows appear here after Stripe webhook provisioning writes a marketplace entitlement for this account.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <Card pad="lg" className="flex flex-col gap-4">
      <ProofBoundary level="info" title={title} icon={ShieldCheck}>
        {body}
      </ProofBoundary>
      <Button asChild variant="action" className="w-fit">
        <Link href="/pricing">Review pricing</Link>
      </Button>
    </Card>
  );
}
