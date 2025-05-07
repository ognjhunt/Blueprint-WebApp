// "use client";
// import React, { useCallback, useState, useRef, useEffect } from "react";
// import ReactFlow, {
//   ReactFlowProvider,
//   addEdge,
//   MiniMap as RFMiniMap,
//   Controls,
//   Background,
//   applyNodeChanges,
//   applyEdgeChanges,
//   OnNodesChange,
//   OnEdgesChange,
//   Connection,
//   Node as RFNode,
//   Edge as RFEdge,
//   Handle,
//   Position,
// } from "reactflow";
// import { motion, AnimatePresence } from "framer-motion";
// import { db } from "@/lib/firebase";
// import {
//   doc,
//   updateDoc,
//   collection,
//   addDoc,
//   arrayUnion,
//   getDocs,
// } from "firebase/firestore";
// import "reactflow/dist/style.css";

// // ----------------------
// // TYPES & DATA
// // ----------------------
// // interface NodeType {
// //   id: string;
// //   title: string;
// //   description: string;
// //   category: "Core Nodes" | "Integrations" | "Triggers" | "AI Nodes";
// //   slug?: string;
// // }

// // interface CustomNodeData {
// //   label: string;
// //   description: string;
// //   id: string;
// // }

// export type WorkflowNode = RFNode<CustomNodeData>;
// export type WorkflowEdge = RFEdge;

// // const allNodes: NodeType[] = [
// //   {
// //     id: "website-scraper",
// //     title: "Website Scraper",
// //     description: "Scrape website data",
// //     category: "Core Nodes",
// //   },
// //   {
// //     id: "website-crawler",
// //     title: "Website Crawler",
// //     description: "Crawl website links",
// //     category: "Core Nodes",
// //   },
// //   {
// //     id: "rate-my-experience",
// //     title: "Rate My Experience",
// //     description: "Prompt user for a 1-5 star rating upon leaving",
// //     category: "Core Nodes",
// //   },
// //   {
// //     id: "quiz-node",
// //     title: "In-Store / Museum Quiz",
// //     description: "Prompt a quick quiz to engage users or offer a reward",
// //     category: "Triggers",
// //   },
// //   {
// //     id: "welcome-message",
// //     title: "Welcome Message",
// //     description: "Display a greeting or orientation on user entry",
// //     category: "Core Nodes",
// //   },
// //   {
// //     id: "promotions",
// //     title: "Promotions",
// //     description: "Display discount or special content when near a certain area",
// //     category: "Triggers",
// //   },
// //   {
// //     id: "google-sheets",
// //     title: "Google Sheets",
// //     description: "Integrate with Google Sheets",
// //     category: "Integrations",
// //   },
// //   {
// //     id: "website",
// //     title: "Website",
// //     description: "Integrate your Website",
// //     category: "Integrations",
// //   },
// //   {
// //     id: "firebase",
// //     title: "Firebase",
// //     description: "Integrate with Firebase",
// //     category: "Integrations",
// //   },
// //   {
// //     id: "on-user-action",
// //     title: "On User Action",
// //     description: "Trigger on user action",
// //     category: "Triggers",
// //   },
// //   {
// //     id: "on-timer",
// //     title: "On Timer",
// //     description: "Trigger after a countdown or on a specific day/time",
// //     category: "Triggers",
// //   },
// //   {
// //     id: "ai-node",
// //     title: "AI Node",
// //     description: "Drag AI node to process prompts",
// //     category: "AI Nodes",
// //   },
// //   {
// //     id: "ai-virtual-assistant",
// //     title: "AI Virtual Assistant Node",
// //     description: "Answer user questions or give directions in real time",
// //     category: "AI Nodes",
// //   },
// //   {
// //     id: "condition-branch",
// //     title: "Condition / Branching Node",
// //     description: "Allows if-else logic based on user data or external factors",
// //     category: "Core Nodes",
// //   },
// //   {
// //     id: "notification-messaging",
// //     title: "Notification / Messaging Node",
// //     description:
// //       "Sends email, push notifications, or SMS messages based on triggers",
// //     category: "Integrations",
// //   },
// //   {
// //     id: "smart-home-control",
// //     title: "Smart Home Control Node",
// //     description:
// //       "Integrate with HomeKit, Alexa, or Google Home to control devices",
// //     category: "Integrations",
// //   },
// //   {
// //     id: "scene-routine",
// //     title: "Scene / Routine Node",
// //     description: "Set up custom scenes or routines for home automation",
// //     category: "Core Nodes",
// //   },
// //   {
// //     id: "calendar-reminder",
// //     title: "Calendar / Reminder Node",
// //     description:
// //       "Integrates with personal calendars to show reminders or trigger workflows",
// //     category: "Triggers",
// //   },
// //   {
// //     id: "personalized-media",
// //     title: "Personalized Media Node",
// //     description:
// //       "Integrate with Spotify, Apple Music, or YouTube for custom playlists",
// //     category: "Integrations",
// //   },
// //   {
// //     id: "shared-family-board",
// //     title: "Shared Family Board Node",
// //     description: "Collaborative sticky note or to-do list board for households",
// //     category: "Core Nodes",
// //   },
// // ];

// const categories: Array<
//   "Core Nodes" | "Integrations" | "Triggers" | "AI Nodes"
// > = ["Core Nodes", "Integrations", "Triggers", "AI Nodes"];

// // ----------------------
// // COMPONENTS
// // ----------------------

// // Header Component
// const Header: React.FC = () => {
//   return (
//     <header
//       style={{
//         width: "100%",
//         padding: "16px 32px",
//         background: "linear-gradient(135deg, #007bff, #00c6ff)",
//         color: "#fff",
//         boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
//         display: "flex",
//         justifyContent: "space-between",
//         alignItems: "center",
//         position: "fixed",
//         top: 0,
//         zIndex: 1000,
//       }}
//     >
//       <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 600 }}>
//         Blueprint Workflow
//       </h1>
//       <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
//         <ThemeSelector />
//         <button
//           style={{
//             padding: "8px 12px",
//             borderRadius: "4px",
//             backgroundColor: "#fff",
//             color: "#007bff",
//             border: "none",
//             fontWeight: 500,
//             cursor: "pointer",
//             boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
//           }}
//         >
//           Add Interface
//         </button>
//         <button
//           style={{
//             padding: "8px 12px",
//             borderRadius: "4px",
//             backgroundColor: "transparent",
//             border: "1px solid #fff",
//             color: "#fff",
//             cursor: "pointer",
//           }}
//         >
//           Share
//         </button>
//       </div>
//     </header>
//   );
// };

// // Collapsible Section for Node Library
// const CollapsibleSection: React.FC<{ title: string; nodes: NodeType[] }> = ({
//   title,
//   nodes,
// }) => {
//   const [collapsed, setCollapsed] = useState(false);
//   return (
//     <div
//       style={{
//         marginBottom: "16px",
//         backgroundColor: "#fff",
//         borderRadius: "8px",
//         padding: "8px",
//         boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
//       }}
//     >
//       <div
//         onClick={() => setCollapsed(!collapsed)}
//         style={{
//           display: "flex",
//           justifyContent: "space-between",
//           alignItems: "center",
//           cursor: "pointer",
//         }}
//       >
//         <p style={{ fontSize: "14px", fontWeight: 600, margin: 0 }}>{title}</p>
//         <motion.span
//           animate={{ rotate: collapsed ? 0 : 90 }}
//           style={{ color: "#555", fontSize: "18px" }}
//         >
//           ▶
//         </motion.span>
//       </div>
//       <AnimatePresence>
//         {!collapsed && (
//           <motion.div
//             initial={{ opacity: 0, height: 0 }}
//             animate={{ opacity: 1, height: "auto" }}
//             exit={{ opacity: 0, height: 0 }}
//             style={{ marginTop: "8px" }}
//           >
//             {nodes.map((node) => (
//               <div key={node.id} style={{ marginBottom: "8px" }}>
//                 <button
//                   draggable
//                   onDragStart={(event) => {
//                     event.dataTransfer.setData(
//                       "application/reactflow",
//                       JSON.stringify(node),
//                     );
//                     event.dataTransfer.effectAllowed = "move";
//                   }}
//                   style={{
//                     width: "100%",
//                     padding: "8px 12px",
//                     backgroundColor: "#f0f4f8",
//                     border: "none",
//                     borderRadius: "6px",
//                     cursor: "pointer",
//                     fontSize: "14px",
//                   }}
//                   title={node.description}
//                 >
//                   <span>{node.title}</span>
//                   {node.category === "AI Nodes" && (
//                     <span
//                       style={{
//                         marginLeft: "8px",
//                         backgroundColor: "#ffd700",
//                         color: "#000",
//                         padding: "2px 4px",
//                         borderRadius: "4px",
//                         fontSize: "12px",
//                         fontWeight: 600,
//                       }}
//                     >
//                       PLUS
//                     </span>
//                   )}
//                 </button>
//               </div>
//             ))}
//           </motion.div>
//         )}
//       </AnimatePresence>
//     </div>
//   );
// };

