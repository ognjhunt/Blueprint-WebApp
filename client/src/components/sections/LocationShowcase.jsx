import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function LocationShowcase() {
  const [selectedLocation, setSelectedLocation] = useState("Grocery Store");
  const [isHovering, setIsHovering] = useState(null);

  const [groceryIndex, setGroceryIndex] = useState(0);
  useEffect(() => {
    if (selectedLocation === "Grocery Store") {
      const interval = setInterval(() => {
        setGroceryIndex((prev) => (prev + 1) % 2);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedLocation]);

  const groceryBeforeImages = [
    "/images/grocerystore1.png",
    "/images/grocerystorebase2.png",
  ];

  const groceryAfterImages = [
    "/images/grocery-ar.jpeg",
    "/images/grocerystoreafter2.png",
  ];

  // Location data with images and descriptions
  const LOCATIONS = [
    {
      id: "grocery",
      name: "Grocery Store",
      image: "/images/grocerystore1.png",
      secondaryImage: "/images/grocery-ar.jpeg",
      description:
        "Transform shopping experiences with AR product information and personalized recommendations.",
    },
    {
      id: "retail",
      name: "Retail Store",
      image: "/images/apple-store.jpeg",
      secondaryImage: "/images/retail-ar.jpeg",
      description:
        "Create immersive try-before-you-buy experiences and interactive product demonstrations.",
    },
    {
      id: "hotel",
      name: "Hotel",
      image: "/images/hotel.jpeg",
      secondaryImage: "/images/hotel-ar.jpeg",
      description:
        "Enhance guest experiences with interactive room tours and concierge services.",
    },
    {
      id: "museum",
      name: "Museum",
      image: "/images/museum.jpeg",
      secondaryImage: "/images/museum-ar.jpeg",
      description:
        "Bring exhibits to life with interactive storytelling and enhanced visitor engagement.",
    },
    {
      id: "office",
      name: "Office",
      image: "/images/office.jpeg",
      secondaryImage: "/images/office-ar.jpeg",
      description:
        "Reimagine workspace collaboration with AR-powered meetings and presentations.",
    },
    {
      id: "apartment",
      name: "Apartment (Real Estate agent - empty vs. (AR staged)",
      image: "/images/apartment.jpeg",
      secondaryImage: "/images/apartment-ar.jpeg",
      description:
        "Elevate residential communities with AR amenities and interactive property tours.",
    },
  ];

  // Get the current location data
  const currentLocation =
    LOCATIONS.find((loc) => loc.name === selectedLocation) || LOCATIONS[0];

  return (
    <section className="py-20 relative overflow-hidden">
      <motion.div
        className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-50/80 to-transparent pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
      />

      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-violet-600 inline-block text-transparent bg-clip-text">
            Transform Any Space with AR + AI
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Blueprint helps you create exceptional customer experiences with
            advanced AR technology.
          </p>
        </motion.div>

        {/* Location Selector */}
        <motion.div
          className="flex flex-wrap justify-center gap-3 mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {LOCATIONS.map((location) => (
            <motion.button
              key={location.id}
              onClick={() => setSelectedLocation(location.name)}
              onMouseEnter={() => setIsHovering(location.id)}
              onMouseLeave={() => setIsHovering(null)}
              className={`px-5 py-3 rounded-full transition-all duration-300 font-medium text-sm relative overflow-hidden
                ${
                  selectedLocation === location.name
                    ? "text-white shadow-lg shadow-indigo-200"
                    : "text-gray-600 hover:text-indigo-600 border border-gray-200 hover:border-indigo-200 bg-white/80 backdrop-blur-sm"
                }
              `}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              {selectedLocation === location.name && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 -z-10"
                  layoutId="activeLocationBackground"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 20,
                  }}
                />
              )}
              {location.name}
            </motion.button>
          ))}
        </motion.div>

        {/* Location Preview */}
        <div className="relative">
          <motion.div
            className="flex flex-col lg:flex-row gap-8"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            {/* Main Location Image */}
            <motion.div
              className="w-full lg:w-1/2 relative rounded-2xl overflow-hidden shadow-2xl group"
              layoutId={`container-${currentLocation.id}`}
              transition={{ duration: 0.6 }}
            >
              <motion.div
                className="aspect-video w-full relative rounded-2xl overflow-hidden"
                layoutId={`image-${currentLocation.id}`}
              >
                <motion.img
                  src={
                    selectedLocation === "Grocery Store"
                      ? groceryBeforeImages[groceryIndex]
                      : currentLocation.image
                  }
                  alt={currentLocation.name}
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.8 }}
                />

                {/* Before/After Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent">
                  <div className="absolute bottom-6 left-6 text-white">
                    <h3 className="text-2xl font-bold">Before</h3>
                    <p className="text-white/80">{currentLocation.name}</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* AR-Enhanced Image */}
            <motion.div
              className="w-full lg:w-1/2 relative rounded-2xl overflow-hidden shadow-2xl group"
              layoutId={`container-ar-${currentLocation.id}`}
              transition={{ duration: 0.6 }}
            >
              <motion.div
                className="aspect-video w-full relative rounded-2xl overflow-hidden"
                layoutId={`image-ar-${currentLocation.id}`}
              >
                <motion.img
                  src={
                    selectedLocation === "Grocery Store"
                      ? groceryAfterImages[groceryIndex]
                      : currentLocation.secondaryImage
                  }
                  alt={`AR-enhanced ${currentLocation.name}`}
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.8 }}
                />

                {/* AR Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/70 to-transparent">
                  <div className="absolute bottom-6 left-6 text-white">
                    <h3 className="text-2xl font-bold">
                      After{" "}
                      <span className="bg-gradient-to-r from-sky-400 to-blue-500 text-transparent bg-clip-text">
                        with Blueprint
                      </span>
                    </h3>
                    <p className="text-white/80">
                      {currentLocation.description}
                    </p>
                  </div>
                </div>

                {/* AR Elements Overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  <motion.div
                    className="absolute top-[20%] left-[30%] bg-white/90 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-indigo-100 transform -rotate-3"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                  >
                    <div className="text-xs font-medium text-indigo-800">
                      Product Rating
                    </div>
                    <div className="text-lg font-bold text-gray-800">
                      4.8 ★★★★★
                    </div>
                  </motion.div>

                  <motion.div
                    className="absolute top-[40%] right-[20%] bg-white/90 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-indigo-100 transform rotate-2"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8, duration: 0.5 }}
                  >
                    <div className="text-xs font-medium text-indigo-800">
                      Customer Reviews
                    </div>
                    <div className="text-lg font-bold text-gray-800">
                      Read 142 Reviews
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
