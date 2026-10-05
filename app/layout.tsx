import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Handle Hub — Username availability across platforms",
  description:
    "Check a handle once across gaming platforms and social networks. Instant availability for Steam, Xbox, PSN, Twitch, Discord, X, Instagram, TikTok, Reddit, YouTube, and more.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} min-h-screen`}>{children}</body>
    </html>
  );
}