// const SearchBar: React.FC<{
//   nodes: NodeType[];
//   onSelect: (node: NodeType) => void;
// }> = ({ nodes, onSelect }) => {
//   const [query, setQuery] = useState("");
//   const filteredNodes = nodes.filter((node) =>
//     node.title.toLowerCase().includes(query.toLowerCase()),
//   );
//   return (
//     <div style={{ position: "relative", marginBottom: "16px" }}>
//       <input
//         type="text"
//         placeholder="Search nodes..."
//         value={query}
//         onChange={(e) => setQuery(e.target.value)}
//         style={{
//           width: "100%",
//           padding: "10px 40px",
//           borderRadius: "6px",
//           border: "1px solid #ccc",
//           outline: "none",
//           fontSize: "14px",
//         }}
//       />
//       <span
//         style={{
//           position: "absolute",
//           left: "12px",
//           top: "50%",
//           transform: "translateY(-50%)",
//           color: "#888",
//           fontSize: "16px",
//         }}
//       >
//         🔍
//       </span>
//       {query && (
//         <button
//           onClick={() => setQuery("")}
//           style={{
//             position: "absolute",
//             right: "12px",
//             top: "50%",
//             transform: "translateY(-50%)",
//             background: "transparent",
//             border: "none",
//             color: "#888",
//             cursor: "pointer",
//             fontSize: "16px",
//           }}
//         >
//           ✖
//         </button>
//       )}
//       {query && (
//         <div
//           style={{
//             position: "absolute",
//             top: "100%",
//             left: 0,
//             background: "#fff",
//             border: "1px solid #ccc",
//             borderRadius: "6px",
//             marginTop: "4px",
//             width: "100%",
//             zIndex: 10,
//           }}
//         >
//           {filteredNodes.length > 0 ? (
//             filteredNodes.map((node) => (
//               <div
//                 key={node.id}
//                 onClick={() => {
//                   onSelect(node);
//                   setQuery("");
//                 }}
//                 style={{
//                   padding: "10px",
//                   cursor: "pointer",
//                   borderBottom: "1px solid #eee",
//                   fontSize: "14px",
//                 }}
//               >
//                 {node.title}
//               </div>
//             ))
//           ) : (
//             <div style={{ padding: "10px", color: "#999", fontSize: "14px" }}>
//               No matches found
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// };

// const NodeLibrary: React.FC<{
//   nodes: NodeType[];
//   onSelect?: (node: NodeType) => void;
// }> = ({ nodes, onSelect }) => {
//   const [query, setQuery] = useState("");
//   const filteredNodes = nodes.filter((node) =>
//     node.title.toLowerCase().includes(query.toLowerCase()),
//   );
//   return (
//     <div style={{ padding: "16px" }}>
//       {/* Search input */}
//       <input
//         type="text"
//         placeholder="Search nodes..."
//         value={query}
//         onChange={(e) => setQuery(e.target.value)}
//         style={{
//           width: "100%",
//           padding: "10px",
//           marginBottom: "16px",
//           borderRadius: "6px",
//           border: "1px solid #ccc",
//           fontSize: "14px",
//         }}
//       />

//       {/* Render each category, passing only the filtered nodes */}
//       {categories.map((category) => (
//         <CollapsibleSection
//           key={category}
//           title={category}
//           nodes={filteredNodes.filter((node) => node.category === category)}
//         />
//       ))}
//     </div>
//   );
// };

// const WorkflowCanvas: React.FC = () => {
//   const reactFlowWrapper = useRef<HTMLDivElement>(null);
//   const [nodes, setNodes] = useState<WorkflowNode[]>([]);
//   const [edges, setEdges] = useState<WorkflowEdge[]>([]);
//   const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
//   const onNodesChange: OnNodesChange = useCallback(
//     (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
//     [],
//   );
//   const onEdgesChange: OnEdgesChange = useCallback(
//     (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
//     [],
//   );
//   const onConnect = useCallback((connection: Connection) => {
//     setEdges((eds) => addEdge(connection, eds));
//   }, []);
//   const onDrop = useCallback(
//     (event: React.DragEvent<HTMLDivElement>) => {
//       event.preventDefault();
//       if (!reactFlowWrapper.current || !reactFlowInstance) return;
//       const bounds = reactFlowWrapper.current.getBoundingClientRect();
//       const data = event.dataTransfer.getData("application/reactflow");
//       if (!data) return;
//       const nodeData: NodeType = JSON.parse(data);

//       // Hard-coded for demo; ideally you'd pull from your user doc in Firestore
//       const userPlanType = "free";
//       if (userPlanType !== "plus" && nodeData.category === "AI Nodes") {
//         alert(
//           "This node is only available for PLUS users. Please upgrade to continue!",
//         );
//         return;
//       }

//       const position = reactFlowInstance.project({
//         x: event.clientX - bounds.left,
//         y: event.clientY - bounds.top,
//       });
//       let customType = "default";
//       if (nodeData.slug === "on-user-action") {
//         customType = "onUserAction";
//       } else if (nodeData.slug === "ai-node") {
//         customType = "aiNode";
//       } else if (nodeData.slug === "rate-my-experience") {
//         customType = "rateMyExperience";
//       } else if (nodeData.slug === "welcome-message") {
//         customType = "welcomeMessage";
//       } else if (nodeData.slug === "promotions") {
//         customType = "promotionsNode";
//       } else if (nodeData.slug === "digital-assistant") {
//         customType = "digitalAssistant";
//       } else if (nodeData.slug === "quiz-node") {
//         customType = "quizNode";
//       } else if (nodeData.slug === "on-timer") {
//         customType = "onTimer";
//       } else if (nodeData.slug === "condition-branch") {
//         customType = "conditionBranch";
//       } else if (nodeData.slug === "scene-routine") {
//         customType = "sceneRoutine";
//       } else if (nodeData.slug === "shared-family-board") {
//         customType = "sharedFamilyBoard";
//       } else if (nodeData.slug === "smart-home-control") {
//         customType = "smartHomeControl";
//       } else if (nodeData.slug === "personalized-media") {
//         customType = "personalizedMedia";
//       } else if (nodeData.slug === "calendar-reminder") {
//         customType = "calendarReminder";
//       } else if (nodeData.slug === "realtime-suggestions") {
//         customType = "realtimeSuggestions";
//       }
//       const newNode: WorkflowNode = {
//         id: `node_${+new Date()}`,
//         type: customType,
//         position,
//         data: {
//           label: nodeData.title,
//           description: nodeData.description,
//           // ADD THIS so you know which fixed node ID this is
//           id: nodeData.id,
//         },
//       };
//       setNodes((nds) => nds.concat(newNode));
//     },
//     [reactFlowInstance],
//   );
//   const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
//     event.preventDefault();
//     event.dataTransfer.dropEffect = "move";
//   }, []);

//   const nodeTypes = {
//     onUserAction: OnUserActionNode,
//     aiNode: AINode,
//     rateMyExperience: RateMyExperienceNode,
//     welcomeMessage: WelcomeMessageNode,
//     promotionsNode: PromotionsNode,
//     digitalAssistant: DigitalAssistantNode,
//     quizNode: QuizNode,
//     onTimer: OnTimerNode,
//     conditionBranch: ConditionBranchNode,
//     sceneRoutine: SceneRoutineNode,
//     sharedFamilyBoard: SharedFamilyBoardNode,
//     smartHomeControl: SmartHomeControlNode,
//     personalizedMedia: PersonalizedMediaNode,
//     calendarReminder: CalendarReminderNode,
//     default: undefined,
//   };

//   // ----------------------
//   // SAVE WORKFLOW FUNCTION
//   // ----------------------
//   const handleSave = async () => {
//     try {
//       // Helper to find the originalNodeId for a given ephemeral node ID
//       function getOriginalNodeId(localId: string) {
//         const found = nodes.find((n) => n.id === localId);
//         return found?.data.id || localId;
//       }

//       // Transform your ephemeral nodes into references to the original node IDs
//       const updatedNodes = nodes.map((n) => ({
//         nodeId: n.data.id, // references the doc in Firestore
//         position: n.position,
//       }));

//       // Transform edges so they reference the same original node IDs
//       const updatedEdges = edges.map((edge) => ({
//         ...edge,
//         source: getOriginalNodeId(edge.source),
//         target: getOriginalNodeId(edge.target),
//       }));

//       // Build your workflow data
//       const workflowData = {
//         nodes: updatedNodes,
//         edges: updatedEdges,
//         createdAt: new Date().toISOString(),
//         updatedAt: new Date().toISOString(),
//         blueprintId: "07ef9cea-65a4-487f-be11-0cec626201bb",
//       };

//       // Save to "workflows"
//       const workflowsRef = collection(db, "workflows");
//       const newWorkflowDoc = await addDoc(workflowsRef, workflowData);

//       // Optionally add that workflow's ID to your "blueprints" doc
//       const blueprintRef = doc(
//         db,
//         "blueprints",
//         "07ef9cea-65a4-487f-be11-0cec626201bb",
//       );
//       await updateDoc(blueprintRef, {
//         workflowIds: arrayUnion(newWorkflowDoc.id),
//       });

//       console.log("Workflow saved with ID:", newWorkflowDoc.id);
//     } catch (error) {
//       console.error("Error saving workflow:", error);
//     }
//   };

//   return (
//     <div
//       ref={reactFlowWrapper}
//       style={{
//         width: "100%",
//         height: "100%",
//         background: "linear-gradient(135deg, #f4f7f9, #e2e8f0)",
//       }}
//       onDrop={onDrop}
//       onDragOver={onDragOver}
//     >
//       <ReactFlow
//         nodes={nodes}
//         edges={edges}
//         onNodesChange={onNodesChange}
//         onEdgesChange={onEdgesChange}
//         onConnect={onConnect}
//         onInit={setReactFlowInstance}
//         snapToGrid={true}
//         snapGrid={[20, 20]}
//         nodeTypes={nodeTypes}
//       >
//         <RFMiniMap />
//         <Controls />
//         <Background gap={16} color="#eee" />
//       </ReactFlow>
//       <button
//         onClick={handleSave}
//         style={{
//           position: "absolute",
//           top: "100px",
//           right: "20px",
//           zIndex: 2000,
//           padding: "8px 16px",
//           backgroundColor: "#007bff",
//           color: "#fff",
//           border: "none",
//           borderRadius: "4px",
//           cursor: "pointer",
//         }}
//       >
//         Save Workflow
//       </button>
//     </div>
//   );
// };

