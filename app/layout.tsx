import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ThemeProvider, themeScript } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: {
    default: "Whisk Flow — AI filmmaking & creative studio",
    template: "%s · Whisk Flow",
  },
  description:
    "Shape the story. Direct the frame. Whisk Flow is a cinematic AI studio for generating images, video and storyboards.",
  applicationName: "Whisk Flow",
  authors: [{ name: "Whisk Flow Studio" }],
  keywords: ["AI filmmaking", "AI video", "AI image", "storyboard", "creative studio"],
  openGraph: {
    title: "Whisk Flow — AI filmmaking & creative studio",
    description: "Shape the story. Direct the frame.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f5" },
    { media: "(prefers-color-scheme: dark)", color: "#080809" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
