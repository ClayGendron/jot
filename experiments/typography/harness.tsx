import React, { useState, useCallback, useEffect } from "react";
import { createRoot } from "react-dom/client";

/* ═══════════════════════════════════════════════════════════════════════════
   Font Definitions
   ═══════════════════════════════════════════════════════════════════════════ */

interface FontOption {
  name: string;
  family: string;
  category: "serif" | "sans" | "mono" | "display";
  weights: number[];
  googleUrl?: string;
  bundled?: boolean;
}

const FONTS: FontOption[] = [
  // ── Serifs ──────────────────────────────────────────────────────
  {
    name: "Libre Caslon Text",
    family: "'Libre Caslon Text', serif",
    category: "serif",
    weights: [400, 700],
    googleUrl: "Libre+Caslon+Text:ital,wght@0,400;0,700;1,400",
  },
  {
    name: "Libre Caslon Display",
    family: "'Libre Caslon Display', serif",
    category: "serif",
    weights: [400],
    googleUrl: "Libre+Caslon+Display",
  },
  {
    name: "Newsreader",
    family: "'Newsreader', serif",
    category: "serif",
    weights: [200, 300, 400, 500, 600, 700, 800],
    bundled: true,
    googleUrl: "Newsreader:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400",
  },
  {
    name: "Lora",
    family: "'Lora', serif",
    category: "serif",
    weights: [400, 500, 600, 700],
    googleUrl: "Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500",
  },
  {
    name: "Merriweather",
    family: "'Merriweather', serif",
    category: "serif",
    weights: [300, 400, 700, 900],
    googleUrl: "Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,400",
  },
  {
    name: "Playfair Display",
    family: "'Playfair Display', serif",
    category: "serif",
    weights: [400, 500, 600, 700, 800, 900],
    googleUrl: "Playfair+Display:ital,wght@0,400;0,600;0,800;1,400",
  },
  {
    name: "EB Garamond",
    family: "'EB Garamond', serif",
    category: "serif",
    weights: [400, 500, 600, 700, 800],
    googleUrl: "EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500",
  },
  {
    name: "Spectral",
    family: "'Spectral', serif",
    category: "serif",
    weights: [200, 300, 400, 500, 600, 700, 800],
    googleUrl: "Spectral:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400",
  },
  {
    name: "Source Serif 4",
    family: "'Source Serif 4', serif",
    category: "serif",
    weights: [200, 300, 400, 500, 600, 700, 800, 900],
    googleUrl: "Source+Serif+4:ital,wght@0,300;0,400;0,600;0,700;1,400",
  },
  {
    name: "Cormorant Garamond",
    family: "'Cormorant Garamond', serif",
    category: "serif",
    weights: [300, 400, 500, 600, 700],
    googleUrl: "Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400",
  },
  {
    name: "Bitter",
    family: "'Bitter', serif",
    category: "serif",
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    googleUrl: "Bitter:ital,wght@0,300;0,400;0,500;0,700;1,400",
  },
  {
    name: "Vollkorn",
    family: "'Vollkorn', serif",
    category: "serif",
    weights: [400, 500, 600, 700, 800, 900],
    googleUrl: "Vollkorn:ital,wght@0,400;0,500;0,600;0,700;1,400",
  },
  {
    name: "Alegreya",
    family: "'Alegreya', serif",
    category: "serif",
    weights: [400, 500, 600, 700, 800, 900],
    googleUrl: "Alegreya:ital,wght@0,400;0,500;0,700;0,900;1,400",
  },
  {
    name: "Noto Serif",
    family: "'Noto Serif', serif",
    category: "serif",
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    googleUrl: "Noto+Serif:ital,wght@0,300;0,400;0,600;0,700;1,400",
  },
  {
    name: "Cardo",
    family: "'Cardo', serif",
    category: "serif",
    weights: [400, 700],
    googleUrl: "Cardo:ital,wght@0,400;0,700;1,400",
  },
  {
    name: "IBM Plex Serif",
    family: "'IBM Plex Serif', serif",
    category: "serif",
    weights: [100, 200, 300, 400, 500, 600, 700],
    googleUrl: "IBM+Plex+Serif:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400",
  },

  // ── Sans-serifs ────────────────────────────────────────────────
  {
    name: "Open Sans",
    family: "'Open Sans', sans-serif",
    category: "sans",
    weights: [300, 400, 500, 600, 700, 800],
    bundled: true,
    googleUrl: "Open+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400",
  },
  {
    name: "DM Sans",
    family: "'DM Sans', sans-serif",
    category: "sans",
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    googleUrl: "DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400",
  },
  {
    name: "Work Sans",
    family: "'Work Sans', sans-serif",
    category: "sans",
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    googleUrl: "Work+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400",
  },
  {
    name: "Nunito Sans",
    family: "'Nunito Sans', sans-serif",
    category: "sans",
    weights: [200, 300, 400, 500, 600, 700, 800, 900],
    googleUrl: "Nunito+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400",
  },
  {
    name: "Source Sans 3",
    family: "'Source Sans 3', sans-serif",
    category: "sans",
    weights: [200, 300, 400, 500, 600, 700, 800, 900],
    googleUrl: "Source+Sans+3:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400",
  },
  {
    name: "Karla",
    family: "'Karla', sans-serif",
    category: "sans",
    weights: [200, 300, 400, 500, 600, 700, 800],
    googleUrl: "Karla:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400",
  },
  {
    name: "Manrope",
    family: "'Manrope', sans-serif",
    category: "sans",
    weights: [200, 300, 400, 500, 600, 700, 800],
    googleUrl: "Manrope:wght@300;400;500;600;700",
  },
  {
    name: "Outfit",
    family: "'Outfit', sans-serif",
    category: "sans",
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    googleUrl: "Outfit:wght@300;400;500;600;700",
  },
  {
    name: "General Sans (system)",
    family: "system-ui, -apple-system, sans-serif",
    category: "sans",
    weights: [400, 500, 600, 700],
  },
  {
    name: "Lexend",
    family: "'Lexend', sans-serif",
    category: "sans",
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    googleUrl: "Lexend:wght@300;400;500;600;700",
  },
  {
    name: "Plus Jakarta Sans",
    family: "'Plus Jakarta Sans', sans-serif",
    category: "sans",
    weights: [200, 300, 400, 500, 600, 700, 800],
    googleUrl: "Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400",
  },
  {
    name: "Figtree",
    family: "'Figtree', sans-serif",
    category: "sans",
    weights: [300, 400, 500, 600, 700, 800, 900],
    googleUrl: "Figtree:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400",
  },
  {
    name: "Geist Sans (fallback)",
    family: "'Geist', system-ui, sans-serif",
    category: "sans",
    weights: [400, 500, 600, 700],
    googleUrl: "Geist:wght@300;400;500;600;700",
  },
  {
    name: "Atkinson Hyperlegible",
    family: "'Atkinson Hyperlegible Next', sans-serif",
    category: "sans",
    weights: [200, 300, 400, 500, 600, 700, 800],
    googleUrl: "Atkinson+Hyperlegible+Next:ital,wght@0,300;0,400;0,500;0,700;1,400",
  },
  {
    name: "Space Grotesk",
    family: "'Space Grotesk', sans-serif",
    category: "sans",
    weights: [300, 400, 500, 600, 700],
    googleUrl: "Space+Grotesk:wght@300;400;500;600;700",
  },
  {
    name: "IBM Plex Sans",
    family: "'IBM Plex Sans', sans-serif",
    category: "sans",
    weights: [100, 200, 300, 400, 500, 600, 700],
    googleUrl: "IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400",
  },

  // ── Monospace ──────────────────────────────────────────────────
  {
    name: "JetBrains Mono",
    family: "'JetBrains Mono', monospace",
    category: "mono",
    weights: [400, 500, 700],
    bundled: true,
    googleUrl: "JetBrains+Mono:ital,wght@0,400;0,500;0,700;1,400",
  },
  {
    name: "Fira Code",
    family: "'Fira Code', monospace",
    category: "mono",
    weights: [300, 400, 500, 600, 700],
    googleUrl: "Fira+Code:wght@300;400;500;600;700",
  },
  {
    name: "Source Code Pro",
    family: "'Source Code Pro', monospace",
    category: "mono",
    weights: [200, 300, 400, 500, 600, 700, 800, 900],
    googleUrl: "Source+Code+Pro:ital,wght@0,300;0,400;0,500;0,700;1,400",
  },
  {
    name: "IBM Plex Mono",
    family: "'IBM Plex Mono', monospace",
    category: "mono",
    weights: [100, 200, 300, 400, 500, 600, 700],
    googleUrl: "IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,700;1,400",
  },
  {
    name: "Inconsolata",
    family: "'Inconsolata', monospace",
    category: "mono",
    weights: [200, 300, 400, 500, 600, 700, 800, 900],
    googleUrl: "Inconsolata:wght@300;400;500;600;700",
  },
  {
    name: "Red Hat Mono",
    family: "'Red Hat Mono', monospace",
    category: "mono",
    weights: [300, 400, 500, 600, 700],
    googleUrl: "Red+Hat+Mono:ital,wght@0,300;0,400;0,500;0,700;1,400",
  },
  {
    name: "Space Mono",
    family: "'Space Mono', monospace",
    category: "mono",
    weights: [400, 700],
    googleUrl: "Space+Mono:ital,wght@0,400;0,700;1,400",
  },
  {
    name: "Commit Mono (system)",
    family: "ui-monospace, 'Cascadia Code', 'Menlo', monospace",
    category: "mono",
    weights: [400, 700],
  },
  {
    name: "DM Mono",
    family: "'DM Mono', monospace",
    category: "mono",
    weights: [300, 400, 500],
    googleUrl: "DM+Mono:ital,wght@0,300;0,400;0,500;1,400",
  },

  // ── Display / Decorative ───────────────────────────────────────
  {
    name: "Fraunces",
    family: "'Fraunces', serif",
    category: "display",
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    googleUrl: "Fraunces:ital,wght@0,300;0,400;0,600;0,800;1,400",
  },
  {
    name: "Instrument Serif",
    family: "'Instrument Serif', serif",
    category: "display",
    weights: [400],
    googleUrl: "Instrument+Serif:ital@0;1",
  },
  {
    name: "Literata",
    family: "'Literata', serif",
    category: "display",
    weights: [200, 300, 400, 500, 600, 700, 800, 900],
    googleUrl: "Literata:ital,wght@0,300;0,400;0,500;0,700;1,400",
  },
  {
    name: "Sora",
    family: "'Sora', sans-serif",
    category: "display",
    weights: [100, 200, 300, 400, 500, 600, 700, 800],
    googleUrl: "Sora:wght@300;400;500;600;700;800",
  },
  {
    name: "Cabinet Grotesk (fallback)",
    family: "'Cabinet Grotesk', 'DM Sans', sans-serif",
    category: "display",
    weights: [400, 500, 700, 800, 900],
    googleUrl: "DM+Sans:wght@400;500;700",
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Google Fonts Loader
   ═══════════════════════════════════════════════════════════════════════════ */

const loadedFonts = new Set<string>();

function loadGoogleFont(font: FontOption) {
  if (!font.googleUrl || loadedFonts.has(font.name)) return;
  loadedFonts.add(font.name);

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${font.googleUrl}&display=swap`;
  document.head.appendChild(link);
}

function loadBundledFonts() {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/fonts/fonts.css";
  document.head.appendChild(link);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Preset Pairings
   ═══════════════════════════════════════════════════════════════════════════ */

interface Preset {
  label: string;
  description: string;
  heading: string;
  body: string;
  ui: string;
  mono: string;
}

const PRESETS: Preset[] = [
  {
    label: "Jot Default",
    description: "Current Jot configuration",
    heading: "Newsreader",
    body: "Newsreader",
    ui: "Open Sans",
    mono: "JetBrains Mono",
  },
  {
    label: "Classic Caslon",
    description: "Libre Caslon for headings and body, Open Sans UI",
    heading: "Libre Caslon Display",
    body: "Libre Caslon Text",
    ui: "Open Sans",
    mono: "JetBrains Mono",
  },
  {
    label: "Editorial",
    description: "Playfair headings, Source Serif body",
    heading: "Playfair Display",
    body: "Source Serif 4",
    ui: "Source Sans 3",
    mono: "Source Code Pro",
  },
  {
    label: "Modern Warmth",
    description: "Fraunces display, Lora body, DM Sans UI",
    heading: "Fraunces",
    body: "Lora",
    ui: "DM Sans",
    mono: "Fira Code",
  },
  {
    label: "Clean & Technical",
    description: "Work Sans everywhere, IBM Plex Mono",
    heading: "Work Sans",
    body: "Work Sans",
    ui: "Work Sans",
    mono: "IBM Plex Mono",
  },
  {
    label: "Readable",
    description: "Atkinson Hyperlegible with Lexend headings",
    heading: "Lexend",
    body: "Atkinson Hyperlegible",
    ui: "Atkinson Hyperlegible",
    mono: "Red Hat Mono",
  },
  {
    label: "Literary",
    description: "EB Garamond headings, Spectral body",
    heading: "EB Garamond",
    body: "Spectral",
    ui: "Karla",
    mono: "DM Mono",
  },
  {
    label: "Newsroom",
    description: "Newsreader everywhere, Space Mono code",
    heading: "Newsreader",
    body: "Newsreader",
    ui: "Manrope",
    mono: "Space Mono",
  },
  {
    label: "Geometric",
    description: "Outfit headings, Plus Jakarta Sans body",
    heading: "Outfit",
    body: "Plus Jakarta Sans",
    ui: "Plus Jakarta Sans",
    mono: "Inconsolata",
  },
  {
    label: "Old World",
    description: "Cormorant Garamond heading, Alegreya body",
    heading: "Cormorant Garamond",
    body: "Alegreya",
    ui: "Nunito Sans",
    mono: "Fira Code",
  },
  {
    label: "Bookish",
    description: "Vollkorn body with Instrument Serif headings",
    heading: "Instrument Serif",
    body: "Vollkorn",
    ui: "Figtree",
    mono: "JetBrains Mono",
  },
  {
    label: "Minimal Sans",
    description: "Figtree everywhere for ultra-clean look",
    heading: "Figtree",
    body: "Figtree",
    ui: "Figtree",
    mono: "JetBrains Mono",
  },
  {
    label: "Space",
    description: "Space Grotesk + Space Mono, Newsreader serif",
    heading: "Space Grotesk",
    body: "Newsreader",
    ui: "Space Grotesk",
    mono: "Space Mono",
  },
  {
    label: "IBM Plex",
    description: "Full IBM Plex family: Serif, Sans, and Mono",
    heading: "IBM Plex Serif",
    body: "IBM Plex Serif",
    ui: "IBM Plex Sans",
    mono: "IBM Plex Mono",
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Theme Colors
   ═══════════════════════════════════════════════════════════════════════════ */

interface ThemeColors {
  bg: string;
  bgWarm: string;
  fg: string;
  fgLight: string;
  fgMuted: string;
  accent: string;
  accentSoft: string;
  border: string;
  borderStrong: string;
  codeBg: string;
  codeInlineBg: string;
  blockquoteBorder: string;
  selection: string;
}

const THEMES: Record<string, ThemeColors> = {
  paper: {
    bg: "#faf8f5",
    bgWarm: "#f5f2eb",
    fg: "#1a1a1a",
    fgLight: "#4a4a4a",
    fgMuted: "#8a8a8a",
    accent: "#c45d3e",
    accentSoft: "#e8b4a4",
    border: "#e5e2dc",
    borderStrong: "#d0cdc5",
    codeBg: "#f0ede6",
    codeInlineBg: "#efe9df",
    blockquoteBorder: "#d4b896",
    selection: "#c45d3e18",
  },
  midnight: {
    bg: "#111111",
    bgWarm: "#1a1a1a",
    fg: "#e0ddd8",
    fgLight: "#a09c96",
    fgMuted: "#5a5855",
    accent: "#e07a5f",
    accentSoft: "#5c3d34",
    border: "#262626",
    borderStrong: "#333333",
    codeBg: "#1e1e1e",
    codeInlineBg: "#242424",
    blockquoteBorder: "#e07a5f88",
    selection: "#e07a5f18",
  },
  sepia: {
    bg: "#f4ecd8",
    bgWarm: "#ebe3ca",
    fg: "#3d3028",
    fgLight: "#5c5040",
    fgMuted: "#8a7e6a",
    accent: "#8b5a2b",
    accentSoft: "#d4b896",
    border: "#d9cfb8",
    borderStrong: "#c4b89e",
    codeBg: "#e8dfca",
    codeInlineBg: "#e2d8c0",
    blockquoteBorder: "#8b5a2b88",
    selection: "#8b5a2b18",
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   Font Picker Component
   ═══════════════════════════════════════════════════════════════════════════ */

function FontPicker({
  label,
  value,
  onChange,
  categories,
  theme,
}: {
  label: string;
  value: string;
  onChange: (name: string) => void;
  categories: FontOption["category"][];
  theme: ThemeColors;
}) {
  const options = FONTS.filter((f) => categories.includes(f.category));

  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          display: "block",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: theme.fgMuted,
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "6px 8px",
          fontSize: 13,
          fontFamily: "inherit",
          background: theme.bgWarm,
          color: theme.fg,
          border: `1px solid ${theme.border}`,
          borderRadius: 4,
          cursor: "pointer",
          outline: "none",
        }}
      >
        {options.map((f) => (
          <option key={f.name} value={f.name}>
            {f.name}
            {f.bundled ? " (bundled)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Slider Component
   ═══════════════════════════════════════════════════════════════════════════ */

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  theme,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  theme: ThemeColors;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 4,
        }}
      >
        <label
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: theme.fgMuted,
          }}
        >
          {label}
        </label>
        <span style={{ fontSize: 12, color: theme.fgLight, fontVariantNumeric: "tabular-nums" }}>
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: theme.accent }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Article Content Component
   ═══════════════════════════════════════════════════════════════════════════ */

function Article({
  headingFamily,
  bodyFamily,
  uiFamily,
  monoFamily,
  fontSize,
  lineHeight,
  maxWidth,
  theme,
}: {
  headingFamily: string;
  bodyFamily: string;
  uiFamily: string;
  monoFamily: string;
  fontSize: number;
  lineHeight: number;
  maxWidth: string;
  theme: ThemeColors;
}) {
  const h1: React.CSSProperties = {
    fontFamily: headingFamily,
    fontSize: fontSize * 2.2,
    fontWeight: 700,
    lineHeight: 1.15,
    letterSpacing: "-0.02em",
    color: theme.fg,
    margin: "0 0 8px 0",
  };

  const h2: React.CSSProperties = {
    fontFamily: headingFamily,
    fontSize: fontSize * 1.6,
    fontWeight: 600,
    lineHeight: 1.25,
    letterSpacing: "-0.01em",
    color: theme.fg,
    margin: "48px 0 12px 0",
  };

  const h3: React.CSSProperties = {
    fontFamily: headingFamily,
    fontSize: fontSize * 1.25,
    fontWeight: 600,
    lineHeight: 1.35,
    color: theme.fg,
    margin: "36px 0 8px 0",
  };

  const p: React.CSSProperties = {
    fontFamily: bodyFamily,
    fontSize,
    lineHeight,
    color: theme.fgLight,
    margin: "0 0 18px 0",
  };

  const lead: React.CSSProperties = {
    ...p,
    fontSize: fontSize * 1.15,
    lineHeight: lineHeight * 0.95,
    color: theme.fgLight,
  };

  const code: React.CSSProperties = {
    fontFamily: monoFamily,
    fontSize: fontSize * 0.85,
    background: theme.codeInlineBg,
    padding: "2px 6px",
    borderRadius: 3,
    color: theme.fg,
  };

  const codeBlock: React.CSSProperties = {
    fontFamily: monoFamily,
    fontSize: fontSize * 0.82,
    lineHeight: 1.65,
    background: theme.codeBg,
    padding: "20px 24px",
    borderRadius: 6,
    border: `1px solid ${theme.border}`,
    margin: "0 0 18px 0",
    overflowX: "auto",
    color: theme.fg,
  };

  const blockquote: React.CSSProperties = {
    fontFamily: bodyFamily,
    fontSize: fontSize * 1.05,
    fontStyle: "italic",
    lineHeight: lineHeight * 1.05,
    color: theme.fgLight,
    borderLeft: `3px solid ${theme.blockquoteBorder}`,
    margin: "0 0 18px 0",
    paddingLeft: 20,
  };

  const uiLabel: React.CSSProperties = {
    fontFamily: uiFamily,
    fontSize: fontSize * 0.72,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    color: theme.fgMuted,
  };

  const badge: React.CSSProperties = {
    fontFamily: uiFamily,
    fontSize: fontSize * 0.65,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    background: theme.accentSoft,
    color: theme.accent,
    padding: "3px 10px",
    borderRadius: 100,
    display: "inline-block",
  };

  const hr: React.CSSProperties = {
    border: "none",
    height: 1,
    background: theme.border,
    margin: "32px 0",
  };

  const caption: React.CSSProperties = {
    fontFamily: uiFamily,
    fontSize: fontSize * 0.75,
    color: theme.fgMuted,
    textAlign: "center" as const,
    margin: "8px 0 24px 0",
  };

  const listItem: React.CSSProperties = {
    fontFamily: bodyFamily,
    fontSize,
    lineHeight,
    color: theme.fgLight,
    marginBottom: 6,
  };

  return (
    <article style={{ maxWidth, margin: "0 auto" }}>
      {/* ── "Jot" display in all font roles ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 20,
          marginBottom: 48,
          paddingBottom: 40,
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        {[
          { label: "Serif / Body", family: bodyFamily, weight: 400 },
          { label: "Sans-Serif / UI", family: uiFamily, weight: 600 },
          { label: "Monospace / Code", family: monoFamily, weight: 400 },
        ].map(({ label, family, weight }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: family,
                fontSize: fontSize * 5,
                fontWeight: weight,
                lineHeight: 1,
                color: theme.fg,
                letterSpacing: "-0.03em",
                marginBottom: 8,
              }}
            >
              jot
            </div>
            <div
              style={{
                fontFamily: uiFamily,
                fontSize: fontSize * 0.6,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: theme.fgMuted,
                marginBottom: 4,
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontFamily: uiFamily,
                fontSize: fontSize * 0.65,
                color: theme.fgMuted,
              }}
            >
              {family.split(",")[0].replace(/'/g, "")}
            </div>
          </div>
        ))}
      </div>

      {/* Meta / UI text */}
      <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
        <span style={badge}>Typography</span>
        <span style={badge}>Design Systems</span>
      </div>

      {/* Title */}
      <h1 style={h1}>The Quiet Precision of Letters</h1>

      {/* Byline - UI font */}
      <div
        style={{
          fontFamily: uiFamily,
          fontSize: fontSize * 0.8,
          color: theme.fgMuted,
          marginBottom: 32,
          display: "flex",
          gap: 16,
          alignItems: "center",
        }}
      >
        <span>By Eleanor Vance</span>
        <span style={{ color: theme.border }}>|</span>
        <span>12 min read</span>
        <span style={{ color: theme.border }}>|</span>
        <span>February 2026</span>
      </div>

      <hr style={hr} />

      {/* Lead paragraph */}
      <p style={lead}>
        Every typeface carries a voice. Some whisper with the restraint of a well-set serif;
        others announce themselves with geometric confidence. The choice of font is not decoration
        - it is the first word your design speaks before a single character is read.
      </p>

      <p style={p}>
        We live in an era of extraordinary typographic abundance. The open-source movement has
        produced typefaces that rival centuries of commercial type design, and the web has made
        them universally accessible. Yet abundance creates its own challenge: how do you choose?
        How do you pair? How do you know when the typography <em>serves</em> the content rather
        than competing with it?
      </p>

      {/* Section: Serif */}
      <h2 style={h2}>The Enduring Case for Serifs</h2>

      <p style={p}>
        Serifs have survived every digital revolution. The small strokes that extend from the
        terminals of letterforms were originally artifacts of stone carving, but they became
        essential to readability in long-form text. A well-designed serif like{" "}
        <strong>Libre Caslon</strong> or <strong>Crimson Pro</strong> creates a subtle baseline
        rhythm that guides the eye across the page.
      </p>

      <blockquote style={blockquote}>
        "Typography is the craft of endowing human language with a durable visual form, and thus
        with an independent existence."
        <br />
        <span style={{ fontStyle: "normal", fontSize: fontSize * 0.85, color: theme.fgMuted }}>
          - Robert Bringhurst, <em>The Elements of Typographic Style</em>
        </span>
      </blockquote>

      <p style={p}>
        The difference between a Caslon and a Garamond is the difference between English
        pragmatism and French elegance. Caslon is sturdy, reliable, quietly beautiful - the
        typeface in which the American Declaration of Independence was first set. Garamond is
        more calligraphic, more flowing, carrying the spirit of Renaissance humanism in every
        curve. Both are correct. Neither is neutral.
      </p>

      <h3 style={h3}>Optical Sizing Matters</h3>

      <p style={p}>
        One of the most overlooked aspects of font selection is optical sizing. A typeface
        designed for body text (like <code style={code}>Libre Caslon Text</code>) has different
        proportions than one designed for display (like <code style={code}>Libre Caslon Display</code>).
        The display version features higher contrast between thick and thin strokes, tighter
        spacing, and more dramatic details that shine at large sizes but collapse at small ones.
      </p>

      {/* Section: Sans */}
      <h2 style={h2}>Sans-Serifs and the Modern Interface</h2>

      <p style={p}>
        When Jan Tschichold championed "The New Typography" in 1928, sans-serif faces were
        radical. Today they are default. <strong>Open Sans</strong>, with its humanist proportions
        and open letterforms, has become one of the most widely deployed typefaces in history
        - not because it is exciting, but because it is clear, friendly, and never gets in the way.
      </p>

      <p style={p}>
        But there is a spectrum within sans-serif design. Geometric sans-serifs like{" "}
        <strong>Outfit</strong> build letters from circles and straight lines, producing a clean,
        architectural feeling. Humanist sans-serifs like <strong>Karla</strong> or{" "}
        <strong>Source Sans</strong> incorporate subtle calligraphic traits that add warmth.
        Grotesques like <strong>DM Sans</strong> sit somewhere in between, inheriting the
        rationality of 19th-century type without the coldness of pure geometry.
      </p>

      {/* Sans-serif paragraph showcase */}
      <div
        style={{
          background: theme.bgWarm,
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          padding: "28px",
          margin: "24px 0",
        }}
      >
        <div style={uiLabel}>Sans-Serif as Body Text</div>
        <p
          style={{
            fontFamily: uiFamily,
            fontSize,
            lineHeight,
            color: theme.fgLight,
            margin: "16px 0 0 0",
          }}
        >
          This paragraph is set in the <strong>UI / sans-serif font</strong> at body size. In many
          modern applications, the sans-serif does double duty - handling both interface chrome and
          extended reading. Notice how the texture differs from the serif paragraphs above. Sans-serifs
          tend to produce a more uniform "color" on the page, with less rhythmic variation between
          thick and thin strokes. Whether this feels cleaner or more monotonous depends on the
          specific face and the reader's expectations.
        </p>
        <p
          style={{
            fontFamily: uiFamily,
            fontSize: fontSize * 0.9,
            lineHeight: lineHeight * 0.95,
            color: theme.fgLight,
            margin: "14px 0 0 0",
          }}
        >
          At slightly smaller sizes, the sans-serif often gains an advantage in clarity. Where a
          serif's fine details can blur or disappear on low-resolution screens, the sans-serif's
          simpler geometry remains sharp. This is why most operating systems default to a sans-serif
          for system UI, and why designers reach for them when legibility at small sizes matters
          more than atmosphere.
        </p>
      </div>

      {/* Navigation / sidebar mock */}
      <h3 style={h3}>The Sans-Serif in Navigation</h3>

      <p style={p}>
        Navigation is where the sans-serif truly earns its keep. File trees, breadcrumbs, tab
        bars, dropdown menus - these are all domains where clarity at a glance outweighs
        everything else. Here is how the current UI font handles typical navigation patterns:
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "200px 1fr",
          gap: 0,
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          overflow: "hidden",
          margin: "24px 0",
        }}
      >
        {/* Sidebar nav mock */}
        <div
          style={{
            background: theme.bgWarm,
            borderRight: `1px solid ${theme.border}`,
            padding: "16px 0",
            fontFamily: uiFamily,
          }}
        >
          <div
            style={{
              padding: "0 16px 12px",
              fontSize: fontSize * 0.65,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: theme.fgMuted,
            }}
          >
            Workspace
          </div>
          {[
            { label: "Getting Started", indent: 0, active: false },
            { label: "Architecture", indent: 0, active: true },
            { label: "Components", indent: 1, active: false },
            { label: "State Management", indent: 1, active: false },
            { label: "Typography", indent: 1, active: false },
            { label: "API Reference", indent: 0, active: false },
            { label: "Endpoints", indent: 1, active: false },
            { label: "Authentication", indent: 1, active: false },
            { label: "Changelog", indent: 0, active: false },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                padding: "6px 16px",
                paddingLeft: 16 + item.indent * 16,
                fontSize: fontSize * 0.75,
                fontWeight: item.active ? 600 : 400,
                color: item.active ? theme.accent : theme.fgLight,
                background: item.active ? theme.selection : "transparent",
                borderRight: item.active ? `2px solid ${theme.accent}` : "2px solid transparent",
                cursor: "pointer",
              }}
            >
              {item.indent > 0 ? "  " : ""}{item.label}
            </div>
          ))}
        </div>

        {/* Content area with breadcrumbs + metadata */}
        <div style={{ padding: "16px 24px", fontFamily: uiFamily }}>
          {/* Breadcrumbs */}
          <div
            style={{
              fontSize: fontSize * 0.7,
              color: theme.fgMuted,
              marginBottom: 12,
              display: "flex",
              gap: 6,
              alignItems: "center",
            }}
          >
            <span style={{ cursor: "pointer" }}>Docs</span>
            <span>/</span>
            <span style={{ cursor: "pointer" }}>Architecture</span>
            <span>/</span>
            <span style={{ color: theme.fgLight }}>Overview</span>
          </div>

          {/* Title area */}
          <div
            style={{
              fontSize: fontSize * 1.1,
              fontWeight: 700,
              color: theme.fg,
              marginBottom: 8,
            }}
          >
            Architecture Overview
          </div>

          {/* Meta row */}
          <div
            style={{
              fontSize: fontSize * 0.68,
              color: theme.fgMuted,
              display: "flex",
              gap: 16,
              marginBottom: 16,
              paddingBottom: 16,
              borderBottom: `1px solid ${theme.border}`,
            }}
          >
            <span>Last edited 2 hours ago</span>
            <span>by Clay Gendron</span>
            <span>1,240 words</span>
          </div>

          {/* Short content preview */}
          <div
            style={{
              fontSize: fontSize * 0.8,
              lineHeight: 1.6,
              color: theme.fgLight,
            }}
          >
            This document outlines the high-level architecture of the application, including the
            component hierarchy, state management approach, and integration points with the
            filesystem backend.
          </div>
        </div>
      </div>

      {/* Card grid - all sans */}
      <h3 style={h3}>Cards, Metadata, and Compact Layouts</h3>

      <p style={p}>
        Cards are another natural habitat for the sans-serif. When content is broken into
        discrete, scannable units - each with a title, summary, tags, and metadata - the
        sans-serif's even texture and clear hierarchy shine.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          margin: "24px 0",
          fontFamily: uiFamily,
        }}
      >
        {[
          {
            title: "Quick Start Guide",
            summary: "Get up and running with a new workspace in under five minutes.",
            tag: "Getting Started",
            date: "Jan 28",
            words: "850",
          },
          {
            title: "Keyboard Shortcuts",
            summary: "Master the editor with essential shortcuts for formatting and navigation.",
            tag: "Reference",
            date: "Jan 25",
            words: "1,200",
          },
          {
            title: "Export Formats",
            summary: "Learn how to export your documents to PDF, DOCX, and HTML.",
            tag: "Features",
            date: "Jan 22",
            words: "620",
          },
        ].map((card, i) => (
          <div
            key={i}
            style={{
              background: theme.bgWarm,
              border: `1px solid ${theme.border}`,
              borderRadius: 8,
              padding: "20px",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                fontSize: fontSize * 0.6,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: theme.accent,
                marginBottom: 8,
              }}
            >
              {card.tag}
            </div>
            <div
              style={{
                fontSize: fontSize * 0.85,
                fontWeight: 600,
                color: theme.fg,
                marginBottom: 6,
                lineHeight: 1.3,
              }}
            >
              {card.title}
            </div>
            <div
              style={{
                fontSize: fontSize * 0.72,
                color: theme.fgMuted,
                lineHeight: 1.5,
                marginBottom: 12,
              }}
            >
              {card.summary}
            </div>
            <div
              style={{
                fontSize: fontSize * 0.62,
                color: theme.fgMuted,
                display: "flex",
                justifyContent: "space-between",
                borderTop: `1px solid ${theme.border}`,
                paddingTop: 10,
              }}
            >
              <span>{card.date}</span>
              <span>{card.words} words</span>
            </div>
          </div>
        ))}
      </div>

      {/* UI element showcase */}
      <h3 style={h3}>Buttons, Forms, and Interactive Controls</h3>

      <p style={p}>
        The smallest test of a sans-serif is in the tightest spaces: 11px button labels, 10px
        form captions, 9px status indicators. A typeface that looks elegant at 18px may become
        illegible at 10px. The controls below show the current UI font at the sizes it would
        actually be used in an interface:
      </p>

      <div
        style={{
          background: theme.bgWarm,
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          padding: "24px 28px",
          margin: "24px 0",
        }}
      >
        <div style={uiLabel}>Interface Elements (UI Font)</div>

        {/* Buttons row */}
        <div
          style={{
            marginTop: 16,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {["Save", "Export PDF", "New Document", "Settings"].map((label) => (
            <button
              key={label}
              style={{
                fontFamily: uiFamily,
                fontSize: fontSize * 0.78,
                fontWeight: 500,
                padding: "8px 18px",
                background: theme.bg,
                color: theme.fg,
                border: `1px solid ${theme.borderStrong}`,
                borderRadius: 5,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
          <button
            style={{
              fontFamily: uiFamily,
              fontSize: fontSize * 0.78,
              fontWeight: 600,
              padding: "8px 18px",
              background: theme.accent,
              color: "#ffffff",
              border: "none",
              borderRadius: 5,
              cursor: "pointer",
            }}
          >
            Publish
          </button>
        </div>

        {/* Form mock */}
        <div style={{ marginTop: 20, display: "flex", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: uiFamily,
                fontSize: fontSize * 0.68,
                fontWeight: 500,
                color: theme.fgMuted,
                marginBottom: 4,
                letterSpacing: "0.02em",
              }}
            >
              Document title
            </div>
            <div
              style={{
                fontFamily: uiFamily,
                fontSize: fontSize * 0.8,
                padding: "8px 12px",
                background: theme.bg,
                color: theme.fg,
                border: `1px solid ${theme.border}`,
                borderRadius: 4,
              }}
            >
              The Quiet Precision of Letters
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: uiFamily,
                fontSize: fontSize * 0.68,
                fontWeight: 500,
                color: theme.fgMuted,
                marginBottom: 4,
                letterSpacing: "0.02em",
              }}
            >
              Tags
            </div>
            <div
              style={{
                padding: "6px 12px",
                background: theme.bg,
                border: `1px solid ${theme.border}`,
                borderRadius: 4,
                display: "flex",
                gap: 6,
              }}
            >
              {["typography", "design"].map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontFamily: uiFamily,
                    fontSize: fontSize * 0.65,
                    fontWeight: 500,
                    background: theme.bgWarm,
                    border: `1px solid ${theme.border}`,
                    color: theme.fgLight,
                    padding: "2px 8px",
                    borderRadius: 3,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div
          style={{
            marginTop: 16,
            padding: "8px 12px",
            background: theme.bg,
            border: `1px solid ${theme.border}`,
            borderRadius: 4,
            fontFamily: uiFamily,
            fontSize: fontSize * 0.65,
            color: theme.fgMuted,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Ln 42, Col 18</span>
          <span>UTF-8</span>
          <span>Markdown</span>
          <span>2,847 words</span>
          <span style={{ color: theme.accent, fontWeight: 500 }}>Saved</span>
        </div>

        <div
          style={{
            fontFamily: uiFamily,
            fontSize: fontSize * 0.72,
            color: theme.fgMuted,
            marginTop: 14,
            lineHeight: 1.5,
          }}
        >
          Sidebar navigation, toolbar labels, metadata fields, form inputs, status bars, and
          system dialogs all benefit from a clean sans-serif that maintains legibility at small
          sizes.
        </div>
      </div>

      {/* Annotation aside - sans serif callout */}
      <div
        style={{
          fontFamily: uiFamily,
          fontSize: fontSize * 0.78,
          lineHeight: 1.55,
          color: theme.fgLight,
          background: `${theme.accent}08`,
          borderLeft: `3px solid ${theme.accent}`,
          padding: "16px 20px",
          margin: "24px 0",
          borderRadius: "0 6px 6px 0",
        }}
      >
        <div
          style={{
            fontSize: fontSize * 0.65,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: theme.accent,
            marginBottom: 6,
          }}
        >
          Design Note
        </div>
        The sans-serif font appears in more places than you might expect. Aside from buttons and
        labels, it handles breadcrumbs, tooltips, dropdown menus, toast notifications, modal
        dialogs, keyboard shortcut hints, search result metadata, file tree labels, tab titles,
        and the status bar. In Jot, this means the UI font is rendered at sizes ranging from 9px
        (keyboard hints) to 16px (dialog headings). Testing across this full range is essential.
      </div>

      {/* Section: Mono */}
      <h2 style={h2}>Monospace: More Than Code</h2>

      <p style={p}>
        The monospaced typeface occupies a unique position. Originally a mechanical necessity of
        typewriters and early terminals, the fixed-width letter has become synonymous with
        technical precision. In a markdown editor, the monospace font does double duty: it
        renders code blocks and inline code, but it also signals "this is raw, this is exact,
        this is the source."
      </p>

      <p style={p}>
        <strong>JetBrains Mono</strong> was designed specifically for developers, with increased
        x-height and distinctive letterforms that prevent common misreadings (
        <code style={code}>1lI</code>, <code style={code}>0Oo</code>,{" "}
        <code style={code}>{`{}`}</code> vs <code style={code}>{`()`}</code>). Compare this to{" "}
        <strong>Fira Code</strong>, which adds programming ligatures that transform{" "}
        <code style={code}>{`=>`}</code> and <code style={code}>{`!==`}</code> into single
        glyphs, or <strong>IBM Plex Mono</strong>, which carries a more industrial, utilitarian
        character.
      </p>

      {/* Code block */}
      <pre style={codeBlock}>
{`// Typography configuration for a markdown editor
interface FontSystem {
  heading: FontFamily;   // Display or serif for titles
  body: FontFamily;      // Serif or sans for prose
  ui: FontFamily;        // Sans-serif for interface chrome
  mono: FontFamily;      // Monospace for code blocks
}

function createFontStack(primary: string, fallbacks: string[]): string {
  return [primary, ...fallbacks]
    .map(f => f.includes(' ') ? \`'\${f}'\` : f)
    .join(', ');
}`}
      </pre>
      <div style={caption}>
        A TypeScript interface modeling the four-role font system used in Jot.
      </div>

      {/* Section: Pairing */}
      <h2 style={h2}>The Art of Font Pairing</h2>

      <p style={p}>
        The fundamental rule of font pairing is <strong>concordance or contrast, never conflict</strong>.
        Two similar-but-different serifs create visual tension because the reader senses they
        should match but don't. A serif heading with a sans body works because the contrast is
        intentional and clear.
      </p>

      <h3 style={h3}>Pairing Strategies</h3>

      <ol style={{ paddingLeft: 24, marginBottom: 18 }}>
        <li style={listItem}>
          <strong>Superfamily pairing</strong> - Use fonts designed together.{" "}
          <em>Source Serif + Source Sans + Source Code Pro</em> share skeletal proportions
          across three categories.
        </li>
        <li style={listItem}>
          <strong>Contrast pairing</strong> - Match a high-contrast display serif with a
          low-contrast geometric sans. <em>Playfair Display + Work Sans</em> creates dramatic
          hierarchy.
        </li>
        <li style={listItem}>
          <strong>Era pairing</strong> - Combine fonts from the same design era.{" "}
          <em>EB Garamond + Alegreya</em> both carry Renaissance-era DNA.
        </li>
        <li style={listItem}>
          <strong>Weight pairing</strong> - Use a single family across roles, differentiated
          only by weight. <em>Figtree 300 for body, 700 for headings, 500 for UI</em>.
        </li>
      </ol>

      <p style={p}>
        The practical test is simple: squint at the page. If the hierarchy is clear - if you can
        tell headings from body from captions from code without reading a word - the typography is
        working. If everything blurs into a homogeneous gray, you need more contrast. If elements
        fight for attention, you need more restraint.
      </p>

      <hr style={hr} />

      {/* Section: Technical */}
      <h2 style={h2}>Technical Considerations</h2>

      <p style={p}>
        Performance matters as much as aesthetics. Each font weight is a network request
        and a file to parse. A four-weight serif plus a three-weight sans plus a two-weight mono
        equals nine font files - potentially 500KB or more. Strategies for managing this:
      </p>

      <ul style={{ paddingLeft: 24, marginBottom: 18 }}>
        <li style={listItem}>
          Use <code style={code}>font-display: swap</code> to prevent invisible text during
          loading
        </li>
        <li style={listItem}>
          Subset fonts to only the character sets you need (Latin, Latin Extended)
        </li>
        <li style={listItem}>
          Prefer <code style={code}>woff2</code> format for 30% smaller files than{" "}
          <code style={code}>ttf</code>
        </li>
        <li style={listItem}>
          Bundle critical fonts locally; lazy-load decorative ones from CDN
        </li>
        <li style={listItem}>
          Use CSS <code style={code}>size-adjust</code> to minimize layout shift between
          fallback and loaded fonts
        </li>
      </ul>

      <pre style={codeBlock}>
{`/* Optimal @font-face declaration */
@font-face {
  font-family: 'Libre Caslon Text';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('./LibreCaslonText-Regular.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153;
}

/* System font stack as fallback */
--font-body: 'Libre Caslon Text', 'Georgia', 'Times New Roman', serif;`}
      </pre>

      {/* Section: Scale */}
      <h2 style={h2}>Building a Type Scale</h2>

      <p style={p}>
        A modular type scale creates mathematical harmony between sizes. The most common ratio
        for editorial design is the <strong>perfect fourth</strong> (1.333), though a{" "}
        <strong>major third</strong> (1.25) produces a tighter scale suited to interfaces with
        limited space. Here is the current scale applied to this article:
      </p>

      {/* Type scale display */}
      <div
        style={{
          background: theme.bgWarm,
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          padding: "28px",
          margin: "24px 0",
        }}
      >
        <div style={uiLabel}>Type Scale Preview</div>
        <div style={{ marginTop: 20 }}>
          {[
            { label: "H1", size: fontSize * 2.2, weight: 700, family: headingFamily },
            { label: "H2", size: fontSize * 1.6, weight: 600, family: headingFamily },
            { label: "H3", size: fontSize * 1.25, weight: 600, family: headingFamily },
            { label: "Body", size: fontSize, weight: 400, family: bodyFamily },
            { label: "Small", size: fontSize * 0.85, weight: 400, family: bodyFamily },
            { label: "UI", size: fontSize * 0.78, weight: 500, family: uiFamily },
            { label: "Code", size: fontSize * 0.82, weight: 400, family: monoFamily },
            { label: "Caption", size: fontSize * 0.72, weight: 400, family: uiFamily },
          ].map(({ label, size, weight, family }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 16,
                padding: "10px 0",
                borderBottom: `1px solid ${theme.border}`,
              }}
            >
              <span
                style={{
                  fontFamily: uiFamily,
                  fontSize: 10,
                  fontWeight: 600,
                  color: theme.fgMuted,
                  width: 50,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  flexShrink: 0,
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontFamily: uiFamily,
                  fontSize: 10,
                  color: theme.fgMuted,
                  width: 40,
                  flexShrink: 0,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {Math.round(size)}px
              </span>
              <span
                style={{
                  fontFamily: family,
                  fontSize: size,
                  fontWeight: weight,
                  color: theme.fg,
                  lineHeight: 1.3,
                }}
              >
                The quick brown fox
              </span>
            </div>
          ))}
        </div>
      </div>

      <h2 style={h2}>Line Length and Reading Comfort</h2>

      <p style={p}>
        Robert Bringhurst recommends 45-75 characters per line for single-column body text,
        with 66 characters often cited as the ideal. Too short, and the eye bounces back and
        forth jarringly. Too long, and the reader loses their place when moving to the next line.
        The current maximum line width is set to <code style={code}>{maxWidth}ch</code>.
      </p>

      <p style={p}>
        Line height (leading) interacts directly with line length. Longer lines need more leading
        to help the eye track back to the left margin. A ratio of 1.5 works well for narrow
        columns; wider measures might need 1.7 or even 1.8. The current line height is{" "}
        <code style={code}>{lineHeight}</code>, which at {fontSize}px font size produces{" "}
        {Math.round(fontSize * lineHeight)}px of total line height.
      </p>

      <hr style={hr} />

      {/* Mixed content section */}
      <h2 style={h2}>Putting It All Together</h2>

      <p style={p}>
        A well-configured font system has four distinct roles working in harmony. The{" "}
        <strong>heading font</strong> establishes personality and hierarchy. The{" "}
        <strong>body font</strong> carries the reader through extended prose. The{" "}
        <strong>UI font</strong> handles interface chrome - buttons, labels, metadata, navigation.
        The <strong>monospace font</strong> renders code and technical content with precision.
      </p>

      <p style={p}>
        The test of a good system is that you can change any single role without breaking the
        others. Swap the heading from a serif to a display sans? The body text, code blocks, and
        buttons should all still feel coherent. That's the power of systematic thinking applied
        to typography.
      </p>

      {/* Table */}
      <div
        style={{
          overflowX: "auto",
          margin: "24px 0",
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: uiFamily,
            fontSize: fontSize * 0.78,
          }}
        >
          <thead>
            <tr style={{ background: theme.bgWarm }}>
              {["Role", "Category", "Current Selection", "Size"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 16px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: theme.fgMuted,
                    fontSize: fontSize * 0.68,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    borderBottom: `1px solid ${theme.border}`,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Heading", "Serif / Display", headingFamily, `${Math.round(fontSize * 2.2)}px`],
              ["Body", "Serif / Sans", bodyFamily, `${fontSize}px`],
              ["UI", "Sans-serif", uiFamily, `${Math.round(fontSize * 0.78)}px`],
              ["Code", "Monospace", monoFamily, `${Math.round(fontSize * 0.82)}px`],
            ].map(([role, cat, fam, sz], i) => (
              <tr
                key={role}
                style={{
                  borderBottom: i < 3 ? `1px solid ${theme.border}` : "none",
                }}
              >
                <td style={{ padding: "10px 16px", fontWeight: 600, color: theme.fg }}>{role}</td>
                <td style={{ padding: "10px 16px", color: theme.fgLight }}>{cat}</td>
                <td
                  style={{
                    padding: "10px 16px",
                    fontFamily: fam,
                    color: theme.fg,
                  }}
                >
                  {fam.split(",")[0].replace(/'/g, "")}
                </td>
                <td
                  style={{
                    padding: "10px 16px",
                    fontFamily: monoFamily,
                    fontSize: fontSize * 0.75,
                    color: theme.fgMuted,
                  }}
                >
                  {sz}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sans-serif long-form section */}
      <h2 style={h2}>When Sans-Serif Carries the Prose</h2>

      <p
        style={{
          fontFamily: uiFamily,
          fontSize,
          lineHeight,
          color: theme.fgLight,
          margin: "0 0 18px 0",
        }}
      >
        There is a growing school of thought that sans-serifs work just as well for long-form
        reading as serifs do - provided the typeface was designed for it. Fonts like{" "}
        <strong>Atkinson Hyperlegible</strong> were explicitly engineered for extended reading,
        with exaggerated letter differentiation and generous spacing. Others like{" "}
        <strong>Literata</strong>, originally commissioned for Google Play Books, blur the line
        between serif and sans with their soft, approachable forms.
      </p>

      <p
        style={{
          fontFamily: uiFamily,
          fontSize,
          lineHeight,
          color: theme.fgLight,
          margin: "0 0 18px 0",
        }}
      >
        This entire section is set in the <strong>UI / sans-serif font</strong> at body size.
        Compare it to the serif paragraphs elsewhere in this article. Notice the differences in
        texture, in the "color" of the text block as a whole. The serif creates a busier, more
        varied texture with its thick-thin stroke modulation. The sans-serif produces a more
        uniform, quieter field of gray. Neither is objectively better - it depends on what mood
        and reading experience you want to create.
      </p>

      <p
        style={{
          fontFamily: uiFamily,
          fontSize,
          lineHeight,
          color: theme.fgLight,
          margin: "0 0 18px 0",
        }}
      >
        Matthew Butterick, in <em>Practical Typography</em>, argues that the serif vs. sans debate
        is largely settled: both work fine for body text if the font is well-designed. What matters
        more is line length, line spacing, and font size. A beautiful serif at 10px with 1.2
        line-height on a 100-character line will be harder to read than a mediocre sans at 16px
        with 1.7 line-height on a 65-character line. The variables that surround the font matter
        as much as the font itself.
      </p>

      {/* Side-by-side serif vs sans comparison */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          margin: "24px 0",
        }}
      >
        <div
          style={{
            background: theme.bgWarm,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: "20px",
          }}
        >
          <div style={{ ...uiLabel, marginBottom: 12 }}>Serif (Body Font)</div>
          <p
            style={{
              fontFamily: bodyFamily,
              fontSize: fontSize * 0.9,
              lineHeight: lineHeight,
              color: theme.fgLight,
              margin: 0,
            }}
          >
            The quick brown fox jumps over the lazy dog. Sphinx of black quartz, judge my vow.
            Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump. The five
            boxing wizards jump quickly.
          </p>
        </div>
        <div
          style={{
            background: theme.bgWarm,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: "20px",
          }}
        >
          <div style={{ ...uiLabel, marginBottom: 12 }}>Sans-Serif (UI Font)</div>
          <p
            style={{
              fontFamily: uiFamily,
              fontSize: fontSize * 0.9,
              lineHeight: lineHeight,
              color: theme.fgLight,
              margin: 0,
            }}
          >
            The quick brown fox jumps over the lazy dog. Sphinx of black quartz, judge my vow.
            Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump. The five
            boxing wizards jump quickly.
          </p>
        </div>
      </div>

      <hr style={hr} />

      <p style={p}>
        Typography is never finished. Every new piece of content, every design context, every
        screen size demands reconsideration. The best typographers are not the ones who find the
        perfect font - they are the ones who never stop looking.
      </p>

      {/* Footer */}
      <div
        style={{
          marginTop: 48,
          paddingTop: 24,
          borderTop: `1px solid ${theme.border}`,
          fontFamily: uiFamily,
          fontSize: fontSize * 0.72,
          color: theme.fgMuted,
          lineHeight: 1.6,
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <strong style={{ color: theme.fgLight }}>Font Stack</strong>
        </div>
        <div>
          Heading: <span style={{ fontFamily: headingFamily, color: theme.fgLight }}>{headingFamily.split(",")[0].replace(/'/g, "")}</span>
          {" / "}
          Body: <span style={{ fontFamily: bodyFamily, color: theme.fgLight }}>{bodyFamily.split(",")[0].replace(/'/g, "")}</span>
          {" / "}
          UI: <span style={{ fontFamily: uiFamily, color: theme.fgLight }}>{uiFamily.split(",")[0].replace(/'/g, "")}</span>
          {" / "}
          Mono: <span style={{ fontFamily: monoFamily, color: theme.fgLight }}>{monoFamily.split(",")[0].replace(/'/g, "")}</span>
        </div>
      </div>
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Harness
   ═══════════════════════════════════════════════════════════════════════════ */

function TypographyLab() {
  const [headingFont, setHeadingFont] = useState("Libre Caslon Display");
  const [bodyFont, setBodyFont] = useState("Libre Caslon Text");
  const [uiFont, setUiFont] = useState("Open Sans");
  const [monoFont, setMonoFont] = useState("JetBrains Mono");
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.75);
  const [maxWidth, setMaxWidth] = useState(72);
  const [themeName, setThemeName] = useState<keyof typeof THEMES>("paper");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const theme = THEMES[themeName];

  const findFont = useCallback(
    (name: string) => FONTS.find((f) => f.name === name),
    []
  );

  // Load fonts on selection change
  useEffect(() => {
    [headingFont, bodyFont, uiFont, monoFont].forEach((name) => {
      const font = findFont(name);
      if (font) loadGoogleFont(font);
    });
  }, [headingFont, bodyFont, uiFont, monoFont, findFont]);

  // Load bundled fonts on mount
  useEffect(() => {
    loadBundledFonts();
    // Pre-load the initial Google fonts
    FONTS.forEach((f) => {
      if (f.googleUrl) loadGoogleFont(f);
    });
  }, []);

  const applyPreset = useCallback((preset: Preset) => {
    setHeadingFont(preset.heading);
    setBodyFont(preset.body);
    setUiFont(preset.ui);
    setMonoFont(preset.mono);
  }, []);

  const headingFamily = findFont(headingFont)?.family ?? "serif";
  const bodyFamily = findFont(bodyFont)?.family ?? "serif";
  const uiFamily = findFont(uiFont)?.family ?? "sans-serif";
  const monoFamily = findFont(monoFont)?.family ?? "monospace";

  const sidebarWidth = sidebarCollapsed ? 48 : 300;

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: theme.bg,
        transition: "background 0.3s ease",
      }}
    >
      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside
        style={{
          width: sidebarWidth,
          flexShrink: 0,
          background: theme.bgWarm,
          borderRight: `1px solid ${theme.border}`,
          overflow: "hidden",
          transition: "width 0.25s ease",
          position: "sticky",
          top: 0,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Sidebar header */}
        <div
          style={{
            padding: sidebarCollapsed ? "16px 12px" : "20px 24px 16px",
            borderBottom: `1px solid ${theme.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: sidebarCollapsed ? "center" : "space-between",
            flexShrink: 0,
          }}
        >
          {!sidebarCollapsed && (
            <div>
              <div
                style={{
                  fontFamily: uiFamily,
                  fontSize: 13,
                  fontWeight: 700,
                  color: theme.fg,
                  letterSpacing: "-0.01em",
                }}
              >
                Typography Lab
              </div>
              <div
                style={{
                  fontFamily: uiFamily,
                  fontSize: 11,
                  color: theme.fgMuted,
                  marginTop: 2,
                }}
              >
                Font system experiment
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: theme.fgMuted,
              fontSize: 16,
              lineHeight: 1,
            }}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? "\u25B6" : "\u25C0"}
          </button>
        </div>

        {/* Sidebar content */}
        {!sidebarCollapsed && (
          <div
            style={{
              padding: "20px 24px",
              overflowY: "auto",
              flex: 1,
            }}
          >
            {/* Theme selector */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: theme.fgMuted,
                  marginBottom: 8,
                }}
              >
                Theme
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                {(Object.keys(THEMES) as Array<keyof typeof THEMES>).map((t) => (
                  <button
                    key={t}
                    onClick={() => setThemeName(t)}
                    style={{
                      flex: 1,
                      padding: "6px 0",
                      fontSize: 11,
                      fontFamily: uiFamily,
                      fontWeight: themeName === t ? 600 : 400,
                      background: themeName === t ? theme.accent : "transparent",
                      color: themeName === t ? "#fff" : theme.fgLight,
                      border: `1px solid ${themeName === t ? theme.accent : theme.border}`,
                      borderRadius: 4,
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Presets */}
            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: theme.fgMuted,
                  marginBottom: 8,
                }}
              >
                Presets
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {PRESETS.map((preset) => {
                  const isActive =
                    preset.heading === headingFont &&
                    preset.body === bodyFont &&
                    preset.ui === uiFont &&
                    preset.mono === monoFont;
                  return (
                    <button
                      key={preset.label}
                      onClick={() => applyPreset(preset)}
                      style={{
                        padding: "8px 12px",
                        fontSize: 12,
                        fontFamily: "inherit",
                        textAlign: "left",
                        background: isActive ? theme.selection : "transparent",
                        color: isActive ? theme.accent : theme.fgLight,
                        border: `1px solid ${isActive ? theme.accent + "44" : "transparent"}`,
                        borderRadius: 5,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 1 }}>{preset.label}</div>
                      <div style={{ fontSize: 10, color: theme.fgMuted, lineHeight: 1.3 }}>
                        {preset.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div
              style={{
                height: 1,
                background: theme.border,
                margin: "0 0 20px 0",
              }}
            />

            {/* Font pickers */}
            <FontPicker
              label="Heading Font"
              value={headingFont}
              onChange={setHeadingFont}
              categories={["serif", "display", "sans"]}
              theme={theme}
            />
            <FontPicker
              label="Body Font"
              value={bodyFont}
              onChange={setBodyFont}
              categories={["serif", "sans"]}
              theme={theme}
            />
            <FontPicker
              label="UI Font"
              value={uiFont}
              onChange={setUiFont}
              categories={["sans"]}
              theme={theme}
            />
            <FontPicker
              label="Monospace Font"
              value={monoFont}
              onChange={setMonoFont}
              categories={["mono"]}
              theme={theme}
            />

            {/* Divider */}
            <div
              style={{
                height: 1,
                background: theme.border,
                margin: "8px 0 20px 0",
              }}
            />

            {/* Size controls */}
            <Slider
              label="Font Size"
              value={fontSize}
              min={12}
              max={24}
              step={1}
              unit="px"
              onChange={setFontSize}
              theme={theme}
            />
            <Slider
              label="Line Height"
              value={lineHeight}
              min={1.2}
              max={2.2}
              step={0.05}
              unit=""
              onChange={setLineHeight}
              theme={theme}
            />
            <Slider
              label="Max Width"
              value={maxWidth}
              min={40}
              max={120}
              step={4}
              unit="ch"
              onChange={setMaxWidth}
              theme={theme}
            />
          </div>
        )}
      </aside>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          padding: "60px 48px 120px",
          minWidth: 0,
          overflowX: "hidden",
        }}
      >
        <Article
          headingFamily={headingFamily}
          bodyFamily={bodyFamily}
          uiFamily={uiFamily}
          monoFamily={monoFamily}
          fontSize={fontSize}
          lineHeight={lineHeight}
          maxWidth={`${maxWidth}ch`}
          theme={theme}
        />
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Mount
   ═══════════════════════════════════════════════════════════════════════════ */

const root = createRoot(document.getElementById("root")!);
root.render(<TypographyLab />);
