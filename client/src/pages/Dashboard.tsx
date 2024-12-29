"use client";

import { useState, useEffect } from "react";
import GeminiChat from "@/components/GeminiChat";
import GeminiMultimodal from "@/components/GeminiMultimodal";
import { motion } from "framer-motion";

import { LiveAPIProvider } from "@/contexts/LiveAPIContext";
import {
  BarChart,
  Building2,
  Users,
  ShoppingBag,
  Star,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "wouter";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { ScreenShare } from "lucide-react";
import ScreenShareButton from "@/components/ScreenShareButton";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const { currentUser } = useAuth();
  const [totalBlueprints, setTotalBlueprints] = useState(0);
  const [blueprints, setBlueprints] = useState<any[]>([]);
  const [blueprintsLastMonth, setBlueprintsLastMonth] = useState(0);

  const apiKey = "AIzaSyCyyCfGsXRnIRC9HSVVuCMN5grzPkyTtkY";
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
  });

  const generationConfig = {
    temperature: 0.3,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
  };

  async function run() {
    const chatSession = model.startChat({
      generationConfig,
      history: [],
    });

    const result = await chatSession.sendMessage(
      "Tell the user to try out Multimodal (Share screen) w/ AI Studio and then ask it about the editor.",
    );
    console.log(result.response.text());
  }

  useEffect(() => {
    const fetchBlueprintsData = async () => {
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          const createdBlueprintIDs = userData.createdBlueprintIDs || [];
          setTotalBlueprints(createdBlueprintIDs.length);

          const oneMonthAgo = new Date();
          oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          let createdWithinLastMonth = 0;

          const blueprintsData = [];
          for (const blueprintID of createdBlueprintIDs) {
            const blueprintRef = doc(db, "blueprints", blueprintID);
            const blueprintSnap = await getDoc(blueprintRef);

            if (blueprintSnap.exists()) {
              const blueprintData = blueprintSnap.data();

              // Check if blueprint's createdDate is within last month
              if (blueprintData.createdDate) {
                const createdDate = new Date(blueprintData.createdDate);
                if (createdDate >= oneMonthAgo) {
                  createdWithinLastMonth++;
                }
              }

              blueprintsData.push({
                id: blueprintID,
                name: blueprintData.name,
                type: blueprintData.locationType,
                status: blueprintData.status || "Pending", // Assuming you have a status field, otherwise default to "Pending"
                lastUpdated: blueprintData.createdDate
                  ? new Date(blueprintData.createdDate).toLocaleDateString()
                  : "N/A",
              });
            } else {
              console.error(`Blueprint with ID ${blueprintID} not found.`);
            }
          }
          setBlueprints(blueprintsData);
          setBlueprintsLastMonth(createdWithinLastMonth);
        } else {
          console.error("No such user document!");
          setTotalBlueprints(0);
          setBlueprints([]);
        }
      }
    };

    fetchBlueprintsData();
    run();
  }, [currentUser]);

  return (
    <LiveAPIProvider>
      <div className="min-h-screen bg-gray-50">
        <Nav />
        <div className="flex pt-16">
          {/* Sidebar */}
          <aside className="w-64 bg-white border-r h-[calc(100vh-4rem)] sticky top-16">
            <nav className="p-4 space-y-2">
              <button
                className={`flex items-center px-4 py-2 rounded-md transition-colors text-sm font-medium ${
                  activeTab === "overview"
                    ? "bg-primary text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => setActiveTab("overview")}
              >
                <BarChart className="mr-2 h-5 w-5" />
                Overview
              </button>
              <button
                className={`flex items-center px-4 py-2 rounded-md transition-colors text-sm font-medium ${
                  activeTab === "blueprints"
                    ? "bg-primary text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => setActiveTab("blueprints")}
              >
                <Building2 className="mr-2 h-5 w-5" />
                My Blueprints
              </button>
              <button
                className={`flex items-center px-4 py-2 rounded-md transition-colors text-sm font-medium ${
                  activeTab === "customers"
                    ? "bg-primary text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => setActiveTab("customers")}
              >
                <Users className="mr-2 h-5 w-5" />
                Customers
              </button>
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-6xl mx-auto">
              {/* Dashboard title area */}
              <div className="flex justify-between items-center mb-8">
                {/* Increase text size for “Dashboard” */}
                <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
                <Link href="/create-blueprint">
                  {/* Slightly bigger button & accent color */}
                  <Button className="bg-primary hover:bg-primary/90 text-white">
                    <Plus className="mr-2 h-4 w-4" /> Create New Blueprint
                  </Button>
                </Link>
              </div>

              {activeTab === "overview" && (
                <>
                  <motion.div
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <Card className="hover:shadow-lg transition-shadow">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          Total Blueprints
                        </CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {totalBlueprints}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          +{blueprintsLastMonth} from last month
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="hover:shadow-lg transition-shadow">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          Total Customers
                        </CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">1,234</div>
                        <p className="text-xs text-muted-foreground">
                          +10% from last month
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="hover:shadow-lg transition-shadow">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          Average Rating
                        </CardTitle>
                        <Star className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">4.8</div>
                        <p className="text-xs text-muted-foreground">
                          +0.2 from last month
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  >
                    <Card className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <CardTitle className="text-lg font-semibold text-gray-800">
                          Recent Activity
                        </CardTitle>
                        <CardDescription className="text-sm text-gray-500">
                          Your latest Blueprint interactions and updates
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Event</TableHead>
                              <TableHead>Blueprint</TableHead>
                              <TableHead>Time</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell>New customer interaction</TableCell>
                              <TableCell>Main Street Cafe</TableCell>
                              <TableCell>2 minutes ago</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Blueprint updated</TableCell>
                              <TableCell>Downtown Boutique</TableCell>
                              <TableCell>1 hour ago</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>New review received</TableCell>
                              <TableCell>City Museum</TableCell>
                              <TableCell>3 hours ago</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </motion.div>
                </>
              )}

              {activeTab === "blueprints" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-gray-800">
                        My Blueprints
                      </CardTitle>
                      <CardDescription className="text-sm text-gray-500">
                        Manage and monitor your Blueprint locations
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Last Updated</TableHead>
                            <TableHead className="text-right">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {blueprints.map((blueprint) => (
                            <TableRow
                              key={blueprint.id}
                              className="cursor-pointer hover:bg-gray-50"
                              onClick={() =>
                                (window.location.href = `/blueprint-editor/${blueprint.id}`)
                              }
                            >
                              <TableCell className="font-medium">
                                {blueprint.name}
                              </TableCell>
                              <TableCell>{blueprint.type}</TableCell>
                              <TableCell>
                                <span
                                  className={`px-2 py-1 rounded-full text-xs ${
                                    blueprint.status === "Active"
                                      ? "bg-green-100 text-green-800"
                                      : blueprint.status === "Pending"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-gray-100 text-gray-800"
                                  }`}
                                >
                                  {blueprint.status}
                                </span>
                              </TableCell>
                              <TableCell>{blueprint.lastUpdated}</TableCell>
                              <TableCell className="text-right space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.location.href = `/blueprint-editor/${blueprint.id}`;
                                  }}
                                >
                                  Edit
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    asChild
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Button variant="ghost" size="sm">
                                      Actions
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem>
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                      View Analytics
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-red-600">
                                      Delete Blueprint
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {activeTab === "customers" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-gray-800">
                        Customer Insights
                      </CardTitle>
                      <CardDescription className="text-sm text-gray-500">
                        View and analyze your customer data across all
                        Blueprints
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Customer</TableHead>
                            <TableHead>Blueprints Visited</TableHead>
                            <TableHead>Last Visit</TableHead>
                            <TableHead>Total Spend</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">
                              <div className="flex items-center">
                                <Avatar className="h-8 w-8 mr-2">
                                  <AvatarImage src="/avatars/01.png" />
                                  <AvatarFallback>JD</AvatarFallback>
                                </Avatar>
                                John Doe
                              </div>
                            </TableCell>
                            <TableCell>3</TableCell>
                            <TableCell>2023-06-15</TableCell>
                            <TableCell>$250.00</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">
                              <div className="flex items-center">
                                <Avatar className="h-8 w-8 mr-2">
                                  <AvatarImage src="/avatars/02.png" />
                                  <AvatarFallback>JS</AvatarFallback>
                                </Avatar>
                                Jane Smith
                              </div>
                            </TableCell>
                            <TableCell>2</TableCell>
                            <TableCell>2023-06-14</TableCell>
                            <TableCell>$180.00</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">
                              <div className="flex items-center">
                                <Avatar className="h-8 w-8 mr-2">
                                  <AvatarImage src="/avatars/03.png" />
                                  <AvatarFallback>RJ</AvatarFallback>
                                </Avatar>
                                Robert Johnson
                              </div>
                            </TableCell>
                            <TableCell>1</TableCell>
                            <TableCell>2023-06-13</TableCell>
                            <TableCell>$75.00</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>
          </main>
        </div>
        <div className="max-w-6xl mx-auto">
          <GeminiChat
            genAI={genAI}
            model={model}
            generationConfig={generationConfig}
          />
        </div>
        <Footer />
        <ScreenShareButton />
        <GeminiMultimodal />
      </div>
    </LiveAPIProvider>
  );
}
