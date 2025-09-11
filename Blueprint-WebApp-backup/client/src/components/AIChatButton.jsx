import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const AIChatButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);

  const peerConnection = useRef(null);
  const dataChannel = useRef(null);
  const audioElement = useRef(new Audio());
  const streamRef = useRef(null);

  async function createRealtimeSession(inStream, outEl, token) {
    const pc = new RTCPeerConnection();
    pc.ontrack = (e) => (remoteAudioEl.srcObject = e.streams[0]);
    pc.addTrack(localStream.getTracks()[0]);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const headers = {
      Authorization: `Bearer ${"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"}`,
      "Content-Type": "application/sdp",
    };
    const opts = { method: "POST", body: offer.sdp, headers };
    const resp = await fetch("https://api.openai.com/v1/realtime", opts);
    await pc.setRemoteDescription({ type: "answer", sdp: await resp.text() });
    return pc;
  }

  // Initialize WebRTC connection
  const initializeWebRTC = async () => {
    try {
      setIsConnecting(true);

      // Get ephemeral token from your backend
      const tokenResponse = await fetch("/get-openai-token");
      const { client_secret } = await tokenResponse.json();

      // Set up audio playback
      audioElement.current.autoplay = true;

      // Set up data channel and connection
      const pc = await createRealtimeSession(
        streamRef.current,
        audioElement.current,
        client_secret.value,
      );
      peerConnection.current = pc;

      // Set up data channel
      const dc = pc.createDataChannel("oai-events");
      dataChannel.current = dc;

      dc.onmessage = (e) => {
        const event = JSON.parse(e.data);
        if (event.type === "text") {
          setMessages((prev) => [...prev, { content: event.text, isAi: true }]);
        }
      };
    } catch (error) {
      console.error("Error initializing WebRTC:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      if (!peerConnection.current) {
        await initializeWebRTC();
      }

      setIsListening(true);

      // Send initial instruction to AI
      if (dataChannel.current?.readyState === "open") {
        const event = {
          type: "response.create",
          response: {
            modalities: ["text", "speech"],
            instructions:
              "You are a helpful AI assistant. Please respond both verbally and with text.",
          },
        };
        dataChannel.current.send(JSON.stringify(event));
      }
    } catch (error) {
      console.error("Error starting microphone:", error);
    }
  };

  const stopListening = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    setIsListening(false);
  };

  useEffect(() => {
    return () => {
      if (peerConnection.current) {
        peerConnection.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOpen ? (
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      ) : (
        <Card className="p-4 shadow-lg w-80">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">AI Assistant</h3>
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
              ×
            </Button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`p-2 rounded ${
                  message.isAi
                    ? "bg-blue-100 text-blue-900"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                {message.content}
              </div>
            ))}
          </div>

          <div className="flex justify-center">
            <Button
              variant="outline"
              size="icon"
              className={`rounded-full transition-all duration-200 ${
                isListening ? "bg-red-600" : "bg-blue-600"
              } text-white`}
              onClick={isListening ? stopListening : startListening}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : isListening ? (
                <MicOff className="h-6 w-6" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AIChatButton;
