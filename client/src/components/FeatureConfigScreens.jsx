import React, { useState, useRef, useEffect } from "react";
// UI Components
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

import {
  getStorage,
  ref,
  uploadBytesResumable,
  uploadBytes,
  getDownloadURL,
  listAll,
} from "firebase/storage";
import {
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Mail, Eye } from "lucide-react";
// Gemini AI integration
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider"; // Added Slider import
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  User,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileText,
  Link,
  UploadCloud,
  Map,
  Info,
  Zap,
  BarChart2,
  Tag,
  Layers,
  MessageSquare,
  Heart,
  ImageIcon,
  AlertCircle,
  Award,
  Type,
  Calendar,
  Cpu,
  UserPlus,
  MessageCircle,
  Loader2,
  DollarSign,
  Star,
  Clock,
  LayoutGrid,
  CircleDollarSign,
  Share2,
  CheckSquare,
  Globe,
  MapPin,
  Database,
  Palette,
  CreditCard,
  Key,
  KeySquare,
  ArrowUpCircle,
  Scan,
  Edit,
  Waves,
  ShoppingBag,
  Dumbbell,
  Briefcase,
  Coffee,
  Tablet,
  BedDouble,
  ShowerHead,
  DoorClosed,
  Shirt,
  Store,
  LucideSettings2,
  CircleHelp,
  Navigation,
  Hash,
  Sliders,
  X,
  Plus,
  ArrowDownUp,
  Music,
  RefreshCw,
  CheckCircle2,
  Utensils,
  Lightbulb,
  LinkIcon,
  BookmarkIcon,
  RepeatIcon,
  Settings,
  Check,
  Copy,
  Menu as MenuIcon,
  PanelLeft,
  QrCode,
  ShoppingCart,
  Book,
  Search,
  HelpCircle,
  Download,
  Compass,
  Volume,
  Share,
  Trophy,
  Ticket,
  PercentCircle,
  Gift,
  Bell,
  LayoutPanelTop,
  ZoomIn,
  Video,
  GraduationCap,
  Volume2,
  Smartphone,
  Users,
  Printer,
  Play,
  Pause,
  SkipBack,
} from "lucide-react";

const testQuestionAnswering = async () => {
  if (!testQuestion.trim() || configData.extractedData.length === 0) return;

  setIsGeneratingAnswer(true);

  try {
    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(
      "AIzaSyBgxzzgcT_9nyhz1D_JtfG7gevRUKQ5Vbs",
    );
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Prepare the context from extracted data
    const context = JSON.stringify(configData.extractedData, null, 2);

    // Make the Gemini API call
    const result = await model.generateContent(`
      You are an AI assistant for a museum that answers visitor questions about exhibits.
      
      CONTEXT INFORMATION:
      ${context}
      
      USER QUESTION:
      ${testQuestion}
      
      Using ONLY the information provided in the CONTEXT, please answer the question.
      If the answer is not contained in the context, say "I don't have enough information about that."
      Keep your answer concise, informative, and focused on the exhibits.
    `);

    const answerText = result.response.text();
    setTestAnswer(answerText);
  } catch (error) {
    console.error("Error testing Q&A:", error);
    setTestAnswer("Sorry, I encountered an error while generating the answer.");
  } finally {
    setIsGeneratingAnswer(false);
  }
};

/**
 * Menu Configuration Component
 * For configuring restaurant/venue menus with PDF/image upload or URL integration
 */
