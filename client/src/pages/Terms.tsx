import { SEO } from "@/components/SEO";

export default function Terms() {
  return (
    <>
      <SEO
        title="Terms of Service"
        description="Blueprint's terms of service governing access to environment data, on-site capture, and supporting software services."
        canonical="/terms"
      />
      <div className="mx-auto max-w-4xl space-y-8 px-4 pb-24 pt-16 sm:px-6">
        <header className="space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Legal
          </p>
        <h1 className="text-4xl font-semibold text-slate-900">Terms of Service</h1>
        <p className="text-sm text-slate-600">
          <span className="font-medium">Effective Date:</span> December 31, 2024. <span className="font-medium">Last Updated:</span> December 31, 2024.
        </p>
        <p className="text-sm text-slate-600">
          These terms govern your access to and use of Blueprint's services, including environment access, on-site capture, and supporting software.
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
        <h2 className="text-lg font-semibold text-slate-900">3. Payment & Refunds</h2>
        <p>Project fees are defined in the SOW or order form. Invoices are due within 30 days unless otherwise stated.</p>
        <p>Late payments may incur finance charges or suspension of services.</p>
        <p className="font-medium text-slate-700">All sales are final. Due to the nature of digital deliverables and custom scene work, Blueprint does not offer refunds or credits once an order is confirmed or work has commenced. By completing a purchase, you acknowledge and agree to this no-refund policy.</p>
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
        <h2 className="text-lg font-semibold text-slate-900">7. Governing law</h2>
        <p>These Terms of Service shall be governed by and construed in accordance with the laws of the State of North Carolina, United States, without regard to its conflict of law provisions.</p>
        <p>You agree that any legal action or proceeding arising out of or relating to these Terms or your use of the Services shall be brought exclusively in the state or federal courts located in Durham County, North Carolina.</p>
      </section>
      <section className="space-y-3 text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">8. Dispute resolution</h2>
        <p>In the event of any dispute arising out of or relating to these Terms or the Services, the parties agree to first attempt to resolve the dispute through good-faith negotiation for a period of thirty (30) days.</p>
        <p>If the dispute cannot be resolved through negotiation, either party may pursue binding arbitration administered by the American Arbitration Association (AAA) under its Commercial Arbitration Rules. The arbitration shall take place in Durham, North Carolina.</p>
        <p>Notwithstanding the above, either party may seek injunctive or other equitable relief in any court of competent jurisdiction to protect its intellectual property rights or confidential information.</p>
      </section>
      <section className="space-y-3 text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">9. Warranty disclaimer</h2>
        <p>The Services are provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.</p>
        <p>Blueprint does not warrant that the Services will be uninterrupted, error-free, or completely secure.</p>
      </section>
      <section className="space-y-3 text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">10. Contact</h2>
        <p>Questions about these terms? Email legal@tryblueprint.io.</p>
      </section>
    </div>
    </>
  );
}
