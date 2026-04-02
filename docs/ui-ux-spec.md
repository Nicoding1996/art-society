# Art Society Scorer — Mobile-first UI/UX Spec and Low-fidelity Wireframes

Locked configuration summary
- Platform: Web-first on Vercel; plan for native later
- Players: 2–4
- Minimum width: 320 px
- Accessibility: WCAG AA; color-blind palettes; left-handed thumb reach mode
- Prestige Track: four colors assigned to ×5 ×4 ×3 ×2, order locked once scoring begins
- Scoring: tiles × multiplier; Eyeline +3 per tile for the ×5 color only; Decor +1 each; Complete Board +5; Empty Corners −2 each; Unplaced Paintings −2 each; Faux Pas removed

Design tokens
- Colors
  - Background cream: #FAF7F0
  - Text and borders navy: #0D1B2A
  - Primary CTA muted gold: #C8A96A
  - Dividers cool gray: #C7CDD6 at 40–60 percent opacity
  - Accents: Deep red #B22E2E, Royal blue #2A4CBF, Sunny yellow #F4C020, Forest green #2C7A4B
  - Warning tint: #9E2B2B
  - Celebration gold: #D4AF37
- Typography
  - Headings: Cormorant Garamond
  - Body and numbers: Lato with tabular lining figures
  - Sizes: H1 28–32 px, H2 20–22 px, body 14–16 px, caption 12–14 px
- Spacing and elevation
  - Base unit 8 px grid, micro 4 px
  - Card padding 12 px; section gaps 8 px; inter-card gap 16 px
  - Radius 10 px on cards and controls; 999 px on pill toggles
  - Shadows: Cards 0 2 8 rgba(0,0,0,0.06); Winner 0 4 16 rgba(0,0,0,0.10)
- Iconography
  - Avatars: 2 px navy strokes, abstract line-art
  - Medals: gold, silver, bronze with subtle inner shadow
  - Decor: shield outline
  - Penalties: minus badge; empty corner bracket
  - Steppers: plus and minus 14 px glyphs within 32–36 px targets

Low-fidelity wireframes

Score Entry screen

+---------------------------------------------------+
|                Art Society Scorer                 |
+---------------------------------------------------+
| Prestige Track                                    |
| ● Red   ● Blue   ● Yellow   ● Green               |
| ×5       ×4       ×3         ×2                  |
| [Drag handle hints ••] [Lock appears after input]|
+---------------------------------------------------+
| Player 1                                          |
| [Avatar]  Julian                  [⋯]            |
| Painting Tiles                                    |
|  Red    ×3   [-] [ 0 ] [+]                       |
|  Blue   ×5   [-] [ 0 ] [+]                       |
|   Eyeline tiles  [-] [ 0 ] [+]  (+3 each)        |
|  Yellow ×2   [-] [ 0 ] [+]                       |
|  Green  ×4   [-] [ 0 ] [+]                       |
| Gallery Bonuses                                   |
|  Decor Tiles  [-] [ 0 ] [+]   +1 each            |
|  [ ] Complete Board +5                            |
| Penalties                                         |
|  Empty Corners    [-] [ 0 ] [+]   −2 each        |
|  Unplaced Paintings [-] [ 0 ] [+]  −2 each       |
| ------------------------------------------------ |
| Player Total: 0                                   |
+---------------------------------------------------+
| Player 2 ... identical shell                      |
+---------------------------------------------------+
|                    Calculate Scores               |
|                 [ Primary Gold Button ]           |
+---------------------------------------------------+

Notes
- Eyeline row appears only for the color at ×5
- Eyeline value cannot exceed that color’s total; auto-clamps on decrease
- Calculate Scores disabled until any player has non-zero input
- Left-handed mode mirrors steppers and places primary button emphasis left

Results screen

+---------------------------------------------------+
|                 Game Results                      |
+---------------------------------------------------+
| Winner                                            |
| [Gold Medal 1st]  Julian       Score 127          |
| [Laurel watermark within card]                    |
| [View Score Breakdown ▸]                          |
+---------------------------------------------------+
| 2nd Place                                         |
| [Silver 2nd]  Alex        Score 111   [▸]         |
+---------------------------------------------------+
| 3rd Place                                         |
| [Bronze 3rd]  Sam        Score 103    [▸]         |
+---------------------------------------------------+
| 4th Place                                         |
| Taylor      Score 96                 [▸]          |
+---------------------------------------------------+
| [ Save Game to History ]  [ Start New Game ]      |
+---------------------------------------------------+

