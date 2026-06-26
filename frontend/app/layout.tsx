import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import LivingBackground from "@/components/LivingBackground";
import MouseGlow from "@/components/MouseGlow";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AbortErrorSilencer from "@/components/AbortErrorSilencer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SmartPick — Stop Comparing. Start Deciding.",
  description:
    "AI searches retailers, analyzes reviews, and recommends the best option for you.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AbortErrorSilencer />
        <LivingBackground />
        <MouseGlow />
        <Navbar />
        <div className="relative z-10 flex-1 flex flex-col">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
