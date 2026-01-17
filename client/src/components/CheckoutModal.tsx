import { useState } from "react";
import { X, ShoppingCart, Loader2, AlertCircle, Check } from "lucide-react";
import { useStripeCheckout, MarketplaceCheckoutItem } from "@/hooks/useStripeCheckout";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    slug: string;
    title: string;
    description: string;
    price: number;
    sceneCount?: number;
    type: "dataset" | "scene";
  };
}

export function CheckoutModal({ isOpen, onClose, item }: CheckoutModalProps) {
  const [quantity, setQuantity] = useState(1);
  const { isLoading, error, initiateCheckout, clearError } = useStripeCheckout();

  if (!isOpen) return null;

  const totalPrice = item.price * quantity;

  const handleCheckout = async () => {
    const checkoutItem: MarketplaceCheckoutItem = {
      sku: item.slug,
      title: item.title,
      description: item.description.slice(0, 500),
      price: item.price,
      quantity,
      itemType: item.type,
    };

    await initiateCheckout(checkoutItem);
  };

  const handleClose = () => {
    clearError();
    setQuantity(1);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          aria-label="Close checkout modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
            <ShoppingCart className="h-6 w-6 text-indigo-600" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900">Checkout</h2>
          <p className="text-sm text-zinc-500">Complete your purchase</p>
        </div>

        {/* Item details */}
        <div className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="mb-2 flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-zinc-900">{item.title}</h3>
              <p className="text-xs text-zinc-500 capitalize">
                {item.type === "dataset" ? `Benchmark Pack • ${item.sceneCount || 1} scenes` : "Scene Library"}
              </p>
            </div>
            <span className="text-lg font-bold text-zinc-900">
              ${item.price.toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-zinc-600 line-clamp-2">{item.description}</p>
        </div>

        {/* Quantity selector (for datasets) */}
        {item.type === "dataset" && (
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Quantity
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
              >
                -
              </button>
              <span className="w-12 text-center text-lg font-semibold text-zinc-900">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Total and checkout button */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-t border-zinc-200 pt-4">
            <span className="text-sm font-medium text-zinc-600">Total</span>
            <span className="text-2xl font-bold text-zinc-900">
              ${totalPrice.toLocaleString()}
            </span>
          </div>

          <button
            onClick={handleCheckout}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Pay ${totalPrice.toLocaleString()}
              </>
            )}
          </button>

          <p className="text-center text-xs text-zinc-400">
            Secure checkout powered by Stripe
          </p>
        </div>
      </div>
    </div>
  );
}
