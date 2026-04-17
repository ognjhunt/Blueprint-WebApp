import {
  proofHighlights,
  proofReelPosterSrc,
  proofReelVideoSrc,
  publicProofAssets,
  resultHighlights,
} from "@/lib/marketingProof";
import { PlayCircle, ShieldCheck } from "lucide-react";

interface ProofModuleProps {
  eyebrow: string;
  title: string;
  description: string;
  caption: string;
  compact?: boolean;
}

export function ProofModule({
  eyebrow,
  title,
  description,
  caption,
  compact = false,
}: ProofModuleProps) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_-52px_rgba(15,23,42,0.5)] ${
        compact ? "p-5 sm:p-6" : "p-6 sm:p-8"
      }`}
    >
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {eyebrow}
          </p>
          <h2 className={`${compact ? "mt-3 text-2xl" : "mt-3 text-3xl"} font-semibold tracking-tight text-slate-950`}>
            {title}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>
          <ul className="mt-5 space-y-3">
            {proofHighlights.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-stone-950">
            <video
              autoPlay
              muted
              loop
              playsInline
              controls={false}
              poster={proofReelPosterSrc}
              className="aspect-[16/10] h-full w-full object-cover"
            >
              <source src={proofReelVideoSrc} type="video/mp4" />
            </video>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {resultHighlights.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-stone-50 px-4 py-3"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {item.outcome}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-2 text-xs leading-5 text-slate-600">{item.detail}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {publicProofAssets.map((item) => (
              <a
                key={item.title}
                href={item.href}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {item.label}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-2 text-xs leading-5 text-slate-600">{item.detail}</p>
              </a>
            ))}
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-stone-50 px-4 py-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-slate-700" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">What is real vs illustrative</p>
              <p className="text-sm leading-6 text-slate-600">{caption}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <PlayCircle className="mt-0.5 h-4 w-4 text-slate-700" />
            <p className="text-sm leading-6 text-slate-600">
              Real listing footage and public sample assets are shown where available. Product-interface callouts are clearly labeled when they are illustrative previews.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
