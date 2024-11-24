import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { Menu, X, Search, User } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function Nav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true); // Default to true for now
  const { toast } = useToast();

  const handleSignOut = async () => {
    setIsAuthenticated(false);
    toast({
      title: "Signed Out",
      description: "You have been successfully signed out.",
    });
    // Add small delay before redirect
    setTimeout(() => {
      window.location.href = "/";
    }, 1500);
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed w-full z-50 transition-all duration-300 ${
        isScrolled ? "bg-white/90 backdrop-blur-sm shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-2xl font-bold text-primary hover:opacity-80 transition-opacity">
              Blueprint
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <Link href="/search" className="text-sm font-medium hover:text-primary transition-colors flex items-center">
              <Search className="w-4 h-4 mr-1" />
              Search
            </Link>
            <Link href="/pricing" className="text-sm font-medium hover:text-primary transition-colors">
              Pricing
            </Link>
            {isAuthenticated ? (
              <>
                <Link href="/dashboard">
                  <Button variant="outline">Dashboard</Button>
                </Link>
                <Link href="/create-blueprint">
                  <Button>Create Blueprint</Button>
                </Link>
                <Link href="/claim-blueprint">
                  <Button variant="outline">Claim Blueprint</Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src="/avatars/01.png" alt="Profile" />
                        <AvatarFallback>
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <Link href="/profile">
                      <DropdownMenuItem>Profile</DropdownMenuItem>
                    </Link>
                    <Link href="/settings">
                      <DropdownMenuItem>Settings</DropdownMenuItem>
                    </Link>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button onClick={() => {/* Add auth flow later */}} variant="outline">
                Sign In / Create Account
              </Button>
            )}
          </div>

          <button
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden py-4">
            <div className="flex flex-col space-y-4">
              <Link href="/search" className="text-sm font-medium hover:text-primary transition-colors flex items-center">
                <Search className="w-4 h-4 mr-1" />
                Search
              </Link>
              <Link href="/pricing" className="text-sm font-medium hover:text-primary transition-colors">
                Pricing
              </Link>
              {isAuthenticated ? (
                <>
                  <Link href="/dashboard" className="w-full">
                    <Button variant="outline" className="w-full mb-2">Dashboard</Button>
                  </Link>
                  <Link href="/create-blueprint" className="w-full">
                    <Button className="w-full mb-2">Create Blueprint</Button>
                  </Link>
                  <Link href="/claim-blueprint" className="w-full">
                    <Button variant="outline" className="w-full">Claim Blueprint</Button>
                  </Link>
                  <Link href="/profile" className="w-full">
                    <Button variant="outline" className="w-full mb-2">Profile</Button>
                  </Link>
                  <Link href="/settings" className="w-full">
                    <Button variant="outline" className="w-full mb-2">Settings</Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handleSignOut}
                  >
                    Sign Out
                  </Button>
                </>
              ) : (
                <Button 
                  onClick={() => {/* Add auth flow later */}} 
                  variant="outline"
                  className="w-full"
                >
                  Sign In / Create Account
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
