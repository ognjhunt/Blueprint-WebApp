import { ContactForm } from "@/components/site/ContactForm";

export default function Contact() {
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 pb-24 pt-16 sm:px-6">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Build your training coverage</p>
        <h1 className="text-4xl font-semibold text-slate-900">
          Start with the dataset your lab actually needs.
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Labs typically need breadth—multiple layouts, articulation types, and semantic layers to keep policies robust. That’s
          why we lead with dataset programs, while still making it easy to request a specific kitchen, warehouse aisle, or
          other scene when you’re scoping a pilot. Share what your robot needs and we’ll align on scope, delivery, and budget
          within one business day.
        </p>
      </header>
      <ContactForm />
    </div>
  );
}