// const NodeComponent: React.FC<{ node: NodeType }> = ({ node }) => {
//   const [showContext, setShowContext] = useState(false);
//   const nodeRef = useRef<HTMLDivElement>(null);
//   const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
//     e.preventDefault();
//     setShowContext(true);
//   };
//   return (
//     <div
//       ref={nodeRef}
//       style={{
//         position: "absolute",
//         top: "50px",
//         left: "50px",
//         padding: "12px",
//         backgroundColor: "#fff",
//         border: "1px solid #ddd",
//         borderRadius: "8px",
//         boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
//         // cursor: "move",
//         fontSize: "14px",
//       }}
//       onContextMenu={handleContextMenu}
//       // draggable
//       onDragStart={(e) => {
//         e.dataTransfer.setData("node", JSON.stringify(node));
//       }}
//     >
//       {node.title}
//       {showContext && (
//         <ContextMenu
//           onClose={() => setShowContext(false)}
//           position={{ x: 100, y: 100 }}
//         />
//       )}
//     </div>
//   );
// };

// const ContextMenu: React.FC<{
//   onClose: () => void;
//   position: { x: number; y: number };
// }> = ({ onClose, position }) => {
//   useEffect(() => {
//     const handleClick = () => onClose();
//     window.addEventListener("click", handleClick);
//     return () => window.removeEventListener("click", handleClick);
//   }, [onClose]);
//   return (
//     <motion.div
//       initial={{ opacity: 0 }}
//       animate={{ opacity: 1 }}
//       style={{
//         position: "absolute",
//         top: position.y,
//         left: position.x,
//         backgroundColor: "#fff",
//         border: "1px solid #ccc",
//         borderRadius: "6px",
//         padding: "8px",
//         zIndex: 1000,
//         boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
//       }}
//     >
//       <div style={{ padding: "6px 12px", cursor: "pointer", fontSize: "14px" }}>
//         Edit
//       </div>
//       <div style={{ padding: "6px 12px", cursor: "pointer", fontSize: "14px" }}>
//         Delete
//       </div>
//       <div style={{ padding: "6px 12px", cursor: "pointer", fontSize: "14px" }}>
//         Duplicate
//       </div>
//       <div style={{ padding: "6px 12px", cursor: "pointer", fontSize: "14px" }}>
//         View Details
//       </div>
//     </motion.div>
//   );
// };

// const MiniMap: React.FC<{
//   canvasRef: React.RefObject<HTMLDivElement>;
//   zoom: number;
// }> = ({ canvasRef, zoom }) => {
//   const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
//   useEffect(() => {
//     if (canvasRef.current) {
//       setDimensions({
//         width: canvasRef.current.offsetWidth,
//         height: canvasRef.current.offsetHeight,
//       });
//     }
//   }, [canvasRef, zoom]);
//   return (
//     <div
//       style={{
//         position: "absolute",
//         bottom: "16px",
//         right: "16px",
//         backgroundColor: "#fff",
//         border: "1px solid #ccc",
//         borderRadius: "6px",
//         padding: "6px",
//         fontSize: "12px",
//       }}
//     >
//       <div>MiniMap</div>
//       <div>
//         {dimensions.width} x {dimensions.height}
//       </div>
//     </div>
//   );
// };

// const ThemeSelector: React.FC = () => {
//   const themes = ["Default", "Dark", "Vibrant"];
//   const [selectedTheme, setSelectedTheme] = useState(themes[0]);
//   return (
//     <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
//       <span style={{ fontSize: "14px", color: "#fff" }}>Theme:</span>
//       <select
//         value={selectedTheme}
//         onChange={(e) => setSelectedTheme(e.target.value)}
//         style={{
//           border: "none",
//           borderRadius: "4px",
//           padding: "6px",
//           fontSize: "14px",
//           outline: "none",
//           cursor: "pointer",
//         }}
//       >
//         {themes.map((theme) => (
//           <option key={theme} value={theme}>
//             {theme}
//           </option>
//         ))}
//       </select>
//     </div>
//   );
// };

// const OnboardingModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
//   return (
//     <div
//       style={{
//         position: "fixed",
//         inset: 0,
//         backgroundColor: "rgba(0,0,0,0.4)",
//         display: "flex",
//         alignItems: "center",
//         justifyContent: "center",
//         zIndex: 1100,
//       }}
//     >
//       <div
//         style={{
//           backgroundColor: "#fff",
//           borderRadius: "8px",
//           padding: "24px",
//           maxWidth: "420px",
//           width: "90%",
//           textAlign: "center",
//           boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
//         }}
//       >
//         <h2 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "16px" }}>
//           Welcome to the Workflow Editor!
//         </h2>
//         <p style={{ marginBottom: "16px", fontSize: "15px", color: "#555" }}>
//           Drag and drop nodes, connect them, and create dynamic workflows. Enjoy
//           intuitive tooltips and guidance as you explore.
//         </p>
//         <button
//           onClick={onClose}
//           style={{
//             padding: "10px 20px",
//             borderRadius: "4px",
//             backgroundColor: "#007bff",
//             color: "#fff",
//             border: "none",
//             cursor: "pointer",
//             fontSize: "15px",
//           }}
//         >
//           Got it!
//         </button>
//       </div>
//     </div>
//   );
// };

// // ----------------------
// // CUSTOM NODE COMPONENTS
// // ----------------------

// // At the top (or near your other constants), add this:
// const locationOptions = [
//   "Blueprint",
//   "Kitchen",
//   "Bedroom",
//   "Lobby",
//   "Living Room",
//   "Basement",
//   "Office",
//   "Outdoor",
//   "Main Hall",
//   "Gift Shop",
//   "Cafe",
//   "Custom...",
// ];

// // Existing OnUserActionNode Component
// function OnUserActionNode({
//   data,
// }: {
//   data: { label: string; description: string };
// }) {
//   // We keep the same userActions but add a second piece of state for location:
//   const [selectedAction, setSelectedAction] = useState(userActions[0]);
//   const [selectedLocation, setSelectedLocation] = useState(locationOptions[0]);

//   return (
//     <div
//       style={{
//         padding: "16px",
//         border: "1px solid #e0e0e0",
//         borderRadius: "8px",
//         backgroundColor: "#fff",
//         width: "260px",
//         position: "relative",
//         boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
//       }}
//     >
//       <Handle
//         type="target"
//         position={Position.Top}
//         style={{ background: "#007bff", width: "10px", height: "10px" }}
//       />

//       <div style={{ fontWeight: 600, marginBottom: "10px", fontSize: "15px" }}>
//         {data.label}
//       </div>

//       {/* First dropdown for the Action (enters, leaves, etc.) */}
//       <div style={{ marginBottom: "10px", fontSize: "14px" }}>
//         <label style={{ marginRight: "6px" }}>Action:</label>
//         <select
//           className="nodrag"
//           value={selectedAction}
//           onChange={(e) => setSelectedAction(e.target.value)}
//           onMouseDown={(e) => e.stopPropagation()}
//           onPointerDown={(e) => e.stopPropagation()}
//           onClick={(e) => e.stopPropagation()}
//           style={{
//             padding: "6px",
//             borderRadius: "4px",
//             fontSize: "14px",
//             border: "1px solid #ccc",
//             pointerEvents: "auto",
//             width: "100%",
//           }}
//         >
//           {userActions.map((action) => (
//             <option key={action} value={action}>
//               {action}
//             </option>
//           ))}
//         </select>
//       </div>

//       {/* Second dropdown for the Location/Area */}
//       {selectedAction === "enters" && (
//         <div style={{ marginBottom: "10px", fontSize: "14px" }}>
//           <label style={{ marginRight: "6px" }}>Location/Area:</label>
//           <select
//             className="nodrag"
//             value={selectedLocation}
//             onChange={(e) => setSelectedLocation(e.target.value)}
//             onMouseDown={(e) => e.stopPropagation()}
//             onPointerDown={(e) => e.stopPropagation()}
//             onClick={(e) => e.stopPropagation()}
//             style={{
//               padding: "6px",
//               borderRadius: "4px",
//               fontSize: "14px",
//               border: "1px solid #ccc",
//               pointerEvents: "auto",
//               width: "100%",
//             }}
//           >
//             {locationOptions.map((loc) => (
//               <option key={loc} value={loc}>
//                 {loc}
//               </option>
//             ))}
//           </select>
//         </div>
//       )}

//       <Handle
//         type="source"
//         position={Position.Bottom}
//         style={{ background: "#007bff", width: "10px", height: "10px" }}
//       />
//     </div>
//   );
// }

// // NEW: AINode Component for AI Nodes
// function AINode({ data }: { data: { label: string; description: string } }) {
//   const [prompt, setPrompt] = useState("");
//   const [selectedModel, setSelectedModel] = useState("GPT-4");
//   const [outputMode, setOutputMode] = useState("Text"); // New state variable for response mode
//   const availableModels = ["GPT-4", "GPT-3.5", "DALL-E", "Custom Model"];
//   return (
//     <div
//       style={{
//         padding: "16px",
//         border: "1px solid #e0e0e0",
//         borderRadius: "8px",
//         backgroundColor: "#fff",
//         width: "260px",
//         position: "relative",
//         boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
//       }}
//     >
//       <Handle
//         type="target"
//         position={Position.Top}
//         style={{ background: "#28a745", width: "10px", height: "10px" }}
//       />
//       <div style={{ fontWeight: 600, marginBottom: "10px", fontSize: "15px" }}>
//         {data.label}
//       </div>
//       <div style={{ marginBottom: "10px", fontSize: "14px" }}>
//         <label style={{ marginRight: "6px" }}>Prompt:</label>
//         <textarea
//           className="nodrag"
//           value={prompt}
//           onChange={(e) => setPrompt(e.target.value)}
//           onMouseDown={(e) => e.stopPropagation()}
//           onPointerDown={(e) => e.stopPropagation()} // Add this line
//           onClick={(e) => e.stopPropagation()}
//           rows={3}
//           style={{
//             width: "100%",
//             marginTop: "4px",
//             padding: "6px",
//             borderRadius: "4px",
//             border: "1px solid #ccc",
//             fontSize: "14px",
//             pointerEvents: "auto", // Explicitly set this
//           }}
//           placeholder="Enter your prompt here..."
//         />
//       </div>

