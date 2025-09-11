"use client";

import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  Timestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  ChevronRight,
  Clock,
  Calendar,
  GitBranch,
  LayoutGrid,
  List,
  X,
  ArrowUpRight,
  Zap,
  Shuffle,
  BarChart4,
  Workflow,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface Flow {
  id: string;
  name: string;
  createdAt?: number;
  updatedAt?: number;
}

export default function WorkflowHub() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [location, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Fetch existing flows from Firestore
  useEffect(() => {
    const fetchFlows = async () => {
      try {
        setIsLoading(true);
        const flowsCollection = query(
          collection(db, "flows"),
          orderBy("updatedAt", "desc"),
        );
        const snapshot = await getDocs(flowsCollection);
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Flow[];
        setFlows(docs);
      } catch (error) {
        console.error("Error fetching flows:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFlows();
  }, []);

  // Filter flows by search
  const filteredFlows = flows.filter((flow) =>
    flow.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Create a new flow in Firestore, then navigate to editor
  const handleNewFlow = async () => {
    try {
      const timestamp = Timestamp.now().toMillis();
      const newFlowDoc = await addDoc(collection(db, "flows"), {
        name: "Untitled Flow",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      setLocation(`/workflow-editor/${newFlowDoc.id}`);
    } catch (error) {
      console.error("Error creating new flow:", error);
    }
  };

  // Format date for display
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "Unknown date";
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 },
  };

  // Features for the hero section
  const features = [
    {
      id: "feature1",
      icon: <Zap className="w-6 h-6 text-indigo-400" />,
      title: "Rapid Deployment",
      description: "Create and deploy workflows within minutes",
    },
    {
      id: "feature2",
      icon: <Shuffle className="w-6 h-6 text-blue-400" />,
      title: "Easy Integration",
      description: "Seamlessly connect with your existing systems",
    },
    {
      id: "feature3",
      icon: <BarChart4 className="w-6 h-6 text-purple-400" />,
      title: "Real-time Analytics",
      description: "Monitor and optimize your workflow performance",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Redesigned Hero Section - Modern, Clean and Professional */}
      <div className="relative overflow-hidden bg-gradient-to-r from-gray-900 via-indigo-950 to-gray-900">
        {/* Subtle animated gradient overlay */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[url('/images/grid-pattern.svg')] bg-repeat opacity-20"></div>
          <motion.div
            className="absolute top-0 -right-[30%] w-[80%] h-[100%] rounded-full bg-gradient-to-r from-indigo-500/20 to-blue-500/20 blur-3xl"
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.15, 0.2, 0.15],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              repeatType: "reverse",
            }}
          />
          <motion.div
            className="absolute -bottom-[30%] -left-[30%] w-[80%] h-[100%] rounded-full bg-gradient-to-r from-violet-500/20 to-indigo-500/20 blur-3xl"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.15, 0.25, 0.15],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              repeatType: "reverse",
              delay: 2,
            }}
          />
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="flex flex-col md:flex-row items-center">
            {/* Left content */}
            <div className="md:w-1/2 text-center md:text-left">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center px-3 py-1 mb-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Blueprint Workflow Engine
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight"
              >
                Workflow Hub
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-xl text-indigo-100 mb-8 max-w-lg md:pr-8"
              >
                Design, automate, and optimize your business processes with our
                intuitive workflow engine.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-wrap gap-4 justify-center md:justify-start"
              >
                <button
                  onClick={handleNewFlow}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-medium rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 flex items-center"
                >
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </button>
                <button className="px-6 py-3 bg-white/10 hover:bg-white/15 backdrop-blur-sm text-white border border-indigo-400/30 font-medium rounded-lg transition-all duration-200 transform hover:scale-105">
                  Watch Demo
                </button>
              </motion.div>
            </div>

            {/* Right content - workflow abstract visualization */}
            <div className="md:w-1/2 mt-10 md:mt-0">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="relative mx-auto md:ml-auto max-w-md"
              >
                <div className="relative bg-gradient-to-br from-indigo-900/60 to-gray-900/60 backdrop-blur-sm rounded-2xl p-6 border border-indigo-500/20 shadow-2xl">
                  {/* Workflow visualization */}
                  <div className="relative h-60 flex items-center justify-center">
                    <div className="absolute left-0 top-1/4 w-12 h-12 rounded-xl bg-indigo-600/80 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                        />
                      </svg>
                    </div>

                    {/* Connecting lines */}
                    <svg
                      className="absolute inset-0 w-full h-full"
                      viewBox="0 0 200 200"
                    >
                      <motion.path
                        d="M30 80 L100 80 L100 120 L170 120"
                        stroke="url(#gradient1)"
                        strokeWidth="2"
                        fill="none"
                        strokeDasharray="200"
                        initial={{ strokeDashoffset: 200 }}
                        animate={{ strokeDashoffset: 0 }}
                        transition={{ duration: 2, delay: 0.5 }}
                      />
                      <motion.path
                        d="M100 80 L100 40 L170 40"
                        stroke="url(#gradient2)"
                        strokeWidth="2"
                        fill="none"
                        strokeDasharray="200"
                        initial={{ strokeDashoffset: 200 }}
                        animate={{ strokeDashoffset: 0 }}
                        transition={{ duration: 1.5, delay: 0.8 }}
                      />
                      <defs>
                        <linearGradient
                          id="gradient1"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="0%"
                        >
                          <stop offset="0%" stopColor="#6366F1" />
                          <stop offset="100%" stopColor="#3B82F6" />
                        </linearGradient>
                        <linearGradient
                          id="gradient2"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="0%"
                        >
                          <stop offset="0%" stopColor="#6366F1" />
                          <stop offset="100%" stopColor="#8B5CF6" />
                        </linearGradient>
                      </defs>
                    </svg>

                    <div className="absolute right-0 top-1/5 w-12 h-12 rounded-xl bg-blue-500/80 flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>

                    <div className="absolute right-0 bottom-1/5 w-12 h-12 rounded-xl bg-purple-500/80 flex items-center justify-center shadow-lg shadow-purple-500/20">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </div>

                    {/* Central node */}
                    <motion.div
                      className="w-16 h-16 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 z-10"
                      animate={{
                        boxShadow: [
                          "0 0 10px rgba(99, 102, 241, 0.5)",
                          "0 0 20px rgba(99, 102, 241, 0.7)",
                          "0 0 10px rgba(99, 102, 241, 0.5)",
                        ],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        repeatType: "reverse",
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-8 w-8 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                    </motion.div>
                  </div>

                  <div className="mt-4 flex justify-between items-center text-indigo-100 text-sm font-medium">
                    <div>Blueprint Workflow</div>
                    <div className="px-2 py-1 bg-indigo-500/20 rounded-md text-xs">
                      Connected
                    </div>
                  </div>
                </div>

                {/* Floating elements */}
                <motion.div
                  className="absolute -top-5 -right-5 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 backdrop-blur-sm rounded-full z-10"
                  animate={{
                    y: [0, -10, 0],
                    opacity: [0.5, 0.7, 0.5],
                  }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    repeatType: "reverse",
                  }}
                />
                <motion.div
                  className="absolute -bottom-8 -left-8 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 backdrop-blur-sm rounded-full z-0"
                  animate={{
                    y: [0, 10, 0],
                    opacity: [0.4, 0.6, 0.4],
                  }}
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    repeatType: "reverse",
                    delay: 1,
                  }}
                />
              </motion.div>
            </div>
          </div>

          {/* Features section */}
          <motion.div
            className="mt-16 md:mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10"
            variants={container}
            initial="hidden"
            animate="show"
          >
            {features.map((feature) => (
              <motion.div
                key={feature.id}
                variants={item}
                className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-indigo-500/20 shadow-lg"
              >
                <div className="bg-gradient-to-br from-indigo-600/20 to-indigo-800/20 backdrop-blur-sm w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-indigo-200 text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Wave divider */}
        <div className="relative h-16 z-10">
          <svg
            className="absolute bottom-0 left-0 w-full text-white fill-current"
            viewBox="0 0 1440 100"
            preserveAspectRatio="none"
          >
            <path d="M0,96L40,90.7C80,85,160,75,240,64C320,53,400,43,480,48C560,53,640,75,720,80C800,85,880,75,960,64C1040,53,1120,43,1200,42.7C1280,43,1360,53,1400,58.7L1440,64L1440,100L1400,100C1360,100,1280,100,1200,100C1120,100,1040,100,960,100C880,100,800,100,720,100C640,100,560,100,480,100C400,100,320,100,240,100C160,100,80,100,40,100L0,100Z"></path>
          </svg>
        </div>
      </div>

      {/* Main Content - Keeping original flow display functionality */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        {/* Controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 space-y-4 md:space-y-0">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="relative flex-1 max-w-lg"
          >
            <div
              className={`relative rounded-lg shadow-sm ${isSearchFocused ? "ring-2 ring-indigo-500" : ""}`}
            >
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-0 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Search workflows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <X className="h-5 w-5 text-gray-400 hover:text-gray-500" />
                </button>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex space-x-4"
          >
            <div className="flex items-center rounded-lg bg-white dark:bg-gray-700 shadow-sm border border-gray-200">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 ${
                  viewMode === "grid"
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-gray-500 dark:text-gray-300"
                }`}
              >
                <LayoutGrid className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 ${
                  viewMode === "list"
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-gray-500 dark:text-gray-300"
                }`}
              >
                <List className="h-5 w-5" />
              </button>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNewFlow}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Flow
            </motion.button>
          </motion.div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredFlows.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center"
          >
            <div className="mx-auto h-20 w-20 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
              <GitBranch className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
              No workflows found
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {searchQuery
                ? "Try adjusting your search terms"
                : "Get started by creating your first workflow"}
            </p>
            {!searchQuery && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleNewFlow}
                className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Workflow
              </motion.button>
            )}
          </motion.div>
        )}

        {/* Grid View */}
        {!isLoading && viewMode === "grid" && filteredFlows.length > 0 && (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredFlows.map((flow) => (
              <motion.div
                key={flow.id}
                variants={item}
                whileHover={{
                  y: -4,
                  boxShadow:
                    "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                }}
                className="group bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:border-indigo-200 transition-all duration-200"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                      {flow.name}
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300">
                      Flow
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 truncate">
                    ID: {flow.id}
                  </p>
                  <div className="mt-4 flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center">
                      <Calendar className="mr-1 h-4 w-4" />
                      <span>Created: {formatDate(flow.createdAt)}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="mr-1 h-4 w-4" />
                      <span>Updated: {formatDate(flow.updatedAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="px-6 pb-6 pt-2 flex justify-end">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setLocation(`/workflow-editor/${flow.id}`)}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 border border-indigo-200 hover:border-indigo-300 dark:border-indigo-700 dark:hover:border-indigo-600"
                  >
                    Open
                    <ArrowUpRight className="ml-1 h-4 w-4" />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* List View */}
        {!isLoading && viewMode === "list" && filteredFlows.length > 0 && (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="bg-white dark:bg-gray-800 overflow-hidden rounded-lg shadow-sm border border-gray-100"
          >
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredFlows.map((flow) => (
                <motion.li
                  key={flow.id}
                  variants={item}
                  className="group hover:bg-gray-50 dark:hover:bg-gray-750"
                >
                  <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                          {flow.name}
                        </h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300">
                          Flow
                        </span>
                      </div>
                      <div className="mt-1 flex items-center text-xs text-gray-500 dark:text-gray-400 space-x-4">
                        <p className="truncate">ID: {flow.id}</p>
                        <div className="flex items-center">
                          <Calendar className="mr-1 h-3 w-3" />
                          <span>{formatDate(flow.createdAt)}</span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="mr-1 h-3 w-3" />
                          <span>{formatDate(flow.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setLocation(`/workflow-editor/${flow.id}`)}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 border border-indigo-200 hover:border-indigo-300 dark:border-indigo-700 dark:hover:border-indigo-600"
                    >
                      Open
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </motion.button>
                  </div>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </main>
    </div>
  );
}
