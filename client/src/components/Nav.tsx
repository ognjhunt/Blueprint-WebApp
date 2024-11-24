import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Link } from "wouter";

export default function Nav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
            <span className="text-2xl font-bold text-primary">Blueprint</span>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <Link href="/pricing" className="text-sm font-medium hover:text-primary transition-colors">Pricing</Link>
            <div className="flex items-center space-x-2">
              <Link href="/dashboard"><Button variant="outline">Dashboard</Button></Link>
              <Link href="/create-blueprint"><Button>Create Blueprint</Button></Link>
              <Link href="/claim-blueprint"><Button variant="outline">Claim Blueprint</Button></Link>
            </div>
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
              <Link href="/pricing" className="text-sm font-medium hover:text-primary transition-colors">Pricing</Link>
              <Link href="/dashboard" className="w-full"><Button variant="outline" className="w-full mb-2">Dashboard</Button></Link>
              <Link href="/create-blueprint" className="w-full"><Button className="w-full mb-2">Create Blueprint</Button></Link>
              <Link href="/claim-blueprint" className="w-full"><Button variant="outline" className="w-full">Claim Blueprint</Button></Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
