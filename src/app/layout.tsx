import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeToggle, themeScript } from "@/components/ThemeToggle";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Weekly Walkthrough",
  description: "Weekly photo walkthrough for venue leaders.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f1f1ef",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // The theme script stamps data-theme before hydration, so <html> is
      // deliberately different from what the server rendered.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Runs before paint so the saved theme is applied without a flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        {/* Phone-first, but leaders and admin both use laptops — let the grids
            breathe on a wide screen instead of pinning everything to a column. */}
        <div className="mx-auto min-h-dvh w-full max-w-3xl px-4 pt-8 pb-20 lg:max-w-6xl lg:px-8">
          {children}
        </div>
        <ThemeToggle />
      </body>
    </html>
  );
}
