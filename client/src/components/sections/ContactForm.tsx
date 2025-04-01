"use client";

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
} from "@heroicons/react/24/outline";
import { SparklesIcon } from "@heroicons/react/24/solid";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

interface FormData {
  name: string;
  email: string;
  company: string;
  city: string;
  state: string;
  message: string;
}

export default function ContactForm() {
  const formRef = useRef(null);
  const isInView = useInView(formRef, { once: true, amount: 0.3 });

  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    company: "",
    city: "",
    state: "",
    message: "",
  });

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // NEW: Company website and autocomplete
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyAutocomplete, setCompanyAutocomplete] =
    useState<google.maps.places.AutocompleteService | null>(null);
  const [companyPlacesService, setCompanyPlacesService] =
    useState<google.maps.places.PlacesService | null>(null);
  const [companyPredictions, setCompanyPredictions] = useState<
    google.maps.places.AutocompletePrediction[]
  >([]);

  useEffect(() => {
    const loader = new Loader({
      apiKey: "AIzaSyBgxzzgcT_9nyhz1D_JtfG7gevRUKQ5Vbs", // Replace with your actual API key
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
      .catch((err) => {
        console.error("Error loading Google Maps API:", err);
      });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.company.length >= 3 && companyAutocomplete) {
        const request: google.maps.places.AutocompletionRequest = {
          input: formData.company,
          componentRestrictions: { country: "us" },
        };
        companyAutocomplete.getPlacePredictions(
          request,
          (predictions, status) => {
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
    }, 300); // 300ms debounce
    return () => clearTimeout(timer);
  }, [formData.company, companyAutocomplete]);

  const [errors, setErrors] = useState<Partial<FormData>>({});

  const validateForm = () => {
    const newErrors: Partial<FormData> = {};

    if (!formData.name || formData.name.length < 2) {
      newErrors.name = "Name is required";
    }
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Valid email is required";
    }
    if (!formData.company || formData.company.length < 2) {
      newErrors.company = "Company name is required";
    }
    if (!formData.city || formData.city.length < 2) {
      newErrors.city = "City is required";
    }
    if (!formData.state || formData.state.length < 2) {
      newErrors.state = "State is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      // Generate a unique token
      const token = uuidv4();
      const baseUrl = window.location.origin;
      const offWaitlistUrl = `${baseUrl}/off-waitlist-signup?token=${token}`;

      // Store token in Firebase
      await addDoc(collection(db, "waitlistTokens"), {
        token: token,
        email: formData.email,
        company: formData.company,
        status: "unused",
        createdAt: serverTimestamp(),
      });

      const options = {
        method: "POST",
        headers: {
          Authorization: "Bearer c4dc7fe399094cd3819c96e51dded30c",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: "Hs4h5E9hjnVCNcbF4ns2puDi3oR2",
          saved_item_id: "oxcGGr2mxAXaZTg6o1hJaN",
          pipeline_inputs: [
            { input_name: "contact_name", value: formData.name },
            { input_name: "email", value: formData.email },
            { input_name: "company", value: formData.company },
            { input_name: "company_url", value: companyWebsite },
            {
              input_name: "location",
              value: `${formData.city}, ${formData.state}`,
            },
            { input_name: "message", value: formData.message },
            { input_name: "signup_link", value: offWaitlistUrl }, // Keep this
            { input_name: "token", value: token }, // Add the token explicitly
            { input_name: "base_url", value: baseUrl }, // Add base URL for flexibility
          ],
        }),
      };

      console.log("Sending request to Gumloop with options:", options);
      const response = await fetch(
        "https://api.gumloop.com/api/v1/start_pipeline",
        options,
      );
      console.log("Gumloop API response status:", response.status);
      const gumloopResponse = await response.json();
      console.log("Gumloop API response:", gumloopResponse);

      if (!response.ok) {
        throw new Error("Failed to submit form");
      }

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
      console.error("Error submitting form:", error);
      alert("There was an error submitting your form. Please try again.");
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

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 50,
      },
    },
  };

  return (
    <motion.section
      ref={formRef}
      id="contactForm"
      className="py-24 relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      {/* Background gradient and decorative elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-50 to-white -z-10" />
      <motion.div
        className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indigo-50 to-transparent -z-10"
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: isInView ? 1 : 0, x: isInView ? 0 : 100 }}
        transition={{ duration: 1.2 }}
      />
      <motion.div
        className="absolute -top-40 -left-40 w-80 h-80 bg-gradient-to-br from-violet-200 to-fuchsia-200 rounded-full blur-3xl opacity-30 -z-10"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.2, 0.3],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          repeatType: "reverse",
        }}
      />

      <div className="container mx-auto px-4">
        <motion.div
          className="max-w-3xl mx-auto mb-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center justify-center mb-4">
            <SparklesIcon className="w-6 h-6 text-indigo-500 mr-2" />
            <span className="text-sm font-medium text-indigo-600 uppercase tracking-wider">
              Limited Early Access
            </span>
          </div>
          <h2 className="text-4xl font-bold mb-5 leading-tight text-gray-900">
            Join the waitlist and transform your{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 text-transparent bg-clip-text">
              customer experience
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Be among the first to leverage our groundbreaking AR technology.
            Early access members receive premium onboarding support and
            exclusive pricing.
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          <motion.div
            className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-indigo-100"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 30 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-5">
              {/* Left sidebar */}
              <div className="lg:col-span-2 bg-gradient-to-br from-indigo-600 to-violet-700 text-white p-10 relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="font-bold text-2xl mb-6">
                    Delight your customers with personalized visits
                  </h3>
                  <p className="mb-8 opacity-90">
                    Blueprint is trusted by forward-thinking businesses across
                    retail, hospitality, and commercial real estate.
                  </p>

                  <div className="space-y-6">
                    <div className="flex items-start space-x-4">
                      <div className="bg-white/20 rounded-full p-2 mt-1">
                        <BuildingOfficeIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Enterprise Ready</h4>
                        <p className="text-sm opacity-80">
                          Scalable solutions for businesses of all sizes
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-4">
                      <div className="bg-white/20 rounded-full p-2 mt-1">
                        <MapPinIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Priority Markets</h4>
                        <p className="text-sm opacity-80">
                          Some cities qualify for immediate onboarding with no
                          waiting period
                        </p>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Background decorations */}
                <div className="absolute top-0 right-0 w-full h-full">
                  <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 400 400"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute top-0 left-0 opacity-10"
                  >
                    <defs>
                      <pattern
                        id="smallGrid"
                        width="20"
                        height="20"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M 20 0 L 0 0 0 20"
                          fill="none"
                          stroke="white"
                          strokeWidth="1"
                        />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#smallGrid)" />
                  </svg>

                  <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-3xl"></div>
                </div>
              </div>

              {/* Form area */}
              <div className="lg:col-span-3 p-8 md:p-10">
                {isSuccess ? (
                  <motion.div
                    className="h-full flex flex-col items-center justify-center text-center p-8"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-10 w-10 text-green-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">
                      Thank You!
                    </h3>
                    <p className="text-lg text-gray-600 mb-6">
                      Your submission has been received. We'll be in touch
                      shortly with next steps.
                    </p>
                    <Button
                      className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
                      onClick={() => setIsSuccess(false)}
                    >
                      Submit Another Request
                    </Button>
                  </motion.div>
                ) : (
                  <motion.form
                    onSubmit={handleSubmit}
                    className="space-y-6"
                    variants={containerVariants}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                  >
                    <motion.div variants={itemVariants}>
                      <label
                        className="block text-lg font-medium mb-2 flex items-center"
                        htmlFor="name"
                      >
                        <UserIcon className="w-5 h-5 mr-2 text-indigo-500" />
                        Name
                      </label>
                      <Input
                        type="text"
                        id="name"
                        name="name"
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={handleChange}
                        className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl"
                      />
                      {errors.name && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors.name}
                        </p>
                      )}
                    </motion.div>
                    <motion.div variants={itemVariants}>
                      <label
                        className="block text-lg font-medium mb-2 flex items-center"
                        htmlFor="email"
                      >
                        <EnvelopeIcon className="w-5 h-5 mr-2 text-indigo-500" />
                        Company Email
                      </label>
                      <Input
                        type="email"
                        id="email"
                        name="email"
                        placeholder="john@company.com"
                        value={formData.email}
                        onChange={handleChange}
                        className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl"
                      />
                      {errors.email && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors.email}
                        </p>
                      )}
                    </motion.div>
                    <motion.div variants={itemVariants} className="relative">
                      <label
                        className="block text-lg font-medium mb-2 flex items-center"
                        htmlFor="company"
                      >
                        <BuildingOfficeIcon className="w-5 h-5 mr-2 text-indigo-500" />
                        Company
                      </label>
                      <Input
                        type="text"
                        id="company"
                        name="company"
                        placeholder="Company Name"
                        value={formData.company}
                        onChange={handleChange}
                        className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl"
                      />
                      {errors.company && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors.company}
                        </p>
                      )}

                      {/* Company Autocomplete Predictions */}
                      {companyPredictions.length > 0 && (
                        <div className="relative z-10">
                          <div className="absolute w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg">
                            {companyPredictions.map((prediction) => (
                              <div
                                key={prediction.place_id}
                                className="px-4 py-3 hover:bg-indigo-50 cursor-pointer transition-colors duration-150 first:rounded-t-xl last:rounded-b-xl"
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    company: prediction.description,
                                  });
                                  setCompanyPredictions([]);
                                  if (companyPlacesService) {
                                    const request = {
                                      placeId: prediction.place_id,
                                      fields: ["website"],
                                    };
                                    companyPlacesService.getDetails(
                                      request,
                                      (placeResult, status) => {
                                        if (
                                          status ===
                                            google.maps.places
                                              .PlacesServiceStatus.OK &&
                                          placeResult
                                        ) {
                                          setCompanyWebsite(
                                            placeResult.website || "",
                                          );
                                        }
                                      },
                                    );
                                  }
                                }}
                              >
                                {prediction.description}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                    <motion.div
                      variants={itemVariants}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div>
                        <label
                          className="block text-lg font-medium mb-2 flex items-center"
                          htmlFor="city"
                        >
                          <MapPinIcon className="w-5 h-5 mr-2 text-indigo-500" />
                          City
                        </label>
                        <Input
                          type="text"
                          id="city"
                          name="city"
                          placeholder="San Francisco"
                          value={formData.city}
                          onChange={handleChange}
                          className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl"
                        />
                        {errors.city && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.city}
                          </p>
                        )}
                      </div>
                      <div>
                        <label
                          className="block text-lg font-medium mb-2"
                          htmlFor="state"
                        >
                          State
                        </label>
                        <Input
                          type="text"
                          id="state"
                          name="state"
                          placeholder="CA"
                          value={formData.state}
                          onChange={handleChange}
                          className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl"
                        />
                        {errors.state && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors.state}
                          </p>
                        )}
                      </div>
                    </motion.div>
                    <motion.div variants={itemVariants}>
                      <label
                        className="block text-lg font-medium mb-2 flex items-center"
                        htmlFor="message"
                      >
                        <ChatBubbleBottomCenterTextIcon className="w-5 h-5 mr-2 text-indigo-500" />
                        Additional Comments (Optional)
                      </label>
                      <Textarea
                        id="message"
                        name="message"
                        placeholder="Share any specific interests or questions..."
                        rows={4}
                        value={formData.message}
                        onChange={handleChange}
                        className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl"
                      />
                      {errors.message && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors.message}
                        </p>
                      )}
                    </motion.div>
                    <motion.div variants={itemVariants}>
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-6 text-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 transition-all duration-300 rounded-xl shadow-lg hover:shadow-indigo-100/50 shadow-indigo-200/30"
                      >
                        {isSubmitting ? (
                          <div className="flex items-center justify-center">
                            <svg
                              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                            Processing...
                          </div>
                        ) : (
                          "Join Waitlist"
                        )}
                      </Button>
                    </motion.div>
                  </motion.form>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}
