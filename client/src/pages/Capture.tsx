import { useMemo, useState } from "react";
import { SEO } from "@/components/SEO";
import { publicCaptureGeneratedAssets } from "@/lib/publicCaptureGeneratedAssets";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  Glasses,
  Info,
  MapPin,
  Search,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

type CaptureDevice = "camera360" | "phone" | "glasses";
type PayoutBand = "all" | "under100" | "100to250" | "250to500" | "500plus";
type TimeBand = "all" | "under30" | "30to60" | "60to120" | "120plus";

type CaptureJob = {
  id: string;
  siteName: string;
  location: string;
  accessLevel: "Open route" | "Operator-approved" | "Private / NDA" | "Waitlist";
  siteType: "Warehouse" | "Factory" | "Retail" | "Hospital" | "Loading dock" | "Office / campus" | "Lab";
  routeSummary: string;
  qaRequirements: string[];
  acceptedDevices: CaptureDevice[];
  timeMinutes: number;
  timeLabel: string;
  payout: Record<CaptureDevice, string>;
  payoutMax: number;
  thumbnail: string;
};

const deviceLabels: Record<CaptureDevice, string> = {
  camera360: "360 camera",
  phone: "Phone",
  glasses: "Smart glasses",
};

const captureMethods = [
  {
    id: "camera360" as const,
    title: "360 camera",
    badge: "Highest payout",
    multiplier: "1.5x-2.0x typical payout",
    bestFor: "Complete walkthroughs, aisles, rooms, and full site coverage.",
    quality: "Highest coverage and spatial context.",
    icon: Camera,
  },
  {
    id: "phone" as const,
    title: "Phone",
    badge: "Standard payout",
    multiplier: "1.0x typical payout",
    bestFor: "Guided walkthroughs, task areas, and short approved routes.",
    quality: "Strong when stable, well-lit, and complete.",
    icon: Smartphone,
  },
  {
    id: "glasses" as const,
    title: "Smart glasses",
    badge: "POV payout",
    multiplier: "0.6x-0.8x typical payout",
    bestFor: "Hands-free route context and supplemental worker-view capture.",
    quality: "Useful point-of-view capture, usually less complete.",
    icon: Glasses,
  },
];

const payoutRows = [
  {
    size: "Small route",
    examples: "Aisle, hallway, stockroom section",
    glasses: "$40-$90",
    phone: "$75-$150",
    camera360: "$150-$300",
  },
  {
    size: "Standard site zone",
    examples: "Warehouse aisle block, dock, task area",
    glasses: "$80-$175",
    phone: "$150-$350",
    camera360: "$300-$700",
  },
  {
    size: "Complex site",
    examples: "Large facility or multi-zone capture",
    glasses: "Quote / approval",
    phone: "Quote / approval",
    camera360: "Quote / approval",
  },
];

