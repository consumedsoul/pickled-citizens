export const FAQ_ITEMS = [
  {
    q: "How does Pickled Citizens generate balanced teams?",
    a: "Players are sorted by their self-reported DUPR rating and distributed across teams using a snaking algorithm, so the combined DUPR of each team is as close as possible. For 8-player sessions, the tool generates 6 rounds (12 games) with controlled matchup repetition to maximize court time.",
  },
  {
    q: "What is DUPR and how does this app use it?",
    a: "DUPR (Dynamic Universal Pickleball Rating) is a skill rating on a 1.0–8.5 scale. Each player enters their self-reported DUPR in their profile, and Pickled Citizens uses those ratings to balance teams and matchups. A live DUPR API integration is planned.",
  },
  {
    q: "How many players per session are supported?",
    a: "Sessions support exactly 6, 8, 10, or 12 players. The matchup generator produces a schedule of doubles matches that gives every player roughly equal court time.",
  },
  {
    q: "Who can schedule sessions in a league?",
    a: "Only league admins can create sessions. Any player who participates in a session can view it read-only in their session history. The league creator is automatically promoted to admin, and admins can promote other members.",
  },
  {
    q: "Is Pickled Citizens free?",
    a: "Yes. Pickled Citizens is a free tool for recreational pickleball leagues. It is hosted on Cloudflare Workers with a Supabase backend.",
  },
] as const;
