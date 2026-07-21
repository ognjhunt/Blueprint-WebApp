import { BetaCohortGuidePage } from "@/components/site/BetaCohortGuidePage";
import { capturerBetaGuide } from "@/lib/betaCohortGuides";

export default function BetaCapturerGuide() {
  return <BetaCohortGuidePage guide={capturerBetaGuide} />;
}
