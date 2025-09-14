import { useEffect } from "react";

export default function Launch() {
  useEffect(() => {
    const appUrl = "blueprint://open"; // custom URL scheme for native app
    const fallbackUrl = "/webxr"; // local fallback route
    const start = Date.now();

    // attempt to open the native app
    window.location.href = appUrl;

    // if the app isn't installed, redirect to fallback after 1.5s
    const timer = setTimeout(() => {
      if (Date.now() - start < 2000) {
        window.location.href = fallbackUrl;
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <p className="text-lg text-gray-700">Launching Blueprint…</p>
    </div>
  );
}
