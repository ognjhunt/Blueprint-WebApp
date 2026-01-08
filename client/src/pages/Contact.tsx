import { ContactForm } from "@/components/site/ContactForm";
import { SEO } from "@/components/SEO";

export default function Contact() {
  return (
    <>
      <SEO
        title="Contact Us"
        description="Get in touch with Blueprint to discuss your robotics simulation needs. We offer SimReady scenes, data from Genie Sim 3.0, and comprehensive evaluation services."
        canonical="/contact"
      />
      <div className="min-h-screen bg-black">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
            {/* Left Column - Form */}
            <div className="space-y-8">
              <ContactForm />
            </div>

            {/* Right Column - Message */}
            <div className="flex flex-col justify-center space-y-8 lg:pl-8">
              <div className="space-y-6">
                <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
                  Build better robots with Blueprint
                </h1>
                <p className="text-lg leading-relaxed text-zinc-400">
                  From high-fidelity simulation scenes to synthetic data generation
                  and comprehensive evaluation tools, Blueprint provides everything
                  you need to accelerate your embodied AI development.
                </p>
                <p className="text-lg leading-relaxed text-zinc-400">
                  Fill out the form and our team will get back to you within 24 hours
                  to discuss how we can support your project.
                </p>
              </div>

              {/* Contact Info */}
              <div className="space-y-4 border-t border-zinc-800 pt-8">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                  Prefer to email directly?
                </h3>
                <a
                  href="mailto:hello@tryblueprint.io"
                  className="inline-block text-lg font-medium text-emerald-400 transition hover:text-emerald-300"
                >
                  hello@tryblueprint.io
                </a>
              </div>

              {/* Quick Links */}
              <div className="space-y-4 border-t border-zinc-800 pt-8">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                  Learn More
                </h3>
                <ul className="space-y-3">
                  <li>
                    <a
                      href="/evals"
                      className="text-zinc-400 transition hover:text-white"
                    >
                      Evaluation Services →
                    </a>
                  </li>
                  <li>
                    <a
                      href="/portal"
                      className="text-zinc-400 transition hover:text-white"
                    >
                      Scene Marketplace →
                    </a>
                  </li>
                  <li>
                    <a
                      href="/blog"
                      className="text-zinc-400 transition hover:text-white"
                    >
                      Blog & Resources →
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
