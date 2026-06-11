import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AdSenseScript } from "@/components/ads/AdSenseScript";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Metadata + PWA (tarea 8.1). `manifest` enlaza public/manifest.json;
 * `appleWebApp` habilita el modo standalone en iOS (que ignora el manifest) y
 * `icons.apple` apunta al apple-touch-icon PNG.
 */
export const metadata: Metadata = {
  title: "Mundialito",
  description: "Pronostica el Mundial 2026, suma puntos y compite con amigos.",
  applicationName: "Mundialito",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mundialito",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

/** Viewport mobile-first + color de la barra del navegador (tema oscuro). */
export const viewport: Viewport = {
  themeColor: "#0a0a0b",
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
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <AdSenseScript />
        {children}
      </body>
    </html>
  );
}
