"use client";

import React, { useEffect, useMemo, useState } from "react";

/* =========================================================================
   Art Society Scorer — MVP Implementation (with requested fixes)
   - Prestige Track (reorder via buttons; locks after any input)
   - 2–4 Player Cards with steppers (0–20), bonuses, penalties
   - Eyeline bonus +3 per tile for the current ×5 color only (clamped to total)
   - Calculate Scores → Results podium with breakdown
   - Save to History (localStorage MVP) + visible toast
   - Left-handed + Color-blind palette toggles applied to :root dataset
   - FIXES:
     * Removed “Full Gallery +5” entirely (kept “Complete Board +5” only)
     * Name input: can clear; fallback “Player N” applied on blur only
     * Stable ids: no random ids at render (use index-based p1..p4)
     * Visible toast for save feedback
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
  id: string;
  name: string; // may be ""
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
  players: Player[];
  version: number;
};

const COLORS: Color[] = ["red", "blue", "yellow", "green"];
const DEFAULT_PRESTIGE: PrestigeOrderItem[] = [
  { color: "blue", multiplier: 5 },
  { color: "green", multiplier: 4 },
  { color: "red", multiplier: 3 },
  { color: "yellow", multiplier: 2 },
];

function colorLabel(color: Color): string {
  return color[0].toUpperCase() + color.slice(1);
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
  const bonuses = (player.completeBoard ? 5 : 0);
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

// UI Controls
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

// Player Card
function PlayerCard({
  index,
  player,
  setPlayer,
  multipliers,
  x5Color,
  locked,
  announce,
  order,
}: {
  index: number;
  player: Player;
  setPlayer: (p: Player) => void;
  multipliers: Record<Color, Multiplier>;
  x5Color: Color;
  locked: boolean;
  announce: (msg: string) => void;
  order: PrestigeOrderItem[];
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

  return (
    <section className="card" aria-labelledby={`player-${player.id}-title`}>
      <div className="card-header">
        <div className="row" style={{ gap: 12 }}>
          <div
            aria-hidden
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: "2px solid rgba(13,27,42,0.2)",
            }}
          />
          <input
            id={`player-${player.id}-title`}
            value={player.name}
            onChange={(e) =>
              setPlayer({
                ...player,
                name: e.target.value, // allow blank while editing
              })
            }
            onBlur={(e) => {
              const trimmed = e.target.value.trim();
              if (!trimmed) {
                setPlayer({ ...player, name: `Player ${index + 1}` });
              }
            }}
            aria-label="Player name"
            style={{
              border: "none",
              background: "transparent",
              fontWeight: 700,
              fontSize: 16,
              outline: "none",
            }}
            placeholder={`Player ${index + 1}`}
          />
        </div>
      </div>

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
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path fill="currentColor" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/>
              </svg>
            ) : (
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

function swap<T>(arr: T[], i: number, j: number): T[] {
  const copy = arr.slice();
  const tmp = copy[i];
  copy[i] = copy[j];
  copy[j] = tmp;
  return copy;
}

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
  // Stable id, avoids hydration mismatch (no randomness)
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

export default function Page() {
  // Global UI options
  const [leftHanded, setLeftHanded] = useState(false);
  const [palette, setPalette] = useState<"default" | "deuteranopia" | "protanopia" | "tritanopia">("default");

  // Game state
  const [prestige, setPrestige] = useState<PrestigeOrderItem[]>(DEFAULT_PRESTIGE);
  const [players, setPlayers] = useState<Player[]>([defaultPlayer(1), defaultPlayer(2)]);
  const [resultsMode, setResultsMode] = useState(false);
  const [announceMsg, setAnnounceMsg] = useState<string>("");

  const locked = useMemo(() => hasAnyInput(players), [players]);
  const x5Color = findX5Color(prestige);
  const multipliers = useMemo(() => multiplierMap(prestige), [prestige]);

  useEffect(() => {
    document.documentElement.setAttribute("data-left-handed", String(leftHanded));
  }, [leftHanded]);

  useEffect(() => {
    document.documentElement.setAttribute("data-palette", palette);
  }, [palette]);

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

  const saveGame = () => {
    const data: Game = {
      id: `g-${Date.now()}`, // not rendered in markup; allowed to be dynamic
      createdAt: new Date().toISOString(),
      prestigeOrder: prestige,
      players,
      version: 1,
    };
    try {
      const key = "art-society:history";
      const existing = JSON.parse(localStorage.getItem(key) || "[]") as Game[];
      existing.unshift(data);
      localStorage.setItem(key, JSON.stringify(existing));
      setAnnounceMsg("Saved to History");
    } catch {
      setAnnounceMsg("Save failed. Check connection and try again.");
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
        </div>
      </header>

      {!resultsMode ? (
        <>
          {/* Setup */}
          <PrestigeTrack order={prestige} setOrder={locked ? () => {} : setPrestige} locked={locked} />

          {/* Player count controls */}
          <section className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="section-title">Players</div>
              <div className="row" style={{ gap: 8 }}>
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
          {players.map((p, idx) => (
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
            />
          ))}

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
    </main>
  );
}