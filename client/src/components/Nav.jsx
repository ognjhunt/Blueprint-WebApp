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
import { Menu, X, User, UserPlus, Sparkles } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

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

  const userInitials = getInitials(userData?.name || userData?.displayName);

  const navLinks = [
    { href: "/blog", label: "Blog" },
    { href: "/venue-materials", label: "Venues" },
    { href: "/pilot-program", label: "Pilot Program", badge: "New" },
    // Show these only if authenticated and not hidden
    ...(currentUser && !hideAuthenticatedFeatures
      ? [
          { href: "/scanner-portal", label: "Scanner Portal" },
          { href: "/pricing", label: "Pricing" },
        ]
      : []),
  ];

  return (
    <motion.nav
      role="navigation"
      aria-label="Primary"
      className={`fixed top-0 left-0 right-0 z-50 h-16 md:h-20 transition-all duration-500 ${
        isScrolled
          ? "bg-slate-900/85 backdrop-blur-xl border-b border-slate-800 shadow-[0_1px_0_0_rgba(255,255,255,0.04)]"
          : "bg-transparent"
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="flex items-center justify-between h-full w-full px-4 md:px-6 lg:px-10">
        {/* Brand */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center space-x-3 group">
            <img
              src="/gradientBPLogo.png"
              alt="Blueprint logo"
              className={`w-9 h-9 md:w-10 md:h-10 rounded-xl shadow-lg transition-transform ${isScrolled ? "scale-95" : ""}`}
            />
            <span
              className={`text-xl md:text-2xl font-black tracking-tight bg-clip-text text-transparent ${
                isScrolled
                  ? "bg-gradient-to-r from-slate-200 to-slate-300"
                  : "bg-gradient-to-r from-white to-slate-200"
              }`}
            >
              Blueprint
            </span>
          </Link>
        </div>

        {/* Center title */}
        <div className="hidden md:block absolute left-1/2 -translate-x-1/2">
          {blueprintTitle && (
            <motion.div
              className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full border ${
                isScrolled
                  ? "bg-slate-800/80 text-emerald-300 border-slate-700"
                  : "bg-slate-900/60 text-emerald-300 border-slate-800/60 backdrop-blur"
              }`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Sparkles className="w-4 h-4" /> {blueprintTitle}
            </motion.div>
          )}
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <motion.div
                className={`text-sm font-semibold relative group flex items-center gap-2 ${
                  isScrolled ? "text-slate-200" : "text-white"
                }`}
                whileHover={{ scale: 1.05 }}
              >
                {link.label}
                {link.badge && (
                  <span className="text-[10px] leading-none bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                    {link.badge}
                  </span>
                )}
                <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-400 to-cyan-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-full" />
              </motion.div>
            </Link>
          ))}

          {/* Invite Team if logged in */}
          {/* {currentUser && !hideAuthenticatedFeatures && (
            <InviteTeamButtonInternal />
          )} */}

          {/* Auth controls */}
          {!currentUser ? (
            <SignInButtonInternal />
          ) : (
            <div className="flex items-center gap-3">
              {/* {!hideAuthenticatedFeatures && path !== "/dashboard" && (
                <Link href="/dashboard">
                  <Button
                    variant="outline"
                    className="rounded-full border-2 border-slate-700 text-slate-200 hover:border-emerald-400/60 hover:bg-slate-800/50"
                  >
                    Dashboard
                  </Button>
                </Link>
              )} */}

              {/* Avatar dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={`relative h-10 w-10 p-0 rounded-full overflow-hidden ring-2 ${
                      isScrolled ? "ring-slate-700" : "ring-slate-600"
                    } hover:ring-emerald-500 transition-all duration-300`}
                    aria-label="User menu"
                  >
                    <UserAvatarDisplay
                      photoURL={userData?.photoURL}
                      name={userData?.name}
                      displayName={userData?.displayName}
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
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-full bg-slate-800/70 text-slate-100 border border-slate-700"
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
            className="md:hidden absolute top-full left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 overflow-hidden"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="p-6 flex flex-col space-y-3">
              {blueprintTitle && (
                <div className="text-center py-3 px-4 bg-slate-800/70 rounded-2xl border border-slate-700">
                  <span className="text-sm font-semibold text-emerald-300 flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" /> {blueprintTitle}
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
                  <div className="flex items-center justify-between text-slate-200 hover:text-white text-sm font-semibold py-4 px-4 hover:bg-slate-800 rounded-xl transition">
                    <span>{link.label}</span>
                    {link.badge && (
                      <span className="text-[10px] bg-emerald-500 text-white px-2 py-1 rounded-full">
                        {link.badge}
                      </span>
                    )}
                  </div>
                </Link>
              ))}

              {/* {currentUser && !hideAuthenticatedFeatures && (
                <Link
                  href="/workspace"
                  className="w-full"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Button className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-900 font-semibold hover:opacity-90">
                    <UserPlus className="h-4 w-4 mr-2" /> Invite Team
                  </Button>
                </Link>
              )} */}

              {!currentUser ? (
                <Link
                  href="/sign-in"
                  className="w-full"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Button className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-900 font-semibold hover:opacity-90">
                    Sign In
                  </Button>
                </Link>
              ) : (
                <>
                  {/* {!hideAuthenticatedFeatures && (
                    <Link
                      href="/dashboard"
                      className="w-full"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Button
                        variant="outline"
                        className="w-full rounded-xl border-2 border-slate-700 text-slate-200"
                      >
                        Dashboard
                      </Button>
                    </Link>
                  )} */}

                  {!hideAuthenticatedFeatures && (
                    <Link
                      href="/settings"
                      className="w-full"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <div className="text-slate-300 hover:text-white text-sm font-semibold py-4 px-4 hover:bg-slate-800 rounded-xl text-center">
                        Settings
                      </div>
                    </Link>
                  )}

                  <Button
                    variant="outline"
                    className="w-full rounded-xl border-2 border-red-300/30 text-red-300 hover:bg-red-500/10"
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
const UserAvatarDisplay = memo(({ photoURL, name, displayName, initials }) => {
  return (
    <Avatar className="h-10 w-10">
      <AvatarImage
        src={photoURL || ""}
        alt={name || displayName || "User Profile"}
        onError={(e) => {
          e.target.style.display = "none";
        }}
      />
      <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-cyan-500 text-slate-900 font-bold text-sm">
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
        className="w-60 p-3 rounded-2xl shadow-xl border border-slate-700 bg-slate-900/95 backdrop-blur-xl text-slate-200"
      >
        <DropdownMenuLabel className="font-normal p-3 rounded-xl bg-slate-800">
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
              <DropdownMenuItem className="cursor-pointer hover:bg-slate-800 rounded-xl p-3 font-medium text-slate-200">
                Settings
              </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator className="my-2 bg-slate-700" />
          </>
        )}
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer hover:bg-red-500/10 text-red-300 rounded-xl p-3 font-medium"
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
    <Button className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-900 font-semibold hover:opacity-90 flex items-center gap-2 px-4 py-2">
      <UserPlus className="h-4 w-4" /> Invite Team
    </Button>
  </Link>
));
InviteTeamButtonInternal.displayName = "InviteTeamButtonInternal";

const SignInButtonInternal = memo(() => (
  <Link href="/sign-in">
    <Button className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-900 font-semibold hover:opacity-90 px-6 py-2">
      Sign In
    </Button>
  </Link>
));
SignInButtonInternal.displayName = "SignInButtonInternal";
