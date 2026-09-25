import type { Metadata } from "next";
import { Fraunces, Open_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Site-wide typefaces: Fraunces for display/headings, Open Sans for body
// copy (regular + bold). These stand in for "Saudi Serif"/"Saudi Sans" from
// the brand guidelines until the user provides those proprietary font
// files — see PROJECT_NOTES.md.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: "variable",
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Saudi Experience Labs",
  description: "Idea pipeline platform for the Experience Labs",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${openSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
