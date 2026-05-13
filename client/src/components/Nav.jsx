// =============================
// File: src/components/Nav.jsx
// =============================

import React, { useState, useEffect, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, X, User, UserPlus } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { BrandLockup } from "@/components/site/BrandMark";

// Utility: initials from name
const getInitials = (name) => {
  if (!name) return "";
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
};

export default function Nav({
  blueprintTitle,
  hideAuthenticatedFeatures = false,
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { currentUser, userData, logout } = useAuth();
  const { toast } = useToast();
  const [path, setLocation] = useLocation();
  const [matchEditor] = useRoute("/blueprint-editor/:rest*");

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 12);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await logout();
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
      setLocation("/");
    } catch (error) {
      console.error("Sign out error:", error);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  }, [logout, toast, setLocation]);

  const resolvedDisplayName =
    currentUser?.displayName || userData?.displayName;
  const resolvedPhotoURL = currentUser?.photoURL || userData?.photoURL || "";
  const userInitials = getInitials(
    resolvedDisplayName || userData?.name || userData?.displayName,
  );

  const navLinks = [
    { href: "/product", label: "Product" },
    { href: "/world-models", label: "World models" },
    { href: "/capture", label: "Capture" },
    { href: "/proof", label: "Proof" },
    { href: "/pricing", label: "Pricing" },
    ...(currentUser && !hideAuthenticatedFeatures
      ? [{ href: "/scanner-portal", label: "Scanner Portal" }]
      : []),
  ];

  return (
    <motion.nav
      role="navigation"
      aria-label="Primary"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? "border-b border-white/10 bg-[#0d0d0b]/92 shadow-[0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-xl"
          : "bg-[#0d0d0b]/72 backdrop-blur-md"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="flex items-center justify-between h-16 md:h-20 w-full px-4 md:px-6 lg:px-10">
        {/* Brand */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center space-x-3 group">
            <BrandLockup tone="paper" compact />
          </Link>
        </div>

        {/* Center title */}
        <div className="hidden md:block absolute left-1/2 -translate-x-1/2">
          {blueprintTitle && (
            <motion.div
              className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 border ${
                isScrolled
                  ? "bg-white/8 text-white/75 border-white/10"
                  : "bg-black/40 text-white/75 border-white/10 backdrop-blur"
              }`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              {blueprintTitle}
            </motion.div>
          )}
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <motion.div
                className={`relative group flex items-center gap-2 text-sm font-semibold ${
                  isScrolled ? "text-white/75" : "text-white/82"
                }`}
                whileHover={{ scale: 1.05 }}
              >
                {link.label}
                {link.badge && (
                  <span className="text-[10px] leading-none bg-[#c7a775] text-[#0d0d0b] px-2 py-0.5">
                    {link.badge}
                  </span>
                )}
                <span className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-[#c7a775] transition-transform duration-300 group-hover:scale-x-100" />
              </motion.div>
            </Link>
          ))}

          {/* Auth controls */}
          {!currentUser ? (
            <SignInButtonInternal />
          ) : (
            <div className="flex items-center gap-3">
              {/* Avatar dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={`relative h-10 w-10 p-0 rounded-full overflow-hidden ring-2 ${
                      isScrolled ? "ring-slate-700" : "ring-slate-600"
                    } hover:ring-[#c7a775] transition-all duration-300`}
                    aria-label="User menu"
                  >
                    <UserAvatarDisplay
                      photoURL={resolvedPhotoURL}
                      displayName={resolvedDisplayName}
                      initials={userInitials}
                    />
                  </Button>
                </DropdownMenuTrigger>
                <MemoizedDropdownMenuContent
                  currentUser={currentUser}
                  userData={userData}
                  handleSignOut={handleSignOut}
                  hideAuthenticatedFeatures={hideAuthenticatedFeatures}
                />
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden flex items-center justify-center w-11 h-11 rounded-none bg-white/5 text-slate-100 border border-white/15"
          onClick={() => setIsMobileMenuOpen((v) => !v)}
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-nav"
        >
          <motion.div
            initial={false}
            animate={{ rotate: isMobileMenuOpen ? 180 : 0 }}
            transition={{ duration: 0.25 }}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </motion.div>
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            id="mobile-nav"
            className="md:hidden absolute top-full left-0 right-0 bg-[#0d0d0b]/97 backdrop-blur-xl border-t border-white/10 overflow-hidden"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="p-6 flex flex-col space-y-3">
              {blueprintTitle && (
                <div className="text-center py-3 px-4 bg-white/5 border border-white/10">
                  <span className="text-sm font-semibold text-white/75 flex items-center justify-center gap-2">
                    {blueprintTitle}
                  </span>
                </div>
              )}

              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="w-full"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <div className="flex items-center justify-between text-slate-200 hover:text-white text-sm font-semibold py-4 px-4 hover:bg-white/8 transition">
                    <span>{link.label}</span>
                    {link.badge && (
                      <span className="text-[10px] bg-[#c7a775] text-[#0d0d0b] px-2 py-1">
                        {link.badge}
                      </span>
                    )}
                  </div>
                </Link>
              ))}

              {!currentUser ? (
                <>
                  <Link
                    href="/login"
                    className="w-full"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Button
                      variant="outline"
                      className="w-full rounded-none border border-white/20 text-slate-100 hover:bg-white/8"
                    >
                      Log in
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  {!hideAuthenticatedFeatures && (
                    <Link
                      href="/settings"
                      className="w-full"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <div className="text-slate-300 hover:text-white text-sm font-semibold py-4 px-4 hover:bg-white/8 text-center">
                        Settings
                      </div>
                    </Link>
                  )}

                  <Button
                    variant="outline"
                    className="w-full rounded-none border border-red-300/30 text-red-300 hover:bg-red-500/10"
                    onClick={() => {
                      handleSignOut();
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    Sign Out
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

// ===== memoized bits =====
const UserAvatarDisplay = memo(({ photoURL, displayName, initials }) => {
  return (
    <Avatar className="h-10 w-10">
      <AvatarImage
        src={photoURL}
        alt={displayName || "User Profile"}
        onError={(e) => {
          e.target.style.display = "none";
        }}
      />
      <AvatarFallback className="bg-[#c7a775] text-[#0d0d0b] font-bold text-sm">
        {initials ? initials : <User className="h-5 w-5" />}
      </AvatarFallback>
    </Avatar>
  );
});
UserAvatarDisplay.displayName = "UserAvatarDisplay";

const MemoizedDropdownMenuContent = memo(
  ({ currentUser, userData, handleSignOut, hideAuthenticatedFeatures }) => {
    return (
      <DropdownMenuContent
        align="end"
        className="w-60 p-3 rounded-none shadow-xl border border-white/10 bg-[#0d0d0b]/95 backdrop-blur-xl text-slate-200"
      >
        <DropdownMenuLabel className="font-normal p-3 bg-white/5">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-semibold leading-none">
              {userData?.name || userData?.displayName || "User"}
            </p>
            <p className="text-xs leading-none text-slate-400">
              {currentUser?.email || "No email"}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-2 bg-slate-700" />
        {!hideAuthenticatedFeatures && (
          <>
            <Link href="/settings">
              <DropdownMenuItem className="cursor-pointer hover:bg-white/8 rounded-none p-3 font-medium text-slate-200">
                Settings
              </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator className="my-2 bg-slate-700" />
          </>
        )}
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer hover:bg-red-500/10 text-red-300 rounded-none p-3 font-medium"
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    );
  },
);
MemoizedDropdownMenuContent.displayName = "MemoizedDropdownMenuContent";

const InviteTeamButtonInternal = memo(() => (
  <Link href="/workspace" className="mr-2">
    <Button className="rounded-none bg-[#c7a775] text-[#0d0d0b] font-semibold hover:bg-[#d8bd8d] flex items-center gap-2 px-4 py-2">
      <UserPlus className="h-4 w-4" /> Invite Team
    </Button>
  </Link>
));
InviteTeamButtonInternal.displayName = "InviteTeamButtonInternal";

const SignInButtonInternal = memo(() => (
  <div className="flex items-center gap-3">
    <Link href="/login">
      <Button
        variant="outline"
        className="rounded-none border border-white/20 text-[#0d0d0b] bg-white hover:bg-slate-50 font-semibold px-8 py-2.5"
      >
        Log in
      </Button>
    </Link>
  </div>
));
SignInButtonInternal.displayName = "SignInButtonInternal";
