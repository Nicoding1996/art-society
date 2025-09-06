"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";

/* =========================================================================
   Art Society Scorer — MVP + Player Identity System (local-first)
   - Prestige Track (reorder via buttons; locks after any input)
   - Painting rows follow Prestige order top→bottom: ×2, ×3, ×4, ×5
   - 2–4 Player Cards with steppers (0–20), bonuses, penalties
   - Eyeline bonus +3 per tile for the current ×5 color only (clamped to total)
   - Calculate Scores → Results podium with breakdown
   - Save to History (localStorage) + visible toast
   - Player Identity Library (localStorage): assign players via header popover
     • Entire Player Card header is the trigger (large tap target)
     • Typeahead search to assign existing player or create a new one
     • Recent players chips; duplicate-in-game protection with swap prompt
     • One-time toast when the first new player is created
     • “Use last lineup?” subtle link under Players control
   - Left-handed + Color-blind palette toggles applied to :root dataset
   ========================================================================= */

type Color = "red" | "blue" | "yellow" | "green";
type Multiplier = 5 | 4 | 3 | 2;

type PrestigeOrderItem = {
  color: Color;
  multiplier: Multiplier;
};

type Breakdown = {
  perColor: Record<Color, { tiles: number; multiplier: number; points: number }>;
  eyeline: { tiles: number; perTile: number; points: number };
  decor: number;
  bonuses: { completeBoard: number };
  penalties: { emptyCorners: number; unplacedPaintings: number };
};

type Player = {
  id: string; // stable card id p1..p4 (NOT identity)
  playerId?: string; // identity id from library
  name: string; // display name shown on card (from identity or default placeholder)
  paintings: Record<Color, number>;
  eyelineCountForX5: number;
  decorCount: number;
  completeBoard: boolean;
  penalties: {
    emptyCorners: number;
    unplacedPaintings: number;
  };
  finalScore?: number;
  breakdown?: Breakdown;
};

type Game = {
  id: string;
  createdAt: string;
  prestigeOrder: PrestigeOrderItem[];
  players: Player[]; // persisted as snapshot (includes names at save-time)
  version: number;
};

/* =========================
   Player Identity Library
   ========================= */

type PlayerIdentity = {
  id: string; // identity id
  canonical: string;
  displayName: string;
  avatarKey?: string;
  colorHint?: string;
  createdAt: string; // ISO
  lastPlayedAt?: string; // ISO
  gamesPlayed?: number;
  wins?: number;
};

type Lineup = {
  id: string;
  size: number;
  playerIds: string[]; // order matters
  lastUsedAt: string; // ISO
  uses: number;
};

const LIB_KEYS = {
  players: "art-society:players",
  lineups: "art-society:lineups",
  firstCreatedFlag: "art-society:first-player-created",
  history: "art-society:history",
} as const;

function canonicalizeName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  // Normalize: collapse internal spaces, strip diacritics, lowercase
  const collapsed = trimmed.replace(/\s+/g, " ");
  const nfkd = collapsed.normalize("NFKD");
  const stripped = nfkd.replace(/[\u0300-\u036f]/g, ""); // diacritics
  const cleaned = stripped.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""); // strip edge punct
  return cleaned.toLowerCase();
}

function levenshtein1(a: string, b: string): boolean {
  // Quick check: true if edit distance <= 1 (insert/delete/replace)
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  // Ensure a is the shorter
  if (la > lb) return levenshtein1(b, a);
  // Now la <= lb
  let i = 0, j = 0, edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i++; j++; continue;
    }
    edits++;
    if (edits > 1) return false;
    if (la === lb) { i++; j++; }        // substitution
    else { j++; }                       // insertion into a (or deletion from b)
  }
  // Tail
  if (j < lb || i < la) edits++;
  return edits <= 1;
}

function loadLibrary(): PlayerIdentity[] {
  try {
    const raw = localStorage.getItem(LIB_KEYS.players);
    return raw ? (JSON.parse(raw) as PlayerIdentity[]) : [];
  } catch {
    return [];
  }
}
function saveLibrary(list: PlayerIdentity[]) {
  localStorage.setItem(LIB_KEYS.players, JSON.stringify(list));
}

function loadLineups(): Lineup[] {
  try {
    const raw = localStorage.getItem(LIB_KEYS.lineups);
    return raw ? (JSON.parse(raw) as Lineup[]) : [];
  } catch {
    return [];
  }
}
function saveLineups(list: Lineup[]) {
  localStorage.setItem(LIB_KEYS.lineups, JSON.stringify(list));
}

function ulidLike(): string {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10).toUpperCase();
}

/* =========================
   Scoring helpers
   ========================= */

const COLORS: Color[] = ["red", "blue", "yellow", "green"];
const DEFAULT_PRESTIGE: PrestigeOrderItem[] = [
  { color: "blue", multiplier: 5 },
  { color: "green", multiplier: 4 },
  { color: "red", multiplier: 3 },
  { color: "yellow", multiplier: 2 },
];

function colorLabel(color: Color): string {
  // charAt(0) safely returns "" for empty strings, avoiding TS "possibly undefined"
  return color.charAt(0).toUpperCase() + color.slice(1);
}

function multiplierMap(order: PrestigeOrderItem[]): Record<Color, Multiplier> {
  const map = {
    red: 2,
    blue: 2,
    yellow: 2,
    green: 2,
  } as Record<Color, Multiplier>;
  order.forEach((item) => (map[item.color] = item.multiplier));
  return map;
}

function findX5Color(order: PrestigeOrderItem[]): Color {
  const item = order.find((o) => o.multiplier === 5)!;
  return item.color;
}

function computeScore(
  player: Player,
  multipliers: Record<Color, Multiplier>,
  x5Color: Color
): { finalScore: number; breakdown: Breakdown } {
  const perColor: Breakdown["perColor"] = {
    red: { tiles: player.paintings.red, multiplier: multipliers.red, points: 0 },
    blue: { tiles: player.paintings.blue, multiplier: multipliers.blue, points: 0 },
    yellow: { tiles: player.paintings.yellow, multiplier: multipliers.yellow, points: 0 },
    green: { tiles: player.paintings.green, multiplier: multipliers.green, points: 0 },
  };

  let paintingSum = 0;
  (Object.keys(perColor) as Color[]).forEach((c) => {
    const pts = perColor[c].tiles * perColor[c].multiplier;
    perColor[c].points = pts;
    paintingSum += pts;
  });

  const eyelineTiles = Math.min(player.eyelineCountForX5, player.paintings[x5Color]);
  const eyelinePoints = eyelineTiles * 3;

  const decorPoints = player.decorCount * 1;
  const bonuses = player.completeBoard ? 5 : 0;
  const penalties =
    player.penalties.emptyCorners * 2 + player.penalties.unplacedPaintings * 2;

  const finalScore =
    paintingSum + eyelinePoints + decorPoints + bonuses - penalties;

  const breakdown: Breakdown = {
    perColor,
    eyeline: { tiles: eyelineTiles, perTile: 3, points: eyelinePoints },
    decor: decorPoints,
    bonuses: { completeBoard: player.completeBoard ? 5 : 0 },
    penalties: {
      emptyCorners: player.penalties.emptyCorners * 2,
      unplacedPaintings: player.penalties.unplacedPaintings * 2,
    },
  };

  return { finalScore, breakdown };
}