const captureJobs: CaptureJob[] = [
  {
    id: "durham-dock-staging",
    siteName: "Northfield Distribution Dock",
    location: "Durham, NC - exact address after acceptance",
    accessLevel: "Operator-approved",
    siteType: "Warehouse",
    routeSummary: "Receiving aisle -> tote staging -> conveyor approach",
    qaRequirements: ["Steady route", "No faces", "Dock doors and staging labels in frame"],
    acceptedDevices: ["camera360", "phone", "glasses"],
    timeMinutes: 55,
    timeLabel: "45-60 min",
    payout: {
      camera360: "$300-$650",
      phone: "$150-$300",
      glasses: "$80-$150",
    },
    payoutMax: 650,
    thumbnail: publicCaptureGeneratedAssets.hostedReviewPublicRoute,
  },
  {
    id: "austin-market-aisle",
    siteName: "Cedar Market Public Aisle",
    location: "Austin, TX - public route",
    accessLevel: "Open route",
    siteType: "Retail",
    routeSummary: "Front entry -> produce aisle -> stockroom threshold",
    qaRequirements: ["Avoid shoppers where possible", "No payment terminals", "Readable route coverage"],
    acceptedDevices: ["camera360", "phone"],
    timeMinutes: 30,
    timeLabel: "25-35 min",
    payout: {
      camera360: "$160-$280",
      phone: "$85-$140",
      glasses: "Not accepted",
    },
    payoutMax: 280,
    thumbnail: publicCaptureGeneratedAssets.cedarMarketAisleLoop,
  },
  {
    id: "phoenix-assembly-cart",
    siteName: "Sonoran Assembly Cart Bay",
    location: "Phoenix, AZ - operator escort required",
    accessLevel: "Private / NDA",
    siteType: "Factory",
    routeSummary: "Parts shelf -> cart bay -> inspection table",
    qaRequirements: ["Escort required", "No private labels", "All marked zones captured"],
    acceptedDevices: ["camera360"],
    timeMinutes: 85,
    timeLabel: "1-2 hours",
    payout: {
      camera360: "$500-$900",
      phone: "Approval only",
      glasses: "Approval only",
    },
    payoutMax: 900,
    thumbnail: publicCaptureGeneratedAssets.atlasRetailServiceAisle,
  },
  {
    id: "chicago-pharmacy-supply",
    siteName: "Commonwealth Pharmacy Supply Annex",
    location: "Chicago, IL - approved capturers only",
    accessLevel: "Operator-approved",
    siteType: "Hospital",
    routeSummary: "Supply shelf -> cart path -> refill counter approach",
    qaRequirements: ["No patient areas", "No private records", "Short route must be complete"],
    acceptedDevices: ["phone", "glasses"],
    timeMinutes: 40,
    timeLabel: "30-45 min",
    payout: {
      camera360: "Not accepted",
      phone: "$120-$220",
      glasses: "$70-$125",
    },
    payoutMax: 220,
    thumbnail: publicCaptureGeneratedAssets.harborMallCommonCorridor,
  },
  {
    id: "denver-cold-storage",
    siteName: "Front Range Cold Storage Pod",
    location: "Denver, CO - waitlist",
    accessLevel: "Waitlist",
    siteType: "Loading dock",
    routeSummary: "Entry vestibule -> pallet staging -> freezer threshold",
    qaRequirements: ["Bright pass required", "Condensation check", "Route repeated if foggy"],
    acceptedDevices: ["camera360", "phone"],
    timeMinutes: 70,
    timeLabel: "60-90 min",
    payout: {
      camera360: "$350-$720",
      phone: "$175-$320",
      glasses: "Not accepted",
    },
    payoutMax: 720,
    thumbnail: publicCaptureGeneratedAssets.everydayPlacesCollage,
  },
  {
    id: "seattle-rework-lab",
    siteName: "Soundside Electronics Rework Lab",
    location: "Seattle, WA - exact suite hidden",
    accessLevel: "Private / NDA",
    siteType: "Lab",
    routeSummary: "Inbound bins -> workbench row -> packing station",
    qaRequirements: ["No screens", "No serial numbers", "Bench route only"],
    acceptedDevices: ["phone", "glasses"],
    timeMinutes: 50,
    timeLabel: "45-60 min",
    payout: {
      camera360: "Approval only",
      phone: "$160-$300",
      glasses: "$90-$165",
    },
    payoutMax: 300,
    thumbnail: publicCaptureGeneratedAssets.northlineHotelLobbyLoop,
  },
];

const safetyRules = [
  "Capture only approved public-facing or operator-approved routes.",
  "Avoid people, private records, screens, payment terminals, employee-only areas, and restricted zones.",
  "Stop if a manager, employee, resident, or security staff asks you to stop.",
  "Upload only the assigned route. Extra areas can fail QA even when the video quality is good.",
  "Final payout depends on approved device, route completion, capture quality, site access, and QA approval.",
];

function includesDevice(job: CaptureJob, selectedDevice: string) {
  return selectedDevice === "all" || job.acceptedDevices.includes(selectedDevice as CaptureDevice);
}

function matchesPayout(job: CaptureJob, selectedPayout: PayoutBand) {
  if (selectedPayout === "all") return true;
  if (selectedPayout === "under100") return job.payoutMax < 100;
  if (selectedPayout === "100to250") return job.payoutMax >= 100 && job.payoutMax <= 250;
  if (selectedPayout === "250to500") return job.payoutMax > 250 && job.payoutMax <= 500;
  return job.payoutMax > 500;
}

