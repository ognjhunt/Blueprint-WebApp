"use client";

import { Mail, ShieldCheck, User } from "lucide-react";
import { Link } from "wouter";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import {
  SurfaceBrowserFrame,
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
          <div className="border-b border-runway-line px-7 py-6 lg:px-8">
            <SurfaceMiniLabel className="text-runway-faint">Settings</SurfaceMiniLabel>
            <h1 className="mt-4 font-display uppercase text-[3.6rem] font-semibold tracking-[0.005em] leading-[0.92] text-runway-text">
              Account overview
            </h1>
            <p className="mt-3 max-w-[38rem] text-base leading-8 text-runway-mute">
              Identity details from your authenticated account, with links to the
              record-backed buyer workspace.
            </p>
          </div>

          {!currentUser ? (
            <div className="grid gap-0 xl:grid-cols-[0.34fr_0.66fr]">
              <div className="border-b border-runway-line bg-runway-deep p-8 xl:border-b-0 xl:border-r lg:p-10">
                <img
                  src={privateGeneratedAssets.privateFacilityAerial}
                  alt="Blueprint facility"
                  className="h-[16rem] w-full object-cover"
                />
              </div>
              <div className="p-8 lg:p-10">
                <SurfaceCard className="max-w-[48rem] rounded-none border-runway-line">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center border border-runway-line bg-runway-raised">
                      <ShieldCheck className="h-5 w-5 text-runway-mute" />
                    </div>
                    <div>
                      <p className="font-display uppercase text-[2rem] font-semibold tracking-[0.005em] text-runway-text">Sign in to view settings</p>
                      <p className="mt-3 text-sm leading-7 text-runway-mute">
                        Log in to access your account profile, billing, and purchases.
                      </p>
                      <a href="/sign-in" className="runway-cta mt-6">
                        Go to login
                      </a>
                    </div>
                  </div>
                </SurfaceCard>
              </div>
            </div>
          ) : (
            <div className="grid gap-0 xl:grid-cols-[0.24fr_0.76fr]">
              <div className="border-b border-runway-line bg-runway-deep p-6 xl:border-b-0 xl:border-r">
                <div className="overflow-hidden border border-runway-line bg-runway-panel">
                  <img
                    src={privateGeneratedAssets.privateFacilityAerial}
                    alt="Blueprint private facility"
                    className="h-44 w-full object-cover"
                  />
                </div>
                <SurfaceSidebar className="mt-4 rounded-none border-runway-line">
                  <SurfaceMiniLabel className="text-runway-faint">Account</SurfaceMiniLabel>
                  <div className="mt-4 space-y-2">
                    {accountNav.map((item, index) => (
                      <Link key={item.href} href={item.href} className={`block px-3 py-2.5 text-sm ${index === 0 ? "bg-runway-raised font-semibold text-runway-text" : "text-runway-body transition hover:bg-runway-raised hover:text-runway-text"}`}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </SurfaceSidebar>
              </div>

              <div className="p-6 lg:p-8">
                <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                  <SurfaceCard className="rounded-none border-runway-line">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-runway-line bg-runway-raised">
                          {currentUser.photoURL ? (
                            <img src={currentUser.photoURL} alt={currentUser.displayName || "User"} className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-6 w-6 text-runway-mute" />
                          )}
                        </div>
                        <div>
                          <SurfaceMiniLabel className="text-runway-faint">Profile</SurfaceMiniLabel>
                          <p className="mt-2 font-display uppercase text-[1.8rem] font-semibold tracking-[0.005em] text-runway-text">
                            {currentUser.displayName || userData?.displayName || userData?.name || "Your account"}
                          </p>
                          <p className="mt-1 text-sm text-runway-mute">{currentUser.email || userData?.email}</p>
                        </div>
                      </div>
                    </div>
                  </SurfaceCard>

                  <SurfaceCard className="rounded-none border-runway-line">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4.5 w-4.5 text-runway-mute" />
                      <SurfaceMiniLabel className="text-runway-faint">Sign-In & Security</SurfaceMiniLabel>
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
                  <SurfaceCard className="rounded-none border-runway-line">
                    <SurfaceMiniLabel className="text-runway-faint">Buyer records</SurfaceMiniLabel>
                    <p className="mt-4 max-w-[42rem] text-sm leading-7 text-runway-mute">
                      Evaluation runs, entitlements, and package access are loaded from
                      the authenticated buyer APIs in the Blueprint app.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <a href="/app/runs" className="runway-cta">View evaluation runs</a>
                      <a href="/app/entitlements" className="runway-cta-ghost">View packages & access</a>
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
