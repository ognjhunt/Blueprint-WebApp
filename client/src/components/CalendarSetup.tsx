import React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock } from "lucide-react";
import { startOfDay, isSameDay } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const timeSlots = [
  "8:00 AM",
  "9:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
  "5:00 PM",
  "6:00 PM",
  "7:00 PM",
  "8:00 PM",
];

interface CalendarSetupProps {
  // Change callback to accept these extra fields
  onScheduleSelect: (
    date: Date,
    time: string,
    contactName?: string,
    contactPhone?: string,
  ) => void;
}

export function CalendarSetup({ onScheduleSelect }: CalendarSetupProps) {
  const [date, setDate] = React.useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = React.useState("");

  // Add local state for the contact name & phone
  const [contactName, setContactName] = React.useState("");
  const [contactPhone, setContactPhone] = React.useState("");

  const today = startOfDay(new Date());
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 1);

  // Only allow future times with a 1-hour leeway
  const getAvailableTimeSlots = (selectedDate: Date | undefined) => {
    if (!selectedDate) return [];
    // If not the same day as 'today', return all time slots
    if (!isSameDay(selectedDate, today)) {
      return timeSlots;
    }

    const currentHour = new Date().getHours();
    return timeSlots.filter((slot) => {
      const hour = parseInt(slot.split(":")[0]);
      const isPM = slot.includes("PM");
      const slotHour = isPM && hour !== 12 ? hour + 12 : hour;
      // add 1-hour leeway
      return slotHour > currentHour + 1;
    });
  };

  const handleDateSelect = (newDate: Date | undefined) => {
    setDate(newDate);
    setSelectedTime("");
    setContactName("");
    setContactPhone("");
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  // Confirm appointment and pass contact name/phone upward
  const handleConfirm = () => {
    if (date && selectedTime) {
      onScheduleSelect(date, selectedTime, contactName, contactPhone);
    }
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Schedule Blueprint Mapping
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <p className="text-center text-gray-600">
              Schedule a time for our Blueprint Mapper to visit your location.
            </p>
            <ul className="space-y-2 text-gray-600 list-disc pl-6">
              <li>Create a detailed spatial map of your location</li>
              <li>Set up and place QR codes in optimal positions</li>
              <li>Configure your Blueprint settings</li>
              <li>Answer any questions you have</li>
            </ul>

            <div className="grid md:grid-cols-2 gap-8 mt-6">
              <div className="space-y-4">
                <Label className="font-medium flex items-center gap-2">
                  <CalendarDays className="w-5 h-5" />
                  Select Date
                </Label>
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={handleDateSelect}
                  className="border rounded-md"
                  disabled={(day) =>
                    day < startOfDay(today) ||
                    day > maxDate ||
                    day.getDay() === 0 ||
                    day.getDay() === 6
                  }
                />
              </div>

              <div className="space-y-4">
                <Label className="font-medium flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Select Time
                </Label>
                <Select value={selectedTime} onValueChange={handleTimeSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a time slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableTimeSlots(date).map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Only show contact fields if date + time are chosen */}
                {date && selectedTime && (
                  <div className="space-y-4 pt-4">
                    <Label htmlFor="contactName">Contact Name</Label>
                    <Input
                      id="contactName"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Who will we be meeting?"
                    />

                    <Label htmlFor="contactPhone">Contact Phone</Label>
                    <Input
                      id="contactPhone"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="Best number to call"
                    />

                    <Button className="w-full mt-4" onClick={handleConfirm}>
                      Confirm Appointment
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
