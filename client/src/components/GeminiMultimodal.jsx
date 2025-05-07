import React, { useEffect, useState, useRef } from "react";
import { useLiveAPIContext } from "@/contexts/LiveAPIContext";
import { MessageCircle, Camera, Loader2, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const GeminiMultimodal = () => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [audioQueue, setAudioQueue] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);

  const { client, isConnected, sendMessage } = useLiveAPIContext();
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const isListeningRef = useRef(false);

  // Handle incoming messages from Gemini
  useEffect(() => {
    if (client) {
      const handleMessage = async (response) => {
        console.log("Received response:", response);

        if (response.serverContent?.modelTurn?.parts) {
          const parts = response.serverContent.modelTurn.parts;

          for (const part of parts) {
            // Handle text responses
            if (part.text) {
              setMessages((prev) => [
                ...prev,
                { content: part.text, isAi: true },
              ]);
            }

            // Handle audio responses
            if (part.inlineData?.mimeType?.startsWith("audio/")) {
              try {
                console.log("Processing audio response");
                const audioContext = new AudioContext();
                const arrayBuffer = new Uint8Array(
                  atob(part.inlineData.data)
                    .split("")
                    .map((char) => char.charCodeAt(0)),
                ).buffer;

                const audioBuffer =
                  await audioContext.decodeAudioData(arrayBuffer);
                setAudioQueue((prev) => [...prev, audioBuffer]);
              } catch (error) {
                console.error("Error processing audio:", error);
              }
            }
          }
        }
      };

      client.on("message", handleMessage);
      return () => client.off("message", handleMessage);
    }
  }, [client]);

  // Handle audio playback queue
  useEffect(() => {
    const playNextInQueue = async () => {
      if (audioQueue.length > 0 && !isPlaying) {
        setIsPlaying(true);
        const audioContext = new AudioContext();
        const source = audioContext.createBufferSource();
        source.buffer = audioQueue[0];
        source.connect(audioContext.destination);

        source.onended = () => {
          setIsPlaying(false);
          setAudioQueue((prev) => prev.slice(1));
        };

        source.start(0);
      }
    };

    if (audioQueue.length > 0 && !isPlaying) {
      playNextInQueue();
    }
  }, [audioQueue, isPlaying]);

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (isListeningRef.current && isConnected) {
          const audioData = e.inputBuffer.getChannelData(0);
          const pcmData = new Int16Array(audioData.length);

          for (let i = 0; i < audioData.length; i++) {
            pcmData[i] = audioData[i] * 0x7fff;
          }

          // Send audio data to Gemini
          sendMessage({
            media_chunks: [
              {
                mimeType: "audio/pcm;bits=16;rate=16000",
                data: btoa(
                  String.fromCharCode(...new Uint8Array(pcmData.buffer)),
                ),
              },
            ],
          });
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsListening(true);
      isListeningRef.current = true;

      // Add initial message to request speech response
      sendMessage({
        client_content: {
          parts: [{ text: "Please respond with both text and speech" }],
        },
      });
    } catch (error) {
      console.error("Error starting audio:", error);
    }
  };

  const stopListening = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setIsListening(false);
    isListeningRef.current = false;
  };

  const handleScreenCapture = async () => {
    try {
      setIsProcessing(true);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false,
      });

      const videoTrack = stream.getVideoTracks()[0];
      const imageCapture = new ImageCapture(videoTrack);
      const bitmap = await imageCapture.grabFrame();

      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(bitmap, 0, 0);

      const imageData = canvas.toDataURL("image/jpeg");
      stream.getTracks().forEach((track) => track.stop());

      sendMessage({
        client_content: {
          parts: [
            { text: "What do you see in this screen?" },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: imageData.split(",")[1],
              },
            },
          ],
          turn_complete: true,
        },
      });
    } catch (error) {
      console.error("Error capturing screen:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="p-4 shadow-lg flex flex-col gap-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            className={`rounded-full transition-all duration-200 ${
              isListening ? "bg-red-600" : "bg-blue-600"
            } text-white`}
            onClick={isListening ? stopListening : startListening}
          >
            {isListening ? (
              <MicOff className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full transition-all duration-200 bg-blue-600 text-white"
            onClick={handleScreenCapture}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Camera className="h-6 w-6" />
            )}
          </Button>
        </div>
        {messages.length > 0 && (
          <div className="max-h-48 overflow-y-auto space-y-2">
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
        )}
      </Card>
    </div>
  );
};

export default GeminiMultimodal;
