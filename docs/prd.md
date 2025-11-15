# Product Requirements Document (PRD)
**Product:** Pickled Citizens  
**Purpose:** Lightweight, low-cost pickleball platform for league game setup, scheduling, and player history tracking.  
**Owner:** Hun Kim  
**Status:** Draft v0.2

---

## 1. Problem Statement
Pickleball groups still rely on texts, spreadsheets, and manual coordination. There is no simple tool for small leagues to schedule structured match sessions, manage players, and track history without bloated tournament-level features.

Pickled Citizens provides a streamlined platform for:
- League admins to set up games quickly  
- Players to view schedule and history  
- Automated match generation within strict time constraints  

---

## 2. Goals & Non-Goals

### Goals
- Email-based user signup  
- Players can upgrade to admin role  
- Admins create/manage leagues  
- Admins invite players  
- Admins create game sessions  
- Supported formats: 6, 8, 10, 12 players  
- All matches doubles  
- All 12-player games are still Team A vs Team B across 3 courts  
- Sessions must fit within 2 hours  
- Players have match history + lifetime record  
- Entire tech stack stays free or cheap  

### Non-Goals
- Tournament brackets  
- Payments  
- Ratings (Elo, DUPR, etc.)  
- Live scoring  
- Mobile app  
- Public league directories  

---

## 3. Personas

### Player
- Creates account via email  
- Joins leagues via invitation  
- Plays in scheduled sessions  
- Views match history  

### Admin
- Upgraded player  
- Creates leagues  
- Invites players  
- Manages roster  
- Creates sessions  
- Inputs match scores  

---

## 4. Core Features

### 4.1 User Accounts
- Managed through Supabase Auth  
- Basic profile info  
- Roles: Player (default), Admin  

---

### 4.2 League Management (Admin)
- Create league (name, location optional)  
- Invite players via email  
- Players accept via magic link  
- View roster  

---

### 4.3 Game Session Creation

#### Supported Formats  
- **6 players**: 1 court, Doubles, Team A vs Team B  
- **8 players**: 2 courts, Doubles, Team A vs Team B  
- **10 players**: 2 courts, Doubles, Team A vs Team B (requires rotations)  
- **12 players**: 3 courts, Doubles, Team A vs Team B (rotations, simultaneous matches)

#### Constraints
- Entire session fits within 2 hours  
- Each match ≤ 15 minutes  
- Scheduling tries to:  
  - Mix partners  
  - Mix opponents  
  - Reduce sitting time  

#### Requirements
- R1: Admin selects player count (6/8/10/12)  
- R2: Admin selects participating players  
- R3: System generates match schedule  
- R4: Admin may regenerate or edit schedule  
- R5: Players can view schedule  

---

### 4.4 Match Scoring & History

#### Score Entry
Admin enters score_a and score_b per match.

#### Player History
Each match stores:
- Date  
- Session  
- Court  
- Partner  
- Opponents  
- Score  
- Result (win/loss)  

#### Requirements
- R6: Admin enters score  
- R7: Scores are locked unless admin overrides  
- R8: Players can view their history and lifetime stats  

---

## 5. System Requirements

### Tech Stack
- Frontend: React or Next.js  
- Backend: Supabase (Auth + Postgres + RLS)  
- Hosting: Netlify free tier  
- Repository: GitHub  

---

## 6. Data Model

### users  
- id  
- email  
- name  
- role  
- created_at  

### leagues  
- id  
- name  
- created_by  
- created_at  

### league_members  
- id  
- league_id  
- user_id  
- role (player/admin)  
- status (invited/active)  

### sessions  
- id  
- league_id  
- date  
- format (6/8/10/12)  
- created_at  

### matches  
- id  
- session_id  
- court_number  
- team_a_player1  
- team_a_player2  
- team_b_player1  
- team_b_player2  
- score_a  
- score_b  
- created_at  

---

## 7. UX Flows

### Signup
1. User enters email  
2. Supabase sends magic link  
3. User signs in  

### League Creation
1. Admin creates league  
2. Admin invites players  
3. Players accept and appear in roster  

### Session Setup
1. Admin selects format  
2. Admin selects active players  
3. System generates schedule  

### Match Day
1. Teams play through rounds  
2. Admin enters scores  

### Player View
1. See past matches  
2. See lifetime record  

---

## 8. MVP Scope

### Must Have
- User accounts  
- Leagues  
- Player invites  
- Game session creation  
- Basic match generator  
- Score entry  
- Match history  
- Stats summary  

### Future
- Player availability  
- Ratings  
- Mobile wrapper  
- Payments  
- Advanced rotation logic  
- League calendars  

---

## 9. Risks & Open Questions

### Risks
- Scheduling logic can become complex for fairness  
- Supabase free-tier limits  
- Netlify build limits  

### Open Questions
1. Do players see sessions they are not participating in?  
2. Should there be a waitlist for >12 players?  
3. Should admins manually adjust pairings?  
4. Should session templates be stored?  

---

## 10. Acceptance Criteria
A player must be able to:
- Sign up  
- Join a league  
- Be assigned matches  
- View history  

An admin must be able to:
- Create league  
- Invite players  
- Create sessions  
- Generate schedule  
- Enter scores  

System considered MVP-complete when all above can be done without spreadsheets or external tools.
