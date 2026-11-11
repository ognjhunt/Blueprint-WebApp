/**
 * Bare bones: the shared parts every screen in the user flow is assembled from (owner direction, 2026-11-11:
 * "a 10 year old should be able to understand what everything is"; rules in
 * docs/superpowers/specs/2026-11-11-site-answer-design.md, "Bare bones"). Styles: ./bare.css (loaded once in
 * main.tsx). These parts carry no words of their own except "‹ Back" and "How sure are we?"; every other word is
 * passed in by the screen, from constants in the repository.
 */
import { useId, type ReactNode } from "react";

/** The centred screen column (at most 560 px). Put one `h1` inside. */
export function BareScreen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `bare-screen ${className}` : "bare-screen"}>{children}</div>;
}

/** A group of related lines; groups are spaced 32 px apart, lines inside 8 px. */
export function BareGroup({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return <div className={className ? `bare-group ${className}` : "bare-group"} aria-label={label} role={label ? "group" : undefined}>{children}</div>;
}

/** The small label above a thing ("THE ROBOT MOST LIKELY TO FIT"). Pass `as="h2"` when it heads a section. */
export function BareLabel({ children, as: Tag = "p", id }: { children: ReactNode; as?: "p" | "h2" | "h3"; id?: string }) {
  return <Tag className="bare-label" id={id}>{children}</Tag>;
}

/** The answer in large type, with an optional small line under it ("by Universal Robots"). */
export function BareBig({ children, sub, as: Tag = "p" }: { children: ReactNode; sub?: ReactNode; as?: "p" | "h1" | "h2" }) {
  return <>
    <Tag className="bare-big">{children}</Tag>
    {sub && <p className="bare-sub">{sub}</p>}
  </>;
}

/**
 * A large answer in parts that break on purpose, each on its own line ("Franka arm", "+ π0.5"), so a wrapped
 * answer never leaves a "+" hanging. The parts are joined by a space, so the text reads as one name.
 */
export function BareParts({ parts }: { parts: string[] }) {
  return <>{parts.map((part, index) => <span key={index} className="bare-part">{index ? ` ${part}` : part}</span>)}</>;
}

/** A plain sentence at body size, for a headline that is a sentence rather than a name. */
export function BareLead({ children, as: Tag = "p" }: { children: ReactNode; as?: "p" | "h1" | "h2" }) {
  return <Tag className="bare-lead">{children}</Tag>;
}

export type BareTickState = "yes" | "unsure";
const TICK_MARKS: Readonly<Record<BareTickState, string>> = { yes: "✓", unsure: "?" };

/**
 * Short reasons, each with a mark: "✓" for a thing that holds, "?" for one that cannot be told yet. The mark is
 * hidden from assistive technology; the words themselves always say which (nothing by the mark alone).
 */
export function BareTicks({ items, label }: { items: Array<{ key: string; state: BareTickState; text: string }>; label: string }) {
  if (!items.length) return null;
  return <ul className="bare-ticks" aria-label={label}>
    {items.map(item => <li key={item.key} className={`bare-tick bare-tick-${item.state}`}>
      <span className="bare-mark" aria-hidden="true">{TICK_MARKS[item.state]}</span><span>{item.text}</span>
    </li>)}
  </ul>;
}

/** How sure, as one to three filled dots and a word, with one plain reason line under it. */
export function BareSureness({ filled, word, reason }: { filled: 1 | 2 | 3; word: string; reason?: string | null }) {
  return <div className="bare-sure">
    <p className="bare-sure-line">How sure are we?{" "}
      <span className="bare-dots" aria-hidden="true">{[1, 2, 3].map(dot => <span key={dot} className={dot <= filled ? "bare-dot bare-dot-on" : "bare-dot"} />)}</span>{" "}
      <strong>{word}</strong></p>
    {reason && <p className="bare-helper">{reason}</p>}
  </div>;
}

/**
 * The screen's one filled button, with the line a person agrees to or needs, directly under it. Pass `quiet` when
 * the screen has another step that comes first: the button then reads as a link, with its line kept.
 */
export function BareButton({ children, onClick, href, disabled, helper, quiet = false }: {
  children: ReactNode; onClick?: () => void; href?: string; disabled?: boolean; helper?: ReactNode; quiet?: boolean;
}) {
  const helperId = useId();
  const className = quiet ? "bare-quiet-button" : "bare-button";
  const described = helper ? helperId : undefined;
  return <div className="bare-action">
    {href
      ? <a className={className} href={href} aria-describedby={described}>{children}</a>
      : <button type="button" className={className} onClick={onClick} disabled={disabled} aria-describedby={described}>{children}</button>}
    {helper && <p className="bare-helper" id={helperId}>{helper}</p>}
  </div>;
}

export type BareLinkItem = { key: string; label: string; href?: string; onClick?: () => void };

/** At most two quiet text links, side by side ("See details ›", "Job settings ›"). */
export function BareLinks({ links }: { links: BareLinkItem[] }) {
  const shown = links.slice(0, 2);
  if (!shown.length) return null;
  return <nav className="bare-links" aria-label="More">
    {shown.map(link => link.href
      ? <a key={link.key} className="bare-link" href={link.href} data-opens={link.key}>{link.label} ›</a>
      : <button key={link.key} type="button" className="bare-link" onClick={link.onClick} data-opens={link.key}>{link.label} ›</button>)}
  </nav>;
}

/** "‹ Back", as a link or a button. */
export function BareBack({ href, onClick, children = "‹ Back" }: { href?: string; onClick?: () => void; children?: ReactNode }) {
  return href
    ? <a className="bare-back" href={href}>{children}</a>
    : <button type="button" className="bare-back" onClick={onClick}>{children}</button>;
}

/** A section of a details screen: a heading, then short labelled rows (or plain lines when a row has no label). */
export function BareRows({ title, rows, children, id: sectionId }: {
  title: string; rows?: Array<{ key: string; label?: ReactNode; value: ReactNode }>; children?: ReactNode; id?: string;
}) {
  const id = useId();
  return <section className="bare-rows" aria-labelledby={id} id={sectionId}>
    <h2 className="bare-rows-title" id={id}>{title}</h2>
    {rows && rows.length > 0 && <dl>{rows.map(row => <div key={row.key} className={row.label ? "bare-row" : "bare-row bare-row-plain"}>
      {row.label && <dt>{row.label}</dt>}<dd>{row.value}</dd>
    </div>)}</dl>}
    {children}
  </section>;
}

/** A plain list of choices, each a full-width row of at least 56 px (a settings screen). */
export function BareMenu({ items, label }: { items: Array<{ key: string; label: ReactNode; href?: string; onClick?: () => void; body?: ReactNode }>; label: string }) {
  return <ul className="bare-menu" aria-label={label}>
    {items.map(item => <li key={item.key}>
      {item.body ?? (item.href
        ? <a className="bare-menu-item" href={item.href} data-opens={item.key}>{item.label}</a>
        : <button type="button" className="bare-menu-item" onClick={item.onClick} data-opens={item.key}>{item.label}</button>)}
    </li>)}
  </ul>;
}

/** A line that changes what the screen means, or a step the person must take: never folded away. */
export function BareNotice({ children, role }: { children: ReactNode; role?: "status" | "alert" }) {
  return <p className="bare-notice" role={role}>{children}</p>;
}

/** A done line, in place of the button once its step is taken ("✓ Shared. …"). */
export function BareDone({ children }: { children: ReactNode }) {
  return <p className="bare-done" role="status">{children}</p>;
}

/** The fine print: one line, small, 48 px below what comes before. */
export function BareFine({ children }: { children: ReactNode }) {
  return <p className="bare-fine">{children}</p>;
}
