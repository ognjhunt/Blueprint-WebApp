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

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={setupProgress.deviceRegistered}
                  onChange={(e) => setSetupProgress(prev => ({
                    ...prev,
                    deviceRegistered: e.target.checked
                  }))}
                  className="w-4 h-4"
                />
                <Label>Register Blueprint AR Device</Label>
              </div>
              <p className="text-sm text-gray-600 ml-6">
                Connect your Blueprint AR smart glasses to your account
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={setupProgress.layoutUploaded}
                  onChange={(e) => setSetupProgress(prev => ({
                    ...prev,
                    layoutUploaded: e.target.checked
                  }))}
                  className="w-4 h-4"
                />
                <Label>Upload Floor Plan</Label>
              </div>
              <p className="text-sm text-gray-600 ml-6">
                Upload your location's floor plan for precise AR element placement
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={setupProgress.arElementsPlaced}
                  onChange={(e) => setSetupProgress(prev => ({
                    ...prev,
                    arElementsPlaced: e.target.checked
                  }))}
                  className="w-4 h-4"
                />
                <Label>Place AR Elements</Label>
              </div>
              <p className="text-sm text-gray-600 ml-6">
                Position your AR content within your verified location
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={setupProgress.staffTrained}
                  onChange={(e) => setSetupProgress(prev => ({
                    ...prev,
                    staffTrained: e.target.checked
                  }))}
                  className="w-4 h-4"
                />
                <Label>Complete Staff Training</Label>
              </div>
              <p className="text-sm text-gray-600 ml-6">
                Train your team on Blueprint AR features and customer assistance
              </p>
            </div>
            <Button 
              onClick={() => setCurrentSection('shipping')}
              className="w-full mt-4"
              disabled={!Object.values(setupProgress).every(Boolean)}
            >
              Next: Shipping Details <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Shipping Management */}
      <Card className={currentSection === 'shipping' ? '' : 'opacity-50'}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Truck className="w-5 h-5 mr-2 text-primary" />
            Shipping Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Recipient Name</Label>
                <Input
                  value={shippingInfo.recipientName}
                  onChange={(e) => setShippingInfo(prev => ({
                    ...prev,
                    recipientName: e.target.value
                  }))}
                  placeholder="Enter recipient name"
                />
              </div>
              <div>
                <Label>Quantity</Label>
                <Select
                  value={shippingInfo.quantity.toString()}
                  onValueChange={(value) => setShippingInfo(prev => ({
                    ...prev,
                    quantity: parseInt(value)
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select quantity" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} {num === 1 ? 'sign' : 'signs'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <Label>Shipping Address</Label>
              <Input
                value={shippingInfo.address}
                onChange={(e) => setShippingInfo(prev => ({
                  ...prev,
                  address: e.target.value
                }))}
                placeholder="Street address"
              />
              <div className="grid grid-cols-3 gap-4">
                <Input
                  value={shippingInfo.city}
                  onChange={(e) => setShippingInfo(prev => ({
                    ...prev,
                    city: e.target.value
                  }))}
                  placeholder="City"
                />
                <Input
                  value={shippingInfo.state}
                  onChange={(e) => setShippingInfo(prev => ({
                    ...prev,
                    state: e.target.value
                  }))}
                  placeholder="State"
                />
                <Input
                  value={shippingInfo.zipCode}
                  onChange={(e) => setShippingInfo(prev => ({
                    ...prev,
                    zipCode: e.target.value
                  }))}
                  placeholder="ZIP Code"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Sign Type</Label>
                <Select
                  value={shippingInfo.signType}
                  onValueChange={(value) => setShippingInfo(prev => ({
                    ...prev,
                    signType: value
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sign type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard QR Sign (8.5" x 11")</SelectItem>
                    <SelectItem value="premium">Premium Metal Sign (12" x 12")</SelectItem>
                    <SelectItem value="outdoor">Weather-Resistant Outdoor Sign</SelectItem>
                    <SelectItem value="window">Window Decal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Shipping Method</Label>
                <Select
                  value={shippingInfo.shippingMethod}
                  onValueChange={(value) => setShippingInfo(prev => ({
                    ...prev,
                    shippingMethod: value
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select shipping method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard Ground (5-7 days)</SelectItem>
                    <SelectItem value="express">Express (2-3 days)</SelectItem>
                    <SelectItem value="priority">Priority Overnight</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex space-x-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={shippingInfo.notifyEmail}
                    onChange={(e) => setShippingInfo(prev => ({
                      ...prev,
                      notifyEmail: e.target.checked
                    }))}
                    className="w-4 h-4"
                  />
                  <Label>Email Updates</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={shippingInfo.notifySMS}
                    onChange={(e) => setShippingInfo(prev => ({
                      ...prev,
                      notifySMS: e.target.checked
                    }))}
                    className="w-4 h-4"
                  />
                  <Label>SMS Updates</Label>
                </div>
              </div>
            </div>
            <div>
              <Label>Preferred Delivery Date</Label>
              <Input
                type="date"
                value={shippingInfo.preferredDate}
                onChange={(e) => setShippingInfo(prev => ({
                  ...prev,
                  preferredDate: e.target.value
                }))}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <Label>Special Instructions</Label>
              <Input
                value={shippingInfo.specialInstructions}
                onChange={(e) => setShippingInfo(prev => ({
                  ...prev,
                  specialInstructions: e.target.value
                }))}
                placeholder="Any special delivery instructions"
              />
            </div>
            <Button 
              onClick={() => setCurrentSection('support')}
              className="w-full mt-4"
              disabled={!shippingInfo.address || !shippingInfo.preferredDate}
            >
              Next: Schedule Support <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Support Scheduling */}
      <Card className={currentSection === 'support' ? '' : 'opacity-50'}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <HeadphonesIcon className="w-5 h-5 mr-2 text-primary" />
            Support Scheduling
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Meeting Type</Label>
                <Select 
                  value={supportSlot.meetingType}
                  onValueChange={(value) => setSupportSlot(prev => ({
                    ...prev,
                    meetingType: value
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select meeting type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="setup">Initial Setup</SelectItem>
                    <SelectItem value="training">Staff Training</SelectItem>
                    <SelectItem value="technical">Technical Support</SelectItem>
                    <SelectItem value="optimization">AR Optimization</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Support Type</Label>
                <Select 
                  value={supportSlot.supportType}
                  onValueChange={(value) => setSupportSlot(prev => ({
                    ...prev,
                    supportType: value
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select support type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="remote">Remote Support</SelectItem>
                    <SelectItem value="onsite">On-site Support</SelectItem>
                    <SelectItem value="hybrid">Hybrid (Remote + On-site)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <Label>Preferred Date & Time</Label>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="date"
                  value={supportSlot.date}
                  onChange={(e) => setSupportSlot(prev => ({
                    ...prev,
                    date: e.target.value
                  }))}
                  min={new Date().toISOString().split('T')[0]}
                />
                <Select 
                  value={supportSlot.timeSlot}
                  onValueChange={(value) => setSupportSlot(prev => ({
                    ...prev,
                    timeSlot: value
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTimeSlots.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Priority Level</Label>
              <Select
                value={supportSlot.priority}
                onValueChange={(value) => setSupportSlot(prev => ({
                  ...prev,
                  priority: value
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal - Standard Setup</SelectItem>
                  <SelectItem value="high">High - Business Critical</SelectItem>
                  <SelectItem value="urgent">Urgent - System Down</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Additional Notes</Label>
              <Input
                value={supportSlot.additionalNotes}
                onChange={(e) => setSupportSlot(prev => ({
                  ...prev,
                  additionalNotes: e.target.value
                }))}
                placeholder="Any specific requirements or concerns"
              />
            </div>
            
            <Button 
              className="w-full mt-4"
              disabled={!supportSlot.date || !supportSlot.timeSlot}
            >
              Schedule Support <Calendar className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
                  {availableTimeSlots.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Priority Level</Label>
              <Select
                value={supportSlot.priority}
                onValueChange={(value) => setSupportSlot(prev => ({
                  ...prev,
                  priority: value
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal - Standard Setup</SelectItem>
                  <SelectItem value="high">High - Business Critical</SelectItem>
                  <SelectItem value="urgent">Urgent - System Down</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              className="w-full mt-4"
              disabled={!supportSlot.date || !supportSlot.timeSlot}
              onClick={() => {
                console.log('Support scheduled:', {
                  businessId: blueprintId,
                  ...supportSlot
                });
              }}
            >
              Schedule Support <Calendar className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
                type="date"
                value={supportSlot.date}
                onChange={(e) => setSupportSlot(prev => ({
                  ...prev,
                  date: e.target.value
                }))}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <Label>Time Slot</Label>
              <Select 
                value={supportSlot.timeSlot}
                onValueChange={(value) => setSupportSlot(prev => ({
                  ...prev,
                  timeSlot: value
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select time slot" />
                </SelectTrigger>
                <SelectContent>
                  {availableTimeSlots.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              className="w-full mt-4"
              disabled={!supportSlot.date || !supportSlot.timeSlot}
              onClick={() => {
                // Handle final submission
                console.log('Setup completed:', {
                  setupProgress,
                  shippingInfo,
                  supportSlot
                });
              }}
            >
              Complete Setup
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}