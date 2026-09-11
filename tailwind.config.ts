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
          DEFAULT: "rgb(var(--bpt-ink-900) / <alpha-value>)",
          900: "rgb(var(--bpt-ink-900) / <alpha-value>)", // strongest text
          800: "rgb(var(--bpt-ink-800) / <alpha-value>)",
          700: "rgb(var(--bpt-ink-700) / <alpha-value>)", // body copy
          600: "rgb(var(--bpt-ink-600) / <alpha-value>)",
          500: "rgb(var(--bpt-ink-500) / <alpha-value>)", // muted
          400: "rgb(var(--bpt-ink-400) / <alpha-value>)",
          300: "rgb(var(--bpt-ink-300) / <alpha-value>)", // faint / meta
          200: "rgb(var(--bpt-ink-200) / <alpha-value>)",
          100: "rgb(var(--bpt-ink-100) / <alpha-value>)",
          50: "rgb(var(--bpt-ink-50) / <alpha-value>)",
        },
        graphite: "rgb(var(--bpt-graphite) / <alpha-value>)",
        paper: {
          DEFAULT: "rgb(var(--bpt-pa-1) / <alpha-value>)",
          0: "rgb(var(--bpt-pa-0) / <alpha-value>)", // card / panel
          1: "rgb(var(--bpt-pa-1) / <alpha-value>)", // page canvas
          2: "rgb(var(--bpt-pa-2) / <alpha-value>)", // inset
          3: "rgb(var(--bpt-pa-3) / <alpha-value>)", // sunken
          4: "rgb(var(--bpt-pa-4) / <alpha-value>)",
        },
        bone: "rgb(var(--bpt-bone) / <alpha-value>)",
        brass: {
          DEFAULT: "rgb(var(--bpt-brass) / <alpha-value>)",
          deep: "rgb(var(--bpt-brass-deep) / <alpha-value>)",
          lit: "rgb(var(--bpt-brass-lit) / <alpha-value>)",
        },


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
          black: "rgb(var(--bpt-rw-black) / <alpha-value>)", // deepest ground: section bands, table heads
          deep: "rgb(var(--bpt-rw-deep) / <alpha-value>)", // page base
          panel: "rgb(var(--bpt-rw-panel) / <alpha-value>)", // cards, panels
          raised: "rgb(var(--bpt-rw-raised) / <alpha-value>)", // hover, raised rows
          line: "rgb(var(--bpt-rw-line) / <alpha-value>)", // default hairline
          "line-soft": "rgb(var(--bpt-rw-line-soft) / <alpha-value>)", // row dividers inside a panel
          "line-strong": "rgb(var(--bpt-rw-line-strong) / <alpha-value>)", // emphasised edge, input borders
          text: "rgb(var(--bpt-rw-text) / <alpha-value>)", // primary bone
          body: "rgb(var(--bpt-rw-body) / <alpha-value>)", // secondary body copy
          mute: "rgb(var(--bpt-rw-mute) / <alpha-value>)", // supporting copy
          faint: "rgb(var(--bpt-rw-faint) / <alpha-value>)", // meta, labels, disabled
          signal: "rgb(var(--bpt-rw-signal) / <alpha-value>)", // brand + primary action
          "signal-deep": "rgb(var(--bpt-rw-signal-deep) / <alpha-value>)", // pressed, and amber on light ground
          "signal-lit": "rgb(var(--bpt-rw-signal-lit) / <alpha-value>)", // hover on dark
          "signal-dim": "rgb(var(--bpt-rw-signal-dim) / <alpha-value>)", // chip borders on dark
          "signal-soft": "rgb(var(--bpt-rw-signal-dim) / <alpha-value>)", // legacy alias of signal-dim
          "signal-ink": "rgb(var(--bpt-rw-signal-ink) / <alpha-value>)", // text on a signal fill
          cyan: "rgb(var(--bpt-rw-cyan) / <alpha-value>)", // "after Blueprint" data series
          sky: "rgb(var(--bpt-rw-sky) / <alpha-value>)", // site-reported provenance, neutral state
          "sky-dim": "rgb(var(--bpt-rw-sky-dim) / <alpha-value>)",
          green: "rgb(var(--bpt-rw-green) / <alpha-value>)", // pass, measured, live
          "green-dim": "rgb(var(--bpt-rw-green-dim) / <alpha-value>)",
          amber: "rgb(var(--bpt-rw-amber) / <alpha-value>)", // open, attention (same hue as signal)
          red: "rgb(var(--bpt-rw-red) / <alpha-value>)", // fail, did-not-qualify
          "red-dim": "rgb(var(--bpt-rw-red-dim) / <alpha-value>)",
          paper: "rgb(var(--bpt-rw-paper) / <alpha-value>)", // light ground, print + inverted blocks
          "paper-2": "rgb(var(--bpt-rw-paper-2) / <alpha-value>)",
          "paper-line": "rgb(var(--bpt-rw-paper-line) / <alpha-value>)",
        },

        // semantic surfaces
        canvas: "rgb(var(--bpt-canvas) / <alpha-value>)",
        inset: "rgb(var(--bpt-inset) / <alpha-value>)",
        sunken: "rgb(var(--bpt-sunken) / <alpha-value>)",
        line: {
          DEFAULT: "rgb(var(--bpt-line) / <alpha-value>)",
          soft: "rgb(var(--bpt-line-soft) / <alpha-value>)",
          strong: "rgb(var(--bpt-line-strong) / <alpha-value>)",
        },

        // action / focus
        action: {
          DEFAULT: "rgb(var(--bpt-action) / <alpha-value>)",
          hover: "rgb(var(--bpt-action-hover) / <alpha-value>)",
        },

        // Signal families — fg / bg / bd. Re-cut for the dark ground: the
        // foreground is the legible tint, `bg` a barely-there wash, `bd` the
        // chip border. Same three-part contract as before, so every existing
        // `bg-proof-bg text-proof-fg border-proof-bd` chip keeps working.
        proof: {
          fg: "rgb(var(--bpt-proof-fg) / <alpha-value>)",
          bg: "rgb(var(--bpt-proof-bg) / <alpha-value>)",
          bd: "rgb(var(--bpt-proof-bd) / <alpha-value>)",
          700: "rgb(var(--bpt-proof-700) / <alpha-value>)",
          600: "rgb(var(--bpt-proof-600) / <alpha-value>)",
          500: "rgb(var(--bpt-proof-500) / <alpha-value>)",
        },
        warn: {
          fg: "rgb(var(--bpt-warn-fg) / <alpha-value>)",
          bg: "rgb(var(--bpt-warn-bg) / <alpha-value>)",
          bd: "rgb(var(--bpt-warn-bd) / <alpha-value>)",
          700: "rgb(var(--bpt-warn-700) / <alpha-value>)",
          600: "rgb(var(--bpt-warn-600) / <alpha-value>)",
          500: "rgb(var(--bpt-warn-500) / <alpha-value>)",
        },
        block: {
          fg: "rgb(var(--bpt-block-fg) / <alpha-value>)",
          bg: "rgb(var(--bpt-block-bg) / <alpha-value>)",
          bd: "rgb(var(--bpt-block-bd) / <alpha-value>)",
          700: "rgb(var(--bpt-block-700) / <alpha-value>)",
          600: "rgb(var(--bpt-block-600) / <alpha-value>)",
          500: "rgb(var(--bpt-block-500) / <alpha-value>)",
        },
        info: {
          fg: "rgb(var(--bpt-info-fg) / <alpha-value>)",
          bg: "rgb(var(--bpt-info-bg) / <alpha-value>)",
          bd: "rgb(var(--bpt-info-bd) / <alpha-value>)",
          700: "rgb(var(--bpt-info-700) / <alpha-value>)",
          600: "rgb(var(--bpt-info-600) / <alpha-value>)",
          500: "rgb(var(--bpt-info-500) / <alpha-value>)",
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
        // `title-s` and `body-xs` were in use across the product surfaces
        // without ever being defined, so both silently rendered at whatever
        // size they inherited. They complete the two scales rather than
        // introducing a new step: title-s sits under title-m, body-xs under
        // caption and above micro.
        "title-s": ["1.0625rem", { lineHeight: "1.25", letterSpacing: "-0.01em" }],
        "body-l": ["1.125rem", { lineHeight: "1.6" }],
        body: ["1rem", { lineHeight: "1.5" }],
        "body-s": ["0.875rem", { lineHeight: "1.5" }],
        caption: ["0.8125rem", { lineHeight: "1.45" }],
        "body-xs": ["0.75rem", { lineHeight: "1.5" }],
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