Breakdown expanded example
- Painting Values
  - Red 3 × ×3 = 9
  - Blue 3 × ×5 = 15
  - Blue eyeline 2 × +3 = +6
  - Yellow 2 × ×2 = 4
  - Green 1 × ×4 = 4
- Decor 4 × +1 = +4
- Complete Board +5
- Penalties: Empty corners 2 × −2 = −4; Unplaced 1 × −2 = −2
- Final Score 42 example only

Game Archives

+---------------------------------------------------+
|                 Game Archives                     |
+---------------------------------------------------+
| Tabs: [ Game History ]  [ Player Leaderboard ]    |
+---------------------------------------------------+
| Game History                                      |
| ┌──────────────── Game Card ────────────────┐     |
| | September 5, 2025                         |     |
| | Avatars: o o o o                          |     |
| | Winner: 🏆 Julian 127                     |     |
| |                                [chevron]  |     |
| └───────────────────────────────────────────┘     |
| ...                                               |
+---------------------------------------------------+

Player Leaderboard

+---------------------------------------------------+
| Rank | Player       | Wins | Avg. | High          |
|  1   | Julian   o   |  7   | 112  | 156           |
|  2   | Alex     o   |  5   | 108  | 149           |
|  ...                                               |
+---------------------------------------------------+

Interactions and validations
- Prestige Track
  - Drag to reorder; supports tap to move left or right for accessibility
  - Lock prompt appears after first non-zero input across any player
  - Once locked, show lock icon with hint Locked after scoring begins
- Steppers
  - Range 0–20; long-press accelerates
  - Exceeding bounds gives gentle shake and hint Max 20
- Eyeline
  - Only the ×5 color shows Eyeline tiles stepper
  - Eyeline clamps to current total for that color with toast Eyeline reduced to match total
- Calculate Scores
  - Disabled until any non-zero input detected
- Save Game
  - Toast Saved to History on success

Accessibility
- Contrast meets AA: navy text on cream, white on navy or gold buttons
- Focus outlines 2–3 px high-contrast on all interactive elements
- Screen reader labels announce diffs, for example Julian total updated plus 6 from eyeline
- Reduced motion respected; disable shimmer when prefers reduced motion
- Color-blind palettes: Deuteranopia, Protanopia, Tritanopia with preview swatches
- Left-handed mode mirrors layout and control positions for thumb reach

Microcopy inventory
- Eyeline rule: Only the ×5 color earns +3 per eyeline tile. No cap.
- Decor helper: +1 each
- Bonuses: Complete Board +5
- Penalties: Empty corners −2 each; Unplaced paintings −2 each
- Prestige hint: Locked after scoring begins
- Bounds: Max 20
- Clamp: Eyeline reduced to match total
- Save: Saved to History
- Empty states
  - History: No saved games yet. Play a game and save results.
  - Leaderboard: No leaderboard yet. Save games to build stats.

Scoring model
- Per-color subtotal = tiles × assigned multiplier
- Eyeline bonus = eyeline tiles × 3 for the ×5 color only
- Decor points = decor tiles × 1
- Bonuses = Complete Board 5
- Penalties = empty corners × 2 plus unplaced paintings × 2
- Final score = sum of per-color subtotals plus eyeline bonus plus decor plus bonuses minus penalties

Acceptance tests for scoring
- Example A
  - Prestige order Blue ×5, Green ×4, Red ×3, Yellow ×2
  - Blue tiles 3, eyeline 2 → 3 × 5 = 15, eyeline 2 × 3 = 6
  - Red tiles 2 → 2 × 3 = 6
  - Yellow tiles 0 → 0
  - Green tiles 1 → 1 × 4 = 4
  - Decor 4 → 4
  - Complete Board on → 5
  - Penalties: Empty 2 → −4; Unplaced 1 → −2
  - Total = 15 + 6 + 6 + 0 + 4 + 5 − 6 = 30
- Example B
  - Prestige order Red ×5; Red tiles 5 with eyeline 5; others 0
  - Decor 0; bonuses off; penalties 0
  - Total = 5 × 5 + 5 × 3 = 25 + 15 = 40
- Example C
  - Eyeline exceeds total attempt: Red tiles 2, eyeline set to 3 then tiles decreased to 2
  - Result clamps eyeline to 2 and shows toast Eyeline reduced to match total

Mermaid flows

graph TD
A[Set Prestige Track order] --> B[Add players 2 to 4]
B --> C[Enter painting counts]
C --> D[Show Eyeline tiles stepper for ×5 color]
D --> E[Add decor and bonuses set penalties]
E --> F{Any input}
F -- No --> E
F -- Yes --> G[Lock Prestige Track]
G --> H[Calculate Scores]
H --> I[Results Screen]

