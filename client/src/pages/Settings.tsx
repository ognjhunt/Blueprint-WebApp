'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bell, Shield, Key, Smartphone } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import Nav from "@/components/Nav"
import Footer from "@/components/Footer"

export default function Settings() {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    marketingEmails: true,
    twoFactorAuth: false
  })
  const { toast } = useToast()

  const handleSettingChange = (setting: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }))

    toast({
      title: "Settings Updated",
      description: "Your preferences have been saved.",
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-white">
      <Nav />
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
                <CardDescription>
                  Manage your account settings and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Bell className="h-5 w-5 text-gray-500" />
                      <div>
                        <Label htmlFor="email-notifications" className="text-base">Email Notifications</Label>
                        <p className="text-sm text-gray-500">Receive email updates about your blueprints</p>
                      </div>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={settings.emailNotifications}
                      onCheckedChange={() => handleSettingChange('emailNotifications')}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Smartphone className="h-5 w-5 text-gray-500" />
                      <div>
                        <Label htmlFor="push-notifications" className="text-base">Push Notifications</Label>
                        <p className="text-sm text-gray-500">Get notified about important updates</p>
                      </div>
                    </div>
                    <Switch
                      id="push-notifications"
                      checked={settings.pushNotifications}
                      onCheckedChange={() => handleSettingChange('pushNotifications')}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Shield className="h-5 w-5 text-gray-500" />
                      <div>
                        <Label htmlFor="marketing-emails" className="text-base">Marketing Emails</Label>
                        <p className="text-sm text-gray-500">Receive news and special offers</p>
                      </div>
                    </div>
                    <Switch
                      id="marketing-emails"
                      checked={settings.marketingEmails}
                      onCheckedChange={() => handleSettingChange('marketingEmails')}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Key className="h-5 w-5 text-gray-500" />
                      <div>
                        <Label htmlFor="two-factor" className="text-base">Two-Factor Authentication</Label>
                        <p className="text-sm text-gray-500">Add an extra layer of security</p>
                      </div>
                    </div>
                    <Switch
                      id="two-factor"
                      checked={settings.twoFactorAuth}
                      onCheckedChange={() => handleSettingChange('twoFactorAuth')}
                    />
                  </div>
                </div>

                <Separator />

                <div className="pt-4">
                  <Button variant="destructive" className="w-full">
                    Delete Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
