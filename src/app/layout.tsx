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

export const metadata: Metadata = {
  title: "Crado",
  description: "Regulation, inside the engineering loop.",
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
