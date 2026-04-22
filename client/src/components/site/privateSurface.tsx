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
          ? "bg-[#0c0c0b] text-white"
          : "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95),rgba(244,240,232,0.96)_54%,rgba(240,236,229,1))] text-[#111110]",
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
  dark?: boolean;
}) {
  const tone = props.dark ? "text-white/72 border-white/10" : "text-black/55 border-black/12";
  const brandTone = props.dark ? "text-white" : "text-[#111110]";
  return (
    <div className={cn("border-b", tone)}>
      <div className="mx-auto flex max-w-[92rem] items-center justify-between gap-4 px-6 py-5 lg:px-10">
        <a href="/" className={cn("font-editorial text-[2.2rem] tracking-[-0.06em]", brandTone)}>
          Blueprint
        </a>
        {props.eyebrow ? (
          <p className="hidden text-[11px] font-semibold uppercase tracking-[0.32em] md:block">
            {props.eyebrow}
          </p>
        ) : (
          <span />
        )}
        {props.rightNode ? props.rightNode : <p className="text-[11px] uppercase tracking-[0.24em]">{props.rightLabel}</p>}
      </div>
    </div>
  );
}

export function SurfaceSection(props: PropsWithChildren<{ className?: string }>) {
  return <section className={cn("mx-auto max-w-[92rem] px-6 py-10 lg:px-10", props.className)}>{props.children}</section>;
}

export function SurfaceEyebrow({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <p className={cn("text-[11px] font-semibold uppercase tracking-[0.28em] text-black/45", className)}>
      {children}
    </p>
  );
}

export function SurfaceTitle(props: PropsWithChildren<{ className?: string }>) {
  return (
    <h1 className={cn("font-sans text-[clamp(2.8rem,6vw,5.4rem)] font-semibold tracking-[-0.07em] leading-[0.9]", props.className)}>
      {props.children}
    </h1>
  );
}

export function SurfaceLead(props: PropsWithChildren<{ className?: string }>) {
  return (
    <p className={cn("max-w-3xl text-[1.08rem] leading-8 text-black/64", props.className)}>
      {props.children}
    </p>
  );
}

export function SurfaceBrowserFrame(props: PropsWithChildren<{ className?: string; dark?: boolean }>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[2rem] border shadow-[0_24px_80px_rgba(17,17,16,0.08)]",
        props.dark ? "border-white/10 bg-[#111110] text-white" : "border-black/12 bg-white text-[#111110]",
        props.className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between border-b px-5 py-3 text-[11px] uppercase tracking-[0.22em]",
          props.dark ? "border-white/10 bg-[#151514] text-white/46" : "border-black/10 bg-[#f7f3ec] text-black/45",
        )}
      >
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", props.dark ? "bg-white/18" : "bg-black/10")} />
          <span className={cn("h-2 w-2 rounded-full", props.dark ? "bg-white/18" : "bg-black/10")} />
          <span className={cn("h-2 w-2 rounded-full", props.dark ? "bg-white/18" : "bg-black/10")} />
        </div>
        <span>Private Surface</span>
        <span>{props.dark ? "Secured" : "Blueprint"}</span>
      </div>
      {props.children}
    </div>
  );
}

export function SurfaceCard(props: PropsWithChildren<{ className?: string; dark?: boolean }>) {
  return (
    <div
      className={cn(
        "rounded-[1.75rem] border p-6",
        props.dark ? "border-white/10 bg-white/5 text-white" : "border-black/10 bg-white text-[#111110]",
        props.className,
      )}
    >
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
    "inline-flex min-h-11 items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold transition",
    props.tone === "secondary"
      ? "border-black/12 bg-white text-[#111110] hover:bg-[#f4f0ea]"
      : props.tone === "ghost"
        ? "border-transparent bg-transparent text-black/68 hover:text-black"
        : "border-[#111110] bg-[#111110] text-white hover:bg-black",
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

export function SurfacePill(props: PropsWithChildren<{ className?: string; dark?: boolean }>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em]",
        props.dark ? "border-white/14 bg-white/5 text-white/72" : "border-black/10 bg-[#faf7f1] text-black/58",
        props.className,
      )}
    >
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
    <div className={cn("rounded-[1.4rem] border border-black/10 bg-white px-5 py-4", props.className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/42">{props.label}</p>
      <div className="mt-3 text-[2rem] font-semibold tracking-[-0.05em]">{props.value}</div>
      {props.detail ? <p className="mt-2 text-sm text-black/56">{props.detail}</p> : null}
    </div>
  );
}

export function SurfaceInput(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, className, ...rest } = props;
  return (
    <label className="block space-y-2">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-black/48">{label}</span>
      <input
        {...rest}
        className={cn(
          "h-12 w-full rounded-[1.1rem] border border-black/10 bg-white px-4 text-[15px] text-[#111110] outline-none transition placeholder:text-black/36 focus:border-black/28",
          className,
        )}
      />
    </label>
  );
}

export function SurfaceTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string },
) {
  const { label, className, ...rest } = props;
  return (
    <label className="block space-y-2">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-black/48">{label}</span>
      <textarea
        {...rest}
        className={cn(
          "min-h-[120px] w-full rounded-[1.2rem] border border-black/10 bg-white px-4 py-3 text-[15px] text-[#111110] outline-none transition placeholder:text-black/36 focus:border-black/28",
          className,
        )}
      />
    </label>
  );
}

export function SurfaceDivider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-black/10", className)} />;
}

export function SurfaceMiniLabel({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <p className={cn("text-[10px] font-semibold uppercase tracking-[0.22em] text-black/40", className)}>
      {children}
    </p>
  );
}

export function SurfaceSidebar(props: PropsWithChildren<{ className?: string; dark?: boolean }>) {
  return (
    <aside
      className={cn(
        "rounded-[1.8rem] border p-5",
        props.dark ? "border-white/10 bg-white/5" : "border-black/10 bg-[#fbf8f2]",
        props.className,
      )}
    >
      {props.children}
    </aside>
  );
}

export function SurfaceStatusList(props: {
  items: Array<{ label: string; value: ReactNode }>;
  dark?: boolean;
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
          className={cn(
            "flex items-center justify-between rounded-[1.1rem] border px-4 py-3 text-sm",
            props.dark ? "border-white/10 bg-white/5 text-white" : "border-black/10 bg-white text-[#111110]",
          )}
        >
          <span className={cn(props.dark ? "text-white/62" : "text-black/48")}>{item.label}</span>
          <span className="font-semibold">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