//       <div style={{ marginBottom: "10px", fontSize: "14px" }}>
//         <label style={{ marginRight: "6px" }}>Model:</label>
//         <select
//           className="nodrag"
//           value={selectedModel}
//           onChange={(e) => setSelectedModel(e.target.value)}
//           onMouseDown={(e) => e.stopPropagation()}
//           onPointerDown={(e) => e.stopPropagation()} // <-- ADDED
//           onClick={(e) => e.stopPropagation()}
//           style={{
//             padding: "6px",
//             borderRadius: "4px",
//             fontSize: "14px",
//             border: "1px solid #ccc",
//             pointerEvents: "auto",
//           }}
//         >
//           {availableModels.map((model) => (
//             <option key={model} value={model}>
//               {model}
//             </option>
//           ))}
//         </select>
//       </div>

//       {/* NEW: Response Mode Dropdown */}
//       <div style={{ marginBottom: "10px", fontSize: "14px" }}>
//         <label style={{ marginRight: "6px" }}>Response Mode:</label>
//         <select
//           className="nodrag"
//           value={outputMode}
//           onChange={(e) => setOutputMode(e.target.value)}
//           onMouseDown={(e) => e.stopPropagation()}
//           onPointerDown={(e) => e.stopPropagation()} // <-- ADDED
//           onClick={(e) => e.stopPropagation()}
//           style={{
//             padding: "6px",
//             borderRadius: "4px",
//             fontSize: "14px",
//             border: "1px solid #ccc",
//             pointerEvents: "auto",
//           }}
//         >
//           {["Text", "Voice"].map((option) => (
//             <option key={option} value={option}>
//               {option}
//             </option>
//           ))}
//         </select>
//       </div>

//       <Handle
//         type="source"
//         position={Position.Bottom}
//         style={{ background: "#28a745", width: "10px", height: "10px" }}
//       />
//     </div>
//   );
// }

// function PromotionsNode({
//   data,
// }: {
//   data: { label: string; description: string };
// }) {
//   const [promoMessage, setPromoMessage] = useState("");

//   return (
//     <div
//       style={{
//         padding: "16px",
//         border: "1px solid #e0e0e0",
//         borderRadius: "8px",
//         backgroundColor: "#fff",
//         width: "260px",
//         position: "relative",
//         boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
//       }}
//     >
//       <Handle
//         type="target"
//         position={Position.Top}
//         style={{ background: "#ff5722", width: "10px", height: "10px" }}
//       />
//       <div style={{ fontWeight: 600, marginBottom: "10px", fontSize: "15px" }}>
//         {data.label}
//       </div>
//       <label
//         style={{ fontSize: "14px", marginBottom: "6px", display: "block" }}
//       >
//         Promotion Message:
//       </label>
//       <textarea
//         className="nodrag"
//         rows={3}
//         value={promoMessage}
//         onChange={(e) => setPromoMessage(e.target.value)}
//         onMouseDown={(e) => e.stopPropagation()}
//         onPointerDown={(e) => e.stopPropagation()}
//         style={{
//           width: "100%",
//           padding: "6px",
//           borderRadius: "4px",
//           border: "1px solid #ccc",
//           fontSize: "14px",
//           pointerEvents: "auto",
//         }}
//         placeholder="e.g. '15% off if purchased in next 10min'"
//       />
//       <Handle
//         type="source"
//         position={Position.Bottom}
//         style={{ background: "#ff5722", width: "10px", height: "10px" }}
//       />
//     </div>
//   );
// }

// function DigitalAssistantNode({
//   data,
// }: {
//   data: { label: string; description: string };
// }) {
//   const [userQuery, setUserQuery] = useState("");
//   const [assistantResponse, setAssistantResponse] = useState("");

//   // Example: “Where can I find spinach?”
//   // In real usage, you'd integrate an AI model or custom logic here
//   const handleQuery = () => {
//     // Fake response for demonstration:
//     setAssistantResponse(`Response to: "${userQuery}" (Directions, etc.)`);
//   };

//   return (
//     <div
//       style={{
//         padding: "16px",
//         border: "1px solid #e0e0e0",
//         borderRadius: "8px",
//         backgroundColor: "#fff",
//         width: "280px",
//         position: "relative",
//         boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
//       }}
//     >
//       <Handle
//         type="target"
//         position={Position.Top}
//         style={{ background: "#9c27b0", width: "10px", height: "10px" }}
//       />
//       <div style={{ fontWeight: 600, marginBottom: "10px", fontSize: "15px" }}>
//         {data.label}
//       </div>

//       <label style={{ fontSize: "14px" }}>User Query:</label>
//       <input
//         className="nodrag"
//         type="text"
//         value={userQuery}
//         onChange={(e) => setUserQuery(e.target.value)}
//         onMouseDown={(e) => e.stopPropagation()}
//         onPointerDown={(e) => e.stopPropagation()}
//         style={{
//           width: "100%",
//           margin: "6px 0 8px",
//           padding: "6px",
//           borderRadius: "4px",
//           border: "1px solid #ccc",
//           fontSize: "14px",
//           pointerEvents: "auto",
//         }}
//         placeholder="Ask me anything..."
//       />
//       <button
//         onClick={handleQuery}
//         style={{
//           padding: "6px 12px",
//           borderRadius: "4px",
//           backgroundColor: "#9c27b0",
//           color: "#fff",
//           border: "none",
//           cursor: "pointer",
//           fontSize: "14px",
//           pointerEvents: "auto",
//         }}
//       >
//         Ask
//       </button>

//       {assistantResponse && (
//         <div
//           style={{
//             marginTop: "10px",
//             padding: "8px",
//             backgroundColor: "#f9f9f9",
//             borderRadius: "6px",
//             fontSize: "14px",
//           }}
//         >
//           {assistantResponse}
//         </div>
//       )}

//       <Handle
//         type="source"
//         position={Position.Bottom}
//         style={{ background: "#9c27b0", width: "10px", height: "10px" }}
//       />
//     </div>
//   );
// }

// function OnTimerNode({
//   data,
// }: {
//   data: { label: string; description: string };
// }) {
//   // Choose either a delayed trigger (after X minutes)
//   // OR a scheduled trigger (on specific day + time)

//   const [timerMode, setTimerMode] = useState<"delay" | "schedule">("delay");

//   // For 'delay' mode (in minutes)
//   const [delayMinutes, setDelayMinutes] = useState<number>(0);

//   // For 'schedule' mode (which day + time)
//   const [scheduledDay, setScheduledDay] = useState("Monday");
//   const [scheduledTime, setScheduledTime] = useState("16:00"); // 24-hr format

//   return (
//     <div
//       style={{
//         padding: "16px",
//         border: "1px solid #e0e0e0",
//         borderRadius: "8px",
//         backgroundColor: "#fff",
//         width: "260px",
//         position: "relative",
//         boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
//       }}
//     >
//       <Handle
//         type="target"
//         position={Position.Top}
//         style={{ background: "#ffc107", width: "10px", height: "10px" }}
//       />
//       <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "10px" }}>
//         {data.label}
//       </div>

//       {/* Timer Mode Selection */}
//       <div style={{ marginBottom: "8px", fontSize: "14px" }}>
//         <label style={{ marginRight: "8px" }}>Timer Mode:</label>
//         <select
//           className="nodrag"
//           value={timerMode}
//           onChange={(e) => setTimerMode(e.target.value as "delay" | "schedule")}
//           onMouseDown={(e) => e.stopPropagation()}
//           onPointerDown={(e) => e.stopPropagation()}
//           style={{
//             padding: "4px",
//             fontSize: "14px",
//             borderRadius: "4px",
//             border: "1px solid #ccc",
//             pointerEvents: "auto",
//           }}
//         >
//           <option value="delay">Delay After Another Trigger</option>
//           <option value="schedule">Specific Day &amp; Time</option>
//         </select>
//       </div>

//       {/* If user picks 'delay' mode */}
//       {timerMode === "delay" && (
//         <div style={{ marginBottom: "10px", fontSize: "14px" }}>
//           <label style={{ display: "block", marginBottom: "6px" }}>
//             Delay (in minutes):
//           </label>
//           <input
//             type="number"
//             className="nodrag"
//             value={delayMinutes}
//             onChange={(e) => setDelayMinutes(Number(e.target.value))}
//             onMouseDown={(e) => e.stopPropagation()}
//             onPointerDown={(e) => e.stopPropagation()}
//             style={{
//               width: "100%",
//               padding: "6px",
//               borderRadius: "4px",
//               border: "1px solid #ccc",
//               fontSize: "14px",
//               pointerEvents: "auto",
//             }}
//             placeholder="e.g. 5"
//           />
//         </div>
//       )}

//       {/* If user picks 'schedule' mode */}
//       {timerMode === "schedule" && (
//         <div style={{ marginBottom: "10px", fontSize: "14px" }}>
//           <label style={{ display: "block", marginBottom: "6px" }}>
//             Day of Week:
//           </label>
//           <select
//             className="nodrag"
//             value={scheduledDay}
//             onChange={(e) => setScheduledDay(e.target.value)}
//             onMouseDown={(e) => e.stopPropagation()}
//             onPointerDown={(e) => e.stopPropagation()}
//             style={{
//               width: "100%",
//               padding: "6px",
//               borderRadius: "4px",
//               border: "1px solid #ccc",
//               fontSize: "14px",
//               pointerEvents: "auto",
//             }}
//           >
//             {[
//               "Monday",
//               "Tuesday",
//               "Wednesday",
//               "Thursday",
//               "Friday",
//               "Saturday",
//               "Sunday",
//             ].map((day) => (
//               <option key={day} value={day}>
//                 {day}
//               </option>
//             ))}
//           </select>