/* =========================
   UI Controls
   ========================= */

function Stepper({
  label,
  value,
  setValue,
  min = 0,
  max = 20,
  ariaLabel,
  disabled,
  id,
}: {
  label?: string;
  value: number;
  setValue: (n: number) => void;
  min?: number;
  max?: number;
  ariaLabel?: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <div className="row" aria-live="off">
      {label ? (
        <div style={{ minWidth: 80 }} className="caption">
          {label}
        </div>
      ) : null}
      <div
        className="stepper"
        role="spinbutton"
        aria-label={ariaLabel ?? label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-disabled={disabled}
      >
        <button
          type="button"
          onClick={() => setValue(Math.max(min, value - 1))}
          disabled={disabled || value <= min}
          aria-controls={id}
          aria-label="Decrease"
        >
          −
        </button>
        <div
          id={id}
          className="value"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </div>
        <button
          type="button"
          onClick={() => setValue(Math.min(max, value + 1))}
          disabled={disabled || value >= max}
          aria-controls={id}
          aria-label="Increase"
        >
          +
        </button>
      </div>
    </div>
  );
}

function Check({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (b: boolean) => void;
  label: string;
}) {
  return (
    <label className="checkbox" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <span>{label}</span>
    </label>
  );
}

/* =========================
   Identity Popover (inline)
   ========================= */

function IdentityPopover({
  close,
  assignExisting,
  createNew,
  library,
  excludeIds,
  initialValue,
  setToast,
}: {
  close: () => void;
  assignExisting: (pid: string) => void;
  createNew: (name: string) => void;
  library: PlayerIdentity[];
  excludeIds: string[]; // already selected in this game
  initialValue: string;
  setToast: (msg: string) => void;
}) {
  const [q, setQ] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const canonical = canonicalizeName(q);

  const recents = useMemo(() => {
    const sorted = [...library]
      .filter((p) => !excludeIds.includes(p.id))
      .sort((a, b) => {
        const da = a.lastPlayedAt ? Date.parse(a.lastPlayedAt) : 0;
        const db = b.lastPlayedAt ? Date.parse(b.lastPlayedAt) : 0;
        return db - da;
      })
      .slice(0, 6);
    return sorted;
  }, [library, excludeIds]);

  const suggestions = useMemo(() => {
    const list = library.filter((p) => !excludeIds.includes(p.id));
    const starts = list.filter((p) => p.canonical.startsWith(canonical) && canonical.length > 0);
    const contains = list.filter(
      (p) => canonical.length > 0 && !starts.includes(p) && p.canonical.includes(canonical)
    );
    const typo = list.filter(
      (p) => canonical.length > 0 && !starts.includes(p) && !contains.includes(p) && levenshtein1(p.canonical, canonical)
    );
    return [...starts, ...contains, ...typo].slice(0, 8);
  }, [library, excludeIds, canonical]);

  const existingExact = useMemo(
    () => library.find((p) => p.canonical === canonical),
    [library, canonical]
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="card"
      style={{
        position: "absolute",
        top: 56,
        left: 8,
        right: 8,
        zIndex: 20,
        background: "var(--cream)",
      }}
    >
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search or add player"
          aria-label="Search or add player"
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            outline: "none",
            fontWeight: 700,
            fontSize: 16,
            padding: "6px 0",
          }}
        />
        <button className="btn btn-outline" style={{ height: 32 }} onClick={() => setQ("")} aria-label="Clear player">
          ×
        </button>
        <button className="btn btn-outline" style={{ height: 32 }} onClick={close} aria-label="Close">
          Close
        </button>
      </div>

      {/* Recents */}
      {recents.length > 0 && (
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {recents.map((p) => (
            <button
              key={p.id}
              className="btn btn-outline"
              style={{ height: 32, paddingInline: 10 }}
              onClick={() => { assignExisting(p.id); close(); }}
              aria-label={`Recent player ${p.displayName}`}
            >
              {p.displayName}
            </button>
          ))}
        </div>
      )}

      <div className="divider" />

      {/* Suggestions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
        {suggestions.map((p) => (
          <button
            key={p.id}
            className="btn btn-outline"
            style={{ justifyContent: "space-between" }}
            onClick={() => { assignExisting(p.id); close(); }}
            aria-label={`Select player ${p.displayName}`}
          >
            <span>{p.displayName}</span>
            <span className="caption">Played {p.gamesPlayed ?? 0}</span>
          </button>
        ))}
        {/* Create new */}
        {canonical && !existingExact && (
          <button
            className="btn btn-primary"
            onClick={() => { createNew(q.trim()); close(); }}
            aria-label={`Create player ${q.trim()}`}
          >
            Create player ‘{q.trim()}’
          </button>
        )}
        {!canonical && suggestions.length === 0 && recents.length === 0 && (
          <div className="caption" style={{ paddingBlock: 6 }}>Start typing a name…</div>
        )}
      </div>
    </div>
  );
}

/* =========================
   Player Card
   ========================= */

