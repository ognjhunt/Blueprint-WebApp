// --------------------------
// lines above remain unchanged
// --------------------------

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
import { Calendar } from "lucide-react";
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
/**
 * OffWaitlistSignUpFlow
 * - Step 1: Basic Account Setup (Organization Name, Email, Password)
 * - Step 2: Contact & Location (Contact Name, Phone, Address)
 * - Step 3: Scheduling (Date, Time)
 * - Final: Confirmation Screen
 */
export default function OffWaitlistSignUpFlow() {
  // ------------------------------
  // TOKEN VALIDATION
  // ------------------------------
  const [showStep2Errors, setShowStep2Errors] = useState(false);
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tokenData, setTokenData] = useState(null);

  // ------------------------------
  // STEP STATE
  // ------------------------------
  const [step, setStep] = useState(1);

  // ------------------------------
  // FORM FIELDS
  // ------------------------------
  // Step 1
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2
  const [contactName, setContactName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [squareFootage, setSquareFootage] = useState<number>(0);

  // Step 3
  const [scheduleDate, setScheduleDate] = useState(new Date());
  const [scheduleTime, setScheduleTime] = useState("08:00");

  const [errorMessage, setErrorMessage] = useState("");

  function isValidEmail(email: string) {
    // A basic regex for email validation
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
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
    squareFootage > 0;

  // ------------------------------
  // STEP HANDLERS
  // ------------------------------
  async function handleNextStep() {
    if (step === 1) {
      // Check token validity
      if (!isValidToken || !tokenData) {
        setErrorMessage("Invalid or expired signup token");
        return;
      }

      // 1) Create the Firebase Auth user with email & password

      // Enforce password length before hitting Firebase
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

        // 2) Create a user document in Firestore with initial fields
        const userId = userCredential.user.uid;
        await setDoc(doc(db, "users", userId), {
          uid: userId,
          email: email.trim(),
          organizationName: organizationName.trim(),
          company: organizationName.trim(),
          createdDate: serverTimestamp(),
          planType: "free",
          finishedOnboarding: false,
          waitlistTokenId: tokenData.id, // Store reference to the token
        });

        // 3) Mark the token as used
        await updateDoc(doc(db, "waitlistTokens", tokenData.id), {
          status: "used",
          usedAt: serverTimestamp(),
          usedBy: userId,
        });
      } catch (error) {
        console.error("Error creating user:", error);
        setErrorMessage("Error creating user: " + error.message);
        return; // Stop here if there's an error
      }
    } else if (step === 2) {
      if (!step2Valid) {
        setShowStep2Errors(true);
        return;
      }
      // 1) Get the current user
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setErrorMessage("No user found. Please sign up first.");
        return;
      }

      // 2) Update user doc with contact & location info
      try {
        await updateDoc(doc(db, "users", user.uid), {
          mappingContactName: contactName.trim(),
          mappingContactPhoneNumber: phoneNumber.trim(),
          address: address.trim(),
          mappingAreaSqFt: squareFootage,
        });
      } catch (error) {
        console.error("Error updating contact info:", error);
        setErrorMessage("Error updating contact info: " + error.message);
        return; // Stop here if there's an error
      }
    } else if (step === 3) {
      // 1) Get the current user
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setErrorMessage("No user found. Please sign up first.");
        return;
      }

      // 2) Update user doc with scheduling info
      try {
        await updateDoc(doc(db, "users", user.uid), {
          mappingScheduleDate: scheduleDate, // or scheduleDate.toISOString()
          mappingScheduleTime: scheduleTime,
        });

        const bookingDate = scheduleDate.toISOString().split("T")[0]; // Format: YYYY-MM-DD
        const bookingId = `${bookingDate}_${scheduleTime}`;

        // Create a unique blueprintId that will be used later when uploading files
        const blueprintId = crypto.randomUUID();

        // Create a more comprehensive booking record
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
          blueprintId: blueprintId, // Add the blueprint ID for reference
          createdAt: serverTimestamp(),
        });

        // Also create a placeholder blueprint document that will be updated later with scan files
        await setDoc(doc(db, "blueprints", blueprintId), {
          id: blueprintId,
          businessName: organizationName.trim(),
          address: address.trim(),
          name: organizationName.trim(), // Add name field that matches businessName for backward compatibility
          host: user.uid,
          locationType: "retail", // Default type, can be updated later
          createdDate: serverTimestamp(),
          updatedAt: serverTimestamp(),
          scanCompleted: false,
          status: "Pending", // Explicitly set status
          email: email.trim(),
          phone: phoneNumber.trim(),
        });

        // Update the user document to include this blueprintId in their createdBlueprintIDs array
        await updateDoc(doc(db, "users", user.uid), {
          createdBlueprintIDs: arrayUnion(blueprintId),
        });

        // Add the webhook call here to use the user's chosen scheduling info:
        const chosenDate = scheduleDate.toISOString().split("T")[0];
        const chosenTime = scheduleTime;
        const cName = organizationName.trim();
        const cUrl = companyWebsite.trim();
        const cAddress = address.trim();
        const personName = contactName.trim();
        const contactPhone = phoneNumber.trim();

        const options = {
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
            address: cAddress,
            company_url: cUrl,
            company_name: cName,
            contact_name: personName,
            contact_phone_number: contactPhone,
          }),
        };

        fetch(
          "https://public.lindy.ai/api/v1/webhooks/lindy/43c7b7d7-bc40-4593-acfe-ba79ad6488b8",
          options,
        )
          .then((res) => res.json())
          .then((data) => console.log("Lindy response:", data))
          .catch((err) => console.error("Lindy error:", err));
      } catch (error) {
        console.error("Error updating scheduling info:", error);
        setErrorMessage("Error updating scheduling info: " + error.message);
        return; // Stop here if there's an error
      }
    }
    // Finally, advance to the next step if everything succeeded
    setStep((prev) => prev + 1);
  }

  //       const options = {
  //         method: "POST",
  //         headers: {
  //           Authorization: "Bearer c4dc7fe399094cd3819c96e51dded30c",
  //           "Content-Type": "application/json",
  //         },
  //         body: JSON.stringify({
  //           user_id: "Hs4h5E9hjnVCNcbF4ns2puDi3oR2",
  //           saved_item_id: "6u9qqqaskkFoxxsLz1tWX9",
  //           pipeline_inputs: [
  //             { input_name: "have_we_onboarded", value: "No" },
  //             { input_name: "chosen_time_of_mapping", value: chosenTime },
  //             { input_name: "chosen_date_of_mapping", value: chosenDate },
  //             { input_name: "have_user_chosen_date", value: "Yes" },
  //             { input_name: "address", value: cAddress },
  //             { input_name: "company_url", value: cUrl },
  //             { input_name: "company_name", value: cName },
  //             { input_name: "contact_name", value: personName },
  //             { input_name: "contact_phone_number", value: contactPhone },
  //           ],
  //         }),
  //       };

  //       fetch("https://api.gumloop.com/api/v1/start_pipeline", options)
  //         .then((res) => res.json())
  //         .then((data) => console.log("Gumloop response:", data))
  //         .catch((err) => console.error("Gumloop error:", err));
  //     } catch (error) {
  //       console.error("Error updating scheduling info:", error);
  //       setErrorMessage("Error updating scheduling info: " + error.message);
  //       return; // Stop here if there's an error
  //     }
  //   }

  //   // Finally, advance to the next step if everything succeeded
  //   setStep((prev) => prev + 1);
  // }

  function handlePrevStep() {
    setStep((prev) => prev - 1);
  }

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ------------------------------
  // GOOGLE PLACES AUTOCOMPLETE STATE
  // ------------------------------
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.AutocompleteService | null>(null);
  const [placesService, setPlacesService] =
    useState<google.maps.places.PlacesService | null>(null);
  const [orgPredictions, setOrgPredictions] = useState<
    google.maps.places.AutocompletePrediction[]
  >([]);
  const [loadingOrg, setLoadingOrg] = useState(false);

  // ADD THIS BELOW:
  const [addressPredictions, setAddressPredictions] = useState<
    google.maps.places.AutocompletePrediction[]
  >([]);
  const [loadingAddress, setLoadingAddress] = useState(false);

  // Load Google Places API once
  useEffect(() => {
    const loader = new Loader({
      apiKey: "AIzaSyBgxzzgcT_9nyhz1D_JtfG7gevRUKQ5Vbs", // Replace with your real API key
      version: "weekly",
      libraries: ["places"],
    });

    loader
      .load()
      .then(() => {
        // Create an AutocompleteService
        const autocompleteService =
          new google.maps.places.AutocompleteService();
        setAutocomplete(autocompleteService);

        // Also create a PlacesService for optional place details
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
      if (!autocomplete) {
        setErrorMessage("Places service not initialized");
        return;
      }
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
      } catch (err) {
        console.error("Error fetching org predictions:", err);
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
          types: ["address"], // IMPORTANT: Restrict to addresses
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
      } catch (err) {
        console.error("Error fetching address predictions:", err);
        setErrorMessage("Failed to fetch address suggestions.");
      } finally {
        setLoadingAddress(false);
      }
    },
    [autocomplete],
  );

  // Check token validity on page load
  useEffect(() => {
    const validateToken = async () => {
      setIsLoading(true);

      // Use URL API instead of React Router's useSearchParams
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get("token");

      if (!token) {
        setErrorMessage("Invalid or missing access token");
        setIsLoading(false);
        setIsValidToken(false);
        return;
      }

      try {
        const q = query(
          collection(db, "waitlistTokens"),
          where("token", "==", token),
          where("status", "==", "unused"),
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setErrorMessage(
            "This signup link is invalid or has already been used",
          );
          setIsValidToken(false);
        } else {
          // Get the first matching document
          const tokenDoc = querySnapshot.docs[0];
          const data = tokenDoc.data();

          // Pre-fill form fields if available
          // Pre-fill form fields if available
          if (data.company) {
            setOrganizationName(data.company);
            initialOrgNameSet.current = true; // Mark that the initial value was set programmatically
          }
          if (data.email) setEmail(data.email);

          setTokenData({
            id: tokenDoc.id,
            ...data,
          });
          setIsValidToken(true);
        }
      } catch (error) {
        console.error("Error validating token:", error);
        setErrorMessage("Error validating your access token");
        setIsValidToken(false);
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, []); // No dependency on searchParams anymore

  useEffect(() => {
    if (step === 2) {
      setAddressPredictions([]); // wipe old suggestions
      setShowStep2Errors(false); // reset any prior errors
    }
  }, [step]);

  useEffect(() => {
    // If the name was just set programmatically from the token, skip the fetch this time.
    if (initialOrgNameSet.current) {
      initialOrgNameSet.current = false; // Reset the flag for subsequent user input
      return; // Exit early
    }

    const timer = setTimeout(() => {
      // Only search if the name wasn't just set programmatically AND has length
      if (organizationName) {
        handleOrgSearch(organizationName);
      } else {
        // Ensure predictions are cleared if the input becomes empty
        setOrgPredictions([]);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [organizationName, handleOrgSearch]); // Dependencies remain the same

  useEffect(() => {
    const timer = setTimeout(() => {
      // Only run if we’re actually on Step 2
      if (step === 2 && address) {
        handleAddressSearch(address);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [address, step, handleAddressSearch]);

  // useEffect(() => {
  //   if (!autocompleteService) return;

  //   // If user typed fewer than 3 chars, clear predictions
  //   if (organizationName.trim().length < 3) {
  //     setOrgPredictions([]);
  //     return;
  //   }

  //   autocompleteService.getPlacePredictions(
  //     {
  //       input: organizationName,
  //       componentRestrictions: { country: "us" },
  //     },
  //     (predictions, status) => {
  //       if (
  //         status === google.maps.places.PlacesServiceStatus.OK &&
  //         predictions
  //       ) {
  //         setOrgPredictions(predictions);
  //       } else {
  //         setOrgPredictions([]);
  //       }
  //     },
  //   );
  // }, [organizationName, autocompleteService]);

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      // API call here
      handleNextStep();
    } catch (error) {
      console.error(error);
      // Show error message
    } finally {
      setIsSubmitting(false);
    }
  }

  const step1Valid =
    organizationName.trim() !== "" &&
    isValidEmail(email.trim()) &&
    password.trim().length >= 8;

  // ------------------------------
  // STEP CONTENT COMPONENTS
  // ------------------------------
  const Step1 = (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold mb-2">Basic Account Setup</h2>
      <p className="text-gray-600 text-sm mb-4">
        We just need a few details to set up your account.
      </p>

      <Input
        type="text"
        placeholder="Organization Name"
        value={organizationName}
        onChange={(e) => setOrganizationName(e.target.value)}
      />

      {/* Organization Name Predictions */}
      {orgPredictions.length > 0 && (
        <div className="relative">
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded shadow-md">
            {orgPredictions.map((prediction) => (
              <div
                key={prediction.place_id}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                onClick={() => {
                  setOrganizationName(prediction.description);
                  setOrgPredictions([]);

                  if (placesService) {
                    const request = {
                      placeId: prediction.place_id,
                      fields: ["website", "formatted_address"], // <-- ADD formatted_address
                    };
                    placesService.getDetails(request, (placeResult, status) => {
                      if (
                        status === google.maps.places.PlacesServiceStatus.OK &&
                        placeResult
                      ) {
                        // Keep setting the company website
                        setCompanyWebsite(placeResult.website || "");
                        // NEW: Also set the address so Step 2 is pre-filled
                        setAddress(placeResult.formatted_address || "");
                      }
                    });
                  }
                }}
              >
                {prediction.description}
              </div>
            ))}
          </div>
        </div>
      )}

      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {email && !isValidEmail(email) && (
        <p className="text-red-500 text-xs">
          Please enter a valid email address.
        </p>
      )}

      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          // Clear any existing error if user starts typing again
          if (errorMessage) setErrorMessage("");
        }}
      />

      {/* Password requirement hint */}
      {password && password.length < 8 && (
        <p className="text-red-500 text-xs">
          Your password must be at least 8 characters long.
        </p>
      )}

      <div className="flex flex-col items-center gap-4 mt-4">
        <Button onClick={handleNextStep} disabled={!step1Valid}>
          Next
        </Button>

        <div className="flex items-center w-full">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="px-2 text-gray-500 text-sm">OR</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        <GoogleOAuthProvider clientId="YOUR_GOOGLE_CLIENT_ID">
          <GoogleLogin
            onSuccess={(credentialResponse) => {
              if (!organizationName.trim()) {
                alert(
                  "Please enter an organization name before continuing with Google.",
                );
                return;
              }
              console.log("Google sign-in success:", credentialResponse);
              handleNextStep();
            }}
            onError={() => alert("Google Sign-In Failed")}
          />
        </GoogleOAuthProvider>
      </div>
    </div>
  );

  const Step2 = (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold mb-2">Contact &amp; Location</h2>
      <p className="text-gray-600 text-sm mb-4">
        Provide the main contact details and the address we'll map.
      </p>

      <Input
        type="text"
        placeholder="Contact Person Name"
        value={contactName}
        onChange={(e) => setContactName(e.target.value)}
      />

      <Input
        type="text"
        placeholder="Contact's Phone Number"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        className={
          showStep2Errors && !isValidPhone(phoneNumber) ? "border-red-500" : ""
        }
      />
      {showStep2Errors && !isValidPhone(phoneNumber) && (
        <p className="text-red-500 text-xs mt-1">
          Please enter a valid 10‑digit phone number.
        </p>
      )}

      <Input
        type="text"
        placeholder="Physical Address (where the mapping will occur)"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        onFocus={() => setIsAddressFocused(true)}
        onBlur={() => setTimeout(() => setIsAddressFocused(false), 200)}
      />

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* NEW FIELD: Prompt user for estimated square footage of the mapping area */}
      <Label>Estimated Square Footage to Map</Label>
      <Input
        type="number"
        placeholder="e.g. 1500"
        value={squareFootage}
        onChange={(e) => setSquareFootage(Number(e.target.value))}
        className={
          showStep2Errors && squareFootage <= 0 ? "border-red-500" : ""
        }
      />
      {showStep2Errors && squareFootage <= 0 && (
        <p className="text-red-500 text-xs mt-1">
          Estimated square footage must be greater than zero.
        </p>
      )}

      {showStep2Errors && (
        <p className="text-red-500 text-sm mt-3">
          Fix the errors above to unlock the Next button.
        </p>
      )}
      {/* ────────────────────────────────────────────────────────────────────── */}

      {isAddressFocused && addressPredictions.length > 0 && (
        <div className="relative">
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded shadow-md">
            {addressPredictions.map((prediction) => (
              <div
                key={prediction.place_id}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                onClick={() => {
                  // Just store the full text for now
                  setAddress(prediction.description);
                  setAddressPredictions([]);
                  // Optionally fetch place details if you want geometry, etc.
                }}
              >
                {prediction.description}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between mt-4">
        <Button variant="outline" onClick={handlePrevStep}>
          Back
        </Button>
        <Button onClick={handleNextStep} disabled={!step2Valid}>
          Next
        </Button>
      </div>
    </div>
  );

  function isToday(date) {
    const now = new Date();
    return (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  }

  const Step3 = () => {
    const [bookedTimes, setBookedTimes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const maxDate = useCallback(() => {
      const date = new Date();
      date.setMonth(date.getMonth() + 1);
      return date;
    }, []);

    // Helper to format 24-hr "HH:MM" into "h:MM AM/PM"
    const formatSlot = (time) => {
      const [hh, mm] = time.split(":");
      let hour = parseInt(hh, 10);
      const isAM = hour < 12;
      const ampm = isAM ? "AM" : "PM";
      if (hour === 0) {
        hour = 12;
      } else if (hour > 12) {
        hour -= 12;
      }
      return `${hour}:${mm} ${ampm}`;
    };

    // Fetch booked times when date changes
    useEffect(() => {
      const fetchBookedTimes = async () => {
        setIsLoading(true);
        try {
          const bookingDate = scheduleDate.toISOString().split("T")[0];
          const { collection, query, where, getDocs } = await import(
            "firebase/firestore"
          );

          // Get all bookings for the selected date
          const bookingsRef = collection(db, "bookings");
          const q = query(bookingsRef, where("date", "==", bookingDate));
          const querySnapshot = await getDocs(q);

          // Extract the booked times
          const times = [];
          querySnapshot.forEach((doc) => {
            times.push(doc.data().time);
          });

          setBookedTimes(times);
        } catch (error) {
          console.error("Error fetching booked times:", error);
          setErrorMessage("Could not load availability. Please try again.");
        } finally {
          setIsLoading(false);
        }
      };

      fetchBookedTimes();
    }, [scheduleDate]);

    // Check if a time slot should be unavailable (booked or within 1 hour after a booking)
    const isSlotUnavailable = useCallback(
      (slot) => {
        // If the slot itself is booked
        if (bookedTimes.includes(slot)) return true;

        // Check if slot is within one hour after any booked time
        for (const bookedTime of bookedTimes) {
          const [bookedHour, bookedMinute] = bookedTime.split(":").map(Number);
          const [slotHour, slotMinute] = slot.split(":").map(Number);

          // Convert both times to minutes for easier comparison
          const bookedTimeInMinutes = bookedHour * 60 + bookedMinute;
          const slotTimeInMinutes = slotHour * 60 + slotMinute;

          // Check if slot is within 60 minutes after a booked time
          const timeDifference = slotTimeInMinutes - bookedTimeInMinutes;
          if (timeDifference > 0 && timeDifference <= 60) {
            return true;
          }
        }

        return false;
      },
      [bookedTimes],
    );

    const generateTimeSlots = useCallback(() => {
      const slots = [];
      for (let hour = 8; hour < 20; hour++) {
        slots.push(`${hour.toString().padStart(2, "0")}:00`);
        slots.push(`${hour.toString().padStart(2, "0")}:30`);
      }
      slots.push("20:00");

      if (isToday(scheduleDate)) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        // Filter out times that are:
        // 1. Less than 1 hour from now
        // 2. Already booked
        // 3. Within 1 hour after a booking
        return slots.filter((slot) => {
          const [hh, mm] = slot.split(":");
          const slotMinutes = parseInt(hh, 10) * 60 + parseInt(mm, 10);

          // Check if time is at least 1 hour from now
          const isAfterCurrentTime = slotMinutes >= currentMinutes + 60;

          // Check booking-related availability
          const isAvailableForBooking = !isSlotUnavailable(slot);

          return isAfterCurrentTime && isAvailableForBooking;
        });
      }

      // For future dates, only filter based on bookings
      return slots.filter((slot) => !isSlotUnavailable(slot));
    }, [scheduleDate, isSlotUnavailable]);

    const timeSlots = generateTimeSlots();

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-bold">Schedule 3D Mapping</h2>
          <p className="text-gray-600 mt-2">
            Pick a date and time for our specialist to visit, meet the contact
            person, and scan your location.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Calendar Section */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <Label className="font-medium">Select Date</Label>
            </div>
            <DatePicker
              selected={scheduleDate}
              onChange={setScheduleDate}
              inline
              minDate={new Date()}
              maxDate={maxDate()}
              dropdownMode="select"
              calendarClassName="!border-0 !shadow-none scale-[1.285] origin-top-left"
              wrapperClassName="!block w-full"
              dayClassName={(date) =>
                date.toDateString() === scheduleDate.toDateString()
                  ? "!bg-blue-600 !text-white hover:!bg-blue-700"
                  : "hover:!bg-blue-50"
              }
            />
          </div>

          {/* Time Selection Section */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="mb-4">
              <Label className="font-medium">Select Time</Label>
              <p className="text-sm text-gray-500 mt-1">Available time slots</p>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : timeSlots.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2">
                {timeSlots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setScheduleTime(slot)}
                    className={`p-2 text-sm rounded-md transition-colors
                      ${
                        scheduleTime === slot
                          ? "bg-blue-600 text-white"
                          : "bg-gray-50 hover:bg-gray-100"
                      }
                    `}
                  >
                    {formatSlot(slot)}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-red-600 text-sm p-4 bg-red-50 rounded-md">
                No available times left for this date. Please pick another date.
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={handlePrevStep}>
            Back
          </Button>
          <Button
            onClick={handleNextStep}
            disabled={!scheduleTime || isLoading}
          >
            Finish
          </Button>
        </div>
      </div>
    );
  };

  function Confirmation() {
    return (
      <div className="flex flex-col gap-4 items-center text-center">
        <h2 className="text-3xl font-bold">All Set!</h2>
        <p className="text-gray-600 max-w-md">
          We've received your information and scheduled your 3D mapping. We'll
          send a SMS message as a reminder ~1 hour before your scheduled time.
        </p>
        <p className="text-sm text-gray-400 mt-2">
          Thank you for choosing Blueprint. We look forward to creating an
          amazing AR experience for your business!
        </p>
        <Button
          className="mt-4"
          onClick={() => {
            // Clear any "scanCompleted" flag that might be set erroneously
            localStorage.removeItem("scanCompleted");

            // Store a flag to ensure we show the waiting screen
            localStorage.setItem("showWaitingDashboard", "true");

            window.location.href = "/dashboard";
          }}
        >
          Go to Dashboard
        </Button>
      </div>
    );
  }

  // ------------------------------
  // RENDER FUNCTION
  // ------------------------------
  // ------------------------------
  // RENDER FUNCTION
  // ------------------------------
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-white to-blue-50">
      {errorMessage && (
        <div className="fixed top-24 right-5 z-[9999] bg-red-600 text-white px-4 py-3 rounded shadow-lg">
          <div className="flex items-center justify-between">
            <span className="mr-4">{errorMessage}</span>
            <button className="font-bold" onClick={() => setErrorMessage("")}>
              X
            </button>
          </div>
        </div>
      )}

      <Nav />

      <main className="flex-1 flex flex-col items-center justify-center px-4 pt-24 pb-12">
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-lg">Validating your access...</p>
            </div>
          </div>
        ) : !isValidToken ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-red-600 text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold mb-4">Invalid Access Link</h2>
            <p className="text-gray-600 mb-6">
              This signup link is invalid or has already been used. Please
              contact support if you believe this is an error.
            </p>
            <Button
              onClick={() => (window.location.href = "/")}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Return to Homepage
            </Button>
          </div>
        ) : (
          <div className="w-full max-w-3xl bg-white rounded-lg shadow-lg p-8 relative">
            {/* Progress Indicator remains the same */}
            <div className="flex items-center justify-center mb-8">
              {[1, 2, 3].map((s) => (
                <React.Fragment key={s}>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold transition-colors
                    ${
                      step === s
                        ? "bg-blue-600 text-white"
                        : step > s
                          ? "bg-green-600 text-white"
                          : "bg-gray-300 text-gray-600"
                    }`}
                  >
                    {s}
                  </div>
                  {s < 3 && (
                    <div
                      className={`w-16 h-1 ${
                        step > s ? "bg-green-600" : "bg-gray-300"
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Simplified AnimatePresence usage */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                {step === 1 && Step1}
                {step === 2 && Step2}
                {step === 3 && <Step3 />}
                {step === 4 && <Confirmation />}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

// --------------------------
// lines below remain unchanged
// --------------------------
