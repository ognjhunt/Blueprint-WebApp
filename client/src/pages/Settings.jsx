"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, Mail, ShieldCheck, ShoppingBag, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateUserBillingDetails } from "@/lib/firebase";

const sectionCardStyles =
  "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm";

export default function SettingsPage() {
  const { currentUser, userData } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [billingHistory, setBillingHistory] = useState([]);
  const [newPaymentMethod, setNewPaymentMethod] = useState({
    cardholder: "",
    cardNumber: "",
    expiry: "",
    cvc: "",
  });
  const [isSavingBilling, setIsSavingBilling] = useState(false);
  const [billingMessage, setBillingMessage] = useState("");

  const createdDateLabel = useMemo(() => {
    const createdDate = userData?.createdDate;
    if (!createdDate) {
      return "N/A";
    }
    if (typeof createdDate === "object" && createdDate !== null) {
      if (typeof createdDate.toDate === "function") {
        return createdDate.toDate().toLocaleDateString();
      }
    }
    return new Date(createdDate).toLocaleDateString();
  }, [userData]);

  const purchases =
    userData?.purchases || userData?.library || userData?.purchasedItems || [];

  useEffect(() => {
    if (!userData) {
      setPaymentMethods([]);
      setBillingHistory([]);
      return;
    }
    const normalizedMethods = Array.isArray(userData.paymentMethods)
      ? userData.paymentMethods.map((method, index) => ({
          id: method.id || `pm_${index}_${method.last4 || "card"}`,
          ...method,
        }))
      : [];
    if (normalizedMethods.length > 0 && !normalizedMethods.some((method) => method.isDefault)) {
      normalizedMethods[0].isDefault = true;
    }
    setPaymentMethods(normalizedMethods);
    setBillingHistory(Array.isArray(userData.billingHistory) ? userData.billingHistory : []);
  }, [userData]);

  const detectCardBrand = (cardNumber = "") => {
    const normalized = cardNumber.replace(/\s+/g, "");
    if (normalized.startsWith("4")) return "Visa";
    if (normalized.startsWith("5")) return "Mastercard";
    if (normalized.startsWith("34") || normalized.startsWith("37")) return "Amex";
    if (normalized.startsWith("6")) return "Discover";
    return "Card";
  };

  const formatBillingDate = (value) => {
    if (!value) {
      return "No date";
    }
    if (typeof value === "object" && typeof value.toDate === "function") {
      return value.toDate().toLocaleDateString();
    }
    return new Date(value).toLocaleDateString();
  };

  const handleAddPaymentMethod = () => {
    const normalizedNumber = newPaymentMethod.cardNumber.replace(/\s+/g, "");
    if (
      !newPaymentMethod.cardholder ||
      normalizedNumber.length < 12 ||
      !newPaymentMethod.expiry
    ) {
      setBillingMessage("Enter a valid cardholder, number, and expiry date.");
      return;
    }

    const methodId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `pm_${Date.now()}`;
    const isDefault = paymentMethods.length === 0 || !paymentMethods.some((method) => method.isDefault);
    const newMethod = {
      id: methodId,
      cardholder: newPaymentMethod.cardholder.trim(),
      brand: detectCardBrand(normalizedNumber),
      last4: normalizedNumber.slice(-4),
      expiryDate: newPaymentMethod.expiry,
      isDefault,
    };

    setPaymentMethods((prev) => [...prev, newMethod]);
    setNewPaymentMethod({
      cardholder: "",
      cardNumber: "",
      expiry: "",
      cvc: "",
    });
    setBillingMessage("");
  };

  const handleSetDefault = (methodId) => {
    setPaymentMethods((prev) =>
      prev.map((method) => ({
        ...method,
        isDefault: method.id === methodId,
      })),
    );
  };

  const handleRemoveMethod = (methodId) => {
    setPaymentMethods((prev) => {
      const remaining = prev.filter((method) => method.id !== methodId);
      if (remaining.length > 0 && !remaining.some((method) => method.isDefault)) {
        remaining[0].isDefault = true;
      }
      return remaining;
    });
  };

  const handleSaveBilling = async () => {
    if (!currentUser) {
      setBillingMessage("Sign in to update billing details.");
      return;
    }
    setIsSavingBilling(true);
    setBillingMessage("");
    try {
      await updateUserBillingDetails(currentUser.uid, {
        paymentMethods,
        billingHistory,
      });
      setBillingMessage("Billing details updated.");
    } catch (error) {
      console.error("Failed to update billing details:", error);
      setBillingMessage("Unable to save billing details. Please try again.");
    } finally {
      setIsSavingBilling(false);
    }
  };

  return (
    <main className="min-h-screen bg-white pt-20 text-zinc-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 pb-16 sm:px-6">
          <header className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-400">
              Settings
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
              Your account, streamlined.
            </h1>
            <p className="max-w-2xl text-lg text-zinc-600">
              Manage the essentials tied to your Blueprint account. Everything is
              kept simple and customer-ready.
            </p>
          </header>

          {!currentUser ? (
            <section className={sectionCardStyles}>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900">
                      Sign in to view settings
                    </h2>
                    <p className="text-sm text-zinc-600">
                      Log in to access your account profile, billing, and
                      purchases.
                    </p>
                  </div>
                </div>
                <a
                  href="/login"
                  className="inline-flex w-fit items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-900"
                >
                  Go to login
                </a>
              </div>
            </section>
          ) : (
            <>
              <section className={sectionCardStyles}>
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-zinc-100">
                      {currentUser.photoURL ? (
                        <img
                          src={currentUser.photoURL}
                          alt={currentUser.displayName || "User"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-6 w-6 text-zinc-500" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-zinc-900">
                        {currentUser.displayName ||
                          userData?.displayName ||
                          userData?.name ||
                          "Your account"}
                      </h2>
                      <p className="text-sm text-zinc-600">
                        {currentUser.email || userData?.email}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-zinc-500">
                    Member since{" "}
                    {createdDateLabel}
                  </div>
                </div>
              </section>

              <section className={sectionCardStyles}>
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold text-zinc-900">
                        Sign-in details
                      </h2>
                      <p className="text-sm text-zinc-600">
                        The essentials tied to your login providers.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                          Primary email
                        </p>
                        <p className="mt-2 text-sm font-medium text-zinc-900">
                          {currentUser.email || userData?.email || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className={sectionCardStyles}>
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold text-zinc-900">
                        Billing &amp; Payment Methods
                      </h2>
                      <p className="text-sm text-zinc-600">
                        Manage saved payment options and review recent billing activity.
                        For security, only card brand and last four digits are stored.
                      </p>
                    </div>

                    <Card className="border border-zinc-200 shadow-none">
                      <CardContent className="space-y-4 p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900">
                              Saved payment methods
                            </p>
                            <p className="text-xs text-zinc-500">
                              Set a default card for recurring charges.
                            </p>
                          </div>
                        </div>

                        {paymentMethods.length > 0 ? (
                          <div className="space-y-3">
                            {paymentMethods.map((method) => (
                              <div
                                key={method.id || `${method.brand}-${method.last4}`}
                                className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div>
                                  <p className="text-sm font-semibold text-zinc-900">
                                    {method.brand || "Card"} •••• {method.last4 || "N/A"}
                                  </p>
                                  <p className="text-xs text-zinc-500">
                                    Expires {method.expiryDate || "N/A"}
                                  </p>
                                  {method.isDefault && (
                                    <span className="mt-2 inline-flex w-fit rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                                      Default
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {!method.isDefault && (
                                    <Button
                                      variant="secondary"
                                      onClick={() => handleSetDefault(method.id)}
                                    >
                                      Set default
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    className="border-zinc-300 text-zinc-700"
                                    onClick={() => handleRemoveMethod(method.id)}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500">
                            No payment methods saved yet.
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border border-zinc-200 shadow-none">
                      <CardContent className="space-y-4 p-5">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">
                            Add payment method
                          </p>
                          <p className="text-xs text-zinc-500">
                            Card details are tokenized in production; demo stores only the
                            last four digits.
                          </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                              Cardholder
                            </label>
                            <Input
                              placeholder="Jamie Appleseed"
                              value={newPaymentMethod.cardholder}
                              onChange={(event) =>
                                setNewPaymentMethod((prev) => ({
                                  ...prev,
                                  cardholder: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                              Card number
                            </label>
                            <Input
                              placeholder="1234 5678 9012 3456"
                              value={newPaymentMethod.cardNumber}
                              onChange={(event) =>
                                setNewPaymentMethod((prev) => ({
                                  ...prev,
                                  cardNumber: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                              Expiry
                            </label>
                            <Input
                              placeholder="MM/YY"
                              value={newPaymentMethod.expiry}
                              onChange={(event) =>
                                setNewPaymentMethod((prev) => ({
                                  ...prev,
                                  expiry: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                              CVC
                            </label>
                            <Input
                              placeholder="123"
                              value={newPaymentMethod.cvc}
                              onChange={(event) =>
                                setNewPaymentMethod((prev) => ({
                                  ...prev,
                                  cvc: event.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <Button type="button" onClick={handleAddPaymentMethod}>
                            Add payment method
                          </Button>
                          <span className="text-xs text-zinc-500">
                            CVC is never stored.
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-zinc-200 shadow-none">
                      <CardContent className="space-y-4 p-5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900">
                              Recent billing history
                            </p>
                            <p className="text-xs text-zinc-500">
                              Latest charges and invoice statuses.
                            </p>
                          </div>
                        </div>
                        {billingHistory.length > 0 ? (
                          <div className="space-y-3">
                            {billingHistory.map((entry, index) => (
                              <div
                                key={entry.id || `${entry.status}-${index}`}
                                className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div>
                                  <p className="font-semibold text-zinc-900">
                                    {entry.amount ? `$${entry.amount}` : "N/A"}
                                  </p>
                                  <p className="text-xs text-zinc-500">
                                    {formatBillingDate(entry.date)}
                                  </p>
                                </div>
                                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                                  {entry.status || "Pending"}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500">
                            No billing history yet.
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Button onClick={handleSaveBilling} disabled={isSavingBilling}>
                        {isSavingBilling ? "Saving..." : "Save billing updates"}
                      </Button>
                      {billingMessage && (
                        <p className="text-sm text-zinc-500">{billingMessage}</p>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className={sectionCardStyles}>
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h2 className="text-lg font-semibold text-zinc-900">
                        Purchases / Library
                      </h2>
                      <p className="text-sm text-zinc-600">
                        Access your purchased scenes, datasets, and services.
                      </p>
                    </div>

                    {Array.isArray(purchases) && purchases.length > 0 ? (
                      <ul className="space-y-3">
                        {purchases.map((purchase, index) => (
                          <li
                            key={purchase.id || purchase.name || index}
                            className="rounded-xl border border-zinc-200 p-4"
                          >
                            <p className="text-sm font-semibold text-zinc-900">
                              {purchase.name || purchase.title || "Untitled"}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {purchase.status || "Available in library"}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
                        <p className="font-medium text-zinc-700">
                          No purchases yet.
                        </p>
                        <p className="mt-2">
                          When you buy datasets or services, they’ll appear here
                          for quick access.
                        </p>
                        <a
                          href="/marketplace"
                          className="mt-4 inline-flex items-center text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
                        >
                          Browse the marketplace →
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </>
          )}
      </div>
    </main>
  );
}