function PlayerCard({
  index,
  player,
  setPlayer,
  multipliers,
  x5Color,
  locked,
  announce,
  order,
  // Identity props
  library,
  selectedIdsExcludingSelf,
  assignIdentity,
  createIdentity,
  setToast,
}: {
  index: number;
  player: Player;
  setPlayer: (p: Player) => void;
  multipliers: Record<Color, Multiplier>;
  x5Color: Color;
  locked: boolean;
  announce: (msg: string) => void;
  order: PrestigeOrderItem[];
  library: PlayerIdentity[];
  selectedIdsExcludingSelf: string[];
  assignIdentity: (idx: number, playerId: string, fallbackName?: string) => void;
  createIdentity: (name: string, onAssigned: (id: string, displayName: string) => void) => void;
  setToast: (msg: string) => void;
}) {
  const setPaint = (color: Color, n: number) => {
    const next = { ...player, paintings: { ...player.paintings, [color]: n } };
    if (color === x5Color && next.eyelineCountForX5 > n) {
      next.eyelineCountForX5 = n;
      announce("Eyeline reduced to match total");
    }
    setPlayer(next);
  };

  const setEyeline = (n: number) => {
    const max = player.paintings[x5Color];
    setPlayer({ ...player, eyelineCountForX5: Math.min(n, max) });
  };

  // Live player subtotal
  const total = useMemo(() => {
    const { finalScore } = computeScore(player, multipliers, x5Color);
    return finalScore;
  }, [player, multipliers, x5Color]);

  // Press-and-hold "peek" for total score
  const [peek, setPeek] = useState(false);

  // Painting rows ordered by Prestige Track: ×2 (top) -> ×5 (bottom)
  const orderedColors: Color[] = useMemo(
    () => [...order].sort((a, b) => a.multiplier - b.multiplier).map((o) => o.color),
    [order]
  );

  const [openId, setOpenId] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!openId) return;
    function onDoc(e: MouseEvent) {
      const el = headerRef.current?.parentElement as HTMLElement | undefined;
      if (!el) return;
      const card = el; // section .card
      const target = e.target as Node;
      if (!card.contains(target)) {
        setOpenId(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openId]);

  return (
    <section className="card" aria-labelledby={`player-${player.id}-title`} style={{ position: "relative" }}>
      {/* Header: entire region is a trigger */}
      <div
        ref={headerRef}
        className="card-header"
        role="button"
        tabIndex={0}
        onClick={() => setOpenId(true)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(true); } }}
        aria-haspopup="dialog"
        aria-expanded={openId}
        aria-controls={`id-popover-${player.id}`}
        style={{ cursor: "pointer" }}
      >
        <div className="row" style={{ gap: 12 }}>
          <div
            aria-hidden
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: "2px solid rgba(13,27,42,0.2)",
              background: player.playerId ? "rgba(13,27,42,0.08)" : "transparent",
            }}
          />
          <div id={`player-${player.id}-title`} className="card-title" style={{ fontSize: 16 }}>
            {player.name || `Player ${index + 1}`}
          </div>
        </div>
      </div>

      {/* Identity Popover */}
      {openId && (
        <div id={`id-popover-${player.id}`}>
          <IdentityPopover
            close={() => setOpenId(false)}
            assignExisting={(pid) => assignIdentity(index, pid)}
            createNew={(name) => createIdentity(name, (pid, display) => assignIdentity(index, pid, display))}
            library={library}
            excludeIds={selectedIdsExcludingSelf}
            initialValue={player.name || ""}
            setToast={setToast}
          />
        </div>
      )}

      <div className="section-title">Painting Tiles</div>

      {orderedColors.map((c) => {
        const mul = multipliers[c];
        return (
          <div key={c} className="row" style={{ justifyContent: "space-between" }}>
            <div className="row" style={{ gap: 12 }}>
              <span
                className={`circle ${c}`}
                aria-hidden
                style={{ width: 18, height: 18, borderRadius: "50%" }}
              />
              <span>{colorLabel(c)}</span>
              <span className="caption">×{mul}</span>
            </div>
            <Stepper
              value={player.paintings[c]}
              setValue={(n) => setPaint(c, n)}
              min={0}
              max={20}
              ariaLabel={`${colorLabel(c)} tiles`}
              id={`p-${player.id}-${c}`}
            />
          </div>
        );
      })}

      {/* Eyeline for ×5 color */}
      <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
        <div className="row" style={{ gap: 12 }}>
          <span className="caption">
            Eyeline tiles ({colorLabel(x5Color)} ×5 only, +3 each)
          </span>
        </div>
        <Stepper
          value={player.eyelineCountForX5}
          setValue={setEyeline}
          min={0}
          max={player.paintings[x5Color]}
          ariaLabel="Eyeline tiles for ×5 color"
          id={`p-${player.id}-eyeline`}
        />
      </div>

      <div className="divider" />

      <div className="section-title">Gallery Bonuses</div>

      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="caption">Decor Tiles (+1 each)</span>
        </div>
        <Stepper
          value={player.decorCount}
          setValue={(n) => setPlayer({ ...player, decorCount: n })}
          min={0}
          max={20}
          ariaLabel="Decor tiles"
          id={`p-${player.id}-decor`}
        />
      </div>

      <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
        <Check
          id={`p-${player.id}-complete`}
          checked={player.completeBoard}
          onChange={(b) => setPlayer({ ...player, completeBoard: b })}
          label="Complete Board +5"
        />
      </div>

      <div className="divider" />

      <div className="section-title warning">Penalties</div>

      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="caption">Empty Corners (−2 each)</span>
        <Stepper
          value={player.penalties.emptyCorners}
          setValue={(n) =>
            setPlayer({
              ...player,
              penalties: { ...player.penalties, emptyCorners: n },
            })
          }
          min={0}
          max={20}
          ariaLabel="Empty corners"
          id={`p-${player.id}-ec`}
        />
      </div>

      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="caption">Unplaced Paintings (−2 each)</span>
        <Stepper
          value={player.penalties.unplacedPaintings}
          setValue={(n) =>
            setPlayer({
              ...player,
              penalties: { ...player.penalties, unplacedPaintings: n },
            })
          }
          min={0}
          max={20}
          ariaLabel="Unplaced paintings"
          id={`p-${player.id}-up`}
        />
      </div>

      <div className="divider" />

      {/* Player Total with press-and-hold peek */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <strong>Player Total</strong>
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <strong aria-live="off">{peek ? total : "***"}</strong>
          <button
            className="btn btn-outline"
            style={{ height: 32, paddingInline: 8 }}
            aria-label="Press and hold to peek total score"
            onMouseDown={() => setPeek(true)}
            onMouseUp={() => setPeek(false)}
            onMouseLeave={() => setPeek(false)}
            onTouchStart={() => setPeek(true)}
            onTouchEnd={() => setPeek(false)}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                setPeek(true);
              }
            }}
            onKeyUp={() => setPeek(false)}
          >
            {peek ? (
              // open eye
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path fill="currentColor" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/>
              </svg>
            ) : (
              // slashed eye
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path fill="currentColor" d="M3.27 2 2 3.27 5.11 6.4A12.35 12.35 0 0 0 2 12s3 7 10 7a10.53 10.53 0 0 0 4.6-1.02l2.13 2.13L20 19.73 3.27 2zM12 17c-5.52 0-8.46-4.27-9.44-5 .35-.26 1.39-1.02 2.86-1.74l2.02 2.02A5 5 0 0 0 12 17zm0-10c5.52 0 8.46 4.27 9.44 5-.28.21-.99.72-1.98 1.28l-1.53-1.53A5 5 0 0 0 12 7z"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

/* =========================
   Helpers
   ========================= */

function swap<T>(arr: T[], i: number, j: number): T[] {
  const copy = arr.slice();
  // Use non-null assertions to satisfy the TS compiler here — indices are controlled by callers.
  const tmp = copy[i]!;
  copy[i] = copy[j]!;
  copy[j] = tmp;
  return copy;
}

function hasAnyInput(players: Player[]): boolean {
  return players.some((p) => {
    if (p.eyelineCountForX5 > 0) return true;
    if (p.decorCount > 0) return true;
    if (p.completeBoard) return true;
    if (p.penalties.emptyCorners > 0 || p.penalties.unplacedPaintings > 0) return true;
    return COLORS.some((c) => p.paintings[c] > 0);
  });
}

function defaultPlayer(i: number): Player {
  return {
    id: `p${i}`,
    name: `Player ${i}`,
    paintings: { red: 0, blue: 0, yellow: 0, green: 0 },
    eyelineCountForX5: 0,
    decorCount: 0,
    completeBoard: false,
    penalties: { emptyCorners: 0, unplacedPaintings: 0 },
  };
}

/* =========================
   Page
   ========================= */

export default function Page() {
  // Global UI options
  const [leftHanded, setLeftHanded] = useState(false);
  const [palette, setPalette] = useState<"default" | "deuteranopia" | "protanopia" | "tritanopia">("default");

  // Game state
  const [prestige, setPrestige] = useState<PrestigeOrderItem[]>(DEFAULT_PRESTIGE);
  const [players, setPlayers] = useState<Player[]>([defaultPlayer(1), defaultPlayer(2)]);
  const [resultsMode, setResultsMode] = useState(false);
  const [announceMsg, setAnnounceMsg] = useState<string>("");

  // Identity library + lineups
  const [library, setLibrary] = useState<PlayerIdentity[]>([]);
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [showArchives, setShowArchives] = useState(false);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-left-handed", String(leftHanded));
  }, [leftHanded]);

  useEffect(() => {
    document.documentElement.setAttribute("data-palette", palette);
  }, [palette]);

  useEffect(() => {
    // Load identity data
    setLibrary(loadLibrary());
    setLineups(loadLineups());
  }, []);

  const locked = useMemo(() => hasAnyInput(players), [players]);
  const x5Color = findX5Color(prestige);
  const multipliers = useMemo(() => multiplierMap(prestige), [prestige]);

  // Auto-hide toast after 2.5s
  useEffect(() => {
    if (!announceMsg) return;
    const t = setTimeout(() => setAnnounceMsg(""), 2500);
    return () => clearTimeout(t);
  }, [announceMsg]);

  const setPlayerAt = (idx: number, patch: Player) => {
    setPlayers((ps) => ps.map((p, i) => (i === idx ? patch : p)));
  };

  const addPlayer = () => {
    setPlayers((ps) => {
      if (ps.length >= 4) return ps;
      const nextIndex = ps.length + 1;
      return [...ps, defaultPlayer(nextIndex)];
    });
  };
  const removePlayer = () => {
    setPlayers((ps) => (ps.length <= 2 ? ps : ps.slice(0, ps.length - 1)));
  };

  // Identity operations
  const assignIdentity = (idx: number, playerId: string, fallbackName?: string) => {
    setPlayers((ps) => {
      // Determine chosen name from library or fallback
      const chosenObj = library.find((l) => l.id === playerId);
      const chosenName = chosenObj?.displayName ?? fallbackName ?? `Player ${idx + 1}`;

      // Prevent duplicate selection within same game; offer swap
      const existingIdx = ps.findIndex((p, i) => i !== idx && p.playerId === playerId);
      if (existingIdx !== -1) {
        const other = ps[existingIdx]!;
        const confirmSwap = window.confirm(
          `${chosenName} is already on Player ${existingIdx + 1}. Swap to Player ${idx + 1}?`
        );
        if (!confirmSwap) return ps;
        // Clear other
        const cleared: Player = { ...other, playerId: undefined, name: `Player ${existingIdx + 1}` };
        // Assign here
        const current: Player = ps[idx]!;
        const assigned: Player = { ...current, playerId, name: chosenName };
        const next = ps.slice();
        next[existingIdx] = cleared;
        next[idx] = assigned;
        return next;
      }
      // Normal assign
      const current: Player = ps[idx]!;
      const finalName = chosenObj?.displayName ?? fallbackName ?? current.name;
      const updated: Player = { ...current, playerId, name: finalName };
      return ps.map((p, i) => (i === idx ? updated : p));
    });
  };

  const createIdentity = (rawName: string, onAssigned: (id: string, displayName: string) => void) => {
    const displayName = rawName.trim();
    if (!displayName) return;
    const canonical = canonicalizeName(displayName);
    setLibrary((lib) => {
      const exists = lib.find((p) => p.canonical === canonical);
      if (exists) {
        // Update display name casing if different
        if (exists.displayName !== displayName) {
          const updated = lib.map((p) => (p.id === exists.id ? { ...p, displayName } : p));
          saveLibrary(updated);
          onAssigned(exists.id, displayName);
          return updated;
        }
        onAssigned(exists.id, exists.displayName);
        return lib;
      }
      const id = ulidLike();
      const now = new Date().toISOString();
      const created: PlayerIdentity = {
        id,
        canonical,
        displayName,
        createdAt: now,
        gamesPlayed: 0,
      };
      const next = [created, ...lib];
      saveLibrary(next);
      onAssigned(id, displayName);
      // One-time toast for first creation
      try {
        const flag = localStorage.getItem(LIB_KEYS.firstCreatedFlag);
        if (!flag) {
          setAnnounceMsg(`✓ ${displayName} has been saved to your player library.`);
          localStorage.setItem(LIB_KEYS.firstCreatedFlag, "true");
        }
      } catch { /* ignore */ }
      return next;
    });
  };

  // "Use last lineup?" subtle link (show only when applicable)
  const lastLineupForSize = useMemo(() => {
    const size = players.length;
    // Only consider complete lineups with correct length and resolvable ids
    const complete = lineups
      .filter((l) => l.size === size && l.playerIds.length === size)
      .filter((l) => l.playerIds.every((id) => library.some((p) => p.id === id)));
    if (complete.length === 0) return undefined;
    return complete.slice().sort((a, b) => Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt))[0];
  }, [lineups, players.length, library]);

  const allCardsUnassigned = useMemo(
    () => players.every((p, idx) => !p.playerId && (p.name === `Player ${idx + 1}` || !p.name)),
    [players]
  );

  const applyLastLineup = () => {
    if (!lastLineupForSize) return;
    // Refresh library from storage to avoid stale state
    let lib = library;
    try {
      lib = loadLibrary();
    } catch {}
    const mapById = new Map(lib.map((x) => [x.id, x]));
    setPlayers((ps) =>
      ps.map((p, i) => {
        const pid = lastLineupForSize.playerIds[i];
        if (pid && mapById.has(pid)) {
          const id = pid;
          const display = mapById.get(id)!.displayName;
          return { ...p, playerId: id, name: display };
        }
        // Keep existing assignment/name if missing, otherwise fallback
        return { ...p, playerId: p.playerId, name: p.name || `Player ${i + 1}` };
      })
    );
    setAnnounceMsg("Last lineup applied");
  };

  const canCalculate = hasAnyInput(players);

  const calculate = () => {
    // compute scores and switch to results
    const withScores = players.map((p) => {
      const { finalScore, breakdown } = computeScore(p, multipliers, x5Color);
      return { ...p, finalScore, breakdown };
    });

    // Sort: finalScore desc, tiebreak decorCount desc, then name asc
    withScores.sort((a, b) => {
      const d = (b.finalScore ?? 0) - (a.finalScore ?? 0);
      if (d !== 0) return d;
      const d2 = b.decorCount - a.decorCount;
      if (d2 !== 0) return d2;
      return a.name.localeCompare(b.name);
    });

    setPlayers(withScores);
    setResultsMode(true);
  };

  const saveGame = async () => {
    const data: Game = {
      id: `g-${Date.now()}`,
      createdAt: new Date().toISOString(),
      prestigeOrder: prestige,
      players,
      version: 1,
    };

    // Cloud-first: attempt authoritative save to /api/sync.
    // If the cloud save fails, fall back to local-only persistence so the app remains usable offline.
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: data }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Cloud save failed: ${res.status} ${text}`);
      }
      const payload = await res.json().catch(() => ({}));
      if (!payload?.ok) {
        // Treat as failure but continue to mirror locally for UI consistency
        console.warn("Cloud returned non-ok:", payload);
      }

      // Mirror authoritative save locally so Archives still reads quickly and offline.
      try {
        const hxRaw = localStorage.getItem(LIB_KEYS.history);
        const existing = hxRaw ? (JSON.parse(hxRaw) as Game[]) : [];
        existing.unshift(data);
        localStorage.setItem(LIB_KEYS.history, JSON.stringify(existing));
      } catch {
        // Ignore local mirror errors
      }

      // Update local library/lineups so UI reflects server state immediately
      try {
        const idsUsed = players.map((p) => p.playerId).filter(Boolean) as string[];
        if (idsUsed.length > 0) {
          const now = new Date().toISOString();
          let winnerId: string | undefined;
          if (players.every((p) => typeof p.finalScore === "number" && p.playerId)) {
            const sorted = players.slice().sort((a, b) => {
              const d = (b.finalScore ?? 0) - (a.finalScore ?? 0);
              if (d !== 0) return d;
              const d2 = b.decorCount - a.decorCount;
              if (d2 !== 0) return d2;
              return a.name.localeCompare(b.name);
            });
            winnerId = sorted[0].playerId;
          }

          setLibrary((lib) => {
            const setIds = new Set(idsUsed);
            const updated = lib.map((pl) =>
              setIds.has(pl.id)
                ? {
                    ...pl,
                    lastPlayedAt: now,
                    gamesPlayed: (pl.gamesPlayed ?? 0) + 1,
                    wins: pl.id === winnerId ? (pl.wins ?? 0) + 1 : pl.wins ?? 0,
                  }
                : pl
            );
            try { saveLibrary(updated); } catch {}
            return updated;
          });

          if (idsUsed.length === players.length) {
            setLineups((ls) => {
              const size = players.length;
              const signature = idsUsed.join("|");
              let found = ls.find((l) => l.size === size && l.playerIds.join("|") === signature);
              const nowIso = new Date().toISOString();
              if (found) {
                found.uses += 1;
                found.lastUsedAt = nowIso;
                const next = ls.slice();
                try { saveLineups(next); } catch {}
                return next;
              } else {
                const newEntry: Lineup = {
                  id: ulidLike(),
                  size,
                  playerIds: idsUsed,
                  lastUsedAt: nowIso,
                  uses: 1,
                };
                const next = [newEntry, ...ls];
                try { saveLineups(next); } catch {}
                return next;
              }
            });
          }
        }
      } catch {
        // ignore local update errors
      }

      setAnnounceMsg("Saved to Cloud");
    } catch (cloudErr) {
      console.warn("Cloud save failed, falling back to local save", cloudErr);

      // Fallback local persistence (preserve previous behavior)
      try {
        const hxRaw = localStorage.getItem(LIB_KEYS.history);
        const existing = hxRaw ? (JSON.parse(hxRaw) as Game[]) : [];
        existing.unshift(data);
        localStorage.setItem(LIB_KEYS.history, JSON.stringify(existing));

        const idsUsed = players.map((p) => p.playerId).filter(Boolean) as string[];
        if (idsUsed.length > 0) {
          const now = new Date().toISOString();
          let winnerId: string | undefined;
          if (players.every((p) => typeof p.finalScore === "number" && p.playerId)) {
            const sorted = players.slice().sort((a, b) => {
              const d = (b.finalScore ?? 0) - (a.finalScore ?? 0);
              if (d !== 0) return d;
              const d2 = b.decorCount - a.decorCount;
              if (d2 !== 0) return d2;
              return a.name.localeCompare(b.name);
            });
            winnerId = sorted[0].playerId;
          }

          setLibrary((lib) => {
            const setIds = new Set(idsUsed);
            const updated = lib.map((pl) =>
              setIds.has(pl.id)
                ? {
                    ...pl,
                    lastPlayedAt: now,
                    gamesPlayed: (pl.gamesPlayed ?? 0) + 1,
                    wins: pl.id === winnerId ? (pl.wins ?? 0) + 1 : pl.wins ?? 0,
                  }
                : pl
            );
            try { saveLibrary(updated); } catch {}
            return updated;
          });

          if (idsUsed.length === players.length) {
            setLineups((ls) => {
              const size = players.length;
              const signature = idsUsed.join("|");
              let found = ls.find((l) => l.size === size && l.playerIds.join("|") === signature);
              const nowIso = new Date().toISOString();
              if (found) {
                found.uses += 1;
                found.lastUsedAt = nowIso;
                const next = ls.slice();
                try { saveLineups(next); } catch {}
                return next;
              } else {
                const newEntry: Lineup = {
                  id: ulidLike(),
                  size,
                  playerIds: idsUsed,
                  lastUsedAt: nowIso,
                  uses: 1,
                };
                const next = [newEntry, ...ls];
                try { saveLineups(next); } catch {}
                return next;
              }
            });
          }
        }

        setAnnounceMsg("Saved locally (cloud unavailable)");
      } catch {
        setAnnounceMsg("Save failed. Check connection and try again.");
      }
    }
  };

  const migrateToSupabase = async () => {
    if (migrating) return;
    const proceed = window.confirm(
      "Migrate local players, games, and lineups to Supabase now?"
    );
    if (!proceed) return;
    try {
      setMigrating(true);
      const playersLib = loadLibrary();
      let history: Game[] = [];
      try {
        const raw = localStorage.getItem(LIB_KEYS.history);
        history = raw ? (JSON.parse(raw) as Game[]) : [];
      } catch {
        history = [];
      }
      const lineupsLib = loadLineups();

      const res = await fetch("/api/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          players: playersLib,
          history,
          lineups: lineupsLib,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const pc = data?.counts?.players ?? playersLib.length;
      const gc = data?.counts?.games ?? history.length;
      const lc = data?.counts?.lineups ?? lineupsLib.length;
      setAnnounceMsg(`Migration complete ✓ players:${pc} games:${gc} lineups:${lc}`);
    } catch (e) {
      console.error(e);
      setAnnounceMsg("Migration failed. Check server config.");
    } finally {
      setMigrating(false);
    }
  };

  const startNew = () => {
    setPrestige(DEFAULT_PRESTIGE);
    setPlayers([defaultPlayer(1), defaultPlayer(2)]);
    setResultsMode(false);
    setAnnounceMsg("");
  };

  return (
    <main className="stack" style={{ paddingBottom: 80 }}>
      {/* Header */}
      <header className="stack" style={{ gap: 4, marginTop: 16 }}>
        <h1 className="h1" style={{ textAlign: "center" }}>
          Art Society Scorer
        </h1>
        <div className="row" style={{ justifyContent: "center", gap: 8 }}>
          <label className="toggle" htmlFor="left-handed" style={{ gap: 8 }}>
            <input
              id="left-handed"
              type="checkbox"
              checked={leftHanded}
              onChange={(e) => setLeftHanded(e.target.checked)}
              aria-label="Left-handed mode"
            />
            <span className="track">
              <span className="thumb" />
            </span>
            <span>Left-handed</span>
          </label>
          <div className="row" style={{ gap: 8 }}>
            <label className="caption" htmlFor="palette">
              Palette
            </label>
            <select
              id="palette"
              value={palette}
              onChange={(e) =>
                setPalette(e.target.value as typeof palette)
              }
              style={{
                borderRadius: 10,
                border: "1px solid rgba(13,27,42,0.18)",
                padding: "6px 10px",
                background: "white",
              }}
              aria-label="Color-blind palette"
            >
              <option value="default">Default</option>
              <option value="deuteranopia">Deuteranopia</option>
              <option value="protanopia">Protanopia</option>
              <option value="tritanopia">Tritanopia</option>
            </select>
          </div>
          <button
            className="btn btn-outline"
            aria-label="Open Game Archives"
            style={{ height: 32 }}
            onClick={() => setShowArchives(true)}
          >
            Archives
          </button>
          <button
            className="btn btn-outline"
            aria-label="Migrate local data to Supabase"
            style={{ height: 32 }}
            onClick={migrateToSupabase}
            disabled={migrating}
          >
            Migrate
          </button>
        </div>
      </header>

      {!resultsMode ? (
        <>
          {/* Setup */}
          <PrestigeTrack order={prestige} setOrder={locked ? () => {} : setPrestige} locked={locked} />

          {/* Player count controls */}
          <section className="card">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div className="section-title">Players</div>
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                {/* Subtle power-user link: Use last lineup? */}
                {lastLineupForSize && allCardsUnassigned && (
                  <button
                    className="btn btn-outline"
                    onClick={applyLastLineup}
                    aria-label="Use last lineup"
                    style={{
                      height: 28,
                      paddingInline: 8,
                      borderColor: "transparent",
                      color: "rgba(13,27,42,0.8)",
                      textDecoration: "underline",
                    }}
                  >
                    Use last lineup?
                  </button>
                )}
                <button
                  className="btn btn-outline"
                  onClick={removePlayer}
                  disabled={players.length <= 2}
                  aria-label="Remove player"
                >
                  −
                </button>
                <div aria-live="polite" style={{ minWidth: 40, textAlign: "center" }}>
                  {players.length}
                </div>
                <button
                  className="btn btn-outline"
                  onClick={addPlayer}
                  disabled={players.length >= 4}
                  aria-label="Add player"
                >
                  +
                </button>
              </div>
            </div>
          </section>

          {/* Player cards */}
          {players.map((p, idx) => {
            const selectedIdsExcludingSelf = players
              .map((pp, ii) => (ii === idx ? undefined : pp.playerId))
              .filter(Boolean) as string[];
            return (
              <PlayerCard
                key={p.id}
                index={idx}
                player={p}
                setPlayer={(np) => setPlayerAt(idx, np)}
                multipliers={multipliers}
                x5Color={x5Color}
                locked={locked}
                announce={(msg) => setAnnounceMsg(msg)}
                order={prestige}
                library={library}
                selectedIdsExcludingSelf={selectedIdsExcludingSelf}
                assignIdentity={assignIdentity}
                createIdentity={createIdentity}
                setToast={setAnnounceMsg}
              />
            );
          })}

          {/* Footer calculate */}
          <div className="footer-bar">
            <div className="footer-utility">
              <div className="caption" aria-live="polite">
                {locked ? "Prestige order locked" : "Set up Prestige order"}
              </div>
              <button
                className="btn btn-primary"
                disabled={!canCalculate}
                onClick={calculate}
                aria-disabled={!canCalculate}
              >
                Calculate Scores
              </button>
            </div>
          </div>
        </>
      ) : (
        <Results
          playersSorted={players.map((p, i) => ({
            name: p.name,
            finalScore: p.finalScore ?? 0,
            breakdown: p.breakdown as Breakdown,
            rank: i + 1,
            decorCount: p.decorCount,
          }))}
          onSave={saveGame}
          onNew={startNew}
        />
      )}

      {/* Visible toast */}
      {announceMsg ? (
        <div
          role="status"
          aria-live="polite"
          className="toast"
          style={{
            position: "fixed",
            left: 16,
            right: 16,
            bottom: 88,
            zIndex: 50,
            borderRadius: 10,
            background: "color-mix(in oklab, var(--navy) 92%, black)",
            color: "white",
            padding: "10px 12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            textAlign: "center",
          }}
        >
          {announceMsg}
        </div>
      ) : null}

      {/* SR-only live region for other announcements */}
      <div className="visually-hidden" aria-live="polite">
        {announceMsg}
      </div>

      {/* Archives modal */}
      {showArchives ? (
        <ArchivesModal
          close={() => setShowArchives(false)}
          library={library}
        />
      ) : null}
    </main>
  );
}

/* =========================
   Archives Modal (History + Leaderboard)
   ========================= */

function ArchivesModal({
  close,
  library,
}: {
  close: () => void;
  library: PlayerIdentity[];
}) {
  const [tab, setTab] = useState<"history" | "leaderboard">("history");
  const [history, setHistory] = useState<Game[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LIB_KEYS.history);
      setHistory(raw ? (JSON.parse(raw) as Game[]) : []);
    } catch {
      setHistory([]);
    }
  }, []);

  // Leaderboard derived from library (wins desc default, then gamesPlayed desc, then name asc)
  const leaderboard = useMemo(() => {
    const rows = [...library].map((p) => ({
      id: p.id,
      name: p.displayName,
      wins: p.wins ?? 0,
      games: p.gamesPlayed ?? 0,
      avg: 0,
      high: 0,
    }));

    // Derive avg/high from saved games if available
    try {
      const raw = localStorage.getItem(LIB_KEYS.history);
      const hx = raw ? (JSON.parse(raw) as Game[]) : [];
      const sums = new Map<string, { total: number; count: number; high: number }>();
      for (const g of hx) {
        for (const pl of g.players) {
          if (!pl.playerId || typeof pl.finalScore !== "number") continue;
          const rec = sums.get(pl.playerId) ?? { total: 0, count: 0, high: 0 };
          rec.total += pl.finalScore ?? 0;
          rec.count += 1;
          rec.high = Math.max(rec.high, pl.finalScore ?? 0);
          sums.set(pl.playerId, rec);
        }
      }
      rows.forEach((r) => {
        const rec = sums.get(r.id);
        if (rec && rec.count > 0) {
          r.avg = Math.round((rec.total / rec.count) * 10) / 10;
          r.high = rec.high;
        }
      });
    } catch { /* ignore */ }

    rows.sort((a, b) => {
      const d = b.wins - a.wins;
      if (d !== 0) return d;
      const d2 = b.games - a.games;
      if (d2 !== 0) return d2;
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [library]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="card"
      style={{
        position: "fixed",
        inset: 16,
        zIndex: 60,
        background: "var(--cream)",
        overflow: "auto",
      }}
    >
      {/* Header with responsive alignment */}
      <div
        className="card-header"
        style={{ alignItems: "center", gap: 8, flexWrap: "wrap" }}
      >
        <div
          className="row"
          style={{
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            flex: 1,
            minWidth: 0,
          }}
        >
          <h2 className="h2" style={{ margin: 0, lineHeight: 1.2, whiteSpace: "nowrap" }}>
            Game Archives
          </h2>
          <div
            className="row"
            role="tablist"
            aria-label="Archives tabs"
            style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}
          >
            <button
              role="tab"
              aria-selected={tab === "history"}
              className="btn btn-outline"
              style={{ height: 32, paddingInline: 10 }}
              onClick={() => setTab("history")}
            >
              Game History
            </button>
            <button
              role="tab"
              aria-selected={tab === "leaderboard"}
              className="btn btn-outline"
              style={{ height: 32, paddingInline: 10 }}
              onClick={() => setTab("leaderboard")}
            >
              Player Leaderboard
            </button>
          </div>
        </div>
        <button
          className="btn btn-outline"
          style={{ height: 32, alignSelf: "center" }}
          onClick={close}
          aria-label="Close archives"
        >
          Close
        </button>
      </div>

      {tab === "history" ? (
        <div className="stack" style={{ gap: 8 }}>
          {history.length === 0 ? (
            <div className="caption" style={{ padding: 8 }}>
              No saved games yet. Play a game and save results.
            </div>
          ) : (
            history.map((g) => {
              const date = new Date(g.createdAt).toLocaleString();

              // Winner for summary (by finalScore desc, then decorCount desc, then name asc)
              const sorted = g.players
                .map((p) => ({ ...p }))
                .sort((a, b) => {
                  const d = (b.finalScore ?? 0) - (a.finalScore ?? 0);
                  if (d !== 0) return d;
                  const d2 = b.decorCount - a.decorCount;
                  if (d2 !== 0) return d2;
                  return a.name.localeCompare(b.name);
                });
              const winner = sorted[0];

              return (
                <details key={g.id} className="card accordion-item" style={{ padding: 12 }}>
                  <summary className="accordion-header" style={{ cursor: "pointer" }}>
                    <div
                      className="row"
                      style={{ justifyContent: "space-between", width: "100%", alignItems: "center", gap: 8 }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700 }}>{date}</div>
                        <div
                          className="caption"
                          style={{
                            maxWidth: "70ch",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Players: {g.players.map((p) => p.name).join(", ")}
                        </div>
                      </div>
                      <div className="row" style={{ gap: 8, alignItems: "center", flexShrink: 0 }}>
                        <span
                          aria-hidden
                          style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--celebration-gold)" }}
                        />
                        <div className="caption">Winner</div>
                        <div style={{ fontWeight: 700 }}>{winner?.name ?? "—"}</div>
                        <div style={{ fontWeight: 700 }}>{winner?.finalScore ?? 0}</div>
                      </div>
                    </div>
                  </summary>

                  <div className="accordion-panel">
                    {/* Players and scores */}
                    <div className="stack" style={{ gap: 6, marginTop: 6 }}>
                      {sorted.map((pl, i) => (
                        <section key={pl.name + i} className="card" style={{ padding: 10 }}>
                          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                            <div className="row" style={{ gap: 8, alignItems: "center" }}>
                              <span className="caption">
                                {i === 0 ? "1st" : i === 1 ? "2nd" : i === 2 ? "3rd" : `${i + 1}th`}
                              </span>
                              <strong>{pl.name}</strong>
                            </div>
                            <strong>{pl.finalScore ?? 0}</strong>
                          </div>

                          {/* Optional breakdown if present */}
                          {pl.breakdown ? (
                            <div className="stack" style={{ gap: 4, marginTop: 6 }}>
                              {/* Per color */}
                              <div className="row" style={{ justifyContent: "space-between" }}>
                                <span className="caption">Painting Values</span>
                              </div>
                              {Object.entries(pl.breakdown.perColor as Record<string, any>).map(([k, v]) => (
                                <div key={k} className="row" style={{ justifyContent: "space-between" }}>
                                  <span>{k.charAt(0).toUpperCase() + k.slice(1)} {v.tiles} × ×{v.multiplier} =</span>
                                  <span>{v.points}</span>
                                </div>
                              ))}
                              {/* Eyeline */}
                              <div className="row" style={{ justifyContent: "space-between" }}>
                                <span>Eyeline {pl.breakdown.eyeline.tiles} × +3 =</span>
                                <span>+{pl.breakdown.eyeline.points}</span>
                              </div>
                              {/* Decor */}
                              <div className="row" style={{ justifyContent: "space-between" }}>
                                <span>Decor</span>
                                <span>+{pl.breakdown.decor}</span>
                              </div>
                              {/* Bonuses */}
                              <div className="row" style={{ justifyContent: "space-between" }}>
                                <span>Complete Board</span>
                                <span>+{pl.breakdown.bonuses.completeBoard}</span>
                              </div>
                              {/* Penalties */}
                              <div className="row" style={{ justifyContent: "space-between" }}>
                                <span>Penalties</span>
                                <span>
                                  −
                                  {(pl.breakdown.penalties.emptyCorners ?? 0) +
                                    (pl.breakdown.penalties.unplacedPaintings ?? 0)}
                                </span>
                              </div>
                            </div>
                          ) : null}
                        </section>
                      ))}
                    </div>
                  </div>
                </details>
              );
            })
          )}
        </div>
      ) : (
        <section className="card" style={{ padding: 12 }}>
          {leaderboard.length === 0 ? (
            <div className="caption" style={{ padding: 8 }}>No leaderboard yet. Save games to build stats.</div>
          ) : (
            <table className="table" role="table" aria-label="Player leaderboard">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Wins</th>
                  <th>Games</th>
                  <th>Avg. Score</th>
                  <th>High</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((r, i) => (
                  <tr key={r.id}>
                    <td>#{i + 1}</td>
                    <td>{r.name}</td>
                    <td>{r.wins}</td>
                    <td>{r.games}</td>
                    <td>{r.avg}</td>
                    <td>{r.high}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}

/* =========================
   Prestige Track
   ========================= */

function PrestigeTrack({
  order,
  setOrder,
  locked,
}: {
  order: PrestigeOrderItem[];
  setOrder: (o: PrestigeOrderItem[]) => void;
  locked: boolean;
}) {
  const move = (idx: number, dir: -1 | 1) => {
    if (locked) return;
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    const swappedColors = swap(
      order.map((o) => o.color),
      idx,
      j
    );
    // Recompute multipliers by position (0→5,1→4,2→3,3→2)
    const next = swappedColors.map((c, i) => ({
      color: c,
      multiplier: (5 - i) as Multiplier,
    }));
    setOrder(next);
  };

  return (
    <section className="card" aria-labelledby="prestige-title">
      <div className="card-header">
        <h2 id="prestige-title" className="h2" style={{ margin: 0 }}>
          Prestige Track
        </h2>
        {locked ? (
          <span className="caption" aria-live="polite">
            Locked after scoring begins
          </span>
        ) : null}
      </div>
      <div className="prestige">
        {order.map((item, idx) => (
          <div className="chip" key={item.color}>
            <div
              className={`circle ${item.color}`}
              aria-label={`${colorLabel(item.color)}`}
              role="img"
              aria-roledescription="prestige color"
              style={{ width: 44, height: 44, borderRadius: "50%" }}
            />
            <div className="mul">×{item.multiplier}</div>
            <div className="row" style={{ gap: 4 }}>
              <button
                className="btn btn-outline"
                onClick={() => move(idx, -1)}
                disabled={locked || idx === 0}
                aria-label={`Move ${item.color} left`}
                style={{ height: 32, paddingInline: 8 }}
              >
                ←
              </button>
              <button
                className="btn btn-outline"
                onClick={() => move(idx, +1)}
                disabled={locked || idx === order.length - 1}
                aria-label={`Move ${item.color} right`}
                style={{ height: 32, paddingInline: 8 }}
              >
                →
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* =========================
   Results (unchanged except wording)
   ========================= */

type ResultsPlayer = {
  name: string;
  finalScore: number;
  breakdown: Breakdown;
  decorCount: number;
  rank: number;
};

function Results({
  playersSorted,
  onSave,
  onNew,
}: {
  playersSorted: ResultsPlayer[];
  onSave: () => void;
  onNew: () => void;
}) {
  const winner = playersSorted[0];
  const rest = playersSorted.slice(1);

  return (
    <div className="stack" style={{ marginBottom: 80 }}>
      <h1 className="h1">Game Results</h1>

      <section className="card winner-card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row" style={{ gap: 12, alignItems: "center" }}>
            <span
              aria-hidden
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--celebration-gold)",
              }}
            />
            <div>
              <div style={{ fontWeight: 700 }}>{winner.name}</div>
              <div className="caption">1st Place</div>
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 28 }}>{winner.finalScore}</div>
        </div>

        <details className="accordion-item" style={{ marginTop: 8 }}>
          <summary className="accordion-header">View Score Breakdown</summary>
          <div className="accordion-panel">
            {COLORS.map((c) => {
              const item = winner.breakdown.perColor[c];
              return (
                <div key={c} className="row" style={{ justifyContent: "space-between" }}>
                  <span>
                    {colorLabel(c)} {item.tiles} × ×{item.multiplier} =
                  </span>
                  <span>{item.points}</span>
                </div>
              );
            })}
            <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
              <span>Eyeline {winner.breakdown.eyeline.tiles} × +3 =</span>
              <span>+{winner.breakdown.eyeline.points}</span>
            </div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>Decor</span>
              <span>+{winner.breakdown.decor}</span>
            </div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>Complete Board</span>
              <span>+{winner.breakdown.bonuses.completeBoard}</span>
            </div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>Penalties</span>
              <span>
                −
                {winner.breakdown.penalties.emptyCorners +
                  winner.breakdown.penalties.unplacedPaintings}
              </span>
            </div>
          </div>
        </details>
      </section>

      {rest.map((p, i) => (
        <section key={p.name + i} className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="row" style={{ gap: 12, alignItems: "center" }}>
              <span
                aria-hidden
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: i === 0 ? "silver" : i === 1 ? "peru" : "transparent",
                  border: "1px solid rgba(13,27,42,0.2)",
                }}
              />
              <div>
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div className="caption">
                  {i === 0 ? "2nd Place" : i === 1 ? "3rd Place" : "4th Place"}
                </div>
              </div>
            </div>
            <div style={{ fontWeight: 700 }}>{p.finalScore}</div>
          </div>

          <details className="accordion-item" style={{ marginTop: 8 }}>
            <summary className="accordion-header">View Score Breakdown</summary>
            <div className="accordion-panel">
              {COLORS.map((c) => {
                const item = p.breakdown.perColor[c];
                return (
                  <div key={c} className="row" style={{ justifyContent: "space-between" }}>
                    <span>
                      {colorLabel(c)} {item.tiles} × ×{item.multiplier} =
                    </span>
                    <span>{item.points}</span>
                  </div>
                );
              })}
              <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
                <span>Eyeline {p.breakdown.eyeline.tiles} × +3 =</span>
                <span>+{p.breakdown.eyeline.points}</span>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span>Decor</span>
                <span>+{p.breakdown.decor}</span>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span>Complete Board</span>
                <span>+{p.breakdown.bonuses.completeBoard}</span>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span>Penalties</span>
                <span>
                  −
                  {p.breakdown.penalties.emptyCorners +
                    p.breakdown.penalties.unplacedPaintings}
                </span>
              </div>
            </div>
          </details>
        </section>
      ))}

      <div className="footer-bar">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <button className="btn btn-primary" onClick={onSave}>
            Save Game to History
          </button>
          <button className="btn btn-outline" onClick={onNew}>
            Start New Game
          </button>
        </div>
      </div>
    </div>
  );
}