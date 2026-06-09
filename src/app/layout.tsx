import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryProvider } from "@/providers/query-provider";
import { ChatProvider } from "@/providers/chat-provider";
import { ServiceWorkerRegistration } from "@/components/shared/sw-registration";
import { InstallPrompt } from "@/components/shared/install-prompt";
import { DynamicManifest } from "@/components/shared/dynamic-manifest";
import { PermissionPrompt } from "@/components/shared/permission-prompt";
import { IOSKeyboardFix } from "@/components/pwa/ios-keyboard-fix";
import { Toaster } from "sonner";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const viewport: Viewport = {
  themeColor: "#FB8C00",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-content",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "DeliGO - Pedí lo que quieras",
  description:
    "DeliGO: Pedí comida, ropa y más a tu puerta. La plataforma de delivery y comercio local más rápida.",
  keywords: [
    "DeliGO",
    "delivery",
    "comida",
    "pedidos",
    "restaurantes",
    "comercio local",
    "Argentina",
  ],
  authors: [{ name: "DeliGO" }],
  manifest: "/api/manifest?role=cliente",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-cliente-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icon-cliente-192x192.png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DeliGO",
  },
  openGraph: {
    title: "DeliGO - Pedí lo que quieras",
    description: "La plataforma de delivery y comercio local más rápida.",
    siteName: "DeliGO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DeliGO - Pedí lo que quieras",
    description: "La plataforma de delivery y comercio local más rápida.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${nunito.variable} font-sans antialiased bg-background text-foreground`}>
        <ThemeProvider>
          <QueryProvider>
            <div className="min-h-dvh ios-min-viewport-height flex flex-col">
              <main className="flex-1">{children}</main>
            </div>
            <DynamicManifest />
            <IOSKeyboardFix />
            <ChatProvider />
            <ServiceWorkerRegistration />
            <InstallPrompt />
            <PermissionPrompt />
            <Toaster
              position="top-center"
              richColors
              closeButton
              toastOptions={{
                duration: 3000,
              }}
            />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
