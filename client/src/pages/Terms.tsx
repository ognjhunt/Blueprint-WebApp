export default function Terms() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 pb-24 pt-16 sm:px-6">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Legal
        </p>
        <h1 className="text-4xl font-semibold text-slate-900">Terms of Service</h1>
        <p className="text-sm text-slate-600">
          Updated December 2024. These terms govern your access to and use of Blueprint’s services, including environment access, on-site capture, and supporting software.
        </p>
      </header>
      <section className="space-y-3 text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">1. Services</h2>
        <p>Blueprint provides procedural/synthetic scene data, SimReady finishing, and on-site capture services as described in project agreements.</p>
        <p>
          Procedural deliverables are derived from real-world references (such as kitchens, warehouses, utility rooms, and
          residential settings) to maintain the spatial fidelity and diversity required for robotics training datasets.
        </p>
        <p>Deliverables include USD assets, textures, documentation, and related metadata as specified in the SOW.</p>
      </section>
      <section className="space-y-3 text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">2. Customer responsibilities</h2>
        <p>Provide accurate requirements, timelines, and access to reference data. Ensure you have rights to all materials supplied to Blueprint.</p>
        <p>Use deliverables in compliance with applicable laws and safety standards.</p>
      </section>
      <section className="space-y-3 text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">3. Payment</h2>
        <p>Project fees are defined in the SOW or order form. Invoices are due within 30 days unless otherwise stated.</p>
        <p>Late payments may incur finance charges or suspension of services.</p>
      </section>
      <section className="space-y-3 text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">4. Intellectual property</h2>
        <p>Blueprint retains ownership of pre-existing IP, tooling, and workflows. Customers receive a license to use delivered assets per the project agreement.</p>
        <p>Custom deliverables may be subject to additional licensing terms defined in the SOW.</p>
      </section>
      <section className="space-y-3 text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">5. Confidentiality</h2>
        <p>Both parties agree to protect confidential information and use it solely for the purpose of the project.</p>
      </section>
      <section className="space-y-3 text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">6. Limitation of liability</h2>
        <p>Blueprint is not liable for indirect or consequential damages. Liability is capped at the fees paid for the applicable services.</p>
      </section>
      <section className="space-y-3 text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">7. Contact</h2>
        <p>Questions about these terms? Email legal@tryblueprint.io.</p>
      </section>
    </div>
  );
}
