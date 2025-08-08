import React from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function Terms() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white to-indigo-50">
      <Nav />
      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-24 text-slate-700">
        <h1 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
          Terms & Conditions
        </h1>
        <section className="prose prose-slate max-w-none space-y-6">
          <p>
            By using Blueprint's services, you agree to the following terms and
            conditions. Please read them carefully.
          </p>
          <p>
            We provide our platform on an "as is" basis and may update these terms
            from time to time. Continued use of the service constitutes acceptance
            of any changes.
          </p>
          <p>
            If you have questions about these terms, please contact
            <a href="mailto:support@blueprint.com"> support@blueprint.com </a>.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
