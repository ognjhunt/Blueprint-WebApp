import type { PropsWithChildren, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SurfacePageProps = PropsWithChildren<{
  tone?: "paper" | "ink";
  className?: string;
}>;

export function SurfacePage({ children, tone = "paper", className }: SurfacePageProps) {
  return (
    <div
      className={cn(
        "min-h-screen",
        tone === "ink"
          ? "bg-runway-black text-runway-text"
          : "bg-[radial-gradient(circle_at_top,#171b19,#101312_54%,#0c0f0e)] text-runway-text",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SurfaceTopBar(props: {
  eyebrow?: string;
  rightLabel?: string;
  rightNode?: ReactNode;
}) {
  return (
    <div className="border-b border-runway-line">
      <div className="mx-auto flex max-w-[92rem] items-center justify-between gap-4 px-6 py-5 lg:px-10">
        <a href="/" className="font-editorial font-display uppercase text-[2.2rem] tracking-[0.005em] text-runway-text">
          Blueprint
        </a>
        {props.eyebrow ? (
          <p className="runway-eyebrow-muted hidden md:block">
            {props.eyebrow}
          </p>
        ) : (
          <span />
        )}
        {props.rightNode ? props.rightNode : <p className="runway-meta">{props.rightLabel}</p>}
      </div>
    </div>
  );
}

export function SurfaceSection(props: PropsWithChildren<{ className?: string }>) {
  return <section className={cn("mx-auto max-w-[92rem] px-6 py-10 lg:px-10", props.className)}>{props.children}</section>;
}

export function SurfaceEyebrow({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <p className={cn("runway-eyebrow-muted", className)}>
      {children}
    </p>
  );
}

export function SurfaceTitle(props: PropsWithChildren<{ className?: string }>) {
  return (
    <h1 className={cn("font-display uppercase text-[clamp(2.8rem,6vw,5.4rem)] font-semibold tracking-[0.005em] leading-[0.9] text-runway-text", props.className)}>
      {props.children}
    </h1>
  );
}

export function SurfaceLead(props: PropsWithChildren<{ className?: string }>) {
  return (
    <p className={cn("max-w-3xl text-[1.08rem] leading-[1.6] text-runway-body", props.className)}>
      {props.children}
    </p>
  );
}

export function SurfaceBrowserFrame(props: PropsWithChildren<{ className?: string; dark?: boolean }>) {
  return (
    <div className={cn("runway-panel overflow-hidden", props.className)}>
      <div className="flex items-center justify-between border-b border-runway-line bg-runway-black px-5 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-runway-faint">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-runway-line-strong" />
          <span className="h-2 w-2 rounded-full bg-runway-line-strong" />
          <span className="h-2 w-2 rounded-full bg-runway-line-strong" />
        </div>
        <span>Private Workspace</span>
        <span>{props.dark ? "Secured" : "Blueprint"}</span>
      </div>
      {props.children}
    </div>
  );
}

export function SurfaceCard(props: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn("runway-panel p-6 text-runway-text", props.className)}>
      {props.children}
    </div>
  );
}

export function SurfaceButton(props: {
  href?: string;
  children: ReactNode;
  tone?: "primary" | "secondary" | "ghost";
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  const classes = cn(
    props.tone === "secondary"
      ? "runway-cta-ghost"
      : props.tone === "ghost"
        ? "inline-flex min-h-[3.25rem] items-center justify-center gap-3 px-6 text-[14px] font-semibold uppercase tracking-[0.04em] text-runway-mute transition-colors duration-200 hover:text-runway-text"
        : "runway-cta",
    props.className,
  );

  if (props.href) {
    return (
      <a href={props.href} className={classes}>
        {props.children}
      </a>
    );
  }

  return (
    <button type={props.type || "button"} className={classes} onClick={props.onClick}>
      {props.children}
    </button>
  );
}

export function SurfacePill(props: PropsWithChildren<{ className?: string }>) {
  return (
    <span className={cn("runway-chip runway-chip-quiet", props.className)}>
      {props.children}
    </span>
  );
}

export function SurfaceStat(props: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("runway-panel px-5 py-4", props.className)}>
      <p className="runway-meta">{props.label}</p>
      <div className="runway-num mt-3 text-[2rem] font-semibold leading-none text-runway-text">{props.value}</div>
      {props.detail ? <p className="mt-2 text-sm text-runway-mute">{props.detail}</p> : null}
    </div>
  );
}

export function SurfaceInput(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, className, ...rest } = props;
  return (
    <label className="block">
      <span className="runway-label">{label}</span>
      <input {...rest} className={cn("runway-input h-12", className)} />
    </label>
  );
}

export function SurfaceTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string },
) {
  const { label, className, ...rest } = props;
  return (
    <label className="block">
      <span className="runway-label">{label}</span>
      <textarea {...rest} className={cn("runway-input min-h-[120px]", className)} />
    </label>
  );
}

export function SurfaceDivider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-runway-line", className)} />;
}

export function SurfaceMiniLabel({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <p className={cn("runway-meta font-semibold", className)}>
      {children}
    </p>
  );
}

export function SurfaceSidebar(props: PropsWithChildren<{ className?: string }>) {
  return (
    <aside className={cn("runway-panel p-5", props.className)}>
      {props.children}
    </aside>
  );
}

export function SurfaceStatusList(props: {
  items: Array<{ label: string; value: ReactNode }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        props.className,
      )}
    >
      {props.items.map((item) => (
        <div
          key={item.label}
          className="flex items-center justify-between gap-4 border border-runway-line bg-runway-black px-4 py-3 text-sm text-runway-text"
        >
          <span className="text-runway-mute">{item.label}</span>
          <span className="text-right font-semibold">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
