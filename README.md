Pickled Citizens

A modern pickleball platform for game setup, league management, and player coordination. Built as a full-stack demo project showing practical UI, auth, and admin workflows.

Features
	•	Player account creation via email
	•	Admin role upgrade for league management
	•	Admin invites for players
	•	Event creation with RSVP limits and details
	•	Member dashboards to view upcoming sessions and registrations
	•	Clean, scalable project structure for future expansion

Tech Stack
	•	Next.js 14 (App Router)
	•	TypeScript
	•	Supabase Auth + Database
	•	Tailwind CSS
	•	Netlify (deployment)
	•	Windsurf (AI-assisted development)

Getting Started

1. Install dependencies

npm install

2. Set up environment variables

Create a .env.local file with:

NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role

3. Run locally

npm run dev

App runs at http://localhost:3000.

Project Structure

/app
  /auth
  /dashboard
  /admin
/components
/lib
/styles

Roadmap
	•	Player stats and match history
	•	Automated tournament templates
	•	Mobile-friendly UI overhaul
	•	Payment integration for league fees

License

MIT

Links
	•	Live Site: deployed on Netlify
	•	Source Code: this repo
