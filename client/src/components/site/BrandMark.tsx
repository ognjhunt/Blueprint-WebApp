import { cn } from "@/lib/utils";

type BrandTone = "ink" | "paper" | "muted";

type BrandMarkProps = {
  className?: string;
  tone?: BrandTone;
  title?: string;
};

type BrandLockupProps = BrandMarkProps & {
  wordmarkClassName?: string;
  compact?: boolean;
};

const toneClass: Record<BrandTone, string> = {
  ink: "text-slate-950",
  paper: "text-white",
  muted: "text-slate-600",
};

export function BrandMark({
  className,
  tone = "ink",
  title = "Blueprint",
}: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={cn("h-9 w-9 shrink-0", toneClass[tone], className)}
    >
      <rect x="6" y="8" width="14" height="20" fill="currentColor" />
      <rect x="6" y="36" width="14" height="20" fill="currentColor" />
      <path
        d="M23 8h19.2C51.5 8 58 13.3 58 21.6c0 5.3-2.8 9.3-8 11.4 6 2 9.2 6.4 9.2 12.8C59.2 54.7 52.4 60 42 60H23V8Zm12.2 10.1v11.5h6.4c3.7 0 5.7-2.1 5.7-5.8 0-3.5-2-5.7-5.7-5.7h-6.4Zm0 21v11.1h7.1c3.8 0 6.1-2 6.1-5.5s-2.3-5.6-6.1-5.6h-7.1Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}

export function BrandLockup({
  className,
  wordmarkClassName,
  compact = false,
  tone = "ink",
}: BrandLockupProps) {
  return (
    <span className={cn("inline-flex items-center gap-3", toneClass[tone], className)}>
      <BrandMark tone={tone} className={compact ? "h-8 w-8" : "h-9 w-9"} />
      <span
        className={cn(
          "font-semibold leading-none tracking-[-0.035em]",
          compact ? "text-[1.45rem]" : "text-[1.72rem]",
          wordmarkClassName,
        )}
      >
        Blueprint
      </span>
    </span>
  );
}
