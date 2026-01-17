// AreaMarkingSystem.tsx - The main component that orchestrates the area marking experience

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Square,
  Hexagon,
  Locate,
  X,
  Check,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  Move,
  Tag,
  Maximize,
  Lock,
  Unlock,
  LucideExpand,
  PenTool,
  Ruler,
  ArrowRight,
  ChevronRight,
  Info,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  AreaMarkingSystemProps,
  AreaColor,
  AreaCategory,
  MarkedArea,
  NewAreaDetails,
} from "../types/AreaMarkingStyles";

// Constants
const AREA_COLORS: AreaColor[] = [
  {
    name: "Blue",
    value: "#3b82f6",
    hover: "#2563eb",
    bgOpacity: "bg-blue-500/20",
    borderOpacity: "border-blue-500/50",
  },
  {
    name: "Green",
    value: "#10b981",
    hover: "#059669",
    bgOpacity: "bg-green-500/20",
    borderOpacity: "border-green-500/50",
  },
  {
    name: "Purple",
    value: "#8b5cf6",
    hover: "#7c3aed",
    bgOpacity: "bg-purple-500/20",
    borderOpacity: "border-purple-500/50",
  },
  {
    name: "Amber",
    value: "#f59e0b",
    hover: "#d97706",
    bgOpacity: "bg-amber-500/20",
    borderOpacity: "border-amber-500/50",
  },
  {
    name: "Red",
    value: "#ef4444",
    hover: "#dc2626",
    bgOpacity: "bg-red-500/20",
    borderOpacity: "border-red-500/50",
  },
  {
    name: "Pink",
    value: "#ec4899",
    hover: "#db2777",
    bgOpacity: "bg-pink-500/20",
    borderOpacity: "border-pink-500/50",
  },
  {
    name: "Cyan",
    value: "#06b6d4",
    hover: "#0891b2",
    bgOpacity: "bg-cyan-500/20",
    borderOpacity: "border-cyan-500/50",
  },
  {
    name: "Teal",
    value: "#14b8a6",
    hover: "#0d9488",
    bgOpacity: "bg-teal-500/20",
    borderOpacity: "border-teal-500/50",
  },
];

const AREA_CATEGORIES: AreaCategory[] = [
  { id: "room", name: "Room", icon: <Square className="h-4 w-4" /> },
  { id: "zone", name: "Zone", icon: <Hexagon className="h-4 w-4" /> },
  {
    id: "point",
    name: "Point of Interest",
    icon: <Locate className="h-4 w-4" />,
  },
];

