import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        // Blueprint radius scale (intentionally overrides the var-based sm/md/lg):
        // square chrome -> small product radius. shadcn's --radius is still set in
        // index.css for any primitive that reads it directly.
        none: "0", // nav, chips, ops chrome
        xs: "2px", // inputs, micro-chips
        sm: "4px", // buttons, status chips
        md: "8px", // cards, panels
        lg: "12px", // feature cards
        xl: "16px", // large marketing surfaces
      },
      colors: {
        // ---- shadcn HSL role colors (KEEP EXACTLY — read from index.css vars) ----
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },

        // ---- Blueprint palette (literal hex; consume directly as utilities) ----
        // NOTE: intentionally NO flat `card` key here — that would clobber the
        // shadcn `card` object above. White surfaces use `bg-white` / `bg-paper-0`.
        ink: {
          DEFAULT: "#101318",
          900: "#101318",
          800: "#171b22",
          700: "#252a33",
          600: "#3e454f",
          500: "#626a75",
          400: "#858d96",
          300: "#aab0b7",
          200: "#d2d6da",
          100: "#e7e9eb",
          50: "#f1f2f3",
        },
        graphite: "#171b22",
        paper: {
          DEFAULT: "#f5f1e8",
          0: "#ffffff",
          1: "#f7f8f9",
          2: "#f1f2f3",
          3: "#e7e9eb",
          4: "#d6d9dd",
        },
        bone: "#e7e9eb",
        brass: { DEFAULT: "#2457ff", deep: "#1244ef", lit: "#8fe8ff" },

        // Kinetic public-site palette. Names are explicit so product surfaces can
        // keep their existing semantic status colors while marketing uses this
        // cooler optical system.
        kinetic: {
          white: "#f8f9fa",
          graphite: "#101318",
          dark: "#07111d",
          muted: "#535c68",
          faint: "#858d96",
          line: "#d9dde2",
          blue: "#1554ff",
          "blue-deep": "#003bd8",
          cyan: "#8fe8ff",
        },

        // semantic surfaces
        canvas: "#f7f8f9",
        inset: "#f1f2f3",
        sunken: "#e7e9eb",
        line: { DEFAULT: "#d9dde2", soft: "#e7e9eb", strong: "#bcc2c9" },

        // action / focus
        action: { DEFAULT: "#1554ff", hover: "#003bd8" },

        // signal families — fg / bg / bd (+ 700/600/500 ramps)
        proof: {
          fg: "#1f6b4f",
          bg: "#eef5f1",
          bd: "#dcebe3",
          700: "#1f6b4f",
          600: "#2a7d5e",
          500: "#3a9170",
        },
        warn: {
          fg: "#9a6a16",
          bg: "#faf3e2",
          bd: "#f3e7cb",
          700: "#9a6a16",
          600: "#b8821f",
          500: "#d09a2c",
        },
        block: {
          fg: "#9b3027",
          bg: "#faeae7",
          bd: "#f1d9d5",
          700: "#9b3027",
          600: "#b63d32",
          500: "#cf5247",
        },
        info: {
          fg: "#1f4f8f",
          bg: "#eaf1f9",
          bd: "#d7e4f2",
          700: "#1f4f8f",
          600: "#2563a6",
          500: "#3a79c2",
        },
      },

      fontFamily: {
        sans: ['"Inter Tight"', '"Inter"', "system-ui", "sans-serif"],
        display: ['"Inter Tight"', '"Inter"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", '"SF Mono"', "Menlo", "monospace"],
      },

      fontSize: {
        "display-xl": ["4.5rem", { lineHeight: "0.95", letterSpacing: "-0.035em" }],
        "display-l": ["3.5rem", { lineHeight: "0.95", letterSpacing: "-0.035em" }],
        "display-m": ["2.75rem", { lineHeight: "1.0", letterSpacing: "-0.03em" }],
        "title-xl": ["2rem", { lineHeight: "1.12", letterSpacing: "-0.03em" }],
        "title-l": ["1.5rem", { lineHeight: "1.12", letterSpacing: "-0.02em" }],
        "title-m": ["1.25rem", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        "body-l": ["1.125rem", { lineHeight: "1.6" }],
        body: ["1rem", { lineHeight: "1.5" }],
        "body-s": ["0.875rem", { lineHeight: "1.5" }],
        caption: ["0.8125rem", { lineHeight: "1.45" }],
        micro: ["0.6875rem", { lineHeight: "1.1", letterSpacing: "0.2em" }],
      },

      letterSpacing: {
        display: "-0.035em",
        tight: "-0.02em",
        eyebrow: "0.2em",
        "eyebrow-wide": "0.3em",
      },

      boxShadow: {
        xs: "0 1px 2px rgba(13,13,11,0.05)",
        sm: "0 1px 3px rgba(13,13,11,0.07), 0 1px 1px rgba(13,13,11,0.04)",
        md: "0 8px 24px -16px rgba(13,13,11,0.30)",
        lg: "0 24px 80px -52px rgba(13,13,11,0.55)",
        ink: "0 22px 60px -44px rgba(13,13,11,0.85)",
      },

      maxWidth: { container: "88rem", prose: "44rem" },

      transitionTimingFunction: {
        standard: "cubic-bezier(0.2,0,0,1)",
        "ease-out-bp": "cubic-bezier(0.16,1,0.3,1)",
      },

      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 600ms cubic-bezier(0.16,1,0.3,1) forwards",
      },
    },
  },
  plugins: [],
} satisfies Config;
