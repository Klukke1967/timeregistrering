import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Timeregistrering",
  description: "Mobil og desktop timeregistrering med Supabase",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Timer",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0F3A2B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da">
      <body className="min-h-screen bg-[#F8FAF9] text-gray-900 selection:bg-forest-100 selection:text-forest-900">
        {children}
      </body>
    </html>
  );
}
