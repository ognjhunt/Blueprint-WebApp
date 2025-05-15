import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import Nav from "@/components/Nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Footer from "@/components/Footer";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ShieldCheck,
  Rocket,
  Sparkle,
  Zap,
  MapPin,
  Target,
  Settings,
  PlayCircle,
  ArrowRight,
  CheckCircle2,
  ArrowDown,
  Info,
  Layers,
  Code,
  Globe,
  Users,
  PenTool,
  Activity,
  ChevronDown,
  Plus
} from "lucide-react";

export default function Home() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const mainRef = useRef(null);
  const contactFormRef = useRef(null);

  // Services offered
  const services = [
    {
      title: "Service 1",
      description: "A detailed explanation of our first service and how it benefits your business.",
      icon: <Target className="w-5 h-5" />,
    },
    {
      title: "Service 2",
      description: "A detailed explanation of our second service and how it provides value.",
      icon: <Rocket className="w-5 h-5" />,
    },
    {
      title: "Service 3",
      description: "A comprehensive overview of our third service offering and its features.",
      icon: <Sparkle className="w-5 h-5" />,
    },
    {
      title: "Service 4",
      description: "Everything you need to know about our fourth service and its capabilities.",
      icon: <Settings className="w-5 h-5" />,
    }
  ];

  // Process steps
  const processSteps = [
    {
      title: "Step",
      description: "First step of our process that helps your business succeed.",
      icon: <MapPin className="w-5 h-5" />,
    },
    {
      title: "Step",
      description: "Second step that builds on the first and adds additional value.",
      icon: <Settings className="w-5 h-5" />,
    },
    {
      title: "Step",
      description: "Third critical step in delivering successful outcomes for your business.",
      icon: <Sparkle className="w-5 h-5" />,
    }
  ];

  // Company stats
  const companyStats = [
    { value: "55%", description: "Increase in conversion rate" },
    { value: "55%", description: "Reduction in customer acquisition cost" },
    { value: "55%", description: "Growth in recurring revenue" }
  ];

  // Testimonials
  const testimonials = [
    {
      name: "Name",
      role: "Position at Company",
      content: "This is a testimonial praising our services and explaining how it helped their business."
    },
    {
      name: "Name",
      role: "Position at Company",
      content: "Another positive testimonial from a satisfied customer sharing their experience."
    },
    {
      name: "Name",
      role: "Position at Company",
      content: "A third glowing testimonial highlighting successful results achieved."
    }
  ];

  // Why choose us points
  const whyChooseUs = [
    {
      title: "What Makes Us Better",
      points: ["First competitive advantage", "Second advantage over competitors", "Third reason we're the best choice"]
    },
    {
      title: "What We Provide",
      points: ["Primary service offering", "Secondary service benefit", "Additional value proposition"]
    }
  ];

  // FAQ items
  const faqItems = [
    {
      question: "Question 1",
      answer: "Detailed answer to the first frequently asked question about our services."
    },
    {
      question: "Question 2",
      answer: "Comprehensive response to the second common question customers ask."
    },
    {
      question: "Question 3",
      answer: "Clear explanation addressing the third frequently asked question."
    },
    {
      question: "Question 4",
      answer: "Thorough answer to the fourth question potential customers often have."
    }
  ];

  // Parallax scrolling effect
  const { scrollYProgress } = useScroll({
    target: mainRef,
    offset: ["start start", "end start"],
  });

  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

  useEffect(() => {
    if (currentUser) {
      setLocation("/dashboard");
    }
  }, [currentUser, setLocation]);

  useEffect(() => {
    // Check if the Lindy script is already added to prevent duplicates
    const lindyScriptId = "lindy-embed-script";
    if (document.getElementById(lindyScriptId)) {
      return;
    }

    const script = document.createElement("script");
    script.id = lindyScriptId;
    script.src =
      "https://api.lindy.ai/api/lindyEmbed/lindyEmbed.js?a=9620fed7-bdfb-4329-ada0-b60963170c59";
    script.async = true;
    script.crossOrigin = "use-credentials"; // In JS, HTML 'crossorigin' attribute is 'crossOrigin'

    document.body.appendChild(script);

    // Optional: Cleanup function to remove the script when the component unmounts
    return () => {
      const existingScript = document.getElementById(lindyScriptId);
      if (existingScript && existingScript.parentNode) {
        existingScript.parentNode.removeChild(existingScript);
      }
    };
  }, []); // Empty dependency array ensures this effect runs only once on mount and cleans up on unmount

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Navigation Bar */}
      <header className="py-4 border-b border-gray-200">
        <div className="container mx-auto flex items-center justify-between px-4">
          <div className="flex items-center">
            <div className="text-xl font-bold">High Converting Business Landing Page</div>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <div className="text-sm space-x-6">
              <a href="#" className="text-gray-600 hover:text-gray-900">Features</a>
              <a href="#" className="text-gray-600 hover:text-gray-900">Our Process</a>
              <a href="#" className="text-gray-600 hover:text-gray-900">Testimonials</a>
              <a href="#" className="text-gray-600 hover:text-gray-900">Pricing</a>
              <a href="#" className="text-gray-600 hover:text-gray-900">Contact</a>
            </div>
            <Button variant="default" size="sm" className="bg-black hover:bg-gray-800 text-white rounded-md">
              Sign Up
            </Button>
          </div>
        </div>
      </header>

      <main ref={mainRef} className="flex-1">
        {/* Hero Section */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row items-start">
              {/* Left sidebar */}
              <div className="w-full md:w-1/4 mb-8 md:mb-0">
                <div className="flex items-center mb-12">
                  <div className="h-px bg-gray-300 flex-grow mr-3"></div>
                  <div className="text-sm text-gray-600">New Bar</div>
                  <div className="h-4 w-4 bg-gray-900 rounded-full ml-2"></div>
                </div>
                
                <div className="mb-12">
                  <h3 className="text-lg font-semibold mb-2">Start with clarity and credibility.</h3>
                  <p className="text-sm text-gray-600">
                    First impressions matter. Your opening headline and copy should establish trust and clearly communicate your value proposition.
                  </p>
                </div>
              </div>
              
              {/* Main content */}
              <div className="w-full md:w-2/4 md:px-8">
                <div className="text-center mb-12">
                  <h1 className="text-3xl font-bold mb-4">High Converting Heading Comes Here</h1>
                  <p className="text-gray-600 mb-8">A compelling subheading that explains your unique value proposition and what makes your offering special.</p>
                  <Button className="bg-black hover:bg-gray-800 text-white px-6 py-2 rounded-md mb-2">
                    Primary CTA
                  </Button>
                  <div>
                    <a href="#" className="text-sm text-gray-600 hover:text-gray-900 underline">Secondary Link</a>
                  </div>
                </div>
                
                <div className="mb-16 flex justify-center">
                  <div className="flex space-x-12 items-center">
                    <div className="text-center">
                      <div className="text-2xl font-bold">1,000+</div>
                      <div className="text-sm text-gray-600">Customers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">4.9★</div>
                      <div className="text-sm text-gray-600">Average Rating</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">500+</div>
                      <div className="text-sm text-gray-600">Reviews</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">99%</div>
                      <div className="text-sm text-gray-600">Satisfaction</div>
                    </div>
                  </div>
                </div>
                
                {/* Services Section */}
                <div className="mb-16">
                  <h2 className="text-xl font-bold mb-8 text-center">Services Section</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {services.map((service, index) => (
                      <Card key={index} className="border shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <h3 className="text-lg font-medium mb-2">{service.title}</h3>
                          <div className="h-24 bg-gray-100 rounded mb-4"></div>
                          <Button variant="outline" className="w-full border border-gray-300 text-gray-700">Learn More</Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
                
                {/* Process Section */}
                <div className="mb-16">
                  <h2 className="text-xl font-bold mb-8 text-center">Process Section</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {processSteps.map((step, index) => (
                      <div key={index} className="text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-gray-300 mb-4">
                          {step.icon}
                        </div>
                        <h3 className="font-medium mb-1">{step.title}</h3>
                        <p className="text-sm text-gray-600">{step.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* About Company */}
                <div className="mb-16">
                  <h2 className="text-xl font-bold mb-8 text-center">About Company</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {companyStats.map((stat, index) => (
                      <div key={index} className="text-center">
                        <div className="text-2xl font-bold mb-1">{stat.value}</div>
                        <p className="text-sm text-gray-600">{stat.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Testimonial Section */}
                <div className="mb-16">
                  <h2 className="text-xl font-bold mb-8 text-center">Testimonial Section</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {testimonials.map((testimonial, index) => (
                      <Card key={index} className="border shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex justify-center mb-4">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200">
                              <PlayCircle className="w-4 h-4 text-gray-600" />
                            </div>
                          </div>
                          <div className="h-24 bg-gray-100 rounded mb-4"></div>
                          <div className="text-center">
                            <h4 className="font-medium">{testimonial.name}</h4>
                            <p className="text-sm text-gray-600">{testimonial.role}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
                
                {/* Why Choose Us Section */}
                <div className="mb-16">
                  <h2 className="text-xl font-bold mb-8 text-center">Why Choose Us Section</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {whyChooseUs.map((section, index) => (
                      <div key={index}>
                        <h3 className="text-lg font-medium mb-4">{section.title}</h3>
                        <div className="h-24 bg-gray-100 rounded mb-4"></div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* FAQ Section */}
                <div className="mb-16">
                  <h2 className="text-xl font-bold mb-8 text-center">FAQ Section</h2>
                  <Accordion type="single" collapsible className="mb-4">
                    {faqItems.map((faq, index) => (
                      <AccordionItem key={index} value={`item-${index}`} className="border-b border-gray-200">
                        <AccordionTrigger className="text-left font-medium py-4">
                          {faq.question}
                        </AccordionTrigger>
                        <AccordionContent className="pb-4 text-gray-600">
                          {faq.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
                
                {/* CTA Section */}
                <div className="mb-16 text-center">
                  <h2 className="text-xl font-bold mb-4">CTA Heading</h2>
                  <Button className="bg-black hover:bg-gray-800 text-white px-6 py-2 rounded-md">
                    Primary CTA
                  </Button>
                </div>
              </div>
              
              {/* Right sidebar */}
              <div className="w-full md:w-1/4">
                <div className="mb-12">
                  <h3 className="text-lg font-semibold mb-2">Build trust through association.</h3>
                  <p className="text-sm text-gray-600">
                    Display testimonials, case studies, client logos and trust markers to establish credibility with your audience.
                  </p>
                </div>
                
                <div className="mb-12">
                  <h3 className="text-lg font-semibold mb-2">Present what you offer — simply and directly.</h3>
                  <p className="text-sm text-gray-600">
                    Clearly explain your services or products without jargon or unnecessary complexity.
                  </p>
                </div>
                
                <div className="mb-12">
                  <h3 className="text-lg font-semibold mb-2">Build confidence through transparency.</h3>
                  <p className="text-sm text-gray-600">
                    Outline your process, explain how you work, and set clear expectations for potential customers.
                  </p>
                </div>
                
                <div className="mb-12">
                  <h3 className="text-lg font-semibold mb-2">Show who you are and why it matters.</h3>
                  <p className="text-sm text-gray-600">
                    Share your company story, values, and mission to connect with customers on a deeper level.
                  </p>
                </div>
                
                <div className="mb-12">
                  <h3 className="text-lg font-semibold mb-2">Let your happy clients speak for you.</h3>
                  <p className="text-sm text-gray-600">
                    Feature authentic testimonials that address common objections and highlight your strengths.
                  </p>
                </div>
                
                <div className="mb-12">
                  <h3 className="text-lg font-semibold mb-2">Stand out from the competition.</h3>
                  <p className="text-sm text-gray-600">
                    Clearly communicate your unique selling proposition and why customers should choose you.
                  </p>
                </div>
                
                <div className="mb-12">
                  <h3 className="text-lg font-semibold mb-2">Overcome hesitations before they block conversion.</h3>
                  <p className="text-sm text-gray-600">
                    Address common objections proactively through an FAQ section to remove barriers to purchase.
                  </p>
                </div>
                
                <div className="mb-12">
                  <h3 className="text-lg font-semibold mb-2">Close with confidence.</h3>
                  <p className="text-sm text-gray-600">
                    End with a clear, compelling call to action that makes the next step obvious and appealing.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-10 border-t border-gray-200">
        <div className="container mx-auto px-4">
          <div className="mb-4 flex justify-center space-x-4">
            <a href="#" className="text-gray-500 hover:text-gray-800">
              <div className="h-6 w-6 rounded-full bg-gray-200"></div>
            </a>
            <a href="#" className="text-gray-500 hover:text-gray-800">
              <div className="h-6 w-6 rounded-full bg-gray-200"></div>
            </a>
          </div>
          <div className="mb-4 flex justify-center space-x-8 text-sm">
            <a href="#" className="text-gray-600 hover:text-gray-900">Privacy</a>
            <a href="#" className="text-gray-600 hover:text-gray-900">Terms</a>
            <a href="#" className="text-gray-600 hover:text-gray-900">Contact</a>
            <a href="#" className="text-gray-600 hover:text-gray-900">Support</a>
          </div>
          <div className="text-center text-xs text-gray-500">
            © 2025 Company Name. All Rights Reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
