import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";

import { CornerMenu } from "@/components/CornerMenu";
import { themeScript } from "@/components/ThemeToggle";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "WKLY > PRGRSS",
  description: "Weekly progress photos for venue leaders.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0b0a",
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
      className={`${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Runs before paint so the saved theme is applied without a flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        {/* Phone-first, but leaders and admin both use laptops — let the grids
            breathe on a wide screen instead of pinning everything to a column. */}
        <div className="mx-auto min-h-dvh w-full max-w-3xl px-4 pt-8 pb-24 lg:max-w-6xl lg:px-8">
          {children}
        </div>
        <CornerMenu />
      </body>
    </html>
  );
}
