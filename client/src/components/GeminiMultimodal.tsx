import React, { useEffect, useState, useRef } from "react";
import { useLiveAPIContext } from "@/contexts/LiveAPIContext";
import { MessageCircle, Camera, Loader2, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const GeminiMultimodal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState([
    {
      content: "Share your screen or start speaking - I'm here to help!",
      isAi: true,
    },
  ]);

  const { client, isConnected, sendMessage } = useLiveAPIContext();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (client) {
      const handleMessage = async (response: any) => {
        console.log("Client message received:", response);

        if (response.serverContent?.modelTurn?.parts) {
          const parts = response.serverContent.modelTurn.parts;
          console.log("Processing model turn parts:", parts);

          for (const part of parts) {
            if (part.text) {
              setMessages((prev) => [
                ...prev,
                { content: part.text, isAi: true },
              ]);
            }
            if (part.inlineData?.mimeType?.startsWith("audio/")) {
              console.log("Processing audio response:", part.inlineData);
              const audioContext = new AudioContext();
              const arrayBuffer = new Uint8Array(
                atob(part.inlineData.data)
                  .split("")
                  .map((char) => char.charCodeAt(0)),
              ).buffer;
              const audioBuffer =
                await audioContext.decodeAudioData(arrayBuffer);
              const source = audioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContext.destination);
              source.start();
            }
          }
        }
      };

      client.on("message", handleMessage);
      return () => client.off("message", handleMessage);
    }
  }, [client]);

  const isListeningRef = useRef(false); // Add this at the top with other refs

  const startListening = async () => {
    console.log("Starting audio capture...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      console.log("Audio stream obtained:", {
        streamActive: stream.active,
        audioTracks: stream.getAudioTracks().length,
      });

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        console.log("Audio processor called:", {
          isListening: isListeningRef.current,
          isConnected,
        });

        if (isListeningRef.current && isConnected) {
          const audioData = e.inputBuffer.getChannelData(0);
          console.log("Audio processing:", {
            isListening: isListeningRef.current,
            isConnected,
            bufferSize: audioData.length,
            sampleRate: e.inputBuffer.sampleRate,
          });

          const pcmData = new Int16Array(audioData.length);
          for (let i = 0; i < audioData.length; i++) {
            pcmData[i] = audioData[i] * 0x7fff;
          }

          console.log("Sending audio chunk:", {
            pcmLength: pcmData.length,
            bufferType: pcmData.buffer.constructor.name,
          });

          const audioChunk = {
            audio_stream: {
              mime_type: "audio/pcm;bits=16;rate=16000",
              data: btoa(
                String.fromCharCode(...new Uint8Array(pcmData.buffer)),
              ),
            },
          };

          sendMessage({
            contents: [
              {
                parts: [audioChunk],
              },
            ],
            stream: true,
          });
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsListening(true);
      isListeningRef.current = true;

      console.log("Listening state set to true");
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
    isListeningRef.current = false; // Update ref here too
    console.log("Listening stopped");
  };

  const handleScreenCapture = async () => {
    try {
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
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex gap-2">
      <Button
        variant="outline"
        size="icon"
        className={`rounded-full shadow-lg hover:shadow-xl transition-all duration-200 ${
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
        className="rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-blue-600 text-white"
        onClick={handleScreenCapture}
      >
        <Camera className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default GeminiMultimodal;
