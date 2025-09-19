// ==========================================
// File: src/components/sections/ContactForm.tsx
// ==========================================

"use client";

import { Anthropic } from "@anthropic-ai/sdk"; // (kept import; not used here)
import OpenAI from "openai"; // (kept import; not used here)
import { Loader } from "@googlemaps/js-api-loader";
import { motion, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import React, { useState, useEffect, useRef } from "react";
import {
  MapPinIcon,
  BuildingOfficeIcon,
  EnvelopeIcon,
  UserIcon,
  ChatBubbleBottomCenterTextIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import {
  Sparkles as SparklesIcon,
  Rocket as RocketLaunchIcon,
  Star as StarIcon,
  Award,
  Users,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { getGoogleMapsApiKey } from "@/lib/client-env";

// Type definitions for form data and Google Maps API
interface ContactFormData {
  name: string;
  email: string;
  company: string;
  city: string;
  state: string;
  message: string;
}

interface ContactFormErrors {
  name?: string;
  email?: string;
  company?: string;
  city?: string;
  state?: string;
  message?: string;
}

interface GoogleMapsState {
  autocompleteService: google.maps.places.AutocompleteService | null;
  placesService: google.maps.places.PlacesService | null;
  predictions: google.maps.places.AutocompletePrediction[];
}

export default function ContactForm() {
  const formRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(formRef, { once: true, amount: 0.3 });

  // Refs for sequential input focus handling
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const companyRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (
    e: React.KeyboardEvent,
    nextRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (nextRef && nextRef.current) nextRef.current.focus();
    }
  };

  const [formData, setFormData] = useState<ContactFormData>({
    name: "",
    email: "",
    company: "",
    city: "",
    state: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const wasSelection = useRef<boolean>(false);

  const [companyWebsite, setCompanyWebsite] = useState<string>("");
  const [companyAddress, setCompanyAddress] = useState<string>("");
  const [companyAutocomplete, setCompanyAutocomplete] =
    useState<google.maps.places.AutocompleteService | null>(null);
  const [companyPlacesService, setCompanyPlacesService] =
    useState<google.maps.places.PlacesService | null>(null);
  const [companyPredictions, setCompanyPredictions] = useState<
    google.maps.places.AutocompletePrediction[]
  >([]);

  const [errors, setErrors] = useState<ContactFormErrors>({});

  const priorityMarkets = [
    "Los Angeles",
    "San Francisco",
    "New York",
    "Miami",
    "Chicago",
    "Austin",
    "Seattle",
    "Boston",
    "Durham",
  ];

  // Load Google Places
  useEffect(() => {
    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) {
      console.warn(
        "Google Maps API key not configured. Places autocomplete will be disabled.",
      );
      return;
    }

    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["places"],
    });
    loader
      .load()
      .then(() => {
        const autocompleteService =
          new google.maps.places.AutocompleteService();
        setCompanyAutocomplete(autocompleteService);
        const div = document.createElement("div");
        const pService = new google.maps.places.PlacesService(div);
        setCompanyPlacesService(pService);
      })
      .catch((err) => console.error("Error loading Google Maps API:", err));
  }, []);

  // Company predictions
  useEffect(() => {
    if (wasSelection.current) {
      wasSelection.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (formData.company.length >= 3 && companyAutocomplete) {
        const request: google.maps.places.AutocompletionRequest = {
          input: formData.company,
          componentRestrictions: { country: "us" },
        };
        companyAutocomplete.getPlacePredictions(
          request,
          (
            predictions: google.maps.places.AutocompletePrediction[] | null,
            status: google.maps.places.PlacesServiceStatus,
          ) => {
            if (
              status !== google.maps.places.PlacesServiceStatus.OK ||
              !predictions
            ) {
              setCompanyPredictions([]);
              return;
            }
            setCompanyPredictions(predictions);
          },
        );
      } else {
        setCompanyPredictions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [formData.company, companyAutocomplete]);

  const validateForm = (): boolean => {
    const newErrors: ContactFormErrors = {};
    if (!formData.name || formData.name.length < 2)
      newErrors.name = "Name is required";
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Valid email is required";
    if (!formData.company || formData.company.length < 2)
      newErrors.company = "Company name is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) return;
    setIsSubmitting(true);

    try {
      if (!db) {
        throw new Error(
          "Firebase database not initialized. Please check your configuration.",
        );
      }

      const token = uuidv4();
      const baseUrl = "https://blueprint-vision-fork-nijelhunt.replit.app";
      const offWaitlistUrl = `${baseUrl}/off-waitlist-signup?token=${token}`;

      await addDoc(collection(db, "waitlistTokens"), {
        token,
        email: formData.email,
        company: formData.company,
        status: "unused",
        createdAt: serverTimestamp(),
      });

      // Send notification via backend API (secure)
      fetch("/api/contact-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          company: formData.company,
          email: formData.email,
          city: formData.city,
          state: formData.state,
          message: formData.message,
          companyWebsite,
          offWaitlistUrl,
        }),
      }).catch((err) => console.error("Webhook error (non-blocking):", err));

      setIsSuccess(true);
      setFormData({
        name: "",
        email: "",
        company: "",
        city: "",
        state: "",
        message: "",
      });
    } catch (error) {
      console.error("Form submission failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const isPriorityMarket = priorityMarkets.some((m) =>
    (formData.city || "").toLowerCase().includes(m.toLowerCase()),
  );

  return (
    <motion.section
      ref={formRef}
      id="contactForm"
      className="py-12 md:py-20 lg:py-24 relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* ambient */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-48 -right-48 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-48 -left-48 w-[28rem] h-[28rem] rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="container mx-auto px-6">
        {/* Header */}
        <motion.div
          className="max-w-4xl mx-auto mb-10 md:mb-14 text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 30 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center justify-center gap-2 mb-4 bg-emerald-400/10 text-emerald-300 py-2 px-4 rounded-full border border-emerald-500/30">
            <RocketLaunchIcon className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Limited Pilot Program
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black leading-tight text-white">
            Ready to Transform Your{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-cyan-300">
              In-Person Experience with Blueprint?
            </span>
          </h2>
          <p className="text-base md:text-xl text-slate-300 mt-3">
            Launch a hands-free AI guide in ~60 minutes. No app required, and it
            works on the smart glasses your teams and guests will soon wear.
            Durham & nearby businesses welcome.
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          className="bg-slate-900/70 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-800"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 40 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-5">
            {/* Left panel */}
            <div className="lg:col-span-2 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6 md:p-10 relative">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <SparklesIcon className="w-5 h-5 text-amber-300" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    Early Access
                  </span>
                </div>
                <h3 className="font-black text-2xl md:text-3xl mb-4 leading-tight">
                  Be Among the First to Deploy AI Glasses Experiences
                </h3>
                <p className="mb-6 text-sm md:text-base text-slate-300">
                  Blueprint readies your space for the AI wearables wave—across
                  retail, hospitality, workplaces, and venues. Join the free
                  pilot to feel how on-site AI guidance works.
                </p>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-white/5 rounded-xl p-2">
                      <Award className="w-5 h-5 text-emerald-300" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Exclusive Early Access</h4>
                      <p className="text-sm text-slate-400">
                        Free pilot with priority support.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-white/5 rounded-xl p-2">
                      <Users className="w-5 h-5 text-cyan-300" />
                    </div>
                    <div>
                      <h4 className="font-semibold">White-Glove Onboarding</h4>
                      <p className="text-sm text-slate-400">
                        We scan, design AI flows, and activate on-site.
                      </p>
                    </div>
                  </div>
                </div>

                {isPriorityMarket && (
                  <motion.div
                    className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <StarIcon className="w-4 h-4 text-emerald-300" />
                      <span className="font-semibold text-emerald-300">
                        Priority Market Detected!
                      </span>
                    </div>
                    <p className="text-sm text-emerald-200">
                      {formData.city} qualifies for immediate onboarding.
                    </p>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-3 p-6 md:p-10 bg-white">
              {isSuccess ? (
                <motion.div
                  className="h-full flex flex-col items-center justify-center text-center p-6"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
                    <CheckCircleIcon className="h-10 w-10 text-emerald-600" />
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 mb-3">
                    Welcome to the Future! 🎉
                  </h3>
                  <p className="text-slate-600 max-w-md">
                    You've successfully signed up for the Pilot Program! Expect
                    to hear from our team within 5 minutes.
                  </p>
                  <Button
                    className="mt-6 bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-900 font-semibold border-0"
                    onClick={() => setIsSuccess(false)}
                  >
                    Submit Another Request
                  </Button>
                </motion.div>
              ) : (
                <motion.form
                  onSubmit={handleSubmit}
                  className="space-y-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isInView ? 1 : 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <div>
                    <label
                      className="block text-sm font-semibold mb-2 text-slate-700"
                      htmlFor="name"
                    >
                      <span className="inline-flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-emerald-600" /> Full
                        Name
                      </span>
                    </label>
                    <Input
                      ref={nameRef}
                      type="text"
                      id="name"
                      name="name"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={handleChange}
                      onKeyDown={(e) => handleKeyDown(e, emailRef)}
                      className="border-2 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-xl py-3 px-4 text-slate-900"
                    />

                    {errors.name && (
                      <p className="text-red-500 text-sm mt-2">{errors.name}</p>
                    )}
                  </div>

                  <div>
                    <label
                      className="block text-sm font-semibold mb-2 text-slate-700"
                      htmlFor="email"
                    >
                      <span className="inline-flex items-center gap-2">
                        <EnvelopeIcon className="w-4 h-4 text-emerald-600" />{" "}
                        Business Email
                      </span>
                    </label>
                    <Input
                      ref={emailRef}
                      type="email"
                      id="email"
                      name="email"
                      placeholder="john@company.com"
                      value={formData.email}
                      onChange={handleChange}
                      onKeyDown={(e) => handleKeyDown(e, companyRef)}
                      className="border-2 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-xl py-3 px-4 text-slate-900"
                    />
                    {errors.email && (
                      <p className="text-red-500 text-sm mt-2">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div className="relative">
                    <label
                      className="block text-sm font-semibold mb-2 text-slate-700"
                      htmlFor="company"
                    >
                      <span className="inline-flex items-center gap-2">
                        <BuildingOfficeIcon className="w-4 h-4 text-emerald-600" />{" "}
                        Company Name
                      </span>
                    </label>
                    <Input
                      ref={companyRef}
                      type="text"
                      id="company"
                      name="company"
                      placeholder="Your Company Name"
                      value={formData.company}
                      onChange={handleChange}
                      onBlur={() =>
                        setTimeout(() => setCompanyPredictions([]), 150)
                      }
                      onKeyDown={(e) => handleKeyDown(e, messageRef)}
                      className="border-2 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-xl py-3 px-4 text-slate-900"
                    />
                    {errors.company && (
                      <p className="text-red-500 text-sm mt-2">
                        {errors.company}
                      </p>
                    )}

                    {companyPredictions.length > 0 && (
                      <div className="relative z-20">
                        <div className="absolute w-full mt-2 bg-white border-2 border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                          {companyPredictions.map((prediction) => (
                            <div
                              key={prediction.place_id}
                              className="px-4 py-3 hover:bg-emerald-50 cursor-pointer transition-colors border-b last:border-b-0"
                              onClick={() => {
                                wasSelection.current = true;
                                setFormData({
                                  ...formData,
                                  company: prediction.description,
                                });
                                setCompanyPredictions([]);
                                if (companyPlacesService) {
                                  const request = {
                                    placeId: prediction.place_id,
                                    fields: [
                                      "website",
                                      "formatted_address",
                                      "address_components",
                                    ],
                                  };
                                  companyPlacesService.getDetails(
                                    request,
                                    (placeResult, status) => {
                                      if (
                                        status ===
                                          google.maps.places.PlacesServiceStatus
                                            .OK &&
                                        placeResult
                                      ) {
                                        setCompanyWebsite(
                                          placeResult.website || "",
                                        );
                                        setCompanyAddress(
                                          placeResult.formatted_address || "",
                                        );
                                        if (placeResult.address_components) {
                                          let city = "";
                                          let state = "";
                                          placeResult.address_components.forEach(
                                            (component) => {
                                              if (
                                                (
                                                  component.types || []
                                                ).includes("locality")
                                              )
                                                city = component.long_name;
                                              else if (
                                                (
                                                  component.types || []
                                                ).includes(
                                                  "administrative_area_level_1",
                                                )
                                              )
                                                state = component.short_name;
                                            },
                                          );
                                          setFormData((prev) => ({
                                            ...prev,
                                            city: city || prev.city,
                                            state: state || prev.state,
                                          }));
                                        }
                                      }
                                    },
                                  );
                                }
                              }}
                            >
                              <div className="font-medium text-slate-900">
                                {prediction.description}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      className="block text-sm font-semibold mb-2 text-slate-700"
                      htmlFor="message"
                    >
                      <span className="inline-flex items-center gap-2">
                        <ChatBubbleBottomCenterTextIcon className="w-4 h-4 text-emerald-600" />{" "}
                        Tell Us About Your Vision (Optional)
                      </span>
                    </label>
                    <Textarea
                      ref={messageRef}
                      id="message"
                      name="message"
                      placeholder="Describe your space, goals, or any specific AI glasses experiences you have in mind..."
                      rows={3}
                      value={formData.message}
                      onChange={handleChange}
                      className="border-2 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-xl py-3 px-4 text-slate-900"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 text-lg font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-900 border-0 rounded-xl shadow-xl hover:opacity-90"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center gap-3">
                        <svg
                          className="animate-spin h-6 w-6"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Securing Your Spot...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-3">
                        <RocketLaunchIcon className="w-5 h-5" />
                        Join AI Pilot Program
                      </div>
                    )}
                  </Button>

                  <p className="text-xs text-slate-500 text-center">
                    By submitting, you agree to receive updates about Blueprint.
                    We respect your privacy and never share your information.
                  </p>
                </motion.form>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}

// // ==========================================
// // File: src/components/sections/ContactForm.tsx
// // ==========================================

// "use client";

// import { Anthropic } from "@anthropic-ai/sdk"; // (kept import; not used here)
// import OpenAI from "openai"; // (kept import; not used here)
// import { Loader } from "@googlemaps/js-api-loader";
// import { motion, useInView } from "framer-motion";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Textarea } from "@/components/ui/textarea";
// import React, { useState, useEffect, useRef } from "react";
// import {
//   MapPinIcon,
//   BuildingOfficeIcon,
//   EnvelopeIcon,
//   UserIcon,
//   ChatBubbleBottomCenterTextIcon,
//   CheckCircleIcon,
// } from "@heroicons/react/24/outline";
// import {
//   Sparkles as SparklesIcon,
//   Rocket as RocketLaunchIcon,
//   Star as StarIcon,
//   Award,
//   Users,
// } from "lucide-react";
// import { db } from "@/lib/firebase";
// import { collection, addDoc, serverTimestamp } from "firebase/firestore";
// import { v4 as uuidv4 } from "uuid";
// import { getGoogleMapsApiKey } from "@/lib/client-env";

// // Type definitions for form data and Google Maps API
// interface ContactFormData {
//   name: string;
//   email: string;
//   company: string;
//   city: string;
//   state: string;
//   message: string;
// }

// interface ContactFormErrors {
//   name?: string;
//   email?: string;
//   company?: string;
//   city?: string;
//   state?: string;
//   message?: string;
// }

// interface GoogleMapsState {
//   autocompleteService: google.maps.places.AutocompleteService | null;
//   placesService: google.maps.places.PlacesService | null;
//   predictions: google.maps.places.AutocompletePrediction[];
// }

// export default function ContactForm() {
//   const formRef = useRef<HTMLDivElement>(null);
//   const isInView = useInView(formRef, { once: true, amount: 0.3 });

//   // Refs for sequential input focus handling
//   const nameRef = useRef<HTMLInputElement>(null);
//   const emailRef = useRef<HTMLInputElement>(null);
//   const companyRef = useRef<HTMLInputElement>(null);
//   const messageRef = useRef<HTMLTextAreaElement>(null);

//   const handleKeyDown = (
//     e: React.KeyboardEvent,
//     nextRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>
//   ) => {
//     if (e.key === "Enter") {
//       e.preventDefault();
//       if (nextRef && nextRef.current) nextRef.current.focus();
//     }
//   };

//   const [formData, setFormData] = useState<ContactFormData>({
//     name: "",
//     email: "",
//     company: "",
//     city: "",
//     state: "",
//     message: "",
//   });
//   const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
//   const [isSuccess, setIsSuccess] = useState<boolean>(false);
//   const wasSelection = useRef<boolean>(false);

//   const [companyWebsite, setCompanyWebsite] = useState<string>("");
//   const [companyAddress, setCompanyAddress] = useState<string>("");
//   const [companyAutocomplete, setCompanyAutocomplete] = useState<google.maps.places.AutocompleteService | null>(null);
//   const [companyPlacesService, setCompanyPlacesService] = useState<google.maps.places.PlacesService | null>(null);
//   const [companyPredictions, setCompanyPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);

//   const [errors, setErrors] = useState<ContactFormErrors>({});

//   const priorityMarkets = [
//     "Los Angeles",
//     "San Francisco",
//     "New York",
//     "Miami",
//     "Chicago",
//     "Austin",
//     "Seattle",
//     "Boston",
//     "Durham",
//   ];

//   // Load Google Places
//   useEffect(() => {
//     const apiKey = getGoogleMapsApiKey();
//     if (!apiKey) {
//       console.warn("Google Maps API key not configured. Places autocomplete will be disabled.");
//       return;
//     }

//     const loader = new Loader({
//       apiKey,
//       version: "weekly",
//       libraries: ["places"],
//     });
//     loader
//       .load()
//       .then(() => {
//         const autocompleteService =
//           new google.maps.places.AutocompleteService();
//         setCompanyAutocomplete(autocompleteService);
//         const div = document.createElement("div");
//         const pService = new google.maps.places.PlacesService(div);
//         setCompanyPlacesService(pService);
//       })
//       .catch((err) => console.error("Error loading Google Maps API:", err));
//   }, []);

//   // Company predictions
//   useEffect(() => {
//     if (wasSelection.current) {
//       wasSelection.current = false;
//       return;
//     }
//     const timer = setTimeout(() => {
//       if (formData.company.length >= 3 && companyAutocomplete) {
//         const request: google.maps.places.AutocompletionRequest = {
//           input: formData.company,
//           componentRestrictions: { country: "us" },
//         };
//         companyAutocomplete.getPlacePredictions(
//           request,
//           (predictions: google.maps.places.AutocompletePrediction[] | null, status: google.maps.places.PlacesServiceStatus) => {
//             if (
//               status !== google.maps.places.PlacesServiceStatus.OK ||
//               !predictions
//             ) {
//               setCompanyPredictions([]);
//               return;
//             }
//             setCompanyPredictions(predictions);
//           },
//         );
//       } else {
//         setCompanyPredictions([]);
//       }
//     }, 300);
//     return () => clearTimeout(timer);
//   }, [formData.company, companyAutocomplete]);

//   const validateForm = (): boolean => {
//     const newErrors: ContactFormErrors = {};
//     if (!formData.name || formData.name.length < 2)
//       newErrors.name = "Name is required";
//     if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
//       newErrors.email = "Valid email is required";
//     if (!formData.company || formData.company.length < 2)
//       newErrors.company = "Company name is required";
//     setErrors(newErrors);
//     return Object.keys(newErrors).length === 0;
//   };

//   const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
//     e.preventDefault();

//     if (!validateForm()) return;
//     setIsSubmitting(true);

//     try {
//       if (!db) {
//         throw new Error("Firebase database not initialized. Please check your configuration.");
//       }

//       const token = uuidv4();
//       const baseUrl = "https://blueprint-vision-fork-nijelhunt.replit.app";
//       const offWaitlistUrl = `${baseUrl}/off-waitlist-signup?token=${token}`;

//       await addDoc(collection(db, "waitlistTokens"), {
//         token,
//         email: formData.email,
//         company: formData.company,
//         status: "unused",
//         createdAt: serverTimestamp(),
//       });

//       // Send notification via backend API (secure)
//       fetch("/api/contact-webhook", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           name: formData.name,
//           company: formData.company,
//           email: formData.email,
//           city: formData.city,
//           state: formData.state,
//           message: formData.message,
//           companyWebsite,
//           offWaitlistUrl,
//         }),
//       }).catch((err) => console.error("Webhook error (non-blocking):", err));

//       setIsSuccess(true);
//       setFormData({
//         name: "",
//         email: "",
//         company: "",
//         city: "",
//         state: "",
//         message: "",
//       });
//     } catch (error) {
//       console.error("Form submission failed:", error);
//       const errorMessage = error instanceof Error ? error.message : "Unknown error";
//       alert(`Error: ${errorMessage}`);
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
//     const { name, value } = e.target;
//     setFormData((prev) => ({ ...prev, [name]: value }));
//   };

//   const isPriorityMarket = priorityMarkets.some((m) =>
//     (formData.city || "").toLowerCase().includes(m.toLowerCase()),
//   );

//   return (
//     <motion.section
//       ref={formRef}
//       id="contactForm"
//       className="py-12 md:py-20 lg:py-24 relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900"
//       initial={{ opacity: 0 }}
//       animate={{ opacity: 1 }}
//       transition={{ duration: 0.8 }}
//     >
//       {/* ambient */}
//       <div className="absolute inset-0 -z-10">
//         <div className="absolute -top-48 -right-48 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
//         <div className="absolute -bottom-48 -left-48 w-[28rem] h-[28rem] rounded-full bg-cyan-500/10 blur-3xl" />
//       </div>

//       <div className="container mx-auto px-6">
//         {/* Header */}
//         <motion.div
//           className="max-w-4xl mx-auto mb-10 md:mb-14 text-center"
//           initial={{ opacity: 0, y: 30 }}
//           animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 30 }}
//           transition={{ duration: 0.6 }}
//         >
//           <div className="inline-flex items-center justify-center gap-2 mb-4 bg-emerald-400/10 text-emerald-300 py-2 px-4 rounded-full border border-emerald-500/30">
//             <RocketLaunchIcon className="w-4 h-4" />
//             <span className="text-xs font-bold uppercase tracking-wider">
//               Limited Pilot Program
//             </span>
//           </div>
//           <h2 className="text-3xl md:text-5xl font-black leading-tight text-white">
//             Ready to Transform Your{" "}
//             <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-cyan-300">
//               Customer Experience?
//             </span>
//           </h2>
//           <p className="text-base md:text-xl text-slate-300 mt-3">
//             Onboard in ~60 minutes. No app required. Durham & nearby businesses
//             welcome.
//           </p>
//         </motion.div>

//         {/* Card */}
//         <motion.div
//           className="bg-slate-900/70 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-800"
//           initial={{ opacity: 0, y: 40 }}
//           animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 40 }}
//           transition={{ duration: 0.6, delay: 0.15 }}
//         >
//           <div className="grid grid-cols-1 lg:grid-cols-5">
//             {/* Left panel */}
//             <div className="lg:col-span-2 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6 md:p-10 relative">
//               <div className="relative z-10">
//                 <div className="flex items-center gap-2 mb-3">
//                   <SparklesIcon className="w-5 h-5 text-amber-300" />
//                   <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
//                     Early Access
//                   </span>
//                 </div>
//                 <h3 className="font-black text-2xl md:text-3xl mb-4 leading-tight">
//                   Be Among the First to Launch AR Experiences
//                 </h3>
//                 <p className="mb-6 text-sm md:text-base text-slate-300">
//                   Blueprint is transforming how businesses engage customers
//                   across retail, hospitality, and commercial spaces. Join our
//                   exclusive Pilot Program.
//                 </p>

//                 <div className="space-y-4">
//                   <div className="flex items-start gap-3">
//                     <div className="bg-white/5 rounded-xl p-2">
//                       <Award className="w-5 h-5 text-emerald-300" />
//                     </div>
//                     <div>
//                       <h4 className="font-semibold">Exclusive Early Access</h4>
//                       <p className="text-sm text-slate-400">
//                         Free pilot with priority support.
//                       </p>
//                     </div>
//                   </div>
//                   <div className="flex items-start gap-3">
//                     <div className="bg-white/5 rounded-xl p-2">
//                       <Users className="w-5 h-5 text-cyan-300" />
//                     </div>
//                     <div>
//                       <h4 className="font-semibold">White-Glove Onboarding</h4>
//                       <p className="text-sm text-slate-400">
//                         We map, design, and activate on-site.
//                       </p>
//                     </div>
//                   </div>
//                 </div>

//                 {isPriorityMarket && (
//                   <motion.div
//                     className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl"
//                     initial={{ opacity: 0, scale: 0.95 }}
//                     animate={{ opacity: 1, scale: 1 }}
//                   >
//                     <div className="flex items-center gap-2 mb-1">
//                       <StarIcon className="w-4 h-4 text-emerald-300" />
//                       <span className="font-semibold text-emerald-300">
//                         Priority Market Detected!
//                       </span>
//                     </div>
//                     <p className="text-sm text-emerald-200">
//                       {formData.city} qualifies for immediate onboarding.
//                     </p>
//                   </motion.div>
//                 )}
//               </div>
//             </div>

//             {/* Form */}
//             <div className="lg:col-span-3 p-6 md:p-10 bg-white">
//               {isSuccess ? (
//                 <motion.div
//                   className="h-full flex flex-col items-center justify-center text-center p-6"
//                   initial={{ opacity: 0, scale: 0.95 }}
//                   animate={{ opacity: 1, scale: 1 }}
//                 >
//                   <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
//                     <CheckCircleIcon className="h-10 w-10 text-emerald-600" />
//                   </div>
//                   <h3 className="text-2xl md:text-3xl font-black text-slate-900 mb-3">
//                     Welcome to the Future! 🎉
//                   </h3>
//                   <p className="text-slate-600 max-w-md">
//                     You've successfully signed up for the Pilot Program! Expect
//                     to hear from our team within 5 minutes.
//                   </p>
//                   <Button
//                     className="mt-6 bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-900 font-semibold border-0"
//                     onClick={() => setIsSuccess(false)}
//                   >
//                     Submit Another Request
//                   </Button>
//                 </motion.div>
//               ) : (
//                 <motion.form
//                   onSubmit={handleSubmit}
//                   className="space-y-6"
//                   initial={{ opacity: 0 }}
//                   animate={{ opacity: isInView ? 1 : 0 }}
//                   transition={{ duration: 0.6, delay: 0.2 }}
//                 >
//                   <div>
//                     <label
//                       className="block text-sm font-semibold mb-2 text-slate-700"
//                       htmlFor="name"
//                     >
//                       <span className="inline-flex items-center gap-2">
//                         <UserIcon className="w-4 h-4 text-emerald-600" /> Full
//                         Name
//                       </span>
//                     </label>
//                     <Input
//                       ref={nameRef}
//                       type="text"
//                       id="name"
//                       name="name"
//                       placeholder="John Doe"
//                       value={formData.name}
//                       onChange={handleChange}
//                       onKeyDown={(e) => handleKeyDown(e, emailRef)}
//                       className="border-2 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-xl py-3 px-4 text-slate-900"
//                     />

//                     {errors.name && (
//                       <p className="text-red-500 text-sm mt-2">{errors.name}</p>
//                     )}
//                   </div>

//                   <div>
//                     <label
//                       className="block text-sm font-semibold mb-2 text-slate-700"
//                       htmlFor="email"
//                     >
//                       <span className="inline-flex items-center gap-2">
//                         <EnvelopeIcon className="w-4 h-4 text-emerald-600" />{" "}
//                         Business Email
//                       </span>
//                     </label>
//                     <Input
//                       ref={emailRef}
//                       type="email"
//                       id="email"
//                       name="email"
//                       placeholder="john@company.com"
//                       value={formData.email}
//                       onChange={handleChange}
//                       onKeyDown={(e) => handleKeyDown(e, companyRef)}
//                       className="border-2 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-xl py-3 px-4 text-slate-900"
//                     />
//                     {errors.email && (
//                       <p className="text-red-500 text-sm mt-2">
//                         {errors.email}
//                       </p>
//                     )}
//                   </div>

//                   <div className="relative">
//                     <label
//                       className="block text-sm font-semibold mb-2 text-slate-700"
//                       htmlFor="company"
//                     >
//                       <span className="inline-flex items-center gap-2">
//                         <BuildingOfficeIcon className="w-4 h-4 text-emerald-600" />{" "}
//                         Company Name
//                       </span>
//                     </label>
//                     <Input
//                       ref={companyRef}
//                       type="text"
//                       id="company"
//                       name="company"
//                       placeholder="Your Company Name"
//                       value={formData.company}
//                       onChange={handleChange}
//                       onBlur={() =>
//                         setTimeout(() => setCompanyPredictions([]), 150)
//                       }
//                       onKeyDown={(e) => handleKeyDown(e, messageRef)}
//                       className="border-2 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-xl py-3 px-4 text-slate-900"
//                     />
//                     {errors.company && (
//                       <p className="text-red-500 text-sm mt-2">
//                         {errors.company}
//                       </p>
//                     )}

//                     {companyPredictions.length > 0 && (
//                       <div className="relative z-20">
//                         <div className="absolute w-full mt-2 bg-white border-2 border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
//                           {companyPredictions.map((prediction) => (
//                             <div
//                               key={prediction.place_id}
//                               className="px-4 py-3 hover:bg-emerald-50 cursor-pointer transition-colors border-b last:border-b-0"
//                               onClick={() => {
//                                 wasSelection.current = true;
//                                 setFormData({
//                                   ...formData,
//                                   company: prediction.description,
//                                 });
//                                 setCompanyPredictions([]);
//                                 if (companyPlacesService) {
//                                   const request = {
//                                     placeId: prediction.place_id,
//                                     fields: [
//                                       "website",
//                                       "formatted_address",
//                                       "address_components",
//                                     ],
//                                   };
//                                   companyPlacesService.getDetails(
//                                     request,
//                                     (placeResult, status) => {
//                                       if (
//                                         status ===
//                                           google.maps.places.PlacesServiceStatus
//                                             .OK &&
//                                         placeResult
//                                       ) {
//                                         setCompanyWebsite(
//                                           placeResult.website || "",
//                                         );
//                                         setCompanyAddress(
//                                           placeResult.formatted_address || "",
//                                         );
//                                         if (placeResult.address_components) {
//                                           let city = "";
//                                           let state = "";
//                                           placeResult.address_components.forEach(
//                                             (component) => {
//                                               if (
//                                                 (
//                                                   component.types || []
//                                                 ).includes("locality")
//                                               )
//                                                 city = component.long_name;
//                                               else if (
//                                                 (
//                                                   component.types || []
//                                                 ).includes(
//                                                   "administrative_area_level_1",
//                                                 )
//                                               )
//                                                 state = component.short_name;
//                                             },
//                                           );
//                                           setFormData((prev) => ({
//                                             ...prev,
//                                             city: city || prev.city,
//                                             state: state || prev.state,
//                                           }));
//                                         }
//                                       }
//                                     },
//                                   );
//                                 }
//                               }}
//                             >
//                               <div className="font-medium text-slate-900">
//                                 {prediction.description}
//                               </div>
//                             </div>
//                           ))}
//                         </div>
//                       </div>
//                     )}
//                   </div>

//                   <div>
//                     <label
//                       className="block text-sm font-semibold mb-2 text-slate-700"
//                       htmlFor="message"
//                     >
//                       <span className="inline-flex items-center gap-2">
//                         <ChatBubbleBottomCenterTextIcon className="w-4 h-4 text-emerald-600" />{" "}
//                         Tell Us About Your Vision (Optional)
//                       </span>
//                     </label>
//                     <Textarea
//                       ref={messageRef}
//                       id="message"
//                       name="message"
//                       placeholder="Describe your space, goals, or any specific AR experiences you have in mind..."
//                       rows={3}
//                       value={formData.message}
//                       onChange={handleChange}
//                       className="border-2 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-xl py-3 px-4 text-slate-900"
//                     />
//                   </div>

//                   <Button
//                     type="submit"
//                     disabled={isSubmitting}
//                     className="w-full py-4 text-lg font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-900 border-0 rounded-xl shadow-xl hover:opacity-90"
//                   >
//                     {isSubmitting ? (
//                       <div className="flex items-center justify-center gap-3">
//                         <svg
//                           className="animate-spin h-6 w-6"
//                           xmlns="http://www.w3.org/2000/svg"
//                           fill="none"
//                           viewBox="0 0 24 24"
//                         >
//                           <circle
//                             className="opacity-25"
//                             cx="12"
//                             cy="12"
//                             r="10"
//                             stroke="currentColor"
//                             strokeWidth="4"
//                           ></circle>
//                           <path
//                             className="opacity-75"
//                             fill="currentColor"
//                             d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
//                           ></path>
//                         </svg>
//                         Securing Your Spot...
//                       </div>
//                     ) : (
//                       <div className="flex items-center justify-center gap-3">
//                         <RocketLaunchIcon className="w-5 h-5" />
//                         Join Pilot Program
//                       </div>
//                     )}
//                   </Button>

//                   <p className="text-xs text-slate-500 text-center">
//                     By submitting, you agree to receive updates about Blueprint.
//                     We respect your privacy and never share your information.
//                   </p>
//                 </motion.form>
//               )}
//             </div>
//           </div>
//         </motion.div>
//       </div>
//     </motion.section>
//   );
// }
