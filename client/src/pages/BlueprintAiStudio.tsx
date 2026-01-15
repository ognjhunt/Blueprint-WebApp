"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { withCsrfHeader } from "@/lib/csrf";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Sparkles,
  Bot,
  Cloud,
  Database,
  Plug,
  Workflow,
  ShieldCheck,
  RefreshCcw,
  ArrowUpRight,
  Share2,
  Layers,
  Settings2,
  CheckCircle2,
  Loader2,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SourceReference = {
  title: string;
  url: string;
  snippet?: string;
  distance?: number | null;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: SourceReference[];
  fromCache?: boolean;
  model?: string | null;
};

type ConnectorConfig = {
  id: string;
  name: string;
  description: string;
  recommended?: boolean;
};

type FunctionCapability = {
  id: string;
  name: string;
  description: string;
};

const aiProviders = [
  {
    id: "meta",
    name: "Meta Wearables Co-Pilot",
    subtitle: "Optimized for Device Access Toolkit",
    description:
      "Streams headset context, spatial anchors, and on-device guardrails straight into the Meta runtime.",
    badge: "Recommended",
  },
  {
    id: "openai",
    name: "OpenAI GPT-4o",
    subtitle: "Bring existing Assistants",
    description:
      "Blend your OpenAI Assistants with Blueprint routing so returning users keep the same brain across surfaces.",
  },
  {
    id: "glean",
    name: "Glean KnowledgeOps",
    subtitle: "Enterprise search & compliance",
    description:
      "Pipe Glean answers directly into wearable sessions with automatic entitlement checks per location.",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude 3.5",
    subtitle: "High context reasoning",
    description:
      "Ideal for complex SOPs, training material, and regulated responses that require long-form reasoning.",
  },
];

const connectorCatalog: ConnectorConfig[] = [
  {
    id: "blueprintAssets",
    name: "Blueprint Asset Library",
    description:
      "Anchors, QR codes, spatial notes, and scene metadata created during your mapping session.",
    recommended: true,
  },
  {
    id: "googleDrive",
    name: "Google Drive",
    description:
      "Surface SOPs, menus, and onboarding decks stored in shared drives.",
  },
  {
    id: "microsoftOneDrive",
    name: "Microsoft OneDrive",
    description:
      "Sync operational checklists from Microsoft 365 tenants via WorkOS Files.",
  },
  {
    id: "dropbox",
    name: "Dropbox",
    description:
      "Pull signage decks and merchandising guides without duplicating uploads.",
  },
  {
    id: "notion",
    name: "Notion HQ",
    description:
      "Expose runbooks, shift notes, and launch checklists from Notion pages.",
  },
  {
    id: "sharepoint",
    name: "SharePoint",
    description:
      "Access compliance binders and facility documentation managed by IT.",
  },
];

const functionCatalog: FunctionCapability[] = [
  {
    id: "deviceHandOff",
    name: "Device hand-off & escalation",
    description:
      "Escalate from a wearable session to live staff, kiosk, or mobile app with context preserved.",
  },
  {
    id: "inventoryLookups",
    name: "Inventory & sensor lookups",
    description:
      "Query mapped IoT sensors, stock counts, and maintenance timers directly from the headset.",
  },
  {
    id: "guidedTours",
    name: "Guided tour scheduling",
    description:
      "Allow guests to reserve demos, tours, or table service through your connected calendar systems.",
  },
  {
    id: "knowledgeGuardrails",
    name: "Knowledge guardrails",
    description:
      "Enforce location-specific disclaimers, safety notes, and policy-aware responses before answers ship.",
  },
];

const integrationVendors = [
  {
    id: "metaToolkit",
    name: "Meta Wearables Device Access Toolkit",
    status: "Live",
    description:
      "Deploy headset actions, spatial anchors, and voice intents that follow Meta's latest access policies.",
  },
  {
    id: "openai",
    name: "OpenAI Assistants",
    status: "Connected",
    description:
      "Route to your existing Assistants API projects with Blueprint guardrails on top.",
  },
  {
    id: "glean",
    name: "Glean Enterprise Search",
    status: "Connected",
    description:
      "Respect enterprise entitlements while giving the AI co-pilot instant access to curated knowledge.",
  },
  {
    id: "vertex",
    name: "Google Vertex Extensions",
    status: "Ready",
    description:
      "Publish Vertex function calls as reusable automation blocks for headset flows.",
  },
  {
    id: "microsoftGraph",
    name: "Microsoft Graph (via WorkOS)",
    status: "Ready",
    description:
      "Leverage OneDrive, SharePoint, and Teams data through a single WorkOS Files connection.",
  },
];