// Main Area Marking System Component
export const AreaMarkingSystem: React.FC<AreaMarkingSystemProps> = ({
  isActive,
  setIsActive,
  markedAreas = [],
  onAreaMarked,
  onAreaUpdated,
  onAreaDeleted,
  isViewMode3D = true,
}) => {
  // States for the new area being marked
  const [markingMode, setMarkingMode] = useState<string | null>(null); // 'box', 'polygon', 'smart'
  const [isMarking, setIsMarking] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<MarkedArea | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [newAreaDetails, setNewAreaDetails] = useState<NewAreaDetails>({
    name: "",
    color: AREA_COLORS[0].value,
    category: "room",
    notes: "",
    tags: [],
    isLocked: false,
    showMeasurements: true,
  });

  const { toast } = useToast();

  // Show onboarding when first activated
  useEffect(() => {
    if (isActive && !sessionStorage.getItem("area-marking-onboarded")) {
      setShowOnboarding(true);
    }
  }, [isActive]);

  // Handle initial entry into marking mode
  const handleStartMarking = () => {
    setIsActive(true);
    setIsPanelOpen(true);
    setShowOnboarding(true);
    toast({
      title: "Area Marking Activated",
      description: "Select a marking method to start defining areas",
    });
  };

  // Handle area selection
  const handleSelectArea = (area: MarkedArea) => {
    setSelectedArea(area);
    setIsPanelOpen(true);
  };

  // Complete the marking process
  const handleFinishMarking = (areaBounds: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  }) => {
    // Here we would integrate with your current onAreaMarked functionality
    setIsMarking(false);
    setMarkingMode(null);

    // Return area data with calculated dimensions
    const area: MarkedArea = {
      id: `area-${Date.now()}`,
      name: newAreaDetails.name || "Unnamed Area",
      color: newAreaDetails.color,
      category: newAreaDetails.category,
      min: areaBounds.min,
      max: areaBounds.max,
      // Calculate dimensions
      dimensions: {
        width: Math.abs(areaBounds.max.x - areaBounds.min.x).toFixed(2),
        length: Math.abs(areaBounds.max.z - areaBounds.min.z).toFixed(2),
        height: Math.abs(areaBounds.max.y - areaBounds.min.y).toFixed(2),
        area: (
          Math.abs(areaBounds.max.x - areaBounds.min.x) *
          Math.abs(areaBounds.max.z - areaBounds.min.z)
        ).toFixed(2),
      },
      notes: newAreaDetails.notes,
      tags: newAreaDetails.tags,
      isLocked: newAreaDetails.isLocked,
      showMeasurements: newAreaDetails.showMeasurements,
      createdAt: new Date(),
    };

    onAreaMarked(area);

    // Reset new area details
    setNewAreaDetails({
      name: "",
      color: AREA_COLORS[0].value,
      category: "room",
      notes: "",
      tags: [],
      isLocked: false,
      showMeasurements: true,
    });

    toast({
      title: "Area Marked Successfully",
      description: `"${area.name}" has been added to your blueprint`,
    });
  };

  // Handle exit from marking mode
  const handleExitMarkingMode = () => {
    if (isMarking) {
      // Ask for confirmation if actively marking
      if (
        confirm(
          "Are you sure you want to exit area marking? Your current area will be discarded.",
        )
      ) {
        setIsMarking(false);
        setMarkingMode(null);
        setIsActive(false);
        setIsPanelOpen(false);
      }
    } else {
      setIsActive(false);
      setIsPanelOpen(false);
    }
  };

  // Mark onboarding as complete
  const completeOnboarding = () => {
    sessionStorage.setItem("area-marking-onboarded", "true");
    setShowOnboarding(false);
  };

  return (
    <>
      {/* Floating Action Button for activating marking mode */}
      {!isActive && (
        <motion.div
          className="fixed bottom-24 right-8 z-40"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleStartMarking}
                  className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 shadow-lg group relative"
                >
                  <span className="absolute inset-0 rounded-full bg-white bg-opacity-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <PenTool className="h-6 w-6 text-white" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Mark Areas</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </motion.div>
      )}

      {/* Onboarding Overlay */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-xl p-6 max-w-md shadow-2xl"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 30,
                delay: 0.1,
              }}
            >
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Maximize className="h-8 w-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">
                  Mark Areas
                </h2>
                <p className="text-gray-600 mt-2">
                  Create precisely defined areas in your blueprint for analytics
                  and workflows
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-start space-x-3">
                  <div className="mt-0.5 bg-blue-100 p-1.5 rounded-full">
                    <Square className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Box Selection</h3>
                    <p className="text-sm text-gray-500">
                      Quickly draw rectangular areas by defining opposite
                      corners
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="mt-0.5 bg-purple-100 p-1.5 rounded-full">
                    <PenTool className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Polygon Selection</h3>
                    <p className="text-sm text-gray-500">
                      Create custom shapes by defining multiple points
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="mt-0.5 bg-green-100 p-1.5 rounded-full">
                    <LucideExpand className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Smart Detection</h3>
                    <p className="text-sm text-gray-500">
                      Automatically detect room boundaries based on your model
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    completeOnboarding();
                    setIsActive(false);
                    setIsPanelOpen(false);
                  }}
                >
                  Skip for now
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white"
                  onClick={completeOnboarding}
                >
                  Get Started
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Marking Interface Panel */}
      <AnimatePresence>
        {isActive && (
          <>
            {/* Marking Mode Indicator */}
            <motion.div
              className="fixed top-20 left-1/2 -translate-x-1/2 z-40 flex items-center bg-white/90 backdrop-blur-sm py-2 px-4 rounded-full shadow-lg"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              <div className="text-sm font-medium text-gray-700 flex items-center">
                <PenTool className="h-4 w-4 mr-2 text-blue-600" />
                Area Marking Mode
              </div>
              <div className="h-4 mx-3 border-r border-gray-300"></div>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant={markingMode === "box" ? "default" : "outline"}
                  className={
                    markingMode === "box" ? "bg-blue-600 text-white" : ""
                  }
                  onClick={() => {
                    setMarkingMode("box");
                    setIsMarking(true);
                  }}
                >
                  <Square className="h-3.5 w-3.5 mr-1" />
                  Box
                </Button>
                <Button
                  size="sm"
                  variant={markingMode === "polygon" ? "default" : "outline"}
                  className={
                    markingMode === "polygon" ? "bg-purple-600 text-white" : ""
                  }
                  onClick={() => {
                    setMarkingMode("polygon");
                    setIsMarking(true);
                  }}
                >
                  <PenTool className="h-3.5 w-3.5 mr-1" />
                  Polygon
                </Button>
                <Button
                  size="sm"
                  variant={markingMode === "smart" ? "default" : "outline"}
                  className={
                    markingMode === "smart" ? "bg-green-600 text-white" : ""
                  }
                  onClick={() => {
                    setMarkingMode("smart");
                    setIsMarking(true);
                  }}
                >
                  <LucideExpand className="h-3.5 w-3.5 mr-1" />
                  Smart
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleExitMarkingMode}
                >
                  Exit
                </Button>
              </div>
            </motion.div>

            {/* Side Panel */}
            <motion.div
              className={`fixed top-16 ${isPanelOpen ? "right-0" : "-right-80"} h-[calc(100vh-4rem)] w-80 bg-white border-l shadow-lg z-30 transition-all duration-300 ease-in-out`}
              initial={{ x: 280 }}
              animate={{ x: 0 }}
              exit={{ x: 280 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <div className="flex justify-between items-center p-4 border-b">
                <h2 className="font-bold text-lg">Area Management</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsPanelOpen(!isPanelOpen)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              {/* Panel Content */}
              <div className="h-full overflow-y-auto pb-20">
                <Tabs defaultValue="marked" className="w-full">
                  <TabsList className="w-full grid grid-cols-2">
                    <TabsTrigger value="marked">Marked Areas</TabsTrigger>
                    <TabsTrigger value="new">New Area</TabsTrigger>
                  </TabsList>

                  {/* Marked Areas Tab */}
                  <TabsContent value="marked" className="p-4 space-y-4">
                    {markedAreas.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                          <Maximize className="h-6 w-6 text-gray-400" />
                        </div>
                        <p>No areas marked yet</p>
                        <p className="text-sm mt-1">
                          Create your first area to get started
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {markedAreas.map((area) => (
                          <div
                            key={area.id}
                            className={`p-3 rounded-lg border transition-all ${
                              selectedArea?.id === area.id
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 hover:border-blue-300"
                            }`}
                            onClick={() => handleSelectArea(area)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{
                                    backgroundColor:
                                      area.color || AREA_COLORS[0].value,
                                  }}
                                />
                                <h3 className="font-medium text-gray-900">
                                  {area.name}
                                </h3>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Toggle visibility
                                    onAreaUpdated({
                                      ...area,
                                      isHidden: !area.isHidden,
                                    });
                                  }}
                                  aria-label={
                                    area.isHidden
                                      ? `Show ${area.name}`
                                      : `Hide ${area.name}`
                                  }
                                >
                                  {area.isHidden ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-red-500"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (
                                      confirm(
                                        `Are you sure you want to delete "${area.name}"?`,
                                      )
                                    ) {
                                      onAreaDeleted(area.id);
                                    }
                                  }}
                                  aria-label={`Delete ${area.name}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {/* Show additional details if selected */}
                            {selectedArea?.id === area.id && (
                              <motion.div
                                className="mt-3 pt-3 border-t border-gray-200 space-y-3"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                transition={{ duration: 0.2 }}
                              >
                                {/* Display dimensions */}
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="bg-gray-100 p-2 rounded">
                                    <div className="text-gray-500">Width</div>
                                    <div className="font-medium">
                                      {area.dimensions?.width || "--"} m
                                    </div>
                                  </div>
                                  <div className="bg-gray-100 p-2 rounded">
                                    <div className="text-gray-500">Length</div>
                                    <div className="font-medium">
                                      {area.dimensions?.length || "--"} m
                                    </div>
                                  </div>
                                  <div className="bg-gray-100 p-2 rounded">
                                    <div className="text-gray-500">Height</div>
                                    <div className="font-medium">
                                      {area.dimensions?.height || "--"} m
                                    </div>
                                  </div>
                                  <div className="bg-gray-100 p-2 rounded">
                                    <div className="text-gray-500">Area</div>
                                    <div className="font-medium">
                                      {area.dimensions?.area || "--"} m²
                                    </div>
                                  </div>
                                </div>

                                {/* Edit area properties */}
                                <div className="space-y-2">
                                  <Label htmlFor="edit-name">Name</Label>
                                  <Input
                                    id="edit-name"
                                    value={selectedArea.name}
                                    onChange={(e) =>
                                      setSelectedArea({
                                        ...selectedArea,
                                        name: e.target.value,
                                      })
                                    }
                                  />

                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {AREA_COLORS.map((colorOption) => (
                                      <button
                                        key={colorOption.value}
                                        className={`w-6 h-6 rounded-full ${selectedArea.color === colorOption.value ? "ring-2 ring-offset-2 ring-blue-600" : ""}`}
                                        style={{
                                          backgroundColor: colorOption.value,
                                        }}
                                        onClick={() =>
                                          setSelectedArea({
                                            ...selectedArea,
                                            color: colorOption.value,
                                          })
                                        }
                                        title={colorOption.name}
                                      />
                                    ))}
                                  </div>

                                  <Label
                                    htmlFor="edit-category"
                                    className="mt-3"
                                  >
                                    Category
                                  </Label>
                                  <Select
                                    value={selectedArea.category || "room"}
                                    onValueChange={(value) =>
                                      setSelectedArea({
                                        ...selectedArea,
                                        category: value,
                                      })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select a category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {AREA_CATEGORIES.map((category) => (
                                        <SelectItem
                                          key={category.id}
                                          value={category.id}
                                        >
                                          <div className="flex items-center">
                                            {category.icon}
                                            <span className="ml-2">
                                              {category.name}
                                            </span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>

                                  <Label htmlFor="edit-notes" className="mt-3">
                                    Notes
                                  </Label>
                                  <Input
                                    id="edit-notes"
                                    value={selectedArea.notes || ""}
                                    onChange={(e) =>
                                      setSelectedArea({
                                        ...selectedArea,
                                        notes: e.target.value,
                                      })
                                    }
                                  />
                                </div>

                                <div className="flex justify-end space-x-2 pt-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedArea(null)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      onAreaUpdated(selectedArea);
                                      toast({
                                        title: "Area Updated",
                                        description: `Changes to "${selectedArea.name}" have been saved`,
                                      });
                                      setSelectedArea(null);
                                    }}
                                  >
                                    Save Changes
                                  </Button>
                                </div>
                              </motion.div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* New Area Tab */}
                  <TabsContent value="new" className="p-4 space-y-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="area-name">Area Name</Label>
                        <Input
                          id="area-name"
                          placeholder="e.g. Kitchen, Bedroom, etc."
                          value={newAreaDetails.name}
                          onChange={(e) =>
                            setNewAreaDetails({
                              ...newAreaDetails,
                              name: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Color</Label>
                        <div className="flex flex-wrap gap-2">
                          {AREA_COLORS.map((colorOption) => (
                            <button
                              key={colorOption.value}
                              className={`w-8 h-8 rounded-full transition-all ${newAreaDetails.color === colorOption.value ? "ring-2 ring-offset-2 ring-blue-600 scale-110" : "hover:scale-110"}`}
                              style={{ backgroundColor: colorOption.value }}
                              onClick={() =>
                                setNewAreaDetails({
                                  ...newAreaDetails,
                                  color: colorOption.value,
                                })
                              }
                              title={colorOption.name}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="area-category">Category</Label>
                        <Select
                          value={newAreaDetails.category}
                          onValueChange={(value) =>
                            setNewAreaDetails({
                              ...newAreaDetails,
                              category: value,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                          <SelectContent>
                            {AREA_CATEGORIES.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                <div className="flex items-center">
                                  {category.icon}
                                  <span className="ml-2">{category.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="area-notes">Notes (Optional)</Label>
                        <Input
                          id="area-notes"
                          placeholder="Add any notes about this area"
                          value={newAreaDetails.notes}
                          onChange={(e) =>
                            setNewAreaDetails({
                              ...newAreaDetails,
                              notes: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="show-measurements"
                          checked={newAreaDetails.showMeasurements}
                          onChange={(e) =>
                            setNewAreaDetails({
                              ...newAreaDetails,
                              showMeasurements: e.target.checked,
                            })
                          }
                          className="rounded text-blue-600"
                        />
                        <Label
                          htmlFor="show-measurements"
                          className="text-sm cursor-pointer"
                        >
                          Show measurements in 3D view
                        </Label>
                      </div>

                      {isMarking ? (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center text-blue-600">
                          <Ruler className="h-5 w-5 mx-auto mb-2" />
                          <p className="text-sm">Currently marking area...</p>
                          <p className="text-xs mt-1">
                            Follow the instructions in the 3D view
                          </p>
                        </div>
                      ) : (
                        <div className="pt-2">
                          <Button
                            className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white"
                            onClick={() => {
                              if (!markingMode) {
                                toast({
                                  title: "Select a marking method",
                                  description:
                                    "Choose box, polygon, or smart detection from the toolbar",
                                  variant: "destructive",
                                });
                                return;
                              }
                              setIsMarking(true);
                            }}
                          >
                            <Maximize className="h-4 w-4 mr-2" />
                            Start Marking Area
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </motion.div>

            {/* Toggle panel button (when panel is closed) */}
            {!isPanelOpen && (
              <motion.button
                className="fixed top-1/2 -translate-y-1/2 right-0 bg-white border border-r-0 border-gray-300 p-2 rounded-l-lg shadow-md z-30"
                onClick={() => setIsPanelOpen(true)}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: 0.2 }}
              >
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </motion.button>
            )}

            {/* Marking Instructions Overlay */}
            {isMarking && (
              <motion.div
                className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 bg-white/95 backdrop-blur-sm p-4 rounded-lg shadow-lg max-w-md"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                <div className="flex items-start space-x-3">
                  <div className="mt-1 p-2 bg-blue-100 rounded-full">
                    <Info className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">
                      {markingMode === "box" && "Box Selection Mode"}
                      {markingMode === "polygon" && "Polygon Selection Mode"}
                      {markingMode === "smart" && "Smart Detection Mode"}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {markingMode === "box" &&
                        "Click to set the first corner, then click again to define the opposite corner of your area."}
                      {markingMode === "polygon" &&
                        "Click to add points to your area outline. Double-click or click the first point to complete the shape."}
                      {markingMode === "smart" &&
                        "Click near a wall or corner and we'll automatically detect the room boundaries."}
                    </p>

                    <div className="mt-3 flex justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsMarking(false);
                          setMarkingMode(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                        onClick={() => {
                          if (
                            confirm(
                              "Are you sure you want to cancel area marking?",
                            )
                          ) {
                            setIsMarking(false);
                            setMarkingMode(null);
                          }
                        }}
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Discard Area
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default AreaMarkingSystem;
