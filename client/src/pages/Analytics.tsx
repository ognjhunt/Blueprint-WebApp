import { SEO } from "@/components/SEO";
import { PremiumAnalyticsSection } from "@/components/site/PremiumAnalyticsSection";

export default function Analytics() {
  return (
    <>
      <SEO
        title="Premium Analytics | Blueprint - Data Quality, Testing & Optimization"
        description="Eleven premium analytics modules: Data validation (6), dataset licensing, robustness testing, policy explainability, hardware calibration, and policy benchmarking. Complete pipeline from validation to deployment."
        canonical="/analytics"
      />
      <div className="min-h-screen bg-white">
        <PremiumAnalyticsSection />
      </div>
    </>
  );
}
