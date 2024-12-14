import React, { useState } from "react";
import { ScreenShare } from "lucide-react";
import { Button } from "@/components/ui/button";

const ScreenShareButton = () => {
  const [isSharing, setIsSharing] = useState(false);

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      setIsSharing(true);

      // When the user stops sharing via the browser UI
      stream.getVideoTracks()[0].onended = () => {
        setIsSharing(false);
      };
    } catch (err) {
      console.error("Error sharing screen:", err);
      setIsSharing(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        onClick={startScreenShare}
        variant={isSharing ? "destructive" : "default"}
        size="icon"
        className="rounded-full h-12 w-12 shadow-lg"
      >
        <ScreenShare className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default ScreenShareButton;
