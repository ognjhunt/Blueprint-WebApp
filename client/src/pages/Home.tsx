import Nav from "@/components/Nav";
import Hero from "@/components/sections/Hero";
import Benefits from "@/components/sections/Benefits";
import UseCases from "@/components/sections/UseCases";
import ROICalculator from "@/components/sections/ROICalculator";
import CaseStudies from "@/components/sections/CaseStudies";
import ContactForm from "@/components/sections/ContactForm";
import Footer from "@/components/Footer";
import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll(".scroll-section").forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen">
      <Nav />
      <main>
        <Hero />
        <Benefits />
        <UseCases />
        <ROICalculator />
        <CaseStudies />
        <ContactForm />
      </main>
      <Footer />
    </div>
  );
}
