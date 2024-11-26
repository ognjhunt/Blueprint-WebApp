import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import Nav from "@/components/Nav";
import Hero from "@/components/sections/Hero";
import Benefits from "@/components/sections/Benefits";
import ContactForm from "@/components/sections/ContactForm";
import Footer from "@/components/Footer";

export default function Home() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (currentUser) {
      setLocation('/dashboard');
    }
  }, [currentUser, setLocation]);

  return (
    <div className="min-h-screen">
      <Nav />
      <main>
        <Hero />
        <Benefits />
        <ContactForm />
      </main>
      <Footer />
    </div>
  );
}
