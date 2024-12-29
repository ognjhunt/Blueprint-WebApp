"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Video, CalendarDays } from "lucide-react";

export function ScanningSetup() {
  const [scheduledForMe, setScheduledForMe] = useState(false);

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Environment Scanning
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-gray-600">
              Ready to capture a high-quality scan of your environment? By using
              an iPhone or iPad, you can quickly map out your space. Just open
              the App Clip or scan our QR code below, and Blueprint’s Scanning
              App will walk you through the process in real time.
            </p>

            {/* Mock App Clip / QR code */}
            <div className="flex flex-col items-center space-y-2 mt-6">
              <div className="w-40 h-40 bg-gray-300 rounded-md flex items-center justify-center">
                {/* This is just a mock block; replace with an actual code/graphic */}
                <span className="text-gray-700">App Clip / QR Code</span>
              </div>
              <p className="text-sm text-gray-500">
                Scan this code with your iPhone/iPad camera
              </p>
            </div>

            {/* Basic instructions */}
            <div className="space-y-3 mt-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Open the Camera or QR-scanner app</span>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Point at the code until the link/app clip pops up</span>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Follow on-screen steps to begin scanning</span>
              </div>
            </div>

            {/* Option: We can do it for you */}
            <div className="bg-blue-50 p-4 rounded-lg mt-6">
              <p className="text-blue-700 mb-3">
                Don’t feel comfortable scanning on your own? We can schedule a
                scanning session for you.
              </p>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="schedule-for-me"
                  checked={scheduledForMe}
                  onChange={() => setScheduledForMe(!scheduledForMe)}
                  className="w-4 h-4"
                />
                <label htmlFor="schedule-for-me" className="text-sm">
                  I want a professional to handle the scanning
                </label>
              </div>
              {scheduledForMe && (
                <p className="text-sm text-gray-600 mt-2">
                  Our team will reach out to arrange a time and location to scan
                  your environment for the best results.
                </p>
              )}
            </div>

            <div className="flex justify-center mt-6">
              <Button variant="outline" size="sm" className="mr-2">
                <Video className="w-4 h-4 mr-2" />
                Watch Tutorial
              </Button>
              <Button variant="outline" size="sm">
                <CalendarDays className="w-4 h-4 mr-2" />
                Schedule Now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
