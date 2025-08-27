import { useMemo, useState, useEffect } from "react";
import { addMonths, format, startOfMonth } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, User, Phone, Upload, CheckCircle2 } from "lucide-react";
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

export default function EmbedCalendar() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );

  // --- Firestore load (with fallback for legacy docs) ---
  useEffect(() => {
    (async () => {
      // Helper to normalize docs into the Booking shape
      const normalize = (snap: any): Booking[] => {
        const rows: Booking[] = [];
        snap.forEach((doc: any) => {
          const d = doc.data() as any;

          // Some older docs may not have date/time but do have createdDate
          let dateStr: string | undefined = d.date;
          if (!dateStr && d.createdDate?.toDate) {
            const dt: Date = d.createdDate.toDate();
            dateStr = dt.toISOString().slice(0, 10);
          }

          // Default time if missing
          const timeStr: string = d.time ?? "00:00";

          // Normalize status (handle "Pending" etc.)
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
        // Sort by date+time ascending
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
        // Fallback when some docs miss sortable fields
        const snap = await getDocs(collection(db, "bookings"));
        setBookings(normalize(snap));
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
    () => Object.keys(bookingsByDate).map((d) => new Date(d)),
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
      const d = new Date(b.date);
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
      return format(new Date(dateString), "EEEE, MMMM d, yyyy");
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
    <div className="min-h-screen bg-white p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 md:grid-cols-[1fr,0.9fr]">
          {/* Calendar */}
          <div className="overflow-visible">
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              numberOfMonths={6}
              captionLayout="dropdown" // quick month/year jumps
              fromMonth={minMonth}
              toMonth={maxMonth}
              modifiers={{ booked: bookedDates }}
              modifiersClassNames={{
                booked: "bg-purple-200 text-purple-900 rounded-md font-medium",
              }}
              // Exactly 3 months per row; the 6 months render as 2 rows (3 + 3).
              styles={{
                months: {
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  columnGap: "4rem", // ⇦ horizontal spacing
                  rowGap: "2rem", // ⇦ vertical spacing
                },
                month: { padding: "0.5rem" }, // optional padding per month
              }}
              className="rounded-lg border bg-white p-4"
            />

            <div className="mt-3 text-xs text-gray-500">
              <span className="inline-block h-3 w-3 rounded bg-purple-200 align-middle mr-2" />
              Booked day
            </div>
          </div>

          {/* Details panel */}
          <div className="flex-1 space-y-4">
            <div className="rounded-lg border bg-gray-50 p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-lg font-semibold">
                  {selectedDate
                    ? format(selectedDate, "EEEE, MMMM d, yyyy")
                    : "Select a date"}
                </h3>
                <div className="text-sm text-gray-600">
                  {bookingsForSelectedDate.length} booking
                  {bookingsForSelectedDate.length === 1 ? "" : "s"}
                </div>
              </div>
            </div>

            {bookingsForSelectedDate.length > 0 ? (
              bookingsForSelectedDate.map((booking) => (
                <Card
                  key={booking.id}
                  className="overflow-hidden border-0 shadow-md"
                >
                  <CardHeader className="bg-gray-50">
                    <CardTitle className="text-lg">
                      {booking.businessName}
                    </CardTitle>
                    <CardDescription>
                      {formatDateLong(booking.date)} at{" "}
                      {formatTime(booking.time)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-2">
                    {booking.address && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        {booking.address}
                      </div>
                    )}
                    {booking.contactName && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <User className="w-4 h-4 text-gray-500" />
                        {booking.contactName}
                      </div>
                    )}
                    {booking.contactPhone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4 text-gray-500" />
                        {booking.contactPhone}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="border-t bg-gray-50">
                    <Button
                      className={cn(
                        "w-full gap-2",
                        booking.status === "completed"
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-purple-600 hover:bg-purple-700",
                      )}
                      onClick={() => handleBookingSelect(booking)}
                    >
                      {booking.status === "completed" ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          View Details
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Upload Scan Files
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              ))
            ) : (
              <p className="text-sm text-gray-500">No bookings for this day.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
