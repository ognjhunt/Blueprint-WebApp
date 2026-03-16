import type { SiteWorldCard } from "@/data/siteWorlds";

export function SiteWorldGraphic({ site }: { site: SiteWorldCard }) {
  const realImageUrl = site.worldLabsPreview?.panoUrl || site.worldLabsPreview?.thumbnailUrl;

  if (realImageUrl) {
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${site.tone} p-3`}>
        <div className="absolute right-4 top-4 z-10 rounded-full border border-white/70 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 backdrop-blur">
          {site.siteCode}
        </div>
        <img
          src={realImageUrl}
          alt={site.siteName}
          className="relative h-44 w-full rounded-2xl border border-white/70 object-cover shadow-sm"
        />
      </div>
    );
  }

  const labelStyle = "fill-slate-500 text-[10px] font-semibold tracking-[0.18em] uppercase";

  const renderByKind = () => {
    switch (site.thumbnailKind) {
      case "grocery":
        return (
          <>
            <rect x="38" y="56" width="150" height="180" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <rect x="214" y="50" width="62" height="190" rx="16" fill="#f8fafc" stroke="#cbd5e1" />
            <rect x="292" y="50" width="62" height="190" rx="16" fill="#f8fafc" stroke="#cbd5e1" />
            <rect x="370" y="50" width="62" height="190" rx="16" fill="#f8fafc" stroke="#cbd5e1" />
            <rect x="448" y="74" width="78" height="132" rx="20" fill="#ffffff" stroke="#cbd5e1" />
            <path d="M174 146H462" stroke={site.accent} strokeWidth="10" strokeLinecap="round" />
            <circle cx="312" cy="146" r="14" fill={site.accent} fillOpacity="0.18" stroke={site.accent} strokeWidth="2" />
            <text x="56" y="84" className={labelStyle}>dock</text>
            <text x="456" y="96" className={labelStyle}>prep</text>
          </>
        );
      case "parcel":
        return (
          <>
            <rect x="44" y="58" width="132" height="76" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <rect x="44" y="154" width="132" height="76" rx="18" fill="#f8fafc" stroke="#cbd5e1" />
            <rect x="400" y="62" width="104" height="164" rx="24" fill="#ffffff" stroke="#cbd5e1" />
            <path d="M164 96C230 96 246 130 304 130C366 130 370 102 420 102" stroke={site.accent} strokeWidth="12" strokeLinecap="round" fill="none" />
            <path d="M164 192C228 192 252 158 310 158C364 158 382 184 420 184" stroke={site.accent} strokeWidth="12" strokeLinecap="round" fill="none" />
            <text x="60" y="84" className={labelStyle}>induct</text>
            <text x="416" y="88" className={labelStyle}>sort</text>
          </>
        );
      case "lineSide":
        return (
          <>
            <rect x="56" y="68" width="108" height="152" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <rect x="214" y="68" width="112" height="152" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <rect x="374" y="68" width="108" height="152" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <path d="M168 144H214" stroke="#94a3b8" strokeWidth="8" strokeLinecap="round" />
            <path d="M326 144H374" stroke="#94a3b8" strokeWidth="8" strokeLinecap="round" />
            <path d="M110 244H432" stroke={site.accent} strokeWidth="10" strokeLinecap="round" />
            <circle cx="272" cy="244" r="16" fill={site.accent} fillOpacity="0.2" stroke={site.accent} strokeWidth="2" />
            <text x="78" y="94" className={labelStyle}>cart</text>
            <text x="232" y="94" className={labelStyle}>station</text>
            <text x="392" y="94" className={labelStyle}>handoff</text>
          </>
        );
      case "laundry":
        return (
          <>
            <circle cx="136" cy="150" r="56" fill="#ffffff" stroke="#cbd5e1" />
            <circle cx="286" cy="150" r="56" fill="#ffffff" stroke="#cbd5e1" />
            <circle cx="436" cy="150" r="56" fill="#ffffff" stroke="#cbd5e1" />
            <path d="M136 94V206" stroke="#cbd5e1" strokeWidth="4" />
            <path d="M286 94V206" stroke="#cbd5e1" strokeWidth="4" />
            <path d="M436 94V206" stroke="#cbd5e1" strokeWidth="4" />
            <path d="M100 256H474" stroke={site.accent} strokeWidth="10" strokeLinecap="round" />
            <text x="96" y="88" className={labelStyle}>sort</text>
            <text x="248" y="88" className={labelStyle}>bag</text>
            <text x="398" y="88" className={labelStyle}>fold</text>
          </>
        );
      case "coldChain":
        return (
          <>
            <rect x="42" y="52" width="168" height="184" rx="18" fill="#ecfeff" stroke="#a5f3fc" />
            <rect x="234" y="52" width="108" height="184" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <rect x="364" y="52" width="150" height="184" rx="18" fill="#f0f9ff" stroke="#cbd5e1" />
            <path d="M202 144H234" stroke={site.accent} strokeWidth="10" strokeLinecap="round" />
            <path d="M342 144H364" stroke={site.accent} strokeWidth="10" strokeLinecap="round" />
            <text x="60" y="82" className={labelStyle}>chiller</text>
            <text x="250" y="82" className={labelStyle}>airlock</text>
            <text x="388" y="82" className={labelStyle}>pick</text>
          </>
        );
      case "returns":
        return (
          <>
            <rect x="54" y="64" width="126" height="68" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <rect x="54" y="152" width="126" height="68" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <rect x="224" y="64" width="126" height="156" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <rect x="394" y="64" width="110" height="156" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <path d="M176 98H224" stroke={site.accent} strokeWidth="8" strokeLinecap="round" />
            <path d="M176 186H224" stroke={site.accent} strokeWidth="8" strokeLinecap="round" />
            <path d="M350 142H394" stroke={site.accent} strokeWidth="8" strokeLinecap="round" />
            <text x="66" y="88" className={labelStyle}>intake</text>
            <text x="244" y="88" className={labelStyle}>triage</text>
            <text x="410" y="88" className={labelStyle}>route</text>
          </>
        );
      case "microFulfillment":
        return (
          <>
            {[100, 152, 204, 256, 308, 360].map((x) => (
              <rect key={x} x={x} y="56" width="28" height="180" rx="12" fill="#ffffff" stroke="#cbd5e1" />
            ))}
            <rect x="42" y="86" width="86" height="120" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <rect x="420" y="86" width="86" height="120" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <path d="M126 146H420" stroke={site.accent} strokeWidth="10" strokeLinecap="round" />
            <text x="56" y="82" className={labelStyle}>pick</text>
            <text x="432" y="82" className={labelStyle}>pack</text>
          </>
        );
      case "pharmacy":
        return (
          <>
            <rect x="48" y="66" width="150" height="148" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <rect x="224" y="66" width="118" height="148" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <rect x="368" y="66" width="144" height="148" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <path d="M208 140H224" stroke={site.accent} strokeWidth="8" strokeLinecap="round" />
            <path d="M342 140H368" stroke={site.accent} strokeWidth="8" strokeLinecap="round" />
            <text x="60" y="88" className={labelStyle}>shelf</text>
            <text x="242" y="88" className={labelStyle}>verify</text>
            <text x="388" y="88" className={labelStyle}>secure</text>
          </>
        );
      case "battery":
        return (
          <>
            <rect x="56" y="70" width="110" height="144" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <rect x="200" y="70" width="144" height="144" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <rect x="378" y="70" width="110" height="144" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <path d="M166 142H200" stroke={site.accent} strokeWidth="10" strokeLinecap="round" />
            <path d="M344 142H378" stroke={site.accent} strokeWidth="10" strokeLinecap="round" />
            <circle cx="272" cy="142" r="18" fill={site.accent} fillOpacity="0.18" stroke={site.accent} strokeWidth="2" />
            <text x="74" y="92" className={labelStyle}>parts</text>
            <text x="224" y="92" className={labelStyle}>fixture</text>
            <text x="396" y="92" className={labelStyle}>buffer</text>
          </>
        );
      case "airport":
        return (
          <>
            <rect x="52" y="82" width="108" height="132" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <path d="M160 106C246 106 226 178 320 178C396 178 406 104 492 104" stroke={site.accent} strokeWidth="12" strokeLinecap="round" fill="none" />
            <path d="M160 188C246 188 240 124 318 124C392 124 410 188 492 188" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" fill="none" />
            <rect x="418" y="70" width="88" height="154" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <text x="66" y="98" className={labelStyle}>feed</text>
            <text x="428" y="94" className={labelStyle}>scan</text>
          </>
        );
      case "hospital":
        return (
          <>
            <rect x="50" y="62" width="122" height="74" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <rect x="50" y="152" width="122" height="74" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <rect x="208" y="62" width="134" height="164" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <rect x="378" y="62" width="126" height="164" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <path d="M172 98H208" stroke={site.accent} strokeWidth="8" strokeLinecap="round" />
            <path d="M172 190H208" stroke={site.accent} strokeWidth="8" strokeLinecap="round" />
            <path d="M342 144H378" stroke={site.accent} strokeWidth="8" strokeLinecap="round" />
            <text x="62" y="86" className={labelStyle}>cart</text>
            <text x="226" y="86" className={labelStyle}>stock</text>
            <text x="394" y="86" className={labelStyle}>room</text>
          </>
        );
      case "electronics":
        return (
          <>
            <rect x="56" y="72" width="134" height="140" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <rect x="214" y="72" width="134" height="140" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <rect x="372" y="72" width="134" height="140" rx="18" fill="#ffffff" stroke="#cbd5e1" />
            <path d="M190 142H214" stroke={site.accent} strokeWidth="8" strokeLinecap="round" />
            <path d="M348 142H372" stroke={site.accent} strokeWidth="8" strokeLinecap="round" />
            <text x="74" y="92" className={labelStyle}>tray</text>
            <text x="232" y="92" className={labelStyle}>bench</text>
            <text x="390" y="92" className={labelStyle}>test</text>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${site.tone} p-3`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.65),transparent_42%)]" />
      <div className="absolute right-4 top-4 rounded-full border border-white/70 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 backdrop-blur">
        {site.siteCode}
      </div>
      <svg viewBox="0 0 560 320" className="relative h-44 w-full rounded-2xl border border-white/70 bg-white/85 shadow-sm">
        <rect x="20" y="20" width="520" height="280" rx="28" fill="white" opacity="0.72" />
        <rect x="20" y="20" width="520" height="280" rx="28" fill="none" stroke="#e2e8f0" strokeWidth="2" />
        <path d="M30 42H530" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="6 8" />
        <path d="M30 278H530" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="6 8" />
        {renderByKind()}
      </svg>
    </div>
  );
}