function matchesTime(job: CaptureJob, selectedTime: TimeBand) {
  if (selectedTime === "all") return true;
  if (selectedTime === "under30") return job.timeMinutes < 30;
  if (selectedTime === "30to60") return job.timeMinutes >= 30 && job.timeMinutes <= 60;
  if (selectedTime === "60to120") return job.timeMinutes > 60 && job.timeMinutes <= 120;
  return job.timeMinutes > 120;
}

function buildApplyHref(jobId?: string) {
  const params = new URLSearchParams({
    source: "capture-jobs",
  });
  if (jobId) {
    params.set("job", jobId);
  }
  return `/signup/capturer?${params.toString()}`;
}

export default function Capture() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedSiteType, setSelectedSiteType] = useState("all");
  const [selectedDevice, setSelectedDevice] = useState("all");
  const [selectedPayout, setSelectedPayout] = useState<PayoutBand>("all");
  const [selectedAccess, setSelectedAccess] = useState("all");
  const [selectedTime, setSelectedTime] = useState<TimeBand>("all");

  const cityOptions = useMemo(
    () => Array.from(new Set(captureJobs.map((job) => job.location.split(" - ")[0]))),
    [],
  );
  const siteTypeOptions = useMemo(
    () => Array.from(new Set(captureJobs.map((job) => job.siteType))),
    [],
  );
  const accessOptions = useMemo(
    () => Array.from(new Set(captureJobs.map((job) => job.accessLevel))),
    [],
  );

  const filteredJobs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return captureJobs.filter((job) => {
      const searchable = [
        job.siteName,
        job.location,
        job.accessLevel,
        job.siteType,
        job.routeSummary,
        ...job.qaRequirements,
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!normalizedSearch || searchable.includes(normalizedSearch)) &&
        (selectedCity === "all" || job.location.startsWith(selectedCity)) &&
        (selectedSiteType === "all" || job.siteType === selectedSiteType) &&
        includesDevice(job, selectedDevice) &&
        matchesPayout(job, selectedPayout) &&
        (selectedAccess === "all" || job.accessLevel === selectedAccess) &&
        matchesTime(job, selectedTime)
      );
    });
  }, [
    searchTerm,
    selectedAccess,
    selectedCity,
    selectedDevice,
    selectedPayout,
    selectedSiteType,
    selectedTime,
  ]);

  return (
    <>
      <SEO
        title="Capture Jobs | Blueprint"
        description="Browse sample Blueprint capture jobs, compare 360 camera, phone, and smart glasses payouts, and apply for capturer access."
        canonical="/capture"
        jsonLd={[
          webPageJsonLd({
            path: "/capture",
            name: "Capture Jobs",
            description:
              "A public capturer page for accepted capture methods, payout hierarchy, sample capture jobs, application paths, and safety and QA rules.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Capture Jobs", path: "/capture" },
          ]),
        ]}
      />

      <div className="bg-slate-50 text-slate-950">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-10 lg:py-14">
            <div className="flex flex-col justify-center">
              <h1 className="font-editorial text-5xl leading-none text-slate-950 sm:text-6xl">
                Capture Jobs
              </h1>
              <p className="mt-5 max-w-2xl text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl">
                Get paid to capture real sites for robot evaluation.
              </p>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700">
                Use a 360 camera, phone, or smart glasses to capture approved routes.
                Higher-quality capture earns higher estimated payouts after QA approval.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#jobs"
                  className="inline-flex min-h-11 items-center justify-center border border-slate-950 bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Browse capture jobs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a
                  href={buildApplyHref()}
                  className="inline-flex min-h-11 items-center justify-center border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-950 transition hover:border-slate-400"
                >
                  Apply or join waitlist
                </a>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {captureMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <article
                    key={method.id}
                    className="flex min-h-[15rem] flex-col border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex h-11 w-11 items-center justify-center bg-slate-950 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-5 text-xs font-semibold uppercase text-emerald-700">
                      {method.badge}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                      {method.title}
                    </h2>
                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      {method.multiplier}
                    </p>
                    <p className="mt-4 text-sm leading-6 text-slate-600">
                      {method.bestFor}
                    </p>
                    <p className="mt-auto pt-5 text-xs leading-5 text-slate-500">
                      {method.quality}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-950 text-white">
          <div className="mx-auto grid max-w-[88rem] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[0.34fr_0.66fr] lg:px-10">
            <div>
              <p className="text-xs font-semibold uppercase text-emerald-300">
                Payout hierarchy
              </p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight">
                360 camera pays the most, then phone, then smart glasses.
              </h2>
              <p className="mt-4 text-sm leading-7 text-white/70">
                These are estimated bands for mock capture jobs. Final payout depends on approved
                device, route completion, capture quality, site access, and QA approval.
              </p>
            </div>

            <div className="overflow-x-auto border border-white/15 bg-white/5">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead className="border-b border-white/15 text-xs uppercase text-white/55">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Capture job size</th>
                    <th className="px-4 py-3 font-semibold">Smart glasses</th>
                    <th className="px-4 py-3 font-semibold">Phone</th>
                    <th className="px-4 py-3 font-semibold">360 camera</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {payoutRows.map((row) => (
                    <tr key={row.size}>
                      <td className="px-4 py-4">
                        <span className="block font-semibold text-white">{row.size}</span>
                        <span className="mt-1 block text-xs text-white/55">{row.examples}</span>
                      </td>
                      <td className="px-4 py-4 text-white/80">{row.glasses}</td>
                      <td className="px-4 py-4 text-white/80">{row.phone}</td>
                      <td className="px-4 py-4 font-semibold text-emerald-200">{row.camera360}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="jobs" className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[88rem] px-4 py-10 sm:px-6 lg:px-10">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-emerald-700">
                  Browse mock capture jobs
                </p>
                <h2 className="mt-3 text-4xl font-semibold leading-tight text-slate-950">
                  Search by city, site type, device, payout, access, or time.
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-slate-600">
                These listings are representative examples, not active public assignments. Exact
                addresses and private route details stay hidden until a capturer is accepted.
              </p>
            </div>

            <div className="mt-7 border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 lg:grid-cols-[1.35fr_repeat(6,minmax(0,1fr))]">
                <label className="relative block lg:col-span-2">
                  <span className="sr-only">Search capture jobs</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search city, site name, address, or site type"
                    className="h-11 w-full border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950"
                  />
                </label>

                <label className="block">
                  <span className="sr-only">City / region</span>
                  <select
                    value={selectedCity}
                    onChange={(event) => setSelectedCity(event.target.value)}
                    aria-label="City / region"
                    className="h-11 w-full border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-950"
                  >
                    <option value="all">All regions</option>
                    {cityOptions.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="sr-only">Site type</span>
                  <select
                    value={selectedSiteType}
                    onChange={(event) => setSelectedSiteType(event.target.value)}
                    aria-label="Site type"
                    className="h-11 w-full border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-950"
                  >
                    <option value="all">All site types</option>
                    {siteTypeOptions.map((siteType) => (
                      <option key={siteType} value={siteType}>
                        {siteType}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="sr-only">Capture device</span>
                  <select
                    value={selectedDevice}
                    onChange={(event) => setSelectedDevice(event.target.value)}
                    aria-label="Capture device"
                    className="h-11 w-full border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-950"
                  >
                    <option value="all">All devices</option>
                    <option value="camera360">360 camera</option>
                    <option value="phone">Phone</option>
                    <option value="glasses">Smart glasses</option>
                  </select>
                </label>

                <label className="block">
                  <span className="sr-only">Payout</span>
                  <select
                    value={selectedPayout}
                    onChange={(event) => setSelectedPayout(event.target.value as PayoutBand)}
                    aria-label="Payout"
                    className="h-11 w-full border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-950"
                  >
                    <option value="all">All payouts</option>
                    <option value="under100">Under $100</option>
                    <option value="100to250">$100-$250</option>
                    <option value="250to500">$250-$500</option>
                    <option value="500plus">$500+</option>
                  </select>
                </label>

                <label className="block">
                  <span className="sr-only">Access status</span>
                  <select
                    value={selectedAccess}
                    onChange={(event) => setSelectedAccess(event.target.value)}
                    aria-label="Access status"
                    className="h-11 w-full border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-950"
                  >
                    <option value="all">All access</option>
                    {accessOptions.map((access) => (
                      <option key={access} value={access}>
                        {access}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="sr-only">Time needed</span>
                  <select
                    value={selectedTime}
                    onChange={(event) => setSelectedTime(event.target.value as TimeBand)}
                    aria-label="Time needed"
                    className="h-11 w-full border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-950"
                  >
                    <option value="all">All times</option>
                    <option value="under30">Under 30 min</option>
                    <option value="30to60">30-60 min</option>
                    <option value="60to120">1-2 hours</option>
                    <option value="120plus">2+ hours</option>
                  </select>
                </label>
              </div>
            </div>

            <p className="mt-5 text-sm font-semibold text-slate-700">
              Showing {filteredJobs.length} of {captureJobs.length} mock capture jobs
            </p>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {filteredJobs.map((job) => (
                <article key={job.id} className="grid overflow-hidden border border-slate-200 bg-white sm:grid-cols-[13rem_1fr]">
                  <img
                    src={job.thumbnail}
                    alt=""
                    className="h-56 w-full object-cover sm:h-full"
                    loading="lazy"
                  />
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                      <span>{job.siteType}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span>{job.accessLevel}</span>
                    </div>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-950">{job.siteName}</h3>
                    <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-slate-600">
                      <MapPin className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                      {job.location}
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                      <Clock className="h-4 w-4 text-slate-400" />
                      {job.timeLabel}
                    </p>

                    <div className="mt-4 border border-slate-200">
                      {(["camera360", "phone", "glasses"] as const).map((device) => (
                        <div
                          key={device}
                          className="grid grid-cols-[8rem_1fr] border-b border-slate-200 last:border-b-0"
                        >
                          <span className="bg-slate-50 px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                            {deviceLabels[device]}
                          </span>
                          <span className="px-3 py-2 text-sm font-semibold text-slate-800">
                            {job.payout[device]}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        Capture route
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">{job.routeSummary}</p>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        QA requirements
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {job.qaRequirements.map((requirement) => (
                          <span
                            key={requirement}
                            className="border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600"
                          >
                            {requirement}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <a
                        href={buildApplyHref(job.id)}
                        className="inline-flex min-h-10 items-center justify-center border border-slate-950 bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Apply for this job
                      </a>
                      <a
                        href="/signup/capturer?intent=waitlist&source=capture-jobs"
                        className="inline-flex min-h-10 items-center justify-center border border-slate-300 px-4 text-sm font-semibold text-slate-800 transition hover:border-slate-500"
                      >
                        Join waitlist
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {!filteredJobs.length ? (
              <div className="mt-5 border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-lg font-semibold text-slate-900">
                  No mock capture jobs match those filters.
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Clear one filter or join the capturer waitlist for future routes.
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="bg-slate-100">
          <div className="mx-auto grid max-w-[88rem] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.45fr_0.55fr] lg:px-10">
            <div className="border border-slate-200 bg-white p-6">
              <div className="flex h-11 w-11 items-center justify-center bg-emerald-600 text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-3xl font-semibold text-slate-950">
                Compact safety and QA rules
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Capturers should understand these rules before applying. They keep each route
                lawful, useful, and reviewable.
              </p>
            </div>

            <div className="grid gap-3">
              {safetyRules.map((rule) => (
                <div key={rule} className="flex gap-3 border border-slate-200 bg-white p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <p className="text-sm leading-6 text-slate-700">{rule}</p>
                </div>
              ))}
              <div className="flex gap-3 border border-amber-200 bg-amber-50 p-4">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <p className="text-sm leading-6 text-amber-950">
                  Sample jobs are not a live guarantee of availability, approval, or payout. Work
                  starts only after Blueprint accepts your application and assigns a route.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="apply" className="border-t border-slate-200 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-10">
            <div>
              <p className="text-xs font-semibold uppercase text-emerald-700">
                Apply or waitlist
              </p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight text-slate-950">
                Start with the capturer application. If your city is not open, join the waitlist.
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                Approved capturers receive route instructions, accepted device details, QA rules,
                and payout estimates before work begins.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <a
                href={buildApplyHref()}
                className="inline-flex min-h-12 items-center justify-center border border-slate-950 bg-slate-950 px-6 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Apply to capture
              </a>
              <a
                href="/signup/capturer?intent=waitlist&source=capture-jobs"
                className="inline-flex min-h-12 items-center justify-center border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-950 transition hover:border-slate-500"
              >
                Join waitlist
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
