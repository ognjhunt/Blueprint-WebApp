import React, { useState, useEffect } from "react";

const BlueprintImage = ({ blueprint }) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Reset error state if blueprint changes
  useEffect(() => {
    setImageError(false);
    setIsLoading(true);
  }, [blueprint?.id]);

  const handleImageError = () => {
    console.log(`Image failed to load for blueprint: ${blueprint?.name}`);
    setImageError(true);
    setIsLoading(false);
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  // Determine which image source to use
  const imageSource =
    imageError || !blueprint?.image
      ? blueprint?.fallbackImage
      : blueprint?.image;

  // Get location type for default styling
  const locationType = blueprint?.type?.toLowerCase() || "retail";

  // Style based on location type
  const typeColorMap = {
    retail: "bg-blue-200",
    restaurant: "bg-orange-200",
    hotel: "bg-purple-200",
    museum: "bg-green-200",
    default: "bg-gray-200",
  };

  const bgColorClass = typeColorMap[locationType] || typeColorMap.default;

  return (
    <>
      {isLoading && (
        <div
          className={`absolute inset-0 ${bgColorClass} flex items-center justify-center`}
        >
          <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      <img
        src={imageSource}
        alt={blueprint?.name || "Blueprint location"}
        className="w-full h-full object-cover"
        onError={handleImageError}
        onLoad={handleImageLoad}
        style={{ display: isLoading ? "none" : "block" }}
      />

      {/* Fallback content when no image is available */}
      {imageError && !blueprint?.fallbackImage && (
        <div
          className={`absolute inset-0 ${bgColorClass} flex items-center justify-center`}
        >
          <div className="text-gray-700 font-medium text-center px-2">
            {blueprint?.name || "Location preview not available"}
          </div>
        </div>
      )}
    </>
  );
};

export default BlueprintImage;
