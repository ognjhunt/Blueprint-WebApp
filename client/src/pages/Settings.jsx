"use client";

import { useMemo } from "react";
import { Mail, ShieldCheck, ShoppingBag, User } from "lucide-react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";

const sectionCardStyles =
  "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm";

export default function SettingsPage() {
  const { currentUser, userData } = useAuth();

  const createdDateLabel = useMemo(() => {
    const createdDate = userData?.createdDate;
    if (!createdDate) {
      return "—";
    }
    if (typeof createdDate === "object" && createdDate !== null) {
      if (typeof createdDate.toDate === "function") {
        return createdDate.toDate().toLocaleDateString();
      }
    }
    return new Date(createdDate).toLocaleDateString();
  }, [userData]);

  const providerDetails = useMemo(() => {
    if (!currentUser?.providerData?.length) {
      return [];
    }

    return currentUser.providerData.map((provider) => ({
      id: provider.providerId,
      displayName: provider.displayName,
      email: provider.email,
      phoneNumber: provider.phoneNumber,
      photoURL: provider.photoURL,
    }));
  }, [currentUser]);

  const hasGoogleProvider = providerDetails.some(
    (provider) => provider.id === "google.com",
  );

  const purchases =
    userData?.purchases || userData?.library || userData?.purchasedItems || [];

  return (
    <>
      <Nav />
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
                          {currentUser.email || userData?.email || "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                          Provider
                        </p>
                        <p className="mt-2 text-sm font-medium text-zinc-900">
                          {hasGoogleProvider ? "Google" : "Email"}
                        </p>
                      </div>
                    </div>

                    {hasGoogleProvider && (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
                          Google account connected
                        </p>
                        <div className="mt-3 grid gap-3 text-sm text-emerald-900 sm:grid-cols-2">
                          {providerDetails
                            .filter((provider) => provider.id === "google.com")
                            .map((provider, index) => (
                              <div key={`${provider.id}-${index}`}>
                                <p className="font-medium">
                                  {provider.displayName || "Google profile"}
                                </p>
                                <p className="text-emerald-700">
                                  {provider.email || "No email on file"}
                                </p>
                                {provider.photoURL && (
                                  <p className="text-emerald-600">
                                    Photo linked
                                  </p>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
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
      <Footer />
    </>
  );
}
