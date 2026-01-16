import { useState } from "react";
import {
  FileText,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Clock,
  Database,
  Cpu,
  Eye,
  Shield,
  GitBranch,
  Download,
  ExternalLink,
} from "lucide-react";
import {
  type DatasheetInfo,
  type DatasetProvenance,
  defaultSceneDatasheet,
  defaultDatasetDatasheet,
} from "@/data/content";

interface DatasheetPanelProps {
  title: string;
  productType: "scene" | "dataset" | "training";
  version?: string;
  releaseDate?: string;
  deliverables?: string[];
  compatibility?: string[];
  customDatasheet?: Partial<DatasheetInfo>;
}

export function DatasheetPanel({
  title,
  productType,
  version = "1.0.0",
  releaseDate,
  deliverables = [],
  compatibility = [],
  customDatasheet,
}: DatasheetPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Merge with defaults based on product type
  const defaultSheet = productType === "scene" ? defaultSceneDatasheet : defaultDatasetDatasheet;
  const datasheet = { ...defaultSheet, ...customDatasheet };

  const formattedDate = releaseDate
    ? new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(releaseDate))
    : "Available";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-zinc-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900">Dataset Datasheet</p>
            <p className="text-xs text-zinc-500">Technical specs, provenance, and quality info</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            v{version}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-zinc-100 p-4 space-y-5">
          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-zinc-50 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
                <GitBranch className="h-3 w-3" />
                Version
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">v{version}</div>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
                <Clock className="h-3 w-3" />
                Released
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">{formattedDate}</div>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
                <Database className="h-3 w-3" />
                Source
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">Synthetic</div>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
                <Shield className="h-3 w-3" />
                License
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">Commercial</div>
            </div>
          </div>

          {/* Technical Specifications */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Technical Specifications
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex items-start gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                <Cpu className="h-4 w-4 text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-zinc-700">Simulation Platform</p>
                  <p className="text-xs text-zinc-500">{datasheet.simulationPlatform}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                <Database className="h-4 w-4 text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-zinc-700">Physics Engine</p>
                  <p className="text-xs text-zinc-500">{datasheet.physicsEngine}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                <Eye className="h-4 w-4 text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-zinc-700">Rendering</p>
                  <p className="text-xs text-zinc-500">{datasheet.renderingPipeline}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-zinc-700">Quality Validation</p>
                  <p className="text-xs text-zinc-500">Automated QA pipeline</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quality Metrics */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Quality Metrics
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-zinc-100 p-3">
                <span className="text-xs text-zinc-600">Physics Accuracy</span>
                <span className="text-xs font-medium text-zinc-900">{datasheet.physicsAccuracy}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-zinc-100 p-3">
                <span className="text-xs text-zinc-600">Visual Fidelity</span>
                <span className="text-xs font-medium text-zinc-900">{datasheet.visualFidelity}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-zinc-100 p-3">
                <span className="text-xs text-zinc-600">Semantic Completeness</span>
                <span className="text-xs font-medium text-zinc-900">{datasheet.semanticCompleteness}</span>
              </div>
            </div>
          </div>

          {/* Deliverables */}
          {deliverables.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Deliverables & Formats
              </p>
              <div className="flex flex-wrap gap-2">
                {deliverables.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                  >
                    <Download className="h-3 w-3" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Compatibility */}
          {compatibility.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Compatible With
              </p>
              <div className="flex flex-wrap gap-2">
                {compatibility.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Provenance Statement */}
          <div className="rounded-lg bg-zinc-50 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-600" />
              <p className="text-xs font-semibold text-zinc-900">Provenance & Rights</p>
            </div>
            <ul className="space-y-1.5 text-xs text-zinc-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                <span>100% synthetically generated data with clear IP ownership</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                <span>No real-world PII, faces, or copyrighted content</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                <span>Full rights to use for training and deployment per license terms</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                <span>Compliant with emerging AI data sourcing standards</span>
              </li>
            </ul>
          </div>

          {/* Download Datasheet Link */}
          <div className="pt-2 border-t border-zinc-100">
            <a
              href="/docs/datasheets"
              className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              <FileText className="h-3.5 w-3.5" />
              View full datasheet documentation
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// Compact provenance badge for cards
export function ProvenanceBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
      <Shield className="h-2.5 w-2.5" />
      Verified Provenance
    </span>
  );
}
