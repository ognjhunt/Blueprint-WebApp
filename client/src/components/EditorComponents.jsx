import React from "react";
import { Scale, Ruler as RulerIcon } from "lucide-react";

// Grid Overlay Component
const GridOverlay = ({ visible, scale }) => {
  if (!visible) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `
          linear-gradient(to right, rgba(59, 130, 246, 0.1) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
        `,
        backgroundSize: `${20 * scale}px ${20 * scale}px`,
      }}
    />
  );
};

// Zoom Level Indicator Component
const ZoomIndicator = ({ scale }) => {
  const percentage = Math.round(scale * 100);

  return (
    <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-2 flex items-center space-x-2">
      <Scale className="w-4 h-4 text-gray-500" />
      <span className="text-sm font-medium">{percentage}%</span>
    </div>
  );
};

// Ruler Component
const Ruler = ({ orientation = "horizontal", scale, offset }) => {
  const rulerRef = React.useRef(null);
  const size = orientation === "horizontal" ? "w-full h-6" : "h-full w-6";
  const translation =
    orientation === "horizontal"
      ? `translateX(${offset.x}px)`
      : `translateY(${offset.y}px)`;

  return (
    <div
      ref={rulerRef}
      className={`${size} bg-white/90 backdrop-blur-sm absolute ${orientation === "horizontal" ? "top-0" : "left-0"}`}
      style={{ transform: translation }}
    >
      <canvas
        className="w-full h-full"
        ref={(el) => {
          if (el && rulerRef.current) {
            const ctx = el.getContext("2d");
            const pixelRatio = window.devicePixelRatio || 1;
            el.width = el.offsetWidth * pixelRatio;
            el.height = el.offsetHeight * pixelRatio;
            ctx.scale(pixelRatio, pixelRatio);

            // Draw ruler markings
            ctx.fillStyle = "#94a3b8";
            ctx.font = "10px system-ui";

            const increment = 50 * scale;
            const count =
              orientation === "horizontal"
                ? Math.floor(el.offsetWidth / increment)
                : Math.floor(el.offsetHeight / increment);

            for (let i = 0; i <= count; i++) {
              const pos = i * increment;
              const value = Math.round(i * 50);

              if (orientation === "horizontal") {
                ctx.fillRect(pos, el.offsetHeight - 8, 1, 8);
                ctx.fillText(value, pos + 2, el.offsetHeight - 10);
              } else {
                ctx.fillRect(el.offsetWidth - 8, pos, 8, 1);
                ctx.save();
                ctx.translate(el.offsetWidth - 10, pos + 12);
                ctx.rotate(-Math.PI / 2);
                ctx.fillText(value, 0, 0);
                ctx.restore();
              }
            }
          }
        }}
      />
    </div>
  );
};

// Minimap Component
const Minimap = ({ layout, elements, viewportBounds, scale }) => {
  const minimapSize = 150;
  const ratio = layout.aspectRatio || 1;
  const width = ratio > 1 ? minimapSize : minimapSize * ratio;
  const height = ratio > 1 ? minimapSize / ratio : minimapSize;

  return (
    <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-2">
      <div
        className="relative"
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        {/* Layout preview */}
        {layout.url && (
          <img
            src={layout.url}
            alt="Minimap"
            className="w-full h-full object-cover rounded"
          />
        )}

        {/* Viewport indicator */}
        <div
          className="absolute border-2 border-blue-500 pointer-events-none"
          style={{
            left: `${(viewportBounds.x / layout.originalWidth) * width}px`,
            top: `${(viewportBounds.y / layout.originalHeight) * height}px`,
            width: `${(viewportBounds.width / layout.originalWidth) * width}px`,
            height: `${(viewportBounds.height / layout.originalHeight) * height}px`,
          }}
        />

        {/* Element indicators */}
        {elements.map((element) => (
          <div
            key={element.id}
            className="absolute w-1 h-1 bg-blue-500 rounded-full transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${(element.position.x / 100) * width}px`,
              top: `${(element.position.y / 100) * height}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

// Selected Element Overlay
const SelectedElementOverlay = ({ element }) => {
  if (!element) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        left: `${element.position.x}%`,
        top: `${element.position.y}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div className="w-full h-full border-2 border-blue-500/50 rounded-lg bg-blue-500/10 backdrop-blur-[2px]" />

      {/* Selection handles */}
      {["nw", "ne", "se", "sw"].map((position) => (
        <div
          key={position}
          className="absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full"
          style={{
            top: position.includes("n") ? "-6px" : "auto",
            bottom: position.includes("s") ? "-6px" : "auto",
            left: position.includes("w") ? "-6px" : "auto",
            right: position.includes("e") ? "-6px" : "auto",
            cursor: position.match(/(nw|se)/) ? "nwse-resize" : "nesw-resize",
          }}
        />
      ))}
    </div>
  );
};

export { GridOverlay, ZoomIndicator, Ruler, Minimap, SelectedElementOverlay };
