import { ContactForm } from "@/components/site/ContactForm";
import { environmentPolicies } from "@/data/content";

export default function Contact() {
  const corePolicies = environmentPolicies.slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 pb-24 pt-16 sm:px-6">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Build your training coverage
        </p>
        <h1 className="text-4xl font-semibold text-slate-900">
          Start with the dataset your lab actually needs.
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Labs are tuning the same manipulation families everyone is
          benchmarking going into 2025 and 2026—dexterous pick- place,
          articulated access, panel interaction, mixed-SKU logistics, and
          precision insertion. That’s why we lead with dataset programs that hit
          those policy tracks while still making it easy to request a specific
          kitchen, warehouse aisle, or other hero scene. Share what your robot
          needs and we’ll align on scope, delivery, and budget within one
          business day.
        </p>
      </header>
      <ContactForm />
    </div>
  );
}
