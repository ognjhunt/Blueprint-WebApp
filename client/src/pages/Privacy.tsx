import { SEO } from "@/components/SEO";

export default function Privacy() {
  return (
    <>
      <SEO
        title="Privacy Policy"
        description="Blueprint's privacy policy. Learn how we collect, use, and protect your information across tryblueprint.io and related services."
        canonical="/privacy"
      />
      <div className="mx-auto max-w-4xl space-y-8 px-4 pb-24 pt-16 sm:px-6">
        <header className="space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Legal
          </p>
        <h1 className="text-4xl font-semibold text-slate-900">Privacy Policy</h1>
        <p className="text-sm text-slate-600">
          <span className="font-medium">Effective Date:</span> December 31, 2024. <span className="font-medium">Last Updated:</span> December 31, 2024.
        </p>
        <p className="text-sm text-slate-600">
          Blueprint, Inc. ("Blueprint," "we," "us," or "our") respects your privacy. This policy explains how we collect, use, and protect information across tryblueprint.io and related services.
        </p>
      </header>

      <section className="space-y-3 text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">1. Information we collect</h2>
        <p>We collect the following types of information:</p>
        <p>• <strong>Contact details</strong> you submit via forms (name, email, company, project requirements).</p>
        <p>• <strong>Account information</strong> when you create an account (name, email, password, profile details).</p>
        <p>• <strong>Usage data</strong> from our website and applications captured through analytics to improve performance.</p>
        <p>• <strong>Files or assets</strong> you upload for the purpose of generating or finishing scenes.</p>
        <p>• <strong>Payment information</strong> processed through our payment provider (Stripe). We do not store full credit card numbers.</p>
        <p>• <strong>Device and browser information</strong> including IP address, browser type, operating system, and device identifiers.</p>
      </section>

      <section className="space-y-3 text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">2. How we use information</h2>
        <p>We use your information to:</p>
        <p>• Provide proposals, deliver scenes, and communicate about projects.</p>
        <p>• Improve our environment network, tooling, and customer support.</p>
        <p>• Process payments and manage your account.</p>
        <p>• Send product updates or marketing communications (you can opt out at any time).</p>
        <p>• Comply with legal obligations and enforce our terms of service.</p>
        <p>• Detect, prevent, and address technical issues or security threats.</p>
      </section>

      <section className="space-y-3 text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">3. Legal basis for processing (GDPR)</h2>
        <p>If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland, we process your personal data based on the following legal grounds:</p>
        <p>• <strong>Contract performance:</strong> Processing necessary to fulfill our contractual obligations to you.</p>
        <p>• <strong>Legitimate interests:</strong> Processing necessary for our legitimate business interests, such as improving our services and preventing fraud.</p>
        <p>• <strong>Consent:</strong> Where you have given explicit consent for specific processing activities (e.g., marketing communications).</p>
        <p>• <strong>Legal obligation:</strong> Processing necessary to comply with applicable laws and regulations.</p>
      </section>

      <section className="space-y-3 text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">4. Your rights</h2>
        <p>Depending on your location, you may have the following rights regarding your personal data:</p>
        <p>• <strong>Access:</strong> Request a copy of the personal data we hold about you.</p>
        <p>• <strong>Rectification:</strong> Request correction of inaccurate or incomplete data.</p>
        <p>• <strong>Erasure:</strong> Request deletion of your personal data ("right to be forgotten").</p>
        <p>• <strong>Restriction:</strong> Request restriction of processing in certain circumstances.</p>
        <p>• <strong>Portability:</strong> Request transfer of your data to another service provider.</p>
        <p>• <strong>Objection:</strong> Object to processing based on legitimate interests or for direct marketing.</p>
        <p>• <strong>Withdraw consent:</strong> Withdraw consent at any time where processing is based on consent.</p>
        <p>To exercise any of these rights, please contact us at privacy@tryblueprint.io. We will respond within 30 days.</p>
      </section>

      <section className="space-y-3 text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">5. Cookies and tracking</h2>
        <p>We use cookies and similar tracking technologies to:</p>
        <p>• <strong>Essential cookies:</strong> Required for the website to function properly.</p>
        <p>• <strong>Analytics cookies:</strong> Help us understand how visitors interact with our website (Google Analytics).</p>
        <p>• <strong>Marketing cookies:</strong> Used to deliver relevant advertisements (only with your consent).</p>
        <p>You can manage your cookie preferences through our cookie consent banner or your browser settings. Note that disabling certain cookies may affect website functionality.</p>
      </section>

      <section className="space-y-3 text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">6. Sharing</h2>
        <p>• We do not sell personal data.</p>
        <p>• We share information with vendors who help us run Blueprint (hosting, analytics, communication, payment processing) under confidentiality agreements and data processing agreements where required.</p>
        <p>• We may disclose information if required by law or to protect Blueprint's rights.</p>
        <p>• In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity.</p>
      </section>

      <section className="space-y-3 text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">7. International data transfers</h2>
        <p>Your information may be transferred to and processed in countries outside your country of residence, including the United States. When we transfer data internationally, we implement appropriate safeguards such as Standard Contractual Clauses approved by the European Commission.</p>
      </section>

      <section className="space-y-3 text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">8. Data retention</h2>
        <p>We retain your personal data only for as long as necessary to fulfill the purposes for which it was collected:</p>
        <p>• <strong>Account data:</strong> Retained while your account is active and for up to 3 years after deletion for legal compliance.</p>
        <p>• <strong>Project files:</strong> Retained for active engagements and deleted upon request or after completion per contract terms.</p>
        <p>• <strong>Analytics data:</strong> Retained for up to 26 months.</p>
        <p>• <strong>Marketing preferences:</strong> Retained until you unsubscribe or request deletion.</p>
      </section>

      <section className="space-y-3 text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">9. Security</h2>
        <p>We use industry-standard safeguards to protect data and restrict access to authorized personnel. This includes encryption in transit (TLS), secure cloud infrastructure, and access controls. However, no method of transmission over the Internet is 100% secure.</p>
      </section>

      <section className="space-y-3 text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">10. Children's privacy</h2>
        <p>Our services are not directed to individuals under the age of 16. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.</p>
      </section>

      <section className="space-y-3 text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">11. Changes to this policy</h2>
        <p>We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last Updated" date. We encourage you to review this policy periodically.</p>
      </section>

      <section className="space-y-3 text-sm text-slate-600">
        <h2 className="text-lg font-semibold text-slate-900">12. Contact</h2>
        <p>If you have questions about this Privacy Policy or wish to exercise your data rights, please contact us:</p>
        <p>Email: privacy@tryblueprint.io</p>
        <p>Address: Blueprint, Inc., 220 E. Parrish St, Durham, NC 27701, United States</p>
        <p>For EEA residents: You also have the right to lodge a complaint with your local data protection authority.</p>
      </section>
    </div>
    </>
  );
}
