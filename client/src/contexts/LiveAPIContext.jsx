import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { EventEmitter } from "eventemitter3";

import { getGoogleGenerativeAiKey } from "@/lib/client-env";

const GOOGLE_GENAI_KEY = getGoogleGenerativeAiKey();

class MultimodalLiveClient extends EventEmitter {
  constructor({ apiKey }) {
    super();
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    this.url = url;
    this.ws = null;
    this.setupComplete = true;
    this.setupSent = false;
  }

  connect(config) {
    const ws = new WebSocket(this.url);
    this.setupComplete = true;
    this.setupSent = false;

    return new Promise((resolve, reject) => {
      ws.addEventListener("message", async (evt) => {
        if (evt.data instanceof Blob) {
          const json = await evt.data.text();
          const response = JSON.parse(json);

          if (response.setupResponse && !this.setupComplete) {
            this.setupComplete = true;
            this.setupSent = false;
          }

          this.emit("message", response);

          if (response.serverContent?.modelTurn) {
            this.emit("content", response.serverContent);
          }
        }
      });

      ws.addEventListener("open", () => {
        this.ws = ws;
        this.emit("open");

        const setupMessage = {
          setup: {
            model: "models/gemini-2.0-flash-exp",
            stream: true,
            generationConfig: {
              responseModalities: ["TEXT", "SPEECH"],
              candidateCount: 1,
              maxOutputTokens: 1024,
              temperature: 0.3,
              topP: 1,
              topK: 1,
              stopSequences: [],
              speechConfig: {
                voice: "Charon",
              },
            },
          },
        };

        this._sendDirect(setupMessage);
        resolve(true);
      });

      ws.addEventListener("error", () => {
        this.disconnect();
        reject(new Error(`WebSocket connection failed`));
      });

      ws.addEventListener("close", () => {
        this.ws = null;
        // this.setupComplete = false;
        this.setupSent = false;
        this.emit("close");
      });
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.setupComplete = false;
      this.setupSent = false;
      return true;
    }
    return false;
  }

  send(parts, turnComplete = true) {
    if (!this.setupComplete) {
      console.warn("Cannot send message before setup is complete");
      return;
    }

    const content = {
      role: "user",
      parts: Array.isArray(parts) ? parts : [parts],
    };

    const clientContentRequest = {
      clientContent: {
        turns: [content],
        turnComplete,
      },
    };

    this._sendDirect(clientContentRequest);
  }

  sendRealtimeInput(chunks) {
    if (!this.setupComplete) return;

    const data = {
      realtimeInput: {
        mediaChunks: chunks.map((chunk) => ({
          mimeType: chunk.mimeType || "audio/pcm;bits=16;rate=16000",
          data: chunk.data,
        })),
      },
    };

    this._sendDirect(data);
  }

  _sendDirect(request) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }
    this.ws.send(JSON.stringify(request));
  }
}

const LiveAPIContext = createContext(null);

export const LiveAPIProvider = ({ children }) => {
  const clientRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!clientRef.current && GOOGLE_GENAI_KEY) {
      clientRef.current = new MultimodalLiveClient({
        apiKey: GOOGLE_GENAI_KEY,
      });

      clientRef.current.on("open", () => setIsConnected(true));
      clientRef.current.on("close", () => setIsConnected(false));

      clientRef.current
        .connect()
        .catch((error) => console.error("LiveAPI connection error", error));
    }

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, []);

  const sendMessage = useCallback((message) => {
    if (!clientRef.current) return;

    if (message.media_chunks) {
      clientRef.current.sendRealtimeInput(message.media_chunks);
    } else {
      clientRef.current.send(message.client_content?.parts || message, true);
    }
  }, []);

  return (
    <LiveAPIContext.Provider
      value={{
        client: clientRef.current,
        isConnected,
        sendMessage,
      }}
    >
      {children}
    </LiveAPIContext.Provider>
  );
};

export const useLiveAPIContext = () => {
  const context = useContext(LiveAPIContext);
  if (!context) {
    throw new Error("useLiveAPIContext must be used within a LiveAPIProvider");
  }
  return context;
};
