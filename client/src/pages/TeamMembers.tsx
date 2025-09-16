"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  doc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  DocumentData,
  query,
  where,
  getDocs,
  getDoc,
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Send,
  UserPlus,
  Building2,
  Check,
  Clock,
  Shield,
  AlertTriangle,
  X,
  ChevronRight,
  MoreHorizontal,
  Mail,
  Calendar,
  Trash2,
  Edit,
  Star,
  UserCheck,
  UserX,
  Filter,
  Search,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

function generateToken(length = 24) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  const charactersLength = characters.length;

  for (let i = 0; i < length; i++) {
    token += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return token;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
};

const cardVariants = {
  hover: {
    y: -5,
    boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.1)",
    transition: { duration: 0.3 },
  },
};

// Sample roles with colors
const roleColors = {
  Admin: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    icon: <Shield className="w-4 h-4" />,
  },
  Editor: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    icon: <Edit className="w-4 h-4" />,
  },
  Viewer: {
    bg: "bg-green-100",
    text: "text-green-700",
    icon: <UserCheck className="w-4 h-4" />,
  },
};

export default function TeamMembersPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [teamMembers, setTeamMembers] = useState<DocumentData[]>([]);
  const [pendingInvites, setPendingInvites] = useState<DocumentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [selectedMember, setSelectedMember] = useState<DocumentData | null>(
    null,
  );
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [activeTab, setActiveTab] = useState("active-members");
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<DocumentData | null>(
    null,
  );
  const [inviteRole, setInviteRole] = useState("Viewer");

  // Fetch team members and invites
  useEffect(() => {
    if (!currentUser) return;

    if (!db) {
      console.warn("Firebase not configured. Cannot fetch team data.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Fetch team members
    const membersRef = collection(db, "teams", currentUser.uid, "members");
    const unsubscribeMembers = onSnapshot(membersRef, (snapshot) => {
      const members = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        // Add some dummy data for the UI
        role:
          doc.data().role ||
          ["Admin", "Editor", "Viewer"][Math.floor(Math.random() * 3)],
        lastActive: new Date(
          Date.now() - Math.floor(Math.random() * 10 * 24 * 60 * 60 * 1000),
        ).toISOString(),
        blueprintsCount: Math.floor(Math.random() * 20),
      }));
      setTeamMembers(members);
      setIsLoading(false);
    });

    // Fetch pending invites
    const invitesRef = collection(db, "teams", currentUser.uid, "invitations");
    const unsubscribeInvites = onSnapshot(invitesRef, (snapshot) => {
      const invites = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        sentDate: doc.data().createdAt || new Date(),
        status: doc.data().status || "pending", // Ensure status exists
      }));
      setPendingInvites(invites.filter((inv) => inv.status === "pending"));
    });

    return () => {
      unsubscribeMembers();
      unsubscribeInvites();
    };
  }, [currentUser]);

  // Filter team members based on search and role
  const filteredMembers = teamMembers.filter((member) => {
    const matchesSearch =
      (member.email?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (member.name?.toLowerCase() || "").includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === "All" || member.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  // After (updated code for paste.txt):
  // Updated handleInvite function with improved debugging and webhook handling
  const handleInvite = async () => {
    if (!inviteEmail || !currentUser) return;
    
    if (!db) {
      toast({
        title: "Error",
        description: "Firebase not configured. Cannot send invites.",
        variant: "destructive",
      });
      return;
    }
    
    setIsInviting(true);

    try {
      console.log("Starting invitation process...");

      // Split by commas and process each email
      const emails = inviteEmail
        .split(",")
        .map((email) => email.trim())
        .filter((email) => email);

      console.log("Processing invites for emails:", emails);

      // Get current user's name from Firestore
      let inviterName = "A Blueprint user";
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          inviterName =
            userData.name || userData.organizationName || "A Blueprint user";
        } else {
          // If not in users collection, try teams collection
          const teamDoc = await getDoc(doc(db, "teams", currentUser.uid));
          if (teamDoc.exists()) {
            const teamData = teamDoc.data();
            inviterName =
              teamData.name || teamData.organizationName || "A Blueprint user";
          }
        }
        console.log("Inviter name for webhook:", inviterName);
      } catch (error) {
        console.warn("Error fetching user name:", error);
        // Continue with default inviterName
      }

      // Process each email
      for (const email of emails) {
        console.log(`Processing email: ${email}`);

        // Generate a unique token for this invitation
        const inviteToken = generateToken(); // We'll implement this function

        // Add to Firestore with role and token
        const invitesRef = collection(
          db,
          "teams",
          currentUser.uid,
          "invitations",
        );

        const inviteDocRef = await addDoc(invitesRef, {
          email: email,
          invitedBy: currentUser.uid,
          status: "pending",
          createdAt: new Date(),
          role: inviteRole, // Store the selected role
          token: inviteToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days expiry
        });

        // Create invitation link (adjust baseUrl as needed)
        const baseUrl = window.location.origin;
        const inviteLink = `${baseUrl}/accept-invite?team=${currentUser.uid}&id=${inviteDocRef.id}&token=${inviteToken}`;

        // Update the invite document with the full link
        await updateDoc(inviteDocRef, {
          inviteLink: inviteLink,
        });

        console.log(`Added to Firestore: ${email} with role ${inviteRole}`);

        //       // Send webhook with dynamic user ID and invite link
        //       console.log(`Sending webhook for ${email}...`);
        //       const webhookData = {
        //         user_id: "Hs4h5E9hjnVCNcbF4ns2puDi3oR2", // Use the current user's ID
        //         saved_item_id: "nMq3QiE7YRQfUk2V3oKg6E",
        //         pipeline_inputs: [
        //           { input_name: "name", value: inviterName },
        //           { input_name: "email", value: email },
        //           { input_name: "invite_link", value: inviteLink }, // Include the invite link
        //           { input_name: "role", value: inviteRole },
        //         ],
        //       };

        //       const xhr = new XMLHttpRequest();
        //       xhr.open("POST", "https://api.gumloop.com/api/v1/start_pipeline", true);
        //       xhr.setRequestHeader("Content-Type", "application/json");
        //       xhr.setRequestHeader(
        //         "Authorization",
        //         "Bearer c4dc7fe399094cd3819c96e51dded30c",
        //       );

        //       xhr.onreadystatechange = function () {
        //         if (xhr.readyState === 4) {
        //           console.log(`Webhook response for ${email}: Status ${xhr.status}`);
        //           console.log(`Response text: ${xhr.responseText}`);
        //         }
        //       };

        //       xhr.onerror = function () {
        //         console.error(`XHR error for ${email}`);
        //       };

        //       xhr.send(JSON.stringify(webhookData));
        //       console.log(
        //         `Webhook request sent for ${email} with invite link: ${inviteLink}`,
        //       );
        //     }

        //     toast({
        //       title: "Invitations sent!",
        //       description: `Invites have been sent to ${emails.length} email${emails.length !== 1 ? "s" : ""}`,
        //     });

        //     setInviteEmail("");
        //     setInviteRole("Viewer"); // Reset to default role
        //     setShowSuccessMessage(true);
        //     setTimeout(() => setShowSuccessMessage(false), 3000);
        //   } catch (error) {
        //     console.error("Error in invitation process:", error);
        //     toast({
        //       title: "Invitation failed",
        //       description: "Failed to send invites. Please try again.",
        //       variant: "destructive",
        //     });
        //   } finally {
        //     setIsInviting(false);
        //   }
        // };
        // Send webhook with dynamic user ID and invite link
        console.log(`Sending webhook for ${email}...`);
        const webhookData = {
          name: inviterName,
          email: email,
          invite_link: inviteLink,
          role: inviteRole,
        };

        const xhr = new XMLHttpRequest();
        xhr.open(
          "POST",
          "https://public.lindy.ai/api/v1/webhooks/lindy/91d17fff-be31-45f5-8b0b-497fb168c2b6",
          true,
        );
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.setRequestHeader(
          "Authorization",
          "Bearer 1b1338d68dff4f009bbfaee1166cb9fc48b5fefa6dddbea797264674e2ee0150",
        );
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
            console.log(`Webhook response for ${email}: Status ${xhr.status}`);
            console.log(`Response text: ${xhr.responseText}`);
          }
        };
        xhr.onerror = function () {
          console.error(`XHR error for ${email}`);
        };
        xhr.send(JSON.stringify(webhookData));
        console.log(
          `Webhook request sent for ${email} with invite link: ${inviteLink}`,
        );
      }
      toast({
        title: "Invitations sent!",
        description: `Invites have been sent to ${emails.length} email${emails.length !== 1 ? "s" : ""}`,
      });
      setInviteEmail("");
      setInviteRole("Viewer"); // Reset to default role
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
    } catch (error) {
      console.error("Error in invitation process:", error);
      toast({
        title: "Invitation failed",
        description: "Failed to send invites. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!currentUser) return;

    try {
      const inviteRef = doc(
        db,
        "teams",
        currentUser.uid,
        "invitations",
        inviteId,
      );
      await deleteDoc(inviteRef);

      toast({
        title: "Invitation canceled",
        description: "The invitation has been canceled successfully.",
      });
    } catch (error) {
      console.error("Error canceling invitation:", error);
      toast({
        title: "Action failed",
        description: "Failed to cancel invitation. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    if (!currentUser) return;

    setIsChangingRole(true);
    try {
      const memberRef = doc(db, "teams", currentUser.uid, "members", memberId);
      await updateDoc(memberRef, {
        role: newRole,
        updatedAt: new Date(),
      });

      toast({
        title: "Role updated",
        description: `Team member's role updated to ${newRole}.`,
      });

      // Update the member in the state
      setTeamMembers((members) =>
        members.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)),
      );
    } catch (error) {
      console.error("Error updating role:", error);
      toast({
        title: "Action failed",
        description: "Failed to update role. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsChangingRole(false);
      setSelectedMember(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!currentUser || !memberToDelete) return;

    try {
      const memberRef = doc(
        db,
        "teams",
        currentUser.uid,
        "members",
        memberToDelete.id,
      );
      await deleteDoc(memberRef);

      toast({
        title: "Member removed",
        description: "Team member has been removed successfully.",
      });

      // Remove the member from the state
      setTeamMembers((members) =>
        members.filter((m) => m.id !== memberToDelete.id),
      );
    } catch (error) {
      console.error("Error removing member:", error);
      toast({
        title: "Action failed",
        description: "Failed to remove team member. Please try again.",
        variant: "destructive",
      });
    } finally {
      setShowDeleteDialog(false);
      setMemberToDelete(null);
    }
  };

  const formatDate = (date) => {
    if (!date) return "N/A";

    const d =
      typeof date === "string"
        ? new Date(date)
        : date instanceof Date
          ? date
          : date.toDate
            ? date.toDate()
            : new Date();

    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50/30 pt-20 pb-16">
        {/* Background elements for visual appeal */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-gradient-to-br from-indigo-200/20 to-violet-200/20 rounded-full blur-3xl"></div>
          <div className="absolute top-1/3 right-0 w-72 h-72 bg-gradient-to-br from-blue-200/20 to-indigo-200/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-gradient-to-br from-purple-200/20 to-pink-200/20 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Header & Title Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              Team Members
            </h1>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Manage your team members, control access levels, and send
              invitations to new collaborators.
            </p>
          </motion.div>

          {/* Main Content */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            {/* Action Bar: Tabs + Invite Button */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6"
            >
              <Tabs
                defaultValue="active-members"
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full md:w-auto"
              >
                <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
                  <TabsTrigger value="active-members" className="text-sm">
                    <Users className="w-4 h-4 mr-2" />
                    Team Members ({teamMembers.length})
                  </TabsTrigger>
                  <TabsTrigger value="pending-invites" className="text-sm">
                    <Clock className="w-4 h-4 mr-2" />
                    Pending Invites ({pendingInvites.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Dialog>
                <DialogTrigger asChild>
                  <Button className="w-full md:w-auto bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md">
                    <UserPlus className="w-4 h-4 mr-2" /> Invite New Members
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Invite Team Members</DialogTitle>
                    <DialogDescription>
                      Send invitations to collaborate on your Blueprints.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 my-2">
                    <div className="grid flex-1 gap-2">
                      <label
                        htmlFor="email"
                        className="text-sm font-medium text-gray-700"
                      >
                        Email address
                      </label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="colleague@company.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>

                    <div className="grid flex-1 gap-2">
                      <label
                        htmlFor="role"
                        className="text-sm font-medium text-gray-700"
                      >
                        Permission level
                      </label>
                      <select
                        id="role"
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                      >
                        {Object.keys(roleColors).map((role) => (
                          <option key={role} value={role}>
                            {role}{" "}
                            {role === "Admin"
                              ? "(Full access)"
                              : role === "Editor"
                                ? "(Can edit)"
                                : "(View only)"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-end">
                      <Button
                        type="submit"
                        onClick={handleInvite}
                        disabled={isInviting}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        {isInviting ? (
                          <div className="flex items-center">
                            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                            Sending...
                          </div>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Invite
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {showSuccessMessage && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-green-50 text-green-700 p-3 rounded-lg flex items-center gap-2 mt-2"
                      >
                        <Check className="h-4 w-4" />
                        Invitation sent successfully!
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="bg-gray-50 p-3 mt-2 rounded-md">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      Pro Tip
                    </h3>
                    <p className="text-sm text-gray-600">
                      You can invite multiple people at once by separating email
                      addresses with commas.
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            </motion.div>

            {/* Team Members Tab Content */}
            <AnimatePresence mode="wait">
              {activeTab === "active-members" && (
                <motion.div
                  key="active-members"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Filters Row */}
                  <Card className="mb-6 border-0 shadow-md overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row justify-between space-y-4 sm:space-y-0 sm:space-x-4">
                        {/* Search */}
                        <div className="relative flex-1 max-w-md">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="Search members..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-white focus-visible:ring-indigo-500"
                          />
                        </div>

                        {/* Role Filter */}
                        <div className="flex items-center space-x-2">
                          <Filter className="h-4 w-4 text-gray-500" />
                          <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                          >
                            <option value="All">All Roles</option>
                            {Object.keys(roleColors).map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Team Members List */}
                  {isLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <Card
                          key={i}
                          className="overflow-hidden border border-gray-100 shadow-sm"
                        >
                          <CardContent className="p-6">
                            <div className="flex items-center space-x-4">
                              <Skeleton className="h-12 w-12 rounded-full" />
                              <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-1/4" />
                                <Skeleton className="h-3 w-1/3" />
                              </div>
                              <Skeleton className="h-8 w-24 rounded-md" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : filteredMembers.length === 0 ? (
                    <Card className="overflow-hidden border border-gray-100 shadow-sm">
                      <CardContent className="p-8 text-center">
                        <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-800 mb-2">
                          No team members found
                        </h3>
                        <p className="text-gray-500 mb-4">
                          {searchQuery || roleFilter !== "All"
                            ? "Try adjusting your search or filters"
                            : "Start inviting team members to collaborate"}
                        </p>
                        {!(searchQuery || roleFilter !== "All") && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button className="bg-indigo-600 hover:bg-indigo-700">
                                <UserPlus className="w-4 h-4 mr-2" /> Invite New
                                Members
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                              <DialogHeader>
                                <DialogTitle>Invite Team Members</DialogTitle>
                                <DialogDescription>
                                  Send invitations to collaborate on your
                                  Blueprints.
                                </DialogDescription>
                              </DialogHeader>

                              <div className="space-y-4 my-2">
                                <div className="grid flex-1 gap-2">
                                  <label
                                    htmlFor="email"
                                    className="text-sm font-medium text-gray-700"
                                  >
                                    Email address
                                  </label>
                                  <Input
                                    id="email"
                                    type="email"
                                    placeholder="colleague@company.com"
                                    value={inviteEmail}
                                    onChange={(e) =>
                                      setInviteEmail(e.target.value)
                                    }
                                  />
                                </div>

                                <div className="grid flex-1 gap-2">
                                  <label
                                    htmlFor="role"
                                    className="text-sm font-medium text-gray-700"
                                  >
                                    Permission level
                                  </label>
                                  <select
                                    id="role"
                                    value={inviteRole}
                                    onChange={(e) =>
                                      setInviteRole(e.target.value)
                                    }
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                                  >
                                    {Object.keys(roleColors).map((role) => (
                                      <option key={role} value={role}>
                                        {role}{" "}
                                        {role === "Admin"
                                          ? "(Full access)"
                                          : role === "Editor"
                                            ? "(Can edit)"
                                            : "(View only)"}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="flex items-center justify-end">
                                  <Button
                                    type="submit"
                                    onClick={handleInvite}
                                    disabled={isInviting}
                                    className="bg-indigo-600 hover:bg-indigo-700"
                                  >
                                    {isInviting ? (
                                      <div className="flex items-center">
                                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                        Sending...
                                      </div>
                                    ) : (
                                      <>
                                        <Send className="h-4 w-4 mr-2" />
                                        Invite
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>

                              <AnimatePresence>
                                {showSuccessMessage && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="bg-green-50 text-green-700 p-3 rounded-lg flex items-center gap-2 mt-2"
                                  >
                                    <Check className="h-4 w-4" />
                                    Invitation sent successfully!
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              <div className="bg-gray-50 p-3 mt-2 rounded-md">
                                <h3 className="text-sm font-medium text-gray-700 mb-2">
                                  Pro Tip
                                </h3>
                                <p className="text-sm text-gray-600">
                                  You can invite multiple people at once by
                                  separating email addresses with commas.
                                </p>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {filteredMembers.map((member) => (
                        <motion.div
                          key={member.id}
                          variants={itemVariants}
                          whileHover="hover"
                        >
                          <Card className="overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                            <CardContent className="p-0">
                              <div className="flex flex-col sm:flex-row sm:items-center p-4 sm:p-6">
                                {/* Avatar and Basic Info */}
                                <div className="flex items-center flex-1 min-w-0 mb-4 sm:mb-0">
                                  <Avatar className="h-12 w-12 mr-4 border border-indigo-100 shadow-sm">
                                    <AvatarImage
                                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${member.email}`}
                                      alt={member.name || member.email}
                                    />
                                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
                                      {member.name
                                        ? `${member.name.split(" ")[0][0]}${member.name.split(" ")[1]?.[0] || ""}`
                                        : member.email
                                            .substring(0, 2)
                                            .toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>

                                  <div className="min-w-0 flex-1">
                                    <h3 className="text-base font-semibold text-gray-900 truncate">
                                      {member.name ||
                                        member.email.split("@")[0]}
                                    </h3>
                                    <div className="flex items-center text-sm text-gray-500">
                                      <Mail className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                                      <span className="truncate">
                                        {member.email}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Stats & Role */}
                                <div className="flex flex-wrap items-center justify-between gap-4 sm:justify-end sm:gap-6">
                                  {/* Role Badge */}
                                  <div className="flex items-center">
                                    <div
                                      className={`flex items-center px-3 py-1 rounded-full ${roleColors[member.role]?.bg || "bg-gray-100"} ${roleColors[member.role]?.text || "text-gray-700"}`}
                                    >
                                      {roleColors[member.role]?.icon}
                                      <span className="ml-1.5 text-xs font-medium">
                                        {member.role}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Last Active */}
                                  <div className="flex items-center text-sm text-gray-500">
                                    <Clock className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                                    <span>
                                      Active {formatDate(member.lastActive)}
                                    </span>
                                  </div>

                                  {/* Blueprints Count */}
                                  <div className="flex items-center text-sm text-gray-500">
                                    <div className="flex items-center bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-xs">
                                      <Building2 className="flex-shrink-0 mr-1 h-3.5 w-3.5" />
                                      <span>
                                        {member.blueprintsCount} Blueprints
                                      </span>
                                    </div>
                                  </div>

                                  {/* Actions Menu */}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>
                                        Member Actions
                                      </DropdownMenuLabel>
                                      <DropdownMenuItem
                                        onClick={() =>
                                          setSelectedMember(member)
                                        }
                                      >
                                        <Edit className="mr-2 h-4 w-4" />
                                        Change Role
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-red-600"
                                        onClick={() => {
                                          setMemberToDelete(member);
                                          setShowDeleteDialog(true);
                                        }}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Remove Member
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Pending Invites Tab Content */}
              {activeTab === "pending-invites" && (
                <motion.div
                  key="pending-invites"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {pendingInvites.length === 0 ? (
                    <Card className="overflow-hidden border border-gray-100 shadow-sm">
                      <CardContent className="p-8 text-center">
                        <Mail className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-800 mb-2">
                          No pending invitations
                        </h3>
                        <p className="text-gray-500 mb-4">
                          All invitations have been accepted or you haven't sent
                          any yet.
                        </p>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button className="bg-indigo-600 hover:bg-indigo-700">
                              <UserPlus className="w-4 h-4 mr-2" /> Invite New
                              Members
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>Invite Team Members</DialogTitle>
                              <DialogDescription>
                                Send invitations to collaborate on your
                                Blueprints.
                              </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 my-2">
                              <div className="grid flex-1 gap-2">
                                <label
                                  htmlFor="email"
                                  className="text-sm font-medium text-gray-700"
                                >
                                  Email address
                                </label>
                                <Input
                                  id="email"
                                  type="email"
                                  placeholder="colleague@company.com"
                                  value={inviteEmail}
                                  onChange={(e) =>
                                    setInviteEmail(e.target.value)
                                  }
                                />
                              </div>

                              <div className="grid flex-1 gap-2">
                                <label
                                  htmlFor="role"
                                  className="text-sm font-medium text-gray-700"
                                >
                                  Permission level
                                </label>
                                <select
                                  id="role"
                                  value={inviteRole}
                                  onChange={(e) =>
                                    setInviteRole(e.target.value)
                                  }
                                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                                >
                                  {Object.keys(roleColors).map((role) => (
                                    <option key={role} value={role}>
                                      {role}{" "}
                                      {role === "Admin"
                                        ? "(Full access)"
                                        : role === "Editor"
                                          ? "(Can edit)"
                                          : "(View only)"}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex items-center justify-end">
                                <Button
                                  type="submit"
                                  onClick={handleInvite}
                                  disabled={isInviting}
                                  className="bg-indigo-600 hover:bg-indigo-700"
                                >
                                  {isInviting ? (
                                    <div className="flex items-center">
                                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                      Sending...
                                    </div>
                                  ) : (
                                    <>
                                      <Send className="h-4 w-4 mr-2" />
                                      Invite
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>

                            <AnimatePresence>
                              {showSuccessMessage && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="bg-green-50 text-green-700 p-3 rounded-lg flex items-center gap-2 mt-2"
                                >
                                  <Check className="h-4 w-4" />
                                  Invitation sent successfully!
                                </motion.div>
                              )}
                            </AnimatePresence>

                            <div className="bg-gray-50 p-3 mt-2 rounded-md">
                              <h3 className="text-sm font-medium text-gray-700 mb-2">
                                Pro Tip
                              </h3>
                              <p className="text-sm text-gray-600">
                                You can invite multiple people at once by
                                separating email addresses with commas.
                              </p>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {pendingInvites.map((invite) => (
                        <motion.div
                          key={invite.id}
                          variants={itemVariants}
                          whileHover="hover"
                        >
                          <Card className="overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                            <CardContent className="p-4 sm:p-6">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                {/* Avatar and Basic Info */}
                                <div className="flex items-center flex-1 min-w-0">
                                  <Avatar className="h-10 w-10 mr-4 bg-amber-100 text-amber-700 border border-amber-200">
                                    <AvatarFallback>
                                      <Clock className="h-5 w-5" />
                                    </AvatarFallback>
                                  </Avatar>

                                  <div className="min-w-0 flex-1">
                                    <h3 className="text-base font-medium text-gray-900 truncate">
                                      {invite.email}
                                    </h3>
                                    <div className="flex items-center text-sm text-gray-500">
                                      <Calendar className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                                      <span>
                                        Sent {formatDate(invite.sentDate)}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Status Badge */}
                                <div className="flex items-center space-x-2">
                                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                                    <Clock className="mr-1 h-3 w-3" />
                                    Pending
                                  </Badge>
                                  {invite.role && (
                                    <div
                                      className={`flex items-center px-2 py-1 rounded-full text-xs ${roleColors[invite.role]?.bg || "bg-gray-100"} ${roleColors[invite.role]?.text || "text-gray-700"}`}
                                    >
                                      {roleColors[invite.role]?.icon}
                                      <span className="ml-1">
                                        {invite.role}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Actions */}
                                <div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    onClick={() =>
                                      handleCancelInvite(invite.id)
                                    }
                                  >
                                    <X className="mr-1 h-3 w-3" /> Cancel Invite
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Change Role Dialog */}
            <Dialog
              open={!!selectedMember}
              onOpenChange={(open) => !open && setSelectedMember(null)}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Change Team Member Role</DialogTitle>
                  <DialogDescription>
                    Update permissions for{" "}
                    {selectedMember?.name || selectedMember?.email}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Select a new role:</h3>
                    <div className="grid grid-cols-1 gap-3">
                      {Object.keys(roleColors).map((role) => (
                        <motion.div
                          key={role}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                        >
                          <button
                            className={`flex items-center justify-between w-full p-3 rounded-lg border ${selectedMember?.role === role ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/50"} transition-colors`}
                            onClick={() =>
                              handleChangeRole(selectedMember?.id, role)
                            }
                            disabled={isChangingRole}
                          >
                            <div className="flex items-center">
                              <div
                                className={`w-8 h-8 flex items-center justify-center rounded-full ${roleColors[role].bg}`}
                              >
                                {roleColors[role].icon}
                              </div>
                              <div className="ml-3 text-left">
                                <p className="text-sm font-medium text-gray-900">
                                  {role}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {role === "Admin" &&
                                    "Full access to all blueprints and settings"}
                                  {role === "Editor" &&
                                    "Can edit blueprints but can't access settings"}
                                  {role === "Viewer" &&
                                    "Can only view blueprints, no edit permissions"}
                                </p>
                              </div>
                            </div>
                            {selectedMember?.role === role && (
                              <Check className="w-5 h-5 text-indigo-600" />
                            )}
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter className="flex space-x-2 sm:justify-start">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedMember(null)}
                  >
                    Cancel
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Remove Team Member</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to remove this team member? This
                    action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  {memberToDelete && (
                    <div className="flex items-center p-3 bg-red-50 rounded-md border border-red-100">
                      <Avatar className="h-10 w-10 mr-3">
                        <AvatarImage
                          src={`https://api.dicebear.com/7.x/initials/svg?seed=${memberToDelete.email}`}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-red-500 to-pink-500 text-white">
                          {memberToDelete.name
                            ? `${memberToDelete.name.split(" ")[0][0]}${memberToDelete.name.split(" ")[1]?.[0] || ""}`
                            : memberToDelete.email
                                .substring(0, 2)
                                .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-gray-900">
                          {memberToDelete.name ||
                            memberToDelete.email.split("@")[0]}
                        </p>
                        <p className="text-sm text-gray-500">
                          {memberToDelete.email}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter className="sm:justify-start">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleRemoveMember}>
                    Remove Member
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </motion.div>

          {/* Best Practices Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-12"
          >
            <Card className="border-0 shadow-md overflow-hidden bg-gradient-to-r from-indigo-50/80 to-purple-50/80">
              <CardHeader>
                <CardTitle className="flex items-center text-xl text-gray-800">
                  <Star className="w-5 h-5 mr-2 text-amber-500" />
                  Team Collaboration Best Practices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-3">
                      <Shield className="h-5 w-5 text-green-600" />
                    </div>
                    <h3 className="font-medium text-gray-900 mb-2">
                      Role-Based Access
                    </h3>
                    <p className="text-sm text-gray-600">
                      Assign appropriate roles to team members based on their
                      responsibilities to maintain security and workflow
                      efficiency.
                    </p>
                  </div>

                  <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <h3 className="font-medium text-gray-900 mb-2">
                      Team Structure
                    </h3>
                    <p className="text-sm text-gray-600">
                      Organize teams based on projects or departments to keep
                      collaborations focused and avoid confusion with too many
                      members.
                    </p>
                  </div>

                  <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mb-3">
                      <UserCheck className="h-5 w-5 text-purple-600" />
                    </div>
                    <h3 className="font-medium text-gray-900 mb-2">
                      Regular Reviews
                    </h3>
                    <p className="text-sm text-gray-600">
                      Periodically review team access and remove members who no
                      longer need access to maintain security.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
}
