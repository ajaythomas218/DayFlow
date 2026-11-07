import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0F172A",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://dayflow.app"),
  title: {
    template: "%s | DayFlow",
    default: "DayFlow — Your Personal Life & Productivity OS",
  },
  description: "Everything in flow. Master your personal productivity ecosystem with unified tasks, calendar time-blocking, durable multi-channel reminders, and daily reflection.",
  applicationName: "DayFlow",
  keywords: [
    "productivity",
    "personal os",
    "task manager",
    "time blocking",
    "calendar sync",
    "daily diary",
    "weekly review",
    "dayflow",
  ],
  authors: [{ name: "DayFlow Team" }],
  creator: "DayFlow",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-icon.svg", type: "image/svg+xml" },
    ],
  },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://dayflow.app",
    siteName: "DayFlow",
    title: "DayFlow — Your Personal Life & Productivity OS",
    description: "Everything in flow. Unified tasks, calendar time-blocking, reminders, and daily reflection.",
  },
  twitter: {
    card: "summary_large_image",
    title: "DayFlow — Your Personal Life & Productivity OS",
    description: "Everything in flow. Unified tasks, calendar time-blocking, reminders, and daily reflection.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#0F172A] text-white">
        {children}
      </body>
    </html>
  );
}
