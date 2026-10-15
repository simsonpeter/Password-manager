import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, Source_Sans_3 } from "next/font/google";
import { Toaster } from "sonner";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { VaultProvider } from "@/components/providers/vault-provider";
import "./globals.css";

const sans = Source_Sans_3({ subsets: ["latin"], variable: "--font-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "AccessVault",
  description: "Secure client access code manager for delivery operations.",
  applicationName: "AccessVault",
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "AccessVault", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-180.png" },
};

export const viewport: Viewport = {
  themeColor: "#0B1F3A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} font-sans antialiased`}>
        <VaultProvider>
          {children}
          <PwaRegister />
        </VaultProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
