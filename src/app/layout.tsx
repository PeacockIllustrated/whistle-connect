import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Whistle Connect | Book Referees Fast",
  description: "The grassroots football operations app. Book referees, manage availability, and communicate seamlessly.",
  keywords: ["football", "referee", "booking", "grassroots", "soccer"],
  icons: {
    icon: [
      { url: "/assets/icon-lightblue.svg", type: "image/svg+xml" },
    ],
    apple: "/assets/icon-lightblue.svg",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Suspense fallback={null}>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </Suspense>
      </body>
    </html>
  );
}
