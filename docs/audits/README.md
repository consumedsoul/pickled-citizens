# Audit History

Chronological list of repository audits for Pickled Citizens.

| Date | Overall | Security | Performance | Code Quality | Docs | Critical | High | Medium | Low | Total | Summary |
|------|---------|----------|-------------|--------------|------|----------|------|--------|-----|-------|---------|
| [2026-04-06](./2026-04-06-audit.md) | 93/100 (A) | 92/100 | 95/100 | 92/100 | 75/100 | 0 | 0 | 4 | 4 | 8 | All 3 prev items resolved (100%); first audit with 0 critical/high; LLM discoverability 1/10 — first assessed |
| [2026-03-04](./2026-03-04-audit.md) | 89/100 (A) | 80/100 | 93/100 | 88/100 | 88/100 | 1 | 2 | 4 | 9 | 16 | All 15 prev items resolved (100%), 52 tests added, DB types with Relationships, CSP header missing |
| [2026-02-23](./2026-02-23-audit.md) | 80/100 (B+) | 75/100 | 80/100 | 82/100 | 85/100 | 1 | 3 | 6 | 5 | 15 | Complete UI redesign, 0 any types, component library, 8/13 prev items resolved, dead middleware found |
| [2026-02-19](./2026-02-19-audit.md) | 74/100 (B) | 85/100 | 82/100 | 65/100 | 80/100 | 0 | 2 | 6 | 5 | 13 | First B grade! Corrupted type file removed, TS build fixed, CI/CD deploying, fullscreen view improved |
| [2026-02-17](./2026-02-17-audit.md) | 69/100 (C) | 80/100 | 85/100 | 60/100 | 75/100 | 1 | 2 | 7 | 6 | 16 | Corrupted type file found; .env/.eslint/middleware/indexes all added; README needs minor updates |
| [2026-02-14](./2026-02-14-audit.md) | N/A | N/A | N/A | N/A | N/A | 0 | 3 | 9 | 6 | 18 | All critical issues fixed! Still need: .env.example, ESLint config, DB indexes, type safety. |
| [2026-02-08](./2026-02-08-audit.md) | N/A | N/A | N/A | N/A | N/A | 2 | 5 | 6 | 5 | 18 | Initial audit. Debug endpoint in prod, duplicate RLS policies, 15+ `any` types, no tests. |

## Trend Analysis

**2026-04-06 (Week 7):**
- 📊 **Overall: 93/100 (A - Excellent)** — New high! (+4 from last audit)
- ✅ **100% resolution rate** — All 3 previous action items resolved (third consecutive perfect sprint)
- ✅ **First audit with 0 critical and 0 high issues** — milestone
- ✅ CSP header added to `next.config.mjs` with full directives
- ✅ `middleware.ts` now imports `ADMIN_EMAIL` from `./src/lib/constants`
- ✅ Admin PATCH now logs `admin.user_profile_updated` to `admin_events`
- 🆕 LLM Discoverability section assessed for the first time: 1/10 (0/5 signals)
- ⚠️ CSP uses `script-src 'unsafe-inline'` — functional but weakens XSS protection
- ⚠️ No `llms.txt`, JSON-LD, or `robots.txt` — public app invisible to AI search tools

**2026-03-04 (Week 6):**
- 📊 **Overall: 89/100 (A - Very Good)** — Highest score at that point (+9 from last audit)
- ✅ **100% resolution rate** — All 15 previous action items resolved (first perfect sprint)
- ✅ Admin middleware moved to project root — now functional and protecting `/admin/*`
- ✅ Supabase `Database` type now includes `Relationships` (required for supabase-js v2.81+)
- ✅ 52 vitest tests added for team generation — first test coverage after 6 audits
- ✅ `src/lib/formatters.ts` and `src/lib/teamGeneration.ts` extracted as pure utilities
- ✅ Security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy added
- ✅ Typed Supabase client — all queries now end-to-end type safe
- ❌ Critical: Content-Security-Policy header still missing
- ⚠️ Admin PATCH/DELETE operations have no audit trail
- ⚠️ middleware.ts hardcodes ADMIN_EMAIL instead of importing from constants

**2026-02-23 (Week 5):**
- 📊 **Overall: 80/100 (B+ - Very Good)** — Highest score yet! (+6 from last audit)
- ✅ `any` types: 32 → 0 (all eliminated during UI redesign)
- ✅ Inline styles: 80+ → 1 (all converted to Tailwind)
- ✅ Console statements: 13 → 1 (appropriate error boundary log)
- ✅ 8 of 13 previous action items resolved (62% resolution rate)
- ✅ New reusable UI component library (Button, Input, Select, SectionLabel, Modal)
- ❌ Critical: Admin middleware discovered to be dead code (never executed by Next.js)
- ⚠️ New Modal component missing keyboard accessibility and ARIA
- ⚠️ .bak file from redesign committed to git
- ⚠️ Test coverage: Still 0% (5 consecutive audits)

**2026-02-19 (Week 4):**
- 📊 **Overall: 74/100 (B - Good)** — First B grade! (+5 from last audit)
- ✅ Critical: 1 → 0 (corrupted `src/types/supabase.ts` removed)
- ✅ TypeScript build errors fixed — CI/CD now deploying successfully
- ✅ Fullscreen view enhanced with Teams + Players + Matchups layout
- ⚠️ `any` types: 32 occurrences (slight increase from 30)
- ⚠️ Test coverage: Still 0% (4 consecutive audits)
- ⚠️ Admin user edit still broken (2nd audit flagged)

