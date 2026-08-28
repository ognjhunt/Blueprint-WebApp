// ==========================================
// File: src/components/sections/ContactForm.tsx
// ==========================================

"use client";

import { Loader } from "@googlemaps/js-api-loader";
import { motion, useInView } from "framer-motion";
import { withCsrfHeader } from "@/lib/csrf";
import { logger } from "@/utils/logger";
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
      if (import.meta.env.MODE !== "test") {
        logger.warn(
          "Google Maps API key not configured. Places autocomplete will be disabled.",
        );
      }
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
      .catch((err) => logger.error("Error loading Google Maps API", { err }));
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
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          company: formData.company,
          city: formData.city,
          state: formData.state,
          country: "United States",
          message: formData.message,
          companyWebsite,
          companyAddress,
          requestSource: "website-contact-form",
        }),
      });

      if (!response.ok) {
        const responseBody = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(responseBody.error || "Unable to submit contact form");
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
      logger.error("Form submission failed", { error });
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
      className="py-12 md:py-20 lg:py-24 relative overflow-hidden bg-runway-deep"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <div className="container mx-auto px-6">
        {/* Header */}
        <motion.div
          className="max-w-4xl mx-auto mb-10 md:mb-14 text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 30 }}
          transition={{ duration: 0.6 }}
        >
          <div className="runway-chip runway-chip-open mb-4">
            <RocketLaunchIcon className="w-4 h-4" />
            Early Access
          </div>
          <h2 className="font-display text-[clamp(2rem,5vw,3.25rem)] font-bold uppercase leading-[0.98] tracking-[0.005em] text-runway-text">
            Ready to Turn Your{" "}
            <span className="text-runway-signal">
              Real Site Into Readiness Evidence?
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-[68ch] text-[17px] leading-[1.7] text-runway-body">
            Blueprint captures your space, packages site-specific evidence,
            and helps your team scope a Task Evaluation Run around the exact environment and decision that matter.
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          className="runway-panel overflow-hidden"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 40 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-5">
            {/* Left panel */}
            <div className="lg:col-span-2 border-b border-runway-line bg-runway-black p-6 md:p-10 relative lg:border-b-0 lg:border-r">
              <div className="relative z-10">
                <p className="runway-eyebrow mb-3 flex items-center gap-2">
                  <SparklesIcon className="w-4 h-4" />
                  Early Access
                </p>
                <h3 className="mb-4 font-display text-[1.75rem] font-semibold uppercase leading-[1.02] tracking-[0.005em] text-runway-text md:text-[2rem]">
                  Bring your real site into Blueprint
                </h3>
                <p className="mb-6 max-w-[60ch] text-[16px] leading-[1.7] text-runway-body">
                  Blueprint turns real retail, hospitality, workplace, and venue spaces into
                  real-site Task Evaluation Runs, maintained testbeds, and evidence-bound result review.
                </p>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="border border-runway-line bg-runway-panel p-2">
                      <Award className="w-5 h-5 text-runway-green" />
                    </div>
                    <div>
                      <h4 className="font-display text-[1.05rem] font-semibold uppercase tracking-[0.005em] text-runway-text">
                        Exclusive Early Access
                      </h4>
                      <p className="mt-1 text-[15px] leading-[1.7] text-runway-mute">
                        Priority support for early world-model and hosted-access requests.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="border border-runway-line bg-runway-panel p-2">
                      <Users className="w-5 h-5 text-runway-sky" />
                    </div>
                    <div>
                      <h4 className="font-display text-[1.05rem] font-semibold uppercase tracking-[0.005em] text-runway-text">
                        White-Glove Onboarding
                      </h4>
                      <p className="mt-1 text-[15px] leading-[1.7] text-runway-mute">
                        We help scope capture, packaging, and hosted access around your exact site.
                      </p>
                    </div>
                  </div>
                </div>

                {isPriorityMarket && (
                  <motion.div
                    className="mt-6 border border-runway-green-dim bg-runway-panel p-4"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div className="flex items-center gap-2">
                      <StarIcon className="w-4 h-4 text-runway-green" />
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-runway-green">
                        Priority Market Detected!
                      </span>
                    </div>
                    <p className="mt-2 text-[15px] leading-[1.7] text-runway-body">
                      {formData.city} qualifies for immediate onboarding.
                    </p>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-3 p-6 md:p-10 bg-runway-deep">
              {isSuccess ? (
                <motion.div
                  className="h-full flex flex-col items-center justify-center text-center p-6"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <div className="mb-6 flex h-20 w-20 items-center justify-center border border-runway-green-dim bg-runway-black">
                    <CheckCircleIcon className="h-10 w-10 text-runway-green" />
                  </div>
                  <h3 className="mb-3 font-display text-[2rem] font-semibold uppercase leading-[1.02] tracking-[0.005em] text-runway-text">
                    Request received
                  </h3>
                  <p className="max-w-[52ch] text-[16px] leading-[1.7] text-runway-body">
                    We have your site and contact details. Expect a follow-up from Blueprint shortly.
                  </p>
                  <button
                    type="button"
                    className="runway-cta-ghost mt-6"
                    onClick={() => setIsSuccess(false)}
                  >
                    Submit Another Request
                  </button>
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
                    <label className="runway-label" htmlFor="name">
                      <span className="inline-flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-runway-faint" /> Full
                        Name
                      </span>
                    </label>
                    <input
                      ref={nameRef}
                      type="text"
                      id="name"
                      name="name"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={handleChange}
                      onKeyDown={(e) => handleKeyDown(e, emailRef)}
                      className="runway-input"
                    />

                    {errors.name && (
                      <p className="mt-2 text-[13px] text-runway-red">{errors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="runway-label" htmlFor="email">
                      <span className="inline-flex items-center gap-2">
                        <EnvelopeIcon className="w-4 h-4 text-runway-faint" />{" "}
                        Business Email
                      </span>
                    </label>
                    <input
                      ref={emailRef}
                      type="email"
                      id="email"
                      name="email"
                      placeholder="john@company.com"
                      value={formData.email}
                      onChange={handleChange}
                      onKeyDown={(e) => handleKeyDown(e, companyRef)}
                      className="runway-input"
                    />
                    {errors.email && (
                      <p className="mt-2 text-[13px] text-runway-red">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div className="relative">
                    <label className="runway-label" htmlFor="company">
                      <span className="inline-flex items-center gap-2">
                        <BuildingOfficeIcon className="w-4 h-4 text-runway-faint" />{" "}
                        Company Name
                      </span>
                    </label>
                    <input
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
                      className="runway-input"
                    />
                    {errors.company && (
                      <p className="mt-2 text-[13px] text-runway-red">
                        {errors.company}
                      </p>
                    )}

                    {companyPredictions.length > 0 && (
                      <div className="relative z-20">
                        <div className="absolute mt-1 max-h-60 w-full overflow-y-auto border border-runway-line-strong bg-runway-panel">
                          {companyPredictions.map((prediction) => (
                            <div
                              key={prediction.place_id}
                              className="cursor-pointer border-b border-runway-line-soft px-4 py-3 transition-colors last:border-b-0 hover:bg-runway-raised"
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
                              <div className="text-[14px] font-medium text-runway-text">
                                {prediction.description}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="runway-label" htmlFor="message">
                      <span className="inline-flex items-center gap-2">
                        <ChatBubbleBottomCenterTextIcon className="w-4 h-4 text-runway-faint" />{" "}
                        Tell Us About Your Vision (Optional)
                      </span>
                    </label>
                    <textarea
                      ref={messageRef}
                      id="message"
                      name="message"
                      placeholder="Describe your space, goals, hosted-review needs, or the workflow you want scoped..."
                      rows={3}
                      value={formData.message}
                      onChange={handleChange}
                      className="runway-input"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="runway-cta w-full disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center gap-3">
                        <svg
                          className="animate-spin h-5 w-5"
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
                        Request early access
                      </div>
                    )}
                  </button>

                  <p className="text-center text-[13px] leading-[1.6] text-runway-mute">
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
