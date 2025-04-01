// File: pages/accept-invite.tsx

"use client";

import React, { useState, useEffect } from "react";
//import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function AcceptInvite() {
  //const router = useRouter();
  const { currentUser, signIn, signUp } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [inviteValid, setInviteValid] = useState(false);
  const [inviteData, setInviteData] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [error, setError] = useState("");

  const urlParams = new URLSearchParams(window.location.search);
  const teamId = urlParams.get("team");
  const inviteId = urlParams.get("id");
  const token = urlParams.get("token");

  // Verify the invitation when component loads
  useEffect(() => {
    async function verifyInvitation() {
      if (!teamId || !inviteId || !token) {
        setError("Invalid invitation link");
        setLoading(false);
        return;
      }

      try {
        // Get the invitation document
        const inviteRef = doc(db, "teams", teamId, "invitations", inviteId);
        const inviteDoc = await getDoc(inviteRef);

        if (!inviteDoc.exists()) {
          setError("Invitation not found");
          setLoading(false);
          return;
        }

        const inviteData = inviteDoc.data();

        // Check if token matches
        if (inviteData.token !== token) {
          setError("Invalid invitation token");
          setLoading(false);
          return;
        }

        // Check if invitation has expired
        const expiresAt = inviteData.expiresAt?.toDate() || new Date();
        if (expiresAt < new Date()) {
          setError("Invitation has expired");
          setLoading(false);
          return;
        }

        // Check if invitation is already accepted
        if (inviteData.status === "accepted") {
          setError("Invitation has already been accepted");
          setLoading(false);
          return;
        }

        // Get team info
        const teamRef = doc(db, "teams", teamId);
        const teamDoc = await getDoc(teamRef);

        setInviteData(inviteData);
        setTeamData(teamDoc.exists() ? teamDoc.data() : { name: "Team" });
        setInviteValid(true);
        setLoading(false);
      } catch (error) {
        console.error("Error verifying invitation:", error);
        setError("Failed to verify invitation");
        setLoading(false);
      }
    }

    verifyInvitation();
  }, [teamId, inviteId, token]);

  // Handle accepting the invitation
  const handleAcceptInvite = async () => {
    if (!currentUser) {
      // If not logged in, redirect to login page with return URL
      const returnUrl = encodeURIComponent(window.location.href);
      router.push(`/sign-in?returnUrl=${returnUrl}`);
      return;
    }

    try {
      setLoading(true);

      // Add user to team members
      const membersRef = collection(db, "teams", teamId, "members");
      await addDoc(membersRef, {
        uid: currentUser.uid,
        email: currentUser.email,
        role: inviteData.role || "Viewer", // Use the role from the invitation
        addedAt: new Date(),
      });

      // Update invitation status
      const inviteRef = doc(db, "teams", teamId, "invitations", inviteId);
      await updateDoc(inviteRef, {
        status: "accepted",
        acceptedAt: new Date(),
        acceptedBy: currentUser.uid,
      });

      toast({
        title: "Invitation accepted!",
        description: "You've been added to the team.",
      });

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (error) {
      console.error("Error accepting invitation:", error);
      toast({
        title: "Error",
        description: "Failed to accept invitation. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  // Render loading state
  if (loading) {
    return (
      <>
        <Nav />
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50/30 pt-24 pb-16 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-medium text-gray-800">
              Verifying invitation...
            </h2>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // Render error state
  if (!inviteValid) {
    return (
      <>
        <Nav />
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50/30 pt-24 pb-16 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Invalid Invitation
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button
              onClick={() => router.push("/")}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Return to Homepage
            </Button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // Render valid invitation
  return (
    <>
      <Nav />
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50/30 pt-24 pb-16 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-green-600"
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
          <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">
            Team Invitation
          </h2>
          <p className="text-gray-600 text-center mb-6">
            You've been invited to join a team as a{" "}
            <strong>{inviteData.role}</strong>.
          </p>

          <div className="bg-indigo-50 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-indigo-600 mt-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-indigo-800">
                  Invitation Details
                </h3>
                <div className="mt-2 text-sm text-indigo-700">
                  <p>Team: {teamData.name || "Team"}</p>
                  <p>Your Role: {inviteData.role || "Member"}</p>
                  <p>Invited By: {inviteData.invitedBy}</p>
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={handleAcceptInvite}
            className="w-full bg-indigo-600 hover:bg-indigo-700"
            disabled={loading}
          >
            {loading ? "Processing..." : "Accept Invitation"}
          </Button>

          <p className="text-sm text-gray-500 text-center mt-4">
            By accepting this invitation, you'll be added to the team with the
            specified role.
          </p>
        </div>
      </div>
      <Footer />
    </>
  );
}
