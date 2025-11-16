"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface HomeAuthState {
  loading: boolean;
  email: string | null;
}

export default function HomePage() {
  const [auth, setAuth] = useState<HomeAuthState>({ loading: true, email: null });

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      setAuth({ loading: false, email: data.user?.email ?? null });
    }

    loadUser();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setAuth({ loading: false, email: session?.user?.email ?? null });
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const showCtas = !auth.loading && !auth.email;

  return (
    <section className="hero">
      <div>
        <h1 className="hero-title">Pickled Citizens</h1>
        <p className="hero-subtitle">
          Pickled Citizens is a free, lightweight web app for setting up team
          battle matchups for your league's pickleball sessions.
        </p>
        {showCtas && (
          <div className="hero-actions">
            <a href="/auth" className="btn-primary">
              Get started (sign up)
            </a>
            <a href="/auth/signin" className="btn-secondary">
              Sign in
            </a>
          </div>
        )}
      </div>

      <div className="section">
        <h2 className="section-title">v1.0.0 Release</h2>
        <p>
          <strong>Release highlights</strong>
        </p>
        <ul className="section-list">
          <li>
            <strong>Email-based signup &amp; profiles</strong>
            <br />
            Magic-link auth via Supabase, with profiles that capture name,
            gender, and self-reported DUPR.
          </li>
          <li>
            <strong>League creation &amp; roster management</strong>
            <br />
            Create leagues with duplicate-name protection, add authenticated
            players, and view member details in one place.
          </li>
          <li>
            <strong>Session scheduling &amp; balanced matchups</strong>
            <br />
            Schedule sessions for 6, 8, 10, or 12 players and auto-generate
            balanced doubles matchups using a snaking algorithm.
          </li>
          <li>
            <strong>Score entry &amp; player stats</strong>
            <br />
            Quickly record results, view team records and per-player win/loss,
            and maintain session history.
          </li>
        </ul>
      </div>
    </section>
  );
}
