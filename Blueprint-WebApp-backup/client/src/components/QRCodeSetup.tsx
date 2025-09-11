'use client'

import { useState } from 'react'
import { CheckCircle, Download } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface QRCodeSetupProps {
  businessName: string;
  blueprintId: string;
}

export function QRCodeSetup({ businessName, blueprintId }: QRCodeSetupProps) {
  const [downloadFormat, setDownloadFormat] = useState<'png' | 'svg' | 'pdf'>('png')

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Your Blueprint QR Code</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <p className="text-center text-gray-600 mb-8">
              After submitting, a unique QR code will be generated for your Blueprint. You can:
            </p>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Print and display it at your business location</span>
              </div>
              
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Include it in your marketing materials</span>
              </div>
              
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Share it on social media to promote your AR experience</span>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg mt-6">
              <p className="text-blue-700">
                <strong>Note:</strong> The QR code will be generated automatically once you submit your Blueprint. You'll be able to download it in various formats and sizes.
              </p>
            </div>

            <div className="mt-6">
              <div className="flex items-center space-x-4">
                <Select value={downloadFormat} onValueChange={(value: 'png' | 'svg' | 'pdf') => setDownloadFormat(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="png">PNG Image</SelectItem>
                    <SelectItem value="svg">SVG Vector</SelectItem>
                    <SelectItem value="pdf">PDF Document</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="flex-1" disabled={!blueprintId}>
                  <Download className="w-4 h-4 mr-2" />
                  Download QR Code
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}