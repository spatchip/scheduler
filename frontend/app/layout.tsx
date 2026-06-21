import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Scheduler",
  description: "Generalized staff booking and scheduling application",
  icons: {
    icon: "/favicon.ico",
  },
};

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/staff", label: "Staff" },
  { href: "/book", label: "Book Now" },
  { href: "/login", label: "Trainer Login" },
  { href: "/dashboard", label: "Trainer Dashboard" },
  { href: "/schedule", label: "Schedule" },
  { href: "/bookings", label: "Bookings" },
];

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
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-black dark:bg-white flex items-center justify-center">
                <span className="text-white dark:text-black font-semibold text-lg tracking-tighter">S</span>
              </div>
              <div>
                <div className="font-semibold tracking-tight text-xl">Scheduler</div>
                <div className="text-[10px] text-zinc-500 -mt-1">Staff Booking &amp; Scheduling</div>
              </div>
            </div>

            <nav className="flex items-center gap-1 text-sm font-medium">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3 text-sm">
              <div className="hidden sm:block text-zinc-500">Local • PostgreSQL</div>
              <a
                href="http://localhost:3001/api/health"
                target="_blank"
                className="px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-xs font-mono"
              >
                API
              </a>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
          {children}
        </main>

        <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6 text-center text-xs text-zinc-500">
          Generalized staff booking &amp; scheduling demo • Next.js + Express + PostgreSQL
        </footer>
      </body>
    </html>
  );
}
