export default function HomePage() {
  return (
    <section className="hero">
      <div>
        <h1 className="hero-title">Pickled Citizens</h1>
        <p className="hero-subtitle">
          Lightweight, low-cost pickleball platform for small leagues to create
          structured match sessions, track scores, and keep players out of
          spreadsheets.
        </p>
        <div className="hero-actions">
          <a href="/auth" className="btn-primary">
            Get started (sign up)
          </a>
          <a href="/auth/signin" className="btn-secondary">
            Sign in
          </a>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">What the MVP will do</h2>
        <ul className="section-list">
          <li>User signup via Supabase Auth</li>
          <li>Leagues, invites, and roster management</li>
          <li>Game session generation for 6 / 8 / 10 / 12 players</li>
          <li>Score entry and player match history</li>
        </ul>
      </div>
    </section>
  );
}
