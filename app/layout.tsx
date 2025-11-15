import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import logo from "./images/PKLDCTZN_web_logo.png";
import { AuthStatus } from "@/components/AuthStatus";

export const metadata = {
  title: "PickledCitizens 2.0",
  description:
    "Lightweight pickleball league tool for scheduling sessions and tracking match history.",
  icons: {
    icon: logo.src,
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
                  src={logo}
                  alt="PickledCitizens logo"
                  width={32}
                  height={32}
                  style={{
                    height: "32px",
                    width: "auto",
                  }}
                />
              </Link>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <nav className="app-nav">
                  <Link href="/leagues">Leagues</Link>
                  <Link href="/sessions">Sessions</Link>
                  <Link href="/history">History</Link>
                  <Link href="/profile">Profile</Link>
                </nav>
                <AuthStatus />
              </div>
            </div>
          </header>
          <main className="app-main">{children}</main>
          <footer className="app-footer">
            {`Copyright ${year} Pickled Citizens | All Rights Reserved`}
          </footer>
        </div>
      </body>
    </html>
  );
}

