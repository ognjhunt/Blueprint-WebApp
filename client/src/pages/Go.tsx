import { useEffect } from "react";

// Fallback page for the bp.link/go universal link
// Redirects to a WebXR experience when supported, otherwise
// provides quick links to open or install the app.
export default function Go() {
  useEffect(() => {
    const checkWebXR = async () => {
      if ("xr" in navigator) {
        try {
          // @ts-ignore - experimental API
          const supported = await navigator.xr.isSessionSupported?.("immersive-ar");
          if (supported) {
            window.location.href = "/webxr";
          }
        } catch {
          // ignore errors and stay on fallback page
        }
      }
    };
    checkWebXR();
  }, []);

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="space-y-4 text-center">
        <p className="text-lg text-gray-700">
          Open the Blueprint app for the best experience.
        </p>
        <div className="flex justify-center gap-4">
          <a
            href="blueprint://open"
            className="text-blue-500 underline"
          >
            Open App
          </a>
          <a
            href="https://apps.apple.com/app/idYOUR_APP_ID"
            className="text-blue-500 underline"
          >
            Get App
          </a>
        </div>
      </div>
    </div>
  );
}
