import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Tamil } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import "./styles/newsroom-features.css";
import "./styles/responsive-overrides.css";
import { LanguageProvider } from "./i18n/LanguageProvider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const notoTamil = Noto_Sans_Tamil({ variable: "--font-tamil", subsets: ["tamil"] });

export const metadata: Metadata = {
  title: "ATLAS | World, Entertainment & Sports",
  description: "Live world, entertainment and sports headlines with visual desks, maps and publisher links.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0c1523",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable} ${notoTamil.variable}`}><LanguageProvider>{children}</LanguageProvider></body></html>;
}
