'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, Lock, User, Building2 } from 'lucide-react'
import { Link, useLocation } from "wouter"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'
import * as z from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

// Company name form schema for Google sign-in
const companyFormSchema = z.object({
  company: z.string().min(2, {
    message: "Company name must be at least 2 characters.",
  }),
});

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  company: z.string().min(2, {
    message: "Company name must be at least 2 characters.",
  }),
  password: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

export default function CreateAccount() {
  const [isLoading, setIsLoading] = useState(false)
  const [showCompanyDialog, setShowCompanyDialog] = useState(false)
  const [googleCredentials, setGoogleCredentials] = useState<any>(null)
  const { toast } = useToast()
  const [_, setLocation] = useLocation()

  const companyForm = useForm<z.infer<typeof companyFormSchema>>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      company: "",
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
      password: "",
      confirmPassword: "",
    },
  })

  const { signUp, signInWithGoogle } = useAuth();

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      await signUp(values.email, values.password);
      
      toast({
        title: "Success",
        description: "Your account has been created successfully.",
      })
      
      setLocation("/dashboard")
    } catch (error: any) {
      const errorMessage = error.message || "Failed to create account. Please try again.";
      const errorCode = error.code || "unknown";
      
      console.error("Sign up error:", { code: errorCode, message: errorMessage });
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGoogleSignIn(credentialResponse: any) {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      setLocation("/dashboard");
    } catch (error: any) {
      const errorMessage = error.message || "Failed to sign in with Google. Please try again.";
      console.error("Google sign in error:", error);
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
                <CardTitle>Create Account</CardTitle>
                <CardDescription>
                  Join Blueprint and start transforming your business with AR technology.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <div className="relative">
                            <User className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                            <FormControl>
                              <Input placeholder="John Doe" className="pl-8" {...field} />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <div className="relative">
                            <Building2 className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                            <FormControl>
                              <Input placeholder="Acme Inc" className="pl-8" {...field} />
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
                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
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
                      {isLoading ? "Creating account..." : "Create Account"}
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
                    onSuccess={handleGoogleSignIn}
                    onError={() => {
                      toast({
                        title: "Error",
                        description: "Failed to sign in with Google.",
                        variant: "destructive",
                      });
                    }}
                    theme="outline"
                    shape="rectangular"
                    width="320px"
                  />
                </GoogleOAuthProvider>

                <div className="mt-4 text-center text-sm">
                  <span className="text-gray-500">Already have an account?</span>{" "}
                  <Link href="/sign-in" className="text-primary hover:underline">
                    Sign in
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      <Dialog open={showCompanyDialog} onOpenChange={setShowCompanyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Your Registration</DialogTitle>
            <DialogDescription>
              Please provide your company name to complete the registration.
            </DialogDescription>
          </DialogHeader>
          <Form {...companyForm}>
            <form onSubmit={companyForm.handleSubmit(async (values) => {
              setIsLoading(true);
              try {
                // Here you would send both Google credentials and company name to your backend
                console.log({ googleCredentials, company: values.company });
                
                toast({
                  title: "Success",
                  description: "Account created successfully.",
                });
                
                setShowCompanyDialog(false);
                setLocation("/dashboard");
              } catch (error) {
                toast({
                  title: "Error",
                  description: "Failed to create account.",
                  variant: "destructive",
                });
              } finally {
                setIsLoading(false);
              }
            })} className="space-y-4">
              <FormField
                control={companyForm.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <div className="relative">
                      <Building2 className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                      <FormControl>
                        <Input placeholder="Acme Inc" className="pl-8" {...field} />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating account..." : "Complete Registration"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  )
}