**2026-02-17 (Week 3 — First Scored Audit):**
- 📊 **Overall: 69/100 (C - Fair)** — First audit with scoring system
- ✅ All 3 high-priority items from 2026-02-14 resolved (.env.example, .eslintrc, DB indexes)
- ✅ Admin middleware and database types also added
- ❌ New critical: `src/types/supabase.ts` corrupted with npm error output
- ⚠️ `any` types: 30 occurrences
- ⚠️ Test coverage: Still 0% (3 consecutive audits)

**2026-02-14 (Week 2):**
- 🎉 All critical issues resolved (test endpoint removed, RLS consolidated)
- ✅ Critical: 2 → 0 (-100%)
- ✅ High: 5 → 3 (-40%)
- ⚠️ Medium: 6 → 9 (+50% — better detection, not regression)

**2026-02-08 (Week 1 — Baseline):**
- First audit establishes baseline metrics
- Key concerns: security (test endpoint, RLS duplicates), type safety, zero test coverage

## Persistent Issues (Across Multiple Audits)

| Issue | First Found | Status | Audits Open |
|-------|------------|--------|-------------|
| CSP `script-src 'unsafe-inline'` | 2026-04-06 | Open | 1 |
| No LLM discoverability signals | 2026-04-06 | Open | 1 |
| DUPR range validation missing | 2026-04-06 | Open | 1 |

## Resolved Issues

| Issue | First Found | Resolved | Audits Open | Resolution |
|-------|------------|----------|-------------|------------|
| Missing Content-Security-Policy header | 2026-03-04 | 2026-04-06 | 1 | CSP added to `next.config.mjs` with full directives |
| `middleware.ts` hardcoded ADMIN_EMAIL | 2026-03-04 | 2026-04-06 | 1 | Imports from `./src/lib/constants` |
| No audit logging for admin PATCH | 2026-03-04 | 2026-04-06 | 1 | PATCH logs `admin.user_profile_updated` to `admin_events` |
| Admin middleware dead code | 2026-02-17 | 2026-03-04 | 3 | Moved to project root `middleware.ts` |
| Stale closure in home page auth | 2026-02-23 | 2026-03-04 | 1 | Uses `loadedUserIdRef.current` ref pattern |
| Modal missing keyboard/ARIA | 2026-02-23 | 2026-03-04 | 1 | Added Escape, focus trap, aria-modal, aria-labelledby |
| Supabase client not typed | 2026-02-23 | 2026-03-04 | 1 | Added `Database` generic + `Relationships` arrays |
| N+1 query in leagues page | 2026-02-19 | 2026-03-04 | 2 | Consolidated 3 queries into 1 joined query |
| Session detail JSX duplication | 2026-02-23 | 2026-03-04 | 1 | Extracted TeamsPanel, PlayersPanel, MatchupsPanel |
| Duplicated formatter functions | 2026-02-23 | 2026-03-04 | 1 | Created `src/lib/formatters.ts` |
| .bak file tracked in git | 2026-02-23 | 2026-03-04 | 1 | Deleted, added `*.bak` to .gitignore |
| Missing error check in leave route | 2026-02-23 | 2026-03-04 | 1 | Added membership query error handling |
| No security headers | 2026-02-23 | 2026-03-04 | 1 | X-Frame-Options, X-Content-Type-Options, Referrer-Policy added |
| Zero test coverage | 2026-02-08 | 2026-03-04 | 6 | 52 vitest tests for team generation algorithm |
| setCreating not reset on returns | 2026-02-23 | 2026-03-04 | 1 | Fixed early return paths |
| Input ID collision | 2026-02-23 | 2026-03-04 | 1 | React 18 useId() hook |
| Hardcoded production URLs | 2026-02-23 | 2026-03-04 | 1 | `NEXT_PUBLIC_SITE_URL` env var |
| Unused userId in AuthStatus | 2026-02-23 | 2026-03-04 | 1 | Removed dead state |
| `any` type usage (32) | 2026-02-08 | 2026-02-23 | 4 | Complete UI redesign eliminated all instances |
| `.DS_Store` tracked in git | 2026-02-08 | 2026-02-23 | 4 | Removed from tracking, added to .gitignore |
| `app/share-test/page.tsx` in prod | 2026-02-14 | 2026-02-23 | 3 | Deleted |
| `app/history/page.tsx` returns 404 | 2026-02-14 | 2026-02-23 | 3 | Deleted |
| Admin user edit broken (RLS) | 2026-02-17 | 2026-02-23 | 2 | API route created at `app/api/admin/users/route.ts` |
| Missing error boundary | 2026-02-19 | 2026-02-23 | 1 | `app/error.tsx` created |
| Debug console.log statements | 2026-02-19 | 2026-02-23 | 1 | Reduced from 13 to 1 (appropriate) |
| Corrupted type file | 2026-02-17 | 2026-02-19 | 1 | File removed |

## How to Use

- Audits are performed weekly using Claude Code
- Each audit file follows the standardized template
- Action items carry forward until resolved
- Trend analysis compares current vs. previous audit metrics
- Health scores calculated starting 2026-02-17
