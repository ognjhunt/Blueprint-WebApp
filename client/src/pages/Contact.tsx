import { ContactForm } from "@/components/site/ContactForm";

export default function Contact() {
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 pb-24 pt-16 sm:px-6">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Real-world capture + marketplace wishlist
        </p>
        <h1 className="text-4xl font-semibold text-slate-900">
          Scan the site you care about or steer the next drop.
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Most teams land here to book a real-world SimReady capture. We send a
          crew, scan your facility, and hand back a validated USD/URDF scene so
          you can tune policies against the layout you actually deploy. If
          you’re primarily buying synthetic data, use the wishlist path to tell
          us which policy, object, or location types you need most—the signal
          helps decide the next drops.
        </p>
      </header>
      <ContactForm />
    </div>
  );
}
