/**
 * The page a site employee opens from a link in an email.
 *
 * They have no account, no app, and no reason to trust a long form. The link is
 * the credential and the video is the payload, so this page is deliberately one
 * screen: what to film, a file picker, and a progress bar.
 *
 * It says nothing about the site, the buyer, or the request. The API behind it
 * is careful not to leak who a customer is to anyone holding a forwarded link,
 * and a page that undid that by rendering the company name would make the
 * restraint pointless.
 *
 * `XMLHttpRequest` rather than `fetch`, for one reason: a walkthrough is
 * hundreds of megabytes over a phone connection, and `fetch` cannot report
 * upload progress. A silent two-minute wait is how someone decides the page is
 * broken and closes it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";

import { Helmet } from "@/lib/helmet";

type LinkState =
  | { status: "checking" }
  | { status: "valid"; accepts: string[]; expiresAt: string }
  | { status: "invalid"; message: string };

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; percent: number }
  | { status: "done" }
  | { status: "failed"; message: string };

const FILM_STEPS = [
  "Stand where someone doing the job would stand, and start recording.",
  "Walk one slow lap around the work area — all the way around if you can.",
  "Keep the things that get handled in frame: the items, the surfaces, the machine.",
  "About 45 seconds is plenty. Steady beats thorough.",
];

export default function SelfCaptureUpload() {
  const [, params] = useRoute("/capture-upload/:token");
  const token = params?.token ?? "";

  const [link, setLink] = useState<LinkState>({ status: "checking" });
  const [upload, setUpload] = useState<UploadState>({ status: "idle" });
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) {
      setLink({ status: "invalid", message: "This link is missing its code." });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/self-capture/uploads/${encodeURIComponent(token)}`);
        const data = await response.json().catch(() => null);
        if (cancelled) return;

        if (!response.ok || !data?.ok) {
          setLink({
            status: "invalid",
            message: data?.error || "This upload link is not valid or has expired.",
          });
          return;
        }

        setLink({
          status: "valid",
          accepts: Array.isArray(data.accepts) ? data.accepts : ["mov", "mp4"],
          expiresAt: String(data.expiresAt || ""),
        });
      } catch {
        if (!cancelled) {
          setLink({ status: "invalid", message: "We could not check this link. Try again shortly." });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const send = useCallback(
    (file: File) => {
      setFileName(file.name);
      setUpload({ status: "uploading", percent: 0 });

      const body = new FormData();
      body.append("video", file);

      const request = new XMLHttpRequest();
      request.open("POST", `/api/self-capture/uploads/${encodeURIComponent(token)}`);

      request.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;
        setUpload({ status: "uploading", percent: Math.round((event.loaded / event.total) * 100) });
      });

      request.addEventListener("load", () => {
        if (request.status >= 200 && request.status < 300) {
          setUpload({ status: "done" });
          return;
        }
        let message = "The upload did not finish. Try again.";
        try {
          message = JSON.parse(request.responseText)?.error || message;
        } catch {
          // Keep the generic message; the server said nothing we can quote.
        }
        setUpload({ status: "failed", message });
      });

      request.addEventListener("error", () => {
        setUpload({ status: "failed", message: "The connection dropped before the video finished." });
      });

      request.send(body);
    },
    [token],
  );

  const accepts =
    link.status === "valid" ? link.accepts.map((item) => `.${item}`).join(",") : ".mov,.mp4";

  return (
    <div className="ms-container" style={{ paddingBlock: "64px", maxWidth: "640px" }}>
      <Helmet>
        <title>Upload your walkthrough | Blueprint</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <h1 style={{ fontSize: "34px", letterSpacing: "-1.2px", marginBottom: "12px" }}>
        Film the work area
      </h1>

      {link.status === "checking" && (
        <p style={{ color: "var(--ms-muted)" }}>Checking your link…</p>
      )}

      {link.status === "invalid" && (
        <p style={{ color: "var(--ms-muted)" }}>
          {link.message} If you were sent this by email, reply to that message and we will send a
          fresh one.
        </p>
      )}

      {link.status === "valid" && (
        <>
          <p style={{ color: "var(--ms-muted)", marginBottom: "28px" }}>
            One video of one work area. No app, no account, nothing to fill in.
          </p>

          <ol style={{ paddingLeft: "20px", marginBottom: "32px", lineHeight: 1.7 }}>
            {FILM_STEPS.map((step) => (
              <li key={step} style={{ marginBottom: "8px" }}>
                {step}
              </li>
            ))}
          </ol>

          {upload.status === "done" ? (
            <div
              style={{
                border: "1px solid var(--ms-rule)",
                padding: "20px",
                background: "var(--ms-paper)",
              }}
            >
              <strong>That is everything we need.</strong>
              <p style={{ color: "var(--ms-muted)", marginTop: "8px", marginBottom: 0 }}>
                We will turn it into a 3D scene and run the shortlisted robots against it. You do
                not need to do anything else — we will email you when there is something to look at.
              </p>
            </div>
          ) : (
            <>
              <input
                ref={inputRef}
                type="file"
                accept={accepts}
                capture="environment"
                style={{ display: "none" }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) send(file);
                }}
              />

              <button
                type="button"
                className="ms-button"
                disabled={upload.status === "uploading"}
                onClick={() => inputRef.current?.click()}
                style={{
                  background: "var(--ms-green)",
                  color: "var(--ms-paper)",
                  border: "none",
                  padding: "14px 24px",
                  fontSize: "15px",
                  cursor: upload.status === "uploading" ? "default" : "pointer",
                }}
              >
                {upload.status === "uploading" ? "Uploading…" : "Choose or record a video"}
              </button>

              {upload.status === "uploading" && (
                <div style={{ marginTop: "20px" }}>
                  <div
                    role="progressbar"
                    aria-valuenow={upload.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Upload progress"
                    style={{ height: "4px", background: "var(--ms-rule)" }}
                  >
                    <div
                      style={{
                        width: `${upload.percent}%`,
                        height: "100%",
                        background: "var(--ms-green)",
                        transition: "width 200ms ease",
                      }}
                    />
                  </div>
                  <p style={{ color: "var(--ms-muted)", marginTop: "10px", fontSize: "14px" }}>
                    {upload.percent}% — keep this page open{fileName ? ` (${fileName})` : ""}.
                  </p>
                </div>
              )}

              {upload.status === "failed" && (
                <p style={{ color: "var(--ms-muted)", marginTop: "20px" }}>
                  {upload.message} Nothing was saved, so it is safe to pick the video again.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
