'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Ruler, Move, Plus, Settings, Save, Grid, Minus, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import Nav from "@/components/Nav"

interface ARElement {
  id: string;
  type: 'infoCard' | 'marker' | 'interactive';
  position: { x: number; y: number };
  content: {
    title?: string;
    description?: string;
    trigger?: 'proximity' | 'click' | 'always';
    customData?: Record<string, any>;
  };
}

interface EditorState {
  scale: number;
  position: { x: number; y: number };
  layout: {
    url: string | null;
    name: string | null;
  };
}

export default function BlueprintEditor() {
  const [elements, setElements] = useState<ARElement[]>([])
  const [selectedElement, setSelectedElement] = useState<ARElement | null>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [editorState, setEditorState] = useState<EditorState>({
    scale: 1,
    position: { x: 0, y: 0 },
    layout: { url: null, name: null }
  })
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const { toast } = useToast()

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (PNG, JPG)",
        variant: "destructive"
      })
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result
      if (result && typeof result === 'string') {
        setEditorState(prev => ({
          ...prev,
          layout: {
            url: result,
            name: file.name
          }
        }))
        toast({
          title: "Layout uploaded",
          description: "Your store layout has been uploaded successfully."
        })
      }
    }
    reader.readAsDataURL(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingFile(true)
  }

  const handleDragLeave = () => {
    setIsDraggingFile(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingFile(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const handleZoom = (delta: number) => {
    setEditorState(prev => ({
      ...prev,
      scale: Math.max(0.1, Math.min(4, prev.scale + delta))
    }))
  }

  const handlePan = (direction: 'up' | 'down' | 'left' | 'right') => {
    const delta = 50
    setEditorState(prev => ({
      ...prev,
      position: {
        x: prev.position.x + (direction === 'left' ? delta : direction === 'right' ? -delta : 0),
        y: prev.position.y + (direction === 'up' ? delta : direction === 'down' ? -delta : 0)
      }
    }))
  }

  const addElement = (type: ARElement['type']) => {
    const newElement: ARElement = {
      id: `element-${Date.now()}`,
      type,
      position: { x: 50, y: 50 },
      content: {
        title: `New ${type}`,
        description: '',
        trigger: 'proximity'
      }
    }
    setElements([...elements, newElement])
    setSelectedElement(newElement)
  }

  const updateElementPosition = (id: string, position: { x: number; y: number }) => {
    setElements(elements.map(el => 
      el.id === id ? { ...el, position } : el
    ))
  }

  const updateElementContent = (id: string, content: Partial<ARElement['content']>) => {
    setElements(elements.map(el =>
      el.id === id ? { ...el, content: { ...el.content, ...content } } : el
    ))
  }

  const saveLayout = () => {
    // Here you would typically save to your backend
    console.log('Saving layout:', elements)
    toast({
      title: "Layout Saved",
      description: "Your AR element layout has been saved successfully."
    })
  }

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
                onClick={() => addElement('infoCard')}
                className="w-full justify-start"
                variant="outline"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Info Card
              </Button>
              <Button 
                onClick={() => addElement('marker')}
                className="w-full justify-start"
                variant="outline"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Marker
              </Button>
              <Button 
                onClick={() => addElement('interactive')}
                className="w-full justify-start"
                variant="outline"
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
            </div>
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 relative overflow-hidden"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div 
            className={`w-full h-full relative editor-container ${showGrid ? 'bg-grid-pattern' : 'bg-white'}`}
            style={{
              transform: `scale(${editorState.scale}) translate(${editorState.position.x}px, ${editorState.position.y}px)`,
              transformOrigin: 'center'
            }}
          >
            {editorState.layout.url ? (
              <div className="absolute inset-0">
                <img 
                  src={editorState.layout.url} 
                  alt="Store Layout"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className={`absolute inset-0 flex items-center justify-center ${isDraggingFile ? 'bg-blue-50' : ''}`}>
                <div className="text-center p-6 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500">Drag and drop your store layout or floor plan (PNG, JPG)</p>
                  <p className="text-sm text-gray-400 mt-1">Required for placing AR elements accurately</p>
                  <p className="text-sm text-gray-400 mt-1">or</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    className="mt-2 text-sm text-gray-500"
                  />
                </div>
              </div>
            )}
            {elements.map((element) => (
              <motion.div
                key={element.id}
                className={`absolute cursor-move p-4 rounded-lg z-10 ${
                  selectedElement?.id === element.id ? 'ring-2 ring-blue-500' : ''
                }`}
                style={{
                  left: `${element.position.x}%`,
                  top: `${element.position.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                drag
                dragMomentum={false}
                onDragEnd={(event, info) => {
                  const container = event.target.closest('.editor-container')
                  if (container) {
                    const bounds = container.getBoundingClientRect()
                    const x = ((info.point.x - bounds.left) / bounds.width) * 100
                    const y = ((info.point.y - bounds.top) / bounds.height) * 100
                    updateElementPosition(element.id, {
                      x: Math.max(0, Math.min(100, x)),
                      y: Math.max(0, Math.min(100, y))
                    })
                  }
                }}
                onClick={() => setSelectedElement(element)}
              >
                <div className="bg-white shadow-lg rounded-lg p-2">
                  <div className="text-sm font-medium">{element.content.title}</div>
                  {element.type === 'infoCard' && (
                    <div className="text-xs text-gray-500">Info Card</div>
                  )}
                  {element.type === 'marker' && (
                    <div className="text-xs text-gray-500">Marker</div>
                  )}
                  {element.type === 'interactive' && (
                    <div className="text-xs text-gray-500">Interactive</div>
                  )}
                </div>
              </motion.div>
            ))}
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
                    onChange={(e) => updateElementContent(selectedElement.id, { title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={selectedElement.content.description}
                    onChange={(e) => updateElementContent(selectedElement.id, { description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Trigger Type</Label>
                  <Select
                    value={selectedElement.content.trigger}
                    onValueChange={(value) => updateElementContent(selectedElement.id, { 
                      trigger: value as 'proximity' | 'click' | 'always' 
                    })}
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
                      <Label className="text-xs">X: {selectedElement.position.x.toFixed(1)}%</Label>
                      <Input
                        type="range"
                        min="0"
                        max="100"
                        value={selectedElement.position.x}
                        onChange={(e) => updateElementPosition(selectedElement.id, {
                          ...selectedElement.position,
                          x: parseFloat(e.target.value)
                        })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Y: {selectedElement.position.y.toFixed(1)}%</Label>
                      <Input
                        type="range"
                        min="0"
                        max="100"
                        value={selectedElement.position.y}
                        onChange={(e) => updateElementPosition(selectedElement.id, {
                          ...selectedElement.position,
                          y: parseFloat(e.target.value)
                        })}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="fixed bottom-4 right-4 space-y-2">
        <div className="flex space-x-2 mb-2">
          <Button onClick={() => handleZoom(0.1)} size="sm">
            <Plus className="w-4 h-4" />
          </Button>
          <Button onClick={() => handleZoom(-0.1)} size="sm">
            <Minus className="w-4 h-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <Button onClick={() => handlePan('left')} size="sm">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="grid grid-cols-1 gap-1">
            <Button onClick={() => handlePan('up')} size="sm">
              <ChevronUp className="w-4 h-4" />
            </Button>
            <Button onClick={() => handlePan('down')} size="sm">
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
          <Button onClick={() => handlePan('right')} size="sm">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button onClick={saveLayout} size="lg" className="w-full">
          <Save className="w-4 h-4 mr-2" />
          Save Layout
        </Button>
      </div>
    </div>
  )
}
