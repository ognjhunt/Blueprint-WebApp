/**
 * Getting a site to a camera, which is the only thing we actually need.
 *
 * ## What this replaces
 *
 * The site intake led with six questions whose own copy said what they were
 * for: "These questions are the screen, not a survey. Six of them can end a
 * submission." A screen is a mechanism for turning people away, and it made
 * sense while a capture meant sending a person and a reconstruction was billed
 * on our account.
 *
 * Neither holds now. A site recording on its own phone costs us nothing to
 * receive; the privacy screen reads the footage before a frame is extracted;
 * and the footage review refuses to reconstruct anything unusable. The money is
 * guarded after the video, by the video.
 *
 * Which leaves the screen protecting nothing, and doing it badly: four of the
 * five gates that bind a self-recorded capture -- whether the area stays put,
 * whether one job repeats, how many item types, when the station is clear --
 * are things `VIDEO_OBSERVABLE_FIELD_IDS` says the footage shows. We were
 * asking a site to describe a room in dropdowns before we would accept a film
 * of the same room.
 *
 * ## The verdict did not disappear, it moved
 *
 * `disposition === "qualified"` still decides whether a site is offered to
 * robot teams -- `loadRunnableSites` enforces that, unchanged. What changed is
 * that it is no longer a toll gate in front of our own supply. The gates get
 * resolved with the footage in hand, which is both later and easier.
 *
 * ## Why this is not a signup
 *
 * There is no account here, deliberately: the submit path carries
 * `accountSignup: false`, and the signed capture link is the credential. A
 * password and a verification email would be a second toll on someone who just
 * needs to point a phone at a pallet.
 *
 * ## The one thing that is still required
 *
 * Consent. We need permission to record the site and to let robot teams
 * evaluate against the scene, and that is a legal act rather than a
 * qualification — so it is a checkbox that blocks, and the only one.
 */
import { useState } from "react";

import { CaptureHandoffQr } from "@/components/site/CaptureHandoffQr";
import { withCsrfHeader } from "@/lib/csrf";

type State =
  | { status: "idle" }
  | { status: "working" }
  | { status: "done"; captureUrl: string | null; selfRecording: boolean; email: string }
  | { status: "failed"; message: string };

