'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, Lock } from 'lucide-react'
import { Link, useLocation } from "wouter"
import { useAuth } from "@/contexts/AuthContext"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'
import * as z from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import Nav from "@/components/Nav"
import Footer from "@/components/Footer"

const formSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  password: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }),
})

export default function SignIn() {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const { signIn } = useAuth()
  const [, setLocation] = useLocation()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      await signIn(values.email, values.password)
      // Will be handled by AuthContext navigation
      toast({
        title: "Success",
        description: "Signed in successfully.",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-white">
      <Nav />
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Sign In</CardTitle>
                <CardDescription>
                  Welcome back! Sign in to access your Blueprint dashboard.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <div className="relative">
                            <Mail className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                            <FormControl>
                              <Input placeholder="your@email.com" className="pl-8" {...field} />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <div className="relative">
                            <Lock className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                            <FormControl>
                              <Input type="password" className="pl-8" {...field} />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                </Form>
                
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>

                <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
                  <GoogleLogin
                    onSuccess={async (credentialResponse) => {
                      setIsLoading(true);
                      try {
                        // Here you would verify the token with your backend
                        console.log(credentialResponse);
                        toast({
                          title: "Success",
                          description: "Signed in with Google successfully.",
                        });
                        setLocation("/dashboard");
                      } catch (error) {
                        toast({
                          title: "Error",
                          description: "Failed to sign in with Google.",
                          variant: "destructive",
                        });
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    onError={() => {
                      toast({
                        title: "Error",
                        description: "Failed to sign in with Google.",
                        variant: "destructive",
                      });
                    }}
                    theme="outline"
                    shape="rectangular"
                    width="100%"
                  />
                </GoogleOAuthProvider>

                <div className="mt-4 text-center text-sm">
                  <span className="text-gray-500">Don't have an account?</span>{" "}
                  <Link href="/create-account" className="text-primary hover:underline">
                    Create one
                  </Link>
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
