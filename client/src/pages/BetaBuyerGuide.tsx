import { BetaCohortGuidePage } from "@/components/site/BetaCohortGuidePage";
import { buyerBetaGuide } from "@/lib/betaCohortGuides";

export default function BetaBuyerGuide() {
  return <BetaCohortGuidePage guide={buyerBetaGuide} />;
}
