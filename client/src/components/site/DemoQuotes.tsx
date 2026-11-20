// DEMO: this whole component is invented for the internal showing (launch-copy demo PR). No real site or company said
// these words. Never merge it; replace with real, permissioned quotes before launch.
import { BareGroup } from "@/components/bare/Bare";

// DEMO: invented quotes and people.
const DEMO_QUOTES = [
  { key: "site", quote: "I filmed our carton line on my phone during a shift. Two companies answered that week.", who: "Operations manager, a parcel depot in Ohio (sample)" },
  { key: "company", quote: "The video and the simulation told us enough to say yes without a site visit.", who: "Business development lead, a robot deployment company (sample)" },
] as const;

export function DemoQuotes() {
  return <BareGroup className="bare-demo-quotes">
    <h2 className="bare-helper">What people say</h2>
    {DEMO_QUOTES.map(item => <figure key={item.key} style={{ margin: "12px 0 0" }}>
      <blockquote className="bare-quote">{item.quote}</blockquote>
      <figcaption className="bare-helper" style={{ marginTop: 4 }}>{item.who}</figcaption>
    </figure>)}
  </BareGroup>;
}
