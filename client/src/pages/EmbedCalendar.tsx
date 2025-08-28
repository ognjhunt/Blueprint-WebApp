import { useMemo, useState, useEffect } from "react";
import { addMonths, format, startOfMonth, parse } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  User,
  Phone,
  Upload,
  CheckCircle2,
  CalendarDays,
  Building2,
  Clock,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

type Booking = {
  id: string;
  date: string; // "yyyy-MM-dd"
  time: string; // "HH:mm"
  businessName: string;
  status:
    | "pending"
    | "completed"
    | "cancelled"
    | "processing"
    | "ready"
    | "failed";
  address?: string;
  contactName?: string;
  contactPhone?: string;
  blueprintId?: string;
};

const statusStyles: Record<Booking["status"], string> = {
  pending: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30",
  processing: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30",
  ready: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30",
  completed: "bg-green-500/15 text-green-300 ring-1 ring-green-400/30",
  failed: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30",
  cancelled: "bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-400/30",
};

export default function EmbedCalendar() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );
  const [loading, setLoading] = useState(true);

  // --- Firestore load (with fallback for legacy docs) ---
  useEffect(() => {
    (async () => {
      const normalize = (snap: any): Booking[] => {
        const rows: Booking[] = [];
        snap.forEach((doc: any) => {
          const d = doc.data() as any;

          // Some older docs may not have date/time but do have createdDate
          let dateStr: string | undefined = d.date;
          if (!dateStr && d.createdDate?.toDate) {
            const dt: Date = d.createdDate.toDate();
            // Use local calendar day, not UTC ISO slice
            dateStr = format(dt, "yyyy-MM-dd");
          }

          const timeStr: string = d.time ?? "00:00";
          const statusNorm = String(d.status ?? "pending").toLowerCase();

          rows.push({
            id: doc.id,
            date: dateStr ?? "1970-01-01",
            time: timeStr,
            businessName: d.businessName ?? d.name ?? "Unknown",
            status: (statusNorm as Booking["status"]) || "pending",
            address: d.address,
            contactName: d.contactName,
            contactPhone: d.contactPhone ?? d.phone,
            blueprintId: d.blueprintId,
          });
        });
        rows.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
        return rows;
      };

      try {
        const q1 = query(
          collection(db, "bookings"),
          orderBy("date", "desc"),
          orderBy("time", "asc"),
        );
        const snap = await getDocs(q1);
        setBookings(normalize(snap));
      } catch {
        const snap = await getDocs(collection(db, "bookings"));
        setBookings(normalize(snap));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const bookingsByDate = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    bookings.forEach((b) => {
      (map[b.date] ??= []).push(b);
    });
    return map;
  }, [bookings]);

  const bookedDates = useMemo(
    () =>
      Object.keys(bookingsByDate).map((d) =>
        parse(d, "yyyy-MM-dd", new Date()),
      ),
    [bookingsByDate],
  );

  const bookingsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    return bookingsByDate[key] ?? [];
  }, [selectedDate, bookingsByDate]);

  // Earliest month we allow navigating back to: earliest booking month (fallback = -12 months).
  const minMonth = useMemo(() => {
    if (bookings.length === 0) return startOfMonth(addMonths(new Date(), -12));
    let earliest = new Date();
    for (const b of bookings) {
      const d = parse(b.date, "yyyy-MM-dd", new Date());
      if (d < earliest) earliest = d;
    }
    return startOfMonth(earliest);
  }, [bookings]);

  // Show current month through the next 5 months (total 6)
  const maxMonth = useMemo(() => startOfMonth(addMonths(new Date(), 5)), []);

  const formatTime = (time: string) => {
    const [h, m] = time.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  const formatDateLong = (dateString: string) => {
    try {
      // Treat 'yyyy-MM-dd' as a LOCAL calendar date, not UTC
      const d = parse(dateString, "yyyy-MM-dd", new Date());
      return format(d, "EEEE, MMMM d, yyyy");
    } catch {
      return dateString;
    }
  };

  const handleBookingSelect = (b: Booking) => {
    window.open(
      `/scanner-portal?booking=${b.id}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className="relative min-h-screen bg-[#0B1220] text-slate-100">
      {/* Subtle ambient gradients */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[-10%] top-[-10%] h-[40rem] w-[40rem] rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 blur-3xl" />
        <div className="absolute right-[-10%] bottom-[-10%] h-[32rem] w-[32rem] rounded-full bg-gradient-to-tr from-indigo-500/20 to-sky-500/20 blur-3xl" />
      </div>

      <header className="mx-auto max-w-[90rem] xl:max-w-[96rem] px-4 pt-8 sm:px-6 lg:px-8">
        <Card className="border-white/10 bg-white/5 backdrop-blur-md">
          <CardContent className="flex flex-col items-start justify-between gap-4 p-5 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-6 w-6 text-emerald-300" />
              <div>
                <CardTitle className="text-xl font-bold tracking-tight text-slate-100">
                  Onboarding Calendar
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Browse six months at a glance. Select a day to view or jump
                  into uploads.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-emerald-400/30 ring-1 ring-emerald-300/40" />
                Booked day
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded ring-2 ring-cyan-300" />
                Today
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-cyan-300" />
                Selected
              </span>
            </div>
          </CardContent>
        </Card>
      </header>

      <main className="mx-auto max-w-[90rem] xl:max-w-[96rem] px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.6fr,0.85fr] xl:grid-cols-[1.8fr,0.8fr] 2xl:grid-cols-[2fr,0.8fr]">
          {/* Calendar panel */}
          <Card className="border-white/10 bg-white/5 p-4 backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold text-slate-100">
                Six-Month View
              </CardTitle>
              <CardDescription className="text-slate-400">
                Use the month/year dropdowns to jump quickly.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3 shadow-2xl overflow-x-auto">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  numberOfMonths={6}
                  captionLayout="dropdown"
                  fromMonth={minMonth}
                  toMonth={maxMonth}
                  modifiers={{ booked: bookedDates, today: new Date() }}
                  modifiersClassNames={{
                    booked:
                      "bg-emerald-500/20 text-emerald-200 rounded-md font-medium",
                    today: "ring-2 ring-cyan-300",
                    selected:
                      "bg-cyan-300 text-slate-900 hover:bg-cyan-300 focus:bg-cyan-300",
                  }}
                  styles={{
                    months: {
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      columnGap: "3rem",
                      rowGap: "1.75rem",
                    },
                    month: { padding: "0.25rem", minWidth: "19rem" },
                    // ↓ Left-align the caption block and the month/year dropdowns
                    month_caption: {
                      display: "flex",
                      justifyContent: "flex-start",
                    },
                    dropdowns: {
                      display: "flex",
                      justifyContent: "flex-start",
                      gap: "0.5rem",
                    },
                  }}
                  className="rounded-lg border border-white/10 bg-transparent p-2 text-slate-100"
                />
              </div>

              <div className="mt-3 flex items-start gap-2 text-xs text-slate-400">
                <Info className="mt-[2px] h-4 w-4" />
                <p>
                  This calendar uses DayPicker under the hood with custom
                  modifiers to flag booked days. Month navigation is via
                  dropdowns for speed.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Day details panel */}
          <Card className="border-white/10 bg-white/5 backdrop-blur-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-100">
                    {selectedDate
                      ? format(selectedDate, "EEEE, MMMM d, yyyy")
                      : "Select a date"}
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {loading
                      ? "Loading bookings…"
                      : `${bookingsForSelectedDate.length} booking${
                          bookingsForSelectedDate.length === 1 ? "" : "s"
                        }`}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator className="bg-white/10" />
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 text-sm text-slate-400">Loading…</div>
              ) : bookingsForSelectedDate.length > 0 ? (
                <ScrollArea className="h-[560px]">
                  <ul className="space-y-4 p-4">
                    {bookingsForSelectedDate.map((booking) => (
                      <li key={booking.id}>
                        <div className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] shadow-xl transition hover:border-white/20 hover:bg-white/[0.08]">
                          <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Building2 className="h-5 w-5 text-cyan-300" />
                              <div className="leading-tight">
                                <div className="font-semibold text-slate-100">
                                  {booking.businessName}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {formatDateLong(booking.date)} at{" "}
                                  {formatTime(booking.time)}
                                </div>
                              </div>
                            </div>
                            <Badge
                              className={cn(
                                "rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur",
                                statusStyles[booking.status],
                              )}
                            >
                              {booking.status}
                            </Badge>
                          </div>

                          <div className="space-y-2 px-4 py-3 text-sm text-slate-300">
                            {booking.address && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-slate-400" />
                                <span className="truncate">
                                  {booking.address}
                                </span>
                              </div>
                            )}
                            {booking.contactName && (
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-slate-400" />
                                <span>{booking.contactName}</span>
                              </div>
                            )}
                            {booking.contactPhone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-slate-400" />
                                <span>{booking.contactPhone}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-slate-400">
                              <Clock className="h-4 w-4" />
                              <span className="text-xs">
                                Local time • {formatTime(booking.time)}
                              </span>
                            </div>
                          </div>

                          <div className="border-t border-white/10 bg-white/[0.04] p-3">
                            <Button
                              className={cn(
                                "w-full gap-2 rounded-xl font-semibold",
                                booking.status === "completed"
                                  ? "bg-green-600 hover:bg-green-700"
                                  : "bg-cyan-600 hover:bg-cyan-700",
                              )}
                              onClick={() => handleBookingSelect(booking)}
                            >
                              {booking.status === "completed" ? (
                                <>
                                  <CheckCircle2 className="h-4 w-4" />
                                  View Details
                                </>
                              ) : (
                                <>
                                  <Upload className="h-4 w-4" />
                                  Upload Scan Files
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              ) : (
                <div className="p-6">
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.04] p-6 text-center">
                    <div className="mx-auto mb-2 h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-emerald-500/30" />
                    <p className="font-medium text-slate-200">
                      No bookings for this day.
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Select another date on the left to view its schedule.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

// import { useMemo, useState, useEffect } from "react";
// import { addMonths, format, startOfMonth } from "date-fns";
// import { Calendar as CalendarComponent } from "@/components/ui/calendar";
// import {
//   Card,
//   CardHeader,
//   CardTitle,
//   CardDescription,
//   CardContent,
//   CardFooter,
// } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { MapPin, User, Phone, Upload, CheckCircle2 } from "lucide-react";
// import { cn } from "@/lib/utils";
// import { db } from "@/lib/firebase";
// import { collection, getDocs, orderBy, query } from "firebase/firestore";

// type Booking = {
//   id: string;
//   date: string; // "yyyy-MM-dd"
//   time: string; // "HH:mm"
//   businessName: string;
//   status:
//     | "pending"
//     | "completed"
//     | "cancelled"
//     | "processing"
//     | "ready"
//     | "failed";
//   address?: string;
//   contactName?: string;
//   contactPhone?: string;
//   blueprintId?: string;
// };

// export default function EmbedCalendar() {
//   const [bookings, setBookings] = useState<Booking[]>([]);
//   const [selectedDate, setSelectedDate] = useState<Date | undefined>(
//     new Date(),
//   );

//   // --- Firestore load (with fallback for legacy docs) ---
//   useEffect(() => {
//     (async () => {
//       // Helper to normalize docs into the Booking shape
//       const normalize = (snap: any): Booking[] => {
//         const rows: Booking[] = [];
//         snap.forEach((doc: any) => {
//           const d = doc.data() as any;

//           // Some older docs may not have date/time but do have createdDate
//           let dateStr: string | undefined = d.date;
//           if (!dateStr && d.createdDate?.toDate) {
//             const dt: Date = d.createdDate.toDate();
//             dateStr = dt.toISOString().slice(0, 10);
//           }

//           // Default time if missing
//           const timeStr: string = d.time ?? "00:00";

//           // Normalize status (handle "Pending" etc.)
//           const statusNorm = String(d.status ?? "pending").toLowerCase();

//           rows.push({
//             id: doc.id,
//             date: dateStr ?? "1970-01-01",
//             time: timeStr,
//             businessName: d.businessName ?? d.name ?? "Unknown",
//             status: (statusNorm as Booking["status"]) || "pending",
//             address: d.address,
//             contactName: d.contactName,
//             contactPhone: d.contactPhone ?? d.phone,
//             blueprintId: d.blueprintId,
//           });
//         });
//         // Sort by date+time ascending
//         rows.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
//         return rows;
//       };

//       try {
//         const q1 = query(
//           collection(db, "bookings"),
//           orderBy("date", "desc"),
//           orderBy("time", "asc"),
//         );
//         const snap = await getDocs(q1);
//         setBookings(normalize(snap));
//       } catch {
//         // Fallback when some docs miss sortable fields
//         const snap = await getDocs(collection(db, "bookings"));
//         setBookings(normalize(snap));
//       }
//     })();
//   }, []);

//   const bookingsByDate = useMemo(() => {
//     const map: Record<string, Booking[]> = {};
//     bookings.forEach((b) => {
//       (map[b.date] ??= []).push(b);
//     });
//     return map;
//   }, [bookings]);

//   const bookedDates = useMemo(
//     () => Object.keys(bookingsByDate).map((d) => new Date(d)),
//     [bookingsByDate],
//   );

//   const bookingsForSelectedDate = useMemo(() => {
//     if (!selectedDate) return [];
//     const key = format(selectedDate, "yyyy-MM-dd");
//     return bookingsByDate[key] ?? [];
//   }, [selectedDate, bookingsByDate]);

//   // Earliest month we allow navigating back to: earliest booking month (fallback = -12 months).
//   const minMonth = useMemo(() => {
//     if (bookings.length === 0) return startOfMonth(addMonths(new Date(), -12));
//     let earliest = new Date();
//     for (const b of bookings) {
//       const d = new Date(b.date);
//       if (d < earliest) earliest = d;
//     }
//     return startOfMonth(earliest);
//   }, [bookings]);

//   // Show current month through the next 5 months (total 6)
//   const maxMonth = useMemo(() => startOfMonth(addMonths(new Date(), 5)), []);

//   const formatTime = (time: string) => {
//     const [h, m] = time.split(":");
//     const hour = parseInt(h, 10);
//     const ampm = hour >= 12 ? "PM" : "AM";
//     const hour12 = hour % 12 || 12;
//     return `${hour12}:${m} ${ampm}`;
//   };

//   const formatDateLong = (dateString: string) => {
//     try {
//       return format(new Date(dateString), "EEEE, MMMM d, yyyy");
//     } catch {
//       return dateString;
//     }
//   };

//   const handleBookingSelect = (b: Booking) => {
//     window.open(
//       `/scanner-portal?booking=${b.id}`,
//       "_blank",
//       "noopener,noreferrer",
//     );
//   };

//   return (
//     <div className="min-h-screen bg-white p-4 md:p-6">
//       <div className="mx-auto max-w-7xl">
//         <div className="grid gap-6 md:grid-cols-[1fr,0.9fr]">
//           {/* Calendar */}
//           <div className="overflow-visible">
//             <CalendarComponent
//               mode="single"
//               selected={selectedDate}
//               onSelect={setSelectedDate}
//               numberOfMonths={6}
//               captionLayout="dropdown" // quick month/year jumps
//               fromMonth={minMonth}
//               toMonth={maxMonth}
//               modifiers={{ booked: bookedDates }}
//               modifiersClassNames={{
//                 booked: "bg-purple-200 text-purple-900 rounded-md font-medium",
//               }}
//               // Exactly 3 months per row; the 6 months render as 2 rows (3 + 3).
//               styles={{
//                 months: {
//                   display: "grid",
//                   gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
//                   columnGap: "4rem", // ⇦ horizontal spacing
//                   rowGap: "2rem", // ⇦ vertical spacing
//                 },
//                 month: { padding: "0.5rem" }, // optional padding per month
//               }}
//               className="rounded-lg border bg-white p-4"
//             />

//             <div className="mt-3 text-xs text-gray-500">
//               <span className="inline-block h-3 w-3 rounded bg-purple-200 align-middle mr-2" />
//               Booked day
//             </div>
//           </div>

//           {/* Details panel */}
//           <div className="flex-1 space-y-4">
//             <div className="rounded-lg border bg-gray-50 p-4">
//               <div className="flex items-center justify-between flex-wrap gap-2">
//                 <h3 className="text-lg font-semibold">
//                   {selectedDate
//                     ? format(selectedDate, "EEEE, MMMM d, yyyy")
//                     : "Select a date"}
//                 </h3>
//                 <div className="text-sm text-gray-600">
//                   {bookingsForSelectedDate.length} booking
//                   {bookingsForSelectedDate.length === 1 ? "" : "s"}
//                 </div>
//               </div>
//             </div>

//             {bookingsForSelectedDate.length > 0 ? (
//               bookingsForSelectedDate.map((booking) => (
//                 <Card
//                   key={booking.id}
//                   className="overflow-hidden border-0 shadow-md"
//                 >
//                   <CardHeader className="bg-gray-50">
//                     <CardTitle className="text-lg">
//                       {booking.businessName}
//                     </CardTitle>
//                     <CardDescription>
//                       {formatDateLong(booking.date)} at{" "}
//                       {formatTime(booking.time)}
//                     </CardDescription>
//                   </CardHeader>
//                   <CardContent className="pt-4 space-y-2">
//                     {booking.address && (
//                       <div className="flex items-center gap-2 text-sm text-gray-600">
//                         <MapPin className="w-4 h-4 text-gray-500" />
//                         {booking.address}
//                       </div>
//                     )}
//                     {booking.contactName && (
//                       <div className="flex items-center gap-2 text-sm text-gray-600">
//                         <User className="w-4 h-4 text-gray-500" />
//                         {booking.contactName}
//                       </div>
//                     )}
//                     {booking.contactPhone && (
//                       <div className="flex items-center gap-2 text-sm text-gray-600">
//                         <Phone className="w-4 h-4 text-gray-500" />
//                         {booking.contactPhone}
//                       </div>
//                     )}
//                   </CardContent>
//                   <CardFooter className="border-t bg-gray-50">
//                     <Button
//                       className={cn(
//                         "w-full gap-2",
//                         booking.status === "completed"
//                           ? "bg-green-600 hover:bg-green-700"
//                           : "bg-purple-600 hover:bg-purple-700",
//                       )}
//                       onClick={() => handleBookingSelect(booking)}
//                     >
//                       {booking.status === "completed" ? (
//                         <>
//                           <CheckCircle2 className="w-4 h-4" />
//                           View Details
//                         </>
//                       ) : (
//                         <>
//                           <Upload className="w-4 h-4" />
//                           Upload Scan Files
//                         </>
//                       )}
//                     </Button>
//                   </CardFooter>
//                 </Card>
//               ))
//             ) : (
//               <p className="text-sm text-gray-500">No bookings for this day.</p>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
