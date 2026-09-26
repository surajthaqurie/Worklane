import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/shared/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Worklane",
  description: "Azure Boards-inspired project management platform for high-performance teams.",
};

const themeScript = `(function(){try{var t=localStorage.getItem("worklane-theme")||localStorage.getItem("worklane_theme");var resolved=t==="light"||t==="dark"?t:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var root=document.documentElement;root.classList.remove("light","dark");root.classList.add(resolved);if(resolved==="dark"){root.style.backgroundColor="#09090b";root.style.colorScheme="dark"}else{root.style.backgroundColor="#f9fafb";root.style.colorScheme="light"}}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: themeScript,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col font-sans bg-[var(--bg-app)] text-[var(--text-primary)]"
      >
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
