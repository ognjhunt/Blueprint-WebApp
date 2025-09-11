import React, { useState } from "react";
import { Send, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import axios from "axios";

const GeminiChat = ({ genAI, model, generationConfig }) => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [videoData, setVideoData] = useState(null);

  const videoUrl =
    "https://firebasestorage.googleapis.com/v0/b/blueprint-8c1ca.appspot.com/o/blueprints%2F4CmdCoBe3VmahJQD5R9t%2Fvideos%2Fvideo_annotation_input%2F4CmdCoBe3VmahJQD5R9t%2Fchunk1.mov?alt=media&token=43f8c57c-f65e-4646-ae2e-6e0a15f08585";

  const fetchAndProcessVideo = async () => {
    try {
      const response = await axios.get(videoUrl, {
        responseType: "blob",
      });
      const blob = response.data;
      const base64Data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => resolve(reader.result);
      });
      setVideoData(base64Data);
    } catch (error) {
      console.error("Error fetching or processing video:", error);
    }
  };

  React.useEffect(() => {
    fetchAndProcessVideo();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !videoData) return;

    setIsLoading(true);
    const userMessage = input;
    setInput("");

    try {
      const parts = [
        { text: userMessage },
        {
          inlineData: {
            mimeType: "video/mp4",
            data: videoData.split(",")[1],
          },
        },
      ];

      const result = await model.generateContent({
        contents: [{ role: "user", parts }],
        generationConfig,
      });

      const response = result.response.text();

      setMessages((prev) => [
        ...prev,
        { role: "user", content: userMessage },
        { role: "assistant", content: response },
      ]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: userMessage },
        {
          role: "assistant",
          content: "Sorry, I encountered an error processing your request.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Chat with Gemini</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="h-[300px] overflow-y-auto border rounded-lg p-4 bg-gray-50">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`mb-4 ${
                  message.role === "user" ? "text-right" : "text-left"
                }`}
              >
                <div
                  className={`inline-block max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === "user"
                      ? "bg-primary text-white"
                      : "bg-white border"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message about the video..."
              className="flex-1"
              rows={1}
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim() || !videoData}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};

export default GeminiChat;
