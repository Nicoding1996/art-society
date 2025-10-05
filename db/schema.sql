-- Art Society Scorer — Supabase schema
-- Run this in Supabase SQL editor before deploying to Vercel

-- users (unified identities with unique canonical)
create table if not exists users (
  id text primary key,
  canonical text not null unique,
  display_name text not null,
  avatar_key text,
  color_hint text,
  created_at timestamptz default now()
);

-- Enforce one user per canonical globally
create unique index if not exists users_canonical_key on users (canonical);

-- players (identities)
create table if not exists players (
  id text primary key,
  canonical text not null,
  display_name text not null,
  avatar_key text,
  color_hint text,
  created_at timestamptz default now(),
  last_played_at timestamptz,
  games_played int default 0,
  wins int default 0
);

-- Prevent duplicate canonical names if you later want canonical uniqueness
-- (Optional: comment out if you prefer allowing same canonical under diff ids)
-- create unique index if not exists players_canonical_key on players (canonical);

-- games (snapshot per saved game)
create table if not exists games (
  id text primary key,
  created_at timestamptz default now(),
  prestige_order jsonb not null,
  players jsonb not null,
  version int default 1
);

-- lineups (exact order of players used)
create table if not exists lineups (
  id text primary key,
  size int not null,
  player_ids text[] not null,
  last_used_at timestamptz default now(),
  uses int default 1
);

-- Helpful indexes
create index if not exists players_last_played_idx on players (last_played_at desc nulls last);
create index if not exists players_wins_games_idx on players (wins desc, games_played desc);
create index if not exists games_created_idx on games (created_at desc);
create index if not exists lineups_last_used_idx on lineups (last_used_at desc);