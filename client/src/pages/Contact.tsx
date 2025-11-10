import { ContactForm } from "@/components/site/ContactForm";

export default function Contact() {
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 pb-24 pt-16 sm:px-6">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Contact Blueprint</p>
        <h1 className="text-4xl font-semibold text-slate-900">
          Start with the dataset your lab actually needs.
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Most robotics teams ask for coverage across kitchens, warehouses, labs, and guest spaces—not just a single demo
          room. Choose the path that fits your request and we’ll follow up within one business day with scope, pricing, and
          delivery expectations.
        </p>
      </header>
      <ContactForm />
    </div>
  );
}
