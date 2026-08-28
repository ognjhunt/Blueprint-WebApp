import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        // Square chrome, everywhere. The instrument surface has no rounded
        // corners: panels, chips, buttons and inputs are all cut square, and
        // the hairline is what separates them. The scale is kept (rather than
        // deleted) so existing `rounded-md` / `rounded-lg` call sites stay
        // valid and simply resolve to square. `rounded-full` still comes from
        // Tailwind's base scale, for status dots and avatars.
        none: "0",
        xs: "0",
        sm: "0",
        md: "0",
        lg: "0",
        xl: "0",
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
        // `ink` is the TEXT ramp and `paper` is the SURFACE ramp. On the
        // instrument surface both invert: 900 is the strongest text (bone,
        // not black) and paper-0 is the card (panel, not white). The rung
        // ordering is preserved — 900 is still "strongest", 400 still
        // "faint" — so every existing `text-ink-500` keeps its intent and
        // simply resolves to the dark-ground equivalent.
        ink: {
          DEFAULT: "#e8e6dd",
          900: "#e8e6dd", // strongest text
          800: "#dcdad0",
          700: "#c9cdc4", // body copy
          600: "#b3b8ae",
          500: "#9ba19a", // muted
          400: "#818880",
          300: "#828981", // faint / meta
          200: "#4a524d",
          100: "#3a423e",
          50: "#2a302d",
        },
        graphite: "#141816",
        paper: {
          DEFAULT: "#101312",
          0: "#141816", // card / panel
          1: "#101312", // page canvas
          2: "#1a1f1c", // inset
          3: "#232926", // sunken
          4: "#2a302d",
        },
        bone: "#e8e6dd",
        brass: { DEFAULT: "#ffb000", deep: "#e09a00", lit: "#ffc63d" },


        // ---- Runway: the deployment-operations palette for the whole product.
        //
        // First principles. Blueprint's job is to get more robots deployed,
        // sooner. Every surface — marketing, product, admin — should read like
        // the room a deployment is run from, not like a research paper or a
        // SaaS landing page. So: a warm near-black instrument base where
        // measured quantities carry the page, and one high-visibility signal
        // taken from the actual language of robot workcells (hazard tape,
        // safety marking, e-stop surrounds).
        //
        // The ground is deliberately green-black rather than blue-black. It
        // sits under a warm amber signal without the colour clash a cool base
        // produces, and it keeps bone-white body text from reading clinical.
        //
        // `signal` never carries small white text — its contrast partner is
        // `signal-ink` (11.4:1). It is the only saturated colour permitted for
        // a primary action, so a filled amber control always means "the one
        // thing to do here".
        //
        // Status colours are outlined chips, never fills, so they never
        // compete with a filled signal control in the same view. Each pairs a
        // legible foreground with a `-dim` border tuned for the dark ground.
        runway: {
          black: "#0c0f0e", // deepest ground: section bands, table heads
          deep: "#101312", // page base
          panel: "#141816", // cards, panels
          raised: "#1a1f1c", // hover, raised rows
          line: "#2a302d", // default hairline
          "line-soft": "#232926", // row dividers inside a panel
          "line-strong": "#3a423e", // emphasised edge, input borders
          text: "#e8e6dd", // primary bone
          body: "#c9cdc4", // secondary body copy
          mute: "#9ba19a", // supporting copy
          faint: "#828981", // meta, labels, disabled
          signal: "#ffb000", // brand + primary action
          "signal-deep": "#e09a00", // pressed, and amber on light ground
          "signal-lit": "#ffc63d", // hover on dark
          "signal-dim": "#5c4a12", // chip borders on dark
          "signal-soft": "#5c4a12", // legacy alias of signal-dim
          "signal-ink": "#171200", // text on a signal fill
          cyan: "#6fc3d4", // "after Blueprint" data series
          sky: "#9fb9cf", // site-reported provenance, neutral state
          "sky-dim": "#33434e",
          green: "#46b96c", // pass, measured, live
          "green-dim": "#22513a",
          amber: "#ffb000", // open, attention (same hue as signal)
          red: "#ff5c45", // fail, did-not-qualify
          "red-dim": "#59261e",
          paper: "#f5f4ef", // light ground, print + inverted blocks
          "paper-2": "#e9e7df",
          "paper-line": "#d5d2c8",
        },

        // semantic surfaces
        canvas: "#101312",
        inset: "#1a1f1c",
        sunken: "#232926",
        line: { DEFAULT: "#2a302d", soft: "#232926", strong: "#3a423e" },

        // action / focus
        action: { DEFAULT: "#ffb000", hover: "#ffc63d" },

        // Signal families — fg / bg / bd. Re-cut for the dark ground: the
        // foreground is the legible tint, `bg` a barely-there wash, `bd` the
        // chip border. Same three-part contract as before, so every existing
        // `bg-proof-bg text-proof-fg border-proof-bd` chip keeps working.
        proof: {
          fg: "#46b96c",
          bg: "#12211a",
          bd: "#22513a",
          700: "#58c97b",
          600: "#46b96c",
          500: "#39a35d",
        },
        warn: {
          fg: "#ffb000",
          bg: "#241c07",
          bd: "#5c4a12",
          700: "#ffc63d",
          600: "#ffb000",
          500: "#e09a00",
        },
        block: {
          fg: "#ff5c45",
          bg: "#2a120e",
          bd: "#59261e",
          700: "#ff7a66",
          600: "#ff5c45",
          500: "#e04530",
        },
        info: {
          fg: "#9fb9cf",
          bg: "#151d24",
          bd: "#33434e",
          700: "#b8ccdd",
          600: "#9fb9cf",
          500: "#7f9db6",
        },
      },

      fontFamily: {
        // Barlow is the workhorse: a grotesque drawn for signage and transit
        // wayfinding, which is the register this product wants. Barlow
        // Condensed carries display type — set uppercase with near-zero
        // tracking, it holds a 96px headline in the width a proportional face
        // would need 40% more of. IBM Plex Mono carries every figure.
        sans: ["Barlow", '"Helvetica Neue"', "system-ui", "sans-serif"],
        display: ['"Barlow Condensed"', '"Arial Narrow"', "Barlow", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", '"SF Mono"', "Menlo", "monospace"],
      },

      fontSize: {
        // Display sizes assume Barlow Condensed set uppercase. A condensed
        // face at these sizes needs no negative tracking — it is already
        // narrow, and pulling it tighter closes the counters.
        "display-xl": ["6rem", { lineHeight: "0.94", letterSpacing: "0.005em" }],
        "display-l": ["4rem", { lineHeight: "0.96", letterSpacing: "0.005em" }],
        "display-m": ["2.875rem", { lineHeight: "1.02", letterSpacing: "0.005em" }],
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