function splitName(value: string) {
  const parts = value.trim().split(/\s+/);
  if (parts.length < 2) return { firstName: parts[0] || "", lastName: "—" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function SiteCaptureStart() {
  const [state, setState] = useState<State>({ status: "idle" });
  const [selfRecording, setSelfRecording] = useState(true);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status === "working") return;

    const data = new FormData(event.currentTarget);
    const read = (key: string) => String(data.get(key) ?? "").trim();
    const email = read("startEmail");
    const location = read("startLocation");

    setState({ status: "working" });

    try {
      const { firstName, lastName } = splitName(read("startName"));
      const response = await fetch("/api/inbound-request", {
        method: "POST",
        credentials: "include",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          requestId: `capture-${crypto.randomUUID()}`,
          firstName,
          lastName,
          email: email.toLowerCase(),
          company: read("startCompany"),
          roleTitle: "Site operator",
          buyerType: "site_operator",
          // No account, so no terms gate. The capture link is the credential.
          accountSignup: false,
          budgetBucket: "Undecided/Unsure",
          requestedLanes: [],
          siteName: location,
          siteLocation: location,
          taskStatement: read("startTask"),
          taskDescription: read("startTask"),
          // Deliberately empty. The screen used to live here; it now happens
          // with the footage rather than in front of it.
          siteTaskGates: {},
          siteTaskSpec: {},
          captureMode: selfRecording ? "self_capture" : "site_visit",
          context: {
            sourcePageUrl: typeof window === "undefined" ? null : window.location.href,
          },
        }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        captureUrl?: string | null;
        message?: string;
      };

      if (!response.ok) {
        setState({
          status: "failed",
          message:
            result.message
            || "We could not save that. Please try again, or email hello@tryblueprint.io.",
        });
        return;
      }

      setState({
        status: "done",
        captureUrl: typeof result.captureUrl === "string" ? result.captureUrl : null,
        selfRecording,
        email,
      });
    } catch {
      setState({
        status: "failed",
        message: "We could not reach Blueprint. Please try again shortly.",
      });
    }
  }

  if (state.status === "done") {
    return (
      <div className="ms-form" aria-live="polite">
        {state.selfRecording && state.captureUrl ? (
          <>
            <h2 style={{ marginTop: 0 }}>Film the work area.</h2>
            <p className="ms-field-hint">
              One video of one work area, on any phone. Thirty seconds of the actual cycle is
              enough. No app and nothing to install.
            </p>
            <p style={{ marginTop: "20px" }}>
              <a className="ms-button ms-button-large" href={state.captureUrl}>
                Open the camera
              </a>
            </p>
            {/* The handoff, because this page is usually open on a laptop and
                the camera is in their pocket. */}
            <CaptureHandoffQr url={state.captureUrl} />
            <p className="ms-field-hint" style={{ marginTop: "20px" }}>
              Keep this link — it is how you come back to this submission. Film the work, not the
              worker: hands and objects are what a robot team needs to see.
            </p>
          </>
        ) : (
          <>
            <h2 style={{ marginTop: 0 }}>We have it.</h2>
            <p className="ms-field-hint">
              You asked us to record it, so someone will be in touch at {state.email} to arrange a
              time. A visit needs a date and a named person to meet, confirmed in writing before
              anyone travels.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <form className="ms-form" onSubmit={submit} aria-label="Start a site capture">
      <h2 style={{ marginTop: 0 }}>Show us the work.</h2>
      <p className="ms-field-hint" style={{ marginBottom: "20px" }}>
        A phone video of one work area is all a reconstruction needs. Nothing here can turn you
        away — what the footage shows is what decides, and you will hear exactly what we saw.
      </p>

      <label htmlFor="start-name">
        <span>Your name</span>
        <input id="start-name" name="startName" type="text" required maxLength={120} />
      </label>

      <label htmlFor="start-email">
        <span>Work email</span>
        <input id="start-email" name="startEmail" type="email" required maxLength={320} />
      </label>

      <label htmlFor="start-company">
        <span>Site or company</span>
        <input id="start-company" name="startCompany" type="text" required maxLength={200} />
      </label>

      <label htmlFor="start-task">
        <span>What is the job?</span>
        <span className="ms-field-hint">
          One line is plenty — "move totes from the conveyor to a pallet". The video says the rest.
        </span>
        <input id="start-task" name="startTask" type="text" required maxLength={400} />
      </label>

      <label htmlFor="start-self-recording" style={{ flexDirection: "row", alignItems: "center", gap: "10px" }}>
        <input
          id="start-self-recording"
          name="startSelfRecording"
          type="checkbox"
          checked={selfRecording}
          onChange={(event) => setSelfRecording(event.target.checked)}
          style={{ width: "auto", minHeight: 0 }}
        />
        <span>We will film it ourselves</span>
      </label>

      <label htmlFor="start-location">
        <span>{selfRecording ? "Where is it?" : "Site address"}</span>
        <span className="ms-field-hint">
          {selfRecording
            ? "A city is plenty. We only need a street address if we are sending someone."
            : "A capture operator needs a street address, not a site nickname."}
        </span>
        <input id="start-location" name="startLocation" type="text" required maxLength={300} />
      </label>

      <label htmlFor="start-rights" style={{ flexDirection: "row", alignItems: "flex-start", gap: "10px" }}>
        <input
          id="start-rights"
          name="startRights"
          type="checkbox"
          required
          style={{ width: "auto", minHeight: 0, marginTop: "4px" }}
        />
        {/* The only thing on this form that blocks, because it is a legal act
            rather than a judgement about whether the site is any good. */}
        <span style={{ fontWeight: 400 }}>
          I am authorised to record this site and to let Blueprint use the recording to build a
          scene robot teams can evaluate against.
        </span>
      </label>

      {state.status === "failed" && (
        <p role="alert" style={{ color: "var(--ms-alert, #b00)" }}>
          {state.message}
        </p>
      )}

      <button className="ms-button ms-button-large" type="submit" disabled={state.status === "working"}>
        {state.status === "working" ? "Working…" : "Start"}
      </button>
    </form>
  );
}
