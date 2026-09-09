import { useRef, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { SEO } from "@/components/SEO";
import { withCsrfHeader } from "@/lib/csrf";

function InquiryForm({ isSite }: { isSite: boolean }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "").trim();
    if (!["name", "email", "company", "message"].every((key) => value(key))) {
      setError("Please complete all required fields.");
      return;
    }
    pending.current = true;
    setStatus("sending");
    setError(null);
    try {
      // /api/contact persists message in contactRequests, including the persona
      // and pilot context needed for triage. Reuse its durable, CSRF-protected path.
      const message = [
        isSite ? "Site evaluation inquiry" : "Robot team application",
        value("message"),
        isSite ? `Evaluation budget: ${value("budget") || "Not specified"}` : "",
        isSite ? `Pilot window: ${value("timeline") || "Not specified"}` : "",
      ].filter(Boolean).join("\n\n");
      const response = await fetch("/api/contact", {
        method: "POST",
        credentials: "include",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ name: value("name"), email: value("email"), company: value("company"), message, projectType: isSite ? "Site-funded Task Evaluation Run" : "Robot team participation", engagementScope: isSite ? "site_operator" : "robot_team", requestSource: "website-contact-form" }),
      });
      if (!response.ok) throw new Error("contact submission failed");
      setStatus("sent");
    } catch {
      setError("We couldn’t send your request. Please try again, or email hello@tryblueprint.io.");
      setStatus("idle");
    } finally {
      pending.current = false;
    }
  }

  if (status === "sent") return (
    <div className="ms-success" role="status" aria-live="polite">
      <Check size={30} aria-hidden="true" />
      <h2>{isSite ? "Your inquiry is in." : "Your application is in."}</h2>
      <p>{isSite ? "We’ll review your task and follow up about scope, fit, and next steps." : "We’ll review your system and follow up if there’s a suitable evaluation to discuss."}</p>
      <a className="ms-text-link" href="/">Back to Blueprint <ArrowRight size={18} aria-hidden="true" /></a>
    </div>
  );

  return (
    <form className="ms-form" onSubmit={submit} aria-label={isSite ? "Site evaluation inquiry" : "Robot team application"} aria-busy={status === "sending"}>
      <div className="ms-form-row">
        <label>Your name<input name="name" autoComplete="name" required maxLength={120} /></label>
        <label>Work email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      </div>
      <label>Company<input name="company" autoComplete="organization" required maxLength={200} /></label>
      <label><span>{isSite ? "What task do you want to automate?" : "What does your system do?"}</span>
        <span className="ms-field-hint" id="details-hint">{isSite ? "Include your site location, the workcell, and what a successful pilot would show." : "Include your robot or configuration, supported tasks, and a website or demo link."}</span>
        <textarea name="message" rows={4} required maxLength={4000} aria-label={isSite ? "What task do you want to automate?" : "What does your system do?"} aria-describedby="details-hint" />
      </label>
      {isSite && <div className="ms-form-row">
        <label>Evaluation budget<select name="budget" required defaultValue=""><option value="" disabled>Select status</option><option>Approved</option><option>Seeking approval</option><option>Need help scoping</option></select></label>
        <label><span>Pilot window <span className="ms-optional">(optional)</span></span><input name="timeline" placeholder="e.g. Q1 2027" maxLength={120} /></label>
      </div>}
      {error && <p className="ms-error" role="alert">{error}</p>}
      <button className="ms-button ms-button-large" type="submit" disabled={status === "sending"}>{status === "sending" ? "Sending…" : isSite ? "Send inquiry" : "Send application"}<ArrowRight size={20} aria-hidden="true" /></button>
      <p className="ms-form-note">Read our <a href="/privacy">privacy policy</a> for how we handle your information. Please don’t include confidential files.</p>
    </form>
  );
}

export default function Contact() {
  const [location] = useLocation();
  const isSite = location !== "/contact/robot-team";
  const title = isSite ? "Let’s start with your site." : "Bring your robot. Find the fit.";
  const description = isSite ? "Tell us about one workcell, a task worth automating, and your pilot plans. We’ll scope a paid evaluation with you." : "Tell us what your system can do. We consider compatible teams for scoped, site-funded evaluations with a defined task and pilot path.";
  return <>
    <SEO title={`${isSite ? "Discuss your site" : "Robot teams"} | Blueprint`} description={description} canonical={isSite ? "/contact/site-operator" : "/contact/robot-team"} image="https://tryblueprint.io/images/site-led/workcell.webp" />
    <section className="ms-inquiry ms-container">
      <div className="ms-inquiry-intro">
        <a className="ms-back" href="/"><ArrowLeft size={16} aria-hidden="true" /> Back to Blueprint</a>
        <p className="ms-eyebrow">{isSite ? "For site owners" : "For robot teams"}</p>
        <h1>{title}</h1><p className="ms-inquiry-description">{description}</p>
        <p className="ms-inquiry-aside">{isSite ? "Best fit: a bounded workcell, a named task owner, and time set aside for a physical pilot. Scope and pricing are agreed before evaluation begins." : "Applications are reviewed for task fit. Evaluation access and physical pilots require site approval; applying does not guarantee either."}</p>
        <a className="ms-text-link" href={isSite ? "/contact/robot-team" : "/contact/site-operator"}>{isSite ? "Building robots? Apply here" : "Operate a site? Start here"}<ArrowUpRight size={16} aria-hidden="true" /></a>
      </div>
      <InquiryForm key={isSite ? "site" : "robot"} isSite={isSite} />
    </section>
  </>;
}
