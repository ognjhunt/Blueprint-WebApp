"use client";

import { CreditCard, Mail, ShieldCheck, ShoppingBag, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  SurfaceBrowserFrame,
  SurfaceButton,
  SurfaceCard,
  SurfaceMiniLabel,
  SurfacePage,
  SurfaceSection,
  SurfaceSidebar,
  SurfaceStatusList,
  SurfaceTopBar,
} from "@/components/site/privateSurface";
import { privateGeneratedAssets } from "@/lib/privateGeneratedAssets";

const accountNav = [
  "Profile",
  "Sign-In & Security",
  "Payment Methods",
  "Billing History",
  "Purchases & Packages",
];

export default function SettingsPage() {
  const { currentUser, userData } = useAuth();
  const purchases = userData?.purchases || userData?.library || userData?.purchasedItems || [];

  return (
    <SurfacePage>
      <SurfaceTopBar eyebrow="Private Workspace" rightLabel="Invite Only" />
      <SurfaceSection className="py-8">
        <SurfaceBrowserFrame>
          <div className="border-b border-black/10 px-7 py-6 lg:px-8">
            <SurfaceMiniLabel>Settings</SurfaceMiniLabel>
            <h1 className="mt-4 text-[3.6rem] font-semibold tracking-[-0.08em] leading-[0.92]">
              Account overview
            </h1>
            <p className="mt-3 max-w-[38rem] text-base leading-8 text-black/62">
              Private account surface for profile, sign-in details, billing methods, billing
              history, and purchased packages.
            </p>
          </div>

          {!currentUser ? (
            <div className="grid gap-0 xl:grid-cols-[0.34fr_0.66fr]">
              <div className="border-b border-black/10 bg-[#f7f3ea] p-8 xl:border-b-0 xl:border-r lg:p-10">
                <img
                  src={privateGeneratedAssets.privateFacilityAerial}
                  alt="Blueprint facility"
                  className="h-[16rem] w-full rounded-[1.8rem] object-cover"
                />
              </div>
              <div className="p-8 lg:p-10">
                <SurfaceCard className="max-w-[48rem]">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-[#faf6ee]">
                      <ShieldCheck className="h-5 w-5 text-black/62" />
                    </div>
                    <div>
                      <p className="text-[2rem] font-semibold tracking-[-0.06em]">Sign in to view settings</p>
                      <p className="mt-3 text-sm leading-7 text-black/60">
                        Log in to access your account profile, billing, and purchases.
                      </p>
                      <SurfaceButton href="/sign-in" className="mt-6">
                        Go to login
                      </SurfaceButton>
                    </div>
                  </div>
                </SurfaceCard>
              </div>
            </div>
          ) : (
            <div className="grid gap-0 xl:grid-cols-[0.24fr_0.76fr]">
              <div className="border-b border-black/10 bg-[#f7f3ea] p-6 xl:border-b-0 xl:border-r">
                <div className="overflow-hidden rounded-[1.5rem] border border-black/10 bg-white">
                  <img
                    src={privateGeneratedAssets.privateFacilityAerial}
                    alt="Blueprint private facility"
                    className="h-44 w-full object-cover"
                  />
                </div>
                <SurfaceSidebar className="mt-4">
                  <SurfaceMiniLabel>Account</SurfaceMiniLabel>
                  <div className="mt-4 space-y-2">
                    {accountNav.map((item, index) => (
                      <div key={item} className={`rounded-[1rem] px-3 py-2.5 text-sm ${index === 0 ? "bg-white font-semibold text-black" : "text-black/68"}`}>
                        {item}
                      </div>
                    ))}
                  </div>
                </SurfaceSidebar>
              </div>

              <div className="p-6 lg:p-8">
                <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                  <SurfaceCard>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-[#faf6ee]">
                          {currentUser.photoURL ? (
                            <img src={currentUser.photoURL} alt={currentUser.displayName || "User"} className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-6 w-6 text-black/46" />
                          )}
                        </div>
                        <div>
                          <SurfaceMiniLabel>Profile</SurfaceMiniLabel>
                          <p className="mt-2 text-[1.8rem] font-semibold tracking-[-0.05em]">
                            {currentUser.displayName || userData?.displayName || userData?.name || "Your account"}
                          </p>
                          <p className="mt-1 text-sm text-black/58">{currentUser.email || userData?.email}</p>
                        </div>
                      </div>
                    </div>
                  </SurfaceCard>

                  <SurfaceCard>
                    <div className="flex items-center gap-3">
                      <Mail className="h-4.5 w-4.5 text-black/54" />
                      <SurfaceMiniLabel>Sign-In & Security</SurfaceMiniLabel>
                    </div>
                    <SurfaceStatusList
                      className="mt-5"
                      items={[
                        { label: "Primary email", value: currentUser.email || userData?.email || "N/A" },
                        { label: "Password", value: "Managed" },
                      ]}
                    />
                  </SurfaceCard>
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                  <SurfaceCard>
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-4.5 w-4.5 text-black/54" />
                      <SurfaceMiniLabel>Payment Methods</SurfaceMiniLabel>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-black/60">
                      Saved payment methods and billing actions appear here for authenticated users.
                    </p>
                  </SurfaceCard>

                  <div className="space-y-5">
                    <SurfaceCard>
                      <div className="flex items-center gap-3">
                        <ShoppingBag className="h-4.5 w-4.5 text-black/54" />
                        <SurfaceMiniLabel>Purchases & Packages</SurfaceMiniLabel>
                      </div>
                      <div className="mt-5 space-y-3">
                        {purchases.length > 0 ? (
                          purchases.slice(0, 4).map((item, index) => (
                            <div key={item.id || item.slug || index} className="rounded-[1.1rem] border border-black/10 bg-[#faf7f1] px-4 py-4">
                              <p className="text-sm font-semibold">{item.title || item.name || item.slug || `Purchase ${index + 1}`}</p>
                              <p className="mt-1 text-sm text-black/56">{item.status || "Provisioned"}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-black/58">Purchased packages will appear here once provisioned.</p>
                        )}
                      </div>
                    </SurfaceCard>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SurfaceBrowserFrame>
      </SurfaceSection>
    </SurfacePage>
  );
}
