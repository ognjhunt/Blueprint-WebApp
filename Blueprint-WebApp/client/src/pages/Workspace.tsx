import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  doc,
  collection,
  addDoc,
  onSnapshot,
  DocumentData,
  query,
  where,
  getDocs,
  getDoc,
} from "firebase/firestore";
import { motion } from "framer-motion";
import { Users, Send, UserPlus, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default function WorkspacePage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [teamMembers, setTeamMembers] = useState<DocumentData[]>([]);
  const [pendingInvites, setPendingInvites] = useState<DocumentData[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const membersRef = collection(db, "teams", currentUser.uid, "members");
    const unsubscribeMembers = onSnapshot(membersRef, (snapshot) => {
      const members = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTeamMembers(members);
    });

    const invitesRef = collection(db, "teams", currentUser.uid, "invitations");
    const unsubscribeInvites = onSnapshot(invitesRef, (snapshot) => {
      const invites = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        status: doc.data().status || "pending", // Ensure status exists
      }));
      setPendingInvites(invites.filter((inv) => inv.status === "pending"));
    });

    return () => {
      unsubscribeMembers();
      unsubscribeInvites();
    };
  }, [currentUser]);

  // After (updated code for paste-2.txt):
  const handleInvite = async () => {
    if (!inviteEmail || !currentUser) return;
    setIsInviting(true);

    try {
      // Split by commas and process each email
      const emails = inviteEmail
        .split(",")
        .map((email) => email.trim())
        .filter((email) => email);

      // Get current user's name from Firestore
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      const inviterName = userDoc.exists()
        ? userDoc.data().name ||
          userDoc.data().organizationName ||
          "A Blueprint user"
        : "A Blueprint user";

      // Process each email
      for (const email of emails) {
        // Add to Firestore
        const invitesRef = collection(
          db,
          "teams",
          currentUser.uid,
          "invitations",
        );
        await addDoc(invitesRef, {
          email: email,
          invitedBy: currentUser.uid,
          status: "pending",
          createdAt: new Date(),
        });

        //       // Call webhook for each email
        //       const options = {
        //         method: "POST",
        //         headers: {
        //           Authorization: "Bearer c4dc7fe399094cd3819c96e51dded30c",
        //           "Content-Type": "application/json",
        //         },
        //         body: JSON.stringify({
        //           user_id: currentUser.uid,
        //           saved_item_id: "nMq3QiE7YRQfUk2V3oKg6E",
        //           pipeline_inputs: [
        //             { input_name: "name", value: inviterName },
        //             { input_name: "email", value: email },
        //           ],
        //         }),
        //       };

        //       // Don't await, send in parallel
        //       fetch("https://api.gumloop.com/api/v1/start_pipeline", options)
        //         .then((response) => response.json())
        //         .then((data) =>
        //           console.log(`Email webhook response for ${email}:`, data),
        //         )
        //         .catch((err) =>
        //           console.error(`Email webhook error for ${email}:`, err),
        //         );
        //     }

        //     toast({
        //       title: "Invitations sent!",
        //       description: `Invites have been sent to ${emails.length} email${emails.length !== 1 ? "s" : ""}`,
        //     });

        //     setInviteEmail("");
        //     setShowSuccessMessage(true);
        //     setTimeout(() => setShowSuccessMessage(false), 3000);
        //   } catch (error) {
        //     console.error("Error inviting users:", error);
        //     toast({
        //       title: "Invitation failed",
        //       description: "Failed to send invites. Please try again.",
        //       variant: "destructive",
        //     });
        //   } finally {
        //     setIsInviting(false);
        //   }
        // };

        // Call webhook for each email
        const options = {
          method: "POST",
          headers: {
            Authorization:
              "Bearer 1b1338d68dff4f009bbfaee1166cb9fc48b5fefa6dddbea797264674e2ee0150",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: inviterName,
            email: email,
          }),
        };
        // Don't await, send in parallel
        fetch(
          "https://public.lindy.ai/api/v1/webhooks/lindy/91d17fff-be31-45f5-8b0b-497fb168c2b6",
          options,
        )
          .then((response) => response.json())
          .then((data) =>
            console.log(`Email webhook response for ${email}:`, data),
          )
          .catch((err) =>
            console.error(`Email webhook error for ${email}:`, err),
          );
      }
      toast({
        title: "Invitations sent!",
        description: `Invites have been sent to ${emails.length} email${emails.length !== 1 ? "s" : ""}`,
      });
      setInviteEmail("");
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
    } catch (error) {
      console.error("Error inviting users:", error);
      toast({
        title: "Invitation failed",
        description: "Failed to send invites. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero section with animated background */}
      <div className="relative py-16 px-4 overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-30">
          <div className="absolute w-96 h-96 bg-blue-400 rounded-full blur-3xl -top-48 -left-48" />
          <div className="absolute w-96 h-96 bg-purple-400 rounded-full blur-3xl -bottom-48 -right-48" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
              Grow Your Team
            </h1>
            <p className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto">
              Invite collaborators and watch your ideas flourish. Experience
              seamless collaboration with unlimited team members, free forever.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto pb-16 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card className="shadow-xl bg-white/80 backdrop-blur-lg">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                <Users className="h-6 w-6 text-blue-500" />
                Team Workspace
              </CardTitle>
            </CardHeader>
            <CardContent className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Invite Section */}
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-xl">
                    <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-800">
                      <UserPlus className="h-5 w-5 text-blue-500" />
                      Invite New Members
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                      Grow your team by inviting new collaborators.
                    </p>
                    <div className="mt-4 space-y-4">
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="colleague@company.com"
                          className="flex-1"
                        />
                        <Button
                          onClick={handleInvite}
                          disabled={isInviting}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {isInviting ? (
                            "Sending..."
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Invite
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Success Message */}
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{
                          opacity: showSuccessMessage ? 1 : 0,
                          height: showSuccessMessage ? "auto" : 0,
                        }}
                        className="bg-green-50 text-green-700 p-3 rounded-lg flex items-center gap-2"
                      >
                        <Check className="h-4 w-4" />
                        Invitation sent successfully!
                      </motion.div>
                    </div>
                  </div>

                  {/* Benefits Section */}
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl">
                    <h3 className="font-semibold text-gray-800">✨ Benefits</h3>
                    <ul className="mt-3 space-y-2 text-sm text-gray-600">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Unlimited team members
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Real-time collaboration
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Advanced permission controls
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Team Overview Section */}
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-xl border border-gray-100">
                    <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-800">
                      <Users className="h-5 w-5 text-purple-500" />
                      Current Team
                    </h2>

                    {teamMembers.length === 0 ? (
                      <div className="mt-4 text-center py-8 bg-gray-50 rounded-lg">
                        <Users className="h-12 w-12 mx-auto text-gray-400" />
                        <p className="mt-2 text-gray-500">
                          No team members yet. Start inviting!
                        </p>
                      </div>
                    ) : (
                      <ul className="mt-4 space-y-2">
                        {teamMembers.map((member) => (
                          <motion.li
                            key={member.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 flex items-center justify-between"
                          >
                            <span className="font-medium text-gray-700">
                              {member.email}
                            </span>
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                              Active
                            </span>
                          </motion.li>
                        ))}
                      </ul>
                    )}

                    {/* Pending Invites */}
                    {pendingInvites.length > 0 && (
                      <div className="mt-6">
                        <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-700">
                          <Clock className="h-4 w-4 text-orange-500" />
                          Pending Invites
                        </h3>
                        <ul className="mt-3 space-y-2">
                          {pendingInvites.map((invite) => (
                            <motion.li
                              key={invite.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="p-3 rounded-lg bg-gradient-to-r from-orange-50 to-yellow-50 flex items-center justify-between"
                            >
                              <span className="font-medium text-gray-700">
                                {invite.email}
                              </span>
                              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                                Pending
                              </span>
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-gray-50 rounded-b-lg">
              <p className="text-sm text-gray-500">
                <span className="font-medium">Pro Tip:</span> Invite your entire
                team at once by separating email addresses with commas.
              </p>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
