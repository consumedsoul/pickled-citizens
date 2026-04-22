import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { Inter, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import favicon from "./images/Pickled-Citizens-Logo-Favicon.png";
import { AuthStatus } from "@/components/AuthStatus";
import { Navigation } from "@/components/Navigation";
import { AdminFooterLinks } from "@/components/AdminFooterLinks";
import { BuildVersion } from "@/components/BuildVersion";
import { FAQ_ITEMS } from "@/lib/faq";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pickledcitizens.com';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

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
    url: siteUrl,
    siteName: "Pickled Citizens",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: `${siteUrl}/images/Pickled-Citizens-Logo-Social.png`,
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
    images: [`${siteUrl}/images/Pickled-Citizens-Logo-Social.png`],
  },
};

const softwareAppJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Pickled Citizens',
  applicationCategory: 'SportsApplication',
  description:
    'Lightweight pickleball league management tool for scheduling sessions, generating balanced teams, and tracking match history.',
  url: 'https://pickledcitizens.com',
  featureList: [
    'Balanced team generation with DUPR ratings',
    'League creation and member management',
    'Session scheduling with 6, 8, 10, or 12-player support',
    'Match result tracking with win/loss statistics',
  ],
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const year = new Date().getFullYear();
  const nonce = headers().get('x-nonce') ?? undefined;
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${ibmPlexMono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }}
        />
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      </head>
      <body className="font-sans">
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-app-border bg-white">
            <div className="max-w-app mx-auto px-6 py-4 flex items-center justify-between md:flex-row flex-col md:gap-0 gap-3">
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/images/Pickled-Citizens-Logo-Site.png"
                  alt="Pickled Citizens logo"
                  width={50}
                  height={30}
                  unoptimized
                  priority
                  quality={100}
                />
                <span className="font-mono text-xs uppercase tracking-label font-semibold text-app-text hidden md:inline">
                  Pickled Citizens
                </span>
              </Link>
              <div className="flex items-center gap-6 md:flex-row flex-col md:w-auto w-full">
                <Navigation />
                <AuthStatus />
              </div>
            </div>
          </header>
          <main className="flex-1 max-w-app mx-auto px-6 py-8 w-full">{children}</main>
          <footer className="border-t border-app-border mt-8">
            <div className="max-w-app mx-auto px-6 py-6 flex items-center justify-between flex-wrap gap-4">
              <span className="font-mono text-[0.65rem] uppercase tracking-label text-app-muted">
                {year} Pickled Citizens<BuildVersion />
              </span>
              <AdminFooterLinks />
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
