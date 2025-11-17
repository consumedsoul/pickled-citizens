import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import menuLogo from "./images/Pickled-Citizens-Logo-Site.png";
import favicon from "./images/Pickled-Citizens-Logo-Favicon.png";
import { AuthStatus } from "@/components/AuthStatus";
import { Navigation } from "@/components/Navigation";
import { AdminFooterLinks } from "@/components/AdminFooterLinks";

export const metadata = {
  title: "Pickled Citizens",
  description:
    "Lightweight pickleball league tool for scheduling sessions and tracking match history.",
  icons: {
    icon: favicon.src,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const year = new Date().getFullYear();
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header className="app-header">
            <div className="app-header-inner">
              <Link href="/" className="app-logo">
                <Image
                  src={menuLogo}
                  alt="Pickled Citizens logo"
                  width={40}
                  height={40}
                  priority
                  quality={100}
                  style={{
                    height: "40px",
                    width: "auto",
                  }}
                />
              </Link>
              <div className="app-header-right">
                <Navigation />
                <AuthStatus />
              </div>
            </div>
          </header>
          <main className="app-main">{children}</main>
          <footer className="app-footer">
            <div
              style={{
                display: "flex",
                width: "100%",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              <span>{`Copyright ${year} Pickled Citizens | All Rights Reserved`}</span>
              <AdminFooterLinks />
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

