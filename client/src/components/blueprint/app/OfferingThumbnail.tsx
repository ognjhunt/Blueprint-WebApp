import { useEffect, useState } from "react";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { fetchAuthenticatedConfiguredSceneThumbnail } from "@/lib/configuredSceneOffering";

export function OfferingThumbnail({
  thumbnailUrl,
  label,
  currentUser,
}: {
  thumbnailUrl: string;
  label: string;
  currentUser: Parameters<typeof withFirebaseAuthHeaders>[0];
}) {
  const [source, setSource] = useState("");
  useEffect(() => {
    if (!currentUser) return undefined;
    let objectUrl = "";
    let cancelled = false;
    void withFirebaseAuthHeaders(currentUser)
      .then((headers) => fetchAuthenticatedConfiguredSceneThumbnail(
        thumbnailUrl,
        headers,
      ))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch(() => setSource(""));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [currentUser, thumbnailUrl]);
  return source ? (
    <img
      src={source}
      alt={label}
      className="aspect-video w-full bg-ink-50 object-cover"
    />
  ) : (
    <div className="flex aspect-video items-center justify-center bg-ink-50 text-caption text-ink-400">
      Loading private thumbnail…
    </div>
  );
}

