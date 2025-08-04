"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
//import Head from "next/head";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  Check,
  MessageCircle,
  Mail,
  Phone,
  Clock,
  Calendar as CalendarIcon2,
  HelpCircle,
  BookOpen,
  ArrowRight,
  MessageSquare,
  SendHorizontal,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Add at the top of your file for Next.js App Router
export const metadata = {
  title: "Blueprint - Support & Help Center",
  description:
    "Get help with your Blueprint account, reschedule your mapping session, or contact our support team.",
};

// Define form schemas
const rescheduleFormSchema = z.object({
  reason: z.string().min(2, {
    message: "Please provide a reason for rescheduling.",
  }),
  date: z.date({
    required_error: "Please select a new date.",
  }),
  time: z.string({
    required_error: "Please select a preferred time.",
  }),
  notes: z.string().optional(),
});

const contactFormSchema = z.object({
  name: z.string().min(2, {
    message: "Please enter your name.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  issue: z.string({
    required_error: "Please select an issue type.",
  }),
  message: z.string().min(10, {
    message: "Your message should be at least 10 characters.",
  }),
});

// FAQ content
const faqItems = [
  {
    question: "What happens during the 3D mapping session?",
    answer:
      "During the mapping session, our specialist will use advanced scanning technology to create a detailed 3D model of your space. They'll guide you through the process, which typically takes 30-60 minutes depending on the size of your location.",
  },
  {
    question: "Do I need to prepare anything before the mapping session?",
    answer:
      "Yes! Please ensure your space is clean, well-lit, and free of clutter. Clear walkways for access and consider temporarily removing any highly reflective items (like mirrors) that might interfere with scanning.",
  },
  {
    question: "How long does it take to get my Blueprint after scanning?",
    answer:
      "Processing typically takes 24-48 hours after your mapping session. You'll receive an email notification when your Blueprint is ready to view and share.",
  },
  {
    question: "Can I reschedule my mapping session?",
    answer:
      "Yes, you can reschedule your session up to 24 hours before your appointment. Use the 'Reschedule' tab on this page to select a new date and time.",
  },
  {
    question: "What happens if I need to cancel?",
    answer:
      "Cancellations can be made up to 48 hours before your scheduled session without penalty. Please contact our support team for assistance with cancellations.",
  },
  {
    question: "Can I restrict access to my Blueprint?",
    answer:
      "Absolutely! You have full control over your Blueprint's privacy settings. You can make it private, share with specific people, or make it publicly viewable at any time from your dashboard.",
  },
];

