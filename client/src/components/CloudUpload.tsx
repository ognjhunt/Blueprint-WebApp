import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

declare global {
  interface Window {
    gapi: any;
    google: any;
    OneDrive: any;
  }
}

interface CloudUploadProps {
  onFileSelect: (file: File) => void;
  onLinkSelect?: (url: string) => void;
}

const CloudUpload: React.FC<CloudUploadProps> = ({
  onFileSelect,
  onLinkSelect,
}) => {
  const [gapiLoaded, setGapiLoaded] = useState(false);
  const [gisLoaded, setGisLoaded] = useState(false);

  useEffect(() => {
    const gapiScript = document.createElement("script");
    gapiScript.src = "https://apis.google.com/js/api.js";
    gapiScript.onload = () => setGapiLoaded(true);
    gapiScript.onerror = () =>
      console.error("[CloudUpload] Failed to load gapi (api.js)");
    document.body.appendChild(gapiScript);

    // ADD this script for modern Google Auth
    const gisScript = document.createElement("script");
    gisScript.src = "https://accounts.google.com/gsi/client";
    gisScript.async = true;
    gisScript.defer = true;
    gisScript.onload = () => setGisLoaded(true);
    gisScript.onerror = () =>
      console.error(
        "[CloudUpload] Failed to load Google Identity Services (gsi/client)",
      );
    document.body.appendChild(gisScript);

    const oneDriveScript = document.createElement("script");
    oneDriveScript.src = "https://js.live.net/v7.2/OneDrive.js";
    oneDriveScript.onerror = () =>
      console.error("[CloudUpload] Failed to load OneDrive.js");
    document.body.appendChild(oneDriveScript);
  }, []);

  // ADD: helper to give downloaded files sensible extensions when exporting Google Docs/Sheets/Slides
  const extFor = (mime: string) =>
    ({
      "application/pdf": ".pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        ".xlsx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        ".pptx",
    })[mime] ?? "";

  // Get Google API key from environment

  // REPLACE: handleGoogleDrive
  const handleGoogleDrive = () => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY as string;
    const clientId =
      "744608654760-2jkr2t3632m1qri95dcsasu5fnbotosd.apps.googleusercontent.com"; // (import.meta as any).env.VITE_GOOGLE_CLIENT_ID as string;
    // NEW: numeric Cloud Project number (not the string project ID)
    const appId = "744608654760"; //(import.meta as any).env.VITE_GOOGLE_APP_ID as string;

    // Diagnostic: print which prerequisite is failing (without leaking secrets)
    const mask = (v?: string) =>
      v ? `${v.slice(0, 4)}...${v.slice(-4)}` : "(empty)";

    console.groupCollapsed("[CloudUpload] Google Drive preflight");
    console.table([
      {
        key: "gapiLoaded",
        ok: gapiLoaded,
        detail: `window.gapi=${!!window.gapi}`,
      },
      {
        key: "gisLoaded",
        ok: gisLoaded,
        detail: `window.google=${!!window.google}`,
      },
      { key: "apiKey", ok: !!apiKey, sample: mask(apiKey) },
      { key: "clientId", ok: !!clientId, sample: mask(clientId) },
      {
        key: "appId (numeric project number)",
        ok: !!appId,
        sample: mask(appId),
      },
    ]);
    if (!gapiLoaded)
      console.error("[CloudUpload] Missing: gapiLoaded (api.js not ready)");
    if (!gisLoaded)
      console.error("[CloudUpload] Missing: gisLoaded (GIS not ready)");
    if (!apiKey) console.error("[CloudUpload] Missing: apiKey");
    if (!clientId) console.error("[CloudUpload] Missing: clientId");
    if (!appId)
      console.error(
        "[CloudUpload] Missing: appId (numeric Cloud Project number)",
      );
    console.groupEnd();

    if (!gapiLoaded || !gisLoaded || !apiKey || !clientId || !appId) {
      toast({
        title: "Google Drive unavailable",
        description:
          "Google scripts failed to load or API credentials are missing.",
        variant: "destructive",
      });
      return;
    }

    window.gapi.load("client:picker", async () => {
      try {
        await window.gapi.client.init({
          apiKey,
          discoveryDocs: [
            "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
          ],
        });

        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "https://www.googleapis.com/auth/drive.readonly",
          // First time shows consent; subsequent times can go silent with empty prompt
          prompt: "",
          callback: async (tokenResponse: any) => {
            const accessToken = tokenResponse.access_token;

            // Views: Drive files (with folders + Shared drives). Add upload view if you want Drive upload too.
            const docsView = new window.google.picker.DocsView(
              window.google.picker.ViewId.DOCS,
            )
              .setIncludeFolders(true)
              .setSelectFolderEnabled(false)
              .setEnableDrives(true); // shows Shared drives

            // Optional: let users upload directly into Drive from the picker modal
            const uploadView =
              new window.google.picker.DocsUploadView().setIncludeFolders(true);

            const picker = new window.google.picker.PickerBuilder()
              .addView(docsView)
              .addView(uploadView) // remove if you don’t want upload-in-picker
              .setOAuthToken(accessToken)
              .setDeveloperKey(apiKey)
              .setAppId(appId) // Cloud project number
              .setOrigin(`${window.location.protocol}//${window.location.host}`) // avoids “invalid origin” inside iframes
              .enableFeature(window.google.picker.Feature.SUPPORT_DRIVES)
              .enableFeature(window.google.picker.Feature.NAV_HIDDEN)
              .setCallback(async (data: any) => {
                if (data.action === window.google.picker.Action.PICKED) {
                  const picked = data.docs[0];

                  // Get file metadata to know if it’s a native Google type
                  const metaResp = await fetch(
                    `https://www.googleapis.com/drive/v3/files/${picked.id}?fields=id,name,mimeType,webViewLink`,
                    { headers: { Authorization: `Bearer ${accessToken}` } },
                  );
                  const meta = await metaResp.json();

                  const isGoogleType = (meta.mimeType || "").startsWith(
                    "application/vnd.google-apps",
                  );

                  if (isGoogleType) {
                    const url = meta.webViewLink || picked.url;
                    if (onLinkSelect && url) {
                      onLinkSelect(url);
                    } else {
                      const exportMime =
                        {
                          "application/vnd.google-apps.document":
                            "application/pdf",
                          "application/vnd.google-apps.spreadsheet":
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                          "application/vnd.google-apps.presentation":
                            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                          "application/vnd.google-apps.drawing": "image/png",
                        }[meta.mimeType] || "application/pdf";

                      const res = await fetch(
                        `https://www.googleapis.com/drive/v3/files/${picked.id}/export?mimeType=${encodeURIComponent(
                          exportMime,
                        )}`,
                        { headers: { Authorization: `Bearer ${accessToken}` } },
                      );
                      const blob = await res.blob();
                      onFileSelect(
                        new File([blob], `${meta.name}${extFor(exportMime)}`, {
                          type: exportMime,
                        }),
                      );
                    }
                  } else {
                    // Binary file: download bytes
                    const res = await fetch(
                      `https://www.googleapis.com/drive/v3/files/${picked.id}?alt=media`,
                      { headers: { Authorization: `Bearer ${accessToken}` } },
                    );
                    const blob = await res.blob();
                    onFileSelect(
                      new File([blob], meta.name, {
                        type: meta.mimeType || blob.type,
                      }),
                    );
                  }
                }
              })
              .build();

            picker.setVisible(true);
          },
        });

        tokenClient.requestAccessToken();
      } catch (err) {
        console.error("Google Drive picker error", err);
        toast({
          title: "Google Drive error",
          description: "Unable to open Google Drive picker.",
          variant: "destructive",
        });
      }
    });
  };

  // REPLACE: handleOneDrive
  const handleOneDrive = () => {
    if (!window.OneDrive) {
      window.open("https://onedrive.live.com", "_blank");
      return;
    }

    window.OneDrive.open({
      clientId: (import.meta as any).env.VITE_ONEDRIVE_CLIENT_ID,
      action: "query", // ensures we get metadata and can request more fields
      multiSelect: false,
      // Strongly recommended by MSFT if your app is large or lazy-loads the SDK:
      // (Create the tiny redirect page once, below.)
      advanced: {
        redirectUri: `${window.location.origin}/onedrive-redirect.html`,
        // Ask the picker to return @microsoft.graph.downloadUrl so we can fetch bytes directly
        queryParameters:
          "select=id,name,size,file,folder,@microsoft.graph.downloadUrl,webUrl",
        // Optionally narrow selectable types:
        // filter: "folder,.csv,.xlsx,.pdf"
      },
      success: async (resp: any) => {
        const item = resp?.value?.[0];
        if (!item) return;

        // For most files, the picker already returns a pre-authenticated URL
        // that you can fetch without adding headers.
        const url = item["@microsoft.graph.downloadUrl"] || item.webUrl;
        const r = await fetch(url);
        const b = await r.blob();
        onFileSelect(new File([b], item.name, { type: b.type }));
      },
      cancel: () => {},
      error: (e: any) => {
        console.error("OneDrive picker error", e);
      },
    });
  };

  return (
    <div className="flex gap-2 mt-2 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        onClick={handleGoogleDrive}
        className="text-black"
        disabled={!gapiLoaded || !gisLoaded}
      >
        Connect Google Drive
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOneDrive}
        className="text-black"
      >
        Connect OneDrive
      </Button>
    </div>
  );
};

export default CloudUpload;