graph TD
I[Results Screen] --> J[Save Game to History]
I --> K[Start New Game]
J --> L[Game History list]
L --> M[Open Detailed Results]
M --> L
L --> N[Switch to Leaderboard]
N --> L

Responsiveness
- 320 to 375 px: single column, compact paddings; icons 20–24 px
- 390 to 480 px: larger paddings; two-line table rows when needed
- 600 px and up: two-column layout for Player Cards and split results view

Assets for hi-fi
- Medal icons gold silver bronze
- Laurel watermark vector
- Shield icon for decor, minus badge for penalties
- Color chips for four accents with color-blind alternates

Implementation notes
- Use CSS custom properties for palette and spacing
- Load typography via Google Fonts with tabular-nums feature for numbers
- Use aria-live polite for running totals and aria-expanded for breakdown accordions
- Use inert for off-canvas panels and avoid focus traps
## Interactive Components and States — Detailed Spec

Scope
- This section refines interactive behavior, states, accessibility, and left-handed adaptations for all controls described in [docs/ui-ux-spec.md](docs/ui-ux-spec.md).

Global interaction patterns
- Touch target size: min 44 × 44 px
- Hit slop: +6 px on all sides where possible
- Focus ring: 2–3 px high-contrast outline (navy on cream; white on navy/gold)
- Keyboard: Tab to focus, Space/Enter to activate; Arrow keys where specified
- Reduced motion: replace movement with cross-fade and scale ≤ 1.02; durations reduced by 30%
- Feedback: use subtle 120–160 ms scale or elevation change on press; never exceed 200 ms

1) Stepper Input (− [value] +)
- Usage: painting counts, eyeline tiles (×5 color only), decor tiles, empty corners, unplaced paintings
- Anatomy
  - Container: pill or rounded rect, 10 px radius
  - Buttons: − and +, 32–36 px square; icon size 14 px
  - Value: centered numeric, Lato with tabular-nums
- States
  - Default: cream bg; navy icons; navy text
  - Hover (pointer): icon tint +5% navy
  - Focus: 2 px outline; announce “Value, X, stepper, min 0 max 20”
  - Active (press): button bg lightened cream; icon opacity 0.8
  - Disabled: 40% opacity across control; non-interactive
  - Error: shake subtle; hint text below in warning tint
- Behaviors
  - Range: 0–20
  - Tap: increments/decrements by 1; clamp at min/max
  - Long-press: after 500 ms, repeats every 200 ms; ramps to every 120 ms after 1.5 s
  - Keyboard: ArrowUp/Right = +1; ArrowDown/Left = −1; Home = min; End = max
  - Screen reader: ARIA role spinbutton, with aria-valuemin/aria-valuemax/aria-valuenow
- Validation and rules
  - Eyeline stepper max equals current total for ×5 color; if total decreases below eyeline, auto-clamp and show toast “Eyeline reduced to match total”
  - When at bounds, play gentle boundary animation; announce “Max 20” or “Min 0”
  - Penalties and decor use the same constraints; no negative values

2) Checkbox (Complete Board +5)
- Anatomy
  - Box 20 px, 2 px navy stroke, 10 px radius; checkmark navy
- States
  - Checked/Unchecked; Hover; Focus; Disabled
- Behavior
  - Label includes delta: Complete Board +5
  - ARIA role checkbox; announces current state and delta context
  - Left-handed: aligns control and label to left edge of card section

3) Prestige Track Reorder (×5 ×4 ×3 ×2)
- Anatomy
  - Four color chips (circles), 36–44 px; label below with multiplier in muted gray
  - 6-dot drag handle appears on long-press or hover
- States
  - Default; Hover (pointer); Dragging (elevated, shadow + scale 1.02); Locked (lock icon + subdued animation)
- Behavior
  - Reorder by drag-and-drop; also supports tap Move left/right controls via overflow for accessibility
  - Constraints: once any player input is non-zero, trigger “Lock Prestige order?” modal
    - Confirm locks; Cancel aborts drag
  - Announcement examples: “Blue moved to first. Multiplier ×5”
  - When order changes prior to lock: eyeline input migrates to new ×5 color and previous eyeline value clears (confirm if non-zero)

5) Accordion (View Score Breakdown)
- Anatomy
  - Header row with label and chevron; section divider 1 px navy at 10% opacity