//           <label
//             style={{ display: "block", marginBottom: "6px", marginTop: "10px" }}
//           >
//             Time (HH:MM):
//           </label>
//           <input
//             type="time"
//             className="nodrag"
//             value={scheduledTime}
//             onChange={(e) => setScheduledTime(e.target.value)}
//             onMouseDown={(e) => e.stopPropagation()}
//             onPointerDown={(e) => e.stopPropagation()}
//             style={{
//               width: "100%",
//               padding: "6px",
//               borderRadius: "4px",
//               border: "1px solid #ccc",
//               fontSize: "14px",
//               pointerEvents: "auto",
//             }}
//           />
//         </div>
//       )}

//       <Handle
//         type="source"
//         position={Position.Bottom}
//         style={{ background: "#ffc107", width: "10px", height: "10px" }}
//       />
//     </div>
//   );
// }

// function QuizNode({ data }: { data: { label: string; description: string } }) {
//   const [question, setQuestion] = useState("");
//   const [correctAnswer, setCorrectAnswer] = useState("");
//   const [userAnswer, setUserAnswer] = useState("");

//   const checkAnswer = () => {
//     alert(
//       userAnswer.toLowerCase() === correctAnswer.toLowerCase()
//         ? "Correct!"
//         : "Incorrect, try again!",
//     );
//   };

//   return (
//     <div
//       style={{
//         padding: "16px",
//         border: "1px solid #e0e0e0",
//         borderRadius: "8px",
//         backgroundColor: "#fff",
//         width: "260px",
//         position: "relative",
//         boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
//       }}
//     >
//       <Handle
//         type="target"
//         position={Position.Top}
//         style={{ background: "#03a9f4", width: "10px", height: "10px" }}
//       />
//       <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "10px" }}>
//         {data.label}
//       </div>

//       <label
//         style={{ marginBottom: "6px", display: "block", fontSize: "14px" }}
//       >
//         Question:
//       </label>
//       <input
//         className="nodrag"
//         type="text"
//         value={question}
//         onChange={(e) => setQuestion(e.target.value)}
//         onMouseDown={(e) => e.stopPropagation()}
//         onPointerDown={(e) => e.stopPropagation()}
//         style={{
//           width: "100%",
//           padding: "6px",
//           borderRadius: "4px",
//           border: "1px solid #ccc",
//           fontSize: "14px",
//           marginBottom: "8px",
//           pointerEvents: "auto",
//         }}
//         placeholder="e.g. 'Which painting is Picasso's earliest?'"
//       />

//       <label
//         style={{ marginBottom: "6px", display: "block", fontSize: "14px" }}
//       >
//         Correct Answer:
//       </label>
//       <input
//         className="nodrag"
//         type="text"
//         value={correctAnswer}
//         onChange={(e) => setCorrectAnswer(e.target.value)}
//         onMouseDown={(e) => e.stopPropagation()}
//         onPointerDown={(e) => e.stopPropagation()}
//         style={{
//           width: "100%",
//           padding: "6px",
//           borderRadius: "4px",
//           border: "1px solid #ccc",
//           fontSize: "14px",
//           marginBottom: "8px",
//           pointerEvents: "auto",
//         }}
//         placeholder="e.g. 'Les Demoiselles d'Avignon'"
//       />

//       <label
//         style={{ marginBottom: "6px", display: "block", fontSize: "14px" }}
//       >
//         User's Answer:
//       </label>
//       <input
//         className="nodrag"
//         type="text"
//         value={userAnswer}
//         onChange={(e) => setUserAnswer(e.target.value)}
//         onMouseDown={(e) => e.stopPropagation()}
//         onPointerDown={(e) => e.stopPropagation()}
//         style={{
//           width: "100%",
//           padding: "6px",
//           borderRadius: "4px",
//           border: "1px solid #ccc",
//           fontSize: "14px",
//           pointerEvents: "auto",
//         }}
//         placeholder="User input here"
//       />

//       <button
//         onClick={checkAnswer}
//         style={{
//           marginTop: "10px",
//           padding: "6px 12px",
//           borderRadius: "4px",
//           backgroundColor: "#03a9f4",
//           color: "#fff",
//           border: "none",
//           cursor: "pointer",
//           fontSize: "14px",
//           pointerEvents: "auto",
//         }}
//       >
//         Submit
//       </button>

//       <Handle
//         type="source"
//         position={Position.Bottom}
//         style={{ background: "#03a9f4", width: "10px", height: "10px" }}
//       />
//     </div>
//   );
// }

// // ADD THIS NEW COMPONENT
// function WelcomeMessageNode({
//   data,
// }: {
//   data: { label: string; description: string };
// }) {
//   // 1) Add local state for the message and a boolean to track editing mode
//   const [message, setMessage] = useState<string>(
//     "Welcome! Tap here for more info or a quick orientation.",
//   );
//   const [isEditing, setIsEditing] = useState<boolean>(false);

//   // 2) Double‐click handler to enter editing mode
//   const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
//     e.stopPropagation(); // Prevents triggering node drag
//     setIsEditing(true);
//   };

//   // 3) On blur, exit editing mode
//   const handleBlur = () => {
//     setIsEditing(false);
//   };

//   return (
//     <div
//       onDoubleClick={handleDoubleClick}
//       style={{
//         padding: "16px",
//         border: "1px solid #e0e0e0",
//         borderRadius: "8px",
//         backgroundColor: "#fff",
//         width: "240px",
//         position: "relative",
//         boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
//       }}
//     >
//       <Handle
//         type="target"
//         position={Position.Top}
//         style={{ background: "#17a2b8", width: "10px", height: "10px" }}
//       />
//       <div style={{ fontWeight: 600, marginBottom: "10px", fontSize: "15px" }}>
//         {data.label}
//       </div>

//       {/* Conditionally show either text or an editable textarea */}
//       {isEditing ? (
//         <textarea
//           className="nodrag"
//           value={message}
//           onChange={(e) => setMessage(e.target.value)}
//           onBlur={handleBlur}
//           autoFocus
//           onMouseDown={(e) => e.stopPropagation()}
//           onPointerDown={(e) => e.stopPropagation()}
//           rows={3}
//           style={{
//             width: "100%",
//             marginBottom: "8px",
//             padding: "6px",
//             borderRadius: "4px",
//             border: "1px solid #ccc",
//             fontSize: "14px",
//             pointerEvents: "auto",
//           }}
//         />
//       ) : (
//         <p style={{ fontSize: "14px", marginBottom: "8px" }}>{message}</p>
//       )}

//       <Handle
//         type="source"
//         position={Position.Bottom}
//         style={{ background: "#17a2b8", width: "10px", height: "10px" }}
//       />
//     </div>
//   );
// }

// function ConditionBranchNode({
//   data,
// }: {
//   data: { label: string; description: string };
// }) {
//   // Example operators; you can add more as needed
//   const operators = ["=", ">", "<", "contains"];
//   const [selectedProperty, setSelectedProperty] = useState("");
//   const [selectedOperator, setSelectedOperator] = useState(operators[0]);
//   const [comparisonValue, setComparisonValue] = useState("");

//   return (
//     <div
//       style={{
//         padding: "16px",
//         border: "1px solid #e0e0e0",
//         borderRadius: "8px",
//         backgroundColor: "#fff",
//         width: "260px",
//         position: "relative",
//         boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
//       }}
//     >
//       {/* Input handle at the top */}
//       <Handle
//         type="target"
//         position={Position.Top}
//         style={{ background: "#6c757d", width: "10px", height: "10px" }}
//       />

//       {/* Node Title */}
//       <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "10px" }}>
//         {data.label}
//       </div>

//       {/* Property Field */}
//       <div style={{ marginBottom: "8px" }}>
//         <label
//           style={{ display: "block", fontSize: "14px", marginBottom: "4px" }}
//         >
//           Property:
//         </label>
//         <input
//           className="nodrag"
//           type="text"
//           value={selectedProperty}
//           onChange={(e) => setSelectedProperty(e.target.value)}
//           onMouseDown={(e) => e.stopPropagation()}
//           onPointerDown={(e) => e.stopPropagation()}
//           style={{
//             width: "100%",
//             padding: "6px",
//             borderRadius: "4px",
//             border: "1px solid #ccc",
//             fontSize: "14px",
//             pointerEvents: "auto",
//           }}
//           placeholder="e.g. rating, userType, etc."
//         />
//       </div>

//       {/* Operator Field */}
//       <div style={{ marginBottom: "8px" }}>
//         <label
//           style={{ display: "block", fontSize: "14px", marginBottom: "4px" }}
//         >
//           Operator:
//         </label>
//         <select
//           className="nodrag"
//           value={selectedOperator}
//           onChange={(e) => setSelectedOperator(e.target.value)}
//           onMouseDown={(e) => e.stopPropagation()}
//           onPointerDown={(e) => e.stopPropagation()}
//           style={{
//             width: "100%",
//             padding: "6px",
//             borderRadius: "4px",
//             border: "1px solid #ccc",
//             fontSize: "14px",
//             pointerEvents: "auto",
//           }}
//         >
//           {operators.map((op) => (
//             <option key={op} value={op}>
//               {op}
//             </option>
//           ))}
//         </select>
//       </div>

//       {/* Comparison Value Field */}
//       <div style={{ marginBottom: "8px" }}>
//         <label
//           style={{ display: "block", fontSize: "14px", marginBottom: "4px" }}
//         >
//           Value:
//         </label>
//         <input
//           className="nodrag"
//           type="text"
//           value={comparisonValue}
//           onChange={(e) => setComparisonValue(e.target.value)}
//           onMouseDown={(e) => e.stopPropagation()}
//           onPointerDown={(e) => e.stopPropagation()}
//           style={{
//             width: "100%",
//             padding: "6px",
//             borderRadius: "4px",
//             border: "1px solid #ccc",
//             fontSize: "14px",
//             pointerEvents: "auto",
//           }}
//           placeholder="e.g. 3, 'premium', 'NYC'..."
//         />
//       </div>

