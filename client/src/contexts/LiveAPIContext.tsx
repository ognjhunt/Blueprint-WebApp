// LiveAPIContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { EventEmitter } from "eventemitter3";
import { difference } from "lodash";

const API_KEY = "AIzaSyCyyCfGsXRnIRC9HSVVuCMN5grzPkyTtkY";

interface StreamingLog {
  date: Date;
  type: string;
  message: any;
}

interface LiveConfig {
  model: string;
  generationConfig: {
    responseModalities: string[];
    speechConfig: {
      voice: string;
    };
  };
}

interface GenerativeContentBlob {
  mimeType: string;
  data: string;
}

class MultimodalLiveClient extends EventEmitter {
  public ws: WebSocket | null = null;
  protected config: LiveConfig | null = null;
  public url: string;
  private setupComplete: boolean = false;
  private setupSent: boolean = false;

  constructor({ url, apiKey }: { url?: string; apiKey: string }) {
    super();
    url =
      url ||
      `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;
    url += `?key=${apiKey}`;
    this.url = url;
    this.send = this.send.bind(this);
  }

  log(type: string, message: StreamingLog["message"]) {
    const log: StreamingLog = {
      date: new Date(),
      type,
      message,
    };
    this.emit("log", log);
  }

  connect(config: LiveConfig): Promise<boolean> {
    this.config = config;
    const ws = new WebSocket(this.url);
    this.setupComplete = false;
    this.setupSent = false;

    return new Promise((resolve, reject) => {
      ws.addEventListener("message", async (evt: MessageEvent) => {
        if (evt.data instanceof Blob) {
          try {
            const json = await evt.data.text();
            const response = JSON.parse(json);
            console.log("Received message:", response);

            if (response.setupResponse && !this.setupComplete) {
              console.log("Setup completed successfully");
              this.setupComplete = true;
              this.setupSent = false;
            }

            this.emit("message", response);

            if (response.serverContent?.modelTurn) {
              console.log(
                "Model turn content:",
                response.serverContent.modelTurn,
              );
              this.emit("content", response.serverContent);
            }
          } catch (error) {
            console.error("Error processing message:", error);
          }
        } else {
          console.log("non blob message", evt);
        }
      });

      ws.addEventListener("error", (ev: Event) => {
        this.disconnect();
        const message = `Could not connect to "${this.url}"`;
        this.log(`server.${ev.type}`, message);
        reject(new Error(message));
      });

      ws.addEventListener("open", (ev: Event) => {
        this.log(`client.${ev.type}`, `connected to socket`);
        this.emit("open");
        this.ws = ws;

        const setupMessage = {
          setup: {
            model: "models/gemini-2.0-flash-exp",
            stream: true,
            generationConfig: {
              responseModalities: ["TEXT", "SPEECH"],
              candidateCount: 1,
              maxOutputTokens: 1024,
              temperature: 0.9,
              topP: 1,
              topK: 1,
              stopSequences: [],
              speechConfig: {
                voice: "Charon",
              },
            },
          },
        };

        const sendSetup = () => {
          if (
            !this.setupComplete &&
            this.ws?.readyState === WebSocket.OPEN &&
            !this.setupSent
          ) {
            console.log("Sending setup message...");
            this._sendDirect(setupMessage);
            this.setupSent = true;

            setTimeout(() => {
              if (!this.setupComplete) {
                console.log("Setup not acknowledged, retrying...");
                sendSetup();
              }
            }, 1000);
          }
        };

        sendSetup();
        resolve(true);
      });

      ws.addEventListener("close", (ev: CloseEvent) => {
        this.log(`server.${ev.type}`, `disconnected ${ev.reason || ""}`);
        this.ws = null;
        this.setupComplete = false;
        this.setupSent = false;
        this.emit("close", ev);

        if (!this.setupComplete) {
          console.log("Attempting to reconnect...");
          setTimeout(() => {
            this.connect(config).catch(console.error);
          }, 2000);
        }
      });
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.setupComplete = false;
      this.setupSent = false;
      this.log("client.close", `Disconnected`);
      return true;
    }
    return false;
  }

  send(parts: any[] | any, turnComplete: boolean = true) {
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
    this.log(`client.send`, clientContentRequest);
  }

  sendRealtimeInput(chunks: GenerativeContentBlob[]) {
    if (!this.setupComplete) {
      console.warn("Cannot send realtime input before setup is complete");
      return;
    }

    console.log("Sending realtime input:", {
      chunksLength: chunks.length,
      firstChunkType: chunks[0]?.constructor.name,
      firstChunkLength: chunks[0]?.byteLength,
    });

    const data = {
      realtimeInput: {
        mediaChunks: chunks.map((chunk) => ({
          mimeType: "audio/pcm;bits=16;rate=16000",
          data: chunk.data,
        })),
      },
    };
    this._sendDirect(data);
    this.log(`client.realtimeInput`, "audio data");
  }

  _sendDirect(request: object) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }
    const str = JSON.stringify(request);
    console.log("Sending message:", str);
    this.ws.send(str);
  }
}

interface LiveAPIContextType {
  client: MultimodalLiveClient | null;
  isConnected: boolean;
  sendMessage: (message: any) => void;
  setConfig: (config: any) => void;
}

const LiveAPIContext = createContext<LiveAPIContextType | null>(null);

export const LiveAPIProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const clientRef = useRef<MultimodalLiveClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [config] = useState({
    model: "models/gemini-2.0-flash-exp",
    generationConfig: {
      responseModalities: ["TEXT", "SPEECH"],
      candidateCount: 1,
      maxOutputTokens: 1024,
      temperature: 0.9,
      topP: 1,
      topK: 1,
      stopSequences: [],
      speechConfig: {
        voice: "Charon",
      },
    },
  });

  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = new MultimodalLiveClient({ apiKey: API_KEY });

      clientRef.current.on("open", () => {
        console.log("WebSocket connection opened");
        setIsConnected(true);
      });

      clientRef.current.on("close", () => {
        console.log("WebSocket connection closed");
        setIsConnected(false);
      });

      console.log("Attempting to connect to WebSocket with config:", config);
      clientRef.current.connect(config).catch((error) => {
        console.error("WebSocket connection error:", error);
      });
    }

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (!clientRef.current) return;

    if (message.media_chunks) {
      clientRef.current.sendRealtimeInput(message.media_chunks);
    } else {
      clientRef.current.send(message.client_content?.parts || message, true);
    }
  }, []);

  const setConfig = useCallback((newConfig: any) => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current.connect(newConfig).catch((error) => {
        console.error("WebSocket connection error:", error);
      });
    }
  }, []);

  return (
    <LiveAPIContext.Provider
      value={{
        client: clientRef.current,
        isConnected,
        sendMessage,
        setConfig,
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
