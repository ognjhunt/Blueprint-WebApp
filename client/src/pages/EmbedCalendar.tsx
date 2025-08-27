import { useMemo, useState, useEffect } from "react";
import { addMonths, format } from "date-fns";
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

  useEffect(() => {
    (async () => {
      const q = query(
        collection(db, "bookings"),
        orderBy("date", "desc"),
        orderBy("time", "asc"),
      );
      const snap = await getDocs(q);
      const rows: Booking[] = [];
      snap.forEach((doc) =>
        rows.push({ id: doc.id, ...(doc.data() as Omit<Booking, "id">) }),
      );
      setBookings(rows);
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

  const formatTime = (time: string) => {
    const [h, m] = time.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  const formatDate = (dateString: string) => {
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
    <div className="min-h-screen bg-[#0B1220] p-4 md:p-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Blueprint Onboarding Calendar</h1>
        </header>
        <div className="flex flex-col md:flex-row gap-6">
          <CalendarComponent
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            numberOfMonths={2}
            disabled={{ before: new Date() }}
            fromMonth={new Date()}
            toMonth={addMonths(new Date(), 1)}
            modifiers={{ booked: bookedDates }}
            modifiersClassNames={{ booked: "bg-emerald-500/20 text-emerald-300" }}
            className="rounded-lg border border-white/10 bg-[#0E172A]/60 text-slate-100"
            classNames={{
              caption_label: "text-slate-100",
              nav_button: "text-slate-100 hover:bg-[#1a2437]",
              head_cell: "text-slate-400",
              day: "text-slate-100 hover:bg-[#1a2437] aria-selected:bg-emerald-600 aria-selected:text-white",
            }}
          />
          <div className="flex-1 space-y-4">
            {bookingsForSelectedDate.length > 0 ? (
              bookingsForSelectedDate.map((booking) => (
                <Card
                  key={booking.id}
                  className="overflow-hidden border border-white/10 bg-[#0E172A]/60 backdrop-blur-sm"
                >
                  <CardHeader className="bg-[#131D31] border-b border-white/10">
                    <CardTitle className="text-lg text-emerald-300">
                      {booking.businessName}
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      {formatDate(booking.date)} at {formatTime(booking.time)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-2">
                    {booking.address && (
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <MapPin className="w-4 h-4 text-slate-400" />{" "}
                        {booking.address}
                      </div>
                    )}
                    {booking.contactName && (
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <User className="w-4 h-4 text-slate-400" />{" "}
                        {booking.contactName}
                      </div>
                    )}
                    {booking.contactPhone && (
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Phone className="w-4 h-4 text-slate-400" />{" "}
                        {booking.contactPhone}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="border-t border-white/10 bg-[#131D31]">
                    <Button
                      className={cn(
                        "w-full gap-2 text-slate-100",
                        booking.status === "completed"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "bg-cyan-600 hover:bg-cyan-700",
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
              <p className="text-sm text-slate-400">No bookings for this day.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
