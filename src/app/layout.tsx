import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Oswald, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// Document template fonts — self-hosted by next/font so they are embedded in
// the Puppeteer-generated PDF, not just the on-screen preview.
const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-oswald",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Steelman Billing",
  description:
    "Invoice & Quotation platform for Steelman Fabrication & Aluminium Windows Works",
};

// Explicit, accessible viewport (device width, user zoom kept enabled).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Set the theme class before hydration to avoid a flash of the wrong theme.
const themeInit = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${oswald.variable} ${plexMono.variable} font-sans`}>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
