import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  Eye,
  Star,
  ShoppingCart,
  Building,
  MapPin,
  Camera,
} from "lucide-react";

export default function LocationShowcase() {
  const [selectedLocation, setSelectedLocation] = useState("Grocery Store");
  const [isHovering, setIsHovering] = useState(null);

  const [groceryIndex, setGroceryIndex] = useState(0);
  useEffect(() => {
    if (selectedLocation === "Grocery Store") {
      const interval = setInterval(() => {
        setGroceryIndex((prev) => (prev + 1) % 2);
      }, 4000);
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

  // Enhanced location data with more compelling descriptions and metrics
  const LOCATIONS = [
    {
      id: "grocery",
      name: "Grocery Store",
      category: "Retail",
      image: "/images/grocerystore1.png",
      secondaryImage: "/images/grocery-ar.jpeg",
      description:
        "Turn shopping into an interactive experience with AR product information, nutritional details, and personalized recommendations.",
      benefits: [
        "300% increase in engagement",
        "Reduced checkout time",
        "Enhanced product discovery",
      ],
      icon: <ShoppingCart className="w-5 h-5" />,
    },
    {
      id: "retail",
      name: "Retail Store",
      category: "Commerce",
      image: "/images/apple-store.jpeg",
      secondaryImage: "/images/retail-ar.jpeg",
      description:
        "Create immersive try-before-you-buy experiences with virtual product demonstrations and interactive catalogs.",
      benefits: [
        "50% fewer returns",
        "Higher conversion rates",
        "Extended dwell time",
      ],
      icon: <Building className="w-5 h-5" />,
    },
    {
      id: "hotel",
      name: "Hotel",
      category: "Hospitality",
      image: "/images/hotel.jpeg",
      secondaryImage: "/images/hotel-ar.jpeg",
      description:
        "Elevate guest experiences with interactive room tours, amenity guides, and personalized concierge services.",
      benefits: [
        "Higher guest satisfaction",
        "Streamlined check-in",
        "Increased upselling",
      ],
      icon: <Building className="w-5 h-5" />,
    },
    {
      id: "museum",
      name: "Museum",
      category: "Culture",
      image: "/images/museum.jpeg",
      secondaryImage: "/images/museum-ar.jpeg",
      description:
        "Bring exhibits to life with immersive storytelling, interactive timelines, and augmented historical content.",
      benefits: [
        "Deeper visitor engagement",
        "Educational enhancement",
        "Multilingual support",
      ],
      icon: <Eye className="w-5 h-5" />,
    },
    {
      id: "office",
      name: "Office",
      category: "Corporate",
      image: "/images/office.jpeg",
      secondaryImage: "/images/office-ar.jpeg",
      description:
        "Transform workspaces with AR-powered collaboration tools, interactive presentations, and virtual meeting spaces.",
      benefits: [
        "Enhanced collaboration",
        "Remote integration",
        "Improved presentations",
      ],
      icon: <Building className="w-5 h-5" />,
    },
    {
      id: "apartment",
      name: "Real Estate",
      category: "Property",
      image: "/images/apartment.jpeg",
      secondaryImage: "/images/apartment-ar.jpeg",
      description:
        "Revolutionize property tours with AR staging, virtual furniture placement, and interactive floor plans.",
      benefits: ["Faster sales cycles", "Virtual staging", "Remote viewings"],
      icon: <MapPin className="w-5 h-5" />,
    },
  ];

  const currentLocation =
    LOCATIONS.find((loc) => loc.name === selectedLocation) || LOCATIONS[0];

  return (
    <section className="py-20 md:py-28 relative overflow-hidden bg-gradient-to-b from-white via-slate-50/50 to-white">
      {/* Enhanced background elements */}
      <motion.div
        className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-50/60 via-transparent to-violet-50/40 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
      />

      <div className="container mx-auto px-6">
        {/* Enhanced header section */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 mb-6 bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 py-2 px-4 rounded-full text-sm font-semibold border border-indigo-100">
            <Camera className="w-4 h-4" />
            Real Customer Transformations
          </div>
          <h2 className="text-4xl md:text-5xl font-black mb-6 text-slate-900">
            See Blueprint in Action Across{" "}
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-transparent bg-clip-text">
              Every Industry
            </span>
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            From retail to hospitality, our AR technology transforms ordinary
            spaces into extraordinary interactive experiences that captivate
            customers and drive results.
          </p>
        </motion.div>

        {/* Enhanced location selector */}
        <motion.div
          className="flex flex-wrap justify-center gap-3 mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {LOCATIONS.map((location) => (
            <motion.button
              key={location.id}
              onClick={() => setSelectedLocation(location.name)}
              onMouseEnter={() => setIsHovering(location.id)}
              onMouseLeave={() => setIsHovering(null)}
              className={`group relative px-6 py-3 rounded-2xl transition-all duration-300 font-semibold text-sm border-2 overflow-hidden
                ${
                  selectedLocation === location.name
                    ? "text-white shadow-xl shadow-indigo-200/50 border-transparent"
                    : "text-slate-600 hover:text-indigo-600 border-slate-200 hover:border-indigo-200 bg-white/80 backdrop-blur-sm hover:shadow-lg"
                }
              `}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              {selectedLocation === location.name && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 -z-10"
                  layoutId="activeLocationBackground"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                />
              )}
              <div className="flex items-center gap-2 relative z-10">
                {location.icon}
                <span>{location.name}</span>
              </div>
              {selectedLocation !== location.name && (
                <span className="text-xs text-slate-400 block mt-1">
                  {location.category}
                </span>
              )}
            </motion.button>
          ))}
        </motion.div>

        {/* Enhanced before/after comparison */}
        <div className="relative max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedLocation}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ duration: 0.8 }}
            >
              {/* Before Image */}
              <motion.div
                className="relative group"
                layoutId={`container-${currentLocation.id}`}
                transition={{ duration: 0.6 }}
              >
                <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl">
                  <motion.img
                    src={
                      selectedLocation === "Grocery Store"
                        ? groceryBeforeImages[groceryIndex]
                        : currentLocation.image
                    }
                    alt={currentLocation.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    initial={{ scale: 1.1 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 1 }}
                  />

                  {/* Before overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
                    <div className="absolute bottom-6 left-6 text-white">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-red-400"></div>
                        <span className="text-sm font-semibold uppercase tracking-wider">
                          Before
                        </span>
                      </div>
                      <h3 className="text-2xl md:text-3xl font-bold mb-2">
                        Standard Experience
                      </h3>
                      <p className="text-white/90 text-sm">
                        Traditional {currentLocation.category.toLowerCase()}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* After Image */}
              <motion.div
                className="relative group"
                layoutId={`container-ar-${currentLocation.id}`}
                transition={{ duration: 0.6 }}
              >
                <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl">
                  <motion.img
                    src={
                      selectedLocation === "Grocery Store"
                        ? groceryAfterImages[groceryIndex]
                        : currentLocation.secondaryImage
                    }
                    alt={`AR-enhanced ${currentLocation.name}`}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    initial={{ scale: 1.1 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 1 }}
                  />

                  {/* After overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/80 via-indigo-900/30 to-transparent">
                    <div className="absolute bottom-6 left-6 text-white">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></div>
                        <span className="text-sm font-semibold uppercase tracking-wider">
                          After Blueprint
                        </span>
                      </div>
                      <h3 className="text-2xl md:text-3xl font-bold mb-2">
                        Interactive AR Experience
                      </h3>
                      <p className="text-white/90 text-sm mb-3">
                        {currentLocation.description}
                      </p>
                    </div>
                  </div>

                  {/* Enhanced AR elements overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    <motion.div
                      className="absolute top-[25%] right-[20%] bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-xl border border-indigo-100 transform -rotate-2"
                      initial={{ opacity: 0, y: 30, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.6, duration: 0.8 }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span className="text-xs font-semibold text-slate-600">
                          Live Rating
                        </span>
                      </div>
                      <div className="text-lg font-black text-slate-900">
                        4.8 ⭐⭐⭐⭐⭐
                      </div>
                    </motion.div>

                    <motion.div
                      className="absolute top-[45%] left-[15%] bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-xl border border-indigo-100 transform rotate-1"
                      initial={{ opacity: 0, y: 30, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.8, duration: 0.8 }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-4 h-4 text-indigo-500" />
                        <span className="text-xs font-semibold text-slate-600">
                          Interactive Info
                        </span>
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        Tap to explore
                      </div>
                    </motion.div>

                    <motion.div
                      className="absolute bottom-[20%] right-[15%] bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl px-3 py-2 shadow-lg transform rotate-3"
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 1, duration: 0.6 }}
                    >
                      <div className="text-xs font-bold">+300% Engagement</div>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          {/* Benefits section */}
          <motion.div
            className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            {currentLocation.benefits.map((benefit, index) => (
              <motion.div
                key={benefit}
                className="text-center p-6 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-bold text-slate-900 mb-2">{benefit}</h4>
                <p className="text-sm text-slate-600">
                  Real results from Blueprint customers
                </p>
              </motion.div>
            ))}
          </motion.div>

          {/* Call to action */}
          <motion.div
            className="text-center mt-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <p className="text-lg text-slate-600 mb-6">
              Ready to transform your space like these success stories?
            </p>
            <motion.button
              className="inline-flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                const contactFormElement =
                  document.getElementById("contactForm");
                if (contactFormElement) {
                  contactFormElement.scrollIntoView({ behavior: "smooth" });
                }
              }}
            >
              <Sparkles className="w-5 h-5" />
              Start Your AR Journey
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
