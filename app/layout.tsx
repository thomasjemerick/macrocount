import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MacroCount — 459 Macronutrient Calculator",
  description:
    "Pick dining-hall items, set servings (including partials), and get instant macros. Filter by station, compare items, and see top protein picks.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Prevent SSR/CSR mismatches from extensions injecting data-* attrs */}
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
