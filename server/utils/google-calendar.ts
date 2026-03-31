import fs from "node:fs";

import { google } from "googleapis";

type GoogleServiceAccountLike = {
  client_email?: string;
  private_key?: string;
};

function loadGoogleServiceAccount(): GoogleServiceAccountLike | null {
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inlineJson) {
    try {
      return JSON.parse(inlineJson) as GoogleServiceAccountLike;
    } catch {
      return null;
    }
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!credentialsPath) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(credentialsPath, "utf8")) as GoogleServiceAccountLike;
  } catch {
    return null;
  }
}

function getGoogleAuth() {
  const serviceAccount = loadGoogleServiceAccount();
  const clientEmail =
    process.env.GOOGLE_CLIENT_EMAIL?.trim() || serviceAccount?.client_email?.trim() || null;
  const privateKey =
    process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n")
    || serviceAccount?.private_key?.replace(/\\n/g, "\n")
    || null;

  if (!clientEmail || !privateKey) {
    throw new Error("Google Workspace credentials are not configured");
  }

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
}

function resolveCalendarId(inputCalendarId?: string | null) {
  const calendarId = inputCalendarId?.trim() || process.env.GOOGLE_CALENDAR_ID?.trim();
  if (!calendarId) {
    throw new Error("GOOGLE_CALENDAR_ID is not configured");
  }
  return calendarId;
}

function parseCalendarDateTime(date?: string | null, time?: string | null) {
  if (!date || !time) {
    throw new Error("Calendar date/time is required");
  }

  const candidate = new Date(`${date}T${time}`);
  if (Number.isNaN(candidate.getTime())) {
    throw new Error("Calendar date/time is invalid");
  }
  return candidate;
}

export async function createGoogleCalendarEvent(params: {
  calendarId?: string | null;
  title: string;
  description: string;
  address: string;
  date: string;
  time: string;
  attendeeEmail?: string | null;
  durationMinutes?: number;
}) {
  const auth = getGoogleAuth();
  const calendarId = resolveCalendarId(params.calendarId);
  const start = parseCalendarDateTime(params.date, params.time);
  const end = new Date(start.getTime() + (params.durationMinutes ?? 60) * 60 * 1000);
  const calendar = google.calendar({ version: "v3", auth });

  const response = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: params.title,
      description: params.description,
      location: params.address,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      attendees: params.attendeeEmail ? [{ email: params.attendeeEmail }] : undefined,
    },
  });

  return response.data.id || null;
}

export async function updateGoogleCalendarEvent(params: {
  calendarId?: string | null;
  eventId: string;
  title?: string | null;
  description?: string | null;
  address?: string | null;
  date: string;
  time: string;
  attendeeEmail?: string | null;
  durationMinutes?: number;
}) {
  const auth = getGoogleAuth();
  const calendarId = resolveCalendarId(params.calendarId);
  const start = parseCalendarDateTime(params.date, params.time);
  const end = new Date(start.getTime() + (params.durationMinutes ?? 60) * 60 * 1000);
  const calendar = google.calendar({ version: "v3", auth });

  await calendar.events.patch({
    calendarId,
    eventId: params.eventId,
    requestBody: {
      summary: params.title || undefined,
      description: params.description || undefined,
      location: params.address || undefined,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      attendees: params.attendeeEmail ? [{ email: params.attendeeEmail }] : undefined,
    },
  });

  return params.eventId;
}
