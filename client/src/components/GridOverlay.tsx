import React, { useState } from 'react';

interface GridOverlayProps {
  floorPlanUrl?: string;
  initialOpacity?: number;
  onOpacityChange?: (opacity: number) => void;
  gridSize?: number;
}

export const GridOverlay: React.FC<GridOverlayProps> = ({ 
  floorPlanUrl = '', 
  initialOpacity = 0.7,
  onOpacityChange,
  gridSize = 20 // Default 1 foot = 20 pixels
}) => {
  const [opacity, setOpacity] = useState(initialOpacity);
  
  const handleOpacityChange = (value: number) => {
    setOpacity(value);
    if (onOpacityChange) {
      onOpacityChange(value);
    }
  };
  
  return (
    <div className="relative w-full h-full">
      {/* Floor plan with transparency */}
      {floorPlanUrl && (
        <div 
          className="absolute inset-0 z-10"
          style={{ opacity: opacity }}
        >
          <img 
            src={floorPlanUrl}
            alt="Floor Plan"
            className="w-full h-full object-contain"
          />
        </div>
      )}
      
      {/* Grid overlay */}
      <div 
        className="absolute inset-0 z-20 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(0, 0, 0, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 0, 0, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: `${gridSize}px ${gridSize}px`,
          imageRendering: 'pixelated'
        }}
      />
      
      {/* Grid size indicator */}
      <div className="absolute bottom-4 right-4 z-30 bg-white/90 p-2 rounded-lg shadow-lg text-sm">
        <div className="flex items-center space-x-4">
          <div>1 block = 1 ft²</div>
          <div className="flex items-center space-x-2">
            <label className="text-sm">Floor Plan Opacity:</label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={opacity}
              onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
              className="w-24"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GridOverlay;
