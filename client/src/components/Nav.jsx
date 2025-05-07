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
import { Menu, X, User, UserPlus } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// Removed TypeScript type definition for NavProps

// Helper function to get initials - Removed TypeScript type annotations
const getInitials = (name) => {
  // Add a default value for name if it's undefined or null
  if (!name) return "";
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean) // Handles multiple spaces or empty parts
    .slice(0, 2) // Limit to 2 initials
    .join("")
    .toUpperCase();
};

export default function Nav({ blueprintTitle }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { currentUser, userData, logout } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [matchEditor] = useRoute("/blueprint-editor/:rest*");
  const isBlueprintEditorPage = Boolean(matchEditor);

  // Track scroll for styling
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Sign out logic
  const handleSignOut = async () => {
    try {
      await logout();
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
      setLocation("/");
    } catch (error) {
      console.error("Sign out error:", error); // Log the error for debugging
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Calculate user initials using the helper function
  // Ensure userData exists before accessing its properties
  const userInitials = getInitials(userData?.name || userData?.displayName);

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-50 h-20 transition-all duration-300 ${
        isScrolled ? "bg-white/90 backdrop-blur-md shadow-sm" : "bg-transparent"
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Container - Full width with controlled padding */}
      <div className="flex items-center justify-between h-full w-full px-6 md:px-12 lg:px-16">
        {/* LEFT: Brand logo and name */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center space-x-2 group">
            <div
              className={`w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center transition-all duration-300 shadow-md group-hover:shadow-indigo-200/50 ${isScrolled ? "scale-90" : ""}`}
            >
              {/* SVG Logo */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="white"
                className="w-6 h-6"
              >
                <path d="M11.7 2.805a.75.75 0 01.6 0A60.65 60.65 0 0122.83 8.72a.75.75 0 01-.231 1.337 49.949 49.949 0 00-9.902 3.912l-.003.002-.34.18a.75.75 0 01-.707 0A50.009 50.009 0 007.5 12.174v-.224c0-.131.067-.248.172-.311a54.614 54.614 0 014.653-2.52.75.75 0 00-.65-1.352 56.129 56.129 0 00-4.78 2.589 1.858 1.858 0 00-.859 1.228 49.803 49.803 0 00-4.634-1.527.75.75 0 01-.231-1.337A60.653 60.653 0 0111.7 2.805z" />
                <path d="M13.06 15.473a48.45 48.45 0 017.666-3.282c.134 1.414.22 2.843.255 4.285a.75.75 0 01-.46.71 47.878 47.878 0 00-8.105 4.342.75.75 0 01-.832 0 47.877 47.877 0 00-8.104-4.342.75.75 0 01-.461-.71c.035-1.442.121-2.87.255-4.286A48.4 48.4 0 016 13.18v1.27a1.5 1.5 0 00-.14 2.508c-.09.38-.222.753-.397 1.11.452.213.901.434 1.346.661a6.729 6.729 0 00.551-1.608 1.5 1.5 0 00.14-2.67v-.645a48.549 48.549 0 013.44 1.668 2.25 2.25 0 002.12 0z" />
                <path d="M4.462 19.462c.42-.419.753-.89 1-1.394.453.213.902.434 1.347.661a6.743 6.743 0 01-1.286 1.794.75.75 0 11-1.06-1.06z" />
              </svg>
            </div>
            <span
              className={`text-xl font-bold transition-colors duration-300 ${
                isScrolled
                  ? "bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent"
                  : "bg-gradient-to-r from-indigo-700 to-violet-700 bg-clip-text text-transparent"
              }`}
            >
              Blueprint
            </span>
          </Link>
        </div>

        {/* CENTER: Blueprint title (if provided) */}
        <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2">
          {blueprintTitle && (
            <motion.span
              className={`text-sm font-medium px-4 py-2 rounded-full ${
                isScrolled
                  ? "bg-indigo-50 text-indigo-700"
                  : "bg-white/80 backdrop-blur-sm text-indigo-700 shadow-sm"
              }`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {blueprintTitle}
            </motion.span>
          )}
        </div>

        {/* RIGHT: Desktop menu and user profile */}
        <div className="hidden md:flex items-center">
          {/* Pricing Link */}
          <Link href="/pricing">
            <motion.span
              className={`text-sm font-medium transition-colors duration-300 relative group mr-6 ${
                isScrolled ? "text-gray-700" : "text-gray-800"
              }`}
              whileHover={{ scale: 1.02 }}
            >
              Pricing
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-indigo-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
            </motion.span>
          </Link>

          <Link href="/pilot-program">
            <motion.span
              className={`text-sm font-medium transition-colors duration-300 relative group mr-6 ${
                isScrolled ? "text-gray-700" : "text-gray-800"
              }`}
              whileHover={{ scale: 1.02 }}
            >
              Pilot&nbsp;Program
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-indigo-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
            </motion.span>
          </Link>

          {/* Conditional links/buttons for logged-in users */}
          {currentUser && (
            <>
              {/* Scanner Portal Link */}
              <Link href="/scanner-portal">
                <motion.span
                  className={`text-sm font-medium transition-colors duration-300 relative group mr-6 ${
                    isScrolled ? "text-gray-700" : "text-gray-800"
                  }`}
                  whileHover={{ scale: 1.02 }}
                >
                  Scanner Portal
                  <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-indigo-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
                </motion.span>
              </Link>

              {/* Invite Button (linking to workspace) */}
              <Link href="/workspace" className="mr-4">
                <Button
                  variant="default"
                  className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md hover:shadow-indigo-200/50 transition-all duration-300 flex items-center gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  Invite
                </Button>
              </Link>
            </>
          )}

          {/* Conditional Sign In button or User Menu */}
          {!currentUser ? (
            <Link href="/sign-in">
              <Button
                variant="default"
                className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md hover:shadow-indigo-200/50 hover:scale-105 transition-all duration-300"
              >
                Sign In
              </Button>
            </Link>
          ) : (
            <div className="flex items-center space-x-4">
              {/* Dashboard Button (conditional based on location) */}
              {location !== "/dashboard" && (
                <Link href="/dashboard">
                  <Button
                    variant="outline"
                    className={`rounded-full border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors duration-300 ${
                      isScrolled ? "text-gray-700" : "text-gray-800"
                    }`}
                  >
                    Dashboard
                  </Button>
                </Link>
              )}

              {/* User dropdown menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={`relative h-10 w-10 p-0 rounded-full overflow-hidden ring-2 ${
                      isScrolled ? "ring-indigo-200" : "ring-white"
                    } hover:ring-indigo-300 transition-all duration-300 shadow-sm hover:shadow-md`}
                    aria-label="User menu"
                  >
                    <Avatar className="h-10 w-10">
                      {/* User image or fallback */}
                      <AvatarImage
                        src={userData?.photoURL || ""}
                        alt={
                          userData?.name ||
                          userData?.displayName ||
                          "User Profile"
                        }
                        // Add an onerror handler for better fallback
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                      <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-500 text-white font-semibold text-sm">
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
                  className="w-56 p-2 rounded-xl shadow-lg border border-indigo-100"
                >
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {userData?.name || userData?.displayName || "User"}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {currentUser?.email || "No email"}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {/* Settings Link */}
                  <Link href="/settings">
                    <DropdownMenuItem className="cursor-pointer hover:bg-indigo-50 rounded-md transition-colors">
                      Settings
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator />
                  {/* Sign Out Item */}
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="cursor-pointer hover:bg-red-50 text-red-600 hover:text-red-700 rounded-md transition-colors"
                  >
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
        >
          <motion.div
            initial={false}
            animate={{ rotate: isMobileMenuOpen ? 90 : 0 }}
            transition={{ duration: 0.3 }}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </motion.div>
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            className="md:hidden absolute top-full left-0 right-0 bg-white/95 backdrop-blur-md shadow-lg rounded-b-2xl border-t border-indigo-50 overflow-hidden" // Added overflow-hidden
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="p-6 flex flex-col space-y-5">
              {/* Blueprint title (on mobile) */}
              {blueprintTitle && (
                <div className="text-center py-2 px-4 bg-indigo-50 rounded-xl border border-indigo-100">
                  <span className="text-sm font-medium text-indigo-700">
                    {blueprintTitle}
                  </span>
                </div>
              )}

              {/* Mobile Menu Links/Buttons */}
              <Link
                href="/pricing"
                className="w-full"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <div className="text-gray-700 hover:text-indigo-600 text-sm font-medium py-3 px-4 hover:bg-indigo-50/50 rounded-xl transition-colors duration-200 text-center">
                  Pricing
                </div>
              </Link>

              <Link href="/pilot-program">
                <motion.span
                  className={`text-sm font-medium transition-colors duration-300 relative group mr-6 ${
                    isScrolled ? "text-gray-700" : "text-gray-800"
                  }`}
                  whileHover={{ scale: 1.02 }}
                >
                  Pilot&nbsp;Program
                  <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-indigo-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
                </motion.span>
              </Link>

              {currentUser && (
                <>
                  <Link
                    href="/scanner-portal"
                    className="w-full"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <div className="text-gray-700 hover:text-indigo-600 text-sm font-medium py-3 px-4 hover:bg-indigo-50/50 rounded-xl transition-colors duration-200 text-center">
                      Scanner Portal
                    </div>
                  </Link>
                  {/* Updated Invite button link to workspace */}
                  <Link
                    href="/workspace"
                    className="w-full"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Button
                      variant="default"
                      className="w-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md hover:shadow-indigo-200/50 transition-all duration-300 flex items-center justify-center gap-2 py-3" // Added justify-center and py-3
                    >
                      <UserPlus className="h-4 w-4" />
                      Invite
                    </Button>
                  </Link>
                </>
              )}

              {!currentUser ? (
                <Link
                  href="/sign-in"
                  className="w-full"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Button className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md">
                    {" "}
                    {/* Adjusted padding */}
                    Sign In
                  </Button>
                </Link>
              ) : (
                <>
                  {/* Dashboard Link */}
                  <Link
                    href="/dashboard"
                    className="w-full"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Button
                      variant="outline"
                      className="w-full py-3 rounded-xl border-indigo-200" // Adjusted padding
                    >
                      Dashboard
                    </Button>
                  </Link>
                  {/* Settings Link */}
                  <Link
                    href="/settings"
                    className="w-full"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <div className="text-gray-700 hover:text-indigo-600 text-sm font-medium py-3 px-4 hover:bg-indigo-50/50 rounded-xl transition-colors duration-200 text-center">
                      Settings
                    </div>
                  </Link>
                  {/* Sign Out Button */}
                  <Button
                    variant="outline"
                    className="w-full py-3 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" // Adjusted padding
                    onClick={() => {
                      handleSignOut();
                      setIsMobileMenuOpen(false); // Close menu on sign out
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