export default function Help() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("reschedule");
  const [liveChat, setLiveChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      sender: "system",
      message: "Welcome to Blueprint Support! How can we help you today?",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const rescheduleForm = useForm({
    resolver: zodResolver(rescheduleFormSchema),
    defaultValues: {
      reason: "",
      date: undefined,
      time: "",
      notes: "",
    },
  });
  const contactForm = useForm({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      issue: "",
      message: "",
    },
  });

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  // Form submission handlers
  const onRescheduleSubmit = (data: any) => {
    console.log(data);
    // Here you would normally send this data to your backend
    toast({
      title: "Rescheduling Request Submitted",
      description: `We've received your request to reschedule for ${format(data.date, "PPP")} at ${data.time}. You'll receive a confirmation email shortly.`,
    });
    rescheduleForm.reset();
  };

  const onContactSubmit = (data: any) => {
    console.log(data);
    // Here you would normally send this data to your backend
    toast({
      title: "Message Sent",
      description:
        "Thank you for reaching out. Our team will respond to your inquiry within 24 hours.",
    });
    contactForm.reset();
  };

  // Chat handler
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    // Add user message
    setChatMessages([...chatMessages, { sender: "user", message: chatInput }]);

    // Simulate agent response (in a real app, this would connect to your backend)
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "agent",
          message:
            "Thanks for your message. One of our support agents will be with you shortly. In the meantime, is there anything else I can help you with?",
        },
      ]);
    }, 1000);

    setChatInput("");
  };

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  const timeSlots = [
    "9:00 AM",
    "9:30 AM",
    "10:00 AM",
    "10:30 AM",
    "11:00 AM",
    "11:30 AM",
    "12:00 PM",
    "12:30 PM",
    "1:00 PM",
    "1:30 PM",
    "2:00 PM",
    "2:30 PM",
    "3:00 PM",
    "3:30 PM",
    "4:00 PM",
    "4:30 PM",
    "5:00 PM",
  ];

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50">
        <Nav />

        {/* Hero Section */}
        <div className="relative pt-24 pb-12 overflow-hidden">
          {/* Animated background blobs */}
          <div className="absolute top-32 left-10 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute top-40 right-10 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

          <div className="container mx-auto px-6 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center max-w-3xl mx-auto"
            >
              <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-700 mb-4">
                We're Here To Help
              </h1>
              <p className="text-lg md:text-xl text-gray-700 mb-8">
                Need to reschedule your mapping session or have questions about
                Blueprint? Our team is ready to assist you every step of the
                way.
              </p>
            </motion.div>

            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12"
            >
              <motion.div variants={item}>
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <CardHeader className="pb-2">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                      <CalendarIcon2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <CardTitle className="text-xl font-bold">
                      Reschedule
                    </CardTitle>
                    <CardDescription>
                      Change your mapping session date and time
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">
                      Need a different time? No problem. Reschedule your 3D
                      mapping session to a more convenient time.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="bg-blue-600 hover:bg-blue-700 text-white w-full"
                      onClick={() => setActiveTab("reschedule")}
                    >
                      Reschedule Now
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>

              <motion.div variants={item}>
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <CardHeader className="pb-2">
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-4">
                      <HelpCircle className="w-6 h-6 text-purple-600" />
                    </div>
                    <CardTitle className="text-xl font-bold">FAQ</CardTitle>
                    <CardDescription>
                      Find answers to common questions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">
                      Browse our comprehensive FAQ section for quick answers to
                      your Blueprint questions.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="bg-purple-600 hover:bg-purple-700 text-white w-full"
                      onClick={() => setActiveTab("faq")}
                    >
                      View FAQs
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>

              <motion.div variants={item}>
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <CardHeader className="pb-2">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
                      <MessageCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <CardTitle className="text-xl font-bold">
                      Contact Us
                    </CardTitle>
                    <CardDescription>
                      Reach out to our support team
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">
                      Have a specific question? Our dedicated support team is
                      ready to help you.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="bg-green-600 hover:bg-green-700 text-white w-full"
                      onClick={() => setActiveTab("contact")}
                    >
                      Contact Support
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-6 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3 mb-8">
                <TabsTrigger value="reschedule" className="text-base">
                  Reschedule
                </TabsTrigger>
                <TabsTrigger value="faq" className="text-base">
                  FAQ
                </TabsTrigger>
                <TabsTrigger value="contact" className="text-base">
                  Contact Us
                </TabsTrigger>
              </TabsList>

              <TabsContent value="reschedule">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="bg-white rounded-lg shadow-xl p-6 md:p-8"
                >
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">
                    Reschedule Your 3D Mapping Session
                  </h2>
                  <Form {...rescheduleForm}>
                    <form
                      onSubmit={rescheduleForm.handleSubmit(onRescheduleSubmit)}
                      className="space-y-6"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-6">
                          <FormField
                            control={rescheduleForm.control}
                            name="reason"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-gray-700 font-medium">
                                  Reason for rescheduling
                                </FormLabel>
                                <FormControl>
                                  <Select onValueChange={field.onChange}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select a reason" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="schedule_conflict">
                                        Schedule Conflict
                                      </SelectItem>
                                      <SelectItem value="transportation">
                                        Transportation Issues
                                      </SelectItem>
                                      <SelectItem value="location_not_ready">
                                        Location Not Ready
                                      </SelectItem>
                                      <SelectItem value="weather">
                                        Weather Concerns
                                      </SelectItem>
                                      <SelectItem value="other">
                                        Other
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={rescheduleForm.control}
                            name="date"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel className="text-gray-700 font-medium">
                                  Select a new date
                                </FormLabel>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant="outline"
                                        className={cn(
                                          "pl-3 text-left font-normal",
                                          !field.value &&
                                            "text-muted-foreground",
                                        )}
                                      >
                                        {field.value ? (
                                          format(field.value, "PPP")
                                        ) : (
                                          <span>Pick a date</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    className="w-auto p-0"
                                    align="start"
                                  >
                                    <Calendar
                                      mode="single"
                                      selected={field.value}
                                      onSelect={field.onChange}
                                      disabled={(date) =>
                                        date <
                                          new Date(
                                            new Date().setHours(0, 0, 0, 0),
                                          ) ||
                                        date >
                                          new Date(
                                            new Date().setDate(
                                              new Date().getDate() + 30,
                                            ),
                                          )
                                      }
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={rescheduleForm.control}
                            name="time"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-gray-700 font-medium">
                                  Select a new time
                                </FormLabel>
                                <FormControl>
                                  <div className="grid grid-cols-3 gap-2 mt-2">
                                    {timeSlots.map((time) => (
                                      <div key={time}>
                                        <input
                                          type="radio"
                                          id={`time-${time}`}
                                          value={time}
                                          className="sr-only peer"
                                          checked={field.value === time}
                                          onChange={() => field.onChange(time)}
                                        />
                                        <label
                                          htmlFor={`time-${time}`}
                                          className="flex items-center justify-center px-3 py-2 text-sm border rounded-md peer-checked:bg-blue-50 peer-checked:border-blue-600 peer-checked:text-blue-600 cursor-pointer transition-all duration-200 hover:bg-gray-50"
                                        >
                                          {time}
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="space-y-6">
                          <FormField
                            control={rescheduleForm.control}
                            name="notes"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-gray-700 font-medium">
                                  Additional notes (optional)
                                </FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Any specific requirements or information for our team"
                                    className="min-h-[200px]"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="border-t border-gray-200 pt-4">
                            <p className="text-sm text-gray-500 mb-4">
                              By submitting this request, you agree to our
                              rescheduling policy. We'll confirm your new
                              appointment as soon as possible.
                            </p>
                            <Button
                              type="submit"
                              className="bg-blue-600 hover:bg-blue-700 text-white w-full"
                            >
                              Submit Rescheduling Request
                            </Button>
                          </div>
                        </div>
                      </div>
                    </form>
                  </Form>
                </motion.div>
              </TabsContent>

              <TabsContent value="faq">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="bg-white rounded-lg shadow-xl p-6 md:p-8"
                >
                  <div className="flex items-center mb-8">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mr-4">
                      <BookOpen className="w-5 h-5 text-purple-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">
                      Frequently Asked Questions
                    </h2>
                  </div>

                  <div className="space-y-6">
                    {faqItems.map((item, index) => (
                      <FaqItem
                        key={index}
                        question={item.question}
                        answer={item.answer}
                        index={index}
                      />
                    ))}
                  </div>

                  <div className="mt-12 bg-purple-50 rounded-lg p-6 border border-purple-100">
                    <h3 className="font-semibold text-purple-900 mb-2">
                      Didn't find what you're looking for?
                    </h3>
                    <p className="text-purple-800 mb-4">
                      Our support team is ready to help with any other questions
                      you might have.
                    </p>
                    <Button
                      onClick={() => setActiveTab("contact")}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Contact Support
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </motion.div>
              </TabsContent>

              <TabsContent value="contact">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                      <div className="bg-white rounded-lg shadow-xl p-6 md:p-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">
                          Contact Our Support Team
                        </h2>
                        <Form {...contactForm}>
                          <form
                            onSubmit={contactForm.handleSubmit(onContactSubmit)}
                            className="space-y-6"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <FormField
                                control={contactForm.control}
                                name="name"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-gray-700 font-medium">
                                      Your Name
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="John Doe"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={contactForm.control}
                                name="email"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-gray-700 font-medium">
                                      Email Address
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="your@email.com"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <FormField
                              control={contactForm.control}
                              name="issue"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-gray-700 font-medium">
                                    Issue Type
                                  </FormLabel>
                                  <FormControl>
                                    <Select onValueChange={field.onChange}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select an issue type" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="technical">
                                          Technical Support
                                        </SelectItem>
                                        <SelectItem value="billing">
                                          Billing Question
                                        </SelectItem>
                                        <SelectItem value="feedback">
                                          Feedback
                                        </SelectItem>
                                        <SelectItem value="feature">
                                          Feature Request
                                        </SelectItem>
                                        <SelectItem value="other">
                                          Other
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={contactForm.control}
                              name="message"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-gray-700 font-medium">
                                    Message
                                  </FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="Please describe your issue or question in detail"
                                      className="min-h-[150px]"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="flex items-start space-x-2">
                              <Checkbox id="terms" />
                              <div className="grid gap-1.5 leading-none">
                                <label
                                  htmlFor="terms"
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  I agree to the terms of service and privacy
                                  policy
                                </label>
                              </div>
                            </div>

                            <Button
                              type="submit"
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              Send Message
                              <SendHorizontal className="w-4 h-4 ml-2" />
                            </Button>
                          </form>
                        </Form>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <Card className="bg-white shadow-lg border-0">
                        <CardHeader>
                          <CardTitle className="text-lg font-semibold">
                            Contact Information
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                              <Mail className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Email</p>
                              <p className="font-medium">
                                nijel@tryblueprint.io
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
                              <Phone className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Phone</p>
                              <p className="font-medium">(800) 123-4567</p>
                            </div>
                          </div>

                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                              <Clock className="w-4 h-4 text-purple-600" />
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">
                                Support Hours
                              </p>
                              <p className="font-medium">
                                Monday - Friday: 9AM - 6PM EST
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg border-0">
                        <CardHeader>
                          <CardTitle className="text-lg font-semibold">
                            Start a Live Chat
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="mb-4 text-blue-100">
                            Get immediate assistance from our support agents via
                            live chat.
                          </p>
                          <Button
                            variant="secondary"
                            className="w-full bg-white text-blue-600 hover:bg-blue-50"
                            onClick={() => setLiveChat(true)}
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Start Chat
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </motion.div>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>

        {/* Live Chat Window */}
        <AnimatePresence>
          {liveChat && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 right-6 w-96 bg-white rounded-lg shadow-2xl overflow-hidden z-50"
            >
              <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
                <div className="flex items-center">
                  <MessageCircle className="w-5 h-5 mr-2" />
                  <h3 className="font-semibold">Blueprint Support</h3>
                </div>
                <button
                  onClick={() => setLiveChat(false)}
                  className="text-white hover:text-blue-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="h-80 p-4 overflow-y-auto">
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`mb-4 ${
                      msg.sender === "user" ? "text-right" : ""
                    }`}
                  >
                    <div
                      className={`inline-block rounded-lg px-4 py-2 max-w-xs ${
                        msg.sender === "user"
                          ? "bg-blue-500 text-white"
                          : msg.sender === "agent"
                            ? "bg-green-500 text-white"
                            : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="border-t p-4 flex">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-grow mr-2"
                />
                <Button type="submit" className="bg-blue-600 text-white">
                  <SendHorizontal className="w-4 h-4" />
                </Button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <Footer />
      </div>
    </>
  );
}

// FAQ Item Component with animation
function FaqItem({ question, answer, index }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="border-b border-gray-200 pb-4"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex justify-between items-center w-full text-left py-2 focus:outline-none"
      >
        <h3 className="text-lg font-medium text-gray-800">{question}</h3>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <ChevronDown className="w-5 h-5 text-gray-500" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <p className="text-gray-600 pt-2 pb-2 pl-1">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
