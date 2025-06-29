// This file defines the ContactForm component, which allows users to submit their contact information
// and a message to join a waitlist or get in touch with the team.
// It includes form validation, integration with Google Maps Places API for company autocomplete,
// and submission to a Firebase backend.

"use client";

import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";
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
  PhoneIcon,
  ClockIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import {
  SparklesIcon,
  RocketLaunchIcon,
  StarIcon,
} from "@heroicons/react/24/solid";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { Shield, Zap, Users, Award, Clock, TrendingUp } from "lucide-react";

interface FormData {
  name: string;
  email: string;
  company: string;
  city: string;
  state: string;
  message: string;
}

/**
 * The ContactForm component allows users to submit their contact information
 * and a message to join a waitlist or get in touch with the team.
 * It includes form validation, integration with Google Maps Places API for company autocomplete,
 * and submission to a Firebase backend.
 *
 * @returns {JSX.Element} The rendered ContactForm component.
 */
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const wasSelection = useRef(false);

  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyAutocomplete, setCompanyAutocomplete] =
    useState<google.maps.places.AutocompleteService | null>(null);
  const [companyPlacesService, setCompanyPlacesService] =
    useState<google.maps.places.PlacesService | null>(null);
  const [companyPredictions, setCompanyPredictions] = useState<
    google.maps.places.AutocompletePrediction[]
  >([]);

  const [errors, setErrors] = useState<Partial<FormData>>({});

  /**
   * Validates the form data and sets errors if any field is invalid.
   * @returns {boolean} True if the form is valid, false otherwise.
   */
  // Enhanced trust indicators and benefits
  const benefits = [
    {
      icon: <Clock className="w-5 h-5" />,
      title: "Fast Implementation",
      description: "Go live in 1 day",
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: "Enterprise Security",
      description: "Bank-level data protection",
    },
    {
      icon: <Users className="w-5 h-5" />,
      title: "Dedicated Support",
      description: "Personal success manager",
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: "Proven Impact",
      description: "200%+ engagement increase",
    },
  ];

  const priorityMarkets = [
    "Los Angeles",
    "San Francisco",
    "New York",
    "Miami",
    "Chicago",
    "Austin",
    "Seattle",
    "Boston",
  ];

  useEffect(() => {
    const loader = new Loader({
      apiKey: "AIzaSyBgxzzgcT_9nyhz1D_JtfG7gevRUKQ5Vbs",
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
    }, 300);
    return () => clearTimeout(timer);
  }, [formData.company, companyAutocomplete]);

  /**
   * Validates the form data and sets errors if any field is invalid.
   * @returns {boolean} True if the form is valid, false otherwise.
   */
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

  /**
   * Handles the form submission.
   * Validates the form, submits the data to Firebase, and handles UI updates.
   * @param {React.FormEvent} e - The form submission event.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("🟡 [DEBUG] Form submitted - handleSubmit called");
    console.log("🟡 [DEBUG] Form data:", formData);

    const isValid = validateForm();
    console.log("🟡 [DEBUG] Form validation result:", isValid);
    console.log("🟡 [DEBUG] Validation errors:", errors);

    if (!isValid) {
      console.log("❌ [DEBUG] Form validation failed, returning early");
      return;
    }

    console.log("✅ [DEBUG] Form validation passed, proceeding...");
    setIsSubmitting(true);

    try {
      console.log("🟡 [DEBUG] Creating Firebase token...");
      const token = uuidv4();
      const baseUrl = "https://blueprint-vision-fork-nijelhunt.replit.app";
      const offWaitlistUrl = `${baseUrl}/off-waitlist-signup?token=${token}`;

      // Create Firebase token record
      await addDoc(collection(db, "waitlistTokens"), {
        token: token,
        email: formData.email,
        company: formData.company,
        status: "unused",
        createdAt: serverTimestamp(),
      });

      console.log("✅ [DEBUG] Firebase token created successfully");

      // Fire-and-forget API call - don't wait for it to complete
      // fetch("/api/process-waitlist", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({
      //     name: formData.name,
      //     company: formData.company,
      //     email: formData.email,
      //     city: formData.city,
      //     state: formData.state,
      //     message: formData.message,
      //     companyWebsite: companyWebsite,
      //     offWaitlistUrl: offWaitlistUrl,
      //   }),
      // })
      //   .then((response) => {
      //     console.log(
      //       "🔵 [FRONTEND] Background API completed:",
      //       response.status,
      //     );
      //     return response.json();
      //   })
      //   .then((data) => {
      //     console.log("✅ [FRONTEND] Background API Success:", data);
      //   })
      //   .catch((error) => {
      //     console.error(
      //       "❌ [FRONTEND] Background API Error (non-blocking):",
      //       error,
      //     );
      //   });

      // Fire-and-forget Lindy webhook call - don't wait for it to complete
      fetch("https://public.lindy.ai/api/v1/webhooks/lindy/163b37c0-2f5c-4969-9b2e-0d5ec61afb52", {
        method: "POST",
        headers: {
          "Authorization": "Bearer 1b1338d68dff4f009bbfaee1166cb9fc48b5fefa6dddbea797264674e2ee0150",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          company: formData.company,
          email: formData.email,
          city: formData.city,
          state: formData.state,
          message: formData.message,
          companyWebsite: companyWebsite,
          offWaitlistUrl: offWaitlistUrl,
        }),
      })
        .then((response) => {
          console.log(
            "🔵 [FRONTEND] Lindy webhook completed:",
            response.status,
          );
          return response.json();
        })
        .then((data) => {
          console.log("✅ [FRONTEND] Lindy webhook Success:", data);
        })
        .catch((error) => {
          console.error(
            "❌ [FRONTEND] Lindy webhook Error (non-blocking):",
            error,
          );
        });

      // Immediately show success without waiting for API
      console.log("✅ [FRONTEND] Showing success immediately");
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
      console.error("❌ [FRONTEND] Form submission failed:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // const handleSubmit = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   if (!validateForm()) return;
  //   setIsSubmitting(true);

  //   try {
  //     const token = uuidv4();
  //     const baseUrl = "https://blueprint-vision-fork-nijelhunt.replit.app";
  //     const offWaitlistUrl = `${baseUrl}/off-waitlist-signup?token=${token}`;

  //     // Create Firebase token record
  //     await addDoc(collection(db, "waitlistTokens"), {
  //       token: token,
  //       email: formData.email,
  //       company: formData.company,
  //       status: "unused",
  //       createdAt: serverTimestamp(),
  //     });

  //     // Process waitlist with AI automation
  //     const mcpResponse = await fetch("/api/process-waitlist", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify({
  //         name: formData.name,
  //         company: formData.company,
  //         email: formData.email,
  //         city: formData.city,
  //         state: formData.state,
  //         message: formData.message,
  //         companyWebsite: companyWebsite,
  //         offWaitlistUrl: offWaitlistUrl,
  //       }),
  //     });

  //     if (!mcpResponse.ok) {
  //       throw new Error("Failed to process waitlist signup");
  //     }

  //     setIsSuccess(true);
  //     setFormData({
  //       name: "",
  //       email: "",
  //       company: "",
  //       city: "",
  //       state: "",
  //       message: "",
  //     });
  //   } catch (error) {
  //     console.error("Error submitting form:", error);
  //     alert("There was an error submitting your form. Please try again.");
  //   } finally {
  //     setIsSubmitting(false);
  //   }
  // };

  /**
   * Handles changes to form input fields and updates the form data state.
   * @param {React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>} e - The input change event.
   */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const isPriorityMarket = priorityMarkets.some((market) =>
    formData.city.toLowerCase().includes(market.toLowerCase()),
  );

  return (
    <motion.section
      ref={formRef}
      id="contactForm"
      className="py-10 md:py-20 lg:py-28 relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      {/* Enhanced background elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/80 via-transparent to-violet-50/60 -z-10" />
      <motion.div
        className="absolute -top-60 -right-60 w-96 h-96 bg-gradient-to-br from-violet-200/40 to-fuchsia-200/30 rounded-full blur-3xl opacity-70 -z-10"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.7, 0.4, 0.7],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          repeatType: "reverse",
        }}
      />

      <div className="container mx-auto px-6 relative z-10">
        {/* Enhanced header */}
        <motion.div
          className="max-w-4xl mx-auto mb-8 md:mb-20 text-center" // Reduced mb-20 to mb-8 on mobile
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 30 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center justify-center gap-2 mb-4 md:mb-6 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 py-2 md:py-3 px-4 md:px-6 rounded-full border border-emerald-200">
            <RocketLaunchIcon className="w-4 h-4 md:w-5 md:h-5" />
            <span className="text-xs md:text-sm font-bold uppercase tracking-wider">
              Limited Early Access Program
            </span>
          </div>

          <h2 className="text-3xl md:text-6xl font-black mb-4 md:mb-8 leading-tight text-slate-900">
            Ready to Transform Your{" "}
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-transparent bg-clip-text">
              Customer Experience?
            </span>
          </h2>

          <p className="text-lg md:text-2xl text-slate-600 max-w-3xl mx-auto leading-relaxed mb-6 md:mb-8">
            Join industry leaders who are already revolutionizing customer
            engagement with our cutting-edge AR technology platform.
          </p>

          {/* Mobile: Show only 2 key benefits, Desktop: Show all 4 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-3xl mx-auto">
            {benefits.slice(0, 2).map((benefit, index) => (
              <motion.div
                key={benefit.title}
                className="text-center p-3 md:p-4 bg-white/80 backdrop-blur-sm rounded-xl md:rounded-2xl border border-slate-200 shadow-sm"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-lg md:rounded-xl flex items-center justify-center text-white mx-auto mb-2 md:mb-3">
                  {benefit.icon}
                </div>
                <h4 className="font-bold text-xs md:text-sm text-slate-900 mb-1">
                  {benefit.title}
                </h4>
                <p className="text-xs text-slate-600 hidden md:block">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
            {/* Show remaining benefits only on desktop */}
            <div className="hidden md:contents">
              {benefits.slice(2).map((benefit, index) => (
                <motion.div
                  key={benefit.title}
                  className="text-center p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
                  transition={{ duration: 0.6, delay: (index + 2) * 0.1 }}
                >
                  <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center text-white mx-auto mb-3">
                    {benefit.icon}
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 mb-1">
                    {benefit.title}
                  </h4>
                  <p className="text-xs text-slate-600">
                    {benefit.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="max-w-6xl mx-auto">
          <motion.div
            className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 40 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-5">
              {/* Enhanced left sidebar */}
              <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 via-indigo-900 to-violet-900 text-white p-4 md:p-8 lg:p-12 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3 md:mb-4">
                    <SparklesIcon className="w-5 h-5 md:w-6 md:h-6 text-yellow-400" />
                    <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-yellow-400">
                      Early Access
                    </span>
                  </div>

                  <h3 className="font-black text-xl md:text-3xl mb-4 md:mb-6 leading-tight">
                    Be Among the First to Launch AR Experiences
                  </h3>

                  {/* Mobile: Show only key info, Desktop: Show full content */}
                  <p className="mb-4 md:mb-8 text-sm md:text-lg opacity-90 leading-relaxed">
                    <span className="md:hidden">
                      Join our exclusive early access program with white-glove
                      onboarding.
                    </span>
                    <span className="hidden md:block">
                      Blueprint is transforming how businesses engage customers
                      across retail, hospitality, and commercial spaces. Join
                      our exclusive early access program.
                    </span>
                  </p>

                  {/* Mobile: Show condensed benefits, Desktop: Show full list */}
                  <div className="space-y-3 md:space-y-6">
                    {/* Mobile: Only show first benefit */}
                    <div className="md:hidden">
                      <div className="flex items-center space-x-3">
                        <div className="bg-white/20 rounded-xl p-2">
                          <Award className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm">
                            Exclusive Early Access
                          </h4>
                          <p className="text-xs opacity-80">
                            Free pilot program with priority support
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Desktop: Show all benefits */}
                    <div className="hidden md:block space-y-6">
                      <div className="flex items-start space-x-4">
                        <div className="bg-white/20 rounded-2xl p-3 mt-1">
                          <Award className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">
                            Exclusive Early Access
                          </h4>
                          <p className="text-sm opacity-80 leading-relaxed">
                            Get exclusive access and benefits as an early
                            participant in our free pilot program.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-4">
                        <div className="bg-white/20 rounded-2xl p-3 mt-1">
                          <Users className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">
                            White-Glove Onboarding
                          </h4>
                          <p className="text-sm opacity-80 leading-relaxed">
                            Dedicated success team ensures seamless
                            implementation and optimization
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-4">
                        <div className="bg-white/20 rounded-2xl p-3 mt-1">
                          <Zap className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">
                            Priority Markets
                          </h4>
                          <p className="text-sm opacity-80 leading-relaxed">
                            Major cities qualify for immediate deployment with
                            no waiting period
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Priority market indicator - keep as is but smaller on mobile */}
                  {isPriorityMarket && (
                    <motion.div
                      className="mt-4 md:mt-8 p-3 md:p-4 bg-emerald-500/20 border border-emerald-400/30 rounded-xl md:rounded-2xl"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 }}
                    >
                      <div className="flex items-center gap-2 mb-1 md:mb-2">
                        <StarIcon className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
                        <span className="font-bold text-emerald-400 text-sm md:text-base">
                          Priority Market Detected!
                        </span>
                      </div>
                      <p className="text-xs md:text-sm text-emerald-200">
                        {formData.city} qualifies for immediate onboarding.
                      </p>
                    </motion.div>
                  )}
                </div>

                {/* Enhanced background decorations */}
                <div className="absolute top-0 right-0 w-full h-full opacity-10">
                  <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 400 400"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <pattern
                        id="enhancedGrid"
                        width="30"
                        height="30"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M 30 0 L 0 0 0 30"
                          fill="none"
                          stroke="white"
                          strokeWidth="1"
                        />
                      </pattern>
                    </defs>
                    <rect
                      width="100%"
                      height="100%"
                      fill="url(#enhancedGrid)"
                    />
                  </svg>
                  <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-white/10 blur-3xl"></div>
                  <div className="absolute -top-20 -left-20 w-60 h-60 rounded-full bg-indigo-400/20 blur-2xl"></div>
                </div>
              </div>

              {/* Enhanced form area */}
              <div className="lg:col-span-3 p-4 md:p-8 lg:p-12">
                {isSuccess ? (
                  // Keep success state as is but reduce padding
                  <motion.div
                    className="h-full flex flex-col items-center justify-center text-center p-4 md:p-8"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                  >
                    <div className="w-24 h-24 rounded-full bg-gradient-to-r from-emerald-100 to-teal-100 flex items-center justify-center mb-8">
                      <CheckCircleIcon className="h-12 w-12 text-emerald-600" />
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 mb-4">
                      Welcome to the Future! 🎉
                    </h3>
                    <p className="text-xl text-slate-600 mb-6 max-w-md">
                      You're officially on our exclusive waitlist. Expect to
                      hear from our team within 24 hours.
                    </p>
                    <div className="text-sm text-slate-500 mb-8">
                      <p>• Check your email for confirmation</p>
                      <p>• Priority access secured</p>
                    </div>
                    <Button
                      className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 px-8 py-3 font-semibold"
                      onClick={() => setIsSuccess(false)}
                    >
                      Submit Another Request
                    </Button>
                  </motion.div>
                ) : (
                  <motion.form
                    onSubmit={handleSubmit}
                    className="space-y-4 md:space-y-8" // Reduced spacing on mobile
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isInView ? 1 : 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                  >
                    {/* All form fields - just update the spacing and sizing */}
                    <div>
                      <label
                        className="block text-base md:text-lg font-bold mb-2 md:mb-3 flex items-center text-slate-900"
                        htmlFor="name"
                      >
                        <UserIcon className="w-4 h-4 md:w-5 md:h-5 mr-2 md:mr-3 text-indigo-500" />
                        Full Name
                      </label>
                      <Input
                        type="text"
                        id="name"
                        name="name"
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={handleChange}
                        className="border-2 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-base md:text-lg bg-white/80 backdrop-blur-sm"
                      />
                      {errors.name && (
                        <p className="text-red-500 text-sm mt-2">
                          {errors.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        className="block text-lg font-bold mb-3 flex items-center text-slate-900"
                        htmlFor="email"
                      >
                        <EnvelopeIcon className="w-5 h-5 mr-3 text-indigo-500" />
                        Business Email
                      </label>
                      <Input
                        type="email"
                        id="email"
                        name="email"
                        placeholder="john@company.com"
                        value={formData.email}
                        onChange={handleChange}
                        className="border-2 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-2xl py-4 px-6 text-lg bg-white/80 backdrop-blur-sm"
                      />
                      {errors.email && (
                        <p className="text-red-500 text-sm mt-2">
                          {errors.email}
                        </p>
                      )}
                    </div>

                    <div className="relative">
                      <label
                        className="block text-lg font-bold mb-3 flex items-center text-slate-900"
                        htmlFor="company"
                      >
                        <BuildingOfficeIcon className="w-5 h-5 mr-3 text-indigo-500" />
                        Company Name
                      </label>
                      <Input
                        type="text"
                        id="company"
                        name="company"
                        placeholder="Your Company Name"
                        value={formData.company}
                        onChange={handleChange}
                        onBlur={() => {
                          setTimeout(() => {
                            setCompanyPredictions([]);
                          }, 150);
                        }}
                        className="border-2 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-2xl py-4 px-6 text-lg bg-white/80 backdrop-blur-sm"
                      />
                      {errors.company && (
                        <p className="text-red-500 text-sm mt-2">
                          {errors.company}
                        </p>
                      )}

                      {/* Enhanced company autocomplete */}
                      {companyPredictions.length > 0 && (
                        <div className="relative z-20">
                          <div className="absolute w-full mt-2 bg-white border-2 border-slate-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto">
                            {companyPredictions.map((prediction) => (
                              <div
                                key={prediction.place_id}
                                className="px-6 py-4 hover:bg-indigo-50 cursor-pointer transition-colors duration-200 first:rounded-t-2xl last:rounded-b-2xl border-b border-slate-100 last:border-b-0"
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
                                      fields: ["website", "formatted_address"],
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
                                          setCompanyAddress(
                                            placeResult.formatted_address || "",
                                          );
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div>
                        <label
                          className="block text-base md:text-lg font-bold mb-2 md:mb-3 flex items-center text-slate-900"
                          htmlFor="city"
                        >
                          <MapPinIcon className="w-4 h-4 md:w-5 md:h-5 mr-2 md:mr-3 text-indigo-500" />
                          City
                        </label>
                        <Input
                          type="text"
                          id="city"
                          name="city"
                          placeholder="Los Angeles"
                          value={formData.city}
                          onChange={handleChange}
                          className="border-2 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-base md:text-lg bg-white/80 backdrop-blur-sm"
                        />
                        {errors.city && (
                          <p className="text-red-500 text-sm mt-2">
                            {errors.city}
                          </p>
                        )}
                      </div>
                      <div>
                        <label
                          className="block text-base md:text-lg font-bold mb-2 md:mb-3 text-slate-900"
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
                          className="border-2 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-base md:text-lg bg-white/80 backdrop-blur-sm"
                        />
                        {errors.state && (
                          <p className="text-red-500 text-sm mt-2">
                            {errors.state}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label
                        className="block text-base md:text-lg font-bold mb-2 md:mb-3 flex items-center text-slate-900"
                        htmlFor="message"
                      >
                        <ChatBubbleBottomCenterTextIcon className="w-4 h-4 md:w-5 md:h-5 mr-2 md:mr-3 text-indigo-500" />
                        Tell Us About Your Vision (Optional)
                      </label>
                      <Textarea
                        id="message"
                        name="message"
                        placeholder="Describe your space, goals, or any specific AR experiences you have in mind..."
                        rows={3} // Reduced from 4
                        value={formData.message}
                        onChange={handleChange}
                        className="border-2 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-base md:text-lg bg-white/80 backdrop-blur-sm resize-none"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-4 md:py-6 text-lg md:text-xl font-bold bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:from-indigo-700 hover:via-violet-700 hover:to-fuchsia-700 transition-all duration-500 rounded-xl md:rounded-2xl shadow-2xl hover:shadow-indigo-200/50 border-0 hover:scale-105"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center justify-center gap-3">
                          <svg
                            className="animate-spin h-6 w-6 text-white"
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
                          <RocketLaunchIcon className="w-6 h-6" />
                          Secure My Early Access
                        </div>
                      )}
                    </Button>

                    <p className="text-xs md:text-sm text-slate-500 text-center">
                      By submitting, you agree to receive updates about
                      Blueprint. We respect your privacy and never share your
                      information.
                    </p>
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
