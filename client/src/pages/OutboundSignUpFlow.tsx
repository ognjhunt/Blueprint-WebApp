// OutboundSignUpFlow — Revamped UI in Blueprint's emerald/cyan dark theme
// Keeps all existing functionality (Firebase auth, Firestore writes, Places Autocomplete,
// booking + demo scheduling, webhook call, confirmation redirect).
//
// Notes:
// - Persuasive left column for Durham/Triangle pilot messaging
// - Snappy stepper with progress line and statuses
// - Sticky live Summary card (desktop); collapsible on mobile
// - Friendlier dark calendar (react-datepicker) + chunked time-slot chips
// - Stronger microcopy and field grouping
//
// Requires existing shadcn/ui components: Button, Input, Label
// Requires Nav and Footer components

"use client";

import { Loader } from "@googlemaps/js-api-loader";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import DatePicker from "react-datepicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Mail,
  Lock,
  Building2,
  MapPin,
  Phone,
  Ruler,
  Shield,
  Sparkles,
  Users,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Globe,
} from "lucide-react";
import "react-datepicker/dist/react-datepicker.css";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import {
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  arrayUnion,
} from "firebase/firestore";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { db } from "@/lib/firebase";

// ---------------------------------------------------------
// Component
// ---------------------------------------------------------
export default function OutboundSignUpFlow() {
  const [showStep2Errors, setShowStep2Errors] = useState(false);
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const [userCreated, setUserCreated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step machine
  const [step, setStep] = useState(1);

  // Step 1
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2
  const [contactName, setContactName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [squareFootage, setSquareFootage] = useState<number | null>(null);

  // Step 3 — Mapping
  const [scheduleDate, setScheduleDate] = useState(new Date());
  const [scheduleTime, setScheduleTime] = useState("08:00");

  // Step 4 — Demo
  const [demoDate, setDemoDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  });
  const [demoTime, setDemoTime] = useState("11:00");

  const [errorMessage, setErrorMessage] = useState("");

  // Validation helpers
  function isValidEmail(val: string) {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(val);
  }
  function isValidPhone(phone: string) {
    const digits = phone.replace(/\D/g, "");
    return digits.length === 10;
  }

  const initialOrgNameSet = useRef(false);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const step2Valid =
    contactName.trim() !== "" &&
    isValidPhone(phoneNumber) &&
    address.trim() !== "" &&
    squareFootage !== null &&
    squareFootage > 0;

  // Places Autocomplete
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.AutocompleteService | null>(null);
  const [placesService, setPlacesService] =
    useState<google.maps.places.PlacesService | null>(null);
  const [orgPredictions, setOrgPredictions] = useState<
    google.maps.places.AutocompletePrediction[]
  >([]);
  const [loadingOrg, setLoadingOrg] = useState(false);

  const [addressPredictions, setAddressPredictions] = useState<
    google.maps.places.AutocompletePrediction[]
  >([]);
  const [loadingAddress, setLoadingAddress] = useState(false);

  // Load Google Places
  useEffect(() => {
    const loader = new Loader({
      apiKey: "AIzaSyBgxzzgcT_9nyhz1D_JtfG7gevRUKQ5Vbs", // replace with real key
      version: "weekly",
      libraries: ["places"],
    });

    loader
      .load()
      .then(() => {
        const svc = new google.maps.places.AutocompleteService();
        setAutocomplete(svc);
        const div = document.createElement("div");
        const pService = new google.maps.places.PlacesService(div);
        setPlacesService(pService);
      })
      .catch((err) => {
        console.error("Error loading Google Maps script:", err);
        setErrorMessage("Failed to load Google Places API.");
      });
  }, []);

  const handleOrgSearch = useCallback(
    async (input: string) => {
      if (!autocomplete) return;
      if (input.length < 3) {
        setOrgPredictions([]);
        return;
      }
      setLoadingOrg(true);
      try {
        const request: google.maps.places.AutocompletionRequest = {
          input,
          componentRestrictions: { country: "us" },
        };
        const predictions = await new Promise<
          google.maps.places.AutocompletePrediction[]
        >((resolve, reject) => {
          autocomplete.getPlacePredictions(request, (results, status) => {
            if (
              status !== google.maps.places.PlacesServiceStatus.OK ||
              !results
            ) {
              return reject(new Error(`Places API error: ${status}`));
            }
            resolve(results);
          });
        });
        setOrgPredictions(predictions);
      } catch (e) {
        setErrorMessage("Failed to fetch organization suggestions.");
      } finally {
        setLoadingOrg(false);
      }
    },
    [autocomplete],
  );

  const handleAddressSearch = useCallback(
    async (input: string) => {
      if (!autocomplete) return;
      if (input.length < 3) {
        setAddressPredictions([]);
        return;
      }
      setLoadingAddress(true);
      try {
        const request: google.maps.places.AutocompletionRequest = {
          input,
          componentRestrictions: { country: "us" },
          types: ["address"],
        };
        const predictions = await new Promise<
          google.maps.places.AutocompletePrediction[]
        >((resolve, reject) => {
          autocomplete.getPlacePredictions(request, (results, status) => {
            if (
              status !== google.maps.places.PlacesServiceStatus.OK ||
              !results
            ) {
              return reject(new Error(`Places API error: ${status}`));
            }
            resolve(results);
          });
        });
        setAddressPredictions(predictions);
      } catch (e) {
        setErrorMessage("Failed to fetch address suggestions.");
      } finally {
        setLoadingAddress(false);
      }
    },
    [autocomplete],
  );

  useEffect(() => {
    if (companyWebsite) {
      // optional debug
      // console.log("Company website found:", companyWebsite);
    }
  }, [companyWebsite]);

  useEffect(() => {
    if (step === 2) {
      setAddressPredictions([]);
      setShowStep2Errors(false);
    }
  }, [step]);

  useEffect(() => {
    if (initialOrgNameSet.current) {
      initialOrgNameSet.current = false;
      return;
    }
    const t = setTimeout(() => {
      organizationName
        ? handleOrgSearch(organizationName)
        : setOrgPredictions([]);
    }, 300);
    return () => clearTimeout(t);
  }, [organizationName, handleOrgSearch]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (step === 2 && address) handleAddressSearch(address);
    }, 300);
    return () => clearTimeout(t);
  }, [address, step, handleAddressSearch]);

  async function handleNextStep() {
    if (step === 1) {
      if (password.trim().length < 8) {
        setErrorMessage("Your password must be at least 8 characters long.");
        return;
      }
      const auth = getAuth();
      try {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password.trim(),
        );
        const userId = userCredential.user.uid;
        await setDoc(doc(db, "users", userId), {
          uid: userId,
          email: email.trim(),
          organizationName: organizationName.trim(),
          company: organizationName.trim(),
          createdDate: serverTimestamp(),
          planType: "free",
          finishedOnboarding: false,
        });
        setUserCreated(true);
        setStep((p) => p + 1);
      } catch (error: unknown) {
        console.error("Error creating user:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        setErrorMessage("Error creating user: " + msg);
        return;
      }
    } else if (step === 2) {
      if (!step2Valid) {
        setShowStep2Errors(true);
        return;
      }
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setErrorMessage("No user found. Please sign up first.");
        return;
      }
      try {
        await updateDoc(doc(db, "users", user.uid), {
          mappingContactName: contactName.trim(),
          mappingContactPhoneNumber: phoneNumber.trim(),
          address: address.trim(),
          mappingAreaSqFt: squareFootage,
        });
        setStep((p) => p + 1);
      } catch (error: unknown) {
        console.error("Error updating contact info:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        setErrorMessage("Error updating contact info: " + msg);
        return;
      }
    } else if (step === 3) {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setErrorMessage("No user found. Please sign up first.");
        return;
      }
      try {
        await updateDoc(doc(db, "users", user.uid), {
          mappingScheduleDate: scheduleDate,
          mappingScheduleTime: scheduleTime,
        });
        setStep((p) => p + 1);
      } catch (error: unknown) {
        console.error("Error updating mapping schedule:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        setErrorMessage("Error updating mapping schedule: " + msg);
        return;
      }
    } else if (step === 4) {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setErrorMessage("No user found. Please sign up first.");
        return;
      }
      try {
        // Update user with demo info
        await updateDoc(doc(db, "users", user.uid), {
          demoScheduleDate: demoDate,
          demoScheduleTime: demoTime,
        });

        // Booking IDs
        const bookingDate = scheduleDate.toISOString().split("T")[0];
        const bookingId = `${bookingDate}_${scheduleTime}`;
        const blueprintId = crypto.randomUUID();

        // Mapping booking
        await setDoc(doc(db, "bookings", bookingId), {
          id: bookingId,
          date: bookingDate,
          time: scheduleTime,
          userId: user.uid,
          businessName: organizationName.trim(),
          address: address.trim(),
          contactName: contactName.trim(),
          contactPhone: phoneNumber.trim(),
          email: email.trim(),
          status: "pending",
          blueprintId,
          demoScheduleDate: demoDate.toISOString().split("T")[0],
          demoScheduleTime: demoTime,
          createdAt: serverTimestamp(),
        });

        // Blueprint placeholder
        await setDoc(doc(db, "blueprints", blueprintId), {
          id: blueprintId,
          businessName: organizationName.trim(),
          address: address.trim(),
          name: organizationName.trim(),
          host: user.uid,
          locationType: "retail",
          createdDate: serverTimestamp(),
          updatedAt: serverTimestamp(),
          scanCompleted: false,
          status: "Pending",
          email: email.trim(),
          phone: phoneNumber.trim(),
        });

        // Demo booking
        const demoBookingDate = demoDate.toISOString().split("T")[0];
        const demoBookingId = `demo_${demoBookingDate}_${demoTime}`;
        await setDoc(doc(db, "demoBookings", demoBookingId), {
          id: demoBookingId,
          date: demoBookingDate,
          time: demoTime,
          userId: user.uid,
          businessName: organizationName.trim(),
          address: address.trim(),
          contactName: contactName.trim(),
          contactPhone: phoneNumber.trim(),
          email: email.trim(),
          status: "scheduled",
          type: "demo",
          blueprintId,
          mappingDate: bookingDate,
          mappingTime: scheduleTime,
          createdAt: serverTimestamp(),
        });

        // Link blueprint to user
        await updateDoc(doc(db, "users", user.uid), {
          createdBlueprintIDs: arrayUnion(blueprintId),
        });

        // Move to confirmation
        setStep((p) => p + 1);

        // Fire webhook in background
        const chosenDate = scheduleDate.toISOString().split("T")[0];
        const chosenTime = scheduleTime;

        fetch(
          "https://public.lindy.ai/api/v1/webhooks/lindy/43c7b7d7-bc40-4593-acfe-ba79ad6488b8",
          {
            method: "POST",
            headers: {
              Authorization:
                "Bearer 1b1338d68dff4f009bbfaee1166cb9fc48b5fefa6dddbea797264674e2ee0150",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              have_we_onboarded: "No",
              chosen_time_of_mapping: chosenTime,
              chosen_date_of_mapping: chosenDate,
              have_user_chosen_date: "Yes",
              address: address.trim(),
              company_url: companyWebsite.trim() || "",
              company_name: organizationName.trim(),
              contact_name: contactName.trim(),
              contact_email: email.trim(),
              contact_phone_number: phoneNumber.trim(),
              estimated_square_footage: squareFootage,
              blueprint_id: blueprintId,
              chosen_date_of_demo: demoDate.toISOString().split("T")[0],
              chosen_time_of_demo: demoTime,
            }),
          },
        )
          .then(async (resp) => {
            if (!resp.ok) {
              const text = await resp.text();
              console.error("Lindy webhook failed:", text);
            } else {
              const result = await resp.json();
              console.log("Lindy webhook ok:", result);
            }
          })
          .catch((err) => console.error("Lindy webhook error:", err));
      } catch (error: unknown) {
        console.error("Error completing booking setup:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        setErrorMessage("Error completing booking setup: " + msg);
        return;
      }
    }
  }

  function handlePrevStep() {
    if (step === 2 && userCreated) return; // lock step 1 after account creation
    setStep((p) => p - 1);
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      handleNextStep();
    } catch (e) {
      // no-op
    } finally {
      setIsSubmitting(false);
    }
  }

  const step1Valid =
    organizationName.trim() !== "" &&
    isValidEmail(email.trim()) &&
    password.trim().length >= 8;

  function isToday(date: Date) {
    const now = new Date();
    return (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  }

  // ---------------------------------------------------------
  // Step UIs (revamped)
  // ---------------------------------------------------------

  const OrgPredictionList = ({
    items,
  }: {
    items: google.maps.places.AutocompletePrediction[];
  }) => {
    if (!items.length) return null;
    return (
      <div className="absolute z-20 w-full mt-2 rounded-xl border border-white/10 bg-[#0E172A] shadow-xl overflow-hidden">
        {items.map((p) => (
          <button
            key={p.place_id}
            onClick={() => {
              setOrganizationName(p.description);
              setOrgPredictions([]);
              if (placesService) {
                const req: google.maps.places.PlaceDetailsRequest = {
                  placeId: p.place_id,
                  fields: ["website", "formatted_address"],
                };
                placesService.getDetails(req, (place, status) => {
                  if (
                    status === google.maps.places.PlacesServiceStatus.OK &&
                    place
                  ) {
                    setCompanyWebsite(place.website || "");
                    setAddress(place.formatted_address || "");
                  }
                });
              }
            }}
            className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2 text-slate-200">
              <Building2 className="w-4 h-4 text-emerald-300" />
              <span className="text-sm">{p.description}</span>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const AddressPredictionList = ({
    items,
  }: {
    items: google.maps.places.AutocompletePrediction[];
  }) => {
    if (!items.length) return null;
    return (
      <div className="absolute z-20 w-full mt-2 rounded-xl border border-white/10 bg-[#0E172A] shadow-xl overflow-hidden">
        {items.map((p) => (
          <button
            key={p.place_id}
            onClick={() => {
              setAddress(p.description);
              setAddressPredictions([]);
            }}
            className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2 text-slate-200">
              <MapPin className="w-4 h-4 text-cyan-300" />
              <span className="text-sm">{p.description}</span>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const Step1 = (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-white">
          Create your Blueprint account
        </h2>
        <p className="text-slate-300 mt-2">
          Durham/Triangle pilot — invite-only access for local venues. This
          takes ~2 minutes.
        </p>
      </div>

      <div className="grid gap-4">
        <div className="relative">
          <Label className="text-slate-200">Organization / Venue</Label>
          <div className="mt-1 relative">
            <Input
              placeholder="e.g., Brightleaf Books, Durham"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && step1Valid) handleNextStep();
              }}
              className="h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-400"
            />
            <OrgPredictionList items={orgPredictions} />
          </div>
          {loadingOrg && (
            <div className="absolute right-2 top-[46px] text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}
        </div>

        <div>
          <Label className="text-slate-200">Work Email</Label>
          <div className="mt-1 relative">
            <Mail className="absolute left-3 top-3.5 w-5 h-5 text-emerald-300/70" />
            <Input
              type="email"
              placeholder="you@business.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && step1Valid) handleNextStep();
              }}
              className="h-12 pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-400"
            />
          </div>
          {email && !isValidEmail(email) && (
            <p className="text-rose-400 text-xs mt-1">
              Please enter a valid email address.
            </p>
          )}
        </div>

        <div>
          <Label className="text-slate-200">Create Password</Label>
          <div className="mt-1 relative">
            <Lock className="absolute left-3 top-3.5 w-5 h-5 text-emerald-300/70" />
            <Input
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && step1Valid) handleNextStep();
              }}
              className="h-12 pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-400"
            />
          </div>
          {password && password.length < 8 && (
            <p className="text-rose-400 text-xs mt-1">
              Your password must be at least 8 characters long.
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-300" />
          No credit card required. Invite valid for 14 days.
        </div>
        <Button
          onClick={handleNextStep}
          disabled={!step1Valid}
          className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700"
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const Step2 = (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-white">
          Contact & Location
        </h2>
        <p className="text-slate-300 mt-2">
          Who should we meet at your location? We’ll send confirmations and SMS
          reminders.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label className="text-slate-200">Primary Contact</Label>
          <Input
            placeholder="Full name"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && step2Valid) handleNextStep();
            }}
            className={`h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-400 ${
              showStep2Errors && !contactName.trim() ? "border-rose-400" : ""
            }`}
          />
          {showStep2Errors && !contactName.trim() && (
            <p className="text-rose-400 text-xs mt-1">
              Contact name is required.
            </p>
          )}
        </div>

        <div>
          <Label className="text-slate-200">Mobile Number</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-3.5 w-5 h-5 text-cyan-300/70" />
            <Input
              placeholder="(919) 555-0123"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && step2Valid) handleNextStep();
              }}
              className={`h-12 pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-400 ${
                showStep2Errors && !isValidPhone(phoneNumber)
                  ? "border-rose-400"
                  : ""
              }`}
            />
          </div>
          {showStep2Errors && !isValidPhone(phoneNumber) && (
            <p className="text-rose-400 text-xs mt-1">
              Please enter a valid 10-digit phone number.
            </p>
          )}
        </div>

        <div className="md:col-span-2 relative">
          <Label className="text-slate-200">
            Physical Address (mapping location)
          </Label>
          <div className="mt-1 relative">
            <MapPin className="absolute left-3 top-3.5 w-5 h-5 text-cyan-300/70" />
            <Input
              placeholder="Street, City, State"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onFocus={() => setIsAddressFocused(true)}
              onBlur={() => setTimeout(() => setIsAddressFocused(false), 200)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && step2Valid) handleNextStep();
              }}
              className={`h-12 pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-400 ${
                showStep2Errors && !address.trim() ? "border-rose-400" : ""
              }`}
            />
            {isAddressFocused && (
              <AddressPredictionList items={addressPredictions} />
            )}
            {loadingAddress && (
              <div className="absolute right-2 top-[10px] text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            )}
          </div>
          {showStep2Errors && !address.trim() && (
            <p className="text-rose-400 text-xs mt-1">Address is required.</p>
          )}
        </div>

        <div className="md:col-span-2">
          <Label className="text-slate-200">
            Estimated Square Footage to Map
          </Label>
          <div className="mt-1 relative">
            <Ruler className="absolute left-3 top-3.5 w-5 h-5 text-emerald-300/70" />
            <Input
              type="number"
              placeholder="e.g., 1500"
              value={squareFootage || ""} // avoid 0 display
              onChange={(e) => setSquareFootage(Number(e.target.value) || 0)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && step2Valid) handleNextStep();
              }}
              className={`h-12 pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-400 ${
                showStep2Errors &&
                (squareFootage === null || squareFootage <= 0)
                  ? "border-rose-400"
                  : ""
              }`}
            />
          </div>
          {showStep2Errors &&
            (squareFootage === null || squareFootage <= 0) && (
              <p className="text-rose-400 text-xs mt-1">
                Estimated square footage must be greater than zero.
              </p>
            )}
        </div>

        <div className="md:col-span-2">
          <p className="text-xs text-slate-400 leading-relaxed">
            ☑️ By providing your phone number, you consent to receive SMS
            messages from Blueprint about your mapping and demo. Message
            frequency varies; message & data rates may apply. Reply STOP to opt
            out, HELP for help.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        {!userCreated ? (
          <Button
            variant="outline"
            onClick={handlePrevStep}
            className="border-white/20 text-slate-200 hover:bg-white/10"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        ) : (
          <div />
        )}
        <Button
          onClick={handleNextStep}
          disabled={!step2Valid}
          className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700"
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const Step3 = () => {
    const [bookedTimes, setBookedTimes] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const maxDate = useCallback(() => {
      const date = new Date();
      date.setMonth(date.getMonth() + 1);
      return date;
    }, []);

    const formatSlot = (time: string) => {
      const [hh, mm] = time.split(":");
      let h = parseInt(hh, 10);
      const am = h < 12;
      const ampm = am ? "AM" : "PM";
      if (h === 0) h = 12;
      else if (h > 12) h -= 12;
      return `${h}:${mm} ${ampm}`;
    };

    useEffect(() => {
      const fetchBookedTimes = async () => {
        setIsLoading(true);
        try {
          const bookingDate = scheduleDate.toISOString().split("T")[0];
          const bookingsRef = collection(db, "bookings");
          const qy = query(bookingsRef, where("date", "==", bookingDate));
          const snap = await getDocs(qy);
          const times: string[] = [];
          snap.forEach((d) => {
            const data = d.data();
            if (data && data.time) times.push(data.time as string);
          });
          setBookedTimes(times);
        } catch (e) {
          console.error("Error fetching booked times:", e);
          setErrorMessage("Could not load availability. Please try again.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchBookedTimes();
    }, [scheduleDate]);

    const isSlotUnavailable = useCallback(
      (slot: string) => {
        if (bookedTimes.includes(slot)) return true;
        for (const booked of bookedTimes) {
          const [bh, bm] = booked.split(":").map(Number);
          const [sh, sm] = slot.split(":").map(Number);
          const bMin = bh * 60 + bm;
          const sMin = sh * 60 + sm;
          const diff = sMin - bMin;
          if (diff > 0 && diff <= 60) return true;
        }
        return false;
      },
      [bookedTimes],
    );

    const generateTimeSlots = useCallback(() => {
      const slots: string[] = [];
      for (let hour = 8; hour < 20; hour++) {
        slots.push(`${hour.toString().padStart(2, "0")}:00`);
        slots.push(`${hour.toString().padStart(2, "0")}:30`);
      }
      slots.push("20:00");

      if (isToday(scheduleDate)) {
        const now = new Date();
        const curr = now.getHours() * 60 + now.getMinutes();
        return slots.filter((slot) => {
          const [hh, mm] = slot.split(":");
          const sMin = parseInt(hh, 10) * 60 + parseInt(mm, 10);
          const afterOneHour = sMin >= curr + 60;
          return afterOneHour && !isSlotUnavailable(slot);
        });
      }
      return slots.filter((slot) => !isSlotUnavailable(slot));
    }, [scheduleDate, isSlotUnavailable]);

    const slots = generateTimeSlots();

    // Split times into morning/afternoon bins (UX nicety)
    const morning = slots.filter((s) => parseInt(s.split(":")[0]) < 12);
    const afternoon = slots.filter((s) => {
      const h = parseInt(s.split(":")[0]);
      return h >= 12 && h < 17;
    });
    const evening = slots.filter((s) => parseInt(s.split(":")[0]) >= 17);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Schedule 3D Mapping
          </h2>
          <p className="text-slate-300 mt-2">
            Pick a date and time for our specialist to scan your space. Most
            visits take ~30–60 minutes.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Calendar */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center gap-2 text-slate-200">
              <Calendar className="w-5 h-5 text-emerald-300" />
              <Label className="font-medium text-slate-200">Select Date</Label>
            </div>
            <DatePicker
              selected={scheduleDate}
              onChange={(date: Date | null) => date && setScheduleDate(date)}
              inline
              minDate={new Date()}
              maxDate={maxDate()}
              calendarClassName="!bg-transparent !border-0 !shadow-none reactpicker-dark"
              wrapperClassName="!block w-full"
              dayClassName={(date) => {
                const base =
                  "rounded-md !w-9 !h-9 flex items-center justify-center";
                const isSel =
                  date.toDateString() === scheduleDate.toDateString();
                return isSel
                  ? `${base} !bg-gradient-to-r from-emerald-500 to-cyan-600 !text-white`
                  : `${base} hover:!bg-white/10 !text-slate-200`;
              }}
            />
          </div>

          {/* Time slots */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-1">
              <Label className="font-medium text-slate-200">Select Time</Label>
              <p className="text-xs text-slate-400 mt-1">
                Times in Eastern Time (ET)
              </p>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-300" />
              </div>
            ) : slots.length ? (
              <div className="space-y-4">
                {morning.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Morning</p>
                    <div className="flex flex-wrap gap-2">
                      {morning.map((s) => (
                        <button
                          key={s}
                          onClick={() => setScheduleTime(s)}
                          className={`px-3 py-2 rounded-md text-sm transition-all border ${
                            scheduleTime === s
                              ? "bg-gradient-to-r from-emerald-500 to-cyan-600 text-white border-transparent"
                              : "bg-white/5 hover:bg-white/10 text-slate-200 border-white/10"
                          }`}
                        >
                          {formatSlot(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {afternoon.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Afternoon</p>
                    <div className="flex flex-wrap gap-2">
                      {afternoon.map((s) => (
                        <button
                          key={s}
                          onClick={() => setScheduleTime(s)}
                          className={`px-3 py-2 rounded-md text-sm transition-all border ${
                            scheduleTime === s
                              ? "bg-gradient-to-r from-emerald-500 to-cyan-600 text-white border-transparent"
                              : "bg-white/5 hover:bg-white/10 text-slate-200 border-white/10"
                          }`}
                        >
                          {formatSlot(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {evening.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Evening</p>
                    <div className="flex flex-wrap gap-2">
                      {evening.map((s) => (
                        <button
                          key={s}
                          onClick={() => setScheduleTime(s)}
                          className={`px-3 py-2 rounded-md text-sm transition-all border ${
                            scheduleTime === s
                              ? "bg-gradient-to-r from-emerald-500 to-cyan-600 text-white border-transparent"
                              : "bg-white/5 hover:bg-white/10 text-slate-200 border-white/10"
                          }`}
                        >
                          {formatSlot(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-amber-300/90 text-sm p-4 bg-amber-500/10 border border-amber-500/20 rounded-md">
                No available times for this date. Please pick another date.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={handlePrevStep}
            className="border-white/20 text-slate-200 hover:bg-white/10"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <Button
            onClick={handleNextStep}
            disabled={!scheduleTime || isLoading}
            className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  };

  const Step4 = () => {
    const [demoBookedTimes, setDemoBookedTimes] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const minDemoDate = useCallback(() => {
      const date = new Date(scheduleDate);
      date.setDate(date.getDate() + 8); // must be >= 8 days after mapping
      return date;
    }, [scheduleDate]);

    const maxDemoDate = useCallback(() => {
      const date = new Date(scheduleDate);
      date.setDate(date.getDate() + 14); // <= 14 days after mapping
      return date;
    }, [scheduleDate]);

    const formatSlot = (time: string) => {
      const [hh, mm] = time.split(":");
      let h = parseInt(hh, 10);
      const am = h < 12;
      const ampm = am ? "AM" : "PM";
      if (h === 0) h = 12;
      else if (h > 12) h -= 12;
      return `${h}:${mm} ${ampm}`;
    };

    useEffect(() => {
      const fetchDemoTimes = async () => {
        setIsLoading(true);
        try {
          const bookingDate = demoDate.toISOString().split("T")[0];
          const ref = collection(db, "demoBookings");
          const qy = query(ref, where("date", "==", bookingDate));
          const snap = await getDocs(qy);
          const times: string[] = [];
          snap.forEach((d) => {
            const data = d.data();
            if (data && data.time) times.push(data.time as string);
          });
          setDemoBookedTimes(times);
        } catch (e) {
          console.error("Error fetching demo booked times:", e);
          setErrorMessage(
            "Could not load demo availability. Please try again.",
          );
        } finally {
          setIsLoading(false);
        }
      };
      fetchDemoTimes();
    }, [demoDate]);

    const isDemoSlotUnavailable = useCallback(
      (slot: string) => demoBookedTimes.includes(slot),
      [demoBookedTimes],
    );

    const generateDemoTimeSlots = useCallback(() => {
      const slots: string[] = [];
      for (let hour = 9; hour < 18; hour++) {
        slots.push(`${hour.toString().padStart(2, "0")}:00`);
        slots.push(`${hour.toString().padStart(2, "0")}:30`);
      }
      slots.push("18:00");
      return slots.filter((s) => !isDemoSlotUnavailable(s));
    }, [isDemoSlotUnavailable]);

    const slots = generateDemoTimeSlots();
    const morning = slots.filter((s) => parseInt(s.split(":")[0]) < 12);
    const afternoon = slots.filter((s) => {
      const h = parseInt(s.split(":")[0]);
      return h >= 12 && h < 17;
    });
    const evening = slots.filter((s) => parseInt(s.split(":")[0]) >= 17);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Schedule Demo Day
          </h2>
          <p className="text-slate-300 mt-2">
            Choose when we should present your completed Blueprint and AR
            experience to your team.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Calendar */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center gap-2 text-slate-200">
              <Calendar className="w-5 h-5 text-cyan-300" />
              <Label className="font-medium text-slate-200">
                Select Demo Date
              </Label>
            </div>
            <DatePicker
              selected={demoDate}
              onChange={(d: Date | null) => d && setDemoDate(d)}
              inline
              minDate={minDemoDate()}
              maxDate={maxDemoDate()}
              calendarClassName="!bg-transparent !border-0 !shadow-none reactpicker-dark"
              wrapperClassName="!block w-full"
              dayClassName={(date) => {
                const base =
                  "rounded-md !w-9 !h-9 flex items-center justify-center";
                const isSel = date.toDateString() === demoDate.toDateString();
                return isSel
                  ? `${base} !bg-gradient-to-r from-emerald-500 to-cyan-600 !text-white`
                  : `${base} hover:!bg-white/10 !text-slate-200`;
              }}
            />
          </div>

          {/* Time slots */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-1">
              <Label className="font-medium text-slate-200">
                Select Demo Time
              </Label>
              <p className="text-xs text-slate-400 mt-1">
                Times in Eastern Time (ET)
              </p>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-300" />
              </div>
            ) : slots.length ? (
              <div className="space-y-4">
                {morning.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Morning</p>
                    <div className="flex flex-wrap gap-2">
                      {morning.map((s) => (
                        <button
                          key={s}
                          onClick={() => setDemoTime(s)}
                          className={`px-3 py-2 rounded-md text-sm transition-all border ${
                            demoTime === s
                              ? "bg-gradient-to-r from-emerald-500 to-cyan-600 text-white border-transparent"
                              : "bg-white/5 hover:bg-white/10 text-slate-200 border-white/10"
                          }`}
                        >
                          {formatSlot(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {afternoon.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Afternoon</p>
                    <div className="flex flex-wrap gap-2">
                      {afternoon.map((s) => (
                        <button
                          key={s}
                          onClick={() => setDemoTime(s)}
                          className={`px-3 py-2 rounded-md text-sm transition-all border ${
                            demoTime === s
                              ? "bg-gradient-to-r from-emerald-500 to-cyan-600 text-white border-transparent"
                              : "bg-white/5 hover:bg-white/10 text-slate-200 border-white/10"
                          }`}
                        >
                          {formatSlot(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {evening.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Evening</p>
                    <div className="flex flex-wrap gap-2">
                      {evening.map((s) => (
                        <button
                          key={s}
                          onClick={() => setDemoTime(s)}
                          className={`px-3 py-2 rounded-md text-sm transition-all border ${
                            demoTime === s
                              ? "bg-gradient-to-r from-emerald-500 to-cyan-600 text-white border-transparent"
                              : "bg-white/5 hover:bg-white/10 text-slate-200 border-white/10"
                          }`}
                        >
                          {formatSlot(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-amber-300/90 text-sm p-4 bg-amber-500/10 border border-amber-500/20 rounded-md">
                No available demo times for this date. Please pick another date.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={handlePrevStep}
            className="border-white/20 text-slate-200 hover:bg-white/10"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <Button
            onClick={handleNextStep}
            disabled={!demoTime || isLoading}
            className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700"
          >
            Complete Setup
            <CheckCircle2 className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  };

  function Confirmation() {
    return (
      <div className="flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-xl">
          <CheckCircle2 className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white">You’re all set!</h2>
        <p className="text-slate-300 max-w-md">
          We’ve scheduled your mapping and demo. You’ll get an email + SMS
          reminder before each visit.
        </p>
        <p className="text-xs text-slate-400">
          Thanks for choosing Blueprint — we can’t wait to bring your space to
          life.
        </p>
        <Button
          className="mt-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700"
          onClick={() => {
            localStorage.removeItem("scanCompleted");
            localStorage.setItem("showWaitingDashboard", "true");
            window.location.href = "/dashboard";
          }}
        >
          Go to Dashboard
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------
  // Layout: stepper, left rail, summary
  // ---------------------------------------------------------
  const stepsMeta = [
    { id: 1, label: "Account" },
    { id: 2, label: "Contact & Location" },
    { id: 3, label: "Mapping" },
    { id: 4, label: "Demo Day" },
  ];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#0B1220] text-slate-100">
      {/* Ambient brand glows */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-32 -right-24 h-[45rem] w-[45rem] rounded-full blur-3xl opacity-40 bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-sky-500/10" />
        <div className="absolute -bottom-32 -left-24 h-[40rem] w-[40rem] rounded-full blur-3xl opacity-30 bg-gradient-to-tr from-cyan-500/10 via-emerald-500/10 to-amber-400/10" />
      </div>
      <div className="fixed inset-0 -z-10 opacity-[0.06] bg-[url('/images/grid-pattern.svg')] bg-repeat" />

      {errorMessage && (
        <div className="fixed top-24 right-5 z-[9999] bg-rose-600 text-white px-4 py-3 rounded-xl shadow-2xl border border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-sm">{errorMessage}</span>
            <button
              className="ml-2 text-white/80 hover:text-white"
              onClick={() => setErrorMessage("")}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <Nav hideAuthenticatedFeatures />

      <main className="flex-1">
        {/* Hero-ish header */}
        <section className="pt-20 md:pt-28 pb-6">
          <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
            <div className="flex items-start justify-between gap-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 mb-3">
                  <MapPin className="w-4 h-4" />
                  Durham & Triangle — Pilot Access
                </div>
                <h1 className="text-3xl md:text-4xl font-black leading-tight text-white">
                  Join the Blueprint Pilot
                </h1>
                <p className="text-slate-300 mt-2 max-w-2xl">
                  For decision-makers at local venues (retail, museums,
                  restaurants, showrooms). Set up your account, add location
                  details, and book your mapping + demo in just a few minutes.
                </p>
              </div>
              <div className="hidden md:flex items-center gap-3 text-slate-300">
                <Shield className="w-5 h-5 text-emerald-300" />
                <span className="text-sm">No credit card • Cancel anytime</span>
              </div>
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="pb-16">
          <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Rail — persuasion + trust */}
              <aside className="lg:col-span-1">
                <div className="sticky top-28 space-y-6">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-emerald-300" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-300">Why join</p>
                        <h3 className="text-lg font-bold text-white">
                          AR that drives results
                        </h3>
                      </div>
                    </div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-300 mt-0.5" />
                        <span>
                          Delight visitors with interactive product & exhibit
                          moments
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-300 mt-0.5" />
                        <span>No app downloads—instant access via QR</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-300 mt-0.5" />
                        <span>
                          Full support; we handle mapping, content & analytics
                        </span>
                      </li>
                    </ul>
                    <div className="mt-4 text-xs text-slate-400">
                      Serving businesses within ~30 minutes of Durham, NC.
                    </div>
                  </div>

                  {/* Live summary */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-cyan-300" />
                      <h3 className="text-sm font-semibold text-white">
                        Your Summary
                      </h3>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start gap-2">
                        <Building2 className="w-4 h-4 text-emerald-300 mt-0.5" />
                        <div>
                          <p className="text-slate-400">Organization</p>
                          <p className="text-white">
                            {organizationName || "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Mail className="w-4 h-4 text-emerald-300 mt-0.5" />
                        <div>
                          <p className="text-slate-400">Email</p>
                          <p className="text-white break-all">{email || "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Phone className="w-4 h-4 text-emerald-300 mt-0.5" />
                        <div>
                          <p className="text-slate-400">Contact</p>
                          <p className="text-white">
                            {contactName || "—"}{" "}
                            {phoneNumber ? `• ${phoneNumber}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-emerald-300 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-slate-400">Address</p>
                          <p className="text-white break-words">
                            {address || "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Ruler className="w-4 h-4 text-emerald-300 mt-0.5" />
                        <div>
                          <p className="text-slate-400">Sq Ft</p>
                          <p className="text-white">{squareFootage || "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Calendar className="w-4 h-4 text-emerald-300 mt-0.5" />
                        <div>
                          <p className="text-slate-400">Mapping</p>
                          <p className="text-white">
                            {scheduleDate
                              ? scheduleDate.toLocaleDateString()
                              : "—"}{" "}
                            • {scheduleTime || "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Calendar className="w-4 h-4 text-emerald-300 mt-0.5" />
                        <div>
                          <p className="text-slate-400">Demo Day</p>
                          <p className="text-white">
                            {demoDate ? demoDate.toLocaleDateString() : "—"} •{" "}
                            {demoTime || "—"}
                          </p>
                        </div>
                      </div>
                      {companyWebsite && (
                        <div className="flex items-start gap-2">
                          <Globe className="w-4 h-4 text-emerald-300 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-slate-400">Website</p>
                            <p className="text-white break-all">
                              {companyWebsite}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </aside>

              {/* Main card */}
              <div className="lg:col-span-2">
                {/* Stepper */}
                <div className="mb-6">
                  <div className="flex items-center gap-2">
                    {stepsMeta.map((s, i) => (
                      <React.Fragment key={s.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                              step === s.id
                                ? "bg-gradient-to-r from-emerald-500 to-cyan-600 text-white border-transparent"
                                : step > s.id
                                  ? "bg-white text-slate-900 border-white"
                                  : "bg-white/5 text-slate-300 border-white/10"
                            }`}
                          >
                            {s.id}
                          </div>
                          <span
                            className={`hidden sm:inline text-sm ${
                              step >= s.id ? "text-white" : "text-slate-400"
                            }`}
                          >
                            {s.label}
                          </span>
                        </div>
                        {i < stepsMeta.length - 1 && (
                          <div
                            className={`flex-1 h-[2px] rounded-full ${
                              step > s.id
                                ? "bg-gradient-to-r from-emerald-500 to-cyan-600"
                                : "bg-white/10"
                            }`}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Card */}
                <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
                  <div className="p-5 sm:p-7">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={step}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.25 }}
                      >
                        {step === 1 && Step1}
                        {step === 2 && Step2}
                        {step === 3 && <Step3 />}
                        {step === 4 && <Step4 />}
                        {step === 5 && <Confirmation />}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                {/* Mobile summary (collapsible) */}
                <details className="lg:hidden mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
                  <summary className="cursor-pointer text-sm text-slate-200">
                    Your Summary
                  </summary>
                  <div className="mt-3 text-sm text-slate-200 space-y-2">
                    <div>
                      Organization:{" "}
                      <span className="text-white">
                        {organizationName || "—"}
                      </span>
                    </div>
                    <div>
                      Email:{" "}
                      <span className="text-white break-all">
                        {email || "—"}
                      </span>
                    </div>
                    <div>
                      Contact:{" "}
                      <span className="text-white">
                        {contactName || "—"}{" "}
                        {phoneNumber ? `• ${phoneNumber}` : ""}
                      </span>
                    </div>
                    <div>
                      Address:{" "}
                      <span className="text-white break-words">
                        {address || "—"}
                      </span>
                    </div>
                    <div>
                      Sq Ft:{" "}
                      <span className="text-white">{squareFootage || "—"}</span>
                    </div>
                    <div>
                      Mapping:{" "}
                      <span className="text-white">
                        {scheduleDate?.toLocaleDateString() || "—"} •{" "}
                        {scheduleTime || "—"}
                      </span>
                    </div>
                    <div>
                      Demo Day:{" "}
                      <span className="text-white">
                        {demoDate?.toLocaleDateString() || "—"} •{" "}
                        {demoTime || "—"}
                      </span>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

// // This file defines the OutboundSignUpFlow component, a multi-step form for users
// // who are invited off the waitlist to sign up for the Blueprint service.
// // It handles token validation, account creation, contact and location information input,
// // and scheduling for a 3D mapping session.
// // It integrates with Firebase for authentication and data storage,
// // and Google Maps Places API for address and organization name autocomplete.

// "use client";
// import { Loader } from "@googlemaps/js-api-loader";
// import React, { useState, useRef, useCallback, useEffect } from "react";
// import { motion, AnimatePresence } from "framer-motion";
// import Nav from "@/components/Nav";
// import Footer from "@/components/Footer";
// import { Button } from "@/components/ui/button";
// import DatePicker from "react-datepicker";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Calendar } from "lucide-react";
// import "react-datepicker/dist/react-datepicker.css";
// import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
// import {
//   doc,
//   setDoc,
//   updateDoc,
//   serverTimestamp,
//   collection,
//   query,
//   where,
//   getDocs,
//   arrayUnion,
// } from "firebase/firestore";
// import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
// import { db } from "@/lib/firebase";
// /**
//  * OutboundSignUpFlow
//  * - Step 1: Basic Account Setup (Organization Name, Email, Password)
//  * - Step 2: Contact & Location (Contact Name, Phone, Address)
//  * - Step 3: 3D Mapping Scheduling (Date, Time)
//  * - Step 4: Demo Day Scheduling (Date, Time)
//  * - Final: Confirmation Screen
//  */

// /**
//  * The OutboundSignUpFlow component guides users invited from the waitlist through a multi-step signup process.
//  * This includes account creation, providing contact and location details, and scheduling a 3D mapping session.
//  *
//  * @returns {JSX.Element} The rendered OutboundSignUpFlow component.
//  */
// export default function OutboundSignUpFlow() {
//   const [showStep2Errors, setShowStep2Errors] = useState(false);
//   const [isAddressFocused, setIsAddressFocused] = useState(false);
//   const [userCreated, setUserCreated] = useState(false);

//   // ------------------------------
//   // STEP STATE
//   // ------------------------------
//   const [step, setStep] = useState(1);

//   // ------------------------------
//   // FORM FIELDS
//   // ------------------------------
//   // Step 1
//   const [organizationName, setOrganizationName] = useState("");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");

//   // Step 2
//   const [contactName, setContactName] = useState("");
//   const [phoneNumber, setPhoneNumber] = useState("");
//   const [address, setAddress] = useState("");
//   const [squareFootage, setSquareFootage] = useState<number | null>(null);

//   // Step 3
//   const [scheduleDate, setScheduleDate] = useState(new Date());
//   const [scheduleTime, setScheduleTime] = useState("08:00");

//   const [demoDate, setDemoDate] = useState(() => {
//     const date = new Date();
//     date.setDate(date.getDate() + 7); // Default to 1 week from today
//     return date;
//   });
//   const [demoTime, setDemoTime] = useState("11:00"); // Default to 11:00 AM

//   const [errorMessage, setErrorMessage] = useState("");

//   /**
//    * Validates an email address using a basic regular expression.
//    * @param {string} email - The email address to validate.
//    * @returns {boolean} True if the email is valid, false otherwise.
//    */
//   function isValidEmail(email: string) {
//     // A basic regex for email validation
//     const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     return pattern.test(email);
//   }

//   /**
//    * Validates a phone number by checking if it contains 10 digits after removing non-digit characters.
//    * @param {string} phone - The phone number to validate.
//    * @returns {boolean} True if the phone number is valid, false otherwise.
//    */
//   function isValidPhone(phone: string) {
//     const digits = phone.replace(/\D/g, "");
//     return digits.length === 10;
//   }

//   const initialOrgNameSet = useRef(false);
//   const [isFetchingAddress, setIsFetchingAddress] = useState(false);

//   const step2Valid =
//     contactName.trim() !== "" &&
//     isValidPhone(phoneNumber) &&
//     address.trim() !== "" &&
//     squareFootage !== null &&
//     squareFootage > 0;

//   // ------------------------------
//   // STEP HANDLERS
//   // ------------------------------
//   /**
//    * Handles the logic for advancing to the next step in the sign-up flow.
//    * This includes form validation for the current step and data submission to Firebase.
//    * @async
//    */
//   async function handleNextStep() {
//     if (step === 1) {
//       // Enforce password length before hitting Firebase
//       if (password.trim().length < 8) {
//         setErrorMessage("Your password must be at least 8 characters long.");
//         return;
//       }

//       const auth = getAuth();
//       try {
//         const userCredential = await createUserWithEmailAndPassword(
//           auth,
//           email.trim(),
//           password.trim(),
//         );

//         // Create a user document in Firestore with initial fields
//         const userId = userCredential.user.uid;
//         await setDoc(doc(db, "users", userId), {
//           uid: userId,
//           email: email.trim(),
//           organizationName: organizationName.trim(),
//           company: organizationName.trim(),
//           createdDate: serverTimestamp(),
//           planType: "free",
//           finishedOnboarding: false,
//         });

//         // ✅ SET THE FLAG THAT USER HAS BEEN CREATED
//         setUserCreated(true);

//         // ✅ Move to next step after successful user creation
//         setStep((prev) => prev + 1);
//       } catch (error: unknown) {
//         console.error("Error creating user:", error);
//         const errorMessage =
//           error instanceof Error ? error.message : "Unknown error";
//         setErrorMessage("Error creating user: " + errorMessage);
//         return; // Stop here if there's an error
//       }
//     } else if (step === 2) {
//       if (!step2Valid) {
//         setShowStep2Errors(true);
//         return;
//       }
//       // 1) Get the current user
//       const auth = getAuth();
//       const user = auth.currentUser;
//       if (!user) {
//         setErrorMessage("No user found. Please sign up first.");
//         return;
//       }

//       // 2) Update user doc with contact & location info
//       try {
//         await updateDoc(doc(db, "users", user.uid), {
//           mappingContactName: contactName.trim(),
//           mappingContactPhoneNumber: phoneNumber.trim(),
//           address: address.trim(),
//           mappingAreaSqFt: squareFootage,
//         });

//         // ✅ ADD THIS LINE - Move to next step after successful update
//         setStep((prev) => prev + 1);
//       } catch (error: unknown) {
//         console.error("Error updating contact info:", error);
//         const errorMessage =
//           error instanceof Error ? error.message : "Unknown error";
//         setErrorMessage("Error updating contact info: " + errorMessage);
//         return; // Stop here if there's an error
//       }
//     } else if (step === 3) {
//       // 1) Get the current user
//       const auth = getAuth();
//       const user = auth.currentUser;
//       if (!user) {
//         setErrorMessage("No user found. Please sign up first.");
//         return;
//       }

//       // 2) Update user doc with mapping scheduling info only
//       try {
//         await updateDoc(doc(db, "users", user.uid), {
//           mappingScheduleDate: scheduleDate,
//           mappingScheduleTime: scheduleTime,
//         });

//         // Move to step 4 (demo scheduling)
//         setStep((prev) => prev + 1);
//       } catch (error: unknown) {
//         console.error("Error updating mapping schedule:", error);
//         const errorMessage =
//           error instanceof Error ? error.message : "Unknown error";
//         setErrorMessage("Error updating mapping schedule: " + errorMessage);
//         return;
//       }
//     } else if (step === 4) {
//       // Handle Step 4: Demo Day Scheduling + Complete Booking Creation
//       const auth = getAuth();
//       const user = auth.currentUser;
//       if (!user) {
//         setErrorMessage("No user found. Please sign up first.");
//         return;
//       }

//       try {
//         // 1) Update user doc with demo scheduling info
//         await updateDoc(doc(db, "users", user.uid), {
//           demoScheduleDate: demoDate,
//           demoScheduleTime: demoTime,
//         });

//         // 2) Create all booking records and blueprint
//         const bookingDate = scheduleDate.toISOString().split("T")[0]; // Format: YYYY-MM-DD
//         const bookingId = `${bookingDate}_${scheduleTime}`;

//         // Create a unique blueprintId that will be used later when uploading files
//         const blueprintId = crypto.randomUUID();

//         // Create a comprehensive booking record (including demo info)
//         await setDoc(doc(db, "bookings", bookingId), {
//           id: bookingId,
//           date: bookingDate,
//           time: scheduleTime,
//           userId: user.uid,
//           businessName: organizationName.trim(),
//           address: address.trim(),
//           contactName: contactName.trim(),
//           contactPhone: phoneNumber.trim(),
//           email: email.trim(),
//           status: "pending",
//           blueprintId: blueprintId, // Add the blueprint ID for reference
//           // NEW: Add demo scheduling info to the booking
//           demoScheduleDate: demoDate.toISOString().split("T")[0],
//           demoScheduleTime: demoTime,
//           createdAt: serverTimestamp(),
//         });

//         // Create a placeholder blueprint document that will be updated later with scan files
//         await setDoc(doc(db, "blueprints", blueprintId), {
//           id: blueprintId,
//           businessName: organizationName.trim(),
//           address: address.trim(),
//           name: organizationName.trim(), // Add name field that matches businessName for backward compatibility
//           host: user.uid,
//           locationType: "retail", // Default type, can be updated later
//           createdDate: serverTimestamp(),
//           updatedAt: serverTimestamp(),
//           scanCompleted: false,
//           status: "Pending", // Explicitly set status
//           email: email.trim(),
//           phone: phoneNumber.trim(),
//         });

//         // Create a separate demo booking record
//         const demoBookingDate = demoDate.toISOString().split("T")[0];
//         const demoBookingId = `demo_${demoBookingDate}_${demoTime}`;

//         await setDoc(doc(db, "demoBookings", demoBookingId), {
//           id: demoBookingId,
//           date: demoBookingDate,
//           time: demoTime,
//           userId: user.uid,
//           businessName: organizationName.trim(),
//           address: address.trim(),
//           contactName: contactName.trim(),
//           contactPhone: phoneNumber.trim(),
//           email: email.trim(),
//           status: "scheduled",
//           type: "demo",
//           blueprintId: blueprintId, // Link to the main blueprint
//           mappingDate: bookingDate, // Reference to the mapping date
//           mappingTime: scheduleTime, // Reference to the mapping time
//           createdAt: serverTimestamp(),
//         });

//         // Update the user document to include this blueprintId in their createdBlueprintIDs array
//         await updateDoc(doc(db, "users", user.uid), {
//           createdBlueprintIDs: arrayUnion(blueprintId),
//         });

//         // 🎉 SHOW SUCCESS IMMEDIATELY - Move to confirmation step
//         setStep((prev) => prev + 1);

//         // 🔥 FIRE MCP CALL IN BACKGROUND (don't await)
//         const chosenDate = scheduleDate.toISOString().split("T")[0];
//         const chosenTime = scheduleTime;
//         const cName = organizationName.trim();
//         const cUrl = companyWebsite.trim();
//         const cAddress = address.trim();
//         const personName = contactName.trim();
//         const contactPhone = phoneNumber.trim();

//         // fetch("/api/mapping-confirmation", {
//         //   method: "POST",
//         //   headers: {
//         //     "Content-Type": "application/json",
//         //   },
//         //   body: JSON.stringify({
//         //     have_we_onboarded: "No",
//         //     chosen_time_of_mapping: chosenTime,
//         //     chosen_date_of_mapping: chosenDate,
//         //     have_user_chosen_date: "Yes",
//         //     address: cAddress,
//         //     company_url: cUrl || "",
//         //     company_name: cName,
//         //     contact_name: personName,
//         //     contact_phone_number: contactPhone,
//         //     estimated_square_footage: squareFootage,
//         //     blueprint_id: blueprintId,
//         //     // NEW: Add demo scheduling info to MCP call
//         //     chosen_date_of_demo: demoDate.toISOString().split("T")[0],
//         //     chosen_time_of_demo: demoTime,
//         //   }),
//         // })
//         //   .then(async (mcpResponse) => {
//         //     if (!mcpResponse.ok) {
//         //       const errorText = await mcpResponse.text();
//         //       console.error("Background MCP process failed:", errorText);
//         //       // Optionally update booking status to indicate processing failed
//         //       return;
//         //     }
//         //     const result = await mcpResponse.json();
//         //     console.log(
//         //       "Background MCP mapping confirmation completed:",
//         //       result,
//         //     );
//         //     // Optionally update booking status to indicate processing completed
//         //   })
//         //   .catch((error) => {
//         //     console.error("Background MCP process error:", error);
//         //     // Optionally update booking status to indicate processing failed
//         //   });
//         fetch(
//           "https://public.lindy.ai/api/v1/webhooks/lindy/43c7b7d7-bc40-4593-acfe-ba79ad6488b8",
//           {
//             method: "POST",
//             headers: {
//               Authorization:
//                 "Bearer 1b1338d68dff4f009bbfaee1166cb9fc48b5fefa6dddbea797264674e2ee0150",
//               "Content-Type": "application/json",
//             },
//             body: JSON.stringify({
//               have_we_onboarded: "No",
//               chosen_time_of_mapping: chosenTime,
//               chosen_date_of_mapping: chosenDate,
//               have_user_chosen_date: "Yes",
//               address: cAddress,
//               company_url: cUrl || "",
//               company_name: cName,
//               contact_name: personName,
//               contact_email: email.trim(), // ADD THIS LINE
//               contact_phone_number: contactPhone,
//               estimated_square_footage: squareFootage,
//               blueprint_id: blueprintId,
//               // Demo scheduling info for Lindy workflow
//               chosen_date_of_demo: demoDate.toISOString().split("T")[0],
//               chosen_time_of_demo: demoTime,
//             }),
//           },
//         )
//           .then(async (lindyResponse) => {
//             if (!lindyResponse.ok) {
//               const errorText = await lindyResponse.text();
//               console.error("Background Lindy webhook failed:", errorText);
//               // Optionally update booking status to indicate processing failed
//               return;
//             }
//             const result = await lindyResponse.json();
//             console.log(
//               "Background Lindy mapping confirmation completed:",
//               result,
//             );
//             // Optionally update booking status to indicate processing completed
//           })
//           .catch((error) => {
//             console.error("Background Lindy webhook error:", error);
//             // Optionally update booking status to indicate processing failed
//           });
//       } catch (error: unknown) {
//         console.error("Error completing booking setup:", error);
//         const errorMessage =
//           error instanceof Error ? error.message : "Unknown error";
//         setErrorMessage("Error completing booking setup: " + errorMessage);
//         return;
//       }
//     }
//   }

//   //       const options = {
//   //         method: "POST",
//   //         headers: {
//   //           Authorization: "Bearer c4dc7fe399094cd3819c96e51dded30c",
//   //           "Content-Type": "application/json",
//   //         },
//   //         body: JSON.stringify({
//   //           user_id: "Hs4h5E9hjnVCNcbF4ns2puDi3oR2",
//   //           saved_item_id: "6u9qqqaskkFoxxsLz1tWX9",
//   //           pipeline_inputs: [
//   //             { input_name: "have_we_onboarded", value: "No" },
//   //             { input_name: "chosen_time_of_mapping", value: chosenTime },
//   //             { input_name: "chosen_date_of_mapping", value: chosenDate },
//   //             { input_name: "have_user_chosen_date", value: "Yes" },
//   //             { input_name: "address", value: cAddress },
//   //             { input_name: "company_url", value: cUrl },
//   //             { input_name: "company_name", value: cName },
//   //             { input_name: "contact_name", value: personName },
//   //             { input_name: "contact_phone_number", value: contactPhone },
//   //           ],
//   //         }),
//   //       };

//   //       fetch("https://api.gumloop.com/api/v1/start_pipeline", options)
//   //         .then((res) => res.json())
//   //         .then((data) => console.log("Gumloop response:", data))
//   //         .catch((err) => console.error("Gumloop error:", err));
//   //     } catch (error) {
//   //       console.error("Error updating scheduling info:", error);
//   //       setErrorMessage("Error updating scheduling info: " + error.message);
//   //       return; // Stop here if there's an error
//   //     }
//   //   }

//   //   // Finally, advance to the next step if everything succeeded
//   //   setStep((prev) => prev + 1);
//   // }

//   /**
//    * Handles moving to the previous step in the sign-up flow.
//    * Prevents going back to Step 1 once a user has been created.
//    */
//   function handlePrevStep() {
//     // Don't allow going back to Step 1 if user has already been created
//     if (step === 2 && userCreated) {
//       return; // Do nothing - user cannot go back to Step 1
//     }

//     setStep((prev) => prev - 1);
//   }

//   const [isSubmitting, setIsSubmitting] = useState(false);

//   // ------------------------------
//   // GOOGLE PLACES AUTOCOMPLETE STATE
//   // ------------------------------
//   const [companyWebsite, setCompanyWebsite] = useState("");
//   const [autocomplete, setAutocomplete] =
//     useState<google.maps.places.AutocompleteService | null>(null);
//   const [placesService, setPlacesService] =
//     useState<google.maps.places.PlacesService | null>(null);
//   const [orgPredictions, setOrgPredictions] = useState<
//     google.maps.places.AutocompletePrediction[]
//   >([]);
//   const [loadingOrg, setLoadingOrg] = useState(false);

//   /**
//    * Fetches organization name predictions from Google Places API based on user input.
//    * @param {string} input - The user's input for the organization name.
//    * @async
//    */
//   // ADD THIS BELOW:
//   const [addressPredictions, setAddressPredictions] = useState<
//     google.maps.places.AutocompletePrediction[]
//   >([]);
//   const [loadingAddress, setLoadingAddress] = useState(false);

//   // Load Google Places API once
//   useEffect(() => {
//     const loader = new Loader({
//       apiKey: "AIzaSyBgxzzgcT_9nyhz1D_JtfG7gevRUKQ5Vbs", // Replace with your real API key
//       version: "weekly",
//       libraries: ["places"],
//     });

//     loader
//       .load()
//       .then(() => {
//         // Create an AutocompleteService
//         const autocompleteService =
//           new google.maps.places.AutocompleteService();
//         setAutocomplete(autocompleteService);

//         // Also create a PlacesService for optional place details
//         const div = document.createElement("div");
//         const pService = new google.maps.places.PlacesService(div);
//         setPlacesService(pService);
//       })
//       .catch((err) => {
//         console.error("Error loading Google Maps script:", err);
//         setErrorMessage("Failed to load Google Places API.");
//       });
//   }, []);

//   const handleOrgSearch = useCallback(
//     async (input: string) => {
//       if (!autocomplete) {
//         setErrorMessage("Places service not initialized");
//         return;
//       }
//       if (input.length < 3) {
//         setOrgPredictions([]);
//         return;
//       }

//       setLoadingOrg(true);
//       try {
//         const request: google.maps.places.AutocompletionRequest = {
//           input,
//           componentRestrictions: { country: "us" },
//         };

//         const predictions = await new Promise<
//           google.maps.places.AutocompletePrediction[]
//         >((resolve, reject) => {
//           autocomplete.getPlacePredictions(request, (results, status) => {
//             if (
//               status !== google.maps.places.PlacesServiceStatus.OK ||
//               !results
//             ) {
//               return reject(new Error(`Places API error: ${status}`));
//             }
//             resolve(results);
//           });
//         });

//         setOrgPredictions(predictions);
//       } catch (err) {
//         console.error("Error fetching org predictions:", err);
//         setErrorMessage("Failed to fetch organization suggestions.");
//       } finally {
//         setLoadingOrg(false);
//       }
//     },
//     [autocomplete],
//   );

//   /**
//    * Fetches address predictions from Google Places API based on user input.
//    * @param {string} input - The user's input for the address.
//    * @async
//    */
//   const handleAddressSearch = useCallback(
//     async (input: string) => {
//       if (!autocomplete) return;
//       if (input.length < 3) {
//         setAddressPredictions([]);
//         return;
//       }

//       setLoadingAddress(true);
//       try {
//         const request: google.maps.places.AutocompletionRequest = {
//           input,
//           componentRestrictions: { country: "us" },
//           types: ["address"], // IMPORTANT: Restrict to addresses
//         };

//         const predictions = await new Promise<
//           google.maps.places.AutocompletePrediction[]
//         >((resolve, reject) => {
//           autocomplete.getPlacePredictions(request, (results, status) => {
//             if (
//               status !== google.maps.places.PlacesServiceStatus.OK ||
//               !results
//             ) {
//               return reject(new Error(`Places API error: ${status}`));
//             }
//             resolve(results);
//           });
//         });

//         setAddressPredictions(predictions);
//       } catch (err) {
//         console.error("Error fetching address predictions:", err);
//         setErrorMessage("Failed to fetch address suggestions.");
//       } finally {
//         setLoadingAddress(false);
//       }
//     },
//     [autocomplete],
//   );

//   useEffect(() => {
//     if (companyWebsite) {
//       console.log("Company website found:", companyWebsite);
//     }
//   }, [companyWebsite]);

//   useEffect(() => {
//     if (step === 2) {
//       setAddressPredictions([]); // wipe old suggestions
//       setShowStep2Errors(false); // reset any prior errors
//     }
//   }, [step]);

//   useEffect(() => {
//     // If the name was just set programmatically from the token, skip the fetch this time.
//     if (initialOrgNameSet.current) {
//       initialOrgNameSet.current = false; // Reset the flag for subsequent user input
//       return; // Exit early
//     }

//     const timer = setTimeout(() => {
//       // Only search if the name wasn't just set programmatically AND has length
//       if (organizationName) {
//         handleOrgSearch(organizationName);
//       } else {
//         // Ensure predictions are cleared if the input becomes empty
//         setOrgPredictions([]);
//       }
//     }, 300); // 300ms debounce

//     return () => clearTimeout(timer);
//   }, [organizationName, handleOrgSearch]); // Dependencies remain the same

//   useEffect(() => {
//     const timer = setTimeout(() => {
//       // Only run if we’re actually on Step 2
//       if (step === 2 && address) {
//         handleAddressSearch(address);
//       }
//     }, 300);

//     return () => clearTimeout(timer);
//   }, [address, step, handleAddressSearch]);

//   // useEffect(() => {
//   //   if (!autocompleteService) return;

//   //   // If user typed fewer than 3 chars, clear predictions
//   //   if (organizationName.trim().length < 3) {
//   //     setOrgPredictions([]);
//   //     return;
//   //   }

//   //   autocompleteService.getPlacePredictions(
//   //     {
//   //       input: organizationName,
//   //       componentRestrictions: { country: "us" },
//   //     },
//   //     (predictions, status) => {
//   //       if (
//   //         status === google.maps.places.PlacesServiceStatus.OK &&
//   //         predictions
//   //       ) {
//   //         setOrgPredictions(predictions);
//   //       } else {
//   //         setOrgPredictions([]);
//   //       }
//   //     },
//   //   );
//   // }, [organizationName, autocompleteService]);

//   /**
//    * Handles the overall form submission, though its primary action is to call `handleNextStep`.
//    * Includes submitting state management.
//    * @async
//    */
//   async function handleSubmit() {
//     setIsSubmitting(true);
//     try {
//       // API call here
//       handleNextStep();
//     } catch (error) {
//       console.error(error);
//       // Show error message
//     } finally {
//       setIsSubmitting(false);
//     }
//   }

//   const step1Valid =
//     organizationName.trim() !== "" &&
//     isValidEmail(email.trim()) &&
//     password.trim().length >= 8;

//   // ------------------------------
//   // STEP CONTENT COMPONENTS
//   // ------------------------------
//   /**
//    * Renders the content for Step 1 of the sign-up flow: Basic Account Setup.
//    * This includes fields for organization name, email, and password, with Google Sign-In as an alternative.
//    * @returns {JSX.Element} The Step 1 form content.
//    */
//   // const Step1 = (
//   //   <div className="flex flex-col gap-4">
//   //     <h2 className="text-2xl font-bold mb-2">Basic Account Setup</h2>
//   //     <p className="text-gray-600 text-sm mb-4">
//   //       We just need a few details to set up your account.
//   //     </p>

//   //     <Input
//   //       type="text"
//   //       placeholder="Organization Name"
//   //       value={organizationName}
//   //       onChange={(e) => setOrganizationName(e.target.value)}
//   //     />

//   //     {/* Organization Name Predictions */}
//   //     {orgPredictions.length > 0 && (
//   //       <div className="relative">
//   //         <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded shadow-md">
//   //           {orgPredictions.map((prediction) => (
//   //             <div
//   //               key={prediction.place_id}
//   //               className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
//   //               onClick={() => {
//   //                 setOrganizationName(prediction.description);
//   //                 setOrgPredictions([]);

//   //                 if (placesService) {
//   //                   const request = {
//   //                     placeId: prediction.place_id,
//   //                     fields: ["website", "formatted_address"], // <-- ADD formatted_address
//   //                   };
//   //                   placesService.getDetails(request, (placeResult, status) => {
//   //                     if (
//   //                       status === google.maps.places.PlacesServiceStatus.OK &&
//   //                       placeResult
//   //                     ) {
//   //                       // Keep setting the company website
//   //                       setCompanyWebsite(placeResult.website || "");
//   //                       // NEW: Also set the address so Step 2 is pre-filled
//   //                       setAddress(placeResult.formatted_address || "");
//   //                     }
//   //                   });
//   //                 }
//   //               }}
//   //             >
//   //               {prediction.description}
//   //             </div>
//   //           ))}
//   //         </div>
//   //       </div>
//   //     )}

//   //     <Input
//   //       type="email"
//   //       placeholder="Email"
//   //       value={email}
//   //       onChange={(e) => setEmail(e.target.value)}
//   //     />

//   //     {email && !isValidEmail(email) && (
//   //       <p className="text-red-500 text-xs">
//   //         Please enter a valid email address.
//   //       </p>
//   //     )}

//   //     <Input
//   //       type="password"
//   //       placeholder="Password"
//   //       value={password}
//   //       onChange={(e) => {
//   //         setPassword(e.target.value);
//   //         // Clear any existing error if user starts typing again
//   //         if (errorMessage) setErrorMessage("");
//   //       }}
//   //     />

//   //     {/* Password requirement hint */}
//   //     {password && password.length < 8 && (
//   //       <p className="text-red-500 text-xs">
//   //         Your password must be at least 8 characters long.
//   //       </p>
//   //     )}

//   //     <div className="flex flex-col items-center gap-4 mt-4">
//   //       <Button onClick={handleNextStep} disabled={!step1Valid}>
//   //         Next
//   //       </Button>

//   //       <div className="flex items-center w-full">
//   //         <div className="flex-grow border-t border-gray-300"></div>
//   //         <span className="px-2 text-gray-500 text-sm">OR</span>
//   //         <div className="flex-grow border-t border-gray-300"></div>
//   //       </div>

//   //       <GoogleOAuthProvider clientId="YOUR_GOOGLE_CLIENT_ID">
//   //         <GoogleLogin
//   //           onSuccess={(credentialResponse) => {
//   //             if (!organizationName.trim()) {
//   //               alert(
//   //                 "Please enter an organization name before continuing with Google.",
//   //               );
//   //               return;
//   //             }
//   //             console.log("Google sign-in success:", credentialResponse);
//   //             handleNextStep();
//   //           }}
//   //           onError={() => alert("Google Sign-In Failed")}
//   //         />
//   //       </GoogleOAuthProvider>
//   //     </div>
//   //   </div>
//   // );

//   const Step1 = (
//     <div className="flex flex-col gap-4">
//       <h2 className="text-2xl font-bold mb-2">Basic Account Setup</h2>
//       <p className="text-gray-600 text-sm mb-4">
//         We just need a few details to set up your account.
//       </p>

//       <Input
//         type="text"
//         placeholder="Organization Name"
//         value={organizationName}
//         onChange={(e) => setOrganizationName(e.target.value)}
//         onKeyDown={(e) => {
//           if (e.key === "Enter" && step1Valid) {
//             handleNextStep();
//           }
//         }}
//       />

//       {/* Organization Name Predictions */}
//       {orgPredictions.length > 0 && (
//         <div className="relative">
//           <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded shadow-md">
//             {orgPredictions.map((prediction) => (
//               <div
//                 key={prediction.place_id}
//                 className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
//                 onClick={() => {
//                   setOrganizationName(prediction.description);
//                   setOrgPredictions([]);

//                   if (placesService) {
//                     const request = {
//                       placeId: prediction.place_id,
//                       fields: ["website", "formatted_address"],
//                     };
//                     placesService.getDetails(request, (placeResult, status) => {
//                       if (
//                         status === google.maps.places.PlacesServiceStatus.OK &&
//                         placeResult
//                       ) {
//                         setCompanyWebsite(placeResult.website || "");
//                         setAddress(placeResult.formatted_address || "");
//                       }
//                     });
//                   }
//                 }}
//               >
//                 {prediction.description}
//               </div>
//             ))}
//           </div>
//         </div>
//       )}

//       <Input
//         type="email"
//         placeholder="Email"
//         value={email}
//         onChange={(e) => setEmail(e.target.value)}
//         onKeyDown={(e) => {
//           if (e.key === "Enter" && step1Valid) {
//             handleNextStep();
//           }
//         }}
//       />

//       {email && !isValidEmail(email) && (
//         <p className="text-red-500 text-xs">
//           Please enter a valid email address.
//         </p>
//       )}

//       <Input
//         type="password"
//         placeholder="Password (at least 8 characters)"
//         value={password}
//         onChange={(e) => {
//           setPassword(e.target.value);
//           if (errorMessage) setErrorMessage("");
//         }}
//         onKeyDown={(e) => {
//           if (e.key === "Enter" && step1Valid) {
//             handleNextStep();
//           }
//         }}
//       />

//       {password && password.length < 8 && (
//         <p className="text-red-500 text-xs">
//           Your password must be at least 8 characters long.
//         </p>
//       )}

//       <div className="flex flex-col items-center gap-4 mt-6">
//         <div className="flex justify-end w-full">
//           <Button
//             onClick={handleNextStep}
//             disabled={!step1Valid}
//             className="px-8 py-3 text-lg font-semibold min-w-[120px]"
//           >
//             Next →
//           </Button>
//         </div>

//         {/* Comment out from here */}
//         {/*
//         <div className="flex items-center w-full">
//           <div className="flex-grow border-t border-gray-300"></div>
//           <span className="px-2 text-gray-500 text-sm">OR</span>
//           <div className="flex-grow border-t border-gray-300"></div>
//         </div>

//         <GoogleOAuthProvider clientId="YOUR_GOOGLE_CLIENT_ID">
//           <GoogleLogin
//             onSuccess={(credentialResponse) => {
//               if (!organizationName.trim()) {
//                 alert(
//                   "Please enter an organization name before continuing with Google.",
//                 );
//                 return;
//               }
//               console.log("Google sign-in success:", credentialResponse);
//               handleNextStep();
//             }}
//             onError={() => alert("Google Sign-In Failed")}
//           />
//         </GoogleOAuthProvider>
//         */}
//         {/* Comment out to here */}
//       </div>
//     </div>
//   );

//   /**
//    * Renders the content for Step 2 of the sign-up flow: Contact & Location.
//    * This includes fields for contact person name, phone number, physical address, and estimated square footage.
//    * @returns {JSX.Element} The Step 2 form content.
//    */
//   // const Step2 = (
//   //   <div className="flex flex-col gap-4">
//   //     <h2 className="text-2xl font-bold mb-2">Contact &amp; Location</h2>
//   //     <p className="text-gray-600 text-sm mb-4">
//   //       Provide the main contact details and the address we'll map.
//   //     </p>

//   //     <Input
//   //       type="text"
//   //       placeholder="Contact Person Name"
//   //       value={contactName}
//   //       onChange={(e) => setContactName(e.target.value)}
//   //     />

//   //     <Input
//   //       type="text"
//   //       placeholder="Contact's Phone Number"
//   //       value={phoneNumber}
//   //       onChange={(e) => setPhoneNumber(e.target.value)}
//   //       className={
//   //         showStep2Errors && !isValidPhone(phoneNumber) ? "border-red-500" : ""
//   //       }
//   //     />
//   //     {showStep2Errors && !isValidPhone(phoneNumber) && (
//   //       <p className="text-red-500 text-xs mt-1">
//   //         Please enter a valid 10‑digit phone number.
//   //       </p>
//   //     )}

//   //     <Input
//   //       type="text"
//   //       placeholder="Physical Address (where the mapping will occur)"
//   //       value={address}
//   //       onChange={(e) => setAddress(e.target.value)}
//   //       onFocus={() => setIsAddressFocused(true)}
//   //       onBlur={() => setTimeout(() => setIsAddressFocused(false), 200)}
//   //     />

//   //     {/* ────────────────────────────────────────────────────────────────────── */}
//   //     {/* NEW FIELD: Prompt user for estimated square footage of the mapping area */}
//   //     <Label>Estimated Square Footage to Map</Label>
//   //     <Input
//   //       type="number"
//   //       placeholder="e.g. 1500"
//   //       value={squareFootage}
//   //       onChange={(e) => setSquareFootage(Number(e.target.value))}
//   //       className={
//   //         showStep2Errors && squareFootage <= 0 ? "border-red-500" : ""
//   //       }
//   //     />
//   //     {showStep2Errors && squareFootage <= 0 && (
//   //       <p className="text-red-500 text-xs mt-1">
//   //         Estimated square footage must be greater than zero.
//   //       </p>
//   //     )}

//   //     {showStep2Errors && (
//   //       <p className="text-red-500 text-sm mt-3">
//   //         Fix the errors above to unlock the Next button.
//   //       </p>
//   //     )}
//   //     {/* ────────────────────────────────────────────────────────────────────── */}

//   //     {isAddressFocused && addressPredictions.length > 0 && (
//   //       <div className="relative">
//   //         <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded shadow-md">
//   //           {addressPredictions.map((prediction) => (
//   //             <div
//   //               key={prediction.place_id}
//   //               className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
//   //               onClick={() => {
//   //                 // Just store the full text for now
//   //                 setAddress(prediction.description);
//   //                 setAddressPredictions([]);
//   //                 // Optionally fetch place details if you want geometry, etc.
//   //               }}
//   //             >
//   //               {prediction.description}
//   //             </div>
//   //           ))}
//   //         </div>
//   //       </div>
//   //     )}

//   //     <div className="flex justify-between mt-4">
//   //       <Button variant="outline" onClick={handlePrevStep}>
//   //         Back
//   //       </Button>
//   //       <Button onClick={handleNextStep} disabled={!step2Valid}>
//   //         Next
//   //       </Button>
//   //     </div>
//   //   </div>
//   // );

//   const Step2 = (
//     <div className="flex flex-col gap-4">
//       <h2 className="text-2xl font-bold mb-2">Contact &amp; Location</h2>
//       <p className="text-gray-600 text-sm mb-4">
//         Provide the main contact details and the address we'll map.
//       </p>

//       <Input
//         type="text"
//         placeholder="Contact Person Name"
//         value={contactName}
//         onChange={(e) => setContactName(e.target.value)}
//         onKeyDown={(e) => {
//           if (e.key === "Enter" && step2Valid) {
//             handleNextStep();
//           }
//         }}
//         className={
//           showStep2Errors && !contactName.trim() ? "border-red-500" : ""
//         }
//       />
//       {showStep2Errors && !contactName.trim() && (
//         <p className="text-red-500 text-xs mt-1">Contact name is required.</p>
//       )}

//       <Input
//         type="text"
//         placeholder="Contact's Phone Number"
//         value={phoneNumber}
//         onChange={(e) => setPhoneNumber(e.target.value)}
//         onKeyDown={(e) => {
//           if (e.key === "Enter" && step2Valid) {
//             handleNextStep();
//           }
//         }}
//         className={
//           showStep2Errors && !isValidPhone(phoneNumber) ? "border-red-500" : ""
//         }
//       />
//       {showStep2Errors && !isValidPhone(phoneNumber) && (
//         <p className="text-red-500 text-xs mt-1">
//           Please enter a valid 10‑digit phone number.
//         </p>
//       )}
//       {/* SMS Consent Text */}
//       <p className="text-xs text-gray-600 mt-2 leading-relaxed">
//         ☑️ By providing your phone number, you consent to receive SMS text
//         messages from Blueprint regarding property updates and notifications.
//         Message frequency varies. Message and data rates may apply. Reply STOP
//         to opt out or HELP for help.
//       </p>

//       <Input
//         type="text"
//         placeholder="Physical Address (where the mapping will occur)"
//         value={address}
//         onChange={(e) => setAddress(e.target.value)}
//         onFocus={() => setIsAddressFocused(true)}
//         onBlur={() => setTimeout(() => setIsAddressFocused(false), 200)}
//         onKeyDown={(e) => {
//           if (e.key === "Enter" && step2Valid) {
//             handleNextStep();
//           }
//         }}
//         className={showStep2Errors && !address.trim() ? "border-red-500" : ""}
//       />
//       {showStep2Errors && !address.trim() && (
//         <p className="text-red-500 text-xs mt-1">Address is required.</p>
//       )}

//       <Label>Estimated Square Footage to Map</Label>
//       <Input
//         type="number"
//         placeholder="e.g. 1500"
//         value={squareFootage || ""} // This prevents the 0 from showing
//         onChange={(e) => setSquareFootage(Number(e.target.value) || 0)}
//         onKeyDown={(e) => {
//           if (e.key === "Enter" && step2Valid) {
//             handleNextStep();
//           }
//         }}
//         className={
//           showStep2Errors && (squareFootage === null || squareFootage <= 0)
//             ? "border-red-500"
//             : ""
//         }
//       />
//       {showStep2Errors && (squareFootage === null || squareFootage <= 0) && (
//         <p className="text-red-500 text-xs mt-1">
//           Estimated square footage must be greater than zero.
//         </p>
//       )}

//       {isAddressFocused && addressPredictions.length > 0 && (
//         <div className="relative">
//           <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded shadow-md">
//             {addressPredictions.map((prediction) => (
//               <div
//                 key={prediction.place_id}
//                 className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
//                 onClick={() => {
//                   setAddress(prediction.description);
//                   setAddressPredictions([]);
//                 }}
//               >
//                 {prediction.description}
//               </div>
//             ))}
//           </div>
//         </div>
//       )}

//       {showStep2Errors && (
//         <p className="text-red-500 text-sm mt-3">
//           Please complete all required fields above.
//         </p>
//       )}

//       <div className="flex justify-between items-center mt-6">
//         {/* Only show Back button if user hasn't been created yet */}
//         {!userCreated ? (
//           <Button
//             variant="outline"
//             onClick={handlePrevStep}
//             className="px-6 py-3 text-lg"
//           >
//             ← Back
//           </Button>
//         ) : (
//           <div></div> // Empty div to maintain spacing
//         )}
//         <Button
//           onClick={handleNextStep}
//           disabled={!step2Valid} // Fixed the condition here too
//           className="px-8 py-3 text-lg font-semibold min-w-[140px] bg-green-600 hover:bg-green-700"
//         >
//           Next →
//         </Button>
//       </div>
//     </div>
//   );

//   function isToday(date) {
//     const now = new Date();
//     return (
//       date.getDate() === now.getDate() &&
//       date.getMonth() === now.getMonth() &&
//       date.getFullYear() === now.getFullYear()
//     );
//   }

//   /**
//    * Renders the content for Step 3 of the sign-up flow: Schedule 3D Mapping.
//    * This includes a date picker and time slot selection for the mapping session.
//    * It fetches and displays available time slots based on existing bookings.
//    * @returns {JSX.Element} The Step 3 form content.
//    */
//   const Step3 = () => {
//     const [bookedTimes, setBookedTimes] = useState<string[]>([]);
//     const [isLoading, setIsLoading] = useState(true);

//     const maxDate = useCallback(() => {
//       const date = new Date();
//       date.setMonth(date.getMonth() + 1);
//       return date;
//     }, []);

//     // Helper to format 24-hr "HH:MM" into "h:MM AM/PM"
//     const formatSlot = (time: string): string => {
//       const [hh, mm] = time.split(":");
//       let hour = parseInt(hh, 10);
//       const isAM = hour < 12;
//       const ampm = isAM ? "AM" : "PM";
//       if (hour === 0) {
//         hour = 12;
//       } else if (hour > 12) {
//         hour -= 12;
//       }
//       return `${hour}:${mm} ${ampm}`;
//     };

//     // Fetch booked times when date changes
//     useEffect(() => {
//       const fetchBookedTimes = async () => {
//         setIsLoading(true);
//         try {
//           const bookingDate = scheduleDate.toISOString().split("T")[0];
//           const { collection, query, where, getDocs } = await import(
//             "firebase/firestore"
//           );

//           // Get all bookings for the selected date
//           const bookingsRef = collection(db, "bookings");
//           const q = query(bookingsRef, where("date", "==", bookingDate));
//           const querySnapshot = await getDocs(q);

//           // Extract the booked times
//           const times: string[] = [];
//           querySnapshot.forEach((doc) => {
//             const data = doc.data();
//             if (data && data.time) {
//               times.push(data.time as string);
//             }
//           });

//           setBookedTimes(times);
//         } catch (error) {
//           console.error("Error fetching booked times:", error);
//           setErrorMessage("Could not load availability. Please try again.");
//         } finally {
//           setIsLoading(false);
//         }
//       };

//       fetchBookedTimes();
//     }, [scheduleDate]);

//     // Check if a time slot should be unavailable (booked or within 1 hour after a booking)
//     const isSlotUnavailable = useCallback(
//       (slot) => {
//         // If the slot itself is booked
//         if (bookedTimes.includes(slot)) return true;

//         // Check if slot is within one hour after any booked time
//         for (const bookedTime of bookedTimes) {
//           const [bookedHour, bookedMinute] = bookedTime.split(":").map(Number);
//           const [slotHour, slotMinute] = slot.split(":").map(Number);

//           // Convert both times to minutes for easier comparison
//           const bookedTimeInMinutes = bookedHour * 60 + bookedMinute;
//           const slotTimeInMinutes = slotHour * 60 + slotMinute;

//           // Check if slot is within 60 minutes after a booked time
//           const timeDifference = slotTimeInMinutes - bookedTimeInMinutes;
//           if (timeDifference > 0 && timeDifference <= 60) {
//             return true;
//           }
//         }

//         return false;
//       },
//       [bookedTimes],
//     );

//     const generateTimeSlots = useCallback(() => {
//       const slots: string[] = [];
//       for (let hour = 8; hour < 20; hour++) {
//         slots.push(`${hour.toString().padStart(2, "0")}:00`);
//         slots.push(`${hour.toString().padStart(2, "0")}:30`);
//       }
//       slots.push("20:00");

//       if (isToday(scheduleDate)) {
//         const now = new Date();
//         const currentMinutes = now.getHours() * 60 + now.getMinutes();
//         // Filter out times that are:
//         // 1. Less than 1 hour from now
//         // 2. Already booked
//         // 3. Within 1 hour after a booking
//         return slots.filter((slot) => {
//           const [hh, mm] = slot.split(":");
//           const slotMinutes = parseInt(hh, 10) * 60 + parseInt(mm, 10);

//           // Check if time is at least 1 hour from now
//           const isAfterCurrentTime = slotMinutes >= currentMinutes + 60;

//           // Check booking-related availability
//           const isAvailableForBooking = !isSlotUnavailable(slot);

//           return isAfterCurrentTime && isAvailableForBooking;
//         });
//       }

//       // For future dates, only filter based on bookings
//       return slots.filter((slot) => !isSlotUnavailable(slot));
//     }, [scheduleDate, isSlotUnavailable]);

//     const timeSlots = generateTimeSlots();

//     return (
//       <div className="flex flex-col gap-6">
//         <div>
//           <h2 className="text-2xl font-bold">Schedule 3D Mapping</h2>
//           <p className="text-gray-600 mt-2">
//             Pick a date and time for our specialist to visit, meet the contact
//             person, and scan your location.
//           </p>
//         </div>

//         <div className="grid md:grid-cols-2 gap-6">
//           {/* Calendar Section */}
//           <div className="bg-white rounded-lg shadow-sm border p-4">
//             <div className="mb-4 flex items-center gap-2">
//               <Calendar className="w-5 h-5 text-blue-600" />
//               <Label className="font-medium">Select Date</Label>
//             </div>
//             <DatePicker
//               selected={scheduleDate}
//               onChange={(date: Date | null) => date && setScheduleDate(date)}
//               inline
//               minDate={new Date()}
//               maxDate={maxDate()}
//               dropdownMode="select"
//               calendarClassName="!border-0 !shadow-none scale-[1.285] origin-top-left"
//               wrapperClassName="!block w-full"
//               dayClassName={(date) =>
//                 date.toDateString() === scheduleDate.toDateString()
//                   ? "!bg-blue-600 !text-white hover:!bg-blue-700"
//                   : "hover:!bg-blue-50"
//               }
//             />
//           </div>

//           {/* Time Selection Section */}
//           <div className="bg-white rounded-lg shadow-sm border p-4">
//             <div className="mb-4">
//               <Label className="font-medium">Select Time</Label>
//               <p className="text-sm text-gray-500 mt-1">Available time slots</p>
//             </div>

//             {isLoading ? (
//               <div className="flex justify-center py-6">
//                 <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
//               </div>
//             ) : timeSlots.length > 0 ? (
//               <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2">
//                 {timeSlots.map((slot) => (
//                   <button
//                     key={slot}
//                     onClick={() => setScheduleTime(slot)}
//                     className={`p-2 text-sm rounded-md transition-colors
//                       ${
//                         scheduleTime === slot
//                           ? "bg-blue-600 text-white"
//                           : "bg-gray-50 hover:bg-gray-100"
//                       }
//                     `}
//                   >
//                     {formatSlot(slot)}
//                   </button>
//                 ))}
//               </div>
//             ) : (
//               <div className="text-red-600 text-sm p-4 bg-red-50 rounded-md">
//                 No available times left for this date. Please pick another date.
//               </div>
//             )}
//           </div>
//         </div>

//         <div className="flex justify-between mt-4">
//           <Button variant="outline" onClick={handlePrevStep}>
//             Back
//           </Button>
//           <Button
//             onClick={handleNextStep}
//             disabled={!scheduleTime || isLoading}
//           >
//             Finish
//           </Button>
//         </div>
//       </div>
//     );
//   };

//   /**
//    * Renders the content for Step 4 of the sign-up flow: Schedule Demo Day.
//    * This includes a date picker and time slot selection for the demo presentation.
//    * @returns {JSX.Element} The Step 4 form content.
//    */
//   const Step4 = () => {
//     const [demoBookedTimes, setDemoBookedTimes] = useState<string[]>([]);
//     const [isLoading, setIsLoading] = useState(true);

//     // ⭐ UPDATED: Demo can only be scheduled 8-14 days after mapping
//     const minDemoDate = useCallback(() => {
//       const date = new Date(scheduleDate);
//       date.setDate(date.getDate() + 8); // Demo must be at least 8 days after mapping
//       return date;
//     }, [scheduleDate]);

//     const maxDemoDate = useCallback(() => {
//       const date = new Date(scheduleDate);
//       date.setDate(date.getDate() + 14); // Demo can be at most 14 days after mapping
//       return date;
//     }, [scheduleDate]);

//     // Helper to format 24-hr "HH:MM" into "h:MM AM/PM"
//     const formatSlot = (time: string): string => {
//       const [hh, mm] = time.split(":");
//       let hour = parseInt(hh, 10);
//       const isAM = hour < 12;
//       const ampm = isAM ? "AM" : "PM";
//       if (hour === 0) {
//         hour = 12;
//       } else if (hour > 12) {
//         hour -= 12;
//       }
//       return `${hour}:${mm} ${ampm}`;
//     };

//     // Fetch booked demo times when date changes
//     useEffect(() => {
//       const fetchDemoBookedTimes = async () => {
//         setIsLoading(true);
//         try {
//           const bookingDate = demoDate.toISOString().split("T")[0];
//           const { collection, query, where, getDocs } = await import(
//             "firebase/firestore"
//           );

//           // Get all demo bookings for the selected date
//           const demoBookingsRef = collection(db, "demoBookings");
//           const q = query(demoBookingsRef, where("date", "==", bookingDate));
//           const querySnapshot = await getDocs(q);

//           // Extract the booked times
//           const times: string[] = [];
//           querySnapshot.forEach((doc) => {
//             const data = doc.data();
//             if (data && data.time) {
//               times.push(data.time as string);
//             }
//           });

//           setDemoBookedTimes(times);
//         } catch (error) {
//           console.error("Error fetching demo booked times:", error);
//           setErrorMessage(
//             "Could not load demo availability. Please try again.",
//           );
//         } finally {
//           setIsLoading(false);
//         }
//       };

//       fetchDemoBookedTimes();
//     }, [demoDate]);

//     // Check if a demo time slot should be unavailable
//     const isDemoSlotUnavailable = useCallback(
//       (slot) => {
//         return demoBookedTimes.includes(slot);
//       },
//       [demoBookedTimes],
//     );

//     const generateDemoTimeSlots = useCallback(() => {
//       const slots: string[] = [];
//       // Demo slots from 9 AM to 6 PM
//       for (let hour = 9; hour < 18; hour++) {
//         slots.push(`${hour.toString().padStart(2, "0")}:00`);
//         slots.push(`${hour.toString().padStart(2, "0")}:30`);
//       }
//       slots.push("18:00");

//       return slots.filter((slot) => !isDemoSlotUnavailable(slot));
//     }, [isDemoSlotUnavailable]);

//     const demoTimeSlots = generateDemoTimeSlots();

//     return (
//       <div className="flex flex-col gap-6">
//         <div>
//           <h2 className="text-2xl font-bold">Schedule Demo Day</h2>
//           <p className="text-gray-600 mt-2">
//             Choose when you'd like us to present your completed 3D blueprint and
//             AR experience. This should be at least 3 days after your mapping
//             session.
//           </p>
//         </div>

//         <div className="grid md:grid-cols-2 gap-6">
//           {/* Calendar Section */}
//           <div className="bg-white rounded-lg shadow-sm border p-4">
//             <div className="mb-4 flex items-center gap-2">
//               <Calendar className="w-5 h-5 text-green-600" />
//               <Label className="font-medium">Select Demo Date</Label>
//             </div>
//             <DatePicker
//               selected={demoDate}
//               onChange={(date: Date | null) => date && setDemoDate(date)}
//               inline
//               minDate={minDemoDate()}
//               maxDate={maxDemoDate()}
//               dropdownMode="select"
//               calendarClassName="!border-0 !shadow-none scale-[1.285] origin-top-left"
//               wrapperClassName="!block w-full"
//               dayClassName={(date) =>
//                 date.toDateString() === demoDate.toDateString()
//                   ? "!bg-green-600 !text-white hover:!bg-green-700"
//                   : "hover:!bg-green-50"
//               }
//             />
//           </div>

//           {/* Time Selection Section */}
//           <div className="bg-white rounded-lg shadow-sm border p-4">
//             <div className="mb-4">
//               <Label className="font-medium">Select Demo Time</Label>
//               <p className="text-sm text-gray-500 mt-1">
//                 Available presentation slots
//               </p>
//             </div>

//             {isLoading ? (
//               <div className="flex justify-center py-6">
//                 <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
//               </div>
//             ) : demoTimeSlots.length > 0 ? (
//               <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2">
//                 {demoTimeSlots.map((slot) => (
//                   <button
//                     key={slot}
//                     onClick={() => setDemoTime(slot)}
//                     className={`p-2 text-sm rounded-md transition-colors
//                     ${
//                       demoTime === slot
//                         ? "bg-green-600 text-white"
//                         : "bg-gray-50 hover:bg-gray-100"
//                     }
//                   `}
//                   >
//                     {formatSlot(slot)}
//                   </button>
//                 ))}
//               </div>
//             ) : (
//               <div className="text-red-600 text-sm p-4 bg-red-50 rounded-md">
//                 No available demo times for this date. Please pick another date.
//               </div>
//             )}
//           </div>
//         </div>

//         <div className="flex justify-between mt-4">
//           <Button variant="outline" onClick={handlePrevStep}>
//             Back
//           </Button>
//           <Button
//             onClick={handleNextStep}
//             disabled={!demoTime || isLoading}
//             className="bg-green-600 hover:bg-green-700"
//           >
//             Complete Setup
//           </Button>
//         </div>
//       </div>
//     );
//   };

//   /**
//    * Renders the confirmation screen shown after successfully completing all sign-up steps.
//    * @returns {JSX.Element} The confirmation message and a button to go to the dashboard.
//    */
//   function Confirmation() {
//     return (
//       <div className="flex flex-col gap-4 items-center text-center">
//         <h2 className="text-3xl font-bold">All Set!</h2>
//         <p className="text-gray-600 max-w-md">
//           We've received your information and scheduled your 3D mapping. We'll
//           send a SMS message as a reminder ~1 hour before your scheduled time.
//         </p>
//         <p className="text-sm text-gray-400 mt-2">
//           Thank you for choosing Blueprint. We look forward to creating an
//           amazing AR experience for your business!
//         </p>
//         <Button
//           className="mt-4"
//           onClick={() => {
//             // Clear any "scanCompleted" flag that might be set erroneously
//             localStorage.removeItem("scanCompleted");

//             // Store a flag to ensure we show the waiting screen
//             localStorage.setItem("showWaitingDashboard", "true");

//             window.location.href = "/dashboard";
//           }}
//         >
//           Go to Dashboard
//         </Button>
//       </div>
//     );
//   }

//   // ------------------------------
//   // RENDER FUNCTION
//   // ------------------------------
//   return (
//     <div className="min-h-screen flex flex-col bg-gradient-to-br from-white to-blue-50">
//       {errorMessage && (
//         <div className="fixed top-24 right-5 z-[9999] bg-red-600 text-white px-4 py-3 rounded shadow-lg">
//           <div className="flex items-center justify-between">
//             <span className="mr-4">{errorMessage}</span>
//             <button className="font-bold" onClick={() => setErrorMessage("")}>
//               X
//             </button>
//           </div>
//         </div>
//       )}
//       <Nav hideAuthenticatedFeatures={true} />
//       <main className="flex-1 flex flex-col items-center justify-center px-4 pt-24 pb-12">
//         <div className="w-full max-w-3xl bg-white rounded-lg shadow-lg p-8 relative">
//           {/* Progress Indicator */}
//           <div className="flex items-center justify-center mb-8">
//             {[1, 2, 3, 4].map((s) => (
//               <React.Fragment key={s}>
//                 <div
//                   className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold transition-colors
//                   ${
//                     step === s
//                       ? "bg-blue-600 text-white"
//                       : step > s
//                         ? "bg-green-600 text-white"
//                         : "bg-gray-300 text-gray-600"
//                   }`}
//                 >
//                   {s}
//                 </div>
//                 {s < 4 && (
//                   <div
//                     className={`w-16 h-1 ${
//                       step > s ? "bg-green-600" : "bg-gray-300"
//                     }`}
//                   />
//                 )}
//               </React.Fragment>
//             ))}
//           </div>
//           {/* Simplified AnimatePresence usage */}
//           <AnimatePresence mode="wait">
//             <motion.div
//               key={step}
//               initial={{ opacity: 0, x: 10 }}
//               animate={{ opacity: 1, x: 0 }}
//               exit={{ opacity: 0, x: -10 }}
//               transition={{ duration: 0.2 }}
//             >
//               {step === 1 && Step1}
//               {step === 2 && Step2}
//               {step === 3 && <Step3 />}
//               {step === 4 && <Step4 />}
//               {step === 5 && <Confirmation />}
//             </motion.div>
//           </AnimatePresence>
//         </div>
//       </main>
//       <Footer />
//     </div>
//   );
// }

// // --------------------------
// // lines below remain unchanged
// // --------------------------
