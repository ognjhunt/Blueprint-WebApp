"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createDrawTools, type DrawTools } from "@/lib/drawTools";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ruler,
  Move,
  Plus,
  Settings,
  Save,
  Grid,
  Minus,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Loader2,
  Hand,
  MessageCircle,
  Send,
  RotateCw,
  AlignStartHorizontal,
  AlignStartVertical,
  Layers,
  Copy,
  Trash2,
  Square,
  Eye,
  Pencil,
  PlusCircle,
  Text,
} from "lucide-react";

import {
  MapPin,
  Touchpad,
  Search,
  Image,
  Video,
  Circle,
  Square as SquareIcon,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import Nav from "@/components/Nav";

interface Position {
  x: number;
  y: number;
}

interface ElementContent {
  title: string;
  description: string;
  trigger: "proximity" | "click" | "always";
  mediaUrl?: string;
  mediaType?: "image" | "video";
}

const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file || !selectedElement) return;

  try {
    const url = await createImageUrl(file);
    updateElementContent(selectedElement.id, {
      mediaUrl: url,
      mediaType: file.type.startsWith("image/") ? "image" : "video",
    });
  } catch (error) {
    console.error("Media upload error:", error);
    toast({
      title: "Upload Failed",
      description: "Failed to upload media. Please try again.",
      variant: "destructive",
    });
  }
};
interface Zone {
  id: string;
  name: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface ARElement {
  id: string;
  type: "infoCard" | "marker" | "interactive" | "media" | "shape" | "label";
  position: Position;
  content: ElementContent;
}

interface EditorState {
  layout: {
    url: string;
    name: string;
    aspectRatio: number;
    originalWidth: number;
    originalHeight: number;
  };
  scale: number;
  containerScale: number;
  position: Position;
  rotation: number;
  snapToGrid: boolean;
  isPlacementMode: boolean;
}

interface Message {
  content: string;
  isAi: boolean;
}

// Helper functions
const createImageFromFile = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

const availableElements = [
  {
    id: "label",
    type: "label",
    name: "Label",
    category: "labels",
    icon: <Text className="h-6 w-6" />,
  },
  {
    id: "infoCard",
    type: "infoCard",
    name: "Info Card",
    category: "infoCard",
    icon: <Card className="h-6 w-6" />,
  },
  {
    id: "marker",
    type: "marker",
    name: "Marker",
    category: "marker",
    icon: <MapPin className="h-6 w-6" />,
  },
  {
    id: "interactive",
    type: "interactive",
    name: "Interactive",
    category: "interactive",
    icon: <Touchpad className="h-6 w-6" />,
  },
  {
    id: "image",
    type: "media",
    name: "Image",
    category: "media",
    icon: <Image className="h-6 w-6" />,
  },
  {
    id: "video",
    type: "media",
    name: "Video",
    category: "media",
    icon: <Video className="h-6 w-6" />,
  },
];

const createImageUrl = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function BlueprintEditor() {
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [promptPosition, setPromptPosition] = useState({ x: 0, y: 0 });
  const [promptInput, setPromptInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentStep, setCurrentStep] = useState(0);
  const [elements, setElements] = useState<ARElement[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawTools, setDrawTools] = useState<DrawTools | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [selectedElement, setSelectedElement] = useState<ARElement | null>(
    null,
  );
  const [showGrid, setShowGrid] = useState(true);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isPanMode, setIsPanMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      content:
        "Hello! I can help you edit your Blueprint. What would you like to do?",
      isAi: true,
    },
  ]);
  const { toast } = useToast();

  const [editorState, setEditorState] = useState<EditorState>({
    layout: {
      url: "",
      name: "",
      aspectRatio: 1,
      originalWidth: 0,
      originalHeight: 0,
    },
    scale: 1,
    containerScale: 1,
    position: { x: 0, y: 0 },
    rotation: 0,
    snapToGrid: false,
    isPlacementMode: false,
  });

  const [zones, setZones] = useState<Zone[]>([]);
  const [isDefiningZone, setIsDefiningZone] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showPreviewMode, setShowPreviewMode] = useState(false);

  useEffect(() => {
    if (containerRef.current) {
      const tools = createDrawTools({
        containerRef,
        scale: editorState.scale,
        gridSize: 20,
      });
      setDrawTools(tools);
    }
  }, [containerRef.current]);

  const filteredElements = availableElements.filter((element) => {
    const matchesSearch = element.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || element.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  useEffect(() => {
    if (drawTools) {
      drawTools.updateScale(editorState.scale);
    }
  }, [editorState.scale]);

  const createImageFromFile = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image"));
      };

      img.src = url;
    });
  };

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    try {
      // File size check (10MB limit)
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(
          `File size exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`,
        );
      }

      const img = await createImageFromFile(file);

      // Dimension checks
      const MAX_DIMENSION = 5000;
      if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
        throw new Error(
          `Image dimensions exceed ${MAX_DIMENSION}x${MAX_DIMENSION} limit (${img.width}x${img.height})`,
        );
      }

      const result = await createImageUrl(file);

      // Calculate scale to fit the container while maintaining aspect ratio
      const containerWidth = containerRef.current?.clientWidth || 800;
      const containerHeight = containerRef.current?.clientHeight || 600;
      const scale = Math.min(
        containerWidth / img.width,
        containerHeight / img.height,
      );

      setEditorState((prev) => ({
        ...prev,
        layout: {
          url: result,
          name: file.name,
          aspectRatio: img.width / img.height,
          originalWidth: img.width,
          originalHeight: img.height,
        },
        scale: scale,
        containerScale: scale,
        position: {
          x: (containerWidth - img.width * scale) / 2,
          y: (containerHeight - img.height * scale) / 2,
        },
        isPlacementMode: true, // Automatically enter placement mode
      }));
    } catch (error) {
      console.error("Image upload error:", error);
      toast({
        title: "Upload Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to load the image. Please try again.",
        variant: "destructive",
      });
      throw error; // Re-throw to ensure proper error handling
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = () => {
    setIsDraggingFile(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);

    const file = e.dataTransfer.files[0];
    if (file && (file.type === "image/png" || file.type === "image/jpeg")) {
      await handleFileUpload(file);
    }
  };

  const handleZoom = (delta: number) => {
    setEditorState((prev) => {
      const newScale = Math.max(0.1, Math.min(3, prev.scale + delta));
      return {
        ...prev,
        scale: newScale,
        containerScale: newScale,
      };
    });
  };

  const handlePanStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanMode && e.button === 0) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - editorState.position.x,
        y: e.clientY - editorState.position.y,
      });
    }
  };

  const handlePanMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanMode && isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      setEditorState((prev) => ({
        ...prev,
        position: { x: newX, y: newY },
      }));
    }
  };

  const handlePanEnd = () => {
    setIsDragging(false);
  };

  const handleRotation = (degrees: number) => {
    setEditorState((prev) => ({
      ...prev,
      rotation: (prev.rotation + degrees) % 360,
    }));
  };

  const handleAlign = (direction: "horizontal" | "vertical") => {
    if (!containerRef.current || !editorState.layout.url) return;

    const container = containerRef.current.getBoundingClientRect();
    const newPosition = { ...editorState.position };

    if (direction === "horizontal") {
      newPosition.x =
        (container.width -
          (editorState.layout.originalWidth || 0) * editorState.scale) /
        2;
    } else {
      newPosition.y =
        (container.height -
          (editorState.layout.originalHeight || 0) * editorState.scale) /
        2;
    }

    setEditorState((prev) => ({
      ...prev,
      position: newPosition,
    }));
  };

  const addElement = (type: ARElement["type"] | "shape" | "media") => {
    const newElement: ARElement = {
      id: `element-${Date.now()}`,
      type,
      position: { x: 50, y: 50 },
      content: {
        title: `New ${type}`,
        description: "Description here",
        trigger: "click",
      },
    };
    setElements((prev) => [...prev, newElement]);
    setSelectedElement(newElement);
  };

  const updateElementPosition = (id: string, position: Position) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, position } : el)),
    );
  };

  const updateElementContent = (
    id: string,
    content: Partial<ElementContent>,
  ) => {
    const updatedElement = elements.find((el) => el.id === id);
    if (!updatedElement) return;

    const newContent = { ...updatedElement.content, ...content };

    // Update both states atomically
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, content: newContent } : el)),
    );

    setSelectedElement((prev) =>
      prev?.id === id ? { ...prev, content: newContent } : prev,
    );
  };

  const handleDuplicateElement = (element: ARElement) => {
    const newElement = {
      ...element,
      id: `element-${Date.now()}`,
      position: {
        x: element.position.x + 5,
        y: element.position.y + 5,
      },
    };
    setElements((prev) => [...prev, newElement]);
  };

  const handleDeleteElement = (elementId: string) => {
    setElements((prev) => prev.filter((el) => el.id !== elementId));
    setSelectedElement(null);
  };

  const handleLayerOrder = (
    elementId: string,
    direction: "forward" | "backward",
  ) => {
    setElements((prev) => {
      const index = prev.findIndex((el) => el.id === elementId);
      if (index === -1) return prev;

      const newElements = [...prev];
      const element = newElements[index];

      if (direction === "forward" && index < newElements.length - 1) {
        newElements.splice(index, 1);
        newElements.splice(index + 1, 0, element);
      } else if (direction === "backward" && index > 0) {
        newElements.splice(index, 1);
        newElements.splice(index - 1, 0, element);
      }

      return newElements;
    });
  };

  const saveLayout = () => {
    if (!editorState.layout.url) {
      toast({
        title: "No layout",
        description: "Please upload a floor plan before saving.",
        variant: "destructive",
      });
      return;
    }

    try {
      localStorage.setItem(
        "blueprint-layout",
        JSON.stringify({
          elements,
          layout: editorState.layout,
        }),
      );
      toast({
        title: "Layout Saved",
        description: "Your AR element layout has been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save layout. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = useCallback(async () => {
    if (!input.trim()) return;

    const userMessage = { content: input, isAi: false };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              "Bearer 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",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini", // using gpt-4 as requested (gpt4o-mini)
            messages: [
              ...messages
                .filter((m) => !m.isAi)
                .map((m) => ({ role: "user", content: m.content })),
              { role: "user", content: input },
            ],
          }),
        },
      );

      const data = await response.json();
      if (data && data.choices && data.choices.length > 0) {
        const aiMessage = {
          content: data.choices[0].message.content.trim(),
          isAi: true,
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        setMessages((prev) => [
          ...prev,
          { content: "Sorry, I couldn't understand your request.", isAi: true },
        ]);
      }
    } catch (error) {
      console.error("OpenAI API error:", error);
      setMessages((prev) => [
        ...prev,
        { content: "There was an error processing your request.", isAi: true },
      ]);
    }
  }, [input, messages]);

  // Load saved layout from localStorage on mount
  useEffect(() => {
    const savedLayout = localStorage.getItem("blueprint-layout");
    if (savedLayout) {
      try {
        const { elements: savedElements, layout } = JSON.parse(savedLayout);
        setElements(savedElements);
        setEditorState((prev) => ({
          ...prev,
          layout,
        }));
      } catch (error) {
        console.error("Error loading saved layout:", error);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <Nav />
      <div className="pt-16 flex h-[calc(100vh-4rem)]">
        {/* Chat Button */}
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 right-4 z-50 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-blue-600 text-white"
          onClick={() => setIsChatOpen(true)}
        >
          <MessageCircle className="h-6 w-6" />
        </Button>

        {/* Floating Chat Box */}
        {isChatOpen && (
          <div className="fixed bottom-20 right-4 bg-white rounded shadow p-4 w-80 z-50">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <h3 className="text-lg font-semibold">Blueprint Editor AI</h3>
                <p className="text-sm text-gray-500">
                  How can I help you with your Blueprint today?
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsChatOpen(false)}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M6 18L18 6M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </Button>
            </div>
            <div className="h-[300px] overflow-y-auto p-4 space-y-4 border rounded-md mt-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.isAi ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`rounded-lg p-3 max-w-[80%] ${
                      msg.isAi
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              />
              <Button size="icon" onClick={handleSendMessage}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Tools Sidebar */}
        <div
          className="w-64 bg-white/95 backdrop-blur-sm border-r p-4 fixed top-16 left-0 bottom-0 overflow-y-auto shadow-lg z-[100] transition-all duration-200 ease-in-out pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Elements</h2>

            {/* Search Bar */}
            <div className="relative">
              <Input
                type="text"
                placeholder="Search elements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
              <Search className="absolute right-2 top-2 h-5 w-5 text-gray-400" />
            </div>

            {/* Categories */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Categories</h3>
              <Button
                onClick={() => setSelectedCategory("all")}
                className={`w-full justify-start ${selectedCategory === "all" ? "bg-primary text-white" : "bg-white"}`}
                variant="outline"
              >
                All Elements
              </Button>
              <Button
                onClick={() => setSelectedCategory("infoCard")}
                className={`w-full justify-start ${selectedCategory === "infoCard" ? "bg-primary text-white" : "bg-white"}`}
                variant="outline"
              >
                Info Cards
              </Button>
              <Button
                onClick={() => setSelectedCategory("marker")}
                className={`w-full justify-start ${selectedCategory === "marker" ? "bg-primary text-white" : "bg-white"}`}
                variant="outline"
              >
                Markers
              </Button>
              <Button
                onClick={() => setSelectedCategory("interactive")}
                className={`w-full justify-start ${selectedCategory === "interactive" ? "bg-primary text-white" : "bg-white"}`}
                variant="outline"
              >
                Interactive Elements
              </Button>

              <Button
                onClick={() => setSelectedCategory("media")}
                className={`w-full justify-start ${selectedCategory === "media" ? "bg-primary text-white" : "bg-white"}`}
                variant="outline"
              >
                Media
              </Button>
              <Button
                onClick={() => setSelectedCategory("labels")}
                className={`w-full justify-start ${selectedCategory === "labels" ? "bg-primary text-white" : "bg-white"}`}
                variant="outline"
              >
                Labels
              </Button>
            </div>

            {/* Elements List */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Elements</h3>
              <div className="grid grid-cols-2 gap-2">
                {filteredElements.map((elementType) => (
                  <div
                    key={elementType.id}
                    className="flex flex-col items-center justify-center p-2 border rounded cursor-pointer hover:bg-gray-100"
                    onClick={() => addElement(elementType.type)}
                  >
                    {elementType.icon}
                    <span className="text-xs mt-1 text-center">
                      {elementType.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* View Options */}
            <div className="space-y-2 mt-4">
              <h3 className="text-sm font-medium">View Options</h3>
              <Button
                onClick={() => setShowGrid(!showGrid)}
                className="w-full justify-start"
                variant={showGrid ? "default" : "outline"}
              >
                <Grid className="w-4 h-4 mr-2" />
                Show Grid
              </Button>
              <Button
                onClick={() => setIsPanMode(!isPanMode)}
                className="w-full justify-start"
                variant={isPanMode ? "default" : "outline"}
              >
                <Hand className="w-4 h-4 mr-2" />
                Pan Tool
              </Button>
            </div>

            {/* Actions */}
            <div className="space-y-2 mt-4">
              <h3 className="text-sm font-medium">Actions</h3>
              <Button
                onClick={saveLayout}
                className="w-full justify-start"
                disabled={!editorState.layout.url}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Layout
              </Button>
            </div>
          </div>
        </div>

        {/* Main Editor Area */}
        <div
          className={`flex-1 relative ml-64 min-h-[calc(100vh-4rem)] isolate ${isPanMode ? "cursor-grab" : ""} ${isDragging ? "cursor-grabbing" : ""} ${
            editorState.isPlacementMode
              ? "ring-2 ring-primary ring-opacity-50"
              : ""
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onMouseDown={handlePanStart}
          onMouseMove={handlePanMove}
          onMouseUp={handlePanEnd}
          onMouseLeave={handlePanEnd}
          onContextMenu={(e) => {
            e.preventDefault();
            // Store the actual mouse coordinates
            const x = Math.min(e.clientX, window.innerWidth - 250); // Prevent overflow
            const y = Math.min(e.clientY, window.innerHeight - 100); // Prevent overflow
            setPromptPosition({ x, y });
            setShowAiPrompt(true);
          }}
          ref={containerRef}
        >
          <div
            className={`absolute top-0 left-0 w-[200vw] h-[200vh] ${
              showGrid ? "bg-grid-pattern" : ""
            }`}
            style={{
              transform: `translate(${editorState.position.x}px, ${editorState.position.y}px) scale(${editorState.containerScale})`,
              transformOrigin: "center",
              transition: isDragging ? "none" : "transform 0.1s ease-out",
              zIndex: 0,
            }}
          >
            {editorState.layout.url && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ zIndex: 1 }}
              >
                <img
                  src={editorState.layout.url}
                  alt="Store Layout"
                  className="w-auto h-auto max-w-none"
                  style={{
                    transformOrigin: "center center",
                  }}
                />
              </div>
            )}

            {/* AR Elements */}
            {elements.map((element) => (
              <motion.div
                key={element.id}
                className={`absolute cursor-move p-4 rounded-lg group ${
                  selectedElement?.id === element.id
                    ? "ring-2 ring-blue-500"
                    : ""
                }`}
                style={{
                  left: `${element.position.x}%`,
                  top: `${element.position.y}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: 2,
                }}
                drag
                dragMomentum={false}
                onDragEnd={(event: any, info) => {
                  if (containerRef.current) {
                    const bounds = containerRef.current.getBoundingClientRect();
                    const x =
                      ((info.point.x - bounds.left) / bounds.width) * 100;
                    const y =
                      ((info.point.y - bounds.top) / bounds.height) * 100;
                    updateElementPosition(element.id, {
                      x: Math.max(0, Math.min(100, x)),
                      y: Math.max(0, Math.min(100, y)),
                    });
                  }
                }}
                onDoubleClick={() => setSelectedElement(element)}
                initial={{ scale: 1 }}
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <div className="bg-gradient-to-br from-gray-700 to-gray-800 text-white rounded-xl p-4 relative transition-all duration-200 shadow-lg group-hover:shadow-xl">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {element.content.title}
                    <Pencil className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-white" />
                  </div>
                  <div className="text-xs text-white/80">{element.type}</div>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-75 transition-opacity pointer-events-none whitespace-nowrap">
                    Double-tap to edit
                  </div>
                </div>
              </motion.div>
            ))}

            {!editorState.layout.url && !isLoading && (
              <div
                className={`absolute inset-0 flex items-center justify-center ${
                  isDraggingFile ? "bg-blue-50" : ""
                }`}
                style={{ zIndex: 1 }}
              >
                <div className="text-center p-6 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500">
                    Drag and drop your store layout or floor plan (PNG, JPG)
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Required for placing AR elements accurately
                  </p>
                  <p className="text-sm text-gray-400 mt-1">or</p>
                  <Label className="cursor-pointer mt-2 inline-block">
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      className="hidden"
                      onChange={(e) =>
                        e.target.files?.[0] &&
                        handleFileUpload(e.target.files[0])
                      }
                    />
                    <span className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90">
                      Choose File
                    </span>
                  </Label>
                </div>
              </div>
            )}

            {isLoading && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-white/80"
                style={{ zIndex: 3 }}
              >
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="ml-2">Processing image...</span>
              </div>
            )}

            {showAiPrompt && (
              <div
                style={{
                  position: "fixed",
                  left: `${promptPosition.x}px`,
                  top: `${promptPosition.y}px`,
                  zIndex: 9999,
                }}
                className="bg-white border rounded shadow p-2"
              >
                <Input
                  type="text"
                  placeholder="What would you like to see at this location?"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  className="border p-1 w-48"
                />
                <Button
                  onClick={() => {
                    // Handle AI logic here. For example:
                    // send promptInput to your AI endpoint and then place an element at promptPosition.
                    setShowAiPrompt(false);
                    setPromptInput("");
                  }}
                  className="mt-2"
                >
                  Submit
                </Button>
              </div>
            )}
          </div>

          {/* Placement Mode Button */}
          {editorState.layout.url && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
              <Button
                variant={editorState.isPlacementMode ? "default" : "secondary"}
                onClick={() =>
                  setEditorState((prev) => ({
                    ...prev,
                    isPlacementMode: !prev.isPlacementMode,
                  }))
                }
                className="shadow-lg bg-primary text-white hover:bg-primary/90"
                size="lg"
              >
                {editorState.isPlacementMode ? (
                  <>
                    <Pencil className="w-4 h-4 mr-2" />
                    Editing Layout
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Place AR Elements
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Controls */}
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 space-x-2 z-[100]">
            <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm p-2 rounded-lg shadow-lg">
              <div className="space-x-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleZoom(-0.1)}
                  title="Zoom Out"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleZoom(0.1)}
                  title="Zoom In"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-x-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleRotation(-90)}
                  title="Rotate Left"
                >
                  <RotateCw className="h-4 w-4 -scale-x-100" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleRotation(90)}
                  title="Rotate Right"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-x-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleAlign("horizontal")}
                  title="Align Horizontally"
                >
                  <AlignStartHorizontal className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleAlign("vertical")}
                  title="Align Vertically"
                >
                  <AlignStartVertical className="h-4 w-4" />
                </Button>
              </div>

              <Button
                variant={editorState.snapToGrid ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setEditorState((prev) => ({
                    ...prev,
                    snapToGrid: !prev.snapToGrid,
                  }))
                }
                className="ml-2"
              >
                <Grid className="h-4 w-4 mr-2" />
                Snap to Grid
              </Button>
            </div>
          </div>

          {/* Properties Panel */}
          <AnimatePresence>
            {selectedElement && (
              <motion.div
                className="w-80 bg-white/95 backdrop-blur-sm border-l p-4 fixed top-16 right-0 bottom-0 shadow-lg z-50 overflow-y-auto"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Element Properties</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={selectedElement.content.title}
                        onChange={(e) =>
                          updateElementContent(selectedElement.id, {
                            title: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        value={selectedElement.content.description}
                        onChange={(e) =>
                          updateElementContent(selectedElement.id, {
                            description: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="trigger">Trigger Type</Label>
                      <Select
                        value={selectedElement.content.trigger}
                        onValueChange={(value) =>
                          updateElementContent(selectedElement.id, {
                            trigger: value as "proximity" | "click" | "always",
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select trigger type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="click">Click</SelectItem>
                          <SelectItem value="proximity">Proximity</SelectItem>
                          <SelectItem value="always">Always</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedElement.type === "media" && (
                      <div className="space-y-2">
                        <Label>Media Upload</Label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                          {selectedElement.content.mediaUrl ? (
                            <div className="space-y-2">
                              {selectedElement.content.mediaType === "image" ? (
                                <img
                                  src={selectedElement.content.mediaUrl}
                                  alt="Uploaded media"
                                  className="max-w-full h-auto rounded"
                                />
                              ) : (
                                <video
                                  src={selectedElement.content.mediaUrl}
                                  controls
                                  className="max-w-full h-auto rounded"
                                />
                              )}
                              <Button
                                variant="destructive"
                                size="sm"
                                className="w-full"
                                onClick={() =>
                                  updateElementContent(selectedElement.id, {
                                    mediaUrl: undefined,
                                    mediaType: undefined,
                                  })
                                }
                              >
                                Remove Media
                              </Button>
                            </div>
                          ) : (
                            <div className="text-center">
                              <Input
                                type="file"
                                accept={
                                  selectedElement.type === "image"
                                    ? "image/*"
                                    : "video/*"
                                }
                                className="hidden"
                                id="media-upload"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    try {
                                      const url = await createImageUrl(file);
                                      updateElementContent(selectedElement.id, {
                                        mediaUrl: url,
                                        mediaType: file.type.startsWith("image")
                                          ? "image"
                                          : "video",
                                      });
                                    } catch (error) {
                                      toast({
                                        title: "Upload Failed",
                                        description:
                                          "Failed to upload media. Please try again.",
                                        variant: "destructive",
                                      });
                                    }
                                  }
                                }}
                              />
                              <Label
                                htmlFor="media-upload"
                                className="cursor-pointer flex flex-col items-center justify-center gap-2"
                              >
                                <div className="p-2 bg-primary/10 rounded-full">
                                  {selectedElement.type === "image" ? (
                                    <Image className="w-6 h-6 text-primary" />
                                  ) : (
                                    <Video className="w-6 h-6 text-primary" />
                                  )}
                                </div>
                                <span className="text-sm text-gray-500">
                                  Click to upload {selectedElement.type}
                                </span>
                              </Label>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={selectedElement.content.title}
                        onChange={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          updateElementContent(selectedElement.id, {
                            title: e.target.value,
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                        className="focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input
                        value={selectedElement.content.description}
                        onChange={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          updateElementContent(selectedElement.id, {
                            description: e.target.value,
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                        className="focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Trigger Type</Label>
                      <Select
                        value={selectedElement.content.trigger}
                        onValueChange={(value) =>
                          updateElementContent(selectedElement.id, {
                            trigger: value as "proximity" | "click" | "always",
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="proximity">Proximity</SelectItem>
                          <SelectItem value="click">Click</SelectItem>
                          <SelectItem value="always">Always Visible</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label>Position</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">
                              X: {selectedElement.position.x.toFixed(1)}%
                            </Label>
                            <Input
                              type="range"
                              min="0"
                              max="100"
                              value={selectedElement.position.x}
                              onChange={(e) =>
                                updateElementPosition(selectedElement.id, {
                                  ...selectedElement.position,
                                  x: parseFloat(e.target.value),
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs">
                              Y: {selectedElement.position.y.toFixed(1)}%
                            </Label>
                            <Input
                              type="range"
                              min="0"
                              max="100"
                              value={selectedElement.position.y}
                              onChange={(e) =>
                                updateElementPosition(selectedElement.id, {
                                  ...selectedElement.position,
                                  y: parseFloat(e.target.value),
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Layer Management</Label>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleLayerOrder(selectedElement.id, "forward")
                            }
                            className="flex-1"
                          >
                            <Layers className="h-4 w-4 mr-2" />
                            Bring Forward
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleLayerOrder(selectedElement.id, "backward")
                            }
                            className="flex-1"
                          >
                            <Layers className="h-4 w-4 mr-2 rotate-180" />
                            Send Backward
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Element Actions</Label>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleDuplicateElement(selectedElement)
                            }
                            className="flex-1"
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              handleDeleteElement(selectedElement.id)
                            }
                            className="flex-1"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
