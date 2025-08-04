// This file defines the Nav component, which is the main navigation bar for the application.
// It handles displaying navigation links, user authentication status, and a mobile menu.
// It also shows a dynamic title when the `blueprintTitle` prop is provided.

import React, { useState, useEffect } from "react";
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
import { Menu, X, User, UserPlus, Sparkles, Zap } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Generates initials from a given name.
 * @param {string} name - The full name.
 * @returns {string} The initials (e.g., "JD" for "John Doe").
 */
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

/**
 * The Nav component is the main navigation bar for the application.
 * It handles displaying navigation links, user authentication status, and a mobile menu.
 * It also shows a dynamic title when the `blueprintTitle` prop is provided.
 *
 * @param {object} props - The component's props.
 * @param {string} [props.blueprintTitle] - An optional title to display in the center of the nav bar.
 * @returns {JSX.Element} The rendered Nav component.
 */
export default function Nav({
  blueprintTitle,
  hideAuthenticatedFeatures = false,
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { currentUser, userData, logout } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [matchEditor] = useRoute("/blueprint-editor/:rest*");
  const isBlueprintEditorPage = Boolean(matchEditor);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /**
   * Handles the user sign-out process.
   * It calls the logout function from the AuthContext, shows a toast notification,
   * and redirects the user to the home page.
   */
  const handleSignOut = async () => {
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
  };

  const userInitials = getInitials(userData?.name || userData?.displayName);

  const navLinks = [
    { href: "/pilot-program", label: "Pilot Program", badge: "New" },
    // Only show authenticated nav links if not hiding authenticated features
    ...(currentUser && !hideAuthenticatedFeatures
      ? [
          { href: "/scanner-portal", label: "Scanner Portal" },
          { href: "/pricing", label: "Pricing" },
        ]
      : []),
  ];

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-50 h-20 transition-all duration-500 ${
        isScrolled
          ? "bg-white/95 backdrop-blur-xl shadow-lg border-b border-slate-200/50"
          : "bg-transparent"
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="flex items-center justify-between h-full w-full px-6 md:px-8 lg:px-12">
        {/* Enhanced brand logo */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden transition-all duration-300 shadow-lg">
                <img
                  src="/gradientBPLogo.png"
                  alt="Blueprint Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              {/* <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-300 to-indigo-300 inline-block text-transparent bg-clip-text">
                Blueprint
              </h3> */}
            </div>
            <span
              className={`text-2xl font-black transition-all duration-300 ${
                isScrolled
                  ? "bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent"
                  : "bg-gradient-to-r from-slate-900 to-indigo-800 bg-clip-text text-transparent"
              }`}
            >
              Blueprint
            </span>
          </Link>
        </div>

        {/* Center: Blueprint title (enhanced) */}
        <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2">
          {blueprintTitle && (
            <motion.div
              className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full ${
                isScrolled
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                  : "bg-white/90 backdrop-blur-sm text-indigo-700 shadow-lg border border-white/20"
              }`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Sparkles className="w-4 h-4" />
              {blueprintTitle}
            </motion.div>
          )}
        </div>

        {/* Desktop navigation */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <motion.div
                className={`text-sm font-semibold transition-all duration-300 relative group flex items-center gap-2 ${
                  isScrolled ? "text-slate-700" : "text-slate-800"
                }`}
                whileHover={{ scale: 1.05 }}
              >
                {link.label}
                {link.badge && (
                  <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                    {link.badge}
                  </span>
                )}
                <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-full"></span>
              </motion.div>
            </Link>
          ))}
          {/* Only show Invite Team button if authenticated and not hiding features */}
          {currentUser && !hideAuthenticatedFeatures && (
            <Link href="/workspace" className="mr-2">
              <Button
                variant="default"
                className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg hover:shadow-indigo-200/50 transition-all duration-300 flex items-center gap-2 px-4 py-2"
              >
                <UserPlus className="h-4 w-4" />
                Invite Team
              </Button>
            </Link>
          )}
          {!currentUser ? null : (
            // <Link href="/sign-in">
            //   <Button
            //     variant="default"
            //     className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg hover:shadow-indigo-200/50 hover:scale-105 transition-all duration-300 px-6 py-2 font-semibold"
            //   >
            //     Sign In
            //   </Button>
            // </Link>
            <div className="flex items-center space-x-4">
              {/* Only show Dashboard button and other features if not hiding authenticated features */}
              {!hideAuthenticatedFeatures && location !== "/dashboard" && (
                <Link href="/dashboard">
                  <Button
                    variant="outline"
                    className={`rounded-full border-2 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all duration-300 font-medium ${
                      isScrolled
                        ? "border-slate-200 text-slate-700"
                        : "border-slate-300 text-slate-800"
                    }`}
                  >
                    Dashboard
                  </Button>
                </Link>
              )}

              {/* ALWAYS show user avatar dropdown when logged in */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={`relative h-11 w-11 p-0 rounded-full overflow-hidden ring-2 ${
                      isScrolled ? "ring-indigo-200" : "ring-white"
                    } hover:ring-indigo-300 transition-all duration-300 shadow-lg hover:shadow-xl`}
                    aria-label="User menu"
                  >
                    <Avatar className="h-11 w-11">
                      <AvatarImage
                        src={userData?.photoURL || ""}
                        alt={
                          userData?.name ||
                          userData?.displayName ||
                          "User Profile"
                        }
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                      <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-500 text-white font-bold text-sm">
                        {userInitials ? (
                          userInitials
                        ) : (
                          <User className="h-5 w-5" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-60 p-3 rounded-2xl shadow-xl border border-slate-200 bg-white/95 backdrop-blur-xl"
                >
                  <DropdownMenuLabel className="font-normal p-3 rounded-xl bg-slate-50">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold leading-none text-slate-900">
                        {userData?.name || userData?.displayName || "User"}
                      </p>
                      <p className="text-xs leading-none text-slate-500">
                        {currentUser?.email || "No email"}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="my-2" />
                  {/* Only show Settings if not hiding authenticated features */}
                  {!hideAuthenticatedFeatures && (
                    <>
                      <Link href="/settings">
                        <DropdownMenuItem className="cursor-pointer hover:bg-indigo-50 rounded-xl transition-colors p-3 font-medium">
                          Settings
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuSeparator className="my-2" />
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="cursor-pointer hover:bg-red-50 text-red-600 hover:text-red-700 rounded-xl transition-colors p-3 font-medium"
                  >
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Enhanced mobile menu button */}
        <button
          className="md:hidden flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 shadow-lg border border-indigo-100"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
        >
          <motion.div
            initial={false}
            animate={{ rotate: isMobileMenuOpen ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </motion.div>
        </button>
      </div>

      {/* Enhanced mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            className="md:hidden absolute top-full left-0 right-0 bg-white/98 backdrop-blur-xl shadow-2xl rounded-b-3xl border-t border-slate-200/50 overflow-hidden"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="p-6 flex flex-col space-y-4">
              {blueprintTitle && (
                <div className="text-center py-3 px-4 bg-gradient-to-r from-indigo-50 to-violet-50 rounded-2xl border border-indigo-100">
                  <span className="text-sm font-semibold text-indigo-700 flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" />
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
                  <div className="flex items-center justify-between text-slate-700 hover:text-indigo-600 text-sm font-semibold py-4 px-4 hover:bg-indigo-50/50 rounded-2xl transition-all duration-200">
                    <span>{link.label}</span>
                    {link.badge && (
                      <span className="text-xs bg-emerald-500 text-white px-2 py-1 rounded-full">
                        {link.badge}
                      </span>
                    )}
                  </div>
                </Link>
              ))}

              {/* Only show authenticated mobile menu items if not hiding features */}
              {currentUser && !hideAuthenticatedFeatures && (
                <Link
                  href="/workspace"
                  className="w-full"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Button
                    variant="default"
                    className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg hover:shadow-indigo-200/50 transition-all duration-300 flex items-center justify-center gap-2 py-4 font-semibold"
                  >
                    <UserPlus className="h-5 w-5" />
                    Invite Team
                  </Button>
                </Link>
              )}

              {!currentUser ? null : (
                // <Link
                //   href="/sign-in"
                //   className="w-full"
                //   onClick={() => setIsMobileMenuOpen(false)}
                // >
                //   <Button className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg font-semibold">
                //     Sign In
                //   </Button>
                // </Link>
                <>
                  {/* Only show Dashboard if not hiding authenticated features */}
                  {!hideAuthenticatedFeatures && (
                    <Link
                      href="/dashboard"
                      className="w-full"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Button
                        variant="outline"
                        className="w-full py-4 rounded-2xl border-2 border-slate-200 font-semibold"
                      >
                        Dashboard
                      </Button>
                    </Link>
                  )}

                  {/* Only show Settings if not hiding authenticated features */}
                  {!hideAuthenticatedFeatures && (
                    <Link
                      href="/settings"
                      className="w-full"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <div className="text-slate-700 hover:text-indigo-600 text-sm font-semibold py-4 px-4 hover:bg-indigo-50/50 rounded-2xl transition-colors duration-200 text-center">
                        Settings
                      </div>
                    </Link>
                  )}

                  {/* ALWAYS show Sign Out when logged in */}
                  <Button
                    variant="outline"
                    className="w-full py-4 rounded-2xl border-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-semibold"
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
