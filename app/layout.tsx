import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata = {
  title: "Atlas",
  icons: {
    icon: "/favicon.svg",
  },
};

export const metadata: Metadata = {
  title: "Geopolitical Market Intelligence",
  description:
    "A geopolitical news and market-context dashboard for short- and long-horizon analysis.",
  other: { "codex-preview": "development" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0c1523",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}