export const MenuConfigScreen = ({ onSave, initialData = {} }) => {
  const { toast } = useToast();
  const [configData, setConfigData] = useState({
    name: initialData.name || "Digital Menu",
    source: initialData.source || "upload",
    menuUrl: initialData.menuUrl || "",
    updateFrequency: initialData.updateFrequency || "manual",
    style: initialData.style || "modern",
    sections: initialData.sections || [],
    featuredItems: initialData.featuredItems || false,
    menuPdfUrl: initialData.menuPdfUrl || "",
    scrapedMenuData: initialData.scrapedMenuData || null,
    ...initialData,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isScrapingUrl, setIsScrapingUrl] = useState(false);
  const [scrapingStatus, setScrapingStatus] = useState("");

  // Ref for file input
  const fileInputRef = useRef(null);

  const handleChange = (field, value) => {
    setConfigData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Function to handle file upload
  // Function to handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check if file is a PDF or image
    if (!file.type.includes("pdf") && !file.type.includes("image")) {
      setError("Please upload a PDF or image file");
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("File size should be less than 10MB");
      return;
    }

    setLoading(true);
    setError("");
    setUploadProgress(0);

    try {
      // Upload file to Firebase Storage
      const storage = getStorage();
      const storageRef = ref(storage, `menus/${Date.now()}_${file.name}`);

      // Use uploadBytesResumable instead of uploadBytes for progress monitoring
      const uploadTask = uploadBytesResumable(storageRef, file);

      // Monitor upload progress
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
        },
        (error) => {
          // Handle errors
          console.error("Error uploading file:", error);
          setError(`Upload failed: ${error.message}`);

          toast({
            title: "Upload Failed",
            description: "There was an error uploading your file.",
            variant: "destructive",
            duration: 5000,
          });

          setLoading(false);
        },
        async () => {
          try {
            // Handle successful upload completion
            // Get download URL after upload completes
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

            console.log(
              "File uploaded successfully. Download URL:",
              downloadURL,
            );

            // Update config data - make sure this happens AFTER we get the URL
            handleChange("menuPdfUrl", downloadURL);

            // Force a state update to ensure the component re-renders
            setConfigData((prev) => ({
              ...prev,
              menuPdfUrl: downloadURL,
            }));

            toast({
              title: "Upload Successful",
              description: "Your menu file has been uploaded successfully.",
              variant: "success",
              duration: 5000,
            });
          } catch (error) {
            console.error("Error getting download URL:", error);
            setError("Upload completed but couldn't get download URL");
          } finally {
            setLoading(false);
          }
        },
      );
    } catch (error) {
      console.error("Error setting up upload:", error);
      setError("Failed to upload file. Please try again.");

      toast({
        title: "Upload Failed",
        description: "There was an error uploading your file.",
        variant: "destructive",
        duration: 5000,
      });

      setLoading(false);
    }
  };

  // Function to trigger file input click
  const triggerFileUpload = () => {
    fileInputRef.current.click();
  };

  // Function to scrape menu from URL
  const scrapeMenuUrl = async () => {
    if (!configData.menuUrl) {
      setError("Please enter a valid URL");
      return;
    }

    setIsScrapingUrl(true);
    setScrapingStatus("Connecting to URL...");
    setError("");

    try {
      // First, check if the URL is a direct link to a PDF
      const isPdf = configData.menuUrl.toLowerCase().endsWith(".pdf");

      if (isPdf) {
        setScrapingStatus("Detected PDF. Downloading...");
        await handlePdfDownload(configData.menuUrl);
      } else {
        // Otherwise, scrape the webpage for menu information
        await scrapeWebpageForMenu(configData.menuUrl);
      }
    } catch (error) {
      console.error("Error processing URL:", error);
      setError(
        "Failed to process the URL. Please check the URL and try again.",
      );
    } finally {
      setIsScrapingUrl(false);
    }
  };

  // Function to download PDF from URL and upload to storage
  const handlePdfDownload = async (url) => {
    setScrapingStatus("Downloading PDF...");

    try {
      // Use Firecrawl or a proxy server to fetch the PDF
      const response = await fetch("https://api.firecrawl.dev/v1/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer fc-e39118dbc4194ccfae3ed8a75e16be80",
        },
        body: JSON.stringify({
          url: url,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to download PDF");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to download PDF");
      }

      // PDF download successful, now upload to Firebase Storage
      setScrapingStatus("PDF downloaded. Uploading to storage...");

      // Convert base64 to blob
      const base64Response = await fetch(
        `data:application/pdf;base64,${data.data.base64}`,
      );
      const blob = await base64Response.blob();

      // Upload to Firebase Storage
      const storage = getStorage();
      const storageRef = ref(storage, `menus/url_${Date.now()}.pdf`);
      await uploadBytes(storageRef, blob);

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      // Update config data
      handleChange("menuPdfUrl", downloadURL);

      toast({
        title: "PDF Downloaded",
        description: "Menu PDF has been downloaded and saved.",
        variant: "success",
        duration: 5000,
      });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      setError("Failed to download and process the PDF.");
      throw error;
    }
  };

  // Function to scrape webpage for menu information
  // Function to scrape webpage for menu information
  const scrapeWebpageForMenu = async (url) => {
    setScrapingStatus("Scraping webpage for menu information...");

    try {
      // Use Firecrawl to scrape the webpage
      const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer fc-e39118dbc4194ccfae3ed8a75e16be80",
        },
        body: JSON.stringify({
          url: url,
          formats: ["html", "markdown"],
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to scrape webpage");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to scrape webpage");
      }

      // Check if there's a PDF link in the webpage
      const html = data.data.html;
      const markdown = data.data.markdown || "";
      const pdfLinkMatch = html.match(/<a[^>]*href="([^"]*\.pdf)"[^>]*>/i);

      if (pdfLinkMatch && pdfLinkMatch[1]) {
        // Found a PDF link, download it
        setScrapingStatus("Found PDF link on page. Downloading...");
        const pdfUrl = new URL(pdfLinkMatch[1], url).href;
        await handlePdfDownload(pdfUrl);
      } else {
        // No PDF link found, parse the menu information from HTML and markdown
        setScrapingStatus("Extracting menu information...");

        // Try markdown first if available (cleaner format)
        let menuData = { sections: [] };
        if (markdown && markdown.includes("*")) {
          console.log("Trying to extract from markdown");
          menuData = extractMenuFromMarkdown(markdown);
        }

        // If markdown didn't yield results, try HTML
        if (menuData.sections.length === 0) {
          console.log("Trying to extract from HTML");
          menuData = extractMenuFromHtml(html, url);
        }

        if (menuData.sections.length > 0) {
          // Update config data with scraped menu
          handleChange("scrapedMenuData", menuData);
          handleChange("sections", menuData.sections);

          toast({
            title: "Menu Extracted",
            description: `Successfully extracted ${menuData.sections.length} menu sections with ${menuData.sections.reduce((count, section) => count + (section.items?.length || 0), 0)} items.`,
            variant: "success",
            duration: 5000,
          });
        } else {
          // As a last resort, try using the content directly if it looks like a menu
          if (markdown.includes("*") && markdown.includes("$")) {
            const simpleMenuData = {
              sections: [
                {
                  name: "Menu Items",
                  items: [],
                },
              ],
            };

            // Simple regex to find items with prices
            const simpleItemRegex =
              /\*\s+([^*]+?)\s+\*\*\$(\d+(?:\.\d+)?)\*\*/g;
            let match;

            while ((match = simpleItemRegex.exec(markdown)) !== null) {
              simpleMenuData.sections[0].items.push({
                name: match[1].trim(),
                price: "$" + match[2],
                description: "",
              });
            }

            if (simpleMenuData.sections[0].items.length > 0) {
              handleChange("scrapedMenuData", simpleMenuData);
              handleChange("sections", simpleMenuData.sections);

              toast({
                title: "Menu Extracted",
                description: `Successfully extracted ${simpleMenuData.sections[0].items.length} menu items.`,
                variant: "success",
                duration: 5000,
              });
              return;
            }
          }

          setError("Could not find menu information on this page.");
        }
      }
    } catch (error) {
      console.error("Error scraping webpage:", error);
      setError("Failed to extract menu information from webpage.");
      throw error;
    }
  };

  // Function to extract menu information from HTML
  // Function to extract menu information from HTML
  const extractMenuFromHtml = (html, baseUrl) => {
    // Initialize menu data
    const menuData = {
      sections: [],
    };

    try {
      // Also check the markdown content if HTML parsing fails
      const markdown = html.includes("* ") || html.includes("**$");

      if (markdown) {
        // This looks like markdown or plaintext menu format
        console.log("Detected markdown menu format");
        return extractMenuFromMarkdown(html);
      }

      // Look for common menu section patterns
      const sectionRegexes = [
        /<h\d[^>]*>(.*?)<\/h\d>.*?<ul[^>]*>(.*?)<\/ul>/gis,
        /<div[^>]*class="[^"]*menu-section[^"]*"[^>]*>.*?<h\d[^>]*>(.*?)<\/h\d>.*?<div[^>]*class="[^"]*menu-items[^"]*"[^>]*>(.*?)<\/div>/gis,
        /<section[^>]*class="[^"]*menu[^"]*"[^>]*>.*?<h\d[^>]*>(.*?)<\/h\d>(.*?)<\/section>/gis,
        /<strong[^>]*>(.*?)<\/strong>.*?<ul[^>]*>(.*?)<\/ul>/gis,
        /<p[^>]*><strong>(.*?)<\/strong><\/p>(.*?)(?:<p[^>]*><strong>|$)/gis,
      ];

      // Try each regex pattern
      for (const regex of sectionRegexes) {
        let match;
        let foundSection = false;
        while ((match = regex.exec(html)) !== null) {
          const sectionName = match[1].replace(/<[^>]*>/g, "").trim();
          const sectionContent = match[2];

          // Skip empty sections or ones with common non-menu names
          if (
            !sectionName ||
            ["home", "about", "contact", "menu"].includes(
              sectionName.toLowerCase(),
            )
          ) {
            continue;
          }

          // Extract menu items
          const items = extractMenuItems(sectionContent);

          if (items.length > 0) {
            menuData.sections.push({
              name: sectionName,
              items: items,
            });
            foundSection = true;
          }
        }

        // If we found sections with this regex, stop trying others
        if (foundSection) break;
      }

      // Look for sections based on common section headers
      if (menuData.sections.length === 0) {
        // Common menu section names to look for
        const sectionNames = [
          "Appetizers",
          "Starters",
          "For the Table",
          "Small Plates",
          "Main Dishes",
          "Entrees",
          "Mains",
          "Large Plates",
          "Sandwiches",
          "Burgers",
          "Handhelds",
          "Sides",
          "Desserts",
          "Drinks",
          "Beverages",
        ];

        for (const sectionName of sectionNames) {
          // Look for this section name in the HTML
          const sectionRegex = new RegExp(
            `(${sectionName})[\\s\\S]*?(<ul[^>]*>.*?<\\/ul>|<div[^>]*>.*?<\\/div>)`,
            "i",
          );
          const match = html.match(sectionRegex);

          if (match) {
            const items = extractMenuItems(match[2]);
            if (items.length > 0) {
              menuData.sections.push({
                name: sectionName,
                items: items,
              });
            }
          }
        }
      }

      // If still no sections found, try to extract just menu items from the whole document
      if (menuData.sections.length === 0) {
        const items = extractMenuItems(html);
        if (items.length > 0) {
          menuData.sections.push({
            name: "Menu Items",
            items: items,
          });
        }
      }

      return menuData;
    } catch (error) {
      console.error("Error extracting menu from HTML:", error);
      return menuData;
    }
  };

  // New function to extract menu from markdown format
  const extractMenuFromMarkdown = (text) => {
    const menuData = {
      sections: [],
    };

    try {
      // Split text into lines
      const lines = text.split("\n");
      let currentSection = "Menu Items";
      let items = [];

      // Identify section headers (capitalized text followed by list items)
      const sectionHeaderRegex = /^([A-Z][A-Za-z\s&]+)$/;
      const menuItemRegex = /^\*\s+(.+?)(?:\n|$)/;
      const priceRegex = /\*\*\$(\d+(?:\.\d+)?)\*\*/;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Is this a section header?
        const sectionMatch = line.match(sectionHeaderRegex);
        if (sectionMatch && !line.includes("*")) {
          // If we already have items, add them to the previous section
          if (items.length > 0) {
            menuData.sections.push({
              name: currentSection,
              items: items,
            });
            items = [];
          }

          currentSection = sectionMatch[1];
          continue;
        }

        // Is this a menu item?
        if (line.startsWith("*")) {
          let itemName = line.substring(1).trim();
          let itemDescription = "";
          let itemPrice = "";

          // Look for price in current line
          const priceMatch = line.match(priceRegex);
          if (priceMatch) {
            itemPrice = "$" + priceMatch[1];
            itemName = itemName.replace(priceRegex, "").trim();
          }

          // Check next lines for description and price
          let j = i + 1;
          while (
            j < lines.length &&
            !lines[j].trim().startsWith("*") &&
            !lines[j].match(sectionHeaderRegex)
          ) {
            const nextLine = lines[j].trim();

            // Is this line a price?
            const nextPriceMatch = nextLine.match(priceRegex);
            if (nextPriceMatch) {
              itemPrice = "$" + nextPriceMatch[1];
            }
            // Otherwise it's part of the description
            else if (nextLine && !nextLine.match(sectionHeaderRegex)) {
              itemDescription += " " + nextLine;
            }

            j++;
          }

          // Clean up description and name
          itemDescription = itemDescription.trim();
          itemName = itemName.replace(priceRegex, "").trim();

          if (itemName && itemPrice) {
            items.push({
              name: itemName,
              price: itemPrice,
              description: itemDescription,
            });
          }
        }
      }

      // Add any remaining items
      if (items.length > 0) {
        menuData.sections.push({
          name: currentSection,
          items: items,
        });
      }

      return menuData;
    } catch (error) {
      console.error("Error extracting menu from markdown:", error);
      return menuData;
    }
  };

  // Function to extract menu items from HTML
  // Function to extract menu items from HTML
  const extractMenuItems = (html) => {
    const items = [];

    try {
      // Check if this is markdown-style with asterisks
      if (html.includes("* ") && html.includes("**$")) {
        const lines = html.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          if (line.startsWith("*")) {
            const itemMatch = {
              name: line.substring(1).trim(),
              price: "",
              description: "",
            };

            // Look for price in bold format **$XX**
            const priceMatch = line.match(/\*\*\$(\d+(?:\.\d+)?)\*\*/);
            if (priceMatch) {
              itemMatch.price = "$" + priceMatch[1];
              itemMatch.name = itemMatch.name
                .replace(/\*\*\$\d+(?:\.\d+)?\*\*/, "")
                .trim();
            }

            // Look at next lines for description (not starting with *)
            let j = i + 1;
            while (j < lines.length && !lines[j].trim().startsWith("*")) {
              const descLine = lines[j].trim();

              // If it contains a price in the format **$XX**
              const descPriceMatch = descLine.match(
                /\*\*\$(\d+(?:\.\d+)?)\*\*/,
              );
              if (descPriceMatch && !itemMatch.price) {
                itemMatch.price = "$" + descPriceMatch[1];
              } else if (descLine) {
                itemMatch.description += " " + descLine;
              }

              j++;
            }

            if (itemMatch.name && itemMatch.price) {
              items.push({
                name: itemMatch.name,
                price: itemMatch.price,
                description: itemMatch.description.trim(),
              });
            }
          }
        }

        // If we found items, return them
        if (items.length > 0) {
          return items;
        }
      }

      // Look for common menu item patterns (HTML format)
      const itemRegexes = [
        /<li[^>]*>.*?<strong[^>]*>(.*?)<\/strong>.*?(\$\d+\.?\d*|\d+\.?\d*\s*\$).*?(?:<p[^>]*>(.*?)<\/p>|<span[^>]*>(.*?)<\/span>)?/gi,
        /<div[^>]*class="[^"]*menu-item[^"]*"[^>]*>.*?<h\d[^>]*>(.*?)<\/h\d>.*?<span[^>]*class="[^"]*price[^"]*"[^>]*>(\$\d+\.?\d*|\d+\.?\d*\s*\$)<\/span>.*?(?:<p[^>]*>(.*?)<\/p>|<div[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/div>)?/gi,
        /<div[^>]*class="[^"]*item[^"]*"[^>]*>.*?<div[^>]*class="[^"]*name[^"]*"[^>]*>(.*?)<\/div>.*?<div[^>]*class="[^"]*price[^"]*"[^>]*>(\$\d+\.?\d*|\d+\.?\d*\s*\$)<\/div>.*?(?:<div[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/div>)?/gi,
        /<li[^>]*>(.*?)(?:<br\s*\/>|\n)(.*?)(\$\d+\.?\d*|\d+\.?\d*\s*\$)/gi,
        /<p[^>]*>(.*?)<\/p>.*?<p[^>]*>.*?(\$\d+\.?\d*|\d+\.?\d*\s*\$)/gi,
        /<div[^>]*>(.*?)<\/div>.*?<div[^>]*>.*?(\$\d+\.?\d*|\d+\.?\d*\s*\$)/gi,
      ];

      // Try each regex pattern
      for (const regex of itemRegexes) {
        let match;
        while ((match = regex.exec(html)) !== null) {
          const name = match[1].replace(/<[^>]*>/g, "").trim();
          const price = (match[2] || "").replace(/<[^>]*>/g, "").trim();
          const description = (match[3] || match[4] || "")
            .replace(/<[^>]*>/g, "")
            .trim();

          if (name && price && /\$\d+/.test(price)) {
            items.push({
              name: name,
              price: price,
              description: description,
            });
          }
        }
      }

      // If still no items, try a very simple pattern matching
      if (items.length === 0) {
        // Look for any content with $ followed by a number
        const simplePattern = /([^$\n]+)(\$\d+(?:\.\d+)?)/g;
        let match;

        while ((match = simplePattern.exec(html)) !== null) {
          const possibleName = match[1].trim();
          const possiblePrice = match[2].trim();

          // Skip if it looks like a non-menu price (like shipping costs, etc)
          if (
            possibleName.length > 3 &&
            possibleName.length < 100 &&
            !possibleName.match(/shipping|tax|total|subtotal|fee/i)
          ) {
            items.push({
              name: possibleName,
              price: possiblePrice,
              description: "",
            });
          }
        }
      }

      return items;
    } catch (error) {
      console.error("Error extracting menu items:", error);
      return items;
    }
  };

  // Add menu section
  const addMenuSection = (sectionName) => {
    if (!sectionName.trim()) return;

    const newSection = {
      name: sectionName,
      items: [],
    };

    setConfigData((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
  };

  // Remove menu section
  const removeMenuSection = (index) => {
    setConfigData((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">Configure Digital Menu</h1>
          <p className="text-gray-500 text-sm">
            Set up how your menu appears in the digital experience
          </p>
        </div>
        <div className="bg-orange-100 p-3 rounded-full">
          <MenuIcon className="h-6 w-6 text-orange-600" />
        </div>
      </div>

      <Tabs defaultValue="source" className="w-full">
        <TabsList className="grid grid-cols-2 mb-4">
          <TabsTrigger value="source">Menu Source</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="source" className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="menu-name">Menu Name</Label>
              <Input
                id="menu-name"
                placeholder="e.g. Lunch Menu, Dinner Specials"
                value={configData.name}
                onChange={(e) => handleChange("name", e.target.value)}
              />
            </div>

            <RadioGroup
              value={configData.source}
              onValueChange={(value) => handleChange("source", value)}
              className="space-y-4"
            >
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="upload" id="upload" />
                  <Label htmlFor="upload" className="font-medium">
                    Upload Menu
                  </Label>
                </div>
                <p className="text-sm text-gray-500 ml-6">
                  Upload PDF or images of your menu
                </p>

                {configData.source === "upload" && (
                  <div className="mt-3 ml-6">
                    {/* Hidden file input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="application/pdf,image/*"
                      onChange={handleFileUpload}
                    />

                    {/* Dropzone */}
                    <div
                      className="p-4 border-2 border-dashed rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={triggerFileUpload}
                    >
                      <div className="text-center">
                        <UploadCloud className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm font-medium mb-1">
                          Drag and drop your menu file
                        </p>
                        <p className="text-xs text-gray-500 mb-3">
                          PDF, JPG, or PNG (max 10MB)
                        </p>
                        <Button variant="outline" size="sm" type="button">
                          Browse Files
                        </Button>
                      </div>
                    </div>

                    {/* Error message */}
                    {error && (
                      <p className="text-xs text-red-500 mt-2">{error}</p>
                    )}

                    {/* Upload progress */}
                    {loading && (
                      <div className="mt-2">
                        <div className="flex items-center text-sm text-orange-600">
                          <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                          <span>Uploading: {uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                          <div
                            className="bg-orange-600 h-1.5 rounded-full"
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="url" id="url" />
                  <Label htmlFor="url" className="font-medium">
                    Connect URL
                  </Label>
                </div>
                <p className="text-sm text-gray-500 ml-6">
                  Connect to a URL with your menu information
                </p>

                {configData.source === "url" && (
                  <div className="mt-3 ml-6 space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://example.com/menu"
                        value={configData.menuUrl}
                        onChange={(e) =>
                          handleChange("menuUrl", e.target.value)
                        }
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        onClick={scrapeMenuUrl}
                        disabled={isScrapingUrl || !configData.menuUrl}
                      >
                        {isScrapingUrl ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          "Analyze URL"
                        )}
                      </Button>
                    </div>

                    {isScrapingUrl && scrapingStatus && (
                      <div className="text-xs text-orange-600">
                        <div className="flex items-center mb-1">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          <span>{scrapingStatus}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-orange-600 h-1.5 rounded-full"
                            style={{ width: isScrapingUrl ? "60%" : "0%" }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {error && <p className="text-xs text-red-500">{error}</p>}

                    <div className="flex gap-2">
                      <Select
                        value={configData.updateFrequency}
                        onValueChange={(value) =>
                          handleChange("updateFrequency", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Update Frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="realtime">Real-time</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="manual">Manual Updates</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="api" id="api" />
                  <Label htmlFor="api" className="font-medium">
                    Connect API
                  </Label>
                </div>
                <p className="text-sm text-gray-500 ml-6">
                  Connect to your POS or Menu API
                </p>

                {configData.source === "api" && (
                  <div className="mt-3 ml-6 space-y-3">
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select POS System" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="square">Square</SelectItem>
                        <SelectItem value="toast">Toast</SelectItem>
                        <SelectItem value="clover">Clover</SelectItem>
                        <SelectItem value="shopify">Shopify</SelectItem>
                        <SelectItem value="custom">Custom API</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input placeholder="API Key or Access Token" />
                    <Button variant="outline" size="sm">
                      Test Connection
                    </Button>
                  </div>
                )}
              </div>
            </RadioGroup>
          </div>

          {/* Menu Preview Section */}
          {(configData.menuPdfUrl || configData.scrapedMenuData) && (
            <div className="border rounded-lg p-4 mt-4">
              <h4 className="font-medium mb-3 flex items-center">
                <Eye className="h-4 w-4 mr-1.5 text-gray-500" />
                Menu Preview
              </h4>

              {/* PDF Preview */}
              {(configData.menuPdfUrl || configData.scrapedMenuData) && (
                <div className="border rounded-lg p-4 mt-4">
                  <h4 className="font-medium mb-3 flex items-center">
                    <Eye className="h-4 w-4 mr-1.5 text-gray-500" />
                    Menu Preview
                  </h4>
                  {/* PDF Preview */}
                  {configData.menuPdfUrl && (
                    <div className="rounded-lg overflow-hidden border">
                      <div className="bg-gray-100 p-2 flex justify-between items-center">
                        <span className="text-sm font-medium">
                          <FileText className="h-4 w-4 mr-1.5 inline-block" />
                          Menu PDF
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="h-7 px-2 text-xs"
                          >
                            <a
                              href={configData.menuPdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Open PDF
                            </a>
                          </Button>
                        </div>
                      </div>
                      <div className="relative">
                        <iframe
                          src={configData.menuPdfUrl}
                          className="w-full h-96 border-t"
                          title="Menu PDF Preview"
                        ></iframe>
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 p-4">
                          <FileText className="h-10 w-10 text-orange-500 mb-2" />
                          <h3 className="text-sm font-medium">
                            PDF Successfully Uploaded
                          </h3>
                          <p className="text-xs text-gray-600 mb-3 text-center">
                            Your menu PDF has been uploaded. View in browser or
                            download for best results.
                          </p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" asChild>
                              <a
                                href={configData.menuPdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center"
                              >
                                <Eye className="h-3.5 w-3.5 mr-1.5" />
                                View PDF
                              </a>
                            </Button>
                            <Button size="sm" asChild>
                              <a
                                href={configData.menuPdfUrl}
                                download="menu.pdf"
                                className="flex items-center"
                              >
                                <Download className="h-3.5 w-3.5 mr-1.5" />
                                Download PDF
                              </a>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Scraped Menu Preview */}
              {configData.scrapedMenuData && !configData.menuPdfUrl && (
                <div className="space-y-4">
                  {configData.sections.map((section, index) => (
                    <div
                      key={index}
                      className="rounded-lg border overflow-hidden"
                    >
                      <div className="bg-orange-50 p-2 border-b">
                        <h5 className="font-medium">{section.name}</h5>
                      </div>
                      <div className="p-3">
                        {section.items && section.items.length > 0 ? (
                          <div className="space-y-2">
                            {section.items.map((item, i) => (
                              <div key={i} className="flex justify-between">
                                <div>
                                  <p className="font-medium text-sm">
                                    {item.name}
                                  </p>
                                  {item.description && (
                                    <p className="text-xs text-gray-600">
                                      {item.description}
                                    </p>
                                  )}
                                </div>
                                <span className="text-sm font-semibold">
                                  {item.price}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 text-center py-2">
                            No items in this section
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Menu Style</Label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "modern", label: "Modern", color: "bg-blue-600" },
                  { value: "classic", label: "Classic", color: "bg-amber-700" },
                  {
                    value: "minimalist",
                    label: "Minimal",
                    color: "bg-gray-800",
                  },
                ].map((style) => (
                  <div
                    key={style.value}
                    className={`cursor-pointer transition-all rounded-lg overflow-hidden border-2 ${configData.style === style.value ? "border-primary ring-2 ring-primary/20" : "border-gray-200"}`}
                    onClick={() => handleChange("style", style.value)}
                  >
                    <div
                      className={`${style.color} h-16 flex items-center justify-center`}
                    >
                      <MenuIcon className="h-6 w-6 text-white" />
                    </div>
                    <div className="p-2 text-center text-sm font-medium">
                      {style.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Menu Sections</Label>
              <div className="border rounded-lg p-4 space-y-3">
                {configData.sections.map((section, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center border-b pb-2"
                  >
                    <div className="font-medium">{section.name}</div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMenuSection(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="flex gap-2">
                  <Input
                    placeholder="Section Name (e.g. Appetizers)"
                    id="sectionName"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const input = document.getElementById("sectionName");
                      if (input) {
                        addMenuSection(input.value);
                        input.value = "";
                      }
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="featured-items" className="block mb-1">
                  Featured Items
                </Label>
                <span className="text-sm text-gray-500">
                  Highlight special items in your menu
                </span>
              </div>
              <Switch
                id="featured-items"
                checked={configData.featuredItems}
                onCheckedChange={(checked) =>
                  handleChange("featuredItems", checked)
                }
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="border-t pt-4 flex justify-end">
        <Button onClick={() => onSave(configData)}>
          Save Menu Configuration
        </Button>
      </div>
    </div>
  );
};

/**
 * Navigation Configuration Component
 * For configuring wayfinding features with dynamic areas based on location type
 */
export const NavigationConfigScreen = ({
  onSave,
  initialData = {},
  blueprintId,
  locationType = "museum",
  exhibitData = null, // Add prop for exhibit data from previous configuration
}) => {
  const { toast } = useToast();
  const [configData, setConfigData] = useState({
    name: initialData.name || "Navigation",
    style: initialData.style || "map-view",
    keyAreas: initialData.keyAreas || getDefaultKeyAreas(locationType),
    customAreas: initialData.customAreas || [],
    ...initialData,
  });
  const [newAreaName, setNewAreaName] = useState("");
  const [showExhibitImport, setShowExhibitImport] = useState(false);

  // Check if we have exhibit data that can be imported
  const hasImportableExhibits =
    exhibitData &&
    (exhibitData.extractedData?.length > 0 ||
      exhibitData.exhibitData?.length > 0);

  useEffect(() => {
    // If we have exhibit data, show the import option
    if (hasImportableExhibits) {
      setShowExhibitImport(true);
    }
  }, [hasImportableExhibits]);

  const handleChange = (field, value) => {
    setConfigData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddCustomArea = () => {
    if (!newAreaName.trim()) return;

    const newArea = {
      id: `area-${Date.now()}`,
      name: newAreaName.trim(),
      enabled: true,
      custom: true,
    };

    setConfigData((prev) => ({
      ...prev,
      customAreas: [...prev.customAreas, newArea],
    }));

    setNewAreaName("");
  };

  const toggleAreaEnabled = (areaId, isCustom) => {
    setConfigData((prev) => {
      if (isCustom) {
        return {
          ...prev,
          customAreas: prev.customAreas.map((area) =>
            area.id === areaId ? { ...area, enabled: !area.enabled } : area,
          ),
        };
      } else {
        return {
          ...prev,
          keyAreas: prev.keyAreas.map((area) =>
            area.id === areaId ? { ...area, enabled: !area.enabled } : area,
          ),
        };
      }
    });
  };

  // Updated to remove any area (key or custom)
  const removeArea = (areaId, isCustom) => {
    if (isCustom) {
      setConfigData((prev) => ({
        ...prev,
        customAreas: prev.customAreas.filter((area) => area.id !== areaId),
      }));
    } else {
      setConfigData((prev) => ({
        ...prev,
        keyAreas: prev.keyAreas.filter((area) => area.id !== areaId),
      }));
    }

    toast({
      title: "Area Removed",
      description: "The area has been removed from your navigation",
      variant: "default",
    });
  };

  // Import exhibits as navigation areas
  const importExhibits = () => {
    if (!hasImportableExhibits) return;

    const newAreas = [];

    // Process extracted data (from website scraping)
    if (exhibitData.extractedData?.length > 0) {
      exhibitData.extractedData.forEach((exhibit, index) => {
        if (exhibit.name) {
          newAreas.push({
            id: `exhibit-${Date.now()}-${index}`,
            name: exhibit.name,
            description:
              exhibit.description ||
              `Exhibit in your ${getLocationTypeDisplay(locationType)}`,
            enabled: true,
            fromExhibit: true,
            exhibitId: exhibit.id,
          });
        }
      });
    }

    // Process manually entered exhibit data
    if (exhibitData.exhibitData?.length > 0) {
      exhibitData.exhibitData.forEach((exhibit, index) => {
        if (exhibit.name) {
          newAreas.push({
            id: `exhibit-${Date.now()}-${index + 100}`, // Offset to avoid ID collisions
            name: exhibit.name,
            description:
              exhibit.description ||
              `Exhibit in your ${getLocationTypeDisplay(locationType)}`,
            enabled: true,
            fromExhibit: true,
            exhibitId: exhibit.id,
          });
        }
      });
    }

    // Add the new areas to configuration
    setConfigData((prev) => ({
      ...prev,
      keyAreas: [...prev.keyAreas, ...newAreas],
    }));

    // Hide the import option after importing
    setShowExhibitImport(false);

    toast({
      title: "Exhibits Imported",
      description: `${newAreas.length} exhibits have been added as navigation areas`,
      variant: "success",
    });
  };

  const handleSubmit = async () => {
    try {
      // Prepare the final data
      const finalData = {
        ...configData,
        allAreas: [
          ...configData.keyAreas.filter((a) => a.enabled),
          ...configData.customAreas.filter((a) => a.enabled),
        ],
        lastUpdated: new Date().toISOString(),
      };

      // Call onSave with the final configuration
      await onSave(finalData);

      // Show success toast
      toast({
        title: "Configuration Saved",
        description: "Next, you'll mark these areas in the 3D view",
        variant: "success",
      });
    } catch (error) {
      console.error("Error saving navigation config:", error);
      toast({
        title: "Save Failed",
        description: "Could not save configuration. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">Configure Navigation</h1>
          <p className="text-gray-500 text-sm">
            Set up how visitors navigate your space
          </p>
        </div>
        <div className="bg-blue-100 p-3 rounded-full">
          <Map className="h-6 w-6 text-blue-600" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="nav-name">Feature Name</Label>
          <Input
            id="nav-name"
            placeholder="Navigation & Wayfinding"
            value={configData.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
        </div>

        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <h4 className="font-medium text-blue-800 mb-2 flex items-center">
            <Map className="h-4 w-4 mr-1.5" />
            Navigation Style
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                id: "map-view",
                label: "Map View",
                description: "Interactive map",
                icon: <Globe />,
              },
              {
                id: "pinpoint",
                label: "Pinpoint Marker",
                description: "AR location markers",
                icon: <MapPin />,
              },
            ].map((style) => (
              <div
                key={style.id}
                className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-blue-500 transition-all flex flex-col items-center text-center ${configData.style === style.id ? "border-blue-500 bg-blue-50/50" : ""}`}
                onClick={() => handleChange("style", style.id)}
              >
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                  {React.cloneElement(style.icon, {
                    className: "h-6 w-6 text-blue-600",
                  })}
                </div>
                <span className="text-sm font-medium">{style.label}</span>
                <span className="text-xs text-gray-500 mt-1">
                  {style.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Exhibit Import UI - Show only when exhibits are available */}
        {showExhibitImport && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium text-indigo-800 flex items-center">
                <Database className="h-4 w-4 mr-1.5" />
                Import Exhibits
              </h4>
              <Badge className="bg-indigo-100 text-indigo-800">
                {(exhibitData.extractedData?.length || 0) +
                  (exhibitData.exhibitData?.length || 0)}{" "}
                Available
              </Badge>
            </div>

            <p className="text-sm text-indigo-700 mb-3">
              Use your exhibit information to automatically create navigation
              areas
            </p>

            <Button
              onClick={importExhibits}
              variant="outline"
              className="border-indigo-200 bg-white w-full"
            >
              <Database className="h-4 w-4 mr-1.5" />
              Import Exhibits as Navigation Areas
            </Button>
          </div>
        )}

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Key Areas</h4>
          <p className="text-sm text-gray-500 mb-4">
            Select the areas visitors need to navigate to in your{" "}
            {getLocationTypeDisplay(locationType)}
          </p>

          <div className="space-y-2 mb-4">
            {configData.keyAreas.map((area) => (
              <div
                key={area.id}
                className="flex items-center p-2 bg-gray-50 rounded-md"
              >
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  {getAreaIcon(area.name)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center">
                    <p className="text-sm font-medium">{area.name}</p>
                    {area.fromExhibit && (
                      <Badge className="ml-2 bg-indigo-100 text-indigo-800 text-xs">
                        Exhibit
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {area.description ||
                      `Key area in your ${getLocationTypeDisplay(locationType)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={area.enabled}
                    onCheckedChange={() => toggleAreaEnabled(area.id, false)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                    onClick={() => removeArea(area.id, false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {configData.customAreas.map((area) => (
              <div
                key={area.id}
                className="flex items-center p-2 bg-gray-50 rounded-md"
              >
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <MapPin className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{area.name}</p>
                  <p className="text-xs text-gray-500">Custom area</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={area.enabled}
                    onCheckedChange={() => toggleAreaEnabled(area.id, true)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                    onClick={() => removeArea(area.id, true)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Add custom area..."
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddCustomArea}
              disabled={!newAreaName.trim()}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Area
            </Button>
          </div>
        </div>

        {/* Navigation features section removed as requested */}
      </div>

      <div className="border-t pt-4 flex justify-end">
        <Button onClick={handleSubmit}>Save & Continue to Area Marking</Button>
      </div>
    </div>
  );
};

// Helper function to get default key areas based on location type
function getDefaultKeyAreas(locationType) {
  const areas = {
    museum: [
      {
        id: "area-1",
        name: "Main Entrance",
        enabled: true,
        description: "Main entrance to the museum",
      },
      {
        id: "area-2",
        name: "Ticket Desk",
        enabled: true,
        description: "Where visitors purchase tickets",
      },
      {
        id: "area-3",
        name: "Main Gallery",
        enabled: true,
        description: "Primary exhibition space",
      },
      {
        id: "area-4",
        name: "Special Exhibits",
        enabled: true,
        description: "Temporary exhibitions",
      },
      {
        id: "area-5",
        name: "Gift Shop",
        enabled: true,
        description: "Museum store",
      },
      {
        id: "area-6",
        name: "Cafeteria",
        enabled: false,
        description: "Food and refreshments",
      },
      {
        id: "area-7",
        name: "Restrooms",
        enabled: true,
        description: "Visitor facilities",
      },
      {
        id: "area-8",
        name: "Information Desk",
        enabled: true,
        description: "Visitor information",
      },
    ],
    retail: [
      {
        id: "area-1",
        name: "Main Entrance",
        enabled: true,
        description: "Store entrance",
      },
      {
        id: "area-2",
        name: "Checkout Area",
        enabled: true,
        description: "Payment counter",
      },
      {
        id: "area-3",
        name: "Product Displays",
        enabled: true,
        description: "Main product area",
      },
      {
        id: "area-4",
        name: "Fitting Rooms",
        enabled: false,
        description: "Try on clothing",
      },
      {
        id: "area-5",
        name: "Customer Service",
        enabled: true,
        description: "Help desk",
      },
    ],
    restaurant: [
      {
        id: "area-1",
        name: "Entrance",
        enabled: true,
        description: "Restaurant entrance",
      },
      {
        id: "area-2",
        name: "Host Stand",
        enabled: true,
        description: "Check-in area",
      },
      {
        id: "area-3",
        name: "Dining Area",
        enabled: true,
        description: "Main seating",
      },
      {
        id: "area-4",
        name: "Bar",
        enabled: false,
        description: "Drinks and cocktails",
      },
      {
        id: "area-5",
        name: "Restrooms",
        enabled: true,
        description: "Visitor facilities",
      },
      {
        id: "area-6",
        name: "Outdoor Seating",
        enabled: false,
        description: "Patio dining",
      },
    ],
    office: [
      {
        id: "area-1",
        name: "Reception",
        enabled: true,
        description: "Main entrance",
      },
      {
        id: "area-2",
        name: "Meeting Rooms",
        enabled: true,
        description: "Conference spaces",
      },
      {
        id: "area-3",
        name: "Workspaces",
        enabled: true,
        description: "Desk areas",
      },
      {
        id: "area-4",
        name: "Break Room",
        enabled: true,
        description: "Rest area",
      },
      {
        id: "area-5",
        name: "Executive Offices",
        enabled: false,
        description: "Management offices",
      },
    ],
    hotel: [
      {
        id: "area-1",
        name: "Lobby",
        enabled: true,
        description: "Main entrance",
      },
      {
        id: "area-2",
        name: "Front Desk",
        enabled: true,
        description: "Check-in area",
      },
      {
        id: "area-3",
        name: "Elevators",
        enabled: true,
        description: "Access to floors",
      },
      {
        id: "area-4",
        name: "Restaurant",
        enabled: false,
        description: "Dining area",
      },
      {
        id: "area-5",
        name: "Pool",
        enabled: false,
        description: "Swimming area",
      },
      {
        id: "area-6",
        name: "Fitness Center",
        enabled: false,
        description: "Exercise facility",
      },
    ],
    default: [
      { id: "area-1", name: "Main Entrance", enabled: true },
      { id: "area-2", name: "Information Point", enabled: true },
    ],
  };

  return areas[locationType] || areas.default;
}

// Helper function to get friendlier location type display names
function getLocationTypeDisplay(locationType) {
  const displayNames = {
    museum: "museum",
    retail: "store",
    restaurant: "restaurant",
    office: "office space",
    hotel: "hotel",
  };

  return displayNames[locationType] || "space";
}

// Helper function to get appropriate icons for different area types
function getAreaIcon(areaName) {
  const areaNameLower = areaName.toLowerCase();

  if (areaNameLower.includes("entrance") || areaNameLower.includes("lobby")) {
    return <PanelLeft className="h-4 w-4 text-blue-600" />;
  } else if (
    areaNameLower.includes("checkout") ||
    areaNameLower.includes("desk")
  ) {
    return <ShoppingCart className="h-4 w-4 text-blue-600" />;
  } else if (
    areaNameLower.includes("gallery") ||
    areaNameLower.includes("exhibit")
  ) {
    return <LayoutPanelTop className="h-4 w-4 text-blue-600" />;
  } else if (
    areaNameLower.includes("shop") ||
    areaNameLower.includes("store")
  ) {
    return <ShoppingBag className="h-4 w-4 text-blue-600" />;
  } else if (
    areaNameLower.includes("restroom") ||
    areaNameLower.includes("bathroom")
  ) {
    return <User className="h-4 w-4 text-blue-600" />;
  } else if (
    areaNameLower.includes("food") ||
    areaNameLower.includes("cafe") ||
    areaNameLower.includes("restaurant")
  ) {
    return <Coffee className="h-4 w-4 text-blue-600" />;
  } else if (
    areaNameLower.includes("information") ||
    areaNameLower.includes("help")
  ) {
    return <HelpCircle className="h-4 w-4 text-blue-600" />;
  } else {
    return <Map className="h-4 w-4 text-blue-600" />;
  }
}

/**
 * Product Information Configuration Component
 */
export const ProductInfoConfigScreen = ({ onSave, initialData = {} }) => {
  const [configData, setConfigData] = useState({
    name: initialData.name || "Product Information",
    displayMethod: initialData.displayMethod || "scan",
    displayFields: initialData.displayFields || {
      price: true,
      specs: true,
      reviews: true,
      variants: false,
      inventory: false,
      related: false,
    },
    dataSource: initialData.dataSource || "manual",
    ...initialData,
  });

  const handleChange = (field, value) => {
    setConfigData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">
            Configure Product Information
          </h1>
          <p className="text-gray-500 text-sm">
            Set up how product details are displayed in AR
          </p>
        </div>
        <div className="bg-indigo-100 p-3 rounded-full">
          <Info className="h-6 w-6 text-indigo-600" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="feature-name">Feature Name</Label>
          <Input
            id="feature-name"
            placeholder="e.g. Product Details"
            value={configData.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
        </div>

        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
          <h4 className="font-medium text-indigo-800 mb-2 flex items-center">
            <Info className="h-4 w-4 mr-1.5" />
            Product Information Options
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                id: "scan",
                label: "Scan Products",
                description: "Point device at products",
                icon: <QrCode />,
              },
              {
                id: "qr",
                label: "QR Codes",
                description: "Scan product QR codes",
                icon: <QrCode />,
              },
            ].map((method) => (
              <div
                key={method.id}
                className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-indigo-500 transition-all flex flex-col items-center text-center ${configData.displayMethod === method.id ? "border-indigo-500 bg-indigo-50/50" : ""}`}
                onClick={() => handleChange("displayMethod", method.id)}
              >
                <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center mb-2">
                  {React.cloneElement(method.icon, {
                    className: "h-6 w-6 text-indigo-600",
                  })}
                </div>
                <span className="text-sm font-medium">{method.label}</span>
                <span className="text-xs text-gray-500 mt-1">
                  {method.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Information to Display</h4>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { id: "price", label: "Price & Discounts" },
              { id: "specs", label: "Specifications" },
              { id: "reviews", label: "Customer Reviews" },
              { id: "variants", label: "Product Variants" },
              { id: "inventory", label: "Stock Levels" },
              { id: "related", label: "Related Products" },
            ].map((field) => (
              <div key={field.id} className="flex items-center space-x-2">
                <Checkbox
                  id={field.id}
                  checked={configData.displayFields[field.id]}
                  onCheckedChange={(checked) => {
                    handleChange("displayFields", {
                      ...configData.displayFields,
                      [field.id]: !!checked,
                    });
                  }}
                />
                <label htmlFor={field.id} className="text-sm cursor-pointer">
                  {field.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Data Source</h4>
          <div className="space-y-3">
            <RadioGroup
              value={configData.dataSource}
              onValueChange={(value) => handleChange("dataSource", value)}
            >
              {[
                { id: "manual", label: "Manual Entry" },
                { id: "shopify", label: "Import from Shopify" },
                { id: "csv", label: "Upload CSV" },
                { id: "api", label: "API Integration" },
              ].map((source) => (
                <div key={source.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={source.id} id={source.id} />
                  <Label htmlFor={source.id}>{source.label}</Label>
                </div>
              ))}
            </RadioGroup>

            {configData.dataSource === "api" && (
              <div className="pt-3 space-y-3">
                <Input placeholder="API Endpoint URL" />
                <Input placeholder="API Key (if required)" />
                <Button variant="outline" size="sm">
                  Test Connection
                </Button>
              </div>
            )}

            {configData.dataSource === "csv" && (
              <div className="pt-3">
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <UploadCloud className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm font-medium mb-1">
                    Upload your product data CSV
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    CSV file with product information
                  </p>
                  <Button variant="outline" size="sm">
                    Upload File
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t pt-4 flex justify-end">
        <Button onClick={() => onSave(configData)}>
          Save Product Information Configuration
        </Button>
      </div>
    </div>
  );
};

/**
 * Interactive Experiences Configuration Component
 */
export const InteractiveExperiencesConfigScreen = ({
  onSave,
  initialData = {},
}) => {
  const { toast } = useToast(); // Add this line to initialize toast

  const [configData, setConfigData] = useState({
    name: initialData.name || "Interactive Experience",
    type: initialData.type || "quiz",
    contentCreation: initialData.contentCreation || "ai", // 'ai' or 'manual'
    timeSpent: initialData.timeSpent || "medium",
    difficultyLevel: initialData.difficultyLevel || "medium",
    rewardMechanism: initialData.rewardMechanism || "points",
    questionCount: initialData.questionCount || 5,
    features: initialData.features || {
      soundEffects: true,
      socialSharing: true,
      leaderboard: false,
      multiplayer: false,
    },
    generatedContent: initialData.generatedContent || [], // Store generated questions/statements
    ...initialData,
  });

  const [generatingContent, setGeneratingContent] = useState(false);

  const handleChange = (field, value) => {
    setConfigData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Function to simulate generating content
  const generateContent = async () => {
    setGeneratingContent(true);

    try {
      // Get location information (replace with your actual location data retrieval)
      const locationInfo = "Your Business Name"; // This should come from your Firebase or context

      // Create the appropriate prompt based on type
      let prompt = "";
      if (configData.type === "quiz") {
        prompt = `${locationInfo} - I'm creating a mini-quiz interactive experience for customers that come in to have fun and increase brand knowledge - give me ${configData.questionCount} different questions along with their answers to ask customers during their visit`;
      } else {
        prompt = `${locationInfo} - I'm creating a fact or fiction interactive experience for customers that come in to have fun and increase industry knowledge - give me ${configData.questionCount} different fact or fiction questions on the industry along with the answer`;
      }

      // Call Perplexity API
      const response = await fetch(
        "https://api.perplexity.ai/chat/completions",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization:
              "Bearer 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",
          },
          body: JSON.stringify({
            model: "sonar-pro",
            messages: [
              {
                role: "system",
                content:
                  "You are generating interactive content for a business. Be precise, engaging, and educational.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
          }),
        },
      );

      // In generateContent function, after Perplexity API call
      const data = await response.json();
      console.log("Perplexity API response:", data);
      const rawContent = data.choices[0].message.content;
      console.log("Raw content from Perplexity:", rawContent);

      // In formatContentWithGemini function, after Gemini API call
      const result = await model.generateContent(prompt);
      console.log("Gemini API response:", result);
      const formattedText = result.response.text();
      console.log("Formatted text from Gemini:", formattedText);

      // Format the content using Gemini
      const formattedContent = await formatContentWithGemini(
        rawContent,
        configData.type,
      );

      // Update state with the generated content
      setConfigData((prev) => ({
        ...prev,
        generatedContent: formattedContent,
      }));

      toast({
        title: "Content Generated",
        description: `Your ${configData.type === "quiz" ? "quiz" : "fact or fiction game"} has been created successfully.`,
        variant: "success",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error generating content:", error);
      toast({
        title: "Error",
        description: "Failed to generate content. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setGeneratingContent(false);
    }
  };

  // Function to format content with Gemini
  const formatContentWithGemini = async (rawContent, type) => {
    try {
      // Initialize Gemini AI (similar to your existing code in paste-2.txt)
      const genAI = new GoogleGenerativeAI(
        "AIzaSyBgxzzgcT_9nyhz1D_JtfG7gevRUKQ5Vbs",
      );
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      // Create prompt based on type
      let prompt = "";
      if (type === "quiz") {
        prompt = `
          Format the following quiz content into a structured JSON array with question and answer fields.
          Each item should have the format: { "question": "What is...?", "answer": "The answer is..." }

          Raw content:
          ${rawContent}
        `;
      } else {
        prompt = `
          Format the following fact or fiction content into a structured JSON array.
          Each item should have the format: { "statement": "Statement text...", "isTrue": true/false, "explanation": "Why it's true/false..." }

          Raw content:
          ${rawContent}
        `;
      }

      // Generate formatted content
      const result = await model.generateContent(prompt);
      const formattedText = result.response.text();

      // Extract JSON from the response
      const jsonMatch = formattedText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback in case JSON parsing fails
      return type === "quiz"
        ? [{ question: "Sample question?", answer: "Sample answer" }]
        : [
            {
              statement: "Sample statement",
              isTrue: true,
              explanation: "Sample explanation",
            },
          ];
    } catch (error) {
      console.error("Error formatting content:", error);
      return [];
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">
            Configure Interactive Experience
          </h1>
          <p className="text-gray-500 text-sm">
            Set up engaging activities for your visitors
          </p>
        </div>
        <div className="bg-purple-100 p-3 rounded-full">
          <Zap className="h-6 w-6 text-purple-600" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="exp-name">Experience Name</Label>
          <Input
            id="exp-name"
            placeholder="e.g. Brand Knowledge Quiz, Industry Facts"
            value={configData.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
        </div>

        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
          <h4 className="font-medium text-purple-800 mb-2 flex items-center">
            <Zap className="h-4 w-4 mr-1.5" />
            Interactive Experience Types
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                id: "quiz",
                label: "Quiz",
                description:
                  "Test brand knowledge with business-specific questions",
                icon: <MessageSquare />,
              },
              {
                id: "factOrFiction",
                label: "Fact or Fiction",
                description:
                  "True or false statements (either about your business or industry as a whole)",
                icon: <CheckSquare />,
              },
            ].map((type) => (
              <div
                key={type.id}
                className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-purple-500 transition-all flex flex-col items-center text-center ${configData.type === type.id ? "border-purple-500 bg-purple-50/50" : ""}`}
                onClick={() => handleChange("type", type.id)}
              >
                <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center mb-2">
                  {React.cloneElement(type.icon, {
                    className: "h-6 w-6 text-purple-600",
                  })}
                </div>
                <span className="text-sm font-medium">{type.label}</span>
                <span className="text-xs text-gray-500 mt-1">
                  {type.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Content Creation</h4>
          <div className="space-y-3">
            <div className="flex flex-col space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    id: "ai",
                    label: "AI-Generated",
                    description: "Automatically created content",
                    icon: <Cpu />,
                  },
                  {
                    id: "manual",
                    label: "Manual Creation",
                    description: "Create your own content",
                    icon: <Edit />,
                  },
                ].map((method) => (
                  <div
                    key={method.id}
                    className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-purple-500 transition-all flex flex-col items-center text-center ${configData.contentCreation === method.id ? "border-purple-500 bg-purple-50/50" : ""}`}
                    onClick={() => handleChange("contentCreation", method.id)}
                  >
                    <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center mb-2">
                      {React.cloneElement(method.icon, {
                        className: "h-5 w-5 text-purple-600",
                      })}
                    </div>
                    <span className="text-sm font-medium">{method.label}</span>
                    <span className="text-xs text-gray-500 mt-1">
                      {method.description}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Question Count</p>
                  <p className="text-xs text-gray-500">
                    Number of questions to generate
                  </p>
                </div>
                <Select
                  value={configData.questionCount.toString()}
                  onValueChange={(value) =>
                    handleChange("questionCount", parseInt(value))
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 questions</SelectItem>
                    <SelectItem value="5">5 questions</SelectItem>
                    <SelectItem value="10">10 questions</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={generateContent}
                className="mt-2 w-full"
                disabled={generatingContent}
              >
                {generatingContent ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Generating Content...
                  </>
                ) : (
                  <>
                    <Cpu className="h-4 w-4 mr-1.5" />
                    Generate{" "}
                    {configData.type === "quiz"
                      ? "Quiz"
                      : "Fact or Fiction"}{" "}
                    Content
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Interactive Experience Features</h4>
          <div className="space-y-3">
            {[
              { id: "soundEffects", label: "Sound Effects", icon: <Volume /> },
              { id: "socialSharing", label: "Social Sharing", icon: <Share /> },
              { id: "leaderboard", label: "Leaderboard", icon: <Trophy /> },
              { id: "multiplayer", label: "Multiplayer", icon: <Users /> },
            ].map((feature) => (
              <div
                key={feature.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  {React.cloneElement(feature.icon, {
                    className: "h-4 w-4 text-gray-500 mr-2",
                  })}
                  <Label className="cursor-pointer">{feature.label}</Label>
                </div>
                <Switch
                  checked={configData.features[feature.id]}
                  onCheckedChange={(checked) => {
                    handleChange("features", {
                      ...configData.features,
                      [feature.id]: checked,
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Place content preview here - right after the Features section */}
        {configData.generatedContent.length > 0 && (
          <div className="mt-4 border rounded-lg p-4 bg-white">
            <h4 className="font-medium mb-3">Generated Content Preview</h4>
            <div className="space-y-4">
              {configData.type === "quiz"
                ? configData.generatedContent.map((item, index) => (
                    <div
                      key={index}
                      className="border rounded p-3 bg-purple-50"
                    >
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">
                          Question {index + 1}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm font-medium">{item.question}</p>
                      <p className="text-sm text-gray-600 mt-2">
                        <span className="font-medium">Answer:</span>{" "}
                        {item.answer}
                      </p>
                    </div>
                  ))
                : configData.generatedContent.map((item, index) => (
                    <div
                      key={index}
                      className="border rounded p-3 bg-purple-50"
                    >
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">
                          Statement {index + 1} (
                          {item.isTrue ? "Fact" : "Fiction"})
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm font-medium">{item.statement}</p>
                      <p className="text-sm text-gray-600 mt-2">
                        <span className="font-medium">Explanation:</span>{" "}
                        {item.explanation}
                      </p>
                    </div>
                  ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t pt-4 flex justify-end">
        <Button onClick={() => onSave(configData)}>
          Save Interactive Experience Configuration
        </Button>
      </div>
    </div>
  );
};

export const TableReservationsConfigScreen = ({ onSave, initialData = {} }) => {
  const { toast } = useToast();
  const [configData, setConfigData] = useState({
    name: initialData.name || "Table Reservations",
    reservationUrl: initialData.reservationUrl || "",
    reservationType: initialData.reservationType || "restaurant_website",
    ...initialData,
  });

  const [previewState, setPreviewState] = useState({
    isValidating: false,
    isValid: false,
    error: "",
    loadError: false,
    isLoading: false,
  });

  // Handle input changes
  const handleChange = (field, value) => {
    setConfigData((prev) => ({ ...prev, [field]: value }));
    if (field === "reservationUrl") {
      setPreviewState((prev) => ({
        ...prev,
        isValid: false,
        error: "",
        loadError: false,
      }));
    }
  };

  // Validate and load preview
  const validateAndPreviewUrl = async () => {
    if (!configData.reservationUrl) {
      setPreviewState((prev) => ({
        ...prev,
        error: "Please enter a reservation URL",
      }));
      return;
    }

    try {
      const url = new URL(configData.reservationUrl);
      setPreviewState((prev) => ({ ...prev, isValidating: true, error: "" }));

      // Check if URL is reachable
      const response = await fetch(url, {
        mode: "no-cors", // Using no-cors to avoid CORS issues during validation
        method: "HEAD",
      }).catch(() => ({ ok: true })); // Fallback to assume valid if CORS prevents check

      setPreviewState((prev) => ({
        ...prev,
        isValidating: false,
        isValid: true,
        isLoading: true,
      }));

      toast({
        title: "URL Validated",
        description: "Preview is loading...",
        variant: "success",
      });
    } catch (err) {
      setPreviewState((prev) => ({
        ...prev,
        isValidating: false,
        error: "Please enter a valid URL including http:// or https://",
        isValid: false,
      }));
    }
  };

  // Handle iframe load success/error
  const handlePreviewLoad = () => {
    setPreviewState((prev) => ({
      ...prev,
      isLoading: false,
      loadError: false,
    }));
  };

  const handlePreviewError = () => {
    setPreviewState((prev) => ({ ...prev, isLoading: false, loadError: true }));
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-sm">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Table Reservations Setup
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Integrate your reservation system seamlessly
          </p>
        </div>
        <div className="bg-indigo-100 p-3 rounded-full">
          <Calendar className="h-6 w-6 text-indigo-600" />
        </div>
      </div>

      {/* Configuration Form */}
      <div className="space-y-6">
        {/* Feature Name */}
        <div className="space-y-2">
          <Label htmlFor="feature-name" className="text-sm font-medium">
            Feature Name
          </Label>
          <Input
            id="feature-name"
            placeholder="e.g. Table Reservations"
            value={configData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            className="w-full"
          />
        </div>

        {/* Reservation Type Selection */}
        <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100">
          <h4 className="font-semibold text-indigo-800 mb-3 flex items-center">
            <Globe className="h-5 w-5 mr-2" />
            Reservation System Type
          </h4>
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                id: "restaurant_website",
                label: "Restaurant Website",
                description: "Your own booking page",
                icon: <Globe />,
              },
              {
                id: "third_party",
                label: "Third-party Service",
                description: "OpenTable, Resy, etc.",
                icon: <ExternalLink />,
              },
            ].map((method) => (
              <div
                key={method.id}
                className={`bg-white rounded-lg border p-4 cursor-pointer hover:border-indigo-500 transition-all flex flex-col items-center text-center ${
                  configData.reservationType === method.id
                    ? "border-indigo-500 bg-indigo-50"
                    : ""
                }`}
                onClick={() => handleChange("reservationType", method.id)}
              >
                <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center mb-3">
                  {React.cloneElement(method.icon, {
                    className: "h-6 w-6 text-indigo-600",
                  })}
                </div>
                <span className="text-sm font-medium">{method.label}</span>
                <span className="text-xs text-gray-500 mt-1">
                  {method.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* URL Input and Validation */}
        <div className="border rounded-xl p-5">
          <h4 className="font-semibold mb-3">Reservation URL</h4>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reservation-url">
                {configData.reservationType === "restaurant_website"
                  ? "Restaurant Booking Page URL"
                  : "Third-party Booking URL"}
              </Label>
              <div className="flex gap-3">
                <Input
                  id="reservation-url"
                  placeholder="https://example.com/reservations"
                  value={configData.reservationUrl}
                  onChange={(e) =>
                    handleChange("reservationUrl", e.target.value)
                  }
                  className="flex-1"
                />
                <Button
                  onClick={validateAndPreviewUrl}
                  disabled={
                    previewState.isValidating || !configData.reservationUrl
                  }
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {previewState.isValidating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Validating
                    </>
                  ) : (
                    "Validate & Preview"
                  )}
                </Button>
              </div>
              {previewState.error && (
                <p className="text-sm text-red-500 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {previewState.error}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Preview Section */}
        {previewState.isValid && (
          <div className="border rounded-xl p-5 animate-in fade-in duration-300">
            <h4 className="font-semibold mb-4 flex items-center">
              <Eye className="h-5 w-5 mr-2 text-indigo-600" />
              Live Reservation Preview
            </h4>
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden border shadow-sm">
                {/* Browser-like header */}
                <div className="bg-gray-100 p-3 flex items-center justify-between border-b">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    </div>
                    <span className="text-sm text-gray-700">
                      {new URL(configData.reservationUrl).hostname}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-8 px-3 text-xs"
                  >
                    <a
                      href={configData.reservationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Full Site
                    </a>
                  </Button>
                </div>

                {/* Iframe with loading state */}
                <div className="relative h-[500px]">
                  {previewState.isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100/50">
                      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                    </div>
                  )}
                  <iframe
                    src={configData.reservationUrl}
                    className="w-full h-full"
                    title="Reservation Preview"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                    onLoad={handlePreviewLoad}
                    onError={handlePreviewError}
                  />
                  {previewState.loadError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100/90 p-4">
                      <div className="text-center space-y-2">
                        <AlertTriangle className="h-8 w-8 text-yellow-600 mx-auto" />
                        <p className="text-sm text-gray-700">
                          Unable to load preview. This site may not allow
                          embedding.
                        </p>
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={configData.reservationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open in New Tab
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Info Panel */}
              <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                <h5 className="font-medium text-indigo-800 mb-2 flex items-center">
                  <Info className="h-4 w-4 mr-2" />
                  Preview Details
                </h5>
                <p className="text-sm text-gray-600">
                  This interactive preview shows exactly what customers will see
                  when booking. Test the reservation flow and ensure everything
                  works as expected.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t pt-6 flex justify-end">
        <Button
          onClick={() => onSave(configData)}
          className="bg-indigo-600 hover:bg-indigo-700"
          disabled={!previewState.isValid}
        >
          Save Configuration
        </Button>
      </div>
    </div>
  );
};

/**
 * Wait List Management Configuration Component
 */
export const WaitListConfigScreen = ({ onSave, initialData = {} }) => {
  const [configData, setConfigData] = useState({
    name: initialData.name || "Wait List Management",
    notificationMethod: initialData.notificationMethod || "text",
    estimatedWaitTime: initialData.estimatedWaitTime || true,
    autoAdvance: initialData.autoAdvance || true,
    collectCustomerData: initialData.collectCustomerData || {
      name: true,
      phone: true,
      email: false,
      groupSize: true,
      preferences: false,
    },
    ...initialData,
  });

  const handleChange = (field, value) => {
    setConfigData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">Configure Wait List</h1>
          <p className="text-gray-500 text-sm">
            Set up how customers join and manage their place in line
          </p>
        </div>
        <div className="bg-purple-100 p-3 rounded-full">
          <Clock className="h-6 w-6 text-purple-600" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="waitlist-name">Feature Name</Label>
          <Input
            id="waitlist-name"
            placeholder="e.g. Virtual Queue"
            value={configData.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
        </div>

        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
          <h4 className="font-medium text-purple-800 mb-2 flex items-center">
            <Bell className="h-4 w-4 mr-1.5" />
            Notification Method
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                id: "text",
                label: "Text Message",
                description: "SMS notifications",
                icon: <MessageCircle />,
              },
              {
                id: "app",
                label: "In-App",
                description: "Push notifications",
                icon: <Smartphone />,
              },
              {
                id: "both",
                label: "Both Methods",
                description: "SMS & push notifications",
                icon: <Bell />,
              },
            ].map((method) => (
              <div
                key={method.id}
                className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-purple-500 transition-all flex flex-col items-center text-center ${configData.notificationMethod === method.id ? "border-purple-500 bg-purple-50/50" : ""}`}
                onClick={() => handleChange("notificationMethod", method.id)}
              >
                <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center mb-2">
                  {React.cloneElement(method.icon, {
                    className: "h-6 w-6 text-purple-600",
                  })}
                </div>
                <span className="text-sm font-medium">{method.label}</span>
                <span className="text-xs text-gray-500 mt-1">
                  {method.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Wait List Features</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Clock className="h-4 w-4 text-gray-500 mr-2" />
                <Label className="cursor-pointer">Estimated Wait Time</Label>
              </div>
              <Switch
                checked={configData.estimatedWaitTime}
                onCheckedChange={(checked) =>
                  handleChange("estimatedWaitTime", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle2 className="h-4 w-4 text-gray-500 mr-2" />
                <Label className="cursor-pointer">Auto Advance Queue</Label>
              </div>
              <Switch
                checked={configData.autoAdvance}
                onCheckedChange={(checked) =>
                  handleChange("autoAdvance", checked)
                }
              />
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Customer Information</h4>
          <div className="space-y-2">
            {[
              { id: "name", label: "Full Name" },
              { id: "phone", label: "Phone Number" },
              { id: "email", label: "Email Address" },
              { id: "groupSize", label: "Group Size" },
              { id: "preferences", label: "Seating Preferences" },
            ].map((field) => (
              <div key={field.id} className="flex items-center space-x-2">
                <Checkbox
                  id={field.id}
                  checked={configData.collectCustomerData[field.id]}
                  onCheckedChange={(checked) => {
                    handleChange("collectCustomerData", {
                      ...configData.collectCustomerData,
                      [field.id]: !!checked,
                    });
                  }}
                />
                <label htmlFor={field.id} className="text-sm cursor-pointer">
                  {field.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t pt-4 flex justify-end">
        <Button onClick={() => onSave(configData)}>
          Save Wait List Configuration
        </Button>
      </div>
    </div>
  );
};

/**
 * Online Ordering Configuration Component
 */
export const OnlineOrderingConfigScreen = ({ onSave, initialData = {} }) => {
  const [configData, setConfigData] = useState({
    name: initialData.name || "Online Ordering",
    orderMethod: initialData.orderMethod || "tableQR",
    paymentOptions: initialData.paymentOptions || [
      "card",
      "applePay",
      "googlePay",
    ],
    orderFeatures: initialData.orderFeatures || {
      modifyItems: true,
      specialInstructions: true,
      savedOrders: false,
      reorder: false,
      splitBill: true,
    },
    notifyKitchen: initialData.notifyKitchen || "automatic",
    ...initialData,
  });

  const handleChange = (field, value) => {
    setConfigData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">
            Configure Online Ordering
          </h1>
          <p className="text-gray-500 text-sm">
            Set up how customers order directly from their tables
          </p>
        </div>
        <div className="bg-amber-100 p-3 rounded-full">
          <ShoppingCart className="h-6 w-6 text-amber-600" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="order-name">Feature Name</Label>
          <Input
            id="order-name"
            placeholder="e.g. Table Ordering"
            value={configData.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
        </div>

        <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
          <h4 className="font-medium text-amber-800 mb-2 flex items-center">
            <ShoppingCart className="h-4 w-4 mr-1.5" />
            Order Method
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                id: "tableQR",
                label: "Table QR Code",
                description: "Scan at table",
                icon: <QrCode />,
              },
              {
                id: "tableNumber",
                label: "Table Number",
                description: "Enter manually",
                icon: <Type />,
              },
              {
                id: "location",
                label: "Location Based",
                description: "Auto-detect table",
                icon: <MapPin />,
              },
            ].map((method) => (
              <div
                key={method.id}
                className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-amber-500 transition-all flex flex-col items-center text-center ${configData.orderMethod === method.id ? "border-amber-500 bg-amber-50/50" : ""}`}
                onClick={() => handleChange("orderMethod", method.id)}
              >
                <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center mb-2">
                  {React.cloneElement(method.icon, {
                    className: "h-6 w-6 text-amber-600",
                  })}
                </div>
                <span className="text-sm font-medium">{method.label}</span>
                <span className="text-xs text-gray-500 mt-1">
                  {method.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Payment Options</h4>
          <div className="space-y-2">
            {[
              {
                id: "card",
                label: "Credit/Debit Card",
                icon: <CircleDollarSign />,
              },
              { id: "applePay", label: "Apple Pay", icon: <Smartphone /> },
              { id: "googlePay", label: "Google Pay", icon: <Smartphone /> },
              { id: "payLater", label: "Pay at Counter", icon: <DollarSign /> },
            ].map((option) => (
              <div key={option.id} className="flex items-center space-x-2">
                <Checkbox
                  id={option.id}
                  checked={configData.paymentOptions.includes(option.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      handleChange("paymentOptions", [
                        ...configData.paymentOptions,
                        option.id,
                      ]);
                    } else {
                      handleChange(
                        "paymentOptions",
                        configData.paymentOptions.filter(
                          (item) => item !== option.id,
                        ),
                      );
                    }
                  }}
                />
                <div className="flex items-center">
                  {React.cloneElement(option.icon, {
                    className: "h-4 w-4 text-gray-500 mr-2",
                  })}
                  <label htmlFor={option.id} className="text-sm cursor-pointer">
                    {option.label}
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Order Features</h4>
          <div className="space-y-3">
            {[
              { id: "modifyItems", label: "Modify Items", icon: <Settings /> },
              {
                id: "specialInstructions",
                label: "Special Instructions",
                icon: <FileText />,
              },
              {
                id: "savedOrders",
                label: "Saved Orders",
                icon: <BookmarkIcon />,
              },
              {
                id: "reorder",
                label: "Re-order Function",
                icon: <RefreshCw />,
              },
              { id: "splitBill", label: "Split Bill", icon: <Users /> },
            ].map((feature) => (
              <div
                key={feature.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  {React.cloneElement(feature.icon, {
                    className: "h-4 w-4 text-gray-500 mr-2",
                  })}
                  <Label className="cursor-pointer">{feature.label}</Label>
                </div>
                <Switch
                  checked={configData.orderFeatures[feature.id]}
                  onCheckedChange={(checked) => {
                    handleChange("orderFeatures", {
                      ...configData.orderFeatures,
                      [feature.id]: checked,
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Kitchen Notification</h4>
          <RadioGroup
            value={configData.notifyKitchen}
            onValueChange={(value) => handleChange("notifyKitchen", value)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="automatic" id="automatic" />
              <Label htmlFor="automatic">Automatically Send to Kitchen</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="review" id="review" />
              <Label htmlFor="review">Staff Review Before Sending</Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <div className="border-t pt-4 flex justify-end">
        <Button onClick={() => onSave(configData)}>
          Save Online Ordering Configuration
        </Button>
      </div>
    </div>
  );
};

/**
 * Customer Reviews Configuration Component
 */
// AFTER: Enhanced configuration with Google Places integration
export const CustomerReviewsConfigScreen = ({
  onSave,
  initialData = {},
  blueprintId,
  placeData,
}) => {
  const [configData, setConfigData] = useState({
    name: initialData.name || "Customer Reviews",
    displayMethod: initialData.displayMethod || "card",
    reviewFilters: initialData.reviewFilters || {
      minRating: 3,
      featuredOnly: false,
      recentOnly: true,
    },
    features: initialData.features || {
      ratings: true,
      photos: true,
      responses: true,
      sorting: true,
    },
    reviewPrompt: initialData.reviewPrompt || "After visit",
    reviewSource: initialData.reviewSource || "google", // 'google', 'yelp', 'manual'
    fetchHistory: initialData.fetchHistory || [],
    manualReviews: initialData.manualReviews || [],
    ...initialData,
  });

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [placeDetails, setPlaceDetails] = useState(placeData || null);
  const [fetchingPlace, setFetchingPlace] = useState(false);

  const handleChange = (field, value) => {
    setConfigData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Function to fetch place details from Google Places API
  const fetchPlaceDetails = async (placeId) => {
    if (!placeId) {
      setError(
        "No place ID available. Please add your business to Google Places first.",
      );
      return null;
    }

    setFetchingPlace(true);
    setError("");

    try {
      // In a real implementation, this would be a backend API call to protect your API key
      // For this example, we'll simulate a successful response
      const placeDetails = {
        place_id: placeId,
        name: "Your Museum",
        formatted_address: "123 Museum Avenue, City, State",
        rating: 4.5,
        user_ratings_total: 256,
        // More place details would be here in a real API response
      };

      setPlaceDetails(placeDetails);
      return placeDetails;
    } catch (error) {
      console.error("Error fetching place details:", error);
      setError("Failed to fetch business details from Google Places.");
      return null;
    } finally {
      setFetchingPlace(false);
    }
  };

  // Function to fetch reviews from Google Places API
  const fetchGoogleReviews = async () => {
    // Make sure we have place details
    if (!placeDetails && !placeData) {
      const placeId = "your-place-id"; // In a real app, get this from the blueprint data
      const details = await fetchPlaceDetails(placeId);
      if (!details) return;
    }

    setLoading(true);
    setError("");

    try {
      // In a real implementation, this would be a backend API call to protect your API key
      // For this example, we'll create simulated reviews
      const simulatedReviews = [
        {
          author_name: "John Smith",
          rating: 5,
          text: "Amazing museum with incredible exhibits. The interactive displays were a highlight for our family.",
          time: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
          profile_photo_url: "https://example.com/profile1.jpg",
        },
        {
          author_name: "Sarah Johnson",
          rating: 4,
          text: "Great collection and knowledgeable staff. The audio tour was very informative.",
          time: Date.now() - 14 * 24 * 60 * 60 * 1000, // 14 days ago
          profile_photo_url: "https://example.com/profile2.jpg",
        },
        {
          author_name: "Michael Davis",
          rating: 5,
          text: "Fascinating exhibits! The new digital displays make everything more engaging. Highly recommend.",
          time: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
          profile_photo_url: "https://example.com/profile3.jpg",
        },
      ];

      setReviews(simulatedReviews);

      // Record this fetch in history
      const fetchRecord = {
        source: "google",
        timestamp: new Date().toISOString(),
        count: simulatedReviews.length,
      };

      // Update the config data
      setConfigData((prev) => ({
        ...prev,
        fetchHistory: [fetchRecord, ...prev.fetchHistory.slice(0, 9)], // Keep last 10 fetches
      }));

      // Store in Firestore
      await setDoc(
        doc(db, "reviewSources", blueprintId),
        {
          googleReviews: simulatedReviews,
          lastFetched: serverTimestamp(),
          placeDetails: placeDetails || placeData,
          source: "google",
        },
        { merge: true },
      );
    } catch (error) {
      console.error("Error fetching Google reviews:", error);
      setError(
        "Failed to fetch reviews from Google Places. Please try again later.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch reviews from Yelp API
  const fetchYelpReviews = async () => {
    setLoading(true);
    setError("");

    try {
      // In a real implementation, this would be a backend API call
      // For this example, we'll create simulated reviews
      const simulatedReviews = [
        {
          user: { name: "Alex W." },
          rating: 5,
          text: "This museum exceeded all expectations. Incredible permanent collection and the special exhibits are always thought-provoking.",
          time_created: "2023-11-15 12:30:00",
          user_image: "https://example.com/yelp1.jpg",
        },
        {
          user: { name: "Jamie T." },
          rating: 4,
          text: "Wonderful experience overall. The architecture is as impressive as the exhibits. Only downside was the crowded cafe.",
          time_created: "2023-12-05 15:22:00",
          user_image: "https://example.com/yelp2.jpg",
        },
      ];

      // Transform to consistent format
      const formattedReviews = simulatedReviews.map((review) => ({
        author_name: review.user.name,
        rating: review.rating,
        text: review.text,
        time: new Date(review.time_created).getTime(),
        profile_photo_url: review.user_image,
        source: "yelp",
      }));

      setReviews(formattedReviews);

      // Record this fetch in history
      const fetchRecord = {
        source: "yelp",
        timestamp: new Date().toISOString(),
        count: formattedReviews.length,
      };

      // Update the config data
      setConfigData((prev) => ({
        ...prev,
        fetchHistory: [fetchRecord, ...prev.fetchHistory.slice(0, 9)], // Keep last 10 fetches
      }));

      // Store in Firestore
      await setDoc(
        doc(db, "reviewSources", blueprintId),
        {
          yelpReviews: formattedReviews,
          lastFetched: serverTimestamp(),
          source: "yelp",
        },
        { merge: true },
      );
    } catch (error) {
      console.error("Error fetching Yelp reviews:", error);
      setError("Failed to fetch reviews from Yelp. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const addManualReview = (review) => {
    if (!review.author || !review.text) return;

    const newReview = {
      id: `review_${Date.now()}`,
      author_name: review.author,
      rating: parseInt(review.rating) || 5,
      text: review.text,
      time: Date.now(),
      source: "manual",
    };

    // Add to manualReviews array
    setConfigData((prev) => ({
      ...prev,
      manualReviews: [newReview, ...prev.manualReviews],
    }));

    // Also update the displayed reviews
    if (configData.reviewSource === "manual") {
      setReviews((prev) => [newReview, ...prev]);
    }
  };

  const removeManualReview = (reviewId) => {
    setConfigData((prev) => ({
      ...prev,
      manualReviews: prev.manualReviews.filter(
        (review) => review.id !== reviewId,
      ),
    }));

    // Also update the displayed reviews
    if (configData.reviewSource === "manual") {
      setReviews((prev) => prev.filter((review) => review.id !== reviewId));
    }
  };

  // Fetch reviews when the source changes
  useEffect(() => {
    if (configData.reviewSource === "google") {
      fetchGoogleReviews();
    } else if (configData.reviewSource === "yelp") {
      fetchYelpReviews();
    } else if (configData.reviewSource === "manual") {
      setReviews(configData.manualReviews);
    }
  }, [configData.reviewSource]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">
            Configure Customer Reviews
          </h1>
          <p className="text-gray-500 text-sm">
            Set up how reviews are displayed and collected
          </p>
        </div>
        <div className="bg-indigo-100 p-3 rounded-full">
          <MessageSquare className="h-6 w-6 text-indigo-600" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="review-name">Feature Name</Label>
          <Input
            id="review-name"
            placeholder="e.g. Customer Reviews"
            value={configData.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
        </div>

        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
          <h4 className="font-medium text-indigo-800 mb-2 flex items-center">
            <MessageSquare className="h-4 w-4 mr-1.5" />
            Display Method
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                id: "card",
                label: "Review Cards",
                description: "Card layout",
                icon: <LayoutGrid />,
              },
              {
                id: "list",
                label: "Review List",
                description: "List layout",
                icon: <FileText />,
              },
              {
                id: "carousel",
                label: "Carousel",
                description: "Sliding reviews",
                icon: <RefreshCw />,
              },
            ].map((method) => (
              <div
                key={method.id}
                className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-indigo-500 transition-all flex flex-col items-center text-center ${configData.displayMethod === method.id ? "border-indigo-500 bg-indigo-50/50" : ""}`}
                onClick={() => handleChange("displayMethod", method.id)}
              >
                <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center mb-2">
                  {React.cloneElement(method.icon, {
                    className: "h-6 w-6 text-indigo-600",
                  })}
                </div>
                <span className="text-sm font-medium">{method.label}</span>
                <span className="text-xs text-gray-500 mt-1">
                  {method.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Review Filters</h4>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Minimum Rating</Label>
                <span className="text-sm">
                  {configData.reviewFilters.minRating} stars
                </span>
              </div>
              <Slider
                value={[configData.reviewFilters.minRating]}
                min={1}
                max={5}
                step={1}
                onValueChange={(value) => {
                  handleChange("reviewFilters", {
                    ...configData.reviewFilters,
                    minRating: value[0],
                  });
                }}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>1 star</span>
                <span>5 stars</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Featured Reviews Only</Label>
              <Switch
                checked={configData.reviewFilters.featuredOnly}
                onCheckedChange={(checked) => {
                  handleChange("reviewFilters", {
                    ...configData.reviewFilters,
                    featuredOnly: checked,
                  });
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Recent Reviews Only</Label>
              <Switch
                checked={configData.reviewFilters.recentOnly}
                onCheckedChange={(checked) => {
                  handleChange("reviewFilters", {
                    ...configData.reviewFilters,
                    recentOnly: checked,
                  });
                }}
              />
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Review Features</h4>
          <div className="space-y-3">
            {[
              { id: "ratings", label: "Star Ratings", icon: <Star /> },
              { id: "photos", label: "Customer Photos", icon: <ImageIcon /> },
              {
                id: "responses",
                label: "Owner Responses",
                icon: <MessageCircle />,
              },
              {
                id: "sorting",
                label: "Sorting Options",
                icon: <ArrowDownUp />,
              },
            ].map((feature) => (
              <div
                key={feature.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  {React.cloneElement(feature.icon, {
                    className: "h-4 w-4 text-gray-500 mr-2",
                  })}
                  <Label className="cursor-pointer">{feature.label}</Label>
                </div>
                <Switch
                  checked={configData.features[feature.id]}
                  onCheckedChange={(checked) => {
                    handleChange("features", {
                      ...configData.features,
                      [feature.id]: checked,
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Before: No preview section */}

        {/* After: Add this new Preview section */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3 flex items-center">
            <Eye className="h-4 w-4 mr-1.5 text-gray-500" />
            Preview
          </h4>

          <div className="bg-white border rounded-lg p-4">
            {configData.displayMethod === "card" && (
              <div className="grid grid-cols-2 gap-3">
                {reviews.length > 0
                  ? reviews.slice(0, 4).map((review, index) => (
                      <div
                        key={index}
                        className="border rounded-lg p-3 bg-white"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center mr-2">
                              {review.profile_photo_url ? (
                                <img
                                  src={review.profile_photo_url}
                                  alt={review.author_name}
                                  className="h-8 w-8 rounded-full object-cover"
                                />
                              ) : (
                                <User className="h-4 w-4 text-indigo-600" />
                              )}
                            </div>
                            <span className="font-medium text-sm">
                              {review.author_name}
                            </span>
                          </div>
                          {configData.features.ratings && (
                            <div className="flex">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3 w-3 ${i < review.rating ? "text-amber-400 fill-amber-400" : "text-gray-300"}`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-3">
                          {review.text}
                        </p>
                        <div className="mt-2 text-xs text-gray-500">
                          {new Date(review.time).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  : // Placeholder cards when no reviews exist
                    Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className="border rounded-lg p-3 bg-white opacity-70"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center mr-2">
                              <User className="h-4 w-4 text-indigo-600" />
                            </div>
                            <span className="font-medium text-sm">
                              Sample Reviewer
                            </span>
                          </div>
                          {configData.features.ratings && (
                            <div className="flex">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3 w-3 ${i < 5 ? "text-amber-400 fill-amber-400" : "text-gray-300"}`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-600">
                          This is a sample review to show how your reviews will
                          appear in card layout. Add reviews to see actual
                          content.
                        </p>
                        <div className="mt-2 text-xs text-gray-500">
                          {new Date().toLocaleDateString()}
                        </div>
                      </div>
                    ))}
              </div>
            )}

            {configData.displayMethod === "list" && (
              <div className="space-y-3">
                {reviews.length > 0
                  ? reviews.slice(0, 3).map((review, index) => (
                      <div
                        key={index}
                        className="border-b pb-3 last:border-0 last:pb-0"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center mr-2">
                              {review.profile_photo_url ? (
                                <img
                                  src={review.profile_photo_url}
                                  alt={review.author_name}
                                  className="h-8 w-8 rounded-full object-cover"
                                />
                              ) : (
                                <User className="h-4 w-4 text-indigo-600" />
                              )}
                            </div>
                            <div>
                              <span className="font-medium text-sm block">
                                {review.author_name}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(review.time).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          {configData.features.ratings && (
                            <div className="flex">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3 w-3 ${i < review.rating ? "text-amber-400 fill-amber-400" : "text-gray-300"}`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{review.text}</p>
                      </div>
                    ))
                  : // Placeholder list items when no reviews exist
                    Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={index}
                        className="border-b pb-3 last:border-0 last:pb-0 opacity-70"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center mr-2">
                              <User className="h-4 w-4 text-indigo-600" />
                            </div>
                            <div>
                              <span className="font-medium text-sm block">
                                Sample Reviewer
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date().toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          {configData.features.ratings && (
                            <div className="flex">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3 w-3 ${i < 4 ? "text-amber-400 fill-amber-400" : "text-gray-300"}`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          This is a sample review to show how your reviews will
                          appear in list layout. Add reviews to see actual
                          content.
                        </p>
                      </div>
                    ))}
              </div>
            )}

            {configData.displayMethod === "carousel" && (
              <div className="relative p-4 border rounded-lg bg-gray-50">
                <div className="absolute top-1/2 left-2 transform -translate-y-1/2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 rounded-full p-0 bg-white shadow-sm"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mx-8">
                  {reviews.length > 0 ? (
                    <div className="bg-white rounded-lg p-4 border text-center">
                      {configData.features.ratings && (
                        <div className="flex justify-center mb-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${i < reviews[0].rating ? "text-amber-400 fill-amber-400" : "text-gray-300"}`}
                            />
                          ))}
                        </div>
                      )}
                      <p className="text-sm text-gray-600 italic">
                        "{reviews[0].text}"
                      </p>
                      <div className="mt-3 flex items-center justify-center">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center mr-2">
                          {reviews[0].profile_photo_url ? (
                            <img
                              src={reviews[0].profile_photo_url}
                              alt={reviews[0].author_name}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <User className="h-4 w-4 text-indigo-600" />
                          )}
                        </div>
                        <span className="font-medium text-sm">
                          {reviews[0].author_name}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg p-4 border text-center opacity-70">
                      {configData.features.ratings && (
                        <div className="flex justify-center mb-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${i < 5 ? "text-amber-400 fill-amber-400" : "text-gray-300"}`}
                            />
                          ))}
                        </div>
                      )}
                      <p className="text-sm text-gray-600 italic">
                        "This is a sample review to show how your reviews will
                        appear in carousel layout. Add reviews to see actual
                        content."
                      </p>
                      <div className="mt-3 flex items-center justify-center">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center mr-2">
                          <User className="h-4 w-4 text-indigo-600" />
                        </div>
                        <span className="font-medium text-sm">
                          Sample Reviewer
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="absolute top-1/2 right-2 transform -translate-y-1/2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 rounded-full p-0 bg-white shadow-sm"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex justify-center gap-1 mt-3">
                  <div className="h-1.5 w-4 rounded-full bg-indigo-500"></div>
                  <div className="h-1.5 w-1.5 rounded-full bg-gray-300"></div>
                  <div className="h-1.5 w-1.5 rounded-full bg-gray-300"></div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Review Collection</h4>
          <RadioGroup
            value={configData.reviewPrompt}
            onValueChange={(value) => handleChange("reviewPrompt", value)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="After visit" id="after-visit" />
              <Label htmlFor="after-visit">Prompt After Visit</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="QR code" id="qr-code" />
              <Label htmlFor="qr-code">QR Code on Receipt</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Follow-up" id="follow-up" />
              <Label htmlFor="follow-up">Email Follow-up</Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <div className="border-t pt-4 flex justify-end">
        <Button onClick={() => onSave(configData)}>
          Save Reviews Configuration
        </Button>
      </div>
    </div>
  );
};

/**
 * Events & Announcements Configuration Component
 */
export const EventsConfigScreen = ({ onSave, initialData = {} }) => {
  const { toast } = useToast();

  const [configData, setConfigData] = useState({
    name: initialData.name || "Events & Announcements",
    displayMethod: initialData.displayMethod || "calendar",
    eventTypes: initialData.eventTypes || [],
    features: initialData.features || {
      rsvp: true,
      reminders: true,
      sharing: true,
      recurring: false,
    },
    eventSources: initialData.eventSources || [],
    scrapedEvents: initialData.scrapedEvents || [],
    ...initialData,
  });

  // State for URL scraping
  const [urlInput, setUrlInput] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [scrapingError, setScrapingError] = useState(null);
  const [scrapingProgress, setScrapingProgress] = useState({
    stage: "", // "scraping", "parsing", "complete"
    message: "",
  });

  // Current date for calendar preview
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const handleChange = (field, value) => {
    setConfigData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Function to check if a URL is valid
  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (err) {
      return false;
    }
  };

  // Function to check if a URL is a Google Calendar link
  const isGoogleCalendarUrl = (url) => {
    return url.includes("calendar.google.com");
  };

  // Function to scrape a URL using Firecrawl
  const scrapeUrl = async (url) => {
    try {
      const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer fc-e39118dbc4194ccfae3ed8a75e16be80",
        },
        body: JSON.stringify({
          url: url,
          formats: ["html", "markdown"],
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to scrape URL");
      }

      return data.data;
    } catch (error) {
      console.error(`Error scraping URL ${url}:`, error);
      throw error;
    }
  };

  // Function to extract event links from HTML content
  const extractEventLinks = (html, baseUrl) => {
    const links = [];
    // Look for common event link patterns
    const regexes = [
      /<a[^>]*href="([^"]*\/events?\/[^"]*)"[^>]*>/g,
      /<a[^>]*href="([^"]*\/calendar\/[^"]*)"[^>]*>/g,
      /<a[^>]*href="([^"]*\/whats-on\/[^"]*)"[^>]*>/g,
      /<a[^>]*class="[^"]*event[^"]*"[^>]*href="([^"]*)"[^>]*>/g,
      /<a[^>]*class="[^"]*calendar-day-event[^"]*"[^>]*href="([^"]*)"[^>]*>/g,
    ];

    for (const regex of regexes) {
      let match;
      while ((match = regex.exec(html)) !== null) {
        const eventUrl = match[1];
        if (eventUrl) {
          // Make URL absolute if it's relative
          try {
            const absoluteUrl = new URL(eventUrl, baseUrl).href;
            if (!links.includes(absoluteUrl)) {
              links.push(absoluteUrl);
            }
          } catch (e) {
            console.error("Error processing URL:", eventUrl, e);
          }
        }
      }
    }

    return links;
  };

  // Parse event information from HTML
  const parseEventInfo = (html, url) => {
    try {
      // Initialize event data
      const event = {
        id: `event_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        title: "",
        date: "",
        time: "",
        description: "",
        location: "",
        type: "",
        url: url,
      };

      // Extract event title
      const titleRegexes = [
        /<h1[^>]*>(.*?)<\/h1>/i,
        /<title>(.*?)<\/title>/i,
        /<div[^>]*class="[^"]*event-title[^"]*"[^>]*>(.*?)<\/div>/i,
        /<div[^>]*class="[^"]*event-name[^"]*"[^>]*>(.*?)<\/div>/i,
      ];

      for (const regex of titleRegexes) {
        const titleMatch = html.match(regex);
        if (titleMatch && titleMatch[1]) {
          event.title = titleMatch[1].replace(/<[^>]*>/g, "").trim();
          break;
        }
      }

      // Extract event date
      const dateRegexes = [
        /<time[^>]*datetime="([^"]*)"[^>]*>/i,
        /\d{1,2}\/\d{1,2}\/\d{2,4}/g,
        /\d{1,2}-\d{1,2}-\d{2,4}/g,
        /\d{4}-\d{1,2}-\d{1,2}/g,
        /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/gi,
        /<span[^>]*class="[^"]*date[^"]*"[^>]*>(.*?)<\/span>/i,
      ];

      for (const regex of dateRegexes) {
        const dateMatch = html.match(regex);
        if (dateMatch && dateMatch[0]) {
          event.date = dateMatch[0].replace(/<[^>]*>/g, "").trim();
          break;
        }
      }

      // Extract event time
      const timeRegexes = [
        /\d{1,2}:\d{2}\s*(?:AM|PM)?/gi,
        /\d{1,2}\s*(?:AM|PM)/gi,
        /<span[^>]*class="[^"]*time[^"]*"[^>]*>(.*?)<\/span>/i,
      ];

      for (const regex of timeRegexes) {
        const timeMatch = html.match(regex);
        if (timeMatch && timeMatch[0]) {
          event.time = timeMatch[0].replace(/<[^>]*>/g, "").trim();
          break;
        }
      }

      // Extract event description
      const descriptionRegexes = [
        /<div[^>]*class="[^"]*event-description[^"]*"[^>]*>(.*?)<\/div>/is,
        /<div[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/div>/is,
        /<p[^>]*>(.*?)<\/p>/is,
      ];

      for (const regex of descriptionRegexes) {
        const descMatch = html.match(regex);
        if (descMatch && descMatch[1]) {
          event.description = descMatch[1].replace(/<[^>]*>/g, "").trim();
          if (event.description.length > 20) break;
        }
      }

      // Extract event location
      const locationRegexes = [
        /<span[^>]*class="[^"]*location[^"]*"[^>]*>(.*?)<\/span>/i,
        /<div[^>]*class="[^"]*venue[^"]*"[^>]*>(.*?)<\/div>/i,
        /<p[^>]*class="[^"]*location[^"]*"[^>]*>(.*?)<\/p>/i,
      ];

      for (const regex of locationRegexes) {
        const locMatch = html.match(regex);
        if (locMatch && locMatch[1]) {
          event.location = locMatch[1].replace(/<[^>]*>/g, "").trim();
          break;
        }
      }

      // Determine event type based on content
      const eventTypeKeywords = {
        entertainment: [
          "concert",
          "music",
          "performance",
          "show",
          "band",
          "entertainer",
          "live",
        ],
        specials: ["special", "deal", "limited time", "offer", "discount"],
        promotions: [
          "promotion",
          "sale",
          "discount",
          "offer",
          "deal",
          "savings",
        ],
        holidays: [
          "holiday",
          "christmas",
          "halloween",
          "thanksgiving",
          "easter",
          "new year",
        ],
        private: ["private", "exclusive", "members only", "vip", "invite"],
      };

      const contentText = html.toLowerCase();

      // Find the most matching type
      let bestMatchCount = 0;
      let bestMatchType = "";

      for (const [type, keywords] of Object.entries(eventTypeKeywords)) {
        let matchCount = 0;
        for (const keyword of keywords) {
          if (contentText.includes(keyword)) {
            matchCount++;
          }
        }

        if (matchCount > bestMatchCount) {
          bestMatchCount = matchCount;
          bestMatchType = type;
        }
      }

      if (bestMatchCount > 0) {
        event.type = bestMatchType;
      } else {
        // Default type if no matches
        event.type = "events";
      }

      return event;
    } catch (error) {
      console.error("Error parsing event info:", error);
      return {
        id: `event_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        title: "Unknown Event",
        date: "",
        time: "",
        description: "Error parsing event information.",
        location: "",
        type: "events",
        url: url,
      };
    }
  };

  // Function to process Google Calendar URL
  const processGoogleCalendar = async (url) => {
    setScrapingProgress({
      stage: "scraping",
      message: "Processing Google Calendar link...",
    });

    try {
      // For Google Calendar, we'll directly extract the calendar ID
      // and create placeholder events

      // Extract the calendar ID from the URL
      const calId = url.match(/[\/&?]src=([^&]*)/);
      const calendarId = calId ? decodeURIComponent(calId[1]) : null;

      if (!calendarId) {
        throw new Error("Could not extract calendar ID from URL");
      }

      // Create sample events for the calendar
      const sampleEvents = [
        {
          id: `event_${Date.now()}_1`,
          title: "Calendar Event 1",
          date: new Date(
            currentMonth.getFullYear(),
            currentMonth.getMonth(),
            5,
          ).toLocaleDateString(),
          time: "10:00 AM",
          description: "This is a sample event from your Google Calendar.",
          location: "Google Calendar",
          type: "events",
          url: url,
          calendarId: calendarId,
        },
        {
          id: `event_${Date.now()}_2`,
          title: "Calendar Event 2",
          date: new Date(
            currentMonth.getFullYear(),
            currentMonth.getMonth(),
            12,
          ).toLocaleDateString(),
          time: "2:30 PM",
          description:
            "This is another sample event from your Google Calendar.",
          location: "Google Calendar",
          type: "specials",
          url: url,
          calendarId: calendarId,
        },
        {
          id: `event_${Date.now()}_3`,
          title: "Calendar Event 3",
          date: new Date(
            currentMonth.getFullYear(),
            currentMonth.getMonth(),
            20,
          ).toLocaleDateString(),
          time: "6:00 PM",
          description:
            "This is a third sample event from your Google Calendar.",
          location: "Google Calendar",
          type: "entertainment",
          url: url,
          calendarId: calendarId,
        },
      ];

      setConfigData((prev) => {
        // Extract all unique event types
        const eventTypes = [
          ...new Set([
            ...prev.eventTypes,
            ...sampleEvents.map((event) => event.type),
          ]),
        ];

        return {
          ...prev,
          eventSources: [
            ...prev.eventSources,
            {
              id: `source_${Date.now()}`,
              url: url,
              type: "google_calendar",
              name: "Google Calendar",
              calendarId: calendarId,
            },
          ],
          scrapedEvents: [...prev.scrapedEvents, ...sampleEvents],
          eventTypes: eventTypes,
        };
      });

      toast({
        title: "Calendar Connected",
        description:
          "Successfully connected to Google Calendar. Sample events have been created.",
        variant: "success",
        duration: 5000,
      });
    } catch (error) {
      console.error("Error processing Google Calendar:", error);
      setScrapingError(error.message || "Failed to process Google Calendar");

      toast({
        title: "Calendar Error",
        description:
          "Failed to process Google Calendar link. Please check the URL.",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  // Function to process events website URL
  const processEventsUrl = async (url) => {
    setScrapingProgress({
      stage: "scraping",
      message: "Scraping events website...",
    });

    try {
      // First, scrape the main page
      const mainPageData = await scrapeUrl(url);

      // Extract all event links from the main page
      const eventLinks = extractEventLinks(mainPageData.html, url);

      // If no event links found, try to interpret the main page as an event listing
      if (eventLinks.length === 0) {
        setScrapingProgress({
          stage: "parsing",
          message: "Extracting events from main page...",
        });

        // Try to find event information in the main page
        const mainPageEvents = [];

        // Look for multiple events on the page
        const eventBlocks = mainPageData.html.match(
          /<div[^>]*class="[^"]*event[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
        );

        if (eventBlocks && eventBlocks.length > 0) {
          // Process each event block
          for (let i = 0; i < eventBlocks.length; i++) {
            const eventInfo = parseEventInfo(eventBlocks[i], url);
            mainPageEvents.push(eventInfo);
          }
        } else {
          // Try to interpret the whole page as one event
          const eventInfo = parseEventInfo(mainPageData.html, url);
          mainPageEvents.push(eventInfo);
        }

        // Update state with the extracted events
        if (mainPageEvents.length > 0) {
          setConfigData((prev) => {
            // Extract all unique event types
            const eventTypes = [
              ...new Set([
                ...prev.eventTypes,
                ...mainPageEvents.map((event) => event.type),
              ]),
            ];

            return {
              ...prev,
              eventSources: [
                ...prev.eventSources,
                {
                  id: `source_${Date.now()}`,
                  url: url,
                  type: "website",
                  name: "Events Website",
                },
              ],
              scrapedEvents: [...prev.scrapedEvents, ...mainPageEvents],
              eventTypes: eventTypes,
            };
          });

          toast({
            title: "Events Processed",
            description: `Successfully extracted ${mainPageEvents.length} events.`,
            variant: "success",
            duration: 5000,
          });
        } else {
          throw new Error("No events found on the page");
        }
      } else {
        // Process each event link
        setScrapingProgress({
          stage: "parsing",
          message: `Processing ${eventLinks.length} events...`,
        });

        const events = [];

        for (let i = 0; i < eventLinks.length; i++) {
          try {
            setScrapingProgress({
              stage: "parsing",
              message: `Processing event ${i + 1} of ${eventLinks.length}...`,
            });

            // Scrape the event page
            const eventData = await scrapeUrl(eventLinks[i]);

            // Extract event information
            const eventInfo = parseEventInfo(eventData.html, eventLinks[i]);
            events.push(eventInfo);
          } catch (error) {
            console.error(`Error processing event: ${eventLinks[i]}`, error);
            // Continue with other events
          }
        }

        // Update state with the extracted events
        if (events.length > 0) {
          console.log("Processing events:", events); // Add this line for debugging

          setConfigData((prev) => {
            // Extract all unique event types
            const eventTypes = [
              ...new Set([
                ...prev.eventTypes,
                ...events.map((event) => event.type),
              ]),
            ];

            const updatedConfig = {
              ...prev,
              eventSources: [
                ...prev.eventSources,
                {
                  id: `source_${Date.now()}`,
                  url: url,
                  type: "website",
                  name: "Events Website",
                },
              ],
              scrapedEvents: [...prev.scrapedEvents, ...events],
              eventTypes: eventTypes,
            };

            console.log("Updated config:", updatedConfig); // Add this line for debugging
            return updatedConfig;
          });

          toast({
            title: "Events Processed",
            description: `Successfully processed ${events.length} events.`,
            variant: "success",
            duration: 5000,
          });
        } else {
          throw new Error("No events could be processed");
        }
      }
    } catch (error) {
      console.error("Error processing events URL:", error);
      setScrapingError(error.message || "Failed to process events URL");

      toast({
        title: "Processing Error",
        description: "Failed to extract events. Please try another URL.",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  // Main function to process URL input
  const processEventSource = async (url) => {
    if (!isValidUrl(url)) {
      setScrapingError("Please enter a valid URL");
      return;
    }

    setIsScraping(true);
    setScrapingError(null);

    try {
      // Check if it's a Google Calendar URL
      if (isGoogleCalendarUrl(url)) {
        await processGoogleCalendar(url);
      } else {
        // Process as a regular events website
        await processEventsUrl(url);
      }

      // Clear the URL input
      setUrlInput("");
    } catch (error) {
      console.error("Error processing URL:", error);
      setScrapingError(error.message || "Failed to process the URL");
    } finally {
      setIsScraping(false);
      setScrapingProgress({ stage: "", message: "" });
    }
  };

  // Remove an event source
  const removeEventSource = (sourceId) => {
    setConfigData((prev) => {
      // Find the source to remove
      const sourceToRemove = prev.eventSources.find(
        (source) => source.id === sourceId,
      );

      // Remove all events from this source
      const remainingEvents = prev.scrapedEvents.filter(
        (event) =>
          !prev.eventSources
            .find((s) => s.id === sourceId)
            ?.url.includes(new URL(event.url).hostname),
      );

      // Recalculate event types based on remaining events
      const remainingTypes = [
        ...new Set(remainingEvents.map((event) => event.type)),
      ];

      return {
        ...prev,
        eventSources: prev.eventSources.filter(
          (source) => source.id !== sourceId,
        ),
        scrapedEvents: remainingEvents,
        eventTypes: remainingTypes,
      };
    });
  };

  // Remove a specific event
  const removeEvent = (eventId) => {
    setConfigData((prev) => {
      // Remove the specific event
      const remainingEvents = prev.scrapedEvents.filter(
        (event) => event.id !== eventId,
      );

      // Recalculate event types based on remaining events
      const remainingTypes = [
        ...new Set(remainingEvents.map((event) => event.type)),
      ];

      return {
        ...prev,
        scrapedEvents: remainingEvents,
        eventTypes: remainingTypes,
      };
    });
  };

  // Helper to get days in month for calendar preview
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Helper to get day of week (0-6) for first day of month
  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  // Generate calendar grid data for preview
  const generateCalendarData = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const totalDays = getDaysInMonth(year, month);
    const firstDayIndex = getFirstDayOfMonth(year, month);

    const daysArray = [];

    // Add empty cells for days before the first day of month
    for (let i = 0; i < firstDayIndex; i++) {
      daysArray.push({ day: "", isCurrentMonth: false });
    }

    // Add the days of the month
    for (let day = 1; day <= totalDays; day++) {
      daysArray.push({ day, isCurrentMonth: true });
    }

    // Add events to days
    return daysArray.map((dayData) => {
      if (!dayData.isCurrentMonth) return dayData;

      // Find events for this day
      const dayEvents = configData.scrapedEvents.filter((event) => {
        if (!event.date) return false;

        try {
          // Try to parse the date
          const eventDate = new Date(event.date);
          return (
            eventDate.getDate() === dayData.day &&
            eventDate.getMonth() === month &&
            eventDate.getFullYear() === year
          );
        } catch (e) {
          // If we can't parse the date, check using string matching
          const dateStr = `${month + 1}/${dayData.day}/${year}`;
          return event.date.includes(dateStr);
        }
      });

      return {
        ...dayData,
        events: dayEvents,
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">
            Configure Events & Announcements
          </h1>
          <p className="text-gray-500 text-sm">
            Set up how events and promotions are displayed
          </p>
        </div>
        <div className="bg-green-100 p-3 rounded-full">
          <Calendar className="h-6 w-6 text-green-600" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="event-name">Feature Name</Label>
          <Input
            id="event-name"
            placeholder="e.g. Upcoming Events"
            value={configData.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
        </div>

        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
          <h4 className="font-medium text-green-800 mb-2 flex items-center">
            <Calendar className="h-4 w-4 mr-1.5" />
            Display Method
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                id: "calendar",
                label: "Calendar View",
                description: "Monthly calendar",
                icon: <Calendar />,
              },
              {
                id: "list",
                label: "Event List",
                description: "Chronological list",
                icon: <FileText />,
              },
              {
                id: "featured",
                label: "Featured Events",
                description: "Highlight special events",
                icon: <Star />,
              },
            ].map((method) => (
              <div
                key={method.id}
                className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-green-500 transition-all flex flex-col items-center text-center ${configData.displayMethod === method.id ? "border-green-500 bg-green-50/50" : ""}`}
                onClick={() => handleChange("displayMethod", method.id)}
              >
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mb-2">
                  {React.cloneElement(method.icon, {
                    className: "h-6 w-6 text-green-600",
                  })}
                </div>
                <span className="text-sm font-medium">{method.label}</span>
                <span className="text-xs text-gray-500 mt-1">
                  {method.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Event Sources Section */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Event Sources</h4>
          <p className="text-sm text-gray-500 mb-3">
            Add a website URL or Google Calendar link to automatically import
            events
          </p>

          <div className="space-y-3 mb-4">
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com/events or Google Calendar URL"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                disabled={isScraping}
              />
              <Button
                variant="outline"
                onClick={() => {
                  if (urlInput.trim()) {
                    processEventSource(urlInput);
                  }
                }}
                disabled={isScraping || !urlInput.trim()}
              >
                {isScraping ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Add"
                )}
              </Button>
            </div>

            {isScraping && scrapingProgress.message && (
              <div className="text-xs text-green-600">
                <div className="flex items-center mb-1">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  <span>{scrapingProgress.message}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-green-600 h-1.5 rounded-full"
                    style={{
                      width:
                        scrapingProgress.stage === "parsing" ? "75%" : "40%",
                    }}
                  ></div>
                </div>
              </div>
            )}

            {scrapingError && (
              <p className="text-xs text-red-500">{scrapingError}</p>
            )}
          </div>

          {/* Display added sources */}
          <div className="space-y-2">
            {configData.eventSources.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
              >
                <div className="flex items-center">
                  {source.type === "google_calendar" ? (
                    <CalendarDays className="h-4 w-4 text-blue-500 mr-2" />
                  ) : (
                    <Globe className="h-4 w-4 text-green-500 mr-2" />
                  )}
                  <span className="text-sm truncate max-w-[240px]">
                    {source.name}: {source.url}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    asChild
                  >
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => removeEventSource(source.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {configData.eventSources.length === 0 && !isScraping && (
              <p className="text-center text-sm text-gray-500 py-2">
                No event sources added yet
              </p>
            )}
          </div>
        </div>

        {/* Event Types Section - Now showing detected types */}
        {configData.eventTypes.length > 0 && (
          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-3">Detected Event Types</h4>
            <div className="flex flex-wrap gap-2">
              {configData.eventTypes.map((type) => (
                <Badge
                  key={type}
                  className="bg-green-100 text-green-800 hover:bg-green-200 transition-colors"
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              These event types were automatically detected from your events
              sources.
            </p>
          </div>
        )}

        {/* Preview Section */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3 flex items-center">
            <Eye className="h-4 w-4 mr-1.5 text-gray-500" />
            Preview
          </h4>

          <div className="bg-white border rounded-lg p-4">
            {configData.displayMethod === "calendar" && (
              <div className="bg-white rounded-lg border p-3">
                <div className="flex justify-between items-center mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setCurrentMonth(
                        new Date(
                          currentMonth.getFullYear(),
                          currentMonth.getMonth() - 1,
                        ),
                      )
                    }
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h3 className="text-md font-medium">
                    {currentMonth.toLocaleString("default", {
                      month: "long",
                      year: "numeric",
                    })}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setCurrentMonth(
                        new Date(
                          currentMonth.getFullYear(),
                          currentMonth.getMonth() + 1,
                        ),
                      )
                    }
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center mb-1">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day) => (
                      <div
                        key={day}
                        className="text-xs font-medium text-gray-500"
                      >
                        {day}
                      </div>
                    ),
                  )}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {generateCalendarData().map((day, i) => (
                    <div
                      key={i}
                      className={`aspect-square p-1 text-center border ${
                        day.isCurrentMonth
                          ? "bg-white"
                          : "bg-gray-50 text-gray-300"
                      } ${day.events?.length ? "bg-green-50 border-green-200" : "border-gray-100"}`}
                    >
                      <div className="text-xs">{day.day}</div>
                      {day.events?.length > 0 && (
                        <div className="mt-1">
                          {day.events.slice(0, 2).map((event, idx) => (
                            <TooltipProvider key={idx}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="h-1.5 w-1.5 rounded-full bg-green-500 mx-auto my-0.5"></div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs font-medium">
                                    {event.title}
                                  </p>
                                  {event.time && (
                                    <p className="text-xs">{event.time}</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                          {day.events.length > 2 && (
                            <div className="text-[10px] text-green-600">
                              +{day.events.length - 2} more
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {configData.displayMethod === "list" && (
              <div className="bg-white rounded-lg border p-3">
                <ScrollArea className="h-64">
                  {configData.scrapedEvents.length > 0 ? (
                    <div className="space-y-3">
                      {configData.scrapedEvents
                        .sort((a, b) => {
                          // Try to sort by date if available
                          if (a.date && b.date) {
                            return new Date(a.date) - new Date(b.date);
                          }
                          return 0;
                        })
                        .map((event) => (
                          <div
                            key={event.id}
                            className="p-2 border-b last:border-b-0"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-sm font-medium">
                                  {event.title}
                                </h4>
                                {event.date && (
                                  <p className="text-xs text-gray-500 flex items-center mt-1">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    {event.date}{" "}
                                    {event.time && `• ${event.time}`}
                                  </p>
                                )}
                                {event.location && (
                                  <p className="text-xs text-gray-500 flex items-center mt-0.5">
                                    <MapPin className="h-3 w-3 mr-1" />
                                    {event.location}
                                  </p>
                                )}
                              </div>
                              {event.type && (
                                <Badge className="bg-green-100 text-green-800 text-xs">
                                  {event.type}
                                </Badge>
                              )}
                            </div>
                            {event.description && (
                              <p className="text-xs mt-1 text-gray-600 line-clamp-2">
                                {event.description}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                      <Calendar className="h-8 w-8 text-gray-300 mb-2" />
                      <h3 className="text-sm font-medium text-gray-600">
                        No events yet
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Add events by entering a URL above
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}

            {configData.displayMethod === "featured" && (
              <div>
                {configData.scrapedEvents.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {configData.scrapedEvents.slice(0, 4).map((event) => (
                      <div
                        key={event.id}
                        className="bg-white rounded-lg border p-3 relative"
                      >
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            {event.type || "events"}
                          </Badge>
                        </div>
                        <h4 className="text-sm font-medium pr-16">
                          {event.title || "Event title"}
                        </h4>
                        {event.date && (
                          <p className="text-xs text-gray-500 flex items-center mt-1">
                            <Calendar className="h-3 w-3 mr-1" />
                            {event.date} {event.time && `• ${event.time}`}
                          </p>
                        )}
                        {event.location && (
                          <p className="text-xs text-gray-500 flex items-center mt-0.5">
                            <MapPin className="h-3 w-3 mr-1" />
                            {event.location}
                          </p>
                        )}
                        {event.description && (
                          <p className="text-xs mt-2 text-gray-600 line-clamp-3">
                            {event.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="bg-white rounded-lg border p-3 relative opacity-50"
                      >
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            {i % 2 === 0 ? "events" : "entertainment"}
                          </Badge>
                        </div>
                        <h4 className="text-sm font-medium pr-16">
                          Example Event {i}
                        </h4>
                        <p className="text-xs text-gray-500 flex items-center mt-1">
                          <Calendar className="h-3 w-3 mr-1" />
                          3/15/2025 • 2:00 PM
                        </p>
                        <p className="text-xs text-gray-500 flex items-center mt-0.5">
                          <MapPin className="h-3 w-3 mr-1" />
                          Main Hall
                        </p>
                        <p className="text-xs mt-2 text-gray-600 line-clamp-3">
                          This is a placeholder for a featured event
                          description. Add events using the URL above.
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Extracted Events Section */}
        {configData.scrapedEvents.length > 0 && (
          <div className="border rounded-lg p-4 mt-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium">Extracted Events</h4>
              <Badge className="bg-green-100 text-green-800">
                {configData.scrapedEvents.length} Events
              </Badge>
            </div>

            <ScrollArea className="h-64 rounded-md border p-2">
              <div className="space-y-3">
                {configData.scrapedEvents.map((event) => (
                  <div
                    key={event.id}
                    className="border rounded-lg p-3 bg-gray-50 relative pr-8"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 absolute top-2 right-2"
                      onClick={() => removeEvent(event.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>

                    <div className="flex justify-between items-start">
                      <h4 className="text-sm font-medium">{event.title}</h4>
                      {event.type && (
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          {event.type}
                        </Badge>
                      )}
                    </div>

                    {event.date && (
                      <p className="text-xs text-gray-500 flex items-center mt-1">
                        <Calendar className="h-3 w-3 mr-1" />
                        {event.date} {event.time && `• ${event.time}`}
                      </p>
                    )}

                    {event.location && (
                      <p className="text-xs text-gray-500 flex items-center mt-0.5">
                        <MapPin className="h-3 w-3 mr-1" />
                        {event.location}
                      </p>
                    )}

                    {event.description && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-gray-500">
                          Description:
                        </p>
                        <p className="text-xs">{event.description}</p>
                      </div>
                    )}

                    {event.url && (
                      <div className="mt-2 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          asChild
                        >
                          <a
                            href={event.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View Source
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Event Features</h4>
          <div className="space-y-3">
            {[
              { id: "rsvp", label: "RSVP Function", icon: <Check /> },
              { id: "reminders", label: "Event Reminders", icon: <Bell /> },
              { id: "sharing", label: "Social Sharing", icon: <Share2 /> },
              {
                id: "recurring",
                label: "Recurring Events",
                icon: <RepeatIcon />,
              },
            ].map((feature) => (
              <div
                key={feature.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  {React.cloneElement(feature.icon, {
                    className: "h-4 w-4 text-gray-500 mr-2",
                  })}
                  <Label className="cursor-pointer">{feature.label}</Label>
                </div>
                <Switch
                  checked={configData.features[feature.id]}
                  onCheckedChange={(checked) => {
                    handleChange("features", {
                      ...configData.features,
                      [feature.id]: checked,
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t pt-4 flex justify-end">
        <Button onClick={() => onSave(configData)}>
          Save Events Configuration
        </Button>
      </div>
    </div>
  );
};

/**
 * Special Offers Configuration Component - Revamped Version
 */
export const SpecialOffersConfigScreen = ({
  onSave,
  initialData = {},
  blueprintId,
}) => {
  const [configData, setConfigData] = useState({
    name: initialData.name || "Special Offers",
    offerType: initialData.offerType || "discounts",
    frequency: initialData.frequency || "personalized",
    targeting: initialData.targeting || "all",
    deliveryMethods: initialData.deliveryMethods || {
      popup: true,
      banner: true,
    },
    integrationMethod: initialData.integrationMethod || "manual",
    integrationUrl: initialData.integrationUrl || "",
    systemType: initialData.systemType || "retail",
    activePromotions: initialData.activePromotions || [],
    ...initialData,
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [previewType, setPreviewType] = useState("popup");
  const [analyzedPromotions, setAnalyzedPromotions] = useState([]);
  const [activeTab, setActiveTab] = useState("setup");

  const handleChange = (field, value) => {
    setConfigData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePromotionChange = (index, field, value) => {
    const updatedPromotions = [...configData.activePromotions];
    updatedPromotions[index] = {
      ...updatedPromotions[index],
      [field]: value,
    };
    setConfigData((prev) => ({
      ...prev,
      activePromotions: updatedPromotions,
    }));
  };

  const addPromotion = () => {
    setConfigData((prev) => ({
      ...prev,
      activePromotions: [
        ...prev.activePromotions,
        {
          id: `promo-${Date.now()}`,
          name: "",
          description: "",
          discountType: "percentage",
          discountValue: "",
          validFrom: "",
          validTo: "",
          code: "",
          imageUrl: "",
        },
      ],
    }));
  };

  const removePromotion = (index) => {
    const updatedPromotions = [...configData.activePromotions];
    updatedPromotions.splice(index, 1);
    setConfigData((prev) => ({
      ...prev,
      activePromotions: updatedPromotions,
    }));
  };

  const connectToRetailSystem = async () => {
    if (!configData.integrationUrl) {
      setConnectionStatus({
        type: "error",
        message: "Please enter a valid URL for your retail management system",
      });
      return;
    }

    setIsConnecting(true);
    setConnectionStatus({
      type: "info",
      message: "Connecting to your retail management system...",
    });

    try {
      // Simulating API connection - in a real implementation, this would:
      // 1. Validate credentials/API endpoint
      // 2. Set up OAuth if needed
      // 3. Test a sample query to verify connection
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Simulate successful connection with mock promotions data
      const mockPromotions = [
        {
          id: "promo-1",
          name: "Summer Sale",
          description: "20% off all summer items",
          discountType: "percentage",
          discountValue: "20",
          validFrom: "2025-06-01",
          validTo: "2025-08-31",
          code: "SUMMER20",
          imageUrl: "",
        },
        {
          id: "promo-2",
          name: "Loyalty Discount",
          description: "Special discount for loyalty program members",
          discountType: "percentage",
          discountValue: "15",
          validFrom: "2025-03-01",
          validTo: "2025-12-31",
          code: "LOYALTY15",
          imageUrl: "",
        },
      ];

      setConfigData((prev) => ({
        ...prev,
        activePromotions: mockPromotions,
      }));

      setConnectionStatus({
        type: "success",
        message: "Successfully connected to your retail management system!",
      });
    } catch (error) {
      console.error("Error connecting to retail system:", error);
      setConnectionStatus({
        type: "error",
        message:
          "Failed to connect to your retail management system. Please check URL and try again.",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const analyzePromotionsWithAI = async () => {
    if (configData.activePromotions.length === 0) {
      alert("Please add at least one promotion before analyzing.");
      return;
    }

    setIsAnalyzing(true);

    try {
      // Initialize Gemini AI
      const genAI = new GoogleGenerativeAI(
        "AIzaSyBgxzzgcT_9nyhz1D_JtfG7gevRUKQ5Vbs",
      );
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      // Create a prompt with the current promotions data
      const promotionsData = configData.activePromotions
        .map(
          (p) =>
            `Name: ${p.name}
         Description: ${p.description}
         Type: ${p.discountType === "percentage" ? "Percentage discount" : "Fixed amount discount"}
         Value: ${p.discountValue}${p.discountType === "percentage" ? "%" : "$"}
         Valid period: ${p.validFrom} to ${p.validTo}
         Code: ${p.code}`,
        )
        .join("\n\n");

      const prompt = `Analyze these retail promotions and provide optimization suggestions:

      ${promotionsData}

      For each promotion, provide:
      1. A catchier name (if applicable)
      2. A more compelling description
      3. Suggestions for better timing or targeting
      4. One creative idea to make the promotion more engaging for in-store customers
      5. A suggestion for the best display method (pop-up or banner)

      Format your response as a JSON array with one object per promotion, having fields: id, name, description, timing, creativeIdea, displayMethod.`;

      // Generate analysis
      const result = await model.generateContent(prompt);
      const analysisText = result.response.text();

      // Try to parse the JSON response
      try {
        // In a real implementation, you would need more robust parsing
        // This is a simplified version that assumes well-formatted JSON
        const jsonStr = analysisText.substring(
          analysisText.indexOf("["),
          analysisText.lastIndexOf("]") + 1,
        );
        const analysisData = JSON.parse(jsonStr);

        setAnalyzedPromotions(analysisData);

        // Update promotions with AI suggestions
        const updatedPromotions = configData.activePromotions.map(
          (promo, index) => {
            if (index < analysisData.length) {
              return {
                ...promo,
                aiSuggestions: {
                  name: analysisData[index].name,
                  description: analysisData[index].description,
                  timing: analysisData[index].timing,
                  creativeIdea: analysisData[index].creativeIdea,
                  displayMethod: analysisData[index].displayMethod,
                },
              };
            }
            return promo;
          },
        );

        setConfigData((prev) => ({
          ...prev,
          activePromotions: updatedPromotions,
        }));
      } catch (parseError) {
        console.error("Error parsing AI response:", parseError);
        alert("There was an issue with the AI analysis. Please try again.");
      }
    } catch (error) {
      console.error("Error analyzing promotions:", error);
      alert("Failed to analyze promotions. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderPreview = () => {
    // Sample promotion for preview
    const samplePromo = configData.activePromotions[0] || {
      name: "Sample Promotion",
      description: "Description of your promotion will appear here",
      discountType: "percentage",
      discountValue: "20",
      code: "SAMPLE20",
    };

    if (previewType === "popup") {
      return (
        <div className="border rounded-lg shadow-md max-w-sm mx-auto overflow-hidden">
          <div className="bg-red-50 p-4 border-b border-red-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-red-800">
                {samplePromo.name}
              </h3>
              <X className="h-4 w-4 text-gray-500" />
            </div>
          </div>
          <div className="p-4">
            <p className="text-gray-600 mb-3">{samplePromo.description}</p>
            <div className="bg-gray-50 p-2 rounded-md text-center mb-3">
              <span className="text-xs text-gray-500">Use code</span>
              <div className="font-mono font-bold text-red-600">
                {samplePromo.code}
              </div>
            </div>
            <div className="flex space-x-2">
              <Button className="flex-1 bg-red-600 hover:bg-red-700">
                Claim Offer
              </Button>
              <Button variant="outline" className="text-gray-600">
                Details
              </Button>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="max-w-full mx-auto overflow-hidden">
          <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center">
              <div className="bg-red-100 p-2 rounded-full mr-3">
                <Tag className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-medium text-red-800">{samplePromo.name}</h3>
                <p className="text-sm text-gray-600">
                  {samplePromo.description}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-center">
                <div className="text-xs text-gray-500">Use code</div>
                <div className="font-mono font-bold text-red-600">
                  {samplePromo.code}
                </div>
              </div>
              <Button size="sm" className="bg-red-600 hover:bg-red-700">
                Claim
              </Button>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">
            Configure Special Offers
          </h1>
          <p className="text-gray-500 text-sm">
            Set up how promotions and discounts are displayed to your customers
          </p>
        </div>
        <div className="bg-red-100 p-3 rounded-full">
          <PercentCircle className="h-6 w-6 text-red-600" />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 mb-6">
          <TabsTrigger value="setup">Basic Setup</TabsTrigger>
          <TabsTrigger value="integration">System Integration</TabsTrigger>
          <TabsTrigger value="promotions">Manage Promotions</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="offers-name">Feature Name</Label>
            <Input
              id="offers-name"
              placeholder="e.g. Special Offers & Deals"
              value={configData.name}
              onChange={(e) => handleChange("name", e.target.value)}
            />
          </div>

          <div className="bg-red-50 p-4 rounded-lg border border-red-100">
            <h4 className="font-medium text-red-800 mb-2 flex items-center">
              <PercentCircle className="h-4 w-4 mr-1.5" />
              Offer Types
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  id: "discounts",
                  label: "Discounts",
                  description: "Percentage or fixed amount off",
                  icon: <PercentCircle />,
                },
                {
                  id: "coupons",
                  label: "Coupons",
                  description: "Special codes for redemption",
                  icon: <Ticket />,
                },
              ].map((type) => (
                <div
                  key={type.id}
                  className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-red-500 transition-all flex flex-col items-center text-center ${configData.offerType === type.id ? "border-red-500 bg-red-50/50" : ""}`}
                  onClick={() => handleChange("offerType", type.id)}
                >
                  <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mb-2">
                    {React.cloneElement(type.icon, {
                      className: "h-6 w-6 text-red-600",
                    })}
                  </div>
                  <span className="text-sm font-medium">{type.label}</span>
                  <span className="text-xs text-gray-500 mt-1">
                    {type.description}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-3">Promotion Schedule</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Frequency</p>
                  <p className="text-xs text-gray-500">
                    How often to rotate offers
                  </p>
                </div>
                <Select
                  value={configData.frequency}
                  onValueChange={(value) => handleChange("frequency", value)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personalized">
                      Personalized (Recommended)
                    </SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {configData.frequency === "personalized" && (
                <Alert className="bg-blue-50 text-blue-800 border-blue-100">
                  <AlertDescription className="text-xs">
                    <span className="font-medium">Personalized scheduling</span>
                    : Blueprint will intelligently display offers based on
                    customer behavior patterns and location data for maximum
                    engagement.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Targeting</p>
                  <p className="text-xs text-gray-500">Who receives offers</p>
                </div>
                <Select
                  value={configData.targeting}
                  onValueChange={(value) => handleChange("targeting", value)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Visitors</SelectItem>
                    <SelectItem value="first">First-time Visitors</SelectItem>
                    <SelectItem value="returning">
                      Returning Visitors
                    </SelectItem>
                    <SelectItem value="segmented">Customer Segments</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-3">Delivery Method</h4>
            <div className="space-y-3">
              {[
                { id: "popup", label: "Pop-up notification", icon: <Bell /> },
                {
                  id: "banner",
                  label: "Banner display",
                  icon: <LayoutPanelTop />,
                },
              ].map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    {React.cloneElement(method.icon, {
                      className: "h-4 w-4 text-gray-500 mr-2",
                    })}
                    <label className="text-sm cursor-pointer">
                      {method.label}
                    </label>
                  </div>
                  <Switch
                    checked={configData.deliveryMethods[method.id]}
                    onCheckedChange={(checked) => {
                      handleChange("deliveryMethods", {
                        ...configData.deliveryMethods,
                        [method.id]: checked,
                      });
                    }}
                  />
                </div>
              ))}

              <div className="mt-6 space-y-2">
                <div className="flex justify-between items-center mb-2">
                  <h5 className="text-sm font-medium flex items-center">
                    <Eye className="h-4 w-4 mr-1.5 text-gray-500" />
                    Preview
                  </h5>
                  <div className="flex rounded-md overflow-hidden border">
                    <button
                      className={`px-3 py-1 text-xs ${previewType === "popup" ? "bg-red-50 text-red-700" : "bg-white text-gray-500"}`}
                      onClick={() => setPreviewType("popup")}
                    >
                      Pop-up
                    </button>
                    <button
                      className={`px-3 py-1 text-xs ${previewType === "banner" ? "bg-red-50 text-red-700" : "bg-white text-gray-500"}`}
                      onClick={() => setPreviewType("banner")}
                    >
                      Banner
                    </button>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-gray-50">
                  {renderPreview()}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="integration" className="space-y-5">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-5">
            <h4 className="font-medium text-blue-800 mb-2 flex items-center">
              <Store className="h-4 w-4 mr-1.5" />
              Integration Method
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div
                className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-blue-500 transition-all flex flex-col items-center text-center ${configData.integrationMethod === "api" ? "border-blue-500 bg-blue-50/50" : ""}`}
                onClick={() => handleChange("integrationMethod", "api")}
              >
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                  <LinkIcon className="h-6 w-6 text-blue-600" />
                </div>
                <span className="text-sm font-medium">Connect to System</span>
                <span className="text-xs text-gray-500 mt-1">
                  Import promotions from your retail management system
                </span>
              </div>

              <div
                className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-blue-500 transition-all flex flex-col items-center text-center ${configData.integrationMethod === "manual" ? "border-blue-500 bg-blue-50/50" : ""}`}
                onClick={() => handleChange("integrationMethod", "manual")}
              >
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                  <Settings className="h-6 w-6 text-blue-600" />
                </div>
                <span className="text-sm font-medium">Manual Setup</span>
                <span className="text-xs text-gray-500 mt-1">
                  Create and manage promotions directly
                </span>
              </div>
            </div>
          </div>

          {configData.integrationMethod === "api" && (
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-3">Retail System Connection</h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="system-type">System Type</Label>
                  <Select
                    value={configData.systemType}
                    onValueChange={(value) => handleChange("systemType", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your system type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="retail">
                        Retail Management System
                      </SelectItem>
                      <SelectItem value="pos">Point of Sale (POS)</SelectItem>
                      <SelectItem value="ecommerce">
                        E-commerce Platform
                      </SelectItem>
                      <SelectItem value="erp">ERP System</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="integration-url">Integration URL</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="integration-url"
                      placeholder="https://your-store-system.com/api/promotions"
                      value={configData.integrationUrl}
                      onChange={(e) =>
                        handleChange("integrationUrl", e.target.value)
                      }
                      className="flex-1"
                    />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon">
                            <LucideSettings2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Advanced Settings</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-xs text-gray-500">
                    Enter the API endpoint for your retail system's promotions
                  </p>
                </div>

                {connectionStatus && (
                  <div
                    className={`text-sm p-3 rounded ${connectionStatus.type === "success" ? "bg-green-50 text-green-700" : connectionStatus.type === "error" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}
                  >
                    {connectionStatus.type === "success" && (
                      <CheckCircle2 className="h-4 w-4 inline mr-2" />
                    )}
                    {connectionStatus.type === "error" && (
                      <X className="h-4 w-4 inline mr-2" />
                    )}
                    {connectionStatus.type === "info" && (
                      <Loader2 className="h-4 w-4 inline mr-2 animate-spin" />
                    )}
                    {connectionStatus.message}
                  </div>
                )}

                <Button
                  onClick={connectToRetailSystem}
                  disabled={isConnecting || !configData.integrationUrl}
                  className="w-full mt-2"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : connectionStatus?.type === "success" ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh Connection
                    </>
                  ) : (
                    <>
                      <LinkIcon className="h-4 w-4 mr-2" />
                      Connect to System
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-3">AI Analysis</h4>
            <p className="text-sm text-gray-600 mb-4">
              Use AI to analyze your promotions and get optimization suggestions
              for better engagement and conversion.
            </p>
            <Button
              variant="outline"
              onClick={analyzePromotionsWithAI}
              disabled={isAnalyzing || configData.activePromotions.length === 0}
              className="w-full"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing promotions...
                </>
              ) : (
                <>
                  <BarChart2 className="h-4 w-4 mr-2" />
                  Analyze Promotions with AI
                </>
              )}
            </Button>
            {analyzedPromotions.length > 0 && (
              <div className="mt-4 p-3 bg-green-50 rounded-md border border-green-100">
                <h5 className="text-sm font-medium text-green-800 mb-2">
                  AI Analysis Complete
                </h5>
                <p className="text-xs text-gray-700">
                  AI suggestions have been added to your promotions. View them
                  in the Manage Promotions tab.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="promotions" className="space-y-5">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Active Promotions</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={addPromotion}
              className="text-sm"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Promotion
            </Button>
          </div>

          <div className="space-y-4">
            {configData.activePromotions.length === 0 ? (
              <div className="border border-dashed rounded-lg p-6 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <Tag className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">
                  No promotions yet
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  {configData.integrationMethod === "api"
                    ? "Connect to your retail system or add promotions manually"
                    : "Add your first promotion to get started"}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={
                    configData.integrationMethod === "api"
                      ? connectToRetailSystem
                      : addPromotion
                  }
                >
                  {configData.integrationMethod === "api" ? (
                    <>
                      <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
                      Connect to System
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Add Promotion
                    </>
                  )}
                </Button>
              </div>
            ) : (
              configData.activePromotions.map((promotion, index) => (
                <Card key={promotion.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex justify-between items-center border-b p-3 bg-gray-50">
                      <div className="flex items-center">
                        <div className="bg-red-100 p-2 rounded-full mr-3">
                          {promotion.discountType === "percentage" ? (
                            <PercentCircle className="h-4 w-4 text-red-600" />
                          ) : (
                            <Ticket className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <Input
                          value={promotion.name}
                          onChange={(e) =>
                            handlePromotionChange(index, "name", e.target.value)
                          }
                          placeholder="Promotion name"
                          className="border-0 bg-transparent p-0 h-auto text-sm font-medium focus-visible:ring-0"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        {promotion.aiSuggestions && (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                            AI Optimized
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removePromotion(index)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Description</Label>
                        <Input
                          value={promotion.description}
                          onChange={(e) =>
                            handlePromotionChange(
                              index,
                              "description",
                              e.target.value,
                            )
                          }
                          placeholder="Describe your promotion"
                        />
                        {promotion.aiSuggestions?.description && (
                          <div className="flex items-start mt-1">
                            <div className="flex-shrink-0 mt-0.5">
                              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 text-xs">
                                AI Suggestion
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-600 ml-2">
                              {promotion.aiSuggestions.description}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Discount Type</Label>
                          <Select
                            value={promotion.discountType}
                            onValueChange={(value) =>
                              handlePromotionChange(
                                index,
                                "discountType",
                                value,
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">
                                Percentage (%)
                              </SelectItem>
                              <SelectItem value="fixed">
                                Fixed Amount ($)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Value</Label>
                          <div className="relative">
                            <Input
                              value={promotion.discountValue}
                              onChange={(e) =>
                                handlePromotionChange(
                                  index,
                                  "discountValue",
                                  e.target.value,
                                )
                              }
                              placeholder={
                                promotion.discountType === "percentage"
                                  ? "e.g. 20"
                                  : "e.g. 10"
                              }
                              type="number"
                            />
                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                              <span className="text-gray-500">
                                {promotion.discountType === "percentage"
                                  ? "%"
                                  : "$"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Valid From</Label>
                          <Input
                            type="date"
                            value={promotion.validFrom}
                            onChange={(e) =>
                              handlePromotionChange(
                                index,
                                "validFrom",
                                e.target.value,
                              )
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Valid To</Label>
                          <Input
                            type="date"
                            value={promotion.validTo}
                            onChange={(e) =>
                              handlePromotionChange(
                                index,
                                "validTo",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Promotion Code</Label>
                        <Input
                          value={promotion.code}
                          onChange={(e) =>
                            handlePromotionChange(index, "code", e.target.value)
                          }
                          placeholder="e.g. SUMMER20"
                          className="font-mono"
                        />
                      </div>

                      {promotion.aiSuggestions?.creativeIdea && (
                        <div className="bg-amber-50 p-3 rounded-md border border-amber-100 mt-2">
                          <h5 className="text-xs font-medium text-amber-800 mb-1 flex items-center">
                            <LucideSettings2 className="h-3 w-3 mr-1" />
                            AI Creative Suggestion
                          </h5>
                          <p className="text-xs text-gray-700">
                            {promotion.aiSuggestions.creativeIdea}
                          </p>
                        </div>
                      )}

                      {promotion.aiSuggestions?.displayMethod && (
                        <div className="text-xs text-gray-600 flex items-center mt-1">
                          <Check className="h-3 w-3 text-green-500 mr-1" />
                          Recommended display:{" "}
                          <span className="font-medium ml-1">
                            {promotion.aiSuggestions.displayMethod}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <div className="border-t pt-4 flex justify-end">
        <Button onClick={() => onSave(configData)}>
          Save Special Offers Configuration
        </Button>
      </div>
    </div>
  );
};

/**
 * New Arrivals Configuration Component
 */
export const NewArrivalsConfigScreen = ({ onSave, initialData = {} }) => {
  const [configData, setConfigData] = useState({
    name: initialData.name || "New Arrivals",
    displayMethod: initialData.displayMethod || "grid",
    highlightDuration: initialData.highlightDuration || 14,
    automationSettings: initialData.automationSettings || {
      autoUpdate: true,
      useInventoryDates: true,
      manualApproval: false,
    },
    appearance: initialData.appearance || {
      showBadge: true,
      featuredCarousel: true,
      dedicatedSection: true,
      sortOrder: "newest",
    },
    notifyCustomers: initialData.notifyCustomers || false,
    ...initialData,
  });

  const handleChange = (field, value) => {
    setConfigData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">Configure New Arrivals</h1>
          <p className="text-gray-500 text-sm">
            Set up how new products are showcased to customers
          </p>
        </div>
        <div className="bg-emerald-100 p-3 rounded-full">
          <Tag className="h-6 w-6 text-emerald-600" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="feature-name">Feature Name</Label>
          <Input
            id="feature-name"
            placeholder="e.g. Just Arrived, Fresh Inventory"
            value={configData.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
        </div>

        <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
          <h4 className="font-medium text-emerald-800 mb-2 flex items-center">
            <Tag className="h-4 w-4 mr-1.5" />
            Display Method
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                id: "grid",
                label: "Product Grid",
                description: "Tiled layout",
                icon: <LayoutGrid />,
              },
              {
                id: "carousel",
                label: "Carousel",
                description: "Sliding showcase",
                icon: <RefreshCw />,
              },
              {
                id: "featured",
                label: "Featured Banner",
                description: "Hero section",
                icon: <LayoutPanelTop />,
              },
            ].map((method) => (
              <div
                key={method.id}
                className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-emerald-500 transition-all flex flex-col items-center text-center ${configData.displayMethod === method.id ? "border-emerald-500 bg-emerald-50/50" : ""}`}
                onClick={() => handleChange("displayMethod", method.id)}
              >
                <div className="h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
                  {React.cloneElement(method.icon, {
                    className: "h-6 w-6 text-emerald-600",
                  })}
                </div>
                <span className="text-sm font-medium">{method.label}</span>
                <span className="text-xs text-gray-500 mt-1">
                  {method.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Product Selection</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Highlight Duration</p>
                <p className="text-xs text-gray-500">Days to show as "new"</p>
              </div>
              <Select
                value={configData.highlightDuration.toString()}
                onValueChange={(value) =>
                  handleChange("highlightDuration", parseInt(value))
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <Label className="mb-2 block">Data Integration</Label>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <RefreshCw className="h-4 w-4 text-gray-500 mr-2" />
                  <Label className="cursor-pointer">
                    Auto-update from Inventory
                  </Label>
                </div>
                <Switch
                  checked={configData.automationSettings.autoUpdate}
                  onCheckedChange={(checked) => {
                    handleChange("automationSettings", {
                      ...configData.automationSettings,
                      autoUpdate: checked,
                    });
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 text-gray-500 mr-2" />
                  <Label className="cursor-pointer">Use Inventory Date</Label>
                </div>
                <Switch
                  checked={configData.automationSettings.useInventoryDates}
                  onCheckedChange={(checked) => {
                    handleChange("automationSettings", {
                      ...configData.automationSettings,
                      useInventoryDates: checked,
                    });
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <CheckCircle2 className="h-4 w-4 text-gray-500 mr-2" />
                  <Label className="cursor-pointer">
                    Manual Approval Required
                  </Label>
                </div>
                <Switch
                  checked={configData.automationSettings.manualApproval}
                  onCheckedChange={(checked) => {
                    handleChange("automationSettings", {
                      ...configData.automationSettings,
                      manualApproval: checked,
                    });
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Appearance Options</h4>
          <div className="space-y-3">
            {[
              { id: "showBadge", label: "Show 'New' Badge", icon: <Tag /> },
              {
                id: "featuredCarousel",
                label: "Homepage Carousel",
                icon: <LayoutGrid />,
              },
              {
                id: "dedicatedSection",
                label: "Dedicated Section",
                icon: <LayoutPanelTop />,
              },
            ].map((option) => (
              <div
                key={option.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  {React.cloneElement(option.icon, {
                    className: "h-4 w-4 text-gray-500 mr-2",
                  })}
                  <Label className="cursor-pointer">{option.label}</Label>
                </div>
                <Switch
                  checked={configData.appearance[option.id]}
                  onCheckedChange={(checked) => {
                    handleChange("appearance", {
                      ...configData.appearance,
                      [option.id]: checked,
                    });
                  }}
                />
              </div>
            ))}

            <div className="mt-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Sort Order</p>
                  <p className="text-xs text-gray-500">Product display order</p>
                </div>
                <Select
                  value={configData.appearance.sortOrder}
                  onValueChange={(value) =>
                    handleChange("appearance", {
                      ...configData.appearance,
                      sortOrder: value,
                    })
                  }
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="price-high">Price (High-Low)</SelectItem>
                    <SelectItem value="price-low">Price (Low-High)</SelectItem>
                    <SelectItem value="popularity">Most Popular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <Label className="font-medium block mb-1">
              Customer Notifications
            </Label>
            <span className="text-sm text-gray-500">
              Notify customers about new arrivals
            </span>
          </div>
          <Switch
            checked={configData.notifyCustomers}
            onCheckedChange={(checked) =>
              handleChange("notifyCustomers", checked)
            }
          />
        </div>
      </div>

      <div className="border-t pt-4 flex justify-end">
        <Button onClick={() => onSave(configData)}>
          Save New Arrivals Configuration
        </Button>
      </div>
    </div>
  );
};

/**
 * Online Check-in Configuration Component
 * For configuring contactless check-in experience for hotel guests
 */
export const OnlineCheckInConfigScreen = ({ onSave, initialData = {} }) => {
  const [configData, setConfigData] = useState({
    name: initialData.name || "Online Check-in",
    checkInMethod: initialData.checkInMethod || "app",
    verificationOptions: initialData.verificationOptions || {
      idVerification: true,
      paymentVerification: true,
      facialRecognition: false,
    },
    keyOptions: initialData.keyOptions || {
      digitalKey: true,
      physicalKeyBackup: true,
      autoIssue: true,
    },
    checkInTime: initialData.checkInTime || {
      earliestTime: "12:00",
      standardTime: "15:00",
      latestTime: "24:00",
      dayBefore: false,
    },
    notificationPreferences: initialData.notificationPreferences || {
      roomReady: true,
      checkInReminder: true,
      welcomeMessage: true,
      upgrades: false,
    },
    ...initialData,
  });

  const handleChange = (field, value) => {
    setConfigData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">
            Configure Online Check-in
          </h1>
          <p className="text-gray-500 text-sm">
            Set up how guests check in to your hotel digitally
          </p>
        </div>
        <div className="bg-blue-100 p-3 rounded-full">
          <Smartphone className="h-6 w-6 text-blue-600" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="checkin-name">Feature Name</Label>
          <Input
            id="checkin-name"
            placeholder="e.g. Express Check-in, Digital Check-in"
            value={configData.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
        </div>

        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <h4 className="font-medium text-blue-800 mb-2 flex items-center">
            <Smartphone className="h-4 w-4 mr-1.5" />
            Check-in Method
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                id: "app",
                label: "Hotel App",
                description: "Using hotel mobile app",
                icon: <Smartphone />,
              },
              {
                id: "web",
                label: "Web Check-in",
                description: "Via browser link",
                icon: <Globe />,
              },
              {
                id: "kiosk",
                label: "Self-Service Kiosk",
                description: "On-site kiosks",
                icon: <LayoutPanelTop />,
              },
            ].map((method) => (
              <div
                key={method.id}
                className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-blue-500 transition-all flex flex-col items-center text-center ${
                  configData.checkInMethod === method.id
                    ? "border-blue-500 bg-blue-50/50"
                    : ""
                }`}
                onClick={() => handleChange("checkInMethod", method.id)}
              >
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                  {React.cloneElement(method.icon, {
                    className: "h-6 w-6 text-blue-600",
                  })}
                </div>
                <span className="text-sm font-medium">{method.label}</span>
                <span className="text-xs text-gray-500 mt-1">
                  {method.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Verification Requirements</h4>
          <div className="space-y-3">
            {[
              {
                id: "idVerification",
                label: "ID Verification",
                icon: <FileText />,
              },
              {
                id: "paymentVerification",
                label: "Payment Method",
                icon: <CreditCard />,
              },
              {
                id: "facialRecognition",
                label: "Facial Recognition",
                icon: <Scan />,
              },
            ].map((option) => (
              <div
                key={option.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  {React.cloneElement(option.icon, {
                    className: "h-4 w-4 text-gray-500 mr-2",
                  })}
                  <Label className="cursor-pointer">{option.label}</Label>
                </div>
                <Switch
                  checked={configData.verificationOptions[option.id]}
                  onCheckedChange={(checked) => {
                    handleChange("verificationOptions", {
                      ...configData.verificationOptions,
                      [option.id]: checked,
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Room Key Options</h4>
          <div className="space-y-3">
            {[
              { id: "digitalKey", label: "Digital Room Key", icon: <Key /> },
              {
                id: "physicalKeyBackup",
                label: "Physical Key Backup",
                icon: <KeySquare />,
              },
              {
                id: "autoIssue",
                label: "Auto-Issue on Check-in",
                icon: <Zap />,
              },
            ].map((option) => (
              <div
                key={option.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  {React.cloneElement(option.icon, {
                    className: "h-4 w-4 text-gray-500 mr-2",
                  })}
                  <Label className="cursor-pointer">{option.label}</Label>
                </div>
                <Switch
                  checked={configData.keyOptions[option.id]}
                  onCheckedChange={(checked) => {
                    handleChange("keyOptions", {
                      ...configData.keyOptions,
                      [option.id]: checked,
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Check-in Time Configuration</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Earliest Check-in Time</Label>
              <Select
                value={configData.checkInTime.earliestTime}
                onValueChange={(value) =>
                  handleChange("checkInTime", {
                    ...configData.checkInTime,
                    earliestTime: value,
                  })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="08:00">8:00 AM</SelectItem>
                  <SelectItem value="10:00">10:00 AM</SelectItem>
                  <SelectItem value="12:00">12:00 PM</SelectItem>
                  <SelectItem value="14:00">2:00 PM</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label>Standard Check-in Time</Label>
              <Select
                value={configData.checkInTime.standardTime}
                onValueChange={(value) =>
                  handleChange("checkInTime", {
                    ...configData.checkInTime,
                    standardTime: value,
                  })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="14:00">2:00 PM</SelectItem>
                  <SelectItem value="15:00">3:00 PM</SelectItem>
                  <SelectItem value="16:00">4:00 PM</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 text-gray-500 mr-2" />
                <Label className="cursor-pointer">
                  Allow Day-Before Check-in
                </Label>
              </div>
              <Switch
                checked={configData.checkInTime.dayBefore}
                onCheckedChange={(checked) => {
                  handleChange("checkInTime", {
                    ...configData.checkInTime,
                    dayBefore: checked,
                  });
                }}
              />
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Notification Preferences</h4>
          <div className="space-y-3">
            {[
              {
                id: "roomReady",
                label: "Room Ready Alert",
                icon: <CheckCircle2 />,
              },
              {
                id: "checkInReminder",
                label: "Check-in Reminder",
                icon: <Bell />,
              },
              {
                id: "welcomeMessage",
                label: "Welcome Message",
                icon: <MessageCircle />,
              },
              {
                id: "upgrades",
                label: "Room Upgrade Offers",
                icon: <ArrowUpCircle />,
              },
            ].map((option) => (
              <div
                key={option.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  {React.cloneElement(option.icon, {
                    className: "h-4 w-4 text-gray-500 mr-2",
                  })}
                  <Label className="cursor-pointer">{option.label}</Label>
                </div>
                <Switch
                  checked={configData.notificationPreferences[option.id]}
                  onCheckedChange={(checked) => {
                    handleChange("notificationPreferences", {
                      ...configData.notificationPreferences,
                      [option.id]: checked,
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t pt-4 flex justify-end">
        <Button onClick={() => onSave(configData)}>
          Save Online Check-in Configuration
        </Button>
      </div>
    </div>
  );
};

/**
 * Amenities Guide Configuration Component
 * For configuring the hotel amenities digital guide
 */
export const AmenitiesGuideConfigScreen = ({ onSave, initialData = {} }) => {
  const [configData, setConfigData] = useState({
    name: initialData.name || "Amenities Guide",
    displayMethod: initialData.displayMethod || "categories",
    amenityCategories: initialData.amenityCategories || [
      { name: "Pool & Spa", enabled: true },
      { name: "Dining Options", enabled: true },
      { name: "Fitness Center", enabled: true },
      { name: "Business Center", enabled: false },
    ],
    mediaOptions: initialData.mediaOptions || {
      photos: true,
      videos: true,
      virtualTour: false,
      operatingHours: true,
    },
    bookingOptions: initialData.bookingOptions || {
      directBooking: true,
      availabilityCheck: true,
      recommendations: false,
    },
    languageOptions: initialData.languageOptions || ["English"],
    ...initialData,
  });

  const handleChange = (field, value) => {
    setConfigData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCategoryChange = (index, field, value) => {
    const newCategories = [...configData.amenityCategories];
    newCategories[index] = { ...newCategories[index], [field]: value };
    handleChange("amenityCategories", newCategories);
  };

  const addCategory = () => {
    handleChange("amenityCategories", [
      ...configData.amenityCategories,
      { name: "New Category", enabled: true },
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">
            Configure Amenities Guide
          </h1>
          <p className="text-gray-500 text-sm">
            Set up how guests discover and use hotel facilities
          </p>
        </div>
        <div className="bg-emerald-100 p-3 rounded-full">
          <Coffee className="h-6 w-6 text-emerald-600" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="amenities-name">Feature Name</Label>
          <Input
            id="amenities-name"
            placeholder="e.g. Hotel Facilities, Amenities Explorer"
            value={configData.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
        </div>

        <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
          <h4 className="font-medium text-emerald-800 mb-2 flex items-center">
            <LayoutGrid className="h-4 w-4 mr-1.5" />
            Display Method
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                id: "categories",
                label: "By Category",
                description: "Organized by type",
                icon: <LayoutGrid />,
              },
              {
                id: "location",
                label: "By Location",
                description: "Map-based view",
                icon: <MapPin />,
              },
              {
                id: "featured",
                label: "Featured First",
                description: "Highlights on top",
                icon: <Star />,
              },
            ].map((method) => (
              <div
                key={method.id}
                className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-emerald-500 transition-all flex flex-col items-center text-center ${
                  configData.displayMethod === method.id
                    ? "border-emerald-500 bg-emerald-50/50"
                    : ""
                }`}
                onClick={() => handleChange("displayMethod", method.id)}
              >
                <div className="h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
                  {React.cloneElement(method.icon, {
                    className: "h-6 w-6 text-emerald-600",
                  })}
                </div>
                <span className="text-sm font-medium">{method.label}</span>
                <span className="text-xs text-gray-500 mt-1">
                  {method.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Amenity Categories</h4>
          <div className="space-y-3 mb-4">
            {configData.amenityCategories.map((category, index) => (
              <div
                key={index}
                className="flex items-center p-2 bg-gray-50 rounded-md"
              >
                <div className="h-8 w-8 bg-emerald-100 rounded-full flex items-center justify-center mr-3">
                  {category.name.includes("Pool") ? (
                    <Waves className="h-4 w-4 text-emerald-600" />
                  ) : category.name.includes("Dining") ? (
                    <Utensils className="h-4 w-4 text-emerald-600" />
                  ) : category.name.includes("Fitness") ? (
                    <Dumbbell className="h-4 w-4 text-emerald-600" />
                  ) : category.name.includes("Business") ? (
                    <Briefcase className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Coffee className="h-4 w-4 text-emerald-600" />
                  )}
                </div>
                <div className="flex-1">
                  <Input
                    className="border-0 bg-transparent p-0 h-7 text-sm font-medium"
                    value={category.name}
                    onChange={(e) =>
                      handleCategoryChange(index, "name", e.target.value)
                    }
                  />
                </div>
                <Switch
                  checked={category.enabled}
                  onCheckedChange={(checked) => {
                    handleCategoryChange(index, "enabled", checked);
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newCategories = [...configData.amenityCategories];
                    newCategories.splice(index, 1);
                    handleChange("amenityCategories", newCategories);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={addCategory}
            className="w-full"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Amenity Category
          </Button>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Media Options</h4>
          <div className="space-y-3">
            {[
              { id: "photos", label: "Photo Galleries", icon: <ImageIcon /> },
              { id: "videos", label: "Video Tours", icon: <Video /> },
              {
                id: "virtualTour",
                label: "360° Virtual Tours",
                icon: <Compass />,
              },
              {
                id: "operatingHours",
                label: "Operating Hours",
                icon: <Clock />,
              },
            ].map((option) => (
              <div
                key={option.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  {React.cloneElement(option.icon, {
                    className: "h-4 w-4 text-gray-500 mr-2",
                  })}
                  <Label className="cursor-pointer">{option.label}</Label>
                </div>
                <Switch
                  checked={configData.mediaOptions[option.id]}
                  onCheckedChange={(checked) => {
                    handleChange("mediaOptions", {
                      ...configData.mediaOptions,
                      [option.id]: checked,
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Booking Options</h4>
          <div className="space-y-3">
            {[
              {
                id: "directBooking",
                label: "Direct Booking",
                icon: <Calendar />,
              },
              {
                id: "availabilityCheck",
                label: "Availability Check",
                icon: <CheckCircle2 />,
              },
              {
                id: "recommendations",
                label: "Personalized Recommendations",
                icon: <Heart />,
              },
            ].map((option) => (
              <div
                key={option.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  {React.cloneElement(option.icon, {
                    className: "h-4 w-4 text-gray-500 mr-2",
                  })}
                  <Label className="cursor-pointer">{option.label}</Label>
                </div>
                <Switch
                  checked={configData.bookingOptions[option.id]}
                  onCheckedChange={(checked) => {
                    handleChange("bookingOptions", {
                      ...configData.bookingOptions,
                      [option.id]: checked,
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Language Options</h4>
          <div className="space-y-3 mb-4">
            {configData.languageOptions.map((language, index) => (
              <div key={index} className="flex justify-between items-center">
                <div className="flex items-center">
                  <Globe className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-sm">{language}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newLanguages = [...configData.languageOptions];
                    newLanguages.splice(index, 1);
                    handleChange("languageOptions", newLanguages);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Select
              onValueChange={(value) => {
                if (!configData.languageOptions.includes(value)) {
                  handleChange("languageOptions", [
                    ...configData.languageOptions,
                    value,
                  ]);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Add language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="English">English</SelectItem>
                <SelectItem value="Spanish">Spanish</SelectItem>
                <SelectItem value="French">French</SelectItem>
                <SelectItem value="German">German</SelectItem>
                <SelectItem value="Chinese">Chinese</SelectItem>
                <SelectItem value="Japanese">Japanese</SelectItem>
                <SelectItem value="Arabic">Arabic</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              Add
            </Button>
          </div>
        </div>
      </div>

      <div className="border-t pt-4 flex justify-end">
        <Button onClick={() => onSave(configData)}>
          Save Amenities Guide Configuration
        </Button>
      </div>
    </div>
  );
};

/**
 * Room Service Configuration Component
 * For configuring in-room dining and service ordering
 */
export const RoomServiceConfigScreen = ({ onSave, initialData = {} }) => {
  const [configData, setConfigData] = useState({
    name: initialData.name || "Room Service",
    orderMethod: initialData.orderMethod || "app",
    menuSections: initialData.menuSections || [
      { name: "Breakfast", available: "06:00-11:00", enabled: true },
      { name: "All-Day Dining", available: "11:00-22:00", enabled: true },
      { name: "Late Night", available: "22:00-06:00", enabled: false },
      { name: "Beverages", available: "24hrs", enabled: true },
    ],
    additionalServices: initialData.additionalServices || [
      { name: "Housekeeping", enabled: true },
      { name: "Extra Amenities", enabled: true },
      { name: "Laundry Service", enabled: true },
    ],
    orderFeatures: initialData.orderFeatures || {
      timeSelection: true,
      specialInstructions: true,
      dietaryRestrictions: true,
      chargeToRoom: true,
      contactlessDelivery: true,
      trackDelivery: false,
    },
    notificationPreferences: initialData.notificationPreferences || {
      orderConfirmation: true,
      preparationUpdate: false,
      deliveryAlert: true,
    },
    ...initialData,
  });

  const handleChange = (field, value) => {
    setConfigData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSectionChange = (
    index,
    field,
    value,
    collection = "menuSections",
  ) => {
    const newArray = [...configData[collection]];
    newArray[index] = { ...newArray[index], [field]: value };
    handleChange(collection, newArray);
  };

  const addSection = (collection = "menuSections") => {
    if (collection === "menuSections") {
      handleChange(collection, [
        ...configData[collection],
        { name: "New Menu Section", available: "All Day", enabled: true },
      ]);
    } else if (collection === "additionalServices") {
      handleChange(collection, [
        ...configData[collection],
        { name: "New Service", enabled: true },
      ]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">Configure Room Service</h1>
          <p className="text-gray-500 text-sm">
            Set up in-room dining and services for guests
          </p>
        </div>
        <div className="bg-red-100 p-3 rounded-full">
          <Utensils className="h-6 w-6 text-red-600" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="service-name">Feature Name</Label>
          <Input
            id="service-name"
            placeholder="e.g. In-Room Dining, Room Service"
            value={configData.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
        </div>

        <div className="bg-red-50 p-4 rounded-lg border border-red-100">
          <h4 className="font-medium text-red-800 mb-2 flex items-center">
            <Smartphone className="h-4 w-4 mr-1.5" />
            Order Method
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                id: "app",
                label: "Mobile App",
                description: "Order via hotel app",
                icon: <Smartphone />,
              },
              {
                id: "tablet",
                label: "In-Room Tablet",
                description: "Dedicated device",
                icon: <Tablet />,
              },
              {
                id: "qrCode",
                label: "Scan QR Code",
                description: "From room material",
                icon: <QrCode />,
              },
            ].map((method) => (
              <div
                key={method.id}
                className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-red-500 transition-all flex flex-col items-center text-center ${
                  configData.orderMethod === method.id
                    ? "border-red-500 bg-red-50/50"
                    : ""
                }`}
                onClick={() => handleChange("orderMethod", method.id)}
              >
                <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mb-2">
                  {React.cloneElement(method.icon, {
                    className: "h-6 w-6 text-red-600",
                  })}
                </div>
                <span className="text-sm font-medium">{method.label}</span>
                <span className="text-xs text-gray-500 mt-1">
                  {method.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Menu Sections</h4>
          <div className="space-y-3 mb-4">
            {configData.menuSections.map((section, index) => (
              <div
                key={index}
                className="flex items-center p-2 bg-gray-50 rounded-md"
              >
                <div className="flex-1">
                  <div className="flex items-center">
                    <Input
                      className="border-0 bg-transparent p-0 h-7 text-sm font-medium"
                      value={section.name}
                      onChange={(e) =>
                        handleSectionChange(
                          index,
                          "name",
                          e.target.value,
                          "menuSections",
                        )
                      }
                    />
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-3 w-3 text-gray-400 mr-1" />
                    <Input
                      className="border-0 bg-transparent p-0 h-5 text-xs text-gray-500"
                      value={section.available}
                      onChange={(e) =>
                        handleSectionChange(
                          index,
                          "available",
                          e.target.value,
                          "menuSections",
                        )
                      }
                    />
                  </div>
                </div>
                <Switch
                  checked={section.enabled}
                  onCheckedChange={(checked) => {
                    handleSectionChange(
                      index,
                      "enabled",
                      checked,
                      "menuSections",
                    );
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newSections = [...configData.menuSections];
                    newSections.splice(index, 1);
                    handleChange("menuSections", newSections);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => addSection("menuSections")}
            className="w-full"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Menu Section
          </Button>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Additional Services</h4>
          <div className="space-y-3 mb-4">
            {configData.additionalServices.map((service, index) => (
              <div
                key={index}
                className="flex items-center p-2 bg-gray-50 rounded-md"
              >
                <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                  {service.name.includes("Housekeeping") ? (
                    <BedDouble className="h-4 w-4 text-gray-600" />
                  ) : service.name.includes("Amenities") ? (
                    <ShowerHead className="h-4 w-4 text-gray-600" />
                  ) : service.name.includes("Laundry") ? (
                    <Shirt className="h-4 w-4 text-gray-600" />
                  ) : (
                    <CircleHelp className="h-4 w-4 text-gray-600" />
                  )}
                </div>
                <div className="flex-1">
                  <Input
                    className="border-0 bg-transparent p-0 h-7 text-sm font-medium"
                    value={service.name}
                    onChange={(e) =>
                      handleSectionChange(
                        index,
                        "name",
                        e.target.value,
                        "additionalServices",
                      )
                    }
                  />
                </div>
                <Switch
                  checked={service.enabled}
                  onCheckedChange={(checked) => {
                    handleSectionChange(
                      index,
                      "enabled",
                      checked,
                      "additionalServices",
                    );
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newServices = [...configData.additionalServices];
                    newServices.splice(index, 1);
                    handleChange("additionalServices", newServices);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => addSection("additionalServices")}
            className="w-full"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Service Type
          </Button>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Order Features</h4>
          <div className="space-y-3">
            {[
              {
                id: "timeSelection",
                label: "Delivery Time Selection",
                icon: <Clock />,
              },
              {
                id: "specialInstructions",
                label: "Special Instructions",
                icon: <FileText />,
              },
              {
                id: "dietaryRestrictions",
                label: "Dietary Restrictions",
                icon: <AlertCircle />,
              },
              {
                id: "chargeToRoom",
                label: "Charge to Room",
                icon: <CreditCard />,
              },
              {
                id: "contactlessDelivery",
                label: "Contactless Delivery",
                icon: <DoorClosed />,
              },
              {
                id: "trackDelivery",
                label: "Delivery Tracking",
                icon: <Navigation />,
              },
            ].map((feature) => (
              <div
                key={feature.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  {React.cloneElement(feature.icon, {
                    className: "h-4 w-4 text-gray-500 mr-2",
                  })}
                  <Label className="cursor-pointer">{feature.label}</Label>
                </div>
                <Switch
                  checked={configData.orderFeatures[feature.id]}
                  onCheckedChange={(checked) => {
                    handleChange("orderFeatures", {
                      ...configData.orderFeatures,
                      [feature.id]: checked,
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Notification Preferences</h4>
          <div className="space-y-3">
            {[
              {
                id: "orderConfirmation",
                label: "Order Confirmation",
                icon: <CheckCircle2 />,
              },
              {
                id: "preparationUpdate",
                label: "Preparation Updates",
                icon: <Utensils />,
              },
              { id: "deliveryAlert", label: "Delivery Alert", icon: <Bell /> },
            ].map((notification) => (
              <div
                key={notification.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  {React.cloneElement(notification.icon, {
                    className: "h-4 w-4 text-gray-500 mr-2",
                  })}
                  <Label className="cursor-pointer">{notification.label}</Label>
                </div>
                <Switch
                  checked={configData.notificationPreferences[notification.id]}
                  onCheckedChange={(checked) => {
                    handleChange("notificationPreferences", {
                      ...configData.notificationPreferences,
                      [notification.id]: checked,
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t pt-4 flex justify-end">
        <Button onClick={() => onSave(configData)}>
          Save Room Service Configuration
        </Button>
      </div>
    </div>
  );
};

/**
 * Exhibit Information Configuration Component
 * For museum exhibit information displays
 */
export const ExhibitInfoConfigScreen = ({
  onSave,
  initialData = {},
  blueprintId,
}) => {
  const { toast } = useToast();
  const [configData, setConfigData] = useState({
    name: initialData.name || "Exhibit Information",
    displayMethod: initialData.displayMethod || "browse", // Default changed to browse instead of scan
    contentTypes: initialData.contentTypes || {
      description: true,
      artifacts: true,
      history: true,
      media: true,
      artists: true,
    },
    languages: initialData.languages || ["English"],
    dataSources: initialData.dataSources || {
      useManual: true,
      useUpload: false,
      useUrl: false,
    },
    exhibitFiles: initialData.exhibitFiles || [],
    exhibitUrls: initialData.exhibitUrls || [],
    exhibitData: initialData.exhibitData || [],
    extractedData: initialData.extractedData || [],
    ...initialData,
  });

  // State for scraping and processing
  const [isScraping, setIsScraping] = useState(false);
  const [scrapingProgress, setScrapingProgress] = useState({
    current: 0,
    total: 0,
    currentUrl: "",
  });
  const [scrapedData, setScrapedData] = useState({});
  const [scrapingError, setScrapingError] = useState(null);
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [testQuestion, setTestQuestion] = useState("");
  const [testAnswer, setTestAnswer] = useState("");
  const [isGeneratingAnswer, setIsGeneratingAnswer] = useState(false);

  const fileInputRef = useRef(null);
  const storage = getStorage();

  const handleChange = (field, value) => {
    setConfigData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Function to check if a URL is valid
  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (err) {
      return false;
    }
  };

  // Function to make a URL absolute
  const makeAbsoluteUrl = (baseUrl, relativeUrl) => {
    try {
      return new URL(relativeUrl, baseUrl).href;
    } catch (err) {
      return null;
    }
  };

  // Modified scrape function to better handle different museum websites
  const scrapeUrl = async (url) => {
    try {
      const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer fc-e39118dbc4194ccfae3ed8a75e16be80",
        },
        body: JSON.stringify({
          url: url,
          formats: ["html", "markdown"],
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to scrape URL");
      }

      return data.data;
    } catch (error) {
      console.error(`Error scraping URL ${url}:`, error);
      throw error;
    }
  };

  // Improved exhibit link extraction to better match museum website structures
  const extractExhibitLinks = (html, baseUrl) => {
    const links = [];

    // Pattern for Life and Science Museum and similar layouts
    // Look for articles with class 'explore-post' containing links to exhibits
    const exhibitArticlePattern =
      /<article[^>]*class="[^"]*explore-post[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/article>/g;
    let match;

    while ((match = exhibitArticlePattern.exec(html)) !== null) {
      const href = match[1];
      if (href && !href.includes("javascript:")) {
        if (isValidUrl(href)) {
          if (!links.includes(href)) links.push(href);
        } else {
          const absoluteUrl = makeAbsoluteUrl(baseUrl, href);
          if (absoluteUrl && !links.includes(absoluteUrl))
            links.push(absoluteUrl);
        }
      }
    }

    // If the above pattern doesn't find anything, try a more general approach
    if (links.length === 0) {
      // Try to find any links with "exhibit" or similar in the URL or content
      const generalExhibitPattern =
        /<a[^>]*href="([^"]+)"[^>]*>(?:(?!<\/a>).)*(?:exhibit|collection|display|gallery|artifact|attraction)[^<]*<\/a>/gi;

      while ((match = generalExhibitPattern.exec(html)) !== null) {
        const href = match[1];
        if (href && !href.includes("javascript:")) {
          if (isValidUrl(href)) {
            if (!links.includes(href)) links.push(href);
          } else {
            const absoluteUrl = makeAbsoluteUrl(baseUrl, href);
            if (absoluteUrl && !links.includes(absoluteUrl))
              links.push(absoluteUrl);
          }
        }
      }
    }

    // If still no links, extract all links that seem to be internal navigation
    if (links.length === 0) {
      const internalLinksPattern =
        /<a[^>]*href="([^"]+\/[^"]*)"[^>]*>(?:(?!<\/a>).)*<\/a>/g;

      while ((match = internalLinksPattern.exec(html)) !== null) {
        const href = match[1];
        if (
          href &&
          !href.includes("javascript:") &&
          !href.startsWith("#") &&
          !href.includes("privacy") &&
          !href.includes("terms") &&
          !href.includes("login") &&
          !href.includes("contact")
        ) {
          if (isValidUrl(href)) {
            if (!links.includes(href)) links.push(href);
          } else {
            const absoluteUrl = makeAbsoluteUrl(baseUrl, href);
            if (
              absoluteUrl &&
              !links.includes(absoluteUrl) &&
              absoluteUrl.includes(new URL(baseUrl).hostname)
            ) {
              links.push(absoluteUrl);
            }
          }
        }
      }
    }

    console.log(`Found ${links.length} potential exhibit links`);
    return links.slice(0, 30); // Limit to 30 links to prevent overwhelming
  };

  // Enhanced exhibit info extraction - improved to handle more museum website formats
  const extractExhibitInfo = (html, url) => {
    try {
      const result = {
        id: `exhibit_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: "",
        description: "",
        artifacts: "",
        history: "",
        artist: "",
        type: "unknown",
        url: url,
      };

      // Detect indoor/outdoor type
      if (
        html.includes("indoor") ||
        html.match(/<div[^>]*class="[^"]*tag[^"]*"[^>]*>indoor<\/div>/i)
      ) {
        result.type = "indoor";
      } else if (
        html.includes("outdoor") ||
        html.match(/<div[^>]*class="[^"]*tag[^"]*"[^>]*>outdoor<\/div>/i)
      ) {
        result.type = "outdoor";
      }

      // Extract title - try multiple patterns
      const titlePatterns = [
        /<h1[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h1>/i,
        /<h1[^>]*>([^<]+)<\/h1>/i,
        /<title>([^<|:]+)(?:\s*[\|:]\s*[^<]+)?<\/title>/i,
        /<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i,
      ];

      for (const pattern of titlePatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          result.name = match[1]
            .trim()
            .replace(/\s*\|\s*.*$/, "") // Remove site name after pipe
            .replace(/\s*-\s*.*$/, ""); // Remove site name after dash
          break;
        }
      }

      // If no name found but URL contains exhibit name
      if (!result.name) {
        try {
          const urlObj = new URL(url);
          const pathSegments = urlObj.pathname
            .split("/")
            .filter((segment) => segment.length > 0);
          if (pathSegments.length > 0) {
            const lastSegment = pathSegments[pathSegments.length - 1]
              .replace(/-/g, " ")
              .replace(/_/g, " ")
              .replace(/\.html$/, "")
              .replace(/\.php$/, "");

            // Capitalize words for a nicer display
            result.name = lastSegment
              .split(" ")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ");
          }
        } catch (error) {
          console.error("Error parsing URL for name:", error);
        }
      }

      // Extract description - try multiple patterns
      const descriptionPatterns = [
        /<div[^>]*class="[^"]*description[^"]*"[^>]*>(?:<p>)?([^<]+)(?:<\/p>)?<\/div>/i,
        /<meta[^>]*name="description"[^>]*content="([^"]+)"/i,
        /<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i,
        /<p[^>]*class="[^"]*description[^"]*"[^>]*>([^<]+)<\/p>/i,
        /<div[^>]*id="[^"]*description[^"]*"[^>]*>(?:<p>)?([^<]+)(?:<\/p>)?<\/div>/i,
      ];

      for (const pattern of descriptionPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          result.description = match[1].trim();
          break;
        }
      }

      // If no description found, look for the first substantial paragraph
      if (!result.description) {
        const paragraphs = html.match(/<p[^>]*>([^<]{30,})<\/p>/g);
        if (paragraphs && paragraphs.length > 0) {
          const firstParagraph = paragraphs[0].replace(/<\/?p[^>]*>/g, "");
          result.description = firstParagraph.trim();
        }
      }

      // Extract information about artifacts/features
      const artifactPatterns = [
        /<h[2-4][^>]*>(?:Features|Artifacts|Exhibits|Materials|Objects|What You'll See)[^<]*<\/h[2-4]>[\s\S]*?<p>([^<]+)<\/p>/i,
        /<h[2-4][^>]*>(?:What to See|On Display|Collection)[^<]*<\/h[2-4]>[\s\S]*?<p>([^<]+)<\/p>/i,
        /<dt[^>]*>(?:Materials|Medium|Dimensions)[^<]*<\/dt>[\s\S]*?<dd[^>]*>([^<]+)<\/dd>/i,
        /<div[^>]*class="[^"]*artifact-info[^"]*"[^>]*>([^<]+)<\/div>/i,
      ];

      for (const pattern of artifactPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          result.artifacts = match[1].trim();
          break;
        }
      }

      // Extract historical information
      const historyPatterns = [
        /<h[2-4][^>]*>(?:History|Background|Context|Time Period|About)[^<]*<\/h[2-4]>[\s\S]*?<p>([^<]+)<\/p>/i,
        /<dt[^>]*>(?:Date|Period|Era|Century)[^<]*<\/dt>[\s\S]*?<dd[^>]*>([^<]+)<\/dd>/i,
        /<div[^>]*class="[^"]*history[^"]*"[^>]*>([^<]+)<\/div>/i,
      ];

      for (const pattern of historyPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          result.history = match[1].trim();
          break;
        }
      }

      // Extract artist/creator information
      const artistPatterns = [
        /<h[2-4][^>]*>(?:Creator|Artist|Designer|Maker)[^<]*<\/h[2-4]>[\s\S]*?<p>([^<]+)<\/p>/i,
        /<dt[^>]*>(?:Artist|Creator|Made By|Designer)[^<]*<\/dt>[\s\S]*?<dd[^>]*>([^<]+)<\/dd>/i,
        /<span[^>]*>(?:Artist|Creator):<\/span>\s*([^<]+)/i,
        /<div[^>]*class="[^"]*artist[^"]*"[^>]*>([^<]+)<\/div>/i,
      ];

      for (const pattern of artistPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          result.artist = match[1].trim();
          break;
        }
      }

      return result;
    } catch (error) {
      console.error("Error extracting exhibit info:", error);
      // Create a basic exhibit entry with information from URL
      return {
        id: `exhibit_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name:
          new URL(url).pathname.split("/").pop().replace(/-|_/g, " ") ||
          "Unknown Exhibit",
        description: "Information could not be extracted for this exhibit.",
        url: url,
      };
    }
  };

  // Improved processExhibitsUrl function with better debugging and crawling logic
  const processExhibitsUrl = async (url) => {
    if (!isValidUrl(url)) {
      setScrapingError("Please enter a valid URL");
      return;
    }

    setIsScraping(true);
    setScrapingError(null);
    setScrapingProgress({
      current: 0,
      total: 0,
      currentUrl: url,
    });

    try {
      // Add the URL to the list first
      const urlItem = {
        id: `url_${Date.now()}`,
        url: url,
        addedDate: new Date().toISOString(),
        status: "processing",
      };

      setConfigData((prev) => ({
        ...prev,
        exhibitUrls: [...prev.exhibitUrls, urlItem],
      }));

      // First, scrape the main page
      console.log(`Starting to scrape main page: ${url}`);
      const mainPageData = await scrapeUrl(url);
      console.log(
        `Main page scraped successfully, extracting exhibit links...`,
      );

      // Extract all exhibit links from the main page
      const exhibitLinks = extractExhibitLinks(mainPageData.html, url);
      console.log(`Found ${exhibitLinks.length} exhibit links to process`);

      // If we're dealing with a page that already has exhibit listings
      const exhibitsOnMainPage = checkForExhibitsOnMainPage(mainPageData.html);

      // Update progress
      setScrapingProgress({
        current: 0,
        total: exhibitLinks.length || (exhibitsOnMainPage ? 1 : 0),
        currentUrl: url,
      });

      // Process exhibits found directly on the main page, if any
      if (exhibitsOnMainPage) {
        console.log(
          "Found exhibits directly on the main page, processing them...",
        );
        const mainPageExhibits = extractExhibitsFromListingPage(
          mainPageData.html,
          url,
        );

        if (mainPageExhibits.length > 0) {
          setConfigData((prev) => ({
            ...prev,
            extractedData: [...prev.extractedData, ...mainPageExhibits],
          }));

          console.log(
            `Processed ${mainPageExhibits.length} exhibits from the main page`,
          );

          // If we also have links to individual pages, continue with those
          if (exhibitLinks.length === 0) {
            // Update URL status to completed if we're done
            setConfigData((prev) => ({
              ...prev,
              exhibitUrls: prev.exhibitUrls.map((item) =>
                item.id === urlItem.id
                  ? { ...item, status: "completed" }
                  : item,
              ),
            }));

            toast({
              title: "Exhibits Processed",
              description: `Successfully processed ${mainPageExhibits.length} exhibits from the listing page.`,
              variant: "success",
              duration: 5000,
            });

            setIsScraping(false);
            return;
          }
        }
      }

      // If no links found and no exhibits on main page, try to interpret the main page as a single exhibit
      if (exhibitLinks.length === 0 && !exhibitsOnMainPage) {
        console.log(
          "No exhibit links found. Treating main page as a single exhibit...",
        );
        const mainExhibit = extractExhibitInfo(mainPageData.html, url);

        // Update state for single exhibit
        setConfigData((prev) => ({
          ...prev,
          extractedData: [...prev.extractedData, mainExhibit],
          exhibitUrls: prev.exhibitUrls.map((item) =>
            item.id === urlItem.id ? { ...item, status: "completed" } : item,
          ),
        }));

        toast({
          title: "Exhibit Processed",
          description:
            "Successfully processed exhibit information from the main page.",
          variant: "success",
          duration: 5000,
        });

        setIsScraping(false);
        return;
      }

      // Process each exhibit link
      const exhibits = [];
      let successCount = 0;

      for (let i = 0; i < exhibitLinks.length; i++) {
        try {
          const exhibitUrl = exhibitLinks[i];

          // Update progress
          setScrapingProgress({
            current: i + 1,
            total: exhibitLinks.length,
            currentUrl: exhibitUrl,
          });

          console.log(
            `Processing exhibit ${i + 1}/${exhibitLinks.length}: ${exhibitUrl}`,
          );

          // Scrape the exhibit page
          const exhibitData = await scrapeUrl(exhibitUrl);
          console.log(`Successfully scraped exhibit page: ${exhibitUrl}`);

          // Extract exhibit information
          const exhibitInfo = extractExhibitInfo(exhibitData.html, exhibitUrl);
          console.log(`Extracted exhibit info: ${exhibitInfo.name}`);

          // Ensure exhibit has a unique name
          if (
            !exhibitInfo.name ||
            exhibits.some((e) => e.name === exhibitInfo.name)
          ) {
            exhibitInfo.name = `Exhibit ${i + 1}: ${exhibitInfo.name || "Unknown"}`;
          }

          exhibits.push(exhibitInfo);
          successCount++;

          // Update every 3 exhibits or at the end for smoother UX
          if (i % 3 === 0 || i === exhibitLinks.length - 1) {
            const newExhibits = exhibits.slice(i % 3 === 0 ? -1 : -3);

            setConfigData((prev) => {
              // Ensure we're not adding duplicates
              const existingIds = new Set(prev.extractedData.map((e) => e.id));
              const uniqueNewExhibits = newExhibits.filter(
                (e) => !existingIds.has(e.id),
              );

              return {
                ...prev,
                extractedData: [...prev.extractedData, ...uniqueNewExhibits],
              };
            });
          }
        } catch (error) {
          console.error(`Error processing exhibit: ${exhibitLinks[i]}`, error);
          // Continue with other exhibits
        }
      }

      // Update URL status to completed
      setConfigData((prev) => {
        console.log(
          `Final update: Preserving ${prev.extractedData.length} exhibits`,
        );

        return {
          ...prev,
          exhibitUrls: prev.exhibitUrls.map((item) =>
            item.id === urlItem.id ? { ...item, status: "completed" } : item,
          ),
          // Explicitly preserve extractedData to prevent it from being lost
          extractedData: [...prev.extractedData],
        };
      });

      // Optional: Add a backup using localStorage
      try {
        if (exhibits.length > 0) {
          localStorage.setItem(
            `exhibits_${blueprintId}`,
            JSON.stringify(exhibits),
          );
        }
      } catch (error) {
        console.error("Error creating backup:", error);
      }

      toast({
        title: "Exhibits Processed",
        description: `Successfully processed ${successCount} out of ${exhibitLinks.length} exhibits.`,
        variant: "success",
        duration: 5000,
      });
    } catch (error) {
      console.error("Error processing exhibits URL:", error);
      setScrapingError(error.message || "Failed to process the URL");

      // Update URL status to error
      setConfigData((prev) => ({
        ...prev,
        exhibitUrls: prev.exhibitUrls.map((item) =>
          item.url === url ? { ...item, status: "error" } : item,
        ),
      }));

      toast({
        title: "Error Processing URL",
        description:
          "Could not extract exhibit information. Please try another URL.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsScraping(false);
    }
  };

  // New helper function to check if the main page is an exhibit listing page
  const checkForExhibitsOnMainPage = (html) => {
    // Check for common patterns of exhibit listing pages
    const hasExhibitListings =
      html.includes('class="explore-post"') ||
      html.includes('class="exhibit-list"') ||
      html.includes('class="collection-item"') ||
      (html.match(/<article[^>]*>/g) || []).length > 3; // Multiple articles typically indicate listings

    console.log(`Checking for exhibits on main page: ${hasExhibitListings}`);
    return hasExhibitListings;
  };

  // New function to extract exhibits directly from a listing page
  const extractExhibitsFromListingPage = (html, baseUrl) => {
    const exhibits = [];

    // Try to match article/exhibit patterns specific to the example we saw
    const exhibitPattern =
      /<article[^>]*class="[^"]*explore-post[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<h1[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h1>[\s\S]*?<div[^>]*class="[^"]*description[^"]*"[^>]*>(?:<p>)?([^<]+)(?:<\/p>)?<\/div>[\s\S]*?<\/article>/g;

    let match;
    while ((match = exhibitPattern.exec(html)) !== null) {
      try {
        const href = match[1];
        const name = match[2].trim();
        const description = match[3].trim();

        // Determine if indoor or outdoor
        const typeMatch = html
          .substring(match.index, match.index + 300)
          .match(/<div[^>]*class="[^"]*tag[^"]*"[^>]*>([^<]+)<\/div>/i);
        const type =
          typeMatch && typeMatch[1].toLowerCase().includes("indoor")
            ? "indoor"
            : typeMatch && typeMatch[1].toLowerCase().includes("outdoor")
              ? "outdoor"
              : "unknown";

        // Get absolute URL
        let exhibitUrl = href;
        if (!isValidUrl(href)) {
          exhibitUrl = makeAbsoluteUrl(baseUrl, href);
        }

        exhibits.push({
          id: `exhibit_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          name: name,
          description: description,
          type: type,
          url: exhibitUrl,
          artifacts: "",
          history: "",
          artist: "",
        });
      } catch (error) {
        console.error("Error extracting exhibit from listing:", error);
      }
    }

    // If the specific pattern doesn't work, try a more generic approach
    if (exhibits.length === 0) {
      // Try to find any content that looks like exhibit cards
      const cardPattern =
        /<div[^>]*class="[^"]*(?:card|item|listing)[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<h\d[^>]*>([^<]+)<\/h\d>[\s\S]*?<p[^>]*>([^<]+)<\/p>[\s\S]*?<\/div>/g;

      while ((match = cardPattern.exec(html)) !== null) {
        try {
          const href = match[1];
          const name = match[2].trim();
          const description = match[3].trim();

          // Get absolute URL
          let exhibitUrl = href;
          if (!isValidUrl(href)) {
            exhibitUrl = makeAbsoluteUrl(baseUrl, href);
          }

          exhibits.push({
            id: `exhibit_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            name: name,
            description: description,
            type: "unknown",
            url: exhibitUrl,
            artifacts: "",
            history: "",
            artist: "",
          });
        } catch (error) {
          console.error("Error extracting exhibit from card:", error);
        }
      }
    }

    console.log(
      `Extracted ${exhibits.length} exhibits directly from listing page`,
    );
    return exhibits;
  };

  // Handle file upload for exhibits
  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || !files.length) return;

    setUploading(true);
    toast({
      title: "Processing Files",
      description: "Uploading exhibit files...",
      duration: 5000,
    });

    try {
      const uploadedFiles = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileRef = ref(
          storage,
          `blueprints/${blueprintId}/exhibits/${Date.now()}_${file.name}`,
        );

        // Upload file
        await uploadBytes(fileRef, file);
        const downloadURL = await getDownloadURL(fileRef);

        uploadedFiles.push({
          id: `file_${Date.now()}_${i}`,
          name: file.name,
          type: file.type,
          url: downloadURL,
          uploadDate: new Date().toISOString(),
        });
      }

      // Update state with new files
      setConfigData((prev) => ({
        ...prev,
        exhibitFiles: [...prev.exhibitFiles, ...uploadedFiles],
      }));

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      toast({
        title: "Files Uploaded",
        description: "Exhibit files uploaded successfully!",
        variant: "success",
      });
    } catch (error) {
      console.error("Error uploading files:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // Remove an exhibit URL
  const removeUrl = (urlId) => {
    setConfigData((prev) => ({
      ...prev,
      exhibitUrls: prev.exhibitUrls.filter((url) => url.id !== urlId),
    }));
  };

  // Remove a file
  const removeFile = (fileId) => {
    setConfigData((prev) => ({
      ...prev,
      exhibitFiles: prev.exhibitFiles.filter((file) => file.id !== fileId),
    }));
  };

  // Add a manual exhibit
  const handleAddManualExhibit = () => {
    const newExhibitId = `exhibit_${Date.now()}`;
    setConfigData((prev) => ({
      ...prev,
      exhibitData: [
        ...prev.exhibitData,
        {
          id: newExhibitId,
          name: `New Exhibit ${prev.exhibitData.length + 1}`,
          description: "",
          artifacts: "",
          history: "",
          artist: "",
        },
      ],
    }));
  };

  // Update a manual exhibit
  const updateExhibitData = (id, field, value) => {
    setConfigData((prev) => ({
      ...prev,
      exhibitData: prev.exhibitData.map((exhibit) =>
        exhibit.id === id ? { ...exhibit, [field]: value } : exhibit,
      ),
    }));
  };

  // Remove a manual exhibit
  const removeExhibit = (id) => {
    setConfigData((prev) => ({
      ...prev,
      exhibitData: prev.exhibitData.filter((exhibit) => exhibit.id !== id),
    }));
  };

  // Remove an extracted exhibit
  const removeExtractedExhibit = (id) => {
    setConfigData((prev) => ({
      ...prev,
      extractedData: prev.extractedData.filter((exhibit) => exhibit.id !== id),
    }));
  };

  // Simple test question answering using the extracted data
  const testQuestionAnswering = async () => {
    if (
      !testQuestion.trim() ||
      (configData.extractedData.length === 0 &&
        configData.exhibitData.length === 0)
    ) {
      return;
    }

    setIsGeneratingAnswer(true);

    try {
      // Get all exhibit data as context
      const allExhibits = [
        ...configData.extractedData,
        ...configData.exhibitData,
      ];

      // Basic keyword matching for simple Q&A
      const keywords = testQuestion.toLowerCase().split(/\s+/);

      // Find most relevant exhibit based on keyword matches
      let bestMatch = null;
      let highestScore = 0;

      for (const exhibit of allExhibits) {
        let score = 0;
        const exhibitText =
          `${exhibit.name || ""} ${exhibit.description || ""} ${exhibit.artifacts || ""} ${exhibit.history || ""} ${exhibit.artist || ""}`.toLowerCase();

        for (const keyword of keywords) {
          if (keyword.length < 3) continue; // Skip short words
          if (exhibitText.includes(keyword)) {
            score += 1;
          }
          // Extra points for keywords in name or type
          if ((exhibit.name?.toLowerCase() || "").includes(keyword)) {
            score += 2;
          }
          if ((exhibit.type?.toLowerCase() || "").includes(keyword)) {
            score += 1;
          }
        }

        if (score > highestScore) {
          highestScore = score;
          bestMatch = exhibit;
        }
      }

      let answer = "I don't have enough information to answer that question.";

      if (bestMatch) {
        // Determine what the question is asking about
        if (
          testQuestion.toLowerCase().includes("who created") ||
          testQuestion.toLowerCase().includes("who made") ||
          testQuestion.toLowerCase().includes("artist")
        ) {
          if (bestMatch.artist && bestMatch.artist.trim() !== "") {
            answer = `${bestMatch.name} was created by ${bestMatch.artist}.`;
          } else {
            answer = `I don't have information about who created ${bestMatch.name}.`;
          }
        } else if (
          testQuestion.toLowerCase().includes("when") ||
          testQuestion.toLowerCase().includes("year") ||
          testQuestion.toLowerCase().includes("period") ||
          testQuestion.toLowerCase().includes("century")
        ) {
          if (bestMatch.history && bestMatch.history.trim() !== "") {
            answer = `Regarding ${bestMatch.name}: ${bestMatch.history}`;
          } else {
            answer = `I don't have historical information about ${bestMatch.name}.`;
          }
        } else if (
          testQuestion.toLowerCase().includes("material") ||
          testQuestion.toLowerCase().includes("made of") ||
          testQuestion.toLowerCase().includes("artifact") ||
          testQuestion.toLowerCase().includes("feature")
        ) {
          if (bestMatch.artifacts && bestMatch.artifacts.trim() !== "") {
            answer = `${bestMatch.name}: ${bestMatch.artifacts}`;
          } else {
            answer = `I don't have artifact details about ${bestMatch.name}.`;
          }
        } else if (
          testQuestion.toLowerCase().includes("inside") ||
          testQuestion.toLowerCase().includes("outside") ||
          testQuestion.toLowerCase().includes("indoor") ||
          testQuestion.toLowerCase().includes("outdoor") ||
          testQuestion.toLowerCase().includes("location")
        ) {
          if (bestMatch.type) {
            answer = `${bestMatch.name} is an ${bestMatch.type} exhibit.`;
          } else {
            answer = `I don't have location information about ${bestMatch.name}.`;
          }
        } else {
          // General description fallback
          answer = `About ${bestMatch.name}: ${bestMatch.description}`;
        }
      }

      setTestAnswer(answer);
    } catch (error) {
      console.error("Error in test Q&A:", error);
      setTestAnswer(
        "Sorry, I encountered an error while processing your question.",
      );
    } finally {
      setIsGeneratingAnswer(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">
            Configure Exhibit Information
          </h1>
          <p className="text-gray-500 text-sm">
            Set up how exhibit details are displayed to visitors
          </p>
        </div>
        <div className="bg-indigo-100 p-3 rounded-full">
          <LayoutPanelTop className="h-6 w-6 text-indigo-600" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="feature-name">Feature Name</Label>
          <Input
            id="feature-name"
            placeholder="e.g. Exhibit Information"
            value={configData.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
        </div>

        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
          <h4 className="font-medium text-indigo-800 mb-2 flex items-center">
            <LayoutPanelTop className="h-4 w-4 mr-1.5" />
            Access Method
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                id: "browse",
                label: "Browse Exhibits",
                description: "Catalog of exhibits",
                icon: <LayoutGrid />,
              },
              {
                id: "location",
                label: "Location-Based",
                description: "Auto-detect nearby",
                icon: <MapPin />,
              },
            ].map((method) => (
              <div
                key={method.id}
                className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-indigo-500 transition-all flex flex-col items-center text-center ${configData.displayMethod === method.id ? "border-indigo-500 bg-indigo-50/50" : ""}`}
                onClick={() => handleChange("displayMethod", method.id)}
              >
                <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center mb-2">
                  {React.cloneElement(method.icon, {
                    className: "h-6 w-6 text-indigo-600",
                  })}
                </div>
                <span className="text-sm font-medium">{method.label}</span>
                <span className="text-xs text-gray-500 mt-1">
                  {method.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Content to Display</h4>
          <div className="space-y-2">
            {[
              { id: "description", label: "Exhibit Descriptions" },
              { id: "artifacts", label: "Artifact Details" },
              { id: "history", label: "Historical Context" },
              { id: "media", label: "Photos & Videos" },
              { id: "artists", label: "Artist/Creator Information" },
            ].map((type) => (
              <div key={type.id} className="flex items-center space-x-2">
                <Checkbox
                  id={type.id}
                  checked={configData.contentTypes[type.id]}
                  onCheckedChange={(checked) => {
                    handleChange("contentTypes", {
                      ...configData.contentTypes,
                      [type.id]: !!checked,
                    });
                  }}
                />
                <label htmlFor={type.id} className="text-sm cursor-pointer">
                  {type.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Languages</h4>
          <div className="space-y-3 mb-4">
            {configData.languages.map((language, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-sm">{language}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newLanguages = [...configData.languages];
                    newLanguages.splice(index, 1);
                    handleChange("languages", newLanguages);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Select
              onValueChange={(value) => {
                if (!configData.languages.includes(value)) {
                  handleChange("languages", [...configData.languages, value]);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Add language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="English">English</SelectItem>
                <SelectItem value="Spanish">Spanish</SelectItem>
                <SelectItem value="French">French</SelectItem>
                <SelectItem value="German">German</SelectItem>
                <SelectItem value="Mandarin">Mandarin</SelectItem>
                <SelectItem value="Japanese">Japanese</SelectItem>
                <SelectItem value="Arabic">Arabic</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              Add
            </Button>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Data Sources</h4>
          <p className="text-sm text-gray-500 mb-3">
            Select all sources you want to use (you can combine multiple)
          </p>
          <div className="space-y-2">
            {[
              { id: "useManual", label: "Manual Entry", icon: <FileText /> },
              { id: "useUpload", label: "Upload Files", icon: <UploadCloud /> },
              { id: "useUrl", label: "External URLs", icon: <Globe /> },
            ].map((source) => (
              <div key={source.id} className="flex items-center space-x-2">
                <Checkbox
                  id={source.id}
                  checked={configData.dataSources[source.id]}
                  onCheckedChange={(checked) => {
                    handleChange("dataSources", {
                      ...configData.dataSources,
                      [source.id]: !!checked,
                    });
                  }}
                />
                <div className="flex items-center">
                  {React.cloneElement(source.icon, {
                    className: "h-4 w-4 text-gray-500 mr-2",
                  })}
                  <label htmlFor={source.id} className="text-sm cursor-pointer">
                    {source.label}
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* External URLs Section - Show when External URLs is selected */}
        {configData.dataSources.useUrl && (
          <div className="border rounded-lg p-4 mt-4">
            <h4 className="font-medium mb-3">External Resources</h4>

            <div className="space-y-3 mb-4">
              <div className="flex gap-2">
                <Input
                  placeholder="https://example.com/exhibits"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={isScraping}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    if (urlInput.trim()) {
                      processExhibitsUrl(urlInput);
                      setUrlInput("");
                    }
                  }}
                  disabled={isScraping || !urlInput.trim()}
                >
                  {isScraping ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Add"
                  )}
                </Button>
              </div>

              {isScraping && scrapingProgress.total > 0 && (
                <div className="text-xs text-indigo-600">
                  <div className="flex items-center mb-1">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    <span>
                      Processing exhibit {scrapingProgress.current} of{" "}
                      {scrapingProgress.total}...
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-indigo-600 h-1.5 rounded-full"
                      style={{
                        width: `${(scrapingProgress.current / scrapingProgress.total) * 100}%`,
                      }}
                    ></div>
                  </div>
                  <div className="text-gray-500 mt-1 truncate">
                    {scrapingProgress.currentUrl}
                  </div>
                </div>
              )}

              {scrapingError && (
                <p className="text-xs text-red-500">{scrapingError}</p>
              )}

              <p className="text-xs text-gray-500">
                Add links to museum websites or exhibit catalogs. The system
                will automatically extract all exhibits and their information.
              </p>
            </div>

            {/* Display added URLs */}
            <div className="space-y-2">
              {configData.exhibitUrls.map((urlItem) => (
                <div
                  key={urlItem.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                >
                  <div className="flex items-center">
                    <LinkIcon className="h-4 w-4 text-blue-500 mr-2" />
                    <span className="text-sm truncate max-w-[240px]">
                      {urlItem.url}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {urlItem.status === "processing" && (
                      <Badge className="bg-yellow-100 text-yellow-800">
                        Processing
                      </Badge>
                    )}
                    {urlItem.status === "completed" && (
                      <Badge className="bg-green-100 text-green-800">
                        Completed
                      </Badge>
                    )}
                    {urlItem.status === "error" && (
                      <Badge className="bg-red-100 text-red-800">Error</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      asChild
                    >
                      <a
                        href={urlItem.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => removeUrl(urlItem.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {configData.exhibitUrls.length === 0 && !isScraping && (
                <p className="text-center text-sm text-gray-500 py-2">
                  No URLs added yet
                </p>
              )}
            </div>
          </div>
        )}

        {/* File Upload Section - Show when Upload Files is selected */}
        {configData.dataSources.useUpload && (
          <div className="border rounded-lg p-4 mt-4">
            <h4 className="font-medium mb-3">Upload Exhibit Files</h4>

            <div className="border-2 border-dashed rounded-lg p-6 text-center mb-4">
              <UploadCloud className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm font-medium mb-1">
                Drag and drop exhibit files
              </p>
              <p className="text-xs text-gray-500 mb-3">
                PDFs, Images, Documents (max 10MB each)
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>Browse Files</>
                )}
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                onChange={handleFileUpload}
              />
            </div>

            {/* Display uploaded files */}
            <div className="space-y-2">
              {configData.exhibitFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                >
                  <div className="flex items-center">
                    {file.type.includes("image") ? (
                      <ImageIcon className="h-4 w-4 text-blue-500 mr-2" />
                    ) : file.type.includes("pdf") ? (
                      <FileText className="h-4 w-4 text-orange-500 mr-2" />
                    ) : (
                      <File className="h-4 w-4 text-gray-500 mr-2" />
                    )}
                    <span className="text-sm">{file.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      asChild
                    >
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => removeFile(file.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {configData.exhibitFiles.length === 0 && !uploading && (
                <p className="text-center text-sm text-gray-500 py-2">
                  No files uploaded yet
                </p>
              )}
            </div>
          </div>
        )}

        {/* Manual Entry Section - Show when Manual Entry is selected */}
        {configData.dataSources.useManual && (
          <div className="border rounded-lg p-4 mt-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium">Manual Exhibit Information</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddManualExhibit}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Exhibit
              </Button>
            </div>

            {/* Display manual entries */}
            <div className="space-y-4">
              {configData.exhibitData.map((exhibit) => (
                <div
                  key={exhibit.id}
                  className="border rounded-lg p-3 bg-gray-50"
                >
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium">Exhibit Name</label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => removeExhibit(exhibit.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    value={exhibit.name}
                    onChange={(e) =>
                      updateExhibitData(exhibit.id, "name", e.target.value)
                    }
                    placeholder="Exhibit Name"
                    className="mb-2"
                  />

                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={exhibit.description}
                    onChange={(e) =>
                      updateExhibitData(
                        exhibit.id,
                        "description",
                        e.target.value,
                      )
                    }
                    placeholder="Exhibit description"
                    className="mb-2"
                    rows={3}
                  />

                  <label className="text-sm font-medium">
                    Artifact Details
                  </label>
                  <Textarea
                    value={exhibit.artifacts}
                    onChange={(e) =>
                      updateExhibitData(exhibit.id, "artifacts", e.target.value)
                    }
                    placeholder="Materials, dimensions, etc."
                    className="mb-2"
                    rows={2}
                  />

                  <label className="text-sm font-medium">
                    Historical Context
                  </label>
                  <Textarea
                    value={exhibit.history}
                    onChange={(e) =>
                      updateExhibitData(exhibit.id, "history", e.target.value)
                    }
                    placeholder="Historical background, time period, etc."
                    className="mb-2"
                    rows={2}
                  />

                  <label className="text-sm font-medium">Artist/Creator</label>
                  <Input
                    value={exhibit.artist}
                    onChange={(e) =>
                      updateExhibitData(exhibit.id, "artist", e.target.value)
                    }
                    placeholder="Name of artist or creator"
                  />
                </div>
              ))}

              {configData.exhibitData.length === 0 && (
                <p className="text-center text-sm text-gray-500 py-2">
                  No manual exhibits added yet
                </p>
              )}
            </div>
          </div>
        )}

        {/* Extracted Data Section - Show when data is available */}
        {configData.extractedData.length > 0 && (
          <div className="border rounded-lg p-4 mt-5">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium flex items-center gap-2">
                <Database className="h-4 w-4 text-green-600" />
                <span>Extracted Exhibit Information</span>
              </h4>
              <Badge className="bg-green-100 text-green-800">
                {configData.extractedData.length} Exhibits
              </Badge>
            </div>

            <ScrollArea className="h-[300px] rounded-md border p-2 mt-2">
              <div className="space-y-4">
                {configData.extractedData.map((exhibit) => (
                  <div
                    key={exhibit.id}
                    className="border rounded-lg p-3 bg-gray-50"
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="text-sm font-medium">
                        {exhibit.name || "Untitled Exhibit"}
                      </h3>
                      <div className="flex">
                        {exhibit.type && (
                          <Badge
                            className={`mr-2 ${exhibit.type === "indoor" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"}`}
                          >
                            {exhibit.type}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => removeExtractedExhibit(exhibit.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {exhibit.description && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-gray-500">
                          Description:
                        </p>
                        <p className="text-xs">{exhibit.description}</p>
                      </div>
                    )}

                    {exhibit.artifacts && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-gray-500">
                          Artifacts:
                        </p>
                        <p className="text-xs">{exhibit.artifacts}</p>
                      </div>
                    )}

                    {exhibit.history && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-gray-500">
                          Historical Context:
                        </p>
                        <p className="text-xs">{exhibit.history}</p>
                      </div>
                    )}

                    {exhibit.artist && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-gray-500">
                          Artist/Creator:
                        </p>
                        <p className="text-xs">{exhibit.artist}</p>
                      </div>
                    )}

                    <div className="mt-2 flex justify-end">
                      {exhibit.url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          asChild
                        >
                          <a
                            href={exhibit.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View Source
                          </a>
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs ml-2"
                        onClick={() => {
                          // Create a manual entry from this extracted data
                          const newExhibit = {
                            id: `exhibit_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                            name: exhibit.name || "",
                            description: exhibit.description || "",
                            artifacts: exhibit.artifacts || "",
                            history: exhibit.history || "",
                            artist: exhibit.artist || "",
                            type: exhibit.type || "",
                          };

                          setConfigData((prev) => ({
                            ...prev,
                            exhibitData: [...prev.exhibitData, newExhibit],
                          }));

                          toast({
                            title: "Added to Manual Entries",
                            description: "You can now edit this exhibit data",
                            variant: "success",
                          });
                        }}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit as Manual Entry
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Test Q&A Section */}
        {(configData.extractedData.length > 0 ||
          configData.exhibitData.length > 0) && (
          <div className="border rounded-lg p-4 mt-5 bg-gradient-to-r from-indigo-50 to-purple-50">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-indigo-600" />
              <span>Test Visitor Q&A</span>
            </h4>

            <p className="text-sm text-gray-600 mb-4">
              Test how the system would answer visitor questions based on the
              exhibit information.
            </p>

            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Ask a question about the exhibits..."
                  value={testQuestion}
                  onChange={(e) => setTestQuestion(e.target.value)}
                />
                <Button
                  onClick={testQuestionAnswering}
                  disabled={
                    isGeneratingAnswer ||
                    !testQuestion.trim() ||
                    (configData.extractedData.length === 0 &&
                      configData.exhibitData.length === 0)
                  }
                >
                  {isGeneratingAnswer ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Test"
                  )}
                </Button>
              </div>

              {testAnswer && (
                <div className="bg-white rounded-lg border p-3 mt-2">
                  <p className="text-xs text-gray-500 font-medium">
                    AI Response:
                  </p>
                  <p className="text-sm mt-1">{testAnswer}</p>
                </div>
              )}

              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mt-3">
                <p className="text-xs text-blue-700 flex items-center gap-1.5">
                  <Info className="h-4 w-4" />
                  This is how visitors will get answers about your exhibits in
                  the live experience.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Accessibility features removed as requested */}
      </div>

      <div className="border-t pt-4 flex justify-end">
        <Button
          onClick={async () => {
            // Show a saving indicator
            toast({
              title: "Saving Configuration",
              description: "Saving exhibit information and knowledge base...",
            });

            try {
              // Add a timestamp to the saved data
              const finalData = {
                ...configData,
                lastSaved: new Date().toISOString(),
              };

              // Save to Firestore
              await setDoc(
                doc(db, "exhibitKnowledgeBases", blueprintId),
                {
                  configData: finalData,
                  exhibitData: configData.exhibitData,
                  extractedData: configData.extractedData,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                },
                { merge: true },
              );

              // Call the parent's onSave
              onSave(finalData);

              toast({
                title: "Configuration Saved",
                description: "Exhibit information saved successfully!",
                variant: "success",
              });
            } catch (error) {
              console.error("Error saving configuration:", error);
              toast({
                title: "Save Failed",
                description: "Could not save configuration. Please try again.",
                variant: "destructive",
              });
            }
          }}
        >
          Save Exhibit Information Configuration
        </Button>
      </div>
    </div>
  );
};

/**
 * Audio Tours Configuration Component
 * For museum audio guide experiences
 */
// AFTER: Enhanced configuration state with audio upload and script generation
/**
 * Audio Tours Configuration Component
 * For museum audio guide experiences
 */
export const AudioToursConfigScreen = ({
  onSave,
  initialData = {},
  blueprintId,
}) => {
  const { toast } = useToast();

  const [configData, setConfigData] = useState({
    name: initialData.name || "Audio Tours",
    tourType: initialData.tourType || "guided",
    languages: initialData.languages || ["English"],
    playbackOptions: initialData.playbackOptions || {
      autoPlay: false,
      pauseResume: false,
      skipBack: false,
      transcripts: true,
    },
    audioSource: initialData.audioSource || "new", // 'new', 'existing', 'generate'
    existingAudioUrls: initialData.existingAudioUrls || [],
    audioTracks: initialData.audioTracks || [],
    tourStops: initialData.tourStops || [],
    ...initialData,
  });

  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const [audioPlaying, setAudioPlaying] = useState(null);
  const [playingAudio, setPlayingAudio] = useState(null);
  const audioInputRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const storage = getStorage();

  const handleChange = (field, value) => {
    setConfigData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Stop audio when switching between tabs/sections
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, [configData.audioSource]);

  const handleAudioUpload = async (e) => {
    const files = e.target.files;
    if (!files || !files.length) return;

    setUploading(true);

    try {
      const uploadedAudio = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate file is audio
        if (!file.type.includes("audio")) {
          alert(
            `${file.name} is not an audio file. Please upload only audio files.`,
          );
          continue;
        }

        // Create storage reference
        const fileRef = ref(
          storage,
          `blueprints/${blueprintId}/audio-tours/${Date.now()}_${file.name}`,
        );

        // Upload file
        await uploadBytes(fileRef, file);
        const downloadURL = await getDownloadURL(fileRef);

        // Add to uploaded files array
        uploadedAudio.push({
          id: `audio_${Date.now()}_${i}`,
          name: file.name,
          url: downloadURL,
          duration: "Unknown", // We could calculate this if needed
          uploadDate: new Date().toISOString(),
          transcript: "", // Will be filled in later if needed
        });
      }

      // Update state with new audio files
      setConfigData((prev) => ({
        ...prev,
        audioTracks: [...prev.audioTracks, ...uploadedAudio],
      }));

      // Clear file input
      if (audioInputRef.current) {
        audioInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error uploading audio:", error);
      alert("Failed to upload audio files. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const addExistingAudioUrl = (url, name = "External Audio Source") => {
    if (!url.trim()) return;

    // Add URL to the existingAudioUrls array
    setConfigData((prev) => ({
      ...prev,
      existingAudioUrls: [
        ...prev.existingAudioUrls,
        {
          id: `url_${Date.now()}`,
          name: name,
          url: url.trim(),
          addedDate: new Date().toISOString(),
        },
      ],
    }));
  };

  const removeAudioTrack = (trackId) => {
    setConfigData((prev) => ({
      ...prev,
      audioTracks: prev.audioTracks.filter((track) => track.id !== trackId),
    }));

    // Stop playback if this was the playing track
    if (audioPlaying === trackId && audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setAudioPlaying(null);
    }
  };

  const removeExistingAudio = (urlId) => {
    setConfigData((prev) => ({
      ...prev,
      existingAudioUrls: prev.existingAudioUrls.filter(
        (url) => url.id !== urlId,
      ),
    }));
  };

  const playAudio = (url, id) => {
    // Stop current audio if playing
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    // Create a new audio element
    const audio = new Audio(url);
    audioPlayerRef.current = audio;

    // Play the audio
    audio
      .play()
      .then(() => {
        setAudioPlaying(id);
        setPlayingAudio(audio);

        // Reset when done playing
        audio.onended = () => {
          setAudioPlaying(null);
          setPlayingAudio(null);
        };
      })
      .catch((err) => {
        console.error("Error playing audio:", err);
        alert("Failed to play audio. Please try again.");
      });
  };

  const stopAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setAudioPlaying(null);
      setPlayingAudio(null);
    }
  };

  const addTourStop = () => {
    setConfigData((prev) => ({
      ...prev,
      tourStops: [
        ...prev.tourStops,
        {
          id: `stop_${Date.now()}`,
          title: "",
          sourceUrl: "",
          sourceType: "url", // can be "url" or "file"
          sourceFile: null,
          audioTrackId: "",
          script: "",
        },
      ],
    }));
  };

  const updateTourStop = (id, field, value) => {
    setConfigData((prev) => ({
      ...prev,
      tourStops: prev.tourStops.map((stop) =>
        stop.id === id ? { ...stop, [field]: value } : stop,
      ),
    }));
  };

  const removeTourStop = (id) => {
    setConfigData((prev) => ({
      ...prev,
      tourStops: prev.tourStops.filter((stop) => stop.id !== id),
    }));
  };

  const handleSourceFileChange = async (e, stopId) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // Create storage reference
      const fileRef = ref(
        storage,
        `blueprints/${blueprintId}/audio-tours/sources/${Date.now()}_${file.name}`,
      );

      // Upload file
      await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(fileRef);

      // Update the stop with the file info
      updateTourStop(stopId, "sourceUrl", downloadURL);
      updateTourStop(stopId, "sourceType", "file");
      updateTourStop(stopId, "sourceFileName", file.name);
    } catch (error) {
      console.error("Error uploading source file:", error);
      alert("Failed to upload source file. Please try again.");
    }
  };

  const generateAudioTourScripts = async () => {
    if (!configData.tourStops.length) {
      alert("Please add at least one tour stop before generating scripts.");
      return;
    }

    // Check if tour stops have source URLs
    const missingSourceStops = configData.tourStops.filter(
      (stop) => !stop.sourceUrl && !stop.title,
    );

    if (missingSourceStops.length > 0) {
      alert("All tour stops must have either a title or a source URL/file.");
      return;
    }

    setGenerating(true);
    setGenerationStatus("Initializing AI for script generation...");

    try {
      // Initialize Gemini AI
      const genAI = new GoogleGenerativeAI(
        "AIzaSyBgxzzgcT_9nyhz1D_JtfG7gevRUKQ5Vbs",
      );
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      const updatedStops = [...configData.tourStops];

      // Process each tour stop
      for (let i = 0; i < updatedStops.length; i++) {
        const stop = updatedStops[i];

        setGenerationStatus(
          `Generating script for "${stop.title || "Stop #" + (i + 1)}" (${i + 1}/${updatedStops.length})...`,
        );

        // Create the prompt based on the source type
        let prompt = `Create an engaging audio tour script for a museum exhibit:`;

        if (stop.title) {
          prompt += `\n\nTitle: ${stop.title}`;
        }

        if (stop.sourceUrl) {
          if (stop.sourceType === "url") {
            prompt += `\n\nBased on the content at this URL: ${stop.sourceUrl}`;
          } else {
            prompt += `\n\nBased on the uploaded file: ${stop.sourceFileName || "uploaded file"}`;
          }
        }

        prompt += `\n\nTour type: ${configData.tourType}`;

        prompt += `\n\nRequirements:
        - The script should be engaging and informative
        - Length should be appropriate for a 1-2 minute audio narration
        - Include interesting facts and context about the exhibit
        - Use a conversational, welcoming tone
        - End with a transition to the next stop or a prompt for exploration

        Format the response as a complete script ready to be narrated.`;

        // Generate script for this stop
        const result = await model.generateContent(prompt);

        // Update the stop with the generated script
        updatedStops[i] = {
          ...stop,
          script: result.response.text(),
        };
      }

      // Update state with generated scripts
      setConfigData((prev) => ({
        ...prev,
        tourStops: updatedStops,
      }));

      // Store in Firestore
      await setDoc(doc(db, "audioTourScripts", blueprintId), {
        generatedScripts: updatedStops,
        tourConfig: configData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setGenerationStatus("Successfully generated audio tour scripts!");

      // Add a small delay before final completion
      setTimeout(() => {
        setGenerating(false);
        setGenerationStatus("");
      }, 1500);
    } catch (error) {
      console.error("Error generating scripts:", error);
      setGenerationStatus(`Error: ${error.message}`);
      setTimeout(() => {
        setGenerating(false);
      }, 2000);
    }
  };

  const saveToFirebase = async (configData) => {
    if (!blueprintId) {
      console.error("No blueprint ID available");
      return;
    }

    try {
      // Reference to the blueprint document
      const blueprintRef = doc(db, "blueprints", blueprintId);

      // Update the blueprint with the feature configuration
      await updateDoc(blueprintRef, {
        [`featureConfigurations.audioTours`]: configData,
        updatedAt: serverTimestamp(),
      });

      console.log("Audio Tours configuration saved successfully");

      // Show success toast
      toast({
        title: "Configuration Saved",
        description: "Your audio tour settings have been saved successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error saving audio tours configuration:", error);
      toast({
        title: "Save Error",
        description:
          "Failed to save audio tour configuration. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">Configure Audio Tours</h1>
          <p className="text-gray-500 text-sm">
            Set up immersive audio experiences for museum visitors
          </p>
        </div>
        <div className="bg-blue-100 p-3 rounded-full">
          <Volume2 className="h-6 w-6 text-blue-600" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="tour-name">Tour Name</Label>
          <Input
            id="tour-name"
            placeholder="e.g. Main Exhibition Tour"
            value={configData.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
        </div>
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <h4 className="font-medium text-blue-800 mb-2 flex items-center">
            <Volume2 className="h-4 w-4 mr-1.5" />
            Tour Type
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                id: "guided",
                label: "Guided Tour",
                description: "Sequential narrative",
                icon: <Map />,
              },
              {
                id: "freestyle",
                label: "Self-Guided",
                description: "Visit any order",
                icon: <Compass />,
              },
            ].map((type) => (
              <div
                key={type.id}
                className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-blue-500 transition-all flex flex-col items-center text-center ${configData.tourType === type.id ? "border-blue-500 bg-blue-50/50" : ""}`}
                onClick={() => handleChange("tourType", type.id)}
              >
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                  {React.cloneElement(type.icon, {
                    className: "h-6 w-6 text-blue-600",
                  })}
                </div>
                <span className="text-sm font-medium">{type.label}</span>
                <span className="text-xs text-gray-500 mt-1">
                  {type.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Audio Source</h4>
          <RadioGroup
            value={configData.audioSource}
            onValueChange={(value) => handleChange("audioSource", value)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="new" id="new-audio" />
              <Label htmlFor="new-audio">Upload Existing Audio</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="existing" id="existing-audio" />
              <Label htmlFor="existing-audio">Link Existing Audio</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="generate" id="generate-audio" />
              <Label htmlFor="generate-audio">Generate Scripts</Label>
            </div>
          </RadioGroup>
        </div>
        {/* Upload New Audio Section */}
        {configData.audioSource === "new" && (
          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-3">Upload Audio Files</h4>

            <div className="border-2 border-dashed rounded-lg p-6 text-center mb-4">
              <Music className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm font-medium mb-1">
                Drag and drop audio files
              </p>
              <p className="text-xs text-gray-500 mb-3">
                MP3, WAV, M4A (max 50MB each)
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => audioInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>Browse Files</>
                )}
              </Button>
              <input
                type="file"
                ref={audioInputRef}
                className="hidden"
                multiple
                accept="audio/*"
                onChange={handleAudioUpload}
              />
            </div>

            {/* Display uploaded audio */}
            <div className="space-y-2">
              {configData.audioTracks.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                >
                  <div className="flex items-center">
                    <Volume2 className="h-4 w-4 text-blue-500 mr-2" />
                    <span className="text-sm">{track.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() =>
                        audioPlaying === track.id
                          ? stopAudio()
                          : playAudio(track.url, track.id)
                      }
                    >
                      {audioPlaying === track.id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => removeAudioTrack(track.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {configData.audioTracks.length === 0 && !uploading && (
                <p className="text-center text-sm text-gray-500 py-2">
                  No audio files uploaded yet
                </p>
              )}
            </div>
          </div>
        )}
        {/* Link Existing Audio Section */}
        {configData.audioSource === "existing" && (
          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-3">Link Existing Audio</h4>

            <div className="space-y-3 mb-4">
              <div className="flex flex-col gap-2">
                <Input
                  placeholder="Audio Name (e.g. Main Tour Narration)"
                  id="audio-name-input"
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com/audio/tour.mp3"
                    id="audio-url-input"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      const nameInput =
                        document.getElementById("audio-name-input");
                      const urlInput =
                        document.getElementById("audio-url-input");
                      if (urlInput && urlInput.value) {
                        addExistingAudioUrl(
                          urlInput.value,
                          nameInput?.value || "External Audio Source",
                        );
                        if (urlInput) urlInput.value = "";
                        if (nameInput) nameInput.value = "";
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Add links to your existing audio tour files hosted elsewhere
              </p>
            </div>

            {/* Display linked audio */}
            <div className="space-y-2">
              {configData.existingAudioUrls.map((audioUrl) => (
                <div
                  key={audioUrl.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                >
                  <div className="flex items-center">
                    <Music className="h-4 w-4 text-blue-500 mr-2" />
                    <div>
                      <span className="text-sm font-medium">
                        {audioUrl.name}
                      </span>
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">
                        {audioUrl.url}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() =>
                        audioPlaying === audioUrl.id
                          ? stopAudio()
                          : playAudio(audioUrl.url, audioUrl.id)
                      }
                    >
                      {audioPlaying === audioUrl.id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => removeExistingAudio(audioUrl.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {configData.existingAudioUrls.length === 0 && (
                <p className="text-center text-sm text-gray-500 py-2">
                  No audio sources linked yet
                </p>
              )}
            </div>
          </div>
        )}
        {/* Generate Scripts Section */}
        {configData.audioSource === "generate" && (
          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium">Tour Stops & Scripts</h4>
              <Button variant="outline" size="sm" onClick={addTourStop}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Stop
              </Button>
            </div>

            <div className="space-y-4">
              {configData.tourStops.map((stop, index) => (
                <div key={stop.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-800">
                        {index + 1}
                      </Badge>
                      <Input
                        placeholder="Stop Title"
                        value={stop.title}
                        onChange={(e) =>
                          updateTourStop(stop.id, "title", e.target.value)
                        }
                        className="font-medium"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTourStop(stop.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2 mt-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Source:</Label>
                      <div className="flex gap-2">
                        <Select
                          value={stop.sourceType || "url"}
                          onValueChange={(value) =>
                            updateTourStop(stop.id, "sourceType", value)
                          }
                        >
                          <SelectTrigger className="w-1/4">
                            <SelectValue placeholder="Source Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="url">URL</SelectItem>
                            <SelectItem value="file">File Upload</SelectItem>
                          </SelectContent>
                        </Select>

                        {stop.sourceType === "url" || !stop.sourceType ? (
                          <Input
                            placeholder="Enter URL to exhibit info (e.g. page, PDF)"
                            value={stop.sourceUrl || ""}
                            onChange={(e) =>
                              updateTourStop(
                                stop.id,
                                "sourceUrl",
                                e.target.value,
                              )
                            }
                            className="flex-1"
                          />
                        ) : (
                          <div className="flex flex-1 gap-2">
                            <div className="flex-1 text-sm border px-3 py-2 rounded-md bg-white truncate">
                              {stop.sourceFileName || "No file selected"}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const fileInput =
                                  document.createElement("input");
                                fileInput.type = "file";
                                fileInput.accept = ".pdf,.doc,.docx,.txt";
                                fileInput.onchange = (e) =>
                                  handleSourceFileChange(e, stop.id);
                                fileInput.click();
                              }}
                            >
                              Browse
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {configData.audioTracks.length > 0 && (
                      <div className="space-y-1">
                        <Label className="text-xs">Audio Track:</Label>
                        <Select
                          value={stop.audioTrackId}
                          onValueChange={(value) =>
                            updateTourStop(stop.id, "audioTrackId", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select audio track" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">None</SelectItem>
                            {configData.audioTracks.map((track) => (
                              <SelectItem key={track.id} value={track.id}>
                                {track.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {stop.script && (
                      <div className="space-y-1 mt-3">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs font-medium text-blue-600">
                            Generated Script:
                          </Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              // Copy script to clipboard
                              navigator.clipboard.writeText(stop.script);
                              toast({
                                title: "Script copied to clipboard",
                                duration: 2000,
                              });
                            }}
                          >
                            <Copy className="h-3 w-3 mr-1.5" />
                            Copy
                          </Button>
                        </div>
                        <div className="bg-white rounded p-2 text-sm max-h-[200px] overflow-y-auto">
                          {stop.script}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {configData.tourStops.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Map className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No tour stops added yet</p>
                  <p className="text-sm mt-1">
                    Click "Add Stop" to get started
                  </p>
                </div>
              )}
            </div>

            {configData.tourStops.length > 0 && (
              <div className="mt-4">
                <Button
                  variant="default"
                  className="w-full"
                  onClick={generateAudioTourScripts}
                  disabled={generating}
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      Generating Scripts...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1.5" />
                      Generate Scripts with AI
                    </>
                  )}
                </Button>

                {generationStatus && (
                  <div className="mt-3 text-sm text-center text-indigo-700">
                    {generationStatus}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Languages</h4>
          <div className="space-y-3 mb-4">
            {configData.languages.map((language, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-sm">{language}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newLanguages = [...configData.languages];
                    newLanguages.splice(index, 1);
                    handleChange("languages", newLanguages);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Select
              onValueChange={(value) => {
                if (!configData.languages.includes(value)) {
                  handleChange("languages", [...configData.languages, value]);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Add language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="English">English</SelectItem>
                <SelectItem value="Spanish">Spanish</SelectItem>
                <SelectItem value="French">French</SelectItem>
                <SelectItem value="German">German</SelectItem>
                <SelectItem value="Mandarin">Mandarin</SelectItem>
                <SelectItem value="Japanese">Japanese</SelectItem>
                <SelectItem value="Arabic">Arabic</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              Add
            </Button>
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Playback Features</h4>
          <div className="space-y-3">
            {[
              {
                id: "autoPlay",
                label: "Auto-Play at Exhibits",
                icon: <Play />,
              },
              {
                id: "transcripts",
                label: "Text Transcripts",
                icon: <FileText />,
              },
            ].map((feature) => (
              <div
                key={feature.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  {React.cloneElement(feature.icon, {
                    className: "h-4 w-4 text-gray-500 mr-2",
                  })}
                  <Label className="cursor-pointer">{feature.label}</Label>
                </div>
                <Switch
                  checked={configData.playbackOptions[feature.id]}
                  onCheckedChange={(checked) => {
                    handleChange("playbackOptions", {
                      ...configData.playbackOptions,
                      [feature.id]: checked,
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t pt-4 flex justify-end">
        <Button
          onClick={() => {
            saveToFirebase(configData);
            onSave(configData);
          }}
        >
          Save Audio Tour Configuration
        </Button>
      </div>
    </div>
  );
};

/**
 * Collection Browsing Configuration Component
 * For museum digital collection browsing
 */
export const CollectionBrowsingConfigScreen = ({
  onSave,
  initialData = {},
}) => {
  const [configData, setConfigData] = useState({
    name: initialData.name || "Collection Browser",
    browseMethod: initialData.browseMethod || "categories",
    filterOptions: initialData.filterOptions || {
      era: true,
      artist: true,
      medium: true,
      theme: true,
      location: true,
    },
    detailLevel: initialData.detailLevel || "standard",
    imageQuality: initialData.imageQuality || "high",
    features: initialData.features || {
      zoom: true,
      compare: true,
      share: true,
      favorite: true,
      download: false,
    },
    ...initialData,
  });

  const handleChange = (field, value) => {
    setConfigData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">
            Configure Collection Browser
          </h1>
          <p className="text-gray-500 text-sm">
            Set up how visitors can explore your digital collection
          </p>
        </div>
        <div className="bg-emerald-100 p-3 rounded-full">
          <BookmarkIcon className="h-6 w-6 text-emerald-600" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="collection-name">Feature Name</Label>
          <Input
            id="collection-name"
            placeholder="e.g. Digital Collection"
            value={configData.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
        </div>

        <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
          <h4 className="font-medium text-emerald-800 mb-2 flex items-center">
            <Book className="h-4 w-4 mr-1.5" />
            Browse Method
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                id: "categories",
                label: "By Category",
                description: "Browse by groups",
                icon: <LayoutGrid />,
              },
              {
                id: "timeline",
                label: "Timeline",
                description: "Chronological view",
                icon: <Clock />,
              },
              {
                id: "search",
                label: "Search-based",
                description: "Keyword search",
                icon: <Search />,
              },
            ].map((method) => (
              <div
                key={method.id}
                className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-emerald-500 transition-all flex flex-col items-center text-center ${configData.browseMethod === method.id ? "border-emerald-500 bg-emerald-50/50" : ""}`}
                onClick={() => handleChange("browseMethod", method.id)}
              >
                <div className="h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
                  {React.cloneElement(method.icon, {
                    className: "h-6 w-6 text-emerald-600",
                  })}
                </div>
                <span className="text-sm font-medium">{method.label}</span>
                <span className="text-xs text-gray-500 mt-1">
                  {method.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Filter Options</h4>
          <div className="space-y-2">
            {[
              { id: "era", label: "Historical Era/Period" },
              { id: "artist", label: "Artist/Creator" },
              { id: "medium", label: "Material/Medium" },
              { id: "theme", label: "Theme/Subject" },
              { id: "location", label: "Geographic Origin" },
            ].map((filter) => (
              <div key={filter.id} className="flex items-center space-x-2">
                <Checkbox
                  id={filter.id}
                  checked={configData.filterOptions[filter.id]}
                  onCheckedChange={(checked) => {
                    handleChange("filterOptions", {
                      ...configData.filterOptions,
                      [filter.id]: !!checked,
                    });
                  }}
                />
                <label htmlFor={filter.id} className="text-sm cursor-pointer">
                  {filter.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Detail Level</h4>
          <RadioGroup
            value={configData.detailLevel}
            onValueChange={(value) => handleChange("detailLevel", value)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="basic" id="basic" />
              <Label htmlFor="basic">Basic (Title, Artist, Date)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="standard" id="standard" />
              <Label htmlFor="standard">Standard (Basic + Description)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="detailed" id="detailed" />
              <Label htmlFor="detailed">Detailed (Full Curatorial Info)</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Image Quality</h4>
          <Select
            value={configData.imageQuality}
            onValueChange={(value) => handleChange("imageQuality", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select image quality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low (Fast Loading)</SelectItem>
              <SelectItem value="medium">Medium (Balanced)</SelectItem>
              <SelectItem value="high">High (Detailed View)</SelectItem>
              <SelectItem value="ultra">Ultra (For Zoom/Study)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Interactive Features</h4>
          <div className="space-y-3">
            {[
              { id: "zoom", label: "Zoom In/Out", icon: <ZoomIn /> },
              { id: "compare", label: "Compare Items", icon: <Layers /> },
              { id: "share", label: "Social Sharing", icon: <Share2 /> },
              { id: "favorite", label: "Save Favorites", icon: <Heart /> },
              { id: "download", label: "Download Images", icon: <Download /> },
            ].map((feature) => (
              <div
                key={feature.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  {React.cloneElement(feature.icon, {
                    className: "h-4 w-4 text-gray-500 mr-2",
                  })}
                  <Label className="cursor-pointer">{feature.label}</Label>
                </div>
                <Switch
                  checked={configData.features[feature.id]}
                  onCheckedChange={(checked) => {
                    handleChange("features", {
                      ...configData.features,
                      [feature.id]: checked,
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t pt-4 flex justify-end">
        <Button onClick={() => onSave(configData)}>
          Save Collection Browser Configuration
        </Button>
      </div>
    </div>
  );
};

/**
 * Membership Information Configuration Component
 * For museum membership programs
 */
export const MembershipInfoConfigScreen = ({ onSave, initialData = {} }) => {
  const [configData, setConfigData] = useState({
    name: initialData.name || "Membership Information",
    membershipSource: initialData.membershipSource || "external", // 'external' or 'manual'
    membershipUrl: initialData.membershipUrl || "",
    displayStyle: initialData.displayStyle || "button", // 'button', 'banner', or 'card'
    summaryText:
      initialData.summaryText ||
      "Join our membership program to enjoy exclusive benefits and support our organization.",
    highlightedBenefits: initialData.highlightedBenefits || [
      "Free admission",
      "Member events",
      "Exclusive content",
    ],
    ctaText: initialData.ctaText || "Become a Member",
    // Keep simplified version of tiers for quick preview
    membershipTiers: initialData.membershipTiers || [
      {
        name: "Individual",
        price: "50",
      },
      {
        name: "Family",
        price: "100",
      },
    ],
    showTierPreview: initialData.showTierPreview || true,
    accentColor: initialData.accentColor || "#f59e0b", // Amber color by default
    signupOptions: initialData.signupOptions || {
      redirectWebsite: true,
    },
    ...initialData,
  });

  // New state variables for scraping and analysis
  const [isScrapingUrl, setIsScrapingUrl] = useState(false);
  const [isParsingData, setIsParsingData] = useState(false);
  const [scrapedData, setScrapedData] = useState(null);
  const [scrapingError, setScrapingError] = useState(null);

  const handleChange = (field, value) => {
    setConfigData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleBenefitChange = (index, value) => {
    const newBenefits = [...configData.highlightedBenefits];
    newBenefits[index] = value;
    handleChange("highlightedBenefits", newBenefits);
  };

  const addBenefit = () => {
    handleChange("highlightedBenefits", [
      ...configData.highlightedBenefits,
      "New benefit",
    ]);
  };

  const removeBenefit = (index) => {
    const newBenefits = [...configData.highlightedBenefits];
    newBenefits.splice(index, 1);
    handleChange("highlightedBenefits", newBenefits);
  };

  const handleTierChange = (index, field, value) => {
    const newTiers = [...configData.membershipTiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    handleChange("membershipTiers", newTiers);
  };

  const addTier = () => {
    handleChange("membershipTiers", [
      ...configData.membershipTiers,
      { name: "New Tier", price: "0" },
    ]);
  };

  const removeTier = (index) => {
    const newTiers = [...configData.membershipTiers];
    newTiers.splice(index, 1);
    handleChange("membershipTiers", newTiers);
  };

  // New function to scrape URL using Firecrawl API
  const scrapeUrl = async () => {
    if (!configData.membershipUrl) {
      setScrapingError("Please enter a valid URL");
      return;
    }

    setIsScrapingUrl(true);
    setScrapingError(null);

    try {
      const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer fc-e39118dbc4194ccfae3ed8a75e16be80",
        },
        body: JSON.stringify({
          url: configData.membershipUrl,
          formats: ["markdown", "html"],
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to scrape URL");
      }

      setScrapedData(data.data);
      parseScrapedData(data.data);
    } catch (error) {
      console.error("Error scraping URL:", error);
      setScrapingError(
        error.message || "An error occurred while scraping the URL",
      );
    } finally {
      setIsScrapingUrl(false);
    }
  };

  // Function to parse scraped data using Gemini
  const parseScrapedData = async (data) => {
    if (!data || (!data.markdown && !data.html)) {
      setScrapingError("No data to parse");
      return;
    }

    setIsParsingData(true);

    try {
      // Use our own parsing logic since Gemini has API access issues
      const content = data.markdown || data.html;
      const parsedInfo = parseContentDirectly(content);

      // Update configData with the extracted information
      setConfigData((prev) => ({
        ...prev,
        highlightedBenefits:
          parsedInfo.benefits.length > 0
            ? parsedInfo.benefits
            : prev.highlightedBenefits,
        membershipTiers:
          parsedInfo.tiers.length > 0 ? parsedInfo.tiers : prev.membershipTiers,
        summaryText: parsedInfo.summary || prev.summaryText,
      }));

      console.log("Successfully parsed membership information:", parsedInfo);
    } catch (error) {
      console.error("Error parsing scraped data:", error);
      setScrapingError("An error occurred while analyzing the membership page");
    } finally {
      setIsParsingData(false);
    }
  };

  // Add this new helper function to parse the content directly
  const parseContentDirectly = (content) => {
    // Initialize with empty values
    const result = {
      benefits: [],
      tiers: [],
      summary: "",
    };

    // Extract the summary - look for first paragraph or description
    const summaryMatch = content.match(/(Membership gives you.*?\.)/s);
    if (summaryMatch) {
      result.summary = summaryMatch[0];
    }

    // Extract benefits - look for patterns indicating benefits
    const benefitMatches = content.match(
      /(?:Free admission|Early entry|discount|Members-only|Advance|Free enrollment|Reduced admission)[^.]*\./g,
    );
    if (benefitMatches) {
      result.benefits = benefitMatches
        .map((benefit) => {
          // Clean up the benefit text
          return benefit
            .replace(/^.*?icon\)\s*/, "") // Remove image references
            .replace(/[\n\r]+/g, " ") // Remove line breaks
            .trim();
        })
        .filter((benefit) => benefit.length > 10) // Filter out too short matches
        .slice(0, 10); // Limit to 10 benefits
    }

    // Extract tiers - look for patterns like "Explorer 2", "$167", etc.
    const tierMatches = content.match(
      /(?:Explorer\s*\d|Individual|Family|Basic|Premium|Gold)[^$]*\$\d+/g,
    );
    if (tierMatches) {
      tierMatches.forEach((tierText) => {
        const nameMatch = tierText.match(
          /(Explorer\s*\d+|Individual|Family|Basic|Premium|Gold)/,
        );
        const priceMatch = tierText.match(/\$(\d+)/);

        if (nameMatch && priceMatch) {
          result.tiers.push({
            name: nameMatch[0].trim(),
            price: priceMatch[1],
          });
        }
      });
    }

    return result;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">
            Configure Membership Information
          </h1>
          <p className="text-gray-500 text-sm">
            Set up how membership programs are presented to visitors
          </p>
        </div>
        <div className="bg-amber-100 p-3 rounded-full">
          <Award className="h-6 w-6 text-amber-600" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="membership-name">Feature Name</Label>
          <Input
            id="membership-name"
            placeholder="e.g. Become a Member"
            value={configData.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
        </div>

        <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
          <h4 className="font-medium text-amber-800 mb-2 flex items-center">
            <Award className="h-4 w-4 mr-1.5" />
            Membership Information Source
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div
              className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-amber-500 transition-all flex flex-col items-center text-center ${
                configData.membershipSource === "external"
                  ? "border-amber-500 bg-amber-50/50"
                  : ""
              }`}
              onClick={() => handleChange("membershipSource", "external")}
            >
              <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center mb-2">
                <LinkIcon className="h-6 w-6 text-amber-600" />
              </div>
              <span className="text-sm font-medium">External Link</span>
              <span className="text-xs text-gray-500 mt-1">
                Link to your existing membership page
              </span>
            </div>

            <div
              className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-amber-500 transition-all flex flex-col items-center text-center ${
                configData.membershipSource === "manual"
                  ? "border-amber-500 bg-amber-50/50"
                  : ""
              }`}
              onClick={() => handleChange("membershipSource", "manual")}
            >
              <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center mb-2">
                <Settings className="h-6 w-6 text-amber-600" />
              </div>
              <span className="text-sm font-medium">Manual Setup</span>
              <span className="text-xs text-gray-500 mt-1">
                Configure membership details in-app
              </span>
            </div>
          </div>
        </div>

        {configData.membershipSource === "external" && (
          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-3">Membership Website</h4>
            <div className="space-y-2">
              <Label htmlFor="membership-url">Membership URL</Label>
              <div className="flex gap-2">
                <Input
                  id="membership-url"
                  placeholder="https://your-organization.com/membership"
                  value={configData.membershipUrl}
                  onChange={(e) =>
                    handleChange("membershipUrl", e.target.value)
                  }
                  className="flex-1"
                />
                <Button
                  variant="secondary"
                  onClick={scrapeUrl}
                  disabled={
                    isScrapingUrl || isParsingData || !configData.membershipUrl
                  }
                >
                  {isScrapingUrl ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <span>Analyze</span>
                  )}
                </Button>
                {configData.membershipUrl && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" asChild>
                          <a
                            href={configData.membershipUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Open URL</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              {isParsingData && (
                <div className="flex items-center text-amber-600 text-xs mt-1">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  <span>Analyzing membership details...</span>
                </div>
              )}
              {scrapingError && (
                <p className="text-xs text-red-500 mt-1">{scrapingError}</p>
              )}
              {!isScrapingUrl &&
                !isParsingData &&
                scrapedData &&
                !scrapingError && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-2 mt-2">
                    <p className="text-xs text-green-700 flex items-center">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Successfully analyzed membership page! Benefits and tiers
                      have been updated.
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Using local content parsing. For more accurate results,
                      please check the extracted data.
                    </p>
                  </div>
                )}
              <p className="text-xs text-gray-500">
                Link to your website's membership or donation page. Click
                "Analyze" to automatically extract membership information.
              </p>
            </div>
          </div>
        )}

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Display Options</h4>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Display Style</Label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: "button", label: "Button", icon: <ButtonIcon /> },
                  { id: "banner", label: "Banner", icon: <LayoutPanelTop /> },
                  { id: "card", label: "Card", icon: <LayoutGrid /> },
                ].map((style) => (
                  <div
                    key={style.id}
                    className={`bg-white border rounded-lg p-3 cursor-pointer hover:border-amber-500 transition-all flex flex-col items-center text-center ${
                      configData.displayStyle === style.id
                        ? "border-amber-500 bg-amber-50/50"
                        : ""
                    }`}
                    onClick={() => handleChange("displayStyle", style.id)}
                  >
                    <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center mb-2">
                      {React.cloneElement(style.icon, {
                        className: "h-5 w-5 text-amber-600",
                      })}
                    </div>
                    <span className="text-sm font-medium">{style.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cta-text">Call to Action Text</Label>
              <Input
                id="cta-text"
                placeholder="e.g. Join Now, Become a Member"
                value={configData.ctaText}
                onChange={(e) => handleChange("ctaText", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary-text">Summary Text</Label>
              <Textarea
                id="summary-text"
                placeholder="Brief description of your membership program"
                value={configData.summaryText}
                onChange={(e) => handleChange("summaryText", e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Accent Color</Label>
              <div className="flex gap-3">
                {[
                  { id: "#f59e0b", label: "Amber", color: "bg-amber-500" },
                  { id: "#3b82f6", label: "Blue", color: "bg-blue-500" },
                  { id: "#10b981", label: "Emerald", color: "bg-emerald-500" },
                  { id: "#8b5cf6", label: "Purple", color: "bg-purple-500" },
                  { id: "#ef4444", label: "Red", color: "bg-red-500" },
                ].map((colorOption) => (
                  <div
                    key={colorOption.id}
                    className="flex flex-col items-center gap-1"
                    onClick={() => handleChange("accentColor", colorOption.id)}
                  >
                    <div
                      className={`h-8 w-8 rounded-full cursor-pointer ${colorOption.color} ${
                        configData.accentColor === colorOption.id
                          ? "ring-2 ring-offset-2"
                          : ""
                      }`}
                    />
                    <span className="text-xs">{colorOption.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Highlighted Benefits</h4>
          <div className="space-y-3 mb-4">
            {configData.highlightedBenefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <Input
                  value={benefit}
                  onChange={(e) => handleBenefitChange(index, e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeBenefit(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={addBenefit}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Benefit
            </Button>
          </div>
        </div>

        {/* Membership tier quick preview */}
        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-medium">Membership Tier Preview</h4>
            <Switch
              checked={configData.showTierPreview}
              onCheckedChange={(checked) =>
                handleChange("showTierPreview", checked)
              }
            />
          </div>

          {configData.showTierPreview && (
            <div className="space-y-3">
              {configData.membershipTiers.map((tier, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <Input
                      value={tier.name}
                      onChange={(e) =>
                        handleTierChange(index, "name", e.target.value)
                      }
                      placeholder="Tier Name"
                    />
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 text-gray-500 mr-1" />
                      <Input
                        value={tier.price}
                        onChange={(e) =>
                          handleTierChange(index, "price", e.target.value)
                        }
                        placeholder="Price"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTier(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={addTier}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Tier
              </Button>
            </div>
          )}

          {!configData.showTierPreview && (
            <p className="text-sm text-gray-500 text-center py-2">
              Tier preview disabled. Users will be directed to the membership
              page for details.
            </p>
          )}
        </div>

        {/* Preview section */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3 flex items-center">
            <Eye className="h-4 w-4 mr-1.5 text-gray-500" />
            Preview
          </h4>

          <div className="bg-white border rounded-lg p-4 max-w-md mx-auto">
            {configData.displayStyle === "button" && (
              <div className="flex flex-col items-center text-center space-y-3 py-2">
                <p className="text-sm text-gray-700">
                  {configData.summaryText}
                </p>
                {configData.highlightedBenefits.length > 0 && (
                  <ul className="text-sm text-left w-full space-y-1">
                    {configData.highlightedBenefits.map((benefit, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="h-4 w-4 text-amber-500 mr-1.5 mt-0.5" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  className="mt-2"
                  style={{ backgroundColor: configData.accentColor }}
                >
                  {configData.ctaText}
                </Button>
              </div>
            )}

            {configData.displayStyle === "card" && (
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="font-semibold text-lg">Membership</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {configData.summaryText}
                  </p>
                </div>

                {configData.showTierPreview &&
                  configData.membershipTiers.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      {configData.membershipTiers.map((tier, index) => (
                        <div
                          key={index}
                          className="border rounded-lg p-3 text-center"
                        >
                          <h4 className="font-medium">{tier.name}</h4>
                          <p
                            className="text-lg font-bold"
                            style={{ color: configData.accentColor }}
                          >
                            ${tier.price}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                {configData.highlightedBenefits.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {configData.highlightedBenefits.map((benefit, index) => (
                      <div key={index} className="flex items-start">
                        <Check className="h-4 w-4 text-amber-500 mr-1.5 mt-0.5" />
                        <span className="text-sm">{benefit}</span>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  className="w-full mt-3"
                  style={{ backgroundColor: configData.accentColor }}
                >
                  {configData.ctaText}
                </Button>
              </div>
            )}

            {configData.displayStyle === "banner" && (
              <div
                className="p-4 rounded-lg flex items-center justify-between"
                style={{ backgroundColor: `${configData.accentColor}15` }}
              >
                <div className="space-y-1">
                  <h3
                    className="font-medium"
                    style={{ color: configData.accentColor }}
                  >
                    Membership Benefits
                  </h3>
                  <p className="text-sm text-gray-700">
                    {configData.summaryText}
                  </p>
                </div>
                <Button
                  className="whitespace-nowrap"
                  style={{ backgroundColor: configData.accentColor }}
                >
                  {configData.ctaText}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t pt-4 flex justify-end">
        <Button onClick={() => onSave(configData)}>
          Save Membership Configuration
        </Button>
      </div>
    </div>
  );
};

// ButtonIcon component for display style
const ButtonIcon = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="8" width="18" height="8" rx="2" />
  </svg>
);

/**
 * Educational Resources Configuration Component
 * For museum educational materials
 */
export const EducationalResourcesConfigScreen = ({
  onSave,
  initialData = {},
}) => {
  const [configData, setConfigData] = useState({
    name: initialData.name || "Educational Resources",
    resourceTypes: initialData.resourceTypes || {
      lessonPlans: true,
      activities: true,
      videos: true,
      readings: false,
      quizzes: false,
    },
    audienceTargeting: initialData.audienceTargeting || {
      elementary: true,
      middleSchool: true,
      highSchool: true,
      college: false,
      adults: true,
      educators: true,
    },
    accessOptions: initialData.accessOptions || {
      downloadable: true,
      printable: true,
      deviceOptimized: false,
    },
    ...initialData,
  });

  const handleChange = (field, value) => {
    setConfigData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">
            Configure Educational Resources
          </h1>
          <p className="text-gray-500 text-sm">
            Set up learning materials for visitors and educators
          </p>
        </div>
        <div className="bg-green-100 p-3 rounded-full">
          <GraduationCap className="h-6 w-6 text-green-600" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="edu-name">Feature Name</Label>
          <Input
            id="edu-name"
            placeholder="e.g. Learning Center"
            value={configData.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Resource Types</h4>
          <div className="space-y-2">
            {[
              { id: "lessonPlans", label: "Lesson Plans", icon: <FileText /> },
              {
                id: "activities",
                label: "Interactive Activities",
                icon: <Zap />,
              },
              { id: "videos", label: "Educational Videos", icon: <Video /> },
              {
                id: "readings",
                label: "Supplemental Readings",
                icon: <Book />,
              },
              {
                id: "quizzes",
                label: "Interactive Quizzes",
                icon: <HelpCircle />,
              },
            ].map((type) => (
              <div key={type.id} className="flex items-center space-x-2">
                <Checkbox
                  id={type.id}
                  checked={configData.resourceTypes[type.id]}
                  onCheckedChange={(checked) => {
                    handleChange("resourceTypes", {
                      ...configData.resourceTypes,
                      [type.id]: !!checked,
                    });
                  }}
                />
                <div className="flex items-center">
                  {React.cloneElement(type.icon, {
                    className: "h-4 w-4 text-gray-500 mr-2",
                  })}
                  <label htmlFor={type.id} className="text-sm cursor-pointer">
                    {type.label}
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Target Audience</h4>
          <div className="space-y-2">
            {[
              { id: "elementary", label: "Elementary School" },
              { id: "middleSchool", label: "Middle School" },
              { id: "highSchool", label: "High School" },
              { id: "college", label: "College/University" },
              { id: "adults", label: "Adult Learners" },
              { id: "educators", label: "Educators" },
            ].map((audience) => (
              <div key={audience.id} className="flex items-center space-x-2">
                <Checkbox
                  id={audience.id}
                  checked={configData.audienceTargeting[audience.id]}
                  onCheckedChange={(checked) => {
                    handleChange("audienceTargeting", {
                      ...configData.audienceTargeting,
                      [audience.id]: !!checked,
                    });
                  }}
                />
                <label htmlFor={audience.id} className="text-sm cursor-pointer">
                  {audience.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Access Options</h4>
          <div className="space-y-3">
            {[
              {
                id: "downloadable",
                label: "Downloadable Resources",
                icon: <Download />,
              },
              {
                id: "printable",
                label: "Printable Materials",
                icon: <Printer />,
              },
              {
                id: "deviceOptimized",
                label: "Device-Optimized Content",
                icon: <Smartphone />,
              },
            ].map((option) => (
              <div
                key={option.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  {React.cloneElement(option.icon, {
                    className: "h-4 w-4 text-gray-500 mr-2",
                  })}
                  <Label className="cursor-pointer">{option.label}</Label>
                </div>
                <Switch
                  checked={configData.accessOptions[option.id]}
                  onCheckedChange={(checked) => {
                    handleChange("accessOptions", {
                      ...configData.accessOptions,
                      [option.id]: checked,
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Resource Organization</h4>
          <RadioGroup
            value={configData.organization || "byTopic"}
            onValueChange={(value) => handleChange("organization", value)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="byTopic" id="byTopic" />
              <Label htmlFor="byTopic">Organized by Topic/Theme</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="byExhibit" id="byExhibit" />
              <Label htmlFor="byExhibit">Organized by Exhibit</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="byAudience" id="byAudience" />
              <Label htmlFor="byAudience">Organized by Audience Age</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="byType" id="byType" />
              <Label htmlFor="byType">Organized by Resource Type</Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <div className="border-t pt-4 flex justify-end">
        <Button onClick={() => onSave(configData)}>
          Save Educational Resources Configuration
        </Button>
      </div>
    </div>
  );
};

/**
 * Inventory Checking Configuration Component
 */
export const InventoryCheckingConfigScreen = ({ onSave, initialData = {} }) => {
  const [configData, setConfigData] = useState({
    name: initialData.name || "Inventory Checking",
    checkMethod: initialData.checkMethod || "scan",
    displayOptions: initialData.displayOptions || {
      showExactCount: false,
      showLowStockWarning: true,
      showOutOfStock: true,
      showNearbyStores: true,
      showRestockDate: true,
    },
    lowStockThreshold: initialData.lowStockThreshold || 5,
    notificationOptions: initialData.notificationOptions || {
      notifyOnRestock: true,
      notifyOnLowStock: false,
    },
    integrations: initialData.integrations || [],
    ...initialData,
  });

  const handleChange = (field, value) => {
    setConfigData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">
            Configure Inventory Checking
          </h1>
          <p className="text-gray-500 text-sm">
            Set up how customers can view product availability
          </p>
        </div>
        <div className="bg-blue-100 p-3 rounded-full">
          <Layers className="h-6 w-6 text-blue-600" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="inventory-name">Feature Name</Label>
          <Input
            id="inventory-name"
            placeholder="e.g. Stock Checker, Availability"
            value={configData.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
        </div>

        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <h4 className="font-medium text-blue-800 mb-2 flex items-center">
            <Layers className="h-4 w-4 mr-1.5" />
            Check Method
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                id: "scan",
                label: "Scan Products",
                description: "Scan barcode or QR",
                icon: <QrCode />,
              },
              {
                id: "search",
                label: "Search Product",
                description: "Manual search",
                icon: <Search />,
              },
              {
                id: "browse",
                label: "Browse Categories",
                description: "Category navigation",
                icon: <Layers />,
              },
            ].map((method) => (
              <div
                key={method.id}
                className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-blue-500 transition-all flex flex-col items-center text-center ${configData.checkMethod === method.id ? "border-blue-500 bg-blue-50/50" : ""}`}
                onClick={() => handleChange("checkMethod", method.id)}
              >
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                  {React.cloneElement(method.icon, {
                    className: "h-6 w-6 text-blue-600",
                  })}
                </div>
                <span className="text-sm font-medium">{method.label}</span>
                <span className="text-xs text-gray-500 mt-1">
                  {method.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Display Options</h4>
          <div className="space-y-3">
            {[
              {
                id: "showExactCount",
                label: "Show Exact Count",
                icon: <Hash />,
              },
              {
                id: "showLowStockWarning",
                label: "Low Stock Warning",
                icon: <AlertCircle />,
              },
              {
                id: "showOutOfStock",
                label: "Out of Stock Status",
                icon: <X />,
              },
              {
                id: "showNearbyStores",
                label: "Nearby Store Availability",
                icon: <MapPin />,
              },
              {
                id: "showRestockDate",
                label: "Expected Restock Date",
                icon: <Calendar />,
              },
            ].map((option) => (
              <div
                key={option.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  {React.cloneElement(option.icon, {
                    className: "h-4 w-4 text-gray-500 mr-2",
                  })}
                  <Label className="cursor-pointer">{option.label}</Label>
                </div>
                <Switch
                  checked={configData.displayOptions[option.id]}
                  onCheckedChange={(checked) => {
                    handleChange("displayOptions", {
                      ...configData.displayOptions,
                      [option.id]: checked,
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Inventory Settings</h4>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Low Stock Threshold</Label>
                <span className="text-sm text-gray-600 font-medium">
                  {configData.lowStockThreshold} items
                </span>
              </div>
              <Slider
                value={[configData.lowStockThreshold]}
                min={1}
                max={20}
                step={1}
                onValueChange={(value) => {
                  handleChange("lowStockThreshold", value[0]);
                }}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>1 item</span>
                <span>20 items</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Notification Options</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Bell className="h-4 w-4 text-gray-500 mr-2" />
                <Label className="cursor-pointer">Notify on Restock</Label>
              </div>
              <Switch
                checked={configData.notificationOptions.notifyOnRestock}
                onCheckedChange={(checked) => {
                  handleChange("notificationOptions", {
                    ...configData.notificationOptions,
                    notifyOnRestock: checked,
                  });
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 text-gray-500 mr-2" />
                <Label className="cursor-pointer">Notify on Low Stock</Label>
              </div>
              <Switch
                checked={configData.notificationOptions.notifyOnLowStock}
                onCheckedChange={(checked) => {
                  handleChange("notificationOptions", {
                    ...configData.notificationOptions,
                    notifyOnLowStock: checked,
                  });
                }}
              />
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Inventory Integrations</h4>
          <div className="space-y-2">
            {[
              { id: "pos", label: "POS System", icon: <ShoppingCart /> },
              { id: "wms", label: "Warehouse Management", icon: <Database /> },
              {
                id: "ecommerce",
                label: "E-commerce Platform",
                icon: <Globe />,
              },
              { id: "erp", label: "ERP System", icon: <BarChart2 /> },
            ].map((integration) => (
              <div key={integration.id} className="flex items-center space-x-2">
                <Checkbox
                  id={integration.id}
                  checked={configData.integrations.includes(integration.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      handleChange("integrations", [
                        ...configData.integrations,
                        integration.id,
                      ]);
                    } else {
                      handleChange(
                        "integrations",
                        configData.integrations.filter(
                          (item) => item !== integration.id,
                        ),
                      );
                    }
                  }}
                />
                <div className="flex items-center">
                  {React.cloneElement(integration.icon, {
                    className: "h-4 w-4 text-gray-500 mr-2",
                  })}
                  <label
                    htmlFor={integration.id}
                    className="text-sm cursor-pointer"
                  >
                    {integration.label}
                  </label>
                </div>
              </div>
            ))}
          </div>

          {configData.integrations.length > 0 && (
            <div className="mt-4">
              <Button variant="outline" size="sm" className="w-full">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Configure Integration
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="border-t pt-4 flex justify-end">
        <Button onClick={() => onSave(configData)}>
          Save Inventory Configuration
        </Button>
      </div>
    </div>
  );
};

/**
 * Loyalty Program Configuration Component
 */
export const LoyaltyProgramConfigScreen = ({ onSave, initialData = {} }) => {
  const [configData, setConfigData] = useState({
    name: initialData.name || "Loyalty Program",
    programType: initialData.programType || "points",
    joinMethod: initialData.joinMethod || "signup",
    pointsConfig: initialData.pointsConfig || {
      pointsPerDollar: 1,
      minimumRedemption: 100,
      expirationMonths: 12,
    },
    rewardTiers: initialData.rewardTiers || [
      { name: "Bronze", points: 0, benefits: ["Basic rewards"] },
      {
        name: "Silver",
        points: 500,
        benefits: ["Basic rewards", "Free shipping"],
      },
      {
        name: "Gold",
        points: 1000,
        benefits: ["All previous", "Birthday gift", "Early access"],
      },
    ],
    displayOptions: initialData.displayOptions || {
      showPoints: true,
      showProgress: true,
      showHistory: true,
      featuredOnHome: true,
    },
    ...initialData,
  });

  const handleChange = (field, value) => {
    setConfigData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleTierChange = (index, field, value) => {
    const newTiers = [...configData.rewardTiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    handleChange("rewardTiers", newTiers);
  };

  const addTier = () => {
    const lastTier = configData.rewardTiers[configData.rewardTiers.length - 1];
    const newTier = {
      name: "New Tier",
      points: lastTier.points + 500,
      benefits: ["New benefit"],
    };
    handleChange("rewardTiers", [...configData.rewardTiers, newTier]);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">
            Configure Loyalty Program
          </h1>
          <p className="text-gray-500 text-sm">
            Set up how customers can earn and redeem rewards
          </p>
        </div>
        <div className="bg-purple-100 p-3 rounded-full">
          <Award className="h-6 w-6 text-purple-600" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="program-name">Program Name</Label>
          <Input
            id="program-name"
            placeholder="e.g. VIP Rewards, Star Members"
            value={configData.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
        </div>

        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
          <h4 className="font-medium text-purple-800 mb-2 flex items-center">
            <Award className="h-4 w-4 mr-1.5" />
            Program Type
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                id: "points",
                label: "Points-based",
                description: "Earn and redeem points",
                icon: <CircleDollarSign />,
              },
              {
                id: "visits",
                label: "Visit-based",
                description: "Rewards for visits",
                icon: <MapPin />,
              },
              {
                id: "tier",
                label: "Tier-based",
                description: "Status levels",
                icon: <Award />,
              },
            ].map((type) => (
              <div
                key={type.id}
                className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-purple-500 transition-all flex flex-col items-center text-center ${configData.programType === type.id ? "border-purple-500 bg-purple-50/50" : ""}`}
                onClick={() => handleChange("programType", type.id)}
              >
                <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center mb-2">
                  {React.cloneElement(type.icon, {
                    className: "h-6 w-6 text-purple-600",
                  })}
                </div>
                <span className="text-sm font-medium">{type.label}</span>
                <span className="text-xs text-gray-500 mt-1">
                  {type.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Enrollment Method</h4>
          <RadioGroup
            value={configData.joinMethod}
            onValueChange={(value) => handleChange("joinMethod", value)}
            className="space-y-3"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="signup" id="signup" />
              <div className="flex items-center">
                <UserPlus className="h-4 w-4 text-gray-500 mr-2" />
                <Label htmlFor="signup">Account Signup (Automatic)</Label>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="opt-in" id="opt-in" />
              <div className="flex items-center">
                <Check className="h-4 w-4 text-gray-500 mr-2" />
                <Label htmlFor="opt-in">Opt-in Enrollment</Label>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="purchase" id="purchase" />
              <div className="flex items-center">
                <ShoppingCart className="h-4 w-4 text-gray-500 mr-2" />
                <Label htmlFor="purchase">First Purchase</Label>
              </div>
            </div>
          </RadioGroup>
        </div>

        {configData.programType === "points" && (
          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-3">Points Configuration</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Points Per Dollar</p>
                  <p className="text-xs text-gray-500">
                    Earn rate for purchases
                  </p>
                </div>
                <Select
                  value={configData.pointsConfig.pointsPerDollar.toString()}
                  onValueChange={(value) =>
                    handleChange("pointsConfig", {
                      ...configData.pointsConfig,
                      pointsPerDollar: parseInt(value),
                    })
                  }
                >
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 point</SelectItem>
                    <SelectItem value="2">2 points</SelectItem>
                    <SelectItem value="5">5 points</SelectItem>
                    <SelectItem value="10">10 points</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Minimum Redemption</p>
                  <p className="text-xs text-gray-500">
                    Points needed for rewards
                  </p>
                </div>
                <Select
                  value={configData.pointsConfig.minimumRedemption.toString()}
                  onValueChange={(value) =>
                    handleChange("pointsConfig", {
                      ...configData.pointsConfig,
                      minimumRedemption: parseInt(value),
                    })
                  }
                >
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50 points</SelectItem>
                    <SelectItem value="100">100 points</SelectItem>
                    <SelectItem value="250">250 points</SelectItem>
                    <SelectItem value="500">500 points</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Points Expiration</p>
                  <p className="text-xs text-gray-500">When points expire</p>
                </div>
                <Select
                  value={configData.pointsConfig.expirationMonths.toString()}
                  onValueChange={(value) =>
                    handleChange("pointsConfig", {
                      ...configData.pointsConfig,
                      expirationMonths: parseInt(value),
                    })
                  }
                >
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">6 months</SelectItem>
                    <SelectItem value="12">12 months</SelectItem>
                    <SelectItem value="24">24 months</SelectItem>
                    <SelectItem value="0">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Reward Tiers</h4>

          <div className="space-y-4">
            {configData.rewardTiers.map((tier, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center">
                    <Award className="h-4 w-4 text-purple-500 mr-2" />
                    <Input
                      className="h-7 w-32 bg-white"
                      value={tier.name}
                      onChange={(e) =>
                        handleTierChange(index, "name", e.target.value)
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Min. Points:</span>
                    <Input
                      className="h-7 w-20 bg-white"
                      type="number"
                      value={tier.points}
                      onChange={(e) =>
                        handleTierChange(
                          index,
                          "points",
                          parseInt(e.target.value),
                        )
                      }
                    />
                  </div>
                </div>

                <div className="mt-2 space-y-1.5">
                  <span className="text-xs font-medium text-gray-600">
                    Benefits:
                  </span>
                  {tier.benefits.map((benefit, benefitIndex) => (
                    <div key={benefitIndex} className="flex items-center gap-2">
                      <Check className="h-3 w-3 text-green-500" />
                      <span className="text-sm">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={addTier}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add New Tier
            </Button>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Display Options</h4>
          <div className="space-y-3">
            {[
              {
                id: "showPoints",
                label: "Show Points Balance",
                icon: <CircleDollarSign />,
              },
              {
                id: "showProgress",
                label: "Show Tier Progress",
                icon: <BarChart2 />,
              },
              {
                id: "showHistory",
                label: "Show Transaction History",
                icon: <Clock />,
              },
              {
                id: "featuredOnHome",
                label: "Featured on Homepage",
                icon: <LayoutPanelTop />,
              },
            ].map((option) => (
              <div
                key={option.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  {React.cloneElement(option.icon, {
                    className: "h-4 w-4 text-gray-500 mr-2",
                  })}
                  <Label className="cursor-pointer">{option.label}</Label>
                </div>
                <Switch
                  checked={configData.displayOptions[option.id]}
                  onCheckedChange={(checked) => {
                    handleChange("displayOptions", {
                      ...configData.displayOptions,
                      [option.id]: checked,
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t pt-4 flex justify-end">
        <Button onClick={() => onSave(configData)}>
          Save Loyalty Program Configuration
        </Button>
      </div>
    </div>
  );
};

/**
 * Customer Feedback Configuration Component
 */
/**
 * Customer Feedback Configuration Component
 */
export const CustomerFeedbackConfigScreen = ({
  onSave,
  initialData = {},
  blueprintId,
}) => {
  const { toast } = useToast();

  const [configData, setConfigData] = useState({
    name: initialData.name || "Customer Feedback",
    isEnabled:
      initialData.isEnabled !== undefined ? initialData.isEnabled : true,
    feedbackMethod: initialData.feedbackMethod || "popup",
    surveyUrl: initialData.surveyUrl || "",
    feedbackTypes: initialData.feedbackTypes || {
      rating: true,
      comments: true,
      suggestions: true,
      complaints: false,
    },
    promptText: initialData.promptText || "How was your experience?",
    placeholderText:
      initialData.placeholderText || "Share your thoughts with us...",
    thankYouMessage:
      initialData.thankYouMessage || "Thank you for your feedback!",
    ...initialData,
  });

  const handleChange = (field, value) => {
    setConfigData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const saveToFirebase = async (configData) => {
    if (!blueprintId) {
      console.error("No blueprint ID available");
      return;
    }

    try {
      // Reference to the blueprint document
      const blueprintRef = doc(db, "blueprints", blueprintId);

      // Update the blueprint with the feature configuration
      await updateDoc(blueprintRef, {
        [`featureConfigurations.feedback`]: configData,
        updatedAt: serverTimestamp(),
      });

      console.log("Feedback configuration saved successfully");

      // Show success toast
      toast({
        title: "Configuration Saved",
        description: "Your feedback settings have been saved successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error saving feedback configuration:", error);
      toast({
        title: "Save Error",
        description: "Failed to save feedback configuration. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">
            Configure Customer Feedback
          </h1>
          <p className="text-gray-500 text-sm">
            Set up how customer opinions are collected at the end of their visit
          </p>
        </div>
        <div className="bg-cyan-100 p-3 rounded-full">
          <MessageCircle className="h-6 w-6 text-cyan-600" />
        </div>
      </div>

      <div className="space-y-5">
        {/* Feature Status Toggle */}
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Enable Feedback Collection</h4>
              <p className="text-sm text-gray-500">
                Turn on to collect feedback at the end of user visits
              </p>
            </div>
            <Switch
              checked={configData.isEnabled}
              onCheckedChange={(checked) => handleChange("isEnabled", checked)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="feedback-name">Feature Name</Label>
          <Input
            id="feedback-name"
            placeholder="e.g. Your Opinion Matters"
            value={configData.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
        </div>

        <div className="bg-cyan-50 p-4 rounded-lg border border-cyan-100">
          <h4 className="font-medium text-cyan-800 mb-2 flex items-center">
            <MessageCircle className="h-4 w-4 mr-1.5" />
            Feedback Collection Method
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                id: "popup",
                label: "App Popup",
                description:
                  "Show feedback prompt in the app at the end of visit",
                icon: <MessageCircle />,
              },
              {
                id: "survey",
                label: "Email Survey",
                description: "Send a survey link via email after visit",
                icon: <Mail />,
              },
            ].map((method) => (
              <div
                key={method.id}
                className={`bg-white rounded-lg border p-3 cursor-pointer hover:border-cyan-500 transition-all flex flex-col items-center text-center ${configData.feedbackMethod === method.id ? "border-cyan-500 bg-cyan-50/50" : ""}`}
                onClick={() => handleChange("feedbackMethod", method.id)}
              >
                <div className="h-12 w-12 bg-cyan-100 rounded-full flex items-center justify-center mb-2">
                  {React.cloneElement(method.icon, {
                    className: "h-6 w-6 text-cyan-600",
                  })}
                </div>
                <span className="text-sm font-medium">{method.label}</span>
                <span className="text-xs text-gray-500 mt-1">
                  {method.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Survey URL input (only shown when survey method is selected) */}
        {configData.feedbackMethod === "survey" && (
          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-3">Survey Link</h4>
            <div className="space-y-2">
              <Label htmlFor="survey-url">External Survey URL</Label>
              <div className="flex gap-2">
                <Input
                  id="survey-url"
                  placeholder="https://forms.google.com/... or https://surveymonkey.com/..."
                  value={configData.surveyUrl}
                  onChange={(e) => handleChange("surveyUrl", e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" size="icon">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Link to your SurveyMonkey, Google Forms, or other survey service
              </p>
            </div>
          </div>
        )}

        {/* Feedback Types - Only shown for popup method */}
        {configData.feedbackMethod === "popup" && (
          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-3">Feedback Types</h4>
            <div className="space-y-3">
              {[
                { id: "rating", label: "Rating System", icon: <Star /> },
                {
                  id: "comments",
                  label: "Comment Box",
                  icon: <MessageSquare />,
                },
                {
                  id: "suggestions",
                  label: "Suggestions",
                  icon: <Lightbulb />,
                },
                {
                  id: "complaints",
                  label: "Complaints",
                  icon: <AlertCircle />,
                },
              ].map((type) => (
                <div
                  key={type.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center">
                    {React.cloneElement(type.icon, {
                      className: "h-4 w-4 text-gray-500 mr-2",
                    })}
                    <Label className="cursor-pointer">{type.label}</Label>
                  </div>
                  <Switch
                    checked={configData.feedbackTypes[type.id]}
                    onCheckedChange={(checked) => {
                      handleChange("feedbackTypes", {
                        ...configData.feedbackTypes,
                        [type.id]: checked,
                      });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feedback Prompt Customization (only shown for popup method) */}
        {configData.feedbackMethod === "popup" && (
          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-3">Feedback Prompt Customization</h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prompt-text">Prompt Question</Label>
                <Input
                  id="prompt-text"
                  placeholder="How was your experience?"
                  value={configData.promptText}
                  onChange={(e) => handleChange("promptText", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="placeholder-text">Input Placeholder</Label>
                <Input
                  id="placeholder-text"
                  placeholder="Share your thoughts with us..."
                  value={configData.placeholderText}
                  onChange={(e) =>
                    handleChange("placeholderText", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="thank-you-text">Thank You Message</Label>
                <Input
                  id="thank-you-text"
                  placeholder="Thank you for your feedback!"
                  value={configData.thankYouMessage}
                  onChange={(e) =>
                    handleChange("thankYouMessage", e.target.value)
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* Feedback Prompt Preview (only shown for popup method) */}
        {configData.feedbackMethod === "popup" && (
          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-3 flex items-center">
              <Eye className="h-4 w-4 mr-1.5 text-gray-500" />
              Feedback Prompt Preview
            </h4>

            <div className="mt-3 bg-white border rounded-xl shadow-sm p-4 max-w-md mx-auto">
              <div className="text-center space-y-4">
                <h3 className="font-medium text-lg">{configData.promptText}</h3>

                <div className="space-y-2">
                  {/* Rating System - only show if enabled */}
                  {configData.feedbackTypes.rating && (
                    <div className="flex justify-center">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          className="mx-1 h-10 w-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                        >
                          {rating}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Comments Box - only show if enabled */}
                  {(configData.feedbackTypes.comments ||
                    configData.feedbackTypes.suggestions ||
                    configData.feedbackTypes.complaints) && (
                    <Textarea
                      placeholder={configData.placeholderText}
                      className="resize-none"
                      rows={3}
                    />
                  )}

                  <Button className="w-full">Submit Feedback</Button>

                  <p className="text-sm text-gray-500 pt-2">
                    Your feedback helps us improve!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t pt-4 flex justify-end">
        <Button
          onClick={() => {
            // First save to Firebase
            saveToFirebase(configData);
            // Then call the original onSave prop
            onSave(configData);
          }}
        >
          Save Feedback Configuration
        </Button>
      </div>
    </div>
  );
};

/**
 * Main Feature Configuration Hub
 * This component dynamically selects the right configuration screen based on feature type
 */
/**
 * Main Feature Configuration Hub
 * This component dynamically selects the right configuration screen based on feature type
 */
const FeatureConfigHub = ({
  featureType,
  onSave,
  initialData = {},
  blueprintId = "",
}) => {
  // Map feature types to their configuration screens
  const configScreens = {
    menu: <MenuConfigScreen onSave={onSave} initialData={initialData} />,
    navigation: (
      <NavigationConfigScreen onSave={onSave} initialData={initialData} />
    ),
    information: (
      <ProductInfoConfigScreen onSave={onSave} initialData={initialData} />
    ),
    engagement: (
      <InteractiveExperiencesConfigScreen
        onSave={onSave}
        initialData={initialData}
      />
    ),
    promotion: (
      <SpecialOffersConfigScreen onSave={onSave} initialData={initialData} />
    ),
    reservation: (
      <TableReservationsConfigScreen
        onSave={onSave}
        initialData={initialData}
      />
    ),
    waitlist: (
      <WaitListConfigScreen onSave={onSave} initialData={initialData} />
    ),
    ordering: (
      <OnlineOrderingConfigScreen onSave={onSave} initialData={initialData} />
    ),
    events: <EventsConfigScreen onSave={onSave} initialData={initialData} />,
    feedback: (
      <CustomerFeedbackConfigScreen
        onSave={onSave}
        initialData={initialData}
        blueprintId={blueprintId}
      />
    ),
    // Add the new configuration screens
    newArrivals: (
      <NewArrivalsConfigScreen onSave={onSave} initialData={initialData} />
    ),
    inventory: (
      <InventoryCheckingConfigScreen
        onSave={onSave}
        initialData={initialData}
      />
    ),
    loyalty: (
      <LoyaltyProgramConfigScreen onSave={onSave} initialData={initialData} />
    ),

    exhibits: (
      <ExhibitInfoConfigScreen
        onSave={onSave}
        initialData={initialData}
        blueprintId={blueprintId}
      />
    ),
    audioTours: (
      <AudioToursConfigScreen
        onSave={onSave}
        initialData={initialData}
        blueprintId={blueprintId}
      />
    ),
    reviews: (
      <CustomerReviewsConfigScreen
        onSave={onSave}
        initialData={initialData}
        blueprintId={blueprintId}
      />
    ),
    collection: (
      <CollectionBrowsingConfigScreen
        onSave={onSave}
        initialData={initialData}
      />
    ),
    membership: (
      <MembershipInfoConfigScreen onSave={onSave} initialData={initialData} />
    ),
    education: (
      <EducationalResourcesConfigScreen
        onSave={onSave}
        initialData={initialData}
      />
    ),
    // New hotel-specific features
    onlineCheckIn: (
      <OnlineCheckInConfigScreen onSave={onSave} initialData={initialData} />
    ),
    amenitiesGuide: (
      <AmenitiesGuideConfigScreen onSave={onSave} initialData={initialData} />
    ),
    roomService: (
      <RoomServiceConfigScreen onSave={onSave} initialData={initialData} />
    ),
  };

  // Fallback configuration screen if type not found
  const GenericConfigScreen = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">Configure Feature</h1>
          <p className="text-gray-500 text-sm">
            Set up this feature for your space
          </p>
        </div>
        <div className="bg-gray-100 p-3 rounded-full">
          <Settings className="h-6 w-6 text-gray-600" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="feature-name">Feature Name</Label>
          <Input id="feature-name" placeholder="Give this feature a name" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Priority Level</Label>
          <Select defaultValue="medium">
            <SelectTrigger id="priority">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High Priority</SelectItem>
              <SelectItem value="medium">Medium Priority</SelectItem>
              <SelectItem value="low">Low Priority</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Additional Notes</Label>
          <Textarea
            id="notes"
            placeholder="Any specific requirements for this feature?"
          />
        </div>
      </div>

      <div className="border-t pt-4 flex justify-end">
        <Button onClick={() => onSave({ name: "Generic Feature" })}>
          Save Configuration
        </Button>
      </div>
    </div>
  );

  // Return the appropriate config screen or fallback
  return configScreens[featureType] || <GenericConfigScreen />;
};

export default FeatureConfigHub;
