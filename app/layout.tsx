import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SignOutButton } from "@/components/SignOutButton";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Story Forge",
  description: "AI-powered user story generator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col bg-zinc-950 text-zinc-100">
        <header className="border-b border-zinc-800 px-6 h-12 flex items-center justify-between shrink-0 bg-zinc-950">
          <a href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-white">
            <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-violet-600">
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M13 2L4.09 12.97H11L10 22L20.91 11.03H14L13 2Z" />
              </svg>
            </span>
            Story Forge
          </a>
          <div className="flex items-center gap-5">
            <a
              href="/jira"
              className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              JIRA Settings
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
              </svg>
            </a>
            <SignOutButton />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
