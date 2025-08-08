import React from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function Privacy() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white to-indigo-50">
      <Nav />
      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-24 text-slate-700">
        <h1 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
          Privacy Policy
        </h1>
        <section className="prose prose-slate max-w-none space-y-6">
          <p>
            Your privacy is important to us. This policy outlines how Blueprint
            collects, uses, and protects your information when you use our
            services.
          </p>
          <p>
            We only collect data necessary to deliver and improve the Blueprint
            experience. We never sell your data and we strive to use industry
            best practices to safeguard the information you share with us.
          </p>
          <p>
            If you have any questions about this policy, please contact us at
            <a href="mailto:support@blueprint.com"> support@blueprint.com </a>.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