//       {/* Optional: Explanatory text */}
//       <p style={{ fontSize: "12px", color: "#777", marginBottom: "8px" }}>
//         If <strong>Property</strong> <em>(Operator)</em> <strong>Value</strong>{" "}
//         is true, flow goes out the "True" handle; otherwise, "False."
//       </p>

//       {/* Two outputs: True & False */}
//       <Handle
//         type="source"
//         position={Position.Bottom}
//         id="true"
//         style={{
//           background: "#28a745",
//           width: "10px",
//           height: "10px",
//           left: "30%",
//         }}
//       >
//         <div
//           style={{
//             padding: "2px 6px",
//             backgroundColor: "#28a745",
//             color: "#fff",
//             borderRadius: "4px",
//             fontSize: "12px",
//             position: "relative",
//             top: "-24px",
//             left: "-20px",
//             pointerEvents: "none",
//           }}
//         >
//           True
//         </div>
//       </Handle>

//       <Handle
//         type="source"
//         position={Position.Bottom}
//         id="false"
//         style={{
//           background: "#dc3545",
//           width: "10px",
//           height: "10px",
//           left: "70%",
//         }}
//       >
//         <div
//           style={{
//             padding: "2px 6px",
//             backgroundColor: "#dc3545",
//             color: "#fff",
//             borderRadius: "4px",
//             fontSize: "12px",
//             position: "relative",
//             top: "-24px",
//             left: "-16px",
//             pointerEvents: "none",
//           }}
//         >
//           False
//         </div>
//       </Handle>
//     </div>
//   );
// }

// function SceneRoutineNode({
//   data,
// }: {
//   data: { label: string; description: string };
// }) {
//   const [sceneName, setSceneName] = useState("");
//   const [actions, setActions] = useState<string[]>([""]);

//   // Add a new empty action row
//   const handleAddAction = () => {
//     setActions((prev) => [...prev, ""]);
//   };

//   // Update a specific action
//   const handleActionChange = (index: number, value: string) => {
//     setActions((prev) => {
//       const updated = [...prev];
//       updated[index] = value;
//       return updated;
//     });
//   };

//   return (
//     <div
//       style={{
//         padding: "16px",
//         border: "1px solid #e0e0e0",
//         borderRadius: "8px",
//         backgroundColor: "#fff",
//         width: "280px",
//         position: "relative",
//         boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
//       }}
//     >
//       <Handle
//         type="target"
//         position={Position.Top}
//         style={{ background: "#6f42c1", width: "10px", height: "10px" }}
//       />
//       <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "10px" }}>
//         {data.label}
//       </div>

//       {/* Scene Name */}
//       <div style={{ marginBottom: "8px" }}>
//         <label
//           style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}
//         >
//           Scene / Routine Name:
//         </label>
//         <input
//           className="nodrag"
//           type="text"
//           value={sceneName}
//           onChange={(e) => setSceneName(e.target.value)}
//           onMouseDown={(e) => e.stopPropagation()}
//           onPointerDown={(e) => e.stopPropagation()}
//           style={{
//             width: "100%",
//             padding: "6px",
//             borderRadius: "4px",
//             border: "1px solid #ccc",
//             fontSize: "14px",
//             pointerEvents: "auto",
//           }}
//           placeholder="e.g. Morning Routine"
//         />
//       </div>

//       {/* Actions */}
//       <div style={{ marginBottom: "8px" }}>
//         <label
//           style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}
//         >
//           Actions (turn on lights, start coffee, etc.):
//         </label>
//         {actions.map((action, index) => (
//           <input
//             key={index}
//             className="nodrag"
//             type="text"
//             value={action}
//             onChange={(e) => handleActionChange(index, e.target.value)}
//             onMouseDown={(e) => e.stopPropagation()}
//             onPointerDown={(e) => e.stopPropagation()}
//             style={{
//               width: "100%",
//               marginBottom: "4px",
//               padding: "6px",
//               borderRadius: "4px",
//               border: "1px solid #ccc",
//               fontSize: "14px",
//               pointerEvents: "auto",
//             }}
//             placeholder="e.g. Turn on living room lights"
//           />
//         ))}
//         <button
//           onClick={handleAddAction}
//           style={{
//             marginTop: "6px",
//             padding: "6px 12px",
//             borderRadius: "4px",
//             backgroundColor: "#6f42c1",
//             color: "#fff",
//             border: "none",
//             cursor: "pointer",
//             fontSize: "14px",
//             pointerEvents: "auto",
//           }}
//         >
//           + Add Action
//         </button>
//       </div>

//       <Handle
//         type="source"
//         position={Position.Bottom}
//         style={{ background: "#6f42c1", width: "10px", height: "10px" }}
//       />
//     </div>
//   );
// }

// function SharedFamilyBoardNode({
//   data,
// }: {
//   data: { label: string; description: string };
// }) {
//   const [newItem, setNewItem] = useState("");
//   const [items, setItems] = useState<string[]>([]);

//   const addItem = () => {
//     if (!newItem.trim()) return;
//     setItems((prev) => [...prev, newItem.trim()]);
//     setNewItem("");
//   };

//   const removeItem = (index: number) => {
//     setItems((prev) => prev.filter((_, i) => i !== index));
//   };

//   return (
//     <div
//       style={{
//         padding: "16px",
//         border: "1px solid #e0e0e0",
//         borderRadius: "8px",
//         backgroundColor: "#fff",
//         width: "280px",
//         position: "relative",
//         boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
//       }}
//     >
//       <Handle
//         type="target"
//         position={Position.Top}
//         style={{ background: "#fd7e14", width: "10px", height: "10px" }}
//       />
//       <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "10px" }}>
//         {data.label}
//       </div>

//       {/* Add a new note/item */}
//       <div style={{ marginBottom: "8px" }}>
//         <label
//           style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}
//         >
//           Add Item:
//         </label>
//         <input
//           className="nodrag"
//           type="text"
//           value={newItem}
//           onChange={(e) => setNewItem(e.target.value)}
//           onMouseDown={(e) => e.stopPropagation()}
//           onPointerDown={(e) => e.stopPropagation()}
//           style={{
//             width: "100%",
//             padding: "6px",
//             borderRadius: "4px",
//             border: "1px solid #ccc",
//             fontSize: "14px",
//             pointerEvents: "auto",
//             marginBottom: "4px",
//           }}
//           placeholder="Groceries, chores, etc."
//         />
//         <button
//           onClick={addItem}
//           style={{
//             padding: "6px 12px",
//             borderRadius: "4px",
//             backgroundColor: "#fd7e14",
//             color: "#fff",
//             border: "none",
//             cursor: "pointer",
//             fontSize: "14px",
//             pointerEvents: "auto",
//           }}
//         >
//           + Add
//         </button>
//       </div>

//       {/* List of items */}
//       {items.length > 0 && (
//         <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
//           {items.map((item, i) => (
//             <li
//               key={i}
//               style={{
//                 backgroundColor: "#f8f9fa",
//                 borderRadius: "4px",
//                 padding: "6px 8px",
//                 marginBottom: "4px",
//                 display: "flex",
//                 justifyContent: "space-between",
//                 alignItems: "center",
//                 fontSize: "14px",
//               }}
//             >
//               <span>{item}</span>
//               <button
//                 onClick={() => removeItem(i)}
//                 style={{
//                   background: "transparent",
//                   border: "none",
//                   color: "#dc3545",
//                   cursor: "pointer",
//                   fontSize: "14px",
//                 }}
//               >
//                 ✖
//               </button>
//             </li>
//           ))}
//         </ul>
//       )}

//       <Handle
//         type="source"
//         position={Position.Bottom}
//         style={{ background: "#fd7e14", width: "10px", height: "10px" }}
//       />
//     </div>
//   );
// }

// function SmartHomeControlNode({
//   data,
// }: {
//   data: { label: string; description: string };
// }) {
//   const devices = [
//     "Living Room Lights",
//     "Thermostat",
//     "Door Lock",
//     "Coffee Maker",
//   ];
//   const actions = ["Turn On", "Turn Off", "Set Temperature", "Unlock", "Lock"];
//   const [selectedDevice, setSelectedDevice] = useState(devices[0]);
//   const [selectedAction, setSelectedAction] = useState(actions[0]);
//   const [parameter, setParameter] = useState(""); // e.g. temperature value

//   return (
//     <div
//       style={{
//         padding: "16px",
//         border: "1px solid #e0e0e0",
//         borderRadius: "8px",
//         backgroundColor: "#fff",
//         width: "260px",
//         position: "relative",
//         boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
//       }}
//     >
//       <Handle
//         type="target"
//         position={Position.Top}
//         style={{ background: "#20c997", width: "10px", height: "10px" }}
//       />
//       <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "10px" }}>
//         {data.label}
//       </div>

//       {/* Device Dropdown */}
//       <div style={{ marginBottom: "8px" }}>
//         <label
//           style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}
//         >
//           Device:
//         </label>
//         <select
//           className="nodrag"
//           value={selectedDevice}
//           onChange={(e) => setSelectedDevice(e.target.value)}
//           onMouseDown={(e) => e.stopPropagation()}
//           onPointerDown={(e) => e.stopPropagation()}
//           style={{
//             width: "100%",
//             padding: "6px",
//             borderRadius: "4px",
//             border: "1px solid #ccc",
//             fontSize: "14px",
//             pointerEvents: "auto",
//           }}
//         >
//           {devices.map((dev) => (
//             <option key={dev} value={dev}>
//               {dev}
//             </option>
//           ))}
//         </select>
//       </div>

