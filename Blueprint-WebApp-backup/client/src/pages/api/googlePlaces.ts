import { Request, Response } from "express";

// NOTE: Move your real Google API key into an environment variable in .env
// e.g. process.env.GOOGLE_PLACES_API_KEY
// For demonstration, we'll keep it inline here so you can see the code changes.
const apiKey = process.env.GOOGLE_PLACES_API_KEY || "API_KEY";

export default async function handler(
  req: Request,
  res: Response,
) {
  try {
    const { address, businessName } = req.query;

    if (!address) {
      return res.status(400).json({ error: "Missing address parameter." });
    }

    // 1) Attempt Street View
    const formattedAddress = encodeURIComponent(address as string);
    const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${formattedAddress}&key=${apiKey}`;

    const svResponse = await fetch(metadataUrl);
    const svData = await svResponse.json();

    if (svData.status === "OK") {
      const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${formattedAddress}&key=${apiKey}`;
      return res.status(200).json({ imageUrl: streetViewUrl });
    }

    // 2) Fallback to Places API
    const searchQuery = businessName
      ? encodeURIComponent(`${businessName} ${address}`)
      : formattedAddress;

    const placesUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${searchQuery}&inputtype=textquery&fields=photos,place_id,name&key=${apiKey}`;

    const placesResponse = await fetch(placesUrl);
    const placesData = await placesResponse.json();

    if (
      placesData.status === "OK" &&
      placesData.candidates &&
      placesData.candidates.length > 0
    ) {
      const place = placesData.candidates[0];
      if (place.photos && place.photos.length > 0) {
        const photoReference = place.photos[0].photo_reference;
        const placesPhotoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photoreference=${photoReference}&key=${apiKey}`;
        return res.status(200).json({ imageUrl: placesPhotoUrl });
      }
    }

    // 3) If nothing found
    return res
      .status(404)
      .json({ error: "No images available from Google APIs" });
  } catch (error: any) {
    console.error("Error fetching location image:", error);
    return res
      .status(500)
      .json({ error: "Server error fetching location image." });
  }
}
