import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import favicon from "./images/Pickled-Citizens-Logo-Favicon.png";
import { AuthStatus } from "@/components/AuthStatus";
import { Navigation } from "@/components/Navigation";
import { AdminFooterLinks } from "@/components/AdminFooterLinks";

export const metadata = {
  title: "Pickled Citizens - Pickleball Team Battle Management Tool",
  description:
    "Lightweight pickleball league tool for scheduling sessions, tracking match history, and managing player rankings. Create leagues, organize games, and track your DUPR ratings.",
  icons: {
    icon: favicon.src,
  },
  openGraph: {
    title: "Pickled Citizens - Pickleball Team Battle Management Tool",
    description: "Lightweight pickleball league tool for scheduling sessions, tracking match history, and managing player rankings. Create leagues, organize games, and track your DUPR ratings.",
    url: "https://pickledcitizens.com",
    siteName: "Pickled Citizens",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: 'https://pickledcitizens.com/images/Pickled-Citizens-Logo-Social.png',
        width: 1200,
        height: 630,
        alt: 'Pickled Citizens Logo',
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pickled Citizens - Pickleball Team Battle Management Tool",
    description: "Lightweight pickleball league tool for scheduling sessions, tracking match history, and managing player rankings. Create leagues, organize games, and track your DUPR ratings.",
    images: ['https://pickledcitizens.com/images/Pickled-Citizens-Logo-Social.png'],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const year = new Date().getFullYear();
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-app-border backdrop-blur-[10px] bg-app-bg-alt">
            <div className="max-w-app mx-auto px-6 py-3 flex items-center justify-between md:flex-row flex-col md:gap-0 gap-2">
              <Link href="/" className="font-semibold tracking-wide">
                <Image
                  src="/images/Pickled-Citizens-Logo-Site.png"
                  alt="Pickled Citizens logo"
                  width={66}
                  height={40}
                  unoptimized
                  priority
                  quality={100}
                />
              </Link>
              <div className="flex items-center gap-4 md:flex-row flex-col md:w-auto w-full">
                <Navigation />
                <AuthStatus />
              </div>
            </div>
          </header>
          <main className="flex-1 max-w-app mx-auto px-6 py-6 w-full">{children}</main>
          <footer className="border-t border-app-border px-6 py-3 text-center text-xs text-app-muted">
            <div className="flex w-full items-center justify-between gap-4 flex-wrap">
              <span>{`Copyright ${year} Pickled Citizens | All Rights Reserved`}</span>
              <AdminFooterLinks />
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

