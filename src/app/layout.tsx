import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TimeAgree - Найдите общее свободное время",
  description: "Telegram Mini App для поиска общего свободного времени в группах. Управляйте своим расписанием и находите время для встреч.",
  keywords: ["TimeAgree", "Telegram", "Mini App", "расписание", "встречи", "свободное время"],
  authors: [{ name: "TimeAgree Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "TimeAgree - Найдите общее время",
    description: "Управляйте своим расписанием и находите общее свободное время в группах",
    url: "https://freetime-app-jy3k.vercel.app",
    siteName: "TimeAgree",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TimeAgree - Найдите общее время",
    description: "Telegram Mini App для управления расписанием",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Telegram WebApp SDK - must load before any interaction */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
