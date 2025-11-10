import { ContactForm } from "@/components/site/ContactForm";

export default function Contact() {
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 pb-24 pt-16 sm:px-6">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Request a scene
        </p>
        <h1 className="text-4xl font-semibold text-slate-900">
          Tell us what your robot needs to practice.
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Share your target policies, categories, and delivery timeline. We’ll follow up within one business day with scope, pricing, and draft coverage.
        </p>
      </header>
      <ContactForm />
    </div>
  );
}
