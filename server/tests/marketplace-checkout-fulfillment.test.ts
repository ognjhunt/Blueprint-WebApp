// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildMarketplaceCheckoutMetadata } from "../routes/api/create-checkout-session";

describe("marketplace checkout fulfillment launch gate", () => {
  it("preserves live inventory fulfillment metadata in checkout payloads", () => {
    const metadata = buildMarketplaceCheckoutMetadata({
      orderId: "order-123",
      marketplaceItem: {
        sku: "launch-gate-scene",
        title: "Launch Gate Scene",
        description: "Buyer-safe fulfillment scene",
        itemType: "scene",
        price: 120,
        quantity: 1,
        licenseTier: "commercial",
        exclusivity: "non-exclusive",
        addons: [],
      },
      itemType: "scene",
      liveInventoryRecord: {
        deliveryMode: "buyer_artifact_access",
        fulfillmentStatus: "artifact_ready",
      },
      computedPrice: 120,
      quantity: 1,
      expectedBasePrice: 120,
      licenseTier: "commercial",
      exclusivity: "non-exclusive",
      addons: [],
    });

    expect(metadata).toMatchObject({
      order_id: "order-123",
      marketplaceSku: "launch-gate-scene",
      marketplaceInventorySource: "firestore",
      marketplaceDeliveryMode: "buyer_artifact_access",
      marketplaceFulfillmentStatus: "artifact_ready",
      marketplacePrice: "120.00",
      basePrice: "120.00",
      addons: "",
    });
  });
});