- States
  - Collapsed: chevron right; Expanded: chevron down
  - Focus: outline around header row
- Behavior
  - Animation: height auto expand/collapse 200–250 ms; reduced motion: instant
  - ARIA: button with aria-expanded; content region with aria-controls; focus sent inside on expand
  - Content: itemized points with math strings (e.g., “Blue 3 × ×5 = 15”)

6) Text Input (Player Name)
- Anatomy
  - Inline editable label in header; caret on tap; underline navy 2 px on edit
- States
  - Readonly; Editing; Focused; Error (duplicate names resolved by suffix e.g., “Julian (2)”)
- Behavior
  - Keyboard supports full editing; confirm on Enter; Escape cancels
  - Default names “Player 1..4” always valid; Save disabled if blank

7) Primary Button (Calculate Scores)
- Anatomy
  - Full width; 56 px height; muted gold bg; white text; 10 px radius
- States
  - Default; Hover (pointer): gold +4% brightness; Active: slight press; Focus: outline
  - Disabled: 40% opacity; non-interactive
- Behavior
  - Enabled when any player has non-zero input; otherwise disabled
  - Left-handed mode: full width remains; ripple origin left; placement consistent bottom fixed

8) Secondary Buttons (Save Game to History, Start New Game)
- Save Game (results screen primary): navy fill, white text
- Start New Game: navy outline, navy text; transparent bg
- States and behavior mirror Primary

9) Toasts and Modals
- Toast
  - Position: bottom above fixed footer; auto-dismiss 2.5 s; swipe to dismiss
  - Styles: navy bg, white text, 10 px radius
  - Examples: “Saved to History”, “Eyeline reduced to match total”
- Modal
  - Centered card; backdrop 40% black; focus trap inside modal; Esc closes
  - Buttons: Confirm (solid), Cancel (outline)

10) Results Cards and Medals
- Winner Card
  - Press states: none; the entire card is non-interactive except the breakdown accordion
  - Shimmer: single pass 1.2 s; disabled if prefers-reduced-motion
- Runner Cards
  - Entire card tappable to expand breakdown
  - Medal icons sized 24–28 px; bronze/silver/gold; inner shadow subtle

11) Sorting and Results Logic (UI affordance)
- Sort direction indicator on Leaderboard column header (Wins default)
- Tap cycles: Desc → Asc
- Screen reader announces: “Sorted by Wins descending”

12) Error, Empty, and Loading States
- Empty states
  - History: “No saved games yet. Play a game and save results.”
  - Leaderboard: “No leaderboard yet. Save games to build stats.”
- Loading (archives)
  - Skeleton rows for Game Cards and Leaderboard; 2–3 shimmering lines per item
  - Reduced motion: static skeletons (no shimmer)
- Errors
  - Network: banner top “Couldn’t load archives. Retry.” with inline Retry
  - Save failure: toast “Save failed. Check connection and try again.”

13) Left-handed Mode Mirroring
- Global setting in Game Setup; applies immediately
- Control alignment
  - Steppers: “+” on left, “−” on right; numeric value aligned closer to left edge
  - Toggles/Checkboxes: controls and labels left-aligned within content blocks
  - Footer: primary CTA full width; ripple origin left; settings gear sits at bottom-left
- Prestige Track: chip order remains LTR for consistency; drag handles move to left side of chips

14) Accessibility and Assistive Tech Hooks
- Live regions
  - Player totals: aria-live="polite" announce diffs (“Julian total updated, plus 6 from eyeline”)
  - Toast container: aria-live="polite"
- Roles and labels
  - Steppers: role spinbutton; aria-valuemin/max/now; aria-label “Blue tiles”
  - Toggles/Checkboxes: label includes delta “+5”
  - Accordion: aria-expanded on header; content labelledby header id
- Keyboard maps
  - Reorder list: when focused, Ctrl+Arrow to move item left/right
  - Accordions: Home/End jump to first/last accordion header
- Contrast
  - Ensure 4.5:1 for all text; 3:1 for large text/icons ≥ 24 px
- Focus order
  - Header → Prestige Track (chips L→R) → Players top-to-bottom → Footer CTA

15) State Tokens (Design System)
- Elevation
  - Rest: card shadow 0 2 8 rgba(0,0,0,0.06)
  - Pressed: card shadow 0 1 4 rgba(0,0,0,0.08)
  - Winner: 0 4 16 rgba(0,0,0,0.10)
- Motion
  - Expand/collapse: 200–250 ms spring, easing out quad
  - Press ripple: 160 ms, alpha 12%
