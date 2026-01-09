import { SEO } from "@/components/SEO";
import { PremiumAnalyticsSection } from "@/components/site/PremiumAnalyticsSection";

export default function Analytics() {
  return (
    <>
      <SEO
        title="Premium Analytics | Blueprint - Data Quality Validation for Robotics"
        description="Six premium analytics modules for robotics labs. Failure mode analysis, sim-to-real fidelity, embodiment transfer, grasp quality, learning curves, trajectory optimization."
        canonical="/analytics"
      />
      <div className="min-h-screen bg-white">
        <PremiumAnalyticsSection />
      </div>
    </>
  );
}
