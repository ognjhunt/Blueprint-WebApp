import { useState, useEffect, useRef } from "react";
import { motion, useAnimation, useInView } from "framer-motion";
import { StarIcon } from "@heroicons/react/24/solid";

export default function Testimonials() {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.3 });
  const controls = useAnimation();

  const testimonials = [
    {
      id: 1,
      name: "Sarah Johnson",
      role: "Marketing Director",
      company: "Retail Innovations Inc.",
      image: "/images/testimonial-1.jpg", // Replace with actual image
      text: "Blueprint completely transformed our in-store experience. Our customers love the interactive product information, and we've seen a 34% increase in average purchase value since implementation.",
      rating: 5,
    },
    {
      id: 2,
      name: "Michael Chen",
      role: "Operations Manager",
      company: "Urban Grocery Co.",
      image: "/images/testimonial-2.jpg", // Replace with actual image
      text: "Blueprint's technology has revolutionized how our customers shop. The AR navigation and product information features have reduced customer service inquiries by 45% while improving customer satisfaction scores.",
      rating: 5,
    },
    {
      id: 3,
      name: "Elena Rodriguez",
      role: "Customer Experience Lead",
      company: "Luxury Hotels Group",
      image: "/images/testimonial-3.jpg", // Replace with actual image
      text: "Our guests are amazed by the AR experiences Blueprint has enabled throughout our properties. From interactive room service to AR-guided tours, the technology has set us apart from competitors and justified our premium pricing.",
      rating: 5,
    },
  ];

  useEffect(() => {
    if (isInView) {
      controls.start("visible");
    }
  }, [isInView, controls]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prevIndex) => (prevIndex + 1) % testimonials.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [testimonials.length]);

  return (
    <section ref={containerRef} className="py-24 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/50 to-white -z-10" />
      <motion.div
        animate={{
          x: [0, 50, 0],
          y: [0, 30, 0],
          opacity: [0.3, 0.4, 0.3],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          repeatType: "reverse",
        }}
        className="absolute -bottom-32 -left-32 w-96 h-96 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full blur-3xl opacity-30 -z-10"
      />

      <div className="container mx-auto px-4">
        <motion.div
          className="text-center max-w-3xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={controls}
          variants={{
            visible: { opacity: 1, y: 0, transition: { duration: 0.8 } },
            hidden: { opacity: 0, y: 20 },
          }}
        >
          <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-violet-600 inline-block text-transparent bg-clip-text">
            What Our Customers Say
          </h2>
          <p className="text-xl text-gray-600">
            Businesses across industries are transforming their spaces with
            Blueprint's AR technology.
          </p>
        </motion.div>

        <div className="relative">
          <div className="max-w-4xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.id}
                className="relative p-8 md:p-12"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{
                  opacity: activeIndex === index ? 1 : 0,
                  scale: activeIndex === index ? 1 : 0.9,
                  zIndex: activeIndex === index ? 10 : 0,
                  position: activeIndex === index ? "relative" : "absolute",
                }}
                transition={{
                  opacity: { duration: 0.5 },
                  scale: { duration: 0.5 },
                }}
                style={{
                  top: 0,
                  left: 0,
                  right: 0,
                }}
              >
                <div className="bg-white rounded-2xl p-8 md:p-10 shadow-xl border border-indigo-100 relative">
                  {/* Quote mark */}
                  <div className="absolute -top-6 -left-6 w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center justify-center text-white text-2xl font-serif">
                    "
                  </div>

                  <div className="flex flex-col md:flex-row items-center gap-6 mb-6">
                    <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-indigo-100 flex-shrink-0">
                      <picture>
                        <source srcSet={testimonial.image.replace(/\.(png|jpe?g)$/i, '.webp')} type="image/webp" />
                        <source srcSet={testimonial.image} type={testimonial.image.endsWith('.png') ? 'image/png' : 'image/jpeg'} />
                        <img
                          src={testimonial.image}
                          alt={testimonial.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            e.target.onerror = null;
                            // Attempt to load WebP version of fallback avatar if original avatar fails
                            const fallbackWebP = `https://ui-avatars.com/api/?name=${testimonial.name.replace(" ", "+")}&background=6366f1&color=fff&format=webp`;
                            const fallbackPng = `https://ui-avatars.com/api/?name=${testimonial.name.replace(" ", "+")}&background=6366f1&color=fff&format=png`;

                            const pictureElement = e.target.parentElement;
                            if (pictureElement && pictureElement.tagName === 'PICTURE') {
                              // Remove existing sources
                              Array.from(pictureElement.querySelectorAll('source')).forEach(source => source.remove());

                              // Add new sources for ui-avatars
                              const sourceWebP = document.createElement('source');
                              sourceWebP.srcSet = fallbackWebP;
                              sourceWebP.type = 'image/webp';
                              pictureElement.prepend(sourceWebP);

                              const sourcePng = document.createElement('source');
                              sourcePng.srcSet = fallbackPng;
                              sourcePng.type = 'image/png';
                              pictureElement.prepend(sourcePng);
                            }
                            e.target.src = fallbackPng; // Set img src to the final fallback
                          }}
                        />
                      </picture>
                    </div>
                    <div className="text-center md:text-left">
                      <h3 className="font-bold text-xl text-gray-800">
                        {testimonial.name}
                      </h3>
                      <p className="text-gray-600">{testimonial.role}</p>
                      <p className="text-indigo-600 font-medium">
                        {testimonial.company}
                      </p>
                      <div className="flex space-x-1 mt-2 justify-center md:justify-start">
                        {[...Array(5)].map((_, i) => (
                          <StarIcon
                            key={i}
                            className={`w-5 h-5 ${
                              i < testimonial.rating
                                ? "text-amber-400"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-lg text-gray-700 italic leading-relaxed">
                    "{testimonial.text}"
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Navigation dots */}
          <div className="flex justify-center space-x-2 mt-8">
            {testimonials.map((_, index) => (
              <button
                key={index}
                className={`w-3 h-3 rounded-full ${
                  activeIndex === index ? "bg-indigo-600" : "bg-gray-300"
                } transition-colors duration-300`}
                onClick={() => setActiveIndex(index)}
                aria-label={`View testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
