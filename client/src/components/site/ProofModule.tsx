import { proofHighlights, proofReelPosterSrc, proofReelVideoSrc } from "@/lib/marketingProof";
import { PlayCircle } from "lucide-react";

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
      className={`rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_-52px_rgba(15,23,42,0.5)] ${
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
          <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-stone-950">
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
          <div className="flex items-start gap-3 rounded-[1.25rem] border border-slate-200 bg-stone-50 px-4 py-3">
            <PlayCircle className="mt-0.5 h-4 w-4 text-slate-700" />
            <p className="text-sm leading-6 text-slate-600">{caption}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
