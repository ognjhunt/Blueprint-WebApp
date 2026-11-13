/**
 * Bare bones, the parts the public pages and the start form need beside `Bare.tsx`: a submit button with its line,
 * a numbered steps strip, form fields, a file picker, a check box, the consent line, upload progress, and the public
 * site's header and footer. The start form's optional parts open in place (`.bare-disclosure` in bare-public.css).
 * Styles: ./bare-public.css (loaded once in main.tsx). Like Bare.tsx, these parts carry no words of their own;
 * every word is passed in by the screen.
 */
import { useId, type ChangeEvent, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

/** The screen's one filled button as a form submit, with its busy label and the line directly under it. */
export function BareSubmit({ children, busy = false, busyLabel, disabled, helper, quiet = false }: {
  children: ReactNode; busy?: boolean; busyLabel?: ReactNode; disabled?: boolean; helper?: ReactNode; quiet?: boolean;
}) {
  const helperId = useId();
  return <div className="bare-action">
    <button type="submit" className={quiet ? "bare-quiet-button" : "bare-button"} disabled={disabled || busy} aria-busy={busy || undefined}
      aria-describedby={helper ? helperId : undefined}>{busy && busyLabel ? busyLabel : children}</button>
    {helper && <div className="bare-helper bare-consent" id={helperId}>{helper}</div>}
  </div>;
}

/** A numbered strip of short steps, each a title and at most one small line. The number is the list's own order. */
export function BareSteps({ steps, id, label }: { steps: Array<{ key: string; title: ReactNode; line?: ReactNode }>; id?: string; label?: string }) {
  return <ol className="bare-steps" id={id} aria-label={label}>
    {steps.map(step => <li key={step.key} className="bare-step">
      <span className="bare-step-title">{step.title}</span>
      {step.line && <span className="bare-step-line">{step.line}</span>}
    </li>)}
  </ol>;
}

/** A label, the control, an optional helper line and an optional error, wired for assistive technology. */
export function BareField({ label, htmlFor, helper, error, children, as: Tag = "div" }: {
  label: ReactNode; htmlFor?: string; helper?: ReactNode; error?: ReactNode | null; children: ReactNode; as?: "div" | "fieldset";
}) {
  return <Tag className="bare-field">
    {Tag === "fieldset" ? <legend className="bare-label">{label}</legend> : <label className="bare-label" htmlFor={htmlFor}>{label}</label>}
    {children}
    {helper && <p className="bare-helper" id={htmlFor ? `${htmlFor}-help` : undefined}>{helper}</p>}
    {error && <p className="bare-field-error" role="alert" id={htmlFor ? `${htmlFor}-error` : undefined}>{error}</p>}
  </Tag>;
}

/** Ids for a field's helper and error, for `aria-describedby` on its control. */
export function describedBy(id: string, parts: { helper?: unknown; error?: unknown }): string | undefined {
  const ids = [parts.helper ? `${id}-help` : null, parts.error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export function BareInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={props.className ? `bare-input ${props.className}` : "bare-input"} />;
}

export function BareSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={props.className ? `bare-select ${props.className}` : "bare-select"} />;
}

export function BareTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={props.className ? `bare-textarea ${props.className}` : "bare-textarea"} />;
}

/**
 * A file picker that reads as an outlined control, never a second filled button. A real file input sits inside the
 * label, so it is keyboard reachable and the label names it. After a choice it shows what was chosen.
 */
export function BareFile({ id, name, accept, required, label, hint, chosen, onChange, describedBy: describedById }: {
  id: string; name?: string; accept?: string; required?: boolean; label: ReactNode; hint?: ReactNode; chosen?: ReactNode;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void; describedBy?: string;
}) {
  return <label className={chosen ? "bare-file bare-file-chosen" : "bare-file"} htmlFor={id}>
    <input id={id} name={name} type="file" accept={accept} required={required} onChange={onChange} aria-describedby={describedById} />
    <span className="bare-file-label">{chosen ?? label}</span>
    {hint && !chosen && <small>{hint}</small>}
  </label>;
}

/** A check box row whose label is the exact sentence the person ticks. */
export function BareCheck({ id, name, checked, onChange, children }: {
  id: string; name?: string; checked: boolean; onChange: (checked: boolean) => void; children: ReactNode;
}) {
  return <label className="bare-check" htmlFor={id}>
    <input id={id} name={name} type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
    <span>{children}</span>
  </label>;
}

/** Upload progress with its label and the line that says what to do meanwhile. */
export function BareProgress({ percent, label, note }: { percent: number; label: string; note?: ReactNode }) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return <div className="bare-progress-wrap">
    <div className="bare-progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div style={{ width: `${value}%` }} />
    </div>
    {note && <p className="bare-helper">{note}</p>}
  </div>;
}