const personaOptions = [
  "Operations Concierge",
  "Retail Associate",
  "Venue Host",
  "Facilities Supervisor",
];

export default function BlueprintAiStudio() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedProviderId, setSelectedProviderId] = useState<string>("meta");
  const [selectedPersona, setSelectedPersona] = useState<string>(
    personaOptions[0],
  );
  const [connectorState, setConnectorState] = useState<Record<string, boolean>>(
    () =>
      connectorCatalog.reduce(
        (acc, connector) => {
          acc[connector.id] =
            connector.id === "blueprintAssets" ||
            connector.id === "googleDrive";
          return acc;
        },
        {} as Record<string, boolean>,
      ),
  );
  const [functionState, setFunctionState] = useState<Record<string, boolean>>(
    () =>
      functionCatalog.reduce(
        (acc, capability) => {
          acc[capability.id] =
            capability.id === "knowledgeGuardrails" ||
            capability.id === "deviceHandOff";
          return acc;
        },
        {} as Record<string, boolean>,
      ),
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Welcome to the Meta Wearables AI Studio. I'm ready to test Device Access Toolkit actions using your current connectors.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [playgroundInput, setPlaygroundInput] = useState(
    "Ask how the AI should greet guests in the lobby.",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [blueprintName, setBlueprintName] = useState<string>("");
  const [isLoadingBlueprint, setIsLoadingBlueprint] = useState(true);

  const blueprintId = useMemo(() => {
    const segments = location.split("/").filter(Boolean);
    return segments.length >= 2 ? segments[1] : null;
  }, [location]);

  useEffect(() => {
    const fetchBlueprint = async () => {
      if (!blueprintId || !db) {
        setIsLoadingBlueprint(false);
        return;
      }

      try {
        const blueprintRef = doc(db, "blueprints", blueprintId);
        const snapshot = await getDoc(blueprintRef);
        if (snapshot.exists()) {
          const data = snapshot.data();
          setBlueprintName((data?.name as string) || "");
        }
      } catch (error) {
        console.error("Failed to load blueprint", error);
      } finally {
        setIsLoadingBlueprint(false);
      }
    };

    fetchBlueprint();
  }, [blueprintId]);

  const selectedProvider = aiProviders.find(
    (provider) => provider.id === selectedProviderId,
  );

  const connectedCount = useMemo(
    () => Object.values(connectorState).filter(Boolean).length,
    [connectorState],
  );

  const enabledFunctionCount = useMemo(
    () => Object.values(functionState).filter(Boolean).length,
    [functionState],
  );

  const handleConnectorToggle = (
    connector: ConnectorConfig,
    value: boolean,
  ) => {
    setConnectorState((prev) => ({ ...prev, [connector.id]: value }));
    toast({
      title: value
        ? `${connector.name} connected`
        : `${connector.name} disconnected`,
      description: value
        ? "The AI will now reference this source when serving wearable sessions."
        : "Access revoked. Wearable prompts will ignore this source until re-enabled.",
    });
  };

  const handleFunctionToggle = (
    capability: FunctionCapability,
    value: boolean,
  ) => {
    setFunctionState((prev) => ({ ...prev, [capability.id]: value }));
    toast({
      title: value
        ? `${capability.name} enabled`
        : `${capability.name} disabled`,
      description: value
        ? "Function calls will become available to the Device Access Toolkit runtime."
        : "The AI will skip this function until it is re-enabled.",
    });
  };

  const handleOpenEditor = () => {
    if (!blueprintId) {
      toast({
        title: "Select a blueprint",
        description:
          "Open this AI Studio from a specific blueprint to access the editor.",
      });
      return;
    }

    setLocation(`/blueprint-editor/${blueprintId}`);
  };

  const handleSendMessage = async () => {
    const trimmedInput = playgroundInput.trim();
    if (!trimmedInput || isGenerating) {
      return;
    }

    if (!blueprintId) {
      toast({
        title: "Select a blueprint",
        description:
          "Open an AI Studio session from a specific venue to chat with the assistant.",
      });
      return;
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: trimmedInput,
      timestamp: new Date().toISOString(),
    };

    const historyForRequest = [...messages, userMessage].map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setMessages((prev) => [...prev, userMessage]);
    setPlaygroundInput("");
    setIsGenerating(true);

    try {
      const response = await fetch("/api/ai-studio/chat", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          blueprintId,
          message: trimmedInput,
          history: historyForRequest,
          connectors: connectorState,
          functions: functionState,
          persona: selectedPersona,
          providerId: selectedProviderId,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error || "Request failed");
      }

      const data = await response.json();
      const sanitizedSources = Array.isArray(data?.sources)
        ? data.sources
            .map((source: any) => {
              if (!source || typeof source !== "object") return null;
              const title =
                typeof source.title === "string" ? source.title : "";
              const url = typeof source.url === "string" ? source.url : "";
              if (!title && !url) return null;
              return {
                title,
                url,
                snippet:
                  typeof source.snippet === "string"
                    ? source.snippet
                    : undefined,
                distance:
                  typeof source.distance === "number"
                    ? source.distance
                    : undefined,
              } satisfies SourceReference;
            })
            .filter((item): item is SourceReference => Boolean(item))
        : undefined;
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content:
          typeof data?.content === "string" && data.content.trim()
            ? data.content.trim()
            : "I'm still syncing the venue knowledge. Give me a moment and try again.",
        timestamp: new Date().toISOString(),
        sources: sanitizedSources,
        fromCache: Boolean(data?.fromCache),
        model: typeof data?.model === "string" ? data.model : null,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Failed to generate AI Studio response", error);
      toast({
        title: "Assistant unavailable",
        description:
          "We couldn't reach Gemini just now. The last request was logged for review.",
        variant: "destructive",
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I'm having trouble reaching our knowledge pack right now. Check with staff or retry once connectivity returns.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast({
        title: "AI configuration synced",
        description:
          "Your Blueprint permissions are queued for the Meta Wearables Device Access Toolkit.",
      });
    }, 700);
  };

  const handleAggregatorConnect = () => {
    toast({
      title: "WorkOS Files connected",
      description:
        "Unified OAuth is live. Add Google Drive, SharePoint, Box, and more without new engineering work.",
    });
  };

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      return "";
    }
  };

  const blueprintTitle = blueprintName
    ? `${blueprintName} • AI Studio`
    : "Blueprint AI Studio";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Nav blueprintTitle={blueprintTitle} />
      <main className="pt-24 pb-16">
        <section className="mx-auto max-w-6xl px-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 shadow-2xl">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Meta Wearables
              </Badge>
              <Badge className="bg-slate-800 text-slate-200 border border-slate-700">
                Device Access Toolkit Ready
              </Badge>
            </div>
            <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                  AI Access Studio
                </h1>
                <p className="text-slate-300">
                  Configure how your Blueprint location shares data,
                  orchestrates function calls, and speaks through Meta
                  wearables. Give local teams control without exposing the 3D
                  scene.
                </p>
                <p className="text-sm text-slate-500">
                  {isLoadingBlueprint
                    ? "Loading blueprint metadata…"
                    : blueprintName
                      ? `Location: ${blueprintName}`
                      : "This blueprint is ready for wearable AI setup."}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  className="bg-slate-800/80 text-slate-100 hover:bg-slate-800"
                  onClick={handleOpenEditor}
                  disabled={!blueprintId}
                >
                  <Layers className="mr-2 h-4 w-4" />
                  Open Blueprint Editor
                </Button>
                <Button
                  onClick={handleSave}
                  className="bg-emerald-500 text-slate-900 hover:bg-emerald-400"
                >
                  {isSaving ? (
                    <>
                      <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                      Syncing
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Save updates
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-700 text-slate-200 hover:bg-slate-800/70"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Preview headset flow
                </Button>
              </div>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <Card className="border-slate-800 bg-slate-950/60">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-300">
                    Active provider
                  </CardTitle>
                  <Bot className="h-4 w-4 text-emerald-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-semibold text-white">
                    {selectedProvider?.name ?? "Meta Wearables Co-Pilot"}
                  </div>
                  <p className="text-xs text-slate-500">
                    Persona: {selectedPersona}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-slate-800 bg-slate-950/60">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-300">
                    Connected data sources
                  </CardTitle>
                  <Database className="h-4 w-4 text-cyan-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-semibold text-white">
                    {connectedCount}
                  </div>
                  <p className="text-xs text-slate-500">
                    Unified via WorkOS + Blueprint assets
                  </p>
                </CardContent>
              </Card>
              <Card className="border-slate-800 bg-slate-950/60">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-300">
                    Approved functions
                  </CardTitle>
                  <Workflow className="h-4 w-4 text-indigo-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-semibold text-white">
                    {enabledFunctionCount}
                  </div>
                  <p className="text-xs text-slate-500">
                    Synced to Device Access Toolkit runtime
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Tabs defaultValue="playground" className="mt-10">
            <TabsList className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-900/80 p-2 text-slate-300">
              <TabsTrigger value="playground">Playground</TabsTrigger>
              <TabsTrigger value="data">Data access</TabsTrigger>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
            </TabsList>

            <TabsContent value="playground" className="mt-6 space-y-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Card className="border-slate-800 bg-slate-900/70">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Sparkles className="h-5 w-5 text-emerald-400" />
                      Test the wearable co-pilot
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Prototype responses exactly how they will sound through
                      Meta wearables before publishing.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="h-72 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                      <div className="flex flex-col gap-4">
                        {messages.map((message, index) => {
                          const isAssistant = message.role === "assistant";
                          return (
                            <div
                              key={`${message.timestamp}-${index}`}
                              className={cn(
                                "max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-lg",
                                isAssistant
                                  ? "self-start bg-slate-800/80 text-slate-100"
                                  : "self-end bg-emerald-500/20 text-emerald-100",
                              )}
                            >
                              <p className="whitespace-pre-wrap leading-relaxed">
                                {message.content}
                              </p>
                              {isAssistant && message.sources?.length ? (
                                <div className="mt-3 space-y-2">
                                  <p className="text-[10px] uppercase tracking-wide text-slate-500">
                                    Knowledge sources
                                  </p>
                                  <div className="flex flex-col gap-2">
                                    {message.sources.map(
                                      (source, sourceIndex) => (
                                        <a
                                          key={`${source.url}-${sourceIndex}`}
                                          href={source.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="rounded-xl border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-left text-xs text-slate-200 transition hover:border-emerald-400/40 hover:text-emerald-200"
                                        >
                                          <span className="font-medium text-slate-100">
                                            {source.title || "Source"}
                                          </span>
                                          {source.snippet ? (
                                            <p className="mt-1 text-[11px] text-slate-400">
                                              {source.snippet}
                                            </p>
                                          ) : null}
                                        </a>
                                      ),
                                    )}
                                  </div>
                                </div>
                              ) : null}
                              <span className="mt-3 block text-[10px] uppercase tracking-wide text-slate-500">
                                {isAssistant
                                  ? (selectedProvider?.name ?? "AI")
                                  : "You"}{" "}
                                · {formatTime(message.timestamp)}
                                {isAssistant && message.model
                                  ? ` · ${message.model}`
                                  : ""}
                                {isAssistant && message.fromCache
                                  ? " · cached"
                                  : ""}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 md:flex-row">
                      <Textarea
                        value={playgroundInput}
                        onChange={(event) =>
                          setPlaygroundInput(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (
                            (event.metaKey || event.ctrlKey) &&
                            event.key === "Enter"
                          ) {
                            event.preventDefault();
                            void handleSendMessage();
                          }
                        }}
                        rows={3}
                        className="flex-1 resize-none border-slate-800 bg-slate-950/60 text-slate-100 placeholder:text-slate-500"
                        placeholder="Ask the co-pilot something a guest might say..."
                        disabled={isGenerating}
                      />
                      <Button
                        onClick={handleSendMessage}
                        className="bg-emerald-500 text-slate-900 hover:bg-emerald-400"
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Send
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card className="border-slate-800 bg-slate-900/70">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <Layers className="h-5 w-5 text-cyan-400" />
                        Provider & persona
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        {aiProviders.map((provider) => (
                          <button
                            key={provider.id}
                            onClick={() => setSelectedProviderId(provider.id)}
                            className={cn(
                              "w-full rounded-2xl border p-4 text-left transition",
                              selectedProviderId === provider.id
                                ? "border-emerald-500/70 bg-emerald-500/10"
                                : "border-slate-800 bg-slate-950/40 hover:border-slate-700",
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="font-semibold text-white">
                                  {provider.name}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {provider.subtitle}
                                </p>
                              </div>
                              {provider.badge && (
                                <Badge className="bg-emerald-500/20 text-emerald-200">
                                  {provider.badge}
                                </Badge>
                              )}
                            </div>
                            <p className="mt-2 text-sm text-slate-400">
                              {provider.description}
                            </p>
                          </button>
                        ))}
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Persona focus
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {personaOptions.map((persona) => (
                            <Button
                              key={persona}
                              variant={
                                selectedPersona === persona
                                  ? "default"
                                  : "outline"
                              }
                              onClick={() => setSelectedPersona(persona)}
                              className={cn(
                                "rounded-full border",
                                selectedPersona === persona
                                  ? "bg-emerald-500 text-slate-900 hover:bg-emerald-400"
                                  : "border-slate-700 text-slate-200 hover:bg-slate-800/70",
                              )}
                            >
                              {persona}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-800 bg-slate-900/70">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <Settings2 className="h-5 w-5 text-indigo-400" />
                        Function permissions
                      </CardTitle>
                      <CardDescription className="text-slate-400">
                        Decide which capabilities the AI is allowed to execute
                        from the wearable.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {functionCatalog.map((capability) => (
                        <div
                          key={capability.id}
                          className="flex items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4"
                        >
                          <div>
                            <p className="font-medium text-white">
                              {capability.name}
                            </p>
                            <p className="text-sm text-slate-400">
                              {capability.description}
                            </p>
                          </div>
                          <Switch
                            checked={functionState[capability.id]}
                            onCheckedChange={(checked) =>
                              handleFunctionToggle(capability, checked)
                            }
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="data" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Card className="border-slate-800 bg-slate-900/70">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Cloud className="h-5 w-5 text-cyan-400" />
                      Data sources & permissions
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Toggle which repositories the co-pilot can reference. All
                      requests respect your enterprise access rules.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {connectorCatalog.map((connector) => (
                      <div
                        key={connector.id}
                        className="flex items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4"
                      >
                        <div>
                          <p className="font-medium text-white">
                            {connector.name}
                          </p>
                          <p className="text-sm text-slate-400">
                            {connector.description}
                          </p>
                          {connector.recommended && (
                            <Badge className="mt-2 bg-emerald-500/20 text-emerald-200">
                              Required
                            </Badge>
                          )}
                        </div>
                        <Switch
                          checked={connectorState[connector.id]}
                          onCheckedChange={(checked) =>
                            handleConnectorToggle(connector, checked)
                          }
                          disabled={connector.recommended}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-slate-800 bg-slate-900/70">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Plug className="h-5 w-5 text-emerald-400" />
                      WorkOS Files federation
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Offload OAuth maintenance to WorkOS so you can add cloud
                      drives without building each connector.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-slate-300">
                      Blueprint delegates Google Drive, OneDrive, Box, and
                      future storage sources to WorkOS Files. Your IT team
                      approves once and every location inherits the connection.
                    </p>
                    <Button
                      onClick={handleAggregatorConnect}
                      className="w-full bg-slate-100 text-slate-900 hover:bg-white/90"
                    >
                      Connect via WorkOS Files
                    </Button>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
                      <p className="flex items-center gap-2 text-slate-300">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        Zero new vendor reviews
                      </p>
                      <p className="mt-2">
                        Invite your IT admin to approve once. Blueprint mirrors
                        the scopes per location and keeps end users inside this
                        AI studio.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="integrations" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Card className="border-slate-800 bg-slate-900/70">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Plug className="h-5 w-5 text-indigo-400" />
                      External AI platforms
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Blend Blueprint's wearable-native runtime with partners
                      you already use inside the business.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    {integrationVendors.map((vendor) => (
                      <div
                        key={vendor.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-white">
                              {vendor.name}
                            </p>
                            <p className="text-sm text-slate-400">
                              {vendor.description}
                            </p>
                          </div>
                          <Badge className="bg-emerald-500/20 text-emerald-200">
                            {vendor.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-slate-800 bg-slate-900/70">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Share2 className="h-5 w-5 text-cyan-400" />
                      Publish to teams
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Give operators visibility without exposing the 3D scene or
                      developer tooling.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-slate-300">
                    <p>
                      Share this AI Studio with location managers so they can
                      update prompts, connectors, and guardrails. Only internal
                      Blueprint staff retain access to the immersive editor via
                      the internal code flow.
                    </p>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                      <p className="font-medium text-white">
                        Suggested next steps
                      </p>
                      <ul className="mt-3 space-y-2 text-sm text-slate-400">
                        <li className="flex items-start gap-2">
                          <ArrowUpRight className="mt-1 h-4 w-4 text-emerald-400" />
                          Invite facilities supervisors to review guardrails
                          before your next Meta headset rollout.
                        </li>
                        <li className="flex items-start gap-2">
                          <ArrowUpRight className="mt-1 h-4 w-4 text-emerald-400" />
                          Connect Glean or OpenAI Assistants for knowledge
                          continuity across channels.
                        </li>
                        <li className="flex items-start gap-2">
                          <ArrowUpRight className="mt-1 h-4 w-4 text-emerald-400" />
                          Coordinate with IT to approve WorkOS Files so Drive
                          and OneDrive sources stay in sync automatically.
                        </li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </section>
      </main>
      <Footer />
    </div>
  );
}
