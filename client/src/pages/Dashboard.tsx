"use client";

import { useState, useEffect } from "react";
import GeminiMultimodal from "@/components/GeminiMultimodal";
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

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const { currentUser } = useAuth();
  const [totalBlueprints, setTotalBlueprints] = useState(0);
  const [blueprints, setBlueprints] = useState<any[]>([]);

  useEffect(() => {
    const fetchBlueprintsData = async () => {
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          const createdBlueprintIDs = userData.createdBlueprintIDs || [];
          setTotalBlueprints(createdBlueprintIDs.length);

          const blueprintsData = [];
          for (const blueprintID of createdBlueprintIDs) {
            const blueprintRef = doc(db, "blueprints", blueprintID);
            const blueprintSnap = await getDoc(blueprintRef);

            if (blueprintSnap.exists()) {
              const blueprintData = blueprintSnap.data();
              blueprintsData.push({
                id: blueprintID,
                name: blueprintData.name,
                type: blueprintData.businessType,
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
        } else {
          console.error("No such user document!");
          setTotalBlueprints(0);
          setBlueprints([]);
        }
      }
    };

    fetchBlueprintsData();
  }, [currentUser]);

  return (
    <div className="min-h-screen bg-gray-100">
      <Nav />
      <div className="flex pt-16">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r h-[calc(100vh-4rem)] sticky top-16">
          <nav className="p-4 space-y-2">
            <button
              className={`flex w-full items-center px-4 py-2 rounded-lg transition-colors ${
                activeTab === "overview"
                  ? "bg-primary text-white"
                  : "hover:bg-gray-100"
              }`}
              onClick={() => setActiveTab("overview")}
            >
              <BarChart className="mr-3 h-5 w-5" />
              Overview
            </button>
            <button
              className={`flex w-full items-center px-4 py-2 rounded-lg transition-colors ${
                activeTab === "blueprints"
                  ? "bg-primary text-white"
                  : "hover:bg-gray-100"
              }`}
              onClick={() => setActiveTab("blueprints")}
            >
              <Building2 className="mr-3 h-5 w-5" />
              My Blueprints
            </button>
            <button
              className={`flex w-full items-center px-4 py-2 rounded-lg transition-colors ${
                activeTab === "customers"
                  ? "bg-primary text-white"
                  : "hover:bg-gray-100"
              }`}
              onClick={() => setActiveTab("customers")}
            >
              <Users className="mr-3 h-5 w-5" />
              Customers
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <Link href="/create-blueprint">
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Create New Blueprint
                </Button>
              </Link>
            </div>

            {activeTab === "overview" && (
              <>
                {/* Overview cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total Blueprints
                      </CardTitle>
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {totalBlueprints}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        +1 from last month
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total Customers
                      </CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">1,234</div>
                      <p className="text-xs text-muted-foreground">
                        +10% from last month
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total Sales
                      </CardTitle>
                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">$12,345</div>
                      <p className="text-xs text-muted-foreground">
                        +15% from last month
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Average Rating
                      </CardTitle>
                      <Star className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">4.8</div>
                      <p className="text-xs text-muted-foreground">
                        +0.2 from last month
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent activity */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>
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
              </>
            )}

            {activeTab === "blueprints" && (
              <Card>
                <CardHeader>
                  <CardTitle>My Blueprints</CardTitle>
                  <CardDescription>
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
                        <TableHead className="text-right">Actions</TableHead>
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
            )}

            {activeTab === "customers" && (
              <Card>
                <CardHeader>
                  <CardTitle>Customer Insights</CardTitle>
                  <CardDescription>
                    View and analyze your customer data across all Blueprints
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
            )}
          </div>
        </main>
      </div>
      <Footer />
      <ScreenShareButton /> {/* Add this line here */}
      // Add this to your JSX, right before the closing div:
      <GeminiMultimodal />
    </div>
  );
}