- Opacity ramps
  - Disabled 40%; Hint text 70%; Dividers 10–16%

16) Microcopy Hooks (contextual)
- Bounds: “Max 20”
- Clamp: “Eyeline reduced to match total”
- Lock: “Locked after scoring begins”
- Save: “Saved to History”
- Network: “Couldn’t load archives. Retry.”

17) QA Checklist for Interactions
- Steppers clamp at 0 and 20, with hints
- Eyeline never exceeds total for ×5; auto-clamp on lower total
- Prestige reorder prompts lock after any non-zero entry
- Calculate Scores disabled until any input > 0
- Reduced motion disables shimmer and shortens all transitions
- Left-handed mode mirrors steppers and toggles; ripple origin left
- Screen reader announces changes for totals and toggles

## Data and API Schema — Draft

This section extends the spec in [docs/ui-ux-spec.md](docs/ui-ux-spec.md) with concrete data shapes and service endpoints for History and Leaderboard.

Guiding principles
- Web-first hosted on Vercel, API routes likely under /api
- Authenticated sync planned; anonymous local play should also work (client can persist local and POST when signed in)
- Pagination for history via cursor
- Aggregations computed server-side for Leaderboard

Core entities

Game
- id: string (ULID/UUID)
- createdAt: ISO timestamp
- prestigeOrder: array of 4 items [{ color: red|blue|yellow|green, multiplier: 5|4|3|2 }]
- players: array of Player (2–4 entries)
- notes: optional string (future)
- version: number (ruleset revision)

Player
- id: string
- name: string
- avatarKey: string
- paintings: { red: number, blue: number, yellow: number, green: number } // 0–20
- eyelineCountForX5: number // 0–20, clamped to tiles of ×5 color
- decorCount: number // 0–20
- completeBoard: boolean
- penalties: { emptyCorners: number, unplacedPaintings: number } // 0–20
- finalScore: number // computed and persisted with game

Derived computation (documented, not enforced by API)
- perColorSubtotal[color] = paintings[color] × prestige multiplier for that color
- eyelineBonus = eyelineCountForX5 × 3 (only ×5 color)
- decorPoints = decorCount × 1
- bonuses = (completeBoard ? 5 : 0)
- penalties = emptyCorners × 2 + unplacedPaintings × 2
- finalScore = Σ perColorSubtotal + eyelineBonus + decorPoints + bonuses − penalties

API endpoints

POST /api/games
- Purpose: Save a completed game to history
- Request body (JSON)
  {
    "prestigeOrder": [
      { "color": "blue", "multiplier": 5 },
      { "color": "green", "multiplier": 4 },
      { "color": "red", "multiplier": 3 },
      { "color": "yellow", "multiplier": 2 }
    ],
    "players": [
      {
        "id": "p1",
        "name": "Julian",
        "avatarKey": "line-01",
        "paintings": { "red": 3, "blue": 3, "yellow": 2, "green": 1 },
        "eyelineCountForX5": 2,
        "decorCount": 4,
        "completeBoard": true,
        "penalties": { "emptyCorners": 2, "unplacedPaintings": 1 },
        "finalScore": 35
      },
      { "... second player ..." }
    ],
    "version": 1
  }
- Response 201
  {
    "id": "01HTR9C3B8Y7F7KZ6QW3H0M3N1",
    "createdAt": "2025-09-06T07:12:34.567Z"
  }
- Validation
  - players length 2–4
  - prestigeOrder includes the four unique colors and multipliers {5,4,3,2}
  - non-negative integers 0–20 for all counters
  - finalScore recomputation server-side is recommended; reject if mismatch (or accept and overwrite)

GET /api/games?limit=20&amp;cursor=encoded
- Purpose: Paginated game history (most recent first)
- Response 200
  {
    "items": [
      {
        "id": "01H...",
        "createdAt": "2025-09-05T17:22:10.000Z",
        "summary": {
          "winner": { "name": "Julian", "score": 127, "avatarKey": "line-01" },
          "players": [
            { "name": "Julian", "score": 127, "avatarKey": "line-01" },
            { "name": "Alex", "score": 111, "avatarKey": "line-02" },
            { "name": "Sam", "score": 103, "avatarKey": "line-03" },
            { "name": "Taylor", "score": 96, "avatarKey": "line-04" }
          ]
        }
      }
    ],
    "nextCursor": "base64cursor" // null if end
  }