//       {/* Action Dropdown */}
//       <div style={{ marginBottom: "8px" }}>
//         <label
//           style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}
//         >
//           Action:
//         </label>
//         <select
//           className="nodrag"
//           value={selectedAction}
//           onChange={(e) => setSelectedAction(e.target.value)}
//           onMouseDown={(e) => e.stopPropagation()}
//           onPointerDown={(e) => e.stopPropagation()}
//           style={{
//             width: "100%",
//             padding: "6px",
//             borderRadius: "4px",
//             border: "1px solid #ccc",
//             fontSize: "14px",
//             pointerEvents: "auto",
//           }}
//         >
//           {actions.map((act) => (
//             <option key={act} value={act}>
//               {act}
//             </option>
//           ))}
//         </select>
//       </div>

//       {/* Parameter Field (optional) */}
//       {(selectedAction === "Set Temperature" ||
//         selectedDevice === "Thermostat") && (
//         <div style={{ marginBottom: "8px" }}>
//           <label
//             style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}
//           >
//             Temperature:
//           </label>
//           <input
//             className="nodrag"
//             type="number"
//             value={parameter}
//             onChange={(e) => setParameter(e.target.value)}
//             onMouseDown={(e) => e.stopPropagation()}
//             onPointerDown={(e) => e.stopPropagation()}
//             style={{
//               width: "100%",
//               padding: "6px",
//               borderRadius: "4px",
//               border: "1px solid #ccc",
//               fontSize: "14px",
//               pointerEvents: "auto",
//             }}
//             placeholder="e.g. 72"
//           />
//         </div>
//       )}

//       <Handle
//         type="source"
//         position={Position.Bottom}
//         style={{ background: "#20c997", width: "10px", height: "10px" }}
//       />
//     </div>
//   );
// }

// function PersonalizedMediaNode({
//   data,
// }: {
//   data: { label: string; description: string };
// }) {
//   const platforms = ["Spotify", "Apple Music", "YouTube"];
//   const [selectedPlatform, setSelectedPlatform] = useState(platforms[0]);
//   const [mediaType, setMediaType] = useState("Playlist"); // or "Song", "Album"
//   const [title, setTitle] = useState("");

//   return (
//     <div
//       style={{
//         padding: "16px",
//         border: "1px solid #e0e0e0",
//         borderRadius: "8px",
//         backgroundColor: "#fff",
//         width: "260px",
//         position: "relative",
//         boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
//       }}
//     >
//       <Handle
//         type="target"
//         position={Position.Top}
//         style={{ background: "#6610f2", width: "10px", height: "10px" }}
//       />
//       <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "10px" }}>
//         {data.label}
//       </div>

//       {/* Platform Selection */}
//       <div style={{ marginBottom: "8px" }}>
//         <label
//           style={{ display: "block", fontSize: "14px", marginBottom: "4px" }}
//         >
//           Platform:
//         </label>
//         <select
//           className="nodrag"
//           value={selectedPlatform}
//           onChange={(e) => setSelectedPlatform(e.target.value)}
//           onMouseDown={(e) => e.stopPropagation()}
//           onPointerDown={(e) => e.stopPropagation()}
//           style={{
//             width: "100%",
//             padding: "6px",
//             borderRadius: "4px",
//             border: "1px solid #ccc",
//             fontSize: "14px",
//             pointerEvents: "auto",
//           }}
//         >
//           {platforms.map((pf) => (
//             <option key={pf} value={pf}>
//               {pf}
//             </option>
//           ))}
//         </select>
//       </div>

//       {/* Media Type */}
//       <div style={{ marginBottom: "8px" }}>
//         <label
//           style={{ display: "block", fontSize: "14px", marginBottom: "4px" }}
//         >
//           Media Type:
//         </label>
//         <select
//           className="nodrag"
//           value={mediaType}
//           onChange={(e) => setMediaType(e.target.value)}
//           onMouseDown={(e) => e.stopPropagation()}
//           onPointerDown={(e) => e.stopPropagation()}
//           style={{
//             width: "100%",
//             padding: "6px",
//             borderRadius: "4px",
//             border: "1px solid #ccc",
//             fontSize: "14px",
//             pointerEvents: "auto",
//           }}
//         >
//           {["Playlist", "Song", "Album"].map((type) => (
//             <option key={type} value={type}>
//               {type}
//             </option>
//           ))}
//         </select>
//       </div>

//       {/* Title / Name of playlist, song, or album */}
//       <div style={{ marginBottom: "8px" }}>
//         <label
//           style={{ display: "block", fontSize: "14px", marginBottom: "4px" }}
//         >
//           Title:
//         </label>
//         <input
//           className="nodrag"
//           type="text"
//           value={title}
//           onChange={(e) => setTitle(e.target.value)}
//           onMouseDown={(e) => e.stopPropagation()}
//           onPointerDown={(e) => e.stopPropagation()}
//           style={{
//             width: "100%",
//             padding: "6px",
//             borderRadius: "4px",
//             border: "1px solid #ccc",
//             fontSize: "14px",
//             pointerEvents: "auto",
//           }}
//           placeholder="e.g. 'Relaxing Evening Playlist'"
//         />
//       </div>

//       <Handle
//         type="source"
//         position={Position.Bottom}
//         style={{ background: "#6610f2", width: "10px", height: "10px" }}
//       />
//     </div>
//   );
// }

// function CalendarReminderNode({
//   data,
// }: {
//   data: { label: string; description: string };
// }) {
//   const [eventTitle, setEventTitle] = useState("");
//   const [date, setDate] = useState("");
//   const [time, setTime] = useState("");
//   const [reminderType, setReminderType] = useState("None");

//   return (
//     <div
//       style={{
//         padding: "16px",
//         border: "1px solid #e0e0e0",
//         borderRadius: "8px",
//         backgroundColor: "#fff",
//         width: "260px",
//         position: "relative",
//         boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
//       }}
//     >
//       <Handle
//         type="target"
//         position={Position.Top}
//         style={{ background: "#17a2b8", width: "10px", height: "10px" }}
//       />
//       <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "10px" }}>
//         {data.label}
//       </div>

//       {/* Event Title */}
//       <div style={{ marginBottom: "8px" }}>
//         <label
//           style={{ display: "block", fontSize: "14px", marginBottom: "4px" }}
//         >
//           Event Title:
//         </label>
//         <input
//           className="nodrag"
//           type="text"
//           value={eventTitle}
//           onChange={(e) => setEventTitle(e.target.value)}
//           onMouseDown={(e) => e.stopPropagation()}
//           onPointerDown={(e) => e.stopPropagation()}
//           style={{
//             width: "100%",
//             padding: "6px",
//             borderRadius: "4px",
//             border: "1px solid #ccc",
//             fontSize: "14px",
//             pointerEvents: "auto",
//           }}
//           placeholder="e.g. Doctor Appointment"
//         />
//       </div>

//       {/* Date and Time */}
//       <div style={{ marginBottom: "8px", display: "flex", gap: "6px" }}>
//         <div style={{ flex: 1 }}>
//           <label
//             style={{ display: "block", fontSize: "14px", marginBottom: "4px" }}
//           >
//             Date:
//           </label>
//           <input
//             className="nodrag"
//             type="date"
//             value={date}
//             onChange={(e) => setDate(e.target.value)}
//             onMouseDown={(e) => e.stopPropagation()}
//             onPointerDown={(e) => e.stopPropagation()}
//             style={{
//               width: "100%",
//               padding: "6px",
//               borderRadius: "4px",
//               border: "1px solid #ccc",
//               fontSize: "14px",
//               pointerEvents: "auto",
//             }}
//           />
//         </div>
//         <div style={{ flex: 1 }}>
//           <label
//             style={{ display: "block", fontSize: "14px", marginBottom: "4px" }}
//           >
//             Time:
//           </label>
//           <input
//             className="nodrag"
//             type="time"
//             value={time}
//             onChange={(e) => setTime(e.target.value)}
//             onMouseDown={(e) => e.stopPropagation()}
//             onPointerDown={(e) => e.stopPropagation()}
//             style={{
//               width: "100%",
//               padding: "6px",
//               borderRadius: "4px",
//               border: "1px solid #ccc",
//               fontSize: "14px",
//               pointerEvents: "auto",
//             }}
//           />
//         </div>
//       </div>

//       {/* Reminder Type */}
//       <div style={{ marginBottom: "8px" }}>
//         <label
//           style={{ display: "block", fontSize: "14px", marginBottom: "4px" }}
//         >
//           Reminder:
//         </label>
//         <select
//           className="nodrag"
//           value={reminderType}
//           onChange={(e) => setReminderType(e.target.value)}
//           onMouseDown={(e) => e.stopPropagation()}
//           onPointerDown={(e) => e.stopPropagation()}
//           style={{
//             width: "100%",
//             padding: "6px",
//             borderRadius: "4px",
//             border: "1px solid #ccc",
//             fontSize: "14px",
//             pointerEvents: "auto",
//           }}
//         >
//           {["None", "15 minutes before", "1 hour before", "1 day before"].map(
//             (r) => (
//               <option key={r} value={r}>
//                 {r}
//               </option>
//             ),
//           )}
//         </select>
//       </div>

//       <Handle
//         type="source"
//         position={Position.Bottom}
//         style={{ background: "#17a2b8", width: "10px", height: "10px" }}
//       />
//     </div>
//   );
// }

// // ADD THIS NEW COMPONENT
// function RateMyExperienceNode({
//   data,
// }: {
//   data: { label: string; description: string };
// }) {
//   const [rating, setRating] = React.useState<number>(0);
//   const [customMessage, setCustomMessage] = React.useState<string>("");

