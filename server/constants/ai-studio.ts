export type StudioConnector = {
  id: string;
  name: string;
  description: string;
  recommended?: boolean;
};

export type StudioFunctionCapability = {
  id: string;
  name: string;
  description: string;
};

export type StudioProvider = {
  id: string;
  name: string;
  subtitle?: string;
  description?: string;
  badge?: string;
};

export const STUDIO_CONNECTORS: StudioConnector[] = [
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
    description: "Surface SOPs, menus, and onboarding decks stored in shared drives.",
  },
  {
    id: "microsoftOneDrive",
    name: "Microsoft OneDrive",
    description: "Sync operational checklists from Microsoft 365 tenants via WorkOS Files.",
  },
  {
    id: "dropbox",
    name: "Dropbox",
    description: "Pull signage decks and merchandising guides without duplicating uploads.",
  },
  {
    id: "notion",
    name: "Notion HQ",
    description: "Expose runbooks, shift notes, and launch checklists from Notion pages.",
  },
  {
    id: "sharepoint",
    name: "SharePoint",
    description: "Access compliance binders and facility documentation managed by IT.",
  },
];

export const STUDIO_FUNCTIONS: StudioFunctionCapability[] = [
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
    description: "Allow guests to reserve demos, tours, or table service through your connected calendar systems.",
  },
  {
    id: "knowledgeGuardrails",
    name: "Knowledge guardrails",
    description: "Enforce location-specific disclaimers, safety notes, and policy-aware responses before answers ship.",
  },
];

export const STUDIO_PROVIDERS: StudioProvider[] = [
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

export function resolveProvider(providerId: string | null | undefined) {
  if (!providerId) {
    return STUDIO_PROVIDERS[0];
  }
  return (
    STUDIO_PROVIDERS.find((provider) => provider.id === providerId) || {
      id: providerId,
      name: providerId,
    }
  );
}
