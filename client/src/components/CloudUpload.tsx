import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    gapi: any;
    google: any;
    OneDrive: any;
  }
}

interface CloudUploadProps {
  onFileSelect: (file: File) => void;
}

const CloudUpload: React.FC<CloudUploadProps> = ({ onFileSelect }) => {
  useEffect(() => {
    const gapiScript = document.createElement("script");
    gapiScript.src = "https://apis.google.com/js/api.js";
    document.body.appendChild(gapiScript);

    const oneDriveScript = document.createElement("script");
    oneDriveScript.src = "https://js.live.net/v7.2/OneDrive.js";
    document.body.appendChild(oneDriveScript);
  }, []);

  const handleGoogleDrive = () => {
    const apiKey = (import.meta as any).env.VITE_GOOGLE_API_KEY;
    const clientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID;

    if (window.gapi && window.google && apiKey && clientId) {
      window.gapi.load("client:picker", async () => {
        try {
          await window.gapi.client.load("https://www.googleapis.com/discovery/v1/apis/drive/v3/rest");
          const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: "https://www.googleapis.com/auth/drive.readonly",
            callback: async (tokenResponse: any) => {
              const view = new window.google.picker.DocsView().setIncludeFolders(true);
              const picker = new window.google.picker.PickerBuilder()
                .addView(view)
                .setOAuthToken(tokenResponse.access_token)
                .setDeveloperKey(apiKey)
                .setCallback(async (data: any) => {
                  if (data.action === window.google.picker.Action.PICKED) {
                    const file = data.docs[0];
                    const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
                      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                    });
                    const blob = await resp.blob();
                    onFileSelect(new File([blob], file.name));
                  }
                })
                .build();
              picker.setVisible(true);
            },
          });
          tokenClient.requestAccessToken();
        } catch (err) {
          console.error("Google Drive picker error", err);
          window.open("https://drive.google.com", "_blank");
        }
      });
    } else {
      window.open("https://drive.google.com", "_blank");
    }
  };

  const handleOneDrive = () => {
    if (window.OneDrive) {
      window.OneDrive.open({
        clientId: (import.meta as any).env.VITE_ONEDRIVE_CLIENT_ID,
        action: "download",
        multiSelect: false,
        advanced: { redirectUri: window.location.href },
        success: async (files: any) => {
          const file = files.value[0];
          const resp = await fetch(file["@microsoft.graph.downloadUrl"]);
          const blob = await resp.blob();
          onFileSelect(new File([blob], file.name));
        },
        cancel: () => {},
        error: (e: any) => {
          console.error("OneDrive picker error", e);
        },
      });
    } else {
      window.open("https://onedrive.live.com", "_blank");
    }
  };

  return (
    <div className="flex gap-2 mt-2 flex-wrap">
      <Button variant="outline" size="sm" onClick={handleGoogleDrive}>
        Connect Google Drive
      </Button>
      <Button variant="outline" size="sm" onClick={handleOneDrive}>
        Connect OneDrive
      </Button>
    </div>
  );
};

export default CloudUpload;
