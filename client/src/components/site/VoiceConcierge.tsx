import { useMemo, useRef, useState } from "react";
import { Mic, MicOff, PhoneForwarded, Volume2 } from "lucide-react";
import { analyticsEvents } from "@/components/Analytics";
import { withCsrfHeader } from "@/lib/csrf";

type VoiceConciergeProps = {
  surface: string;
  pageContext: string;
};

type VoiceResponse = {
  ok: boolean;
  conversationId?: string;
  responseText?: string;
  handoffRequired?: boolean;
  bookingUrl?: string;
  supportEmail?: string;
  audio?: {
    mimeType: string;
    audioBase64: string;
  } | null;
  error?: string;
};

type BrowserSpeechRecognition = typeof window extends undefined
  ? never
  : {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      start: () => void;
      stop: () => void;
      onresult: ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void) | null;
      onerror: ((event: { error?: string }) => void) | null;
      onend: (() => void) | null;
    };

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    SpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}

function audioDataUrl(audio?: { mimeType: string; audioBase64: string } | null) {
  if (!audio?.audioBase64 || !audio?.mimeType) return null;
  return `data:${audio.mimeType};base64,${audio.audioBase64}`;
}

export function VoiceConcierge({ surface, pageContext }: VoiceConciergeProps) {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const [supported, setSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [responseText, setResponseText] = useState("");
  const [bookingUrl, setBookingUrl] = useState<string | null>(null);
  const [supportEmail, setSupportEmail] = useState<string | null>(null);
  const [error, setError] = useState("");

  const recognitionCtor = useMemo(
    () =>
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null,
    [],
  );

  async function submitTranscript(nextTranscript: string) {
    setIsBusy(true);
    setError("");

    try {
      const response = await fetch("/api/voice/support/respond", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          message: nextTranscript,
          pageContext,
        }),
      });
      const json = (await response.json()) as VoiceResponse;
      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Voice concierge failed");
      }

      setResponseText(json.responseText || "");
      setBookingUrl(json.bookingUrl || null);
      setSupportEmail(json.supportEmail || null);
      analyticsEvents.voiceConciergeCompleted(surface, Boolean(json.handoffRequired));

      const dataUrl = audioDataUrl(json.audio);
      if (dataUrl) {
        const audio = new Audio(dataUrl);
        void audio.play().catch(() => {
          // Ignore autoplay restrictions and leave text response visible.
        });
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Voice concierge failed");
    } finally {
      setIsBusy(false);
    }
  }

  function startListening() {
    analyticsEvents.voiceConciergeStarted(surface);
    setError("");

    if (!recognitionCtor) {
      setSupported(false);
      setError("Voice capture is not supported in this browser.");
      return;
    }

    const recognition = new recognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      const nextTranscript =
        event.results?.[0]?.[0]?.transcript?.trim() || "";
      setTranscript(nextTranscript);
      setIsListening(false);
      if (nextTranscript) {
        void submitTranscript(nextTranscript);
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      setError(event.error || "Voice capture failed");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
    setIsListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Voice Concierge
          </p>
          <h3 className="mt-2 text-xl font-semibold text-zinc-950">
            Ask for the next step out loud
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            This assistant can explain the exact-site hosted-review flow and route you to booking
            or support. It does not quote pricing, legal terms, or rights commitments.
          </p>
        </div>
        <div className="rounded-2xl bg-zinc-100 p-3 text-zinc-700">
          <Volume2 className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={isListening ? stopListening : startListening}
          disabled={isBusy}
          className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {isListening ? "Stop listening" : "Start voice"}
        </button>
        {!supported ? (
          <span className="text-sm text-amber-700">
            Browser voice capture is unavailable here. Use the booking link instead.
          </span>
        ) : null}
        {isBusy ? <span className="text-sm text-zinc-500">Generating response…</span> : null}
      </div>

      {transcript ? (
        <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            You said
          </p>
          <p className="mt-2 text-sm text-zinc-800">{transcript}</p>
        </div>
      ) : null}

      {responseText ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Concierge reply
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-800">{responseText}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {bookingUrl ? (
              <a
                href={bookingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:border-zinc-300"
              >
                <PhoneForwarded className="h-4 w-4" />
                Book review
              </a>
            ) : null}
            {supportEmail ? (
              <a
                href={`mailto:${supportEmail}?subject=Blueprint%20voice%20follow-up`}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:border-zinc-300"
              >
                Email support
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