GET /api/games/:id
- Purpose: Detailed results view for a single game
- Response 200
  {
    "id": "01H...",
    "createdAt": "2025-09-05T17:22:10.000Z",
    "prestigeOrder": [
      { "color": "blue", "multiplier": 5 },
      { "color": "green", "multiplier": 4 },
      { "color": "red", "multiplier": 3 },
      { "color": "yellow", "multiplier": 2 }
    ],
    "players": [
      {
        "id": "p1",
        "name": "Julian",
        "avatarKey": "line-01",
        "paintings": { "red": 3, "blue": 3, "yellow": 2, "green": 1 },
        "eyelineCountForX5": 2,
        "decorCount": 4,
        "completeBoard": true,
        "penalties": { "emptyCorners": 2, "unplacedPaintings": 1 },
        "finalScore": 127,
        "breakdown": {
          "perColor": {
            "blue": { "tiles": 3, "multiplier": 5, "points": 15 },
            "green": { "tiles": 1, "multiplier": 4, "points": 4 },
            "red": { "tiles": 3, "multiplier": 3, "points": 9 },
            "yellow": { "tiles": 2, "multiplier": 2, "points": 4 }
          },
          "eyeline": { "tiles": 2, "perTile": 3, "points": 6 },
          "decor": 4,
          "bonuses": { "completeBoard": 5 },
          "penalties": { "emptyCorners": 4, "unplacedPaintings": 2 }
        }
      },
      { "... other players ..." }
    ]
  }

GET /api/leaderboard?sort=wins&amp;range=all
- Purpose: Aggregated player statistics
- Response 200
  {
    "items": [
      { "rank": 1, "player": { "name": "Julian", "avatarKey": "line-01" }, "wins": 7, "avgScore": 112.3, "highScore": 156 },
      { "rank": 2, "player": { "name": "Alex", "avatarKey": "line-02" }, "wins": 5, "avgScore": 108.1, "highScore": 149 }
    ],
    "sortedBy": "wins",
    "order": "desc"
  }
- Notes
  - Ties resolved by avgScore desc then name asc
  - range can be all, 30d, 90d, 1y

Sorting rules
- Results screen: sort players by finalScore desc; ties broken by decorCount desc, then name asc
- Leaderboard: default sort wins desc; ties by avgScore desc; on same avg, highScore desc; finally name asc

Identity and deduplication
- Player identity on Leaderboard is by normalized name (trim, collapse spaces, case-insensitive) unless authenticated profiles are used
- Optionally store stable playerId when available to avoid name collisions

Validation and error handling
- Reject invalid prestigeOrder (duplicates or missing colors)
- Enforce counter ranges 0–20
- Recompute finalScore on server; if client-sent finalScore mismatches, prefer server value
- Return 400 with field-level errors; client shows toast and inline error states

Security and auth (future-ready)
- If authenticated: require token on POST; associate games to user/team/club
- If anonymous: allow POST with rate limiting; store under public bucket until claimed by account

---

## Acceptance Test Cases — Scoring and Sorting

Scoring — Per-color and Eyeline
1. X5 color eyeline bonus stacks with multiplier
   - Setup: Blue ×5; paintings.blue = 3; eyeline = 2
   - Expect: blue subtotal 3 × 5 = 15; eyeline 2 × 3 = 6; combined blue contribution 21

2. Eyeline clamped to total
   - Setup: Red ×5; paintings.red = 2; eyeline attempt = 3
   - Action: decrease paintings.red to 2
   - Expect: eyeline auto-clamps to 2; toast “Eyeline reduced to match total”

3. Other colors do not earn eyeline
   - Setup: Green ×4, Yellow ×3, Red ×2; Blue ×5
   - Action: attempt to set eyeline on non-×5 color via UI (should be impossible)
   - Expect: eyeline control only visible for ×5 color

4. Upper and lower bounds
   - Setup: stepper at 20; press +; at 0; press −
   - Expect: value remains clamped; gentle boundary animation; hint “Max 20” or “Min 0”

Bonuses and Penalties
5. Decor scoring
   - decorCount = 4 → +4 points

6. Complete Board bonus
   - completeBoard = true → +5 total

7. Penalties subtract
   - emptyCorners = 2 → −4; unplacedPaintings = 1 → −2

Totals
8. Combined score calculation
   - Use Example A in spec; Expected total = 30

Sorting
9. Results screen sorting and tie-breakers
   - Two players with same finalScore; higher decorCount ranks above
   - If decorCount equal, name ascending

10. Leaderboard sorting toggle
   - Default by wins desc; tapping Avg toggles to avgScore desc; tapping again toggles to asc; SR announces change

