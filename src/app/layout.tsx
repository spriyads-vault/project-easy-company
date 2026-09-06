import type { Metadata } from "next";
import { IBM_Plex_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/design/theme-provider";

// Enterprise UI Revamp (App Redesign): IBM Plex Sans across the
// authenticated application, self-hosted at build time via next/font/google
// (no runtime request to Google Fonts). Only the weights the product
// actually uses — 400/500/600 — normal style, swap so text is never
// invisible while the font loads.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: "normal",
  display: "swap",
  fallback: ["Arial", "Helvetica", "sans-serif"],
});

// Technical monospace (frequencies, margins, IDs, tool names, durations,
// timestamps) — kept as the already-self-hosted Geist Mono per the
// ticket's own instruction ("use the existing technical monospace font...
// only if [IBM Plex Mono is] already available" — it isn't, so this stays).
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Favicon/metadata ticket. This is the signed-in console, not the
// marketing site — everything here (robots, description) is written
// for a private application, not a page meant to be found/indexed.
// Do not reuse this file's shape for a public marketing page (or vice
// versa): the two have opposite indexing intent by design.
//
// Description stays within CLAUDE.md's product-truth constraints:
// factual, radiated-emissions-scoped, no pass/certified/guaranteed/
// root-cause language, no standards-coverage claim.
const DESCRIPTION =
  "Crado helps hardware engineering teams investigate radiated-emissions test failures by connecting measurements, product context and design changes into one evidence-linked record.";

export const metadata: Metadata = {
  metadataBase: new URL("https://console.crado.io"),
  title: {
    template: "%s · Crado",
    default: "Crado",
  },
  description: DESCRIPTION,
  // Signed-in application — never indexed. See robots.ts for the
  // matching /robots.txt disallow-all.
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    // Next's own documented pattern for a light/dark favicon pair: a
    // default entry with no media (matches unless overridden) plus a
    // dark-scheme-specific override declared after it. Both live in
    // public/ rather than the app/icon.png file convention — that
    // convention only auto-merges into <head> when metadata.icons is
    // left unset entirely (verified in next's own resolve-metadata.js);
    // since a dark-mode override requires setting metadata.icons
    // explicitly, the file-convention icon would silently stop being
    // included, so both variants are declared here instead where
    // that's not a risk.
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/icon-dark.png", type: "image/png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
  openGraph: {
    title: "Crado",
    description: DESCRIPTION,
    siteName: "Crado",
    type: "website",
    url: "https://console.crado.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "Crado",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Blocking, dependency-free: applies the persisted theme choice
            to <html> before first paint so a returning dark-mode user
            never sees a flash of the light default. See
            src/lib/design/theme-provider.tsx. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