//   return (
//     <div
//       style={{
//         padding: "16px",
//         border: "1px solid #e0e0e0",
//         borderRadius: "8px",
//         backgroundColor: "#fff",
//         width: "240px",
//         position: "relative",
//         boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
//       }}
//     >
//       <Handle
//         type="target"
//         position={Position.Top}
//         style={{ background: "#ffc107", width: "10px", height: "10px" }}
//       />
//       <div style={{ fontWeight: 600, marginBottom: "10px", fontSize: "15px" }}>
//         {data.label}
//       </div>
//       <div style={{ marginBottom: "10px", fontSize: "14px" }}>
//         <label style={{ marginRight: "6px" }}>Star Rating:</label>
//         <select
//           className="nodrag"
//           value={rating}
//           onChange={(e) => setRating(Number(e.target.value))}
//           onMouseDown={(e) => e.stopPropagation()}
//           onPointerDown={(e) => e.stopPropagation()}
//           style={{
//             padding: "6px",
//             borderRadius: "4px",
//             fontSize: "14px",
//             border: "1px solid #ccc",
//             pointerEvents: "auto",
//             width: "100%",
//           }}
//         >
//           <option value={0}>Select rating...</option>
//           {[1, 2, 3, 4, 5].map((r) => (
//             <option key={r} value={r}>
//               {`${r} Star${r > 1 ? "s" : ""}`}
//             </option>
//           ))}
//         </select>
//       </div>
//       <div style={{ marginBottom: "10px", fontSize: "14px" }}>
//         <label style={{ display: "block", marginBottom: "6px" }}>
//           Leaving Message (Optional):
//         </label>
//         <textarea
//           className="nodrag"
//           value={customMessage}
//           onChange={(e) => setCustomMessage(e.target.value)}
//           onMouseDown={(e) => e.stopPropagation()}
//           onPointerDown={(e) => e.stopPropagation()}
//           rows={2}
//           style={{
//             width: "100%",
//             padding: "6px",
//             borderRadius: "4px",
//             border: "1px solid #ccc",
//             fontSize: "14px",
//             pointerEvents: "auto",
//           }}
//           placeholder="Customize the message shown to users leaving..."
//         />
//       </div>

//       <Handle
//         type="source"
//         position={Position.Bottom}
//         style={{ background: "#ffc107", width: "10px", height: "10px" }}
//       />
//     </div>
//   );
// }

// // ----------------------
// // MAIN EDITOR COMPONENT
// // ----------------------
// const userActions = ["enters", "leaves", "asks question"];

// const WorkflowEditor: React.FC = () => {
//   const [showOnboarding, setShowOnboarding] = useState(true);

//   const [firebaseNodes, setFirebaseNodes] = useState<NodeType[]>([]);
//   useEffect(() => {
//     const fetchNodes = async () => {
//       const nodesCollectionRef = collection(db, "nodes");
//       const snapshot = await getDocs(nodesCollectionRef);
//       const nodesData: NodeType[] = snapshot.docs.map((doc) => ({
//         id: doc.id, // use the Firebase document ID here
//         title: doc.data().title,
//         description: doc.data().description,
//         category: doc.data().category,
//         slug: doc.data().slug,
//       }));
//       setFirebaseNodes(nodesData);
//     };
//     fetchNodes();
//   }, []);

//   const handleNodeSelect = (node: NodeType) => {
//     console.log("Node selected from library:", node);
//   };

//   useEffect(() => {
//     addSlugsToNodes(); // call once, then comment out
//   }, []);

//   async function seedNodes() {
//     const nodesCollectionRef = collection(db, "nodes");
//     const snapshot = await getDocs(nodesCollectionRef);
//     if (snapshot.empty) {
//       for (const node of allNodes) {
//         const docRef = await addDoc(nodesCollectionRef, {
//           title: node.title,
//           description: node.description,
//           category: node.category,
//           // any other fields you want
//         });
//         console.log("Added node with ID:", docRef.id);
//       }
//     } else {
//       console.log("Nodes collection already seeded");
//     }
//   }

//   async function addSlugsToNodes() {
//     const legacyNodes = [
//       {
//         oldId: "website-scraper",
//         title: "Website Scraper",
//         description: "Scrape website data",
//         category: "Core Nodes",
//       },
//       {
//         oldId: "website-crawler",
//         title: "Website Crawler",
//         description: "Crawl website links",
//         category: "Core Nodes",
//       },
//       {
//         oldId: "rate-my-experience",
//         title: "Rate My Experience",
//         description: "Prompt user for a 1-5 star rating upon leaving",
//         category: "Core Nodes",
//       },
//       {
//         oldId: "quiz-node",
//         title: "In-Store / Museum Quiz",
//         description: "Prompt a quick quiz to engage users or offer a reward",
//         category: "Triggers",
//       },
//       {
//         oldId: "welcome-message",
//         title: "Welcome Message",
//         description: "Display a greeting or orientation on user entry",
//         category: "Core Nodes",
//       },
//       {
//         oldId: "promotions",
//         title: "Promotions",
//         description:
//           "Display discount or special content when near a certain area",
//         category: "Triggers",
//       },
//       {
//         oldId: "google-sheets",
//         title: "Google Sheets",
//         description: "Integrate with Google Sheets",
//         category: "Integrations",
//       },
//       {
//         oldId: "website",
//         title: "Website",
//         description: "Integrate your Website",
//         category: "Integrations",
//       },
//       {
//         oldId: "firebase",
//         title: "Firebase",
//         description: "Integrate with Firebase",
//         category: "Integrations",
//       },
//       {
//         oldId: "on-user-action",
//         title: "On User Action",
//         description: "Trigger on user action",
//         category: "Triggers",
//       },
//       {
//         oldId: "on-timer",
//         title: "On Timer",
//         description: "Trigger after a countdown or on a specific day/time",
//         category: "Triggers",
//       },
//       {
//         oldId: "ai-node",
//         title: "AI Node",
//         description: "Drag AI node to process prompts",
//         category: "AI Nodes",
//       },
//       {
//         oldId: "digital-assistant",
//         title: "Digital Assistant Node",
//         description: "Answer user questions or give directions in real time",
//         category: "AI Nodes",
//       },
//       {
//         oldId: "condition-branch",
//         title: "Condition / Branching Node",
//         description:
//           "Allows if-else logic based on user data or external factors",
//         category: "Core Nodes",
//       },
//       {
//         oldId: "notification-messaging",
//         title: "Notification / Messaging Node",
//         description:
//           "Sends email, push notifications, or SMS messages based on triggers",
//         category: "Integrations",
//       },
//       {
//         oldId: "smart-home-control",
//         title: "Smart Home Control Node",
//         description:
//           "Integrate with HomeKit, Alexa, or Google Home to control devices",
//         category: "Integrations",
//       },
//       {
//         oldId: "scene-routine",
//         title: "Scene / Routine Node",
//         description: "Set up custom scenes or routines for home automation",
//         category: "Core Nodes",
//       },
//       {
//         oldId: "calendar-reminder",
//         title: "Calendar / Reminder Node",
//         description:
//           "Integrates with personal calendars to show reminders or trigger workflows",
//         category: "Triggers",
//       },
//       {
//         oldId: "personalized-media",
//         title: "Personalized Media Node",
//         description:
//           "Integrate with Spotify, Apple Music, or YouTube for custom playlists",
//         category: "Integrations",
//       },
//       {
//         oldId: "shared-family-board",
//         title: "Shared Family Board Node",
//         description:
//           "Collaborative sticky note or to-do list board for households",
//         category: "Core Nodes",
//       },
//     ];

//     const nodesCollectionRef = collection(db, "nodes");
//     const snapshot = await getDocs(nodesCollectionRef);

//     for (const docSnap of snapshot.docs) {
//       const data = docSnap.data();
//       const match = legacyNodes.find((n) => n.title === data.title);
//       if (match) {
//         console.log("Updating doc:", docSnap.id, "with slug:", match.oldId);
//         await updateDoc(docSnap.ref, { slug: match.oldId });
//       }
//     }
//   }

//   return (
//     <ReactFlowProvider>
//       <div
//         style={{
//           display: "flex",
//           width: "100%",
//           height: "100vh",
//           backgroundColor: "#f4f7f9",
//         }}
//       >
//         {/* Sidebar */}
//         <aside
//           style={{
//             width: "280px",
//             paddingTop: "80px",
//             backgroundColor: "#fff",
//             borderRight: "1px solid #e0e0e0",
//             overflowY: "auto",
//             boxShadow: "2px 0 6px rgba(0,0,0,0.05)",
//           }}
//         >
//           <div style={{ padding: "24px" }}>
//             <h2
//               style={{
//                 fontSize: "18px",
//                 fontWeight: 600,
//                 marginBottom: "16px",
//               }}
//             >
//               Node Library
//             </h2>
//             {/* ADD THIS SEARCH STATE + INPUT */}
//             {/*
//               1) track the query
//               2) filter the main firebaseNodes
//               3) pass filtered results to each category
//             */}
//             {(() => {
//               const [searchQuery, setSearchQuery] = useState("");
//               const filteredNodes = firebaseNodes.filter((node) =>
//                 node.title.toLowerCase().includes(searchQuery.toLowerCase()),
//               );

//               return (
//                 <>
//                   <input
//                     type="text"
//                     placeholder="Search nodes..."
//                     value={searchQuery}
//                     onChange={(e) => setSearchQuery(e.target.value)}
//                     style={{
//                       width: "100%",
//                       padding: "10px",
//                       marginBottom: "16px",
//                       borderRadius: "6px",
//                       border: "1px solid #ccc",
//                       fontSize: "14px",
//                     }}
//                   />

//                   {categories.map((category) => (
//                     <CollapsibleSection
//                       key={category}
//                       title={category}
//                       nodes={filteredNodes.filter(
//                         (node) => node.category === category,
//                       )}
//                     />
//                   ))}
//                 </>
//               );
//             })()}
//           </div>
//         </aside>
//         {/* Main Content */}
//         <main style={{ flexGrow: 1, position: "relative", paddingTop: "80px" }}>
//           <Header />
//           <div style={{ height: "calc(100% - 80px)", marginTop: "16px" }}>
//             <WorkflowCanvas />
//           </div>
//         </main>
//         <AnimatePresence>
//           {showOnboarding && (
//             <OnboardingModal onClose={() => setShowOnboarding(false)} />
//           )}
//         </AnimatePresence>
//       </div>
//     </ReactFlowProvider>
//   );
// };

// export default WorkflowEditor;
