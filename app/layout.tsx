import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Lato } from "next/font/google";

export const metadata: Metadata = {
  title: "Art Society Scorer",
  description: "Minimalist, mobile-first scoring app for Art Society",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#FAF7F0",
  userScalable: false,
};

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--ff-serif",
});

const sans = Lato({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700", "900"],
  variable: "--ff-sans",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-left-handed="false" data-palette="default">
      <head />
      <body className={`${serif.variable} ${sans.variable}`}>
        <div className="container">
          {children}
        </div>
      </body>
    </html>
  );
}