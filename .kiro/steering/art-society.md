# Art Society Scorer — Project Steering

## What This Is
A mobile-first web companion app for the Art Society board game by Mighty Boards. Players use it to calculate end-game scores after playing the physical board game. Hosted on Vercel with Supabase as the cloud database.

## Game Rules (Scoring)
- 2–4 players compete to build the most prestigious art gallery
- 4 painting colors (Red, Blue, Yellow, Green) each assigned a multiplier (×5, ×4, ×3, ×2) via the Prestige Track
- Per-color score = tiles × multiplier
- Eyeline bonus = +3 per tile, only for the ×5 color, clamped to that color's tile count
- Decor = +1 per tile
- Complete Board = +5 (single bonus, there is NO separate "Full Gallery" bonus)
- Penalties: Empty Corners −2 each, Unplaced Paintings −2 each
- Tie-breaker: manual selection (remaining Paddle Points, decided by players)

## Architecture
- Next.js 14 on Vercel, single-page app in `app/page.tsx`
- Supabase for cloud persistence (games, players, users, lineups)
- `lib/supabase-server.ts` — singleton admin client
- API routes: `/api/sync` (save game), `/api/history` (load archives + leaderboard), `/api/migrate` (bulk import)
- Client-side: localStorage for player identity library and lineups as offline fallback

## Key Design Decisions
- Cloud-first: saves go to Supabase via `/api/sync`, no local history fallback
- Player identity is canonical-name-based (lowercase, trimmed, diacritics stripped) — no auth
- Same name on different devices = same player on leaderboard
- Prestige Track locks after any non-zero input
- Player total is hidden by default (press-and-hold to peek)
- Score breakdowns stored as JSONB inside `games.players` — not normalized

## Features
- Score entry with steppers (0–20 range)
- Prestige Track drag-to-reorder
- Player Identity Library with typeahead search
- Lineup memory ("Use last lineup?")
- Results screen with Gallery Review (narrative recap)
- Archives modal with 3 tabs: History, Leaderboard, Stats
- Player Stats: win rate, avg score, streaks, favorite color, head-to-head, score trend chart
- 12 achievements computed from game history
- Color-blind palette toggle (Deuteranopia, Protanopia, Tritanopia)
- Left-handed mode

## Coding Conventions
- Everything in `app/page.tsx` — single file, no component splitting yet
- Types defined at top: Color, Multiplier, PrestigeOrderItem, Breakdown, Player, Game
- Helper functions before components: computeScore, canonicalizeName, multiplierMap, etc.
- CSS in `app/globals.css` using CSS custom properties (--cream, --navy, --gold, etc.)
- 8px grid spacing, 10px border radius, Cormorant Garamond headings, Lato body

## Things to Watch Out For
- Old saved games in Supabase won't have newer fields — always use `?? 0` or `?? false` when reading from history JSONB
- The `tieBreakerWinner` flag on player objects must be respected when determining winners from history (achievements, stats, leaderboard all check for it)
- Achievements and stats sort players with tieBreakerWinner priority before score/decor/name
- The Gallery Review (recap) uses "prestige" not "points" and art-world language
- Decor max is 50 (not 20 like other steppers)
