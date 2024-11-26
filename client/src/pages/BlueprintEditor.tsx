"use client";

import { useState, useEffect, useRef } from "react";
import { createDrawTools, type DrawTools } from "@/lib/drawTools";
import { motion } from "framer-motion";
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
} from "lucide-react";
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

interface ARElement {
  id: string;
  type: "infoCard" | "marker" | "interactive";
  position: { x: number; y: number };
  content: {
    title?: string;
    description?: string;
    trigger?: "proximity" | "click" | "always";
    customData?: Record<string, any>;
  };
}

interface EditorState {
  scale: number;
  position: { x: number; y: number };
  layout: {
    url: string | null;
    name: string | null;
    aspectRatio?: number;
    originalWidth?: number;
    originalHeight?: number;
  };
}

export default function BlueprintEditor() {
  const [elements, setElements] = useState<ARElement[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawTools, setDrawTools] = useState<DrawTools | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedElement, setSelectedElement] = useState<ARElement | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isPanMode, setIsPanMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const { toast } = useToast();
  
  const [editorState, setEditorState] = useState<EditorState>({
    scale: 1,
    position: { x: 0, y: 0 },
    layout: { url: null, name: null },
  });

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

  useEffect(() => {
    if (drawTools) {
      drawTools.updateScale(editorState.scale);
    }
  }, [editorState.scale]);

  const handleFileUpload = async (file: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PNG or JPG image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const result = e.target?.result;
        if (result && typeof result === "string" && containerRef.current) {
          const img = new Image();
          img.onload = () => {
            const containerWidth = containerRef.current?.clientWidth || 800;
            const containerHeight = containerRef.current?.clientHeight || 600;
            
            // Calculate scale to fit image while maintaining aspect ratio
            const scale = Math.min(
              containerWidth / img.width,
              containerHeight / img.height
            ) * 0.8;

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
              position: { 
                x: (containerWidth - (img.width * scale)) / 2,
                y: (containerHeight - (img.height * scale)) / 2
              }
            }));

            setIsLoading(false);
            toast({
              title: "Layout uploaded",
              description: "Your store layout has been uploaded successfully.",
            });
          };
          img.src = result;
        }
      };

      reader.onerror = () => {
        setIsLoading(false);
        toast({
          title: "Upload failed",
          description: "Failed to process the image. Please try again.",
          variant: "destructive",
        });
      };

      reader.readAsDataURL(file);
    } catch (error) {
      setIsLoading(false);
      console.error('Error uploading file:', error);
      toast({
        title: "Upload failed",
        description: "An error occurred while uploading the file.",
        variant: "destructive",
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = () => {
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleZoom = (delta: number) => {
    setEditorState((prev) => ({
      ...prev,
      scale: Math.max(0.1, Math.min(4, prev.scale + delta)),
    }));
  };

  const handlePanStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanMode) {
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
      setEditorState(prev => ({
        ...prev,
        position: { x: newX, y: newY },
      }));
    }
  };

  const handlePanEnd = () => {
    setIsDragging(false);
  };

  const addElement = (type: ARElement["type"]) => {
    const newElement: ARElement = {
      id: `element-${Date.now()}`,
      type,
      position: { x: 50, y: 50 },
      content: {
        title: `New ${type}`,
        description: "",
        trigger: "proximity",
      },
    };
    setElements([...elements, newElement]);
    setSelectedElement(newElement);
  };

  const updateElementPosition = (
    id: string,
    position: { x: number; y: number },
  ) => {
    setElements(
      elements.map((el) => (el.id === id ? { ...el, position } : el)),
    );
  };

  const updateElementContent = (
    id: string,
    content: Partial<ARElement["content"]>,
  ) => {
    setElements(
      elements.map((el) =>
        el.id === id ? { ...el, content: { ...el.content, ...content } } : el,
      ),
    );
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
        {/* Tools Sidebar */}
        <div className="w-64 bg-white border-r p-4">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">AR Elements</h2>
            <div className="space-y-2">
              <Button
                onClick={() => addElement("infoCard")}
                className="w-full justify-start"
                variant="outline"
                disabled={!editorState.layout.url}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Info Card
              </Button>
              <Button
                onClick={() => addElement("marker")}
                className="w-full justify-start"
                variant="outline"
                disabled={!editorState.layout.url}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Marker
              </Button>
              <Button
                onClick={() => addElement("interactive")}
                className="w-full justify-start"
                variant="outline"
                disabled={!editorState.layout.url}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Interactive Element
              </Button>
            </div>

            <div className="space-y-2">
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

            <div className="space-y-2">
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
          className={`flex-1 relative ${isPanMode ? 'cursor-grab' : ''} ${isDragging ? 'cursor-grabbing' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onMouseDown={handlePanStart}
          onMouseMove={handlePanMove}
          onMouseUp={handlePanEnd}
          onMouseLeave={handlePanEnd}
          ref={containerRef}
        >
          <div
            className={`absolute top-0 left-0 w-[200vw] h-[200vh] ${
              showGrid ? "bg-grid-pattern" : ""
            }`}
            style={{
              transform: `translate(${editorState.position.x}px, ${editorState.position.y}px)`,
              transformOrigin: "center",
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              zIndex: 0
            }}
          >
            {editorState.layout.url && (
              <div className="absolute inset-0" style={{ zIndex: 1 }}>
                <img
                  src={editorState.layout.url}
                  alt="Store Layout"
                  className="w-auto h-auto max-w-none"
                  style={{
                    transform: `scale(${editorState.scale})`,
                    transformOrigin: '0 0'
                  }}
                />
              </div>
            )}

            {/* AR Elements */}
            {elements.map((element) => (
              <motion.div
                key={element.id}
                className={`absolute cursor-move p-4 rounded-lg ${
                  selectedElement?.id === element.id
                    ? "ring-2 ring-blue-500"
                    : ""
                }`}
                style={{
                  left: `${element.position.x}%`,
                  top: `${element.position.y}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: 2
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
                onClick={() => setSelectedElement(element)}
              >
                <div className="bg-white shadow-lg rounded-lg p-2">
                  <div className="text-sm font-medium">
                    {element.content.title}
                  </div>
                  <div className="text-xs text-gray-500">{element.type}</div>
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
                        e.target.files?.[0] && handleFileUpload(e.target.files[0])
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
              <div className="absolute inset-0 flex items-center justify-center bg-white/80" style={{ zIndex: 3 }}>
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="ml-2">Processing image...</span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="absolute bottom-4 right-4 space-x-2 z-10">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleZoom(-0.1)}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleZoom(0.1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Properties Panel */}
        {selectedElement && (
          <div className="w-80 bg-white border-l p-4">
            <Card>
              <CardHeader>
                <CardTitle>Element Properties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={selectedElement.content.title}
                    onChange={(e) =>
                      updateElementContent(selectedElement.id, {
                        title: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={selectedElement.content.description}
                    onChange={(e) =>
                      updateElementContent(selectedElement.id, {
                        description: e.target.value,
                      })
                    }
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
                <div className="space-y-2">
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
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}