Persistence
11. POST /api/games recompute server-side
   - Send payload with slightly incorrect finalScore
   - Expect: server returns 201; stored game shows corrected finalScore on GET

History pagination
12. GET /api/games paging
   - With limit=2, return 2 items and non-null nextCursor; using nextCursor returns next page

Accessibility
13. Screen reader announcements on diffs
   - Change eyeline by +1
   - Expect aria-live polite: “Julian total updated, plus 3 from eyeline”

Left-handed mode
14. Mirrored steppers and toggle alignment
   - Enable left-handed mode; “+” appears left; primary CTA ripple origin left

Error states
15. Network error on Save
   - Simulate 500 on POST
   - Expect inline toast “Save failed. Check connection and try again.” and retry affordance

## Accessibility Specification — WCAG AA

Reference context: extends the prior guidelines defined in [docs/ui-ux-spec.md](docs/ui-ux-spec.md)

Baseline targets
- Conformance: WCAG 2.2 AA for color contrast, focus visibility, keyboard support, and motion preferences
- Minimum touch target: 44 × 44 px; add 6 px hit slop where layout permits
- Typography: ensure tabular-nums on all numeric readouts for alignment consistency

Color contrast and usage
- Text on cream (#FAF7F0): use deep navy (#0D1B2A) for AA body and headings
- Text on navy: use white (#FFFFFF), verify 4.5:1 AA for body; icons ≥ 24 px at 3:1
- Primary button: muted gold (#C8A96A) with white text; ensure contrast ≥ 4.5:1; if under, darken gold to #B99957 for AA conformance
- Dividers and hints: cool gray (#C7CDD6) at 40–60% opacity; never use for essential text

Color‑blind palettes (toggle cycles defaults → Deuteranopia → Protanopia → Tritanopia)
- Default accents
  - Deep red #B22E2E
  - Royal blue #2A4CBF
  - Sunny yellow #F4C020
  - Forest green #2C7A4B
- Deuteranopia‑friendly (increase separation of green hues)
  - Red #B22E2E
  - Blue #2648A8
  - Yellow #E3B100
  - Teal‑green #2A9D8F
- Protanopia‑friendly (shift red away from green band)
  - Magenta‑red #A23B72
  - Blue #2A4CBF
  - Yellow‑gold #D9A400
  - Green #287E5E
- Tritanopia‑friendly (separate blue/yellow confusion)
  - Red #B22E2E
  - Violet #6A4FBF
  - Orange #E07A1F
  - Green #2C7A4B
- Implementation notes
  - Palette toggle previews all four colors simultaneously with labels
  - Always pair color with text and iconography; color is not the only cue (e.g., chips include color name text)

Keyboard support map
- Global navigation: Tab/Shift+Tab to move; Enter/Space to activate
- Steppers (role spinbutton): ArrowUp/Right +1, ArrowDown/Left −1, Home = min, End = max
- Prestige reorder (focusable list)
  - Ctrl+ArrowLeft/Right moves focused chip L/R before lock
  - Enter begins drag mode (optional); Esc cancels
- Accordion:
  - Enter/Space toggles open/close
  - Home/End jump to first/last accordion header within the list
- Results table (Leaderboard): Arrow keys navigate cells if table focus mode is implemented; otherwise row focus + Enter to open details

Screen reader semantics
- Live regions
  - Player total changes: aria-live="polite" announce deltas, e.g., “Julian total updated, plus 6 from eyeline”
  - Toast container: aria-live="polite" to announce feedback
- Roles/labels
  - Steppers: role="spinbutton" with aria-valuemin/max/now; aria-label includes color name or metric
  - Toggles/checkboxes: labels include their effect, e.g., “Complete Board +5”
  - Accordion headers: button with aria-expanded; content region labeledby header id
  - Prestige list: role="listbox" or sortable list pattern with announced position changes
- Focus order: Header → Prestige Track chips (L to R) → Player cards top to bottom (name → painting steppers → eyeline if visible → bonuses → penalties → card summary) → fixed footer CTA

Motion and reduced motion
- Default animations:
  - Press feedback 120–160 ms; expand/collapse 200–250 ms
  - Winner shimmer: single 1.2 s pass
- prefers-reduced-motion
  - Replace movements with cross-fade; reduce durations by ~30%
  - Disable shimmer/confetti entirely

Left‑handed mode mirroring
- Global toggle in Game Setup; immediate application without page reload
- Steppers: “+” button placed on left, “−” on right; value kept centered
- Toggles/checkboxes: control and label left-aligned inside each content block
- Footer CTA: remains full width; ripple origin biased from left edge
- Prestige drag handles: appear on left side of chips for consistent thumb reach

Error, empty, and loading semantics
- Error banners: aria-live="assertive" only when blocking; otherwise use polite toasts
- Empty states include a short next-step action line where relevant (e.g., “Play a game and save results”)
- Skeletons respect reduced motion by disabling shimmer effect

Testing checklist for accessibility
- Contrast passes for all text and essential icons
- Keyboard can perform end-to-end flow: setup → entry → results → save → archives
- SR reads math strings clearly: “Blue 3 times ×5 equals 15; Eyeline 2 times +3 equals +6”
- Reorder controls are operable without drag
- Left-handed mode reflows controls without breaking reading order

---

## Results Screen Visuals — Detailed Design

Winner’s Card
- Card visual
  - Border: 1 px gold (#D4AF37) inner stroke; outer 1 px navy at 10% opacity
  - Background: cream; faint laurel wreath watermark centered, 6–8% opacity; does not interfere with text legibility
  - Elevation: 0 4 16 rgba(0,0,0,0.10)
- Medal
  - 1st place large medal icon; sizes by viewport
    - 320–375 px: 32 px
    - 390–480 px: 40 px
    - 600+ px: 48 px
  - Fill: rich gold (#D4AF37) with subtle radial highlight; inner shadow for depth
- Typography
  - Player name: Lato bold 18–20 px
  - Score: Lato 28–36 px, tabular-nums, high contrast
  - Subcaption link: “View Score Breakdown” in navy with chevron; 14–16 px
- Animation
  - Gold shimmer: one-pass left→right, 1.2 s; disabled under reduced motion
  - Accordion expand: 200–250 ms height animation; content fades in 120 ms

Runners‑up Cards (2nd, 3rd, 4th)
- Scale slightly smaller than Winner; maintain uniform paddings
- Medal sizes:
  - 2nd: silver, 24–32 px (by viewport)
  - 3rd: bronze, 24–32 px
  - 4th: no medal; keep left margin for alignment
- Breakdown accordion: same pattern as Winner; collapsed by default

Breakdown itemization (expanded)
- List items show:
  - Per color: “Blue 3 × ×5 = 15”
  - Eyeline (×5 color only): “Blue eyeline 2 × +3 = +6”
  - Decor: “4 × +1 = +4”
  - Bonuses: “Complete Board +5”; “Complete Board +5”
  - Penalties: “Empty corners 2 × −2 = −4”; “Unplaced 1 × −2 = −2”
- Alignment:
  - Numbers right-aligned using tabular figures
  - Labels left-aligned with consistent iconography markers

Footer CTAs
- Primary: “Save Game to History” (navy fill, white text); minimum width 50% on wide screens, full width on narrow
- Secondary: “Start New Game” (navy outline, navy text); left/right order adapts to left‑handed mode emphasis
- Feedback:
  - Success toast: “Saved to History”
  - Error toast: “Save failed. Check connection and try again.”

Asset directions
- Medal icon set: gold, silver, bronze in SVG; provide 24, 32, 40, 48 px
- Laurel watermark SVG: vector wreath with symmetric leaves; export with opacity control
- Chevron and trophy icons: monochrome navy SVGs; maintain stroke consistency

---

## High‑Fidelity Mockups — Production Checklist

Frames to produce (mobile 9:19, 1x and 2x exports)
- Score Entry
  - Default empty state
  - With values (including ×5 color eyeline visible)
  - Prestige lock prompt modal
  - Left‑handed mirrored variant
  - Deuteranopia palette variant
- Results (Trophy Podium)
  - Winner’s Card with shimmer reference frame (static comp without motion)
  - 2nd/3rd/4th cards with medal/icons
  - Breakdown expanded for Winner and for a runner‑up
  - Error toast example (save failed)
- Game Archives
  - History list with several cards (varied player counts 2–4)
  - Empty state
  - Detailed results view (read-only)
- Player Leaderboard
  - Sorted by Wins (default)
  - Sorted by Avg. Score (header active)
  - Empty state

Redlines and tokens on mockups
- Spacing (8 px grid), icon sizes, font sizes/weights, line heights
- Focus outlines placement and thickness
- Color tokens for backgrounds, borders, text, and accents
- Motion notes (durations, easings) annotated near interactive elements

Deliverables
- SVG assets: medals, laurel, shield, minus badge, trophy, chevron, avatars
- Color token sheet (default and CB variants)
- Type scale specimens with tabular numbers
- Interaction states per component (default, hover, focus, active, disabled, error)
