import { Router } from "express";
import { randomUUID } from "crypto";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { GeoPoint, Timestamp } from "firebase-admin/firestore";

const router = Router();

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 12;
const MAX_FETCH = 200;
const DEFAULT_TTL_HOURS = Number(process.env.QR_SESSION_TTL_HOURS ?? 24);

type NearbyVenueResponse = {
  id: string;
  slug: string | null;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number | null;
};

interface PendingSessionRequestBody {
  intent?: string;
  version?: string;
  platform?: string;
  venueId?: string;
  venueName?: string;
  venueSlug?: string;
  coordinates?: {
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
  };
  distanceMeters?: number | null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function haversineDistanceMeters(
  originLat: number,
  originLng: number,
  targetLat: number,
  targetLng: number,
): number {
  const earthRadiusMeters = 6_371_000;
  const dLat = toRadians(targetLat - originLat);
  const dLng = toRadians(targetLng - originLng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(originLat)) *
      Math.cos(toRadians(targetLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadiusMeters * c);
}

router.get("/nearby", async (req, res) => {
  if (!db) {
    return res.status(503).json({ error: "Firestore is not configured." });
  }

  const lat = toFiniteNumber(req.query.lat);
  const lng = toFiniteNumber(req.query.lng);

  const requestedLimit = toFiniteNumber(req.query.limit);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(DEFAULT_LIMIT, requestedLimit ?? DEFAULT_LIMIT),
  );

  const fetchCount = Math.min(MAX_FETCH, Math.max(limit * 4, limit));

  try {
    const snapshot = await db.collection("venues").limit(fetchCount).get();

    const venues: NearbyVenueResponse[] = snapshot.docs
      .map((doc) => {
        const data = doc.data() ?? {};
        const location = data.location || data.geo || data.coordinates;

        const latitude =
          toFiniteNumber(data.latitude) ??
          toFiniteNumber(data.lat) ??
          (location &&
          typeof location.latitude === "number" &&
          Number.isFinite(location.latitude)
            ? location.latitude
            : typeof location._latitude === "number"
            ? location._latitude
            : null);

        const longitude =
          toFiniteNumber(data.longitude) ??
          toFiniteNumber(data.lng) ??
          (location &&
          typeof location.longitude === "number" &&
          Number.isFinite(location.longitude)
            ? location.longitude
            : typeof location._longitude === "number"
            ? location._longitude
            : null);

        const hasCoordinates =
          typeof latitude === "number" && typeof longitude === "number";

        const distanceMeters =
          lat !== null &&
          lng !== null &&
          hasCoordinates
            ? haversineDistanceMeters(lat, lng, latitude!, longitude!)
            : null;

        return {
          id: doc.id,
          slug: data.slug ?? data.handle ?? null,
          name:
            typeof data.displayName === "string" && data.displayName.trim()
              ? data.displayName.trim()
              : typeof data.name === "string" && data.name.trim()
              ? data.name.trim()
              : typeof data.title === "string" && data.title.trim()
              ? data.title.trim()
              : doc.id,
          address:
            typeof data.address === "string" && data.address.trim()
              ? data.address.trim()
              : null,
          city:
            typeof data.city === "string" && data.city.trim()
              ? data.city.trim()
              : null,
          state:
            typeof data.state === "string" && data.state.trim()
              ? data.state.trim()
              : null,
          postalCode:
            typeof data.postalCode === "string" && data.postalCode.trim()
              ? data.postalCode.trim()
              : null,
          latitude: hasCoordinates ? latitude : null,
          longitude: hasCoordinates ? longitude : null,
          distanceMeters,
        } satisfies NearbyVenueResponse;
      })
      .filter((venue) => Boolean(venue));

    venues.sort((a, b) => {
      const aDistance = a.distanceMeters ?? Number.POSITIVE_INFINITY;
      const bDistance = b.distanceMeters ?? Number.POSITIVE_INFINITY;
      if (aDistance !== bDistance) {
        return aDistance - bDistance;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    return res.json({ venues: venues.slice(0, limit) });
  } catch (error) {
    logger.error({ err: error }, "Failed to load nearby venues");
    return res.status(500).json({ error: "Failed to load venues" });
  }
});

router.post("/pending-session", async (req, res) => {
  if (!db) {
    return res.status(503).json({ error: "Firestore is not configured." });
  }

  const { intent, version, platform, venueId, venueName, venueSlug, coordinates, distanceMeters } =
    (req.body ?? {}) as PendingSessionRequestBody;

  if (!intent || !venueId) {
    return res.status(400).json({ error: "Both intent and venueId are required." });
  }

  const token = randomUUID();

  const payload: Record<string, unknown> = {
    intent,
    version: version ?? null,
    platform: platform ?? null,
    venueId,
    venueName: venueName ?? null,
    venueSlug: venueSlug ?? null,
    distanceMeters: distanceMeters ?? null,
    status: "pending",
    userAgent: req.get("user-agent") ?? null,
  };

  const ttlMs = Math.max(1, DEFAULT_TTL_HOURS) * 60 * 60 * 1000;
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + ttlMs));

  payload.createdAt =
    admin?.firestore?.FieldValue?.serverTimestamp?.() ?? new Date();
  payload.expiresAt = expiresAt;

  const lat = toFiniteNumber(coordinates?.lat ?? coordinates?.latitude);
  const lng = toFiniteNumber(coordinates?.lng ?? coordinates?.longitude);

  if (lat !== null && lng !== null) {
    payload.coordinates = new GeoPoint(lat, lng);
    if (toFiniteNumber(coordinates?.accuracy) !== null) {
      payload.locationAccuracy = toFiniteNumber(coordinates?.accuracy);
    }
  }

  try {
    await db.collection("qrSessions").doc(token).set(payload, { merge: true });
    return res.json({ token, expiresAt: expiresAt.toDate().toISOString() });
  } catch (error) {
    logger.error({ err: error }, "Failed to create pending QR session");
    return res.status(500).json({ error: "Failed to create pending session" });
  }
});

export default router;
