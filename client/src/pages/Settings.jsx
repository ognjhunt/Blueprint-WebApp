"use client";

import { Mail, ShieldCheck, User } from "lucide-react";
import { Link } from "wouter";
import { SEO } from "@/components/SEO";
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
  { label: "Profile", href: "/settings" },
  { label: "Evaluation runs", href: "/app/runs" },
  { label: "Packages & access", href: "/app/entitlements" },
];

export default function SettingsPage() {
  const { currentUser, userData } = useAuth();
  const signInProviders = currentUser?.providerData
    ?.map((provider) => provider.providerId)
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <SEO
        title="Account Settings | Blueprint"
        description="Private Blueprint account settings."
        canonical="/settings"
        noIndex
      />
      <SurfacePage>
        <SurfaceTopBar eyebrow="Private Workspace" rightLabel="Invite Only" />
        <SurfaceSection className="py-8">
        <SurfaceBrowserFrame>
          <div className="border-b border-black/10 px-7 py-6 lg:px-8">
            <SurfaceMiniLabel>Settings</SurfaceMiniLabel>
            <h1 className="mt-4 text-[3.6rem] font-semibold tracking-[-0.08em] leading-[0.92]">
              Account overview
            </h1>
            <p className="mt-3 max-w-[38rem] text-base leading-8 text-black/60">
              Identity details from your authenticated account, with links to the
              record-backed buyer workspace.
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
                      <ShieldCheck className="h-5 w-5 text-black/60" />
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
                      <Link key={item.href} href={item.href} className={`block rounded-[1rem] px-3 py-2.5 text-sm ${index === 0 ? "bg-white font-semibold text-black" : "text-black/70 hover:bg-white/70"}`}>
                        {item.label}
                      </Link>
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
                            <User className="h-6 w-6 text-black/45" />
                          )}
                        </div>
                        <div>
                          <SurfaceMiniLabel>Profile</SurfaceMiniLabel>
                          <p className="mt-2 text-[1.8rem] font-semibold tracking-[-0.05em]">
                            {currentUser.displayName || userData?.displayName || userData?.name || "Your account"}
                          </p>
                          <p className="mt-1 text-sm text-black/60">{currentUser.email || userData?.email}</p>
                        </div>
                      </div>
                    </div>
                  </SurfaceCard>

                  <SurfaceCard>
                    <div className="flex items-center gap-3">
                      <Mail className="h-4.5 w-4.5 text-black/55" />
                      <SurfaceMiniLabel>Sign-In & Security</SurfaceMiniLabel>
                    </div>
                    <SurfaceStatusList
                      className="mt-5"
                      items={[
                        { label: "Primary email", value: currentUser.email || userData?.email || "N/A" },
                        { label: "Sign-in provider", value: signInProviders || "Not reported by identity provider" },
                      ]}
                    />
                  </SurfaceCard>
                </div>

                <div className="mt-5">
                  <SurfaceCard>
                    <SurfaceMiniLabel>Buyer records</SurfaceMiniLabel>
                    <p className="mt-4 max-w-[42rem] text-sm leading-7 text-black/60">
                      Evaluation runs, entitlements, and package access are loaded from
                      the authenticated buyer APIs in the Blueprint app.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <SurfaceButton href="/app/runs">View evaluation runs</SurfaceButton>
                      <SurfaceButton href="/app/entitlements" tone="secondary">View packages & access</SurfaceButton>
                    </div>
                  </SurfaceCard>
                </div>
              </div>
            </div>
          )}
        </SurfaceBrowserFrame>
        </SurfaceSection>
      </SurfacePage>
    </>
  );
}
