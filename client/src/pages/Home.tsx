import Nav from "@/components/Nav";
import Hero from "@/components/sections/Hero";
import Benefits from "@/components/sections/Benefits";
import ContactForm from "@/components/sections/ContactForm";
import Footer from "@/components/Footer";

export default function Home() {
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
