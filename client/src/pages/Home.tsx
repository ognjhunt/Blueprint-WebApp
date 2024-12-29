import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import Nav from "@/components/Nav";
import Hero from "@/components/sections/Hero";
import Benefits from "@/components/sections/Benefits";
import ContactForm from "@/components/sections/ContactForm";
import Footer from "@/components/Footer";
import AIChatButton from "@/components/AIChatButton";
import { motion } from "framer-motion";

export default function Home() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (currentUser) {
      setLocation("/dashboard");
    }
  }, [currentUser, setLocation]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Background Decoration */}
      <motion.div
        className="fixed inset-0 z-[-1] bg-gradient-to-b from-white to-blue-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      />

      <Nav />

      <main className="flex-1">
        <Hero />
        <Benefits />
        <ContactForm />
      </main>

      <Footer />

      <AIChatButton />
    </div>
  );